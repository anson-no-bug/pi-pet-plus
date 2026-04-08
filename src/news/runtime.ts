import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { emitPetSpeech } from "../contracts/pet-events.js";
import { registerPetNewsContract } from "../contracts/pet-news-events.js";
import { newsPresentationLabel, t } from "../i18n/pet.js";
import { normalizeNewsPresentation, readConfigUnlocked, writeConfigUnlocked } from "../store/config.js";
import { withPetLock } from "../store/fs.js";
import { readNewsCacheUnlocked, writeNewsCacheUnlocked } from "../store/news-cache.js";
import type { NewsCache, NewsItem, NewsSourceConfig, PetConfig } from "../types.js";
import { openNewsConfig } from "../ui/news-config.js";
import { openNewsOverlay } from "../ui/news-overlay.js";
import { fetchNewsSource } from "./fetch.js";
import {
	createCustomRssSource,
	DEFAULT_NEWS_ROTATE_MS,
	DEFAULT_NEWS_SOURCES,
	normalizeNewsSources,
	normalizeUrl,
} from "./sources.js";

const NEWS_STALE_MS = 10 * 60_000;
const NEWS_REFRESH_LOOP_MS = 5 * 60_000;
const MAX_HEADLINES = 24;

export function shouldSpeakHeadlines(config: Pick<PetConfig, "newsPresentation">): boolean {
	return config.newsPresentation === "speech" || config.newsPresentation === "speech+footer";
}

export function shouldRenderFooter(config: Pick<PetConfig, "newsPresentation">): boolean {
	return config.newsPresentation === "footer" || config.newsPresentation === "speech+footer";
}

export function buildHeadlineSpeech(item: NewsItem, locale: PetConfig["locale"]): string {
	return t(locale, "pet.speech.news", { headline: `[${item.sourceLabel}] ${item.title}` });
}

export class NewsRuntime {
	private config: PetConfig = {
		version: 2,
		activePetId: null,
		renderMode: "ascii",
		animationEnabled: true,
		animationFps: 2,
		widgetEnabled: true,
		widgetPlacement: "aboveEditor",
		locale: "zh",
		newsEnabled: false,
		newsPresentation: "speech",
		newsRotateMs: DEFAULT_NEWS_ROTATE_MS,
		newsSources: normalizeNewsSources(undefined),
	};
	private cache: NewsCache = { version: 1, updatedAt: 0, items: [], sources: {} };
	private lastContext?: ExtensionContext;
	private refreshTimer?: ReturnType<typeof setInterval>;
	private rotationTimer?: ReturnType<typeof setInterval>;
	private refreshInFlight?: Promise<void>;
	private currentIndex = 0;
	private footerRequestRender?: () => void;
	private footerVersion = 0;
	private footerInstalled = false;
	private shuttingDown = false;
	private disposeContract?: () => void;
	private lastHeadlineSpeechAt = 0;

	constructor(private readonly _pi: ExtensionAPI) {
		this.disposeContract = registerPetNewsContract({
			openMenu: async (ctx) => {
				this.setContext(ctx);
				await this.showMenu(ctx);
			},
		});
	}

	setContext(ctx: ExtensionContext): void {
		this.lastContext = ctx;
		this.requestFooterRender();
	}

	async initialize(ctx: ExtensionContext): Promise<void> {
		this.lastContext = ctx;
		this.shuttingDown = false;
		await this.syncFromDisk(ctx);
		if (this.config.newsEnabled) {
			void this.ensureFresh(false).catch((error) => {
				this.notify(t(this.locale(), "news.notifications.refreshWarning", { error: toErrorMessage(error) }), "warning");
			});
		}
	}

	async syncFromDisk(ctx?: ExtensionContext): Promise<void> {
		if (ctx) this.lastContext = ctx;
		const snapshot = await withPetLock(async () => ({
			config: await readConfigUnlocked(),
			cache: await readNewsCacheUnlocked(),
		}));
		this.config = snapshot.config;
		this.cache = snapshot.cache;
		this.reconcileTickerIndex();
		this.configureRefreshLoop();
		this.configureRotationLoop();
		this.installOrClearFooter();
		this.requestFooterRender();
	}

	async shutdown(ctx?: ExtensionContext): Promise<void> {
		if (ctx) this.lastContext = ctx;
		this.shuttingDown = true;
		this.disposeContract?.();
		this.disposeContract = undefined;
		if (this.refreshTimer) clearInterval(this.refreshTimer);
		if (this.rotationTimer) clearInterval(this.rotationTimer);
		this.refreshTimer = undefined;
		this.rotationTimer = undefined;
		if (this.footerInstalled && this.lastContext?.hasUI) {
			this.lastContext.ui.setFooter(undefined);
		}
		this.footerInstalled = false;
		this.footerRequestRender = undefined;
	}

	async handleCommand(rawArgs: string, ctx: ExtensionCommandContext): Promise<void> {
		this.lastContext = ctx;
		const trimmed = rawArgs.trim();
		if (!trimmed) {
			await this.showMenu(ctx);
			return;
		}

		const [subcommand, ...rest] = trimmed.split(/\s+/);
		const tail = rest.join(" ").trim();

		switch (subcommand) {
			case "on":
			case "enable":
				await this.setEnabled(true);
				this.notify(t(this.locale(), "news.notifications.enabled"));
				await this.ensureFresh(false, true);
				return;
			case "off":
			case "disable":
				await this.setEnabled(false);
				this.notify(t(this.locale(), "news.notifications.disabled"));
				return;
			case "toggle":
				await this.setEnabled(!this.config.newsEnabled);
				this.notify(this.config.newsEnabled ? t(this.locale(), "news.notifications.enabled") : t(this.locale(), "news.notifications.disabled"));
				if (this.config.newsEnabled) await this.ensureFresh(false, true);
				return;
			case "open":
			case "list":
				await this.openOverlayOrNotify(ctx);
				return;
			case "next":
				this.stepHeadline(1);
				return;
			case "prev":
				this.stepHeadline(-1);
				return;
			case "refresh":
				await this.ensureFresh(true, true);
				return;
			case "config":
				if (!ctx.hasUI) {
					this.showStatus();
					return;
				}
				await openNewsConfig(ctx, this.config, this.locale(), async (id, value) => {
					await this.handleConfigChange(id, value);
				});
				return;
			case "add-rss":
				await this.handleAddRss(tail, ctx);
				return;
			case "remove":
				await this.handleRemoveSource(tail);
				return;
			case "status":
				this.showStatus();
				return;
			case "help":
			default:
				this.notify(this.usage(), subcommand === "help" ? "info" : "warning");
				return;
		}
	}

	getCommandCompletions(prefix: string): Array<{ value: string; label: string }> | null {
		const trimmed = prefix.trimStart();
		if (!trimmed.includes(" ")) {
			return filterCompletions(
				["open", "toggle", "on", "off", "next", "prev", "refresh", "config", "add-rss", "remove", "status"],
				trimmed,
			);
		}

		if (trimmed.startsWith("remove ")) {
			const tail = trimmed.slice("remove ".length).toLowerCase();
			return filterCompletions(this.config.newsSources.map((source) => source.id), tail, "remove ");
		}

		return null;
	}

	private async updateConfig(transform: (config: PetConfig) => PetConfig): Promise<void> {
		this.config = await withPetLock(async () => {
			const current = await readConfigUnlocked();
			const next = transform(current);
			await writeConfigUnlocked(next);
			return next;
		});
		this.configureRefreshLoop();
		this.configureRotationLoop();
		this.installOrClearFooter();
		this.requestFooterRender();
	}

	private async setEnabled(enabled: boolean): Promise<void> {
		await this.updateConfig((config) => ({ ...config, newsEnabled: enabled }));
	}

	private async showMenu(ctx: ExtensionCommandContext): Promise<void> {
		if (!ctx.hasUI) {
			this.showStatus();
			return;
		}

		const toggleLabel = this.config.newsEnabled ? t(this.locale(), "news.menu.toggle.off") : t(this.locale(), "news.menu.toggle.on");
		const choice = await ctx.ui.select(t(this.locale(), "news.menu.title"), [
			t(this.locale(), "news.menu.view"),
			toggleLabel,
			t(this.locale(), "news.menu.next"),
			t(this.locale(), "news.menu.refresh"),
			t(this.locale(), "news.menu.config"),
			t(this.locale(), "news.menu.addRss"),
		]);

		switch (choice) {
			case undefined:
				return;
			case t(this.locale(), "news.menu.view"):
				await this.openOverlayOrNotify(ctx);
				break;
			case t(this.locale(), "news.menu.next"):
				this.stepHeadline(1);
				break;
			case t(this.locale(), "news.menu.refresh"):
				await this.ensureFresh(true, true);
				break;
			case t(this.locale(), "news.menu.config"):
				await openNewsConfig(ctx, this.config, this.locale(), async (id, value) => {
					await this.handleConfigChange(id, value);
				});
				break;
			case t(this.locale(), "news.menu.addRss"):
				await this.handleAddRss("", ctx);
				break;
			default:
				if (choice === toggleLabel) {
					await this.setEnabled(!this.config.newsEnabled);
					this.notify(this.config.newsEnabled ? t(this.locale(), "news.notifications.enabled") : t(this.locale(), "news.notifications.disabled"));
					if (this.config.newsEnabled) await this.ensureFresh(false, true);
				}
		}
	}

	private async openOverlayOrNotify(ctx: ExtensionContext): Promise<void> {
		if (this.cache.items.length === 0) {
			await this.ensureFresh(false, false);
		}
		if (ctx.hasUI) {
			await openNewsOverlay(ctx, this.cache.items, this.cache.updatedAt, this.locale());
			return;
		}
		this.showStatus();
	}

	private async handleConfigChange(id: string, value: string): Promise<void> {
		if (id === "newsEnabled") {
			await this.setEnabled(value === "on");
			return;
		}

		if (id === "newsPresentation") {
			await this.updateConfig((config) => ({
				...config,
				newsPresentation: normalizeNewsPresentation(value),
			}));
			return;
		}

		if (id === "newsRotateMs") {
			await this.updateConfig((config) => ({
				...config,
				newsRotateMs: Number(value) || DEFAULT_NEWS_ROTATE_MS,
			}));
			return;
		}

		if (id.startsWith("source:")) {
			const sourceId = id.slice("source:".length);
			await this.updateConfig((config) => ({
				...config,
				newsSources: normalizeNewsSources(
					config.newsSources.map((source) => (source.id === sourceId ? { ...source, enabled: value === "on" } : source)),
				),
			}));
			if (value === "on") await this.ensureFresh(false, false);
		}
	}

	private async handleAddRss(args: string, ctx: ExtensionCommandContext): Promise<void> {
		let urlAndLabel = args;
		if (!urlAndLabel && ctx.hasUI) {
			const url = await ctx.ui.input(t(this.locale(), "news.add.url"), "https://example.com/feed.xml");
			if (!url) return;
			const label = await ctx.ui.input(t(this.locale(), "news.add.label"), "");
			urlAndLabel = `${url} ${label ?? ""}`.trim();
		}
		if (!urlAndLabel) {
			this.notify(t(this.locale(), "news.notifications.addRssUsage"), "warning");
			return;
		}

		const [urlToken, ...labelTokens] = urlAndLabel.split(/\s+/);
		const label = labelTokens.join(" ").trim();
		let source: NewsSourceConfig;
		try {
			source = createCustomRssSource(urlToken ?? "", label || undefined);
		} catch (error) {
			this.notify(toErrorMessage(error), "warning");
			return;
		}

		await this.updateConfig((config) => ({
			...config,
			newsSources: normalizeNewsSources([...config.newsSources, source]),
		}));
		this.notify(t(this.locale(), "news.notifications.addedSource", { label: source.label, url: normalizeUrl(source.url ?? "") }));
		await this.ensureFresh(true, false);
	}

	private async handleRemoveSource(query: string): Promise<void> {
		const trimmed = query.trim().toLowerCase();
		if (!trimmed) {
			this.notify(t(this.locale(), "news.notifications.removeUsage"), "warning");
			return;
		}

		const source = this.config.newsSources.find(
			(item) => item.id.toLowerCase() === trimmed || item.label.toLowerCase() === trimmed,
		);
		if (!source) {
			this.notify(t(this.locale(), "news.notifications.missingSource", { query }), "warning");
			return;
		}

		const isBuiltin = DEFAULT_NEWS_SOURCES.some((item) => item.id === source.id);
		await this.updateConfig((config) => ({
			...config,
			newsSources: isBuiltin
				? normalizeNewsSources(config.newsSources.map((item) => (item.id === source.id ? { ...item, enabled: false } : item)))
				: normalizeNewsSources(config.newsSources.filter((item) => item.id !== source.id)),
		}));
		this.notify(isBuiltin ? t(this.locale(), "news.notifications.disabledSource", { label: source.label }) : t(this.locale(), "news.notifications.removedSource", { label: source.label }));
	}

	private showStatus(): void {
		const enabledSources = this.config.newsSources.filter((source) => source.enabled);
		const headlines = this.cache.items.slice(0, 5).map((item, index) => `${index + 1}. [${item.sourceLabel}] ${item.title}`);
		this.notify(
			[
				`${t(this.locale(), "news.status.enabled")}: ${this.config.newsEnabled ? "on" : "off"}`,
				`${t(this.locale(), "news.status.presentation")}: ${newsPresentationLabel(this.locale(), this.config.newsPresentation)}`,
				`${t(this.locale(), "news.status.rotateMs")}: ${formatRotateSpeed(this.config.newsRotateMs)}`,
				`${t(this.locale(), "news.status.enabledSources")}: ${enabledSources.map((source) => source.label).join(this.locale() === "zh" ? "、" : ", ") || t(this.locale(), "news.notifications.noEnabledSources")}`,
				`${t(this.locale(), "news.status.updatedAt")}: ${this.cache.updatedAt ? new Date(this.cache.updatedAt).toLocaleString() : t(this.locale(), "news.status.never")}`,
				headlines.length > 0 ? t(this.locale(), "news.status.headlines") : t(this.locale(), "news.status.noCache"),
				...headlines,
			].join("\n"),
		);
	}

	private async ensureFresh(force: boolean, notifyOnSuccess = false): Promise<void> {
		if (this.refreshInFlight) {
			await this.refreshInFlight;
			return;
		}

		if (!force && !this.isCacheStale()) {
			if (notifyOnSuccess) this.notify(t(this.locale(), "news.notifications.cacheFresh"));
			return;
		}

		this.refreshInFlight = this.refreshNews(force)
			.then((updated) => {
				if (updated) {
					if (notifyOnSuccess) this.notify(t(this.locale(), "news.notifications.refreshed", { count: this.cache.items.length }));
					return;
				}
				if (notifyOnSuccess) {
					this.notify(
						this.cache.items.length > 0
							? t(this.locale(), "news.notifications.refreshFailedKeepCache")
							: t(this.locale(), "news.notifications.refreshFailedEmpty"),
						"warning",
					);
				}
			})
			.finally(() => {
				this.refreshInFlight = undefined;
			});

		await this.refreshInFlight;
	}

	private async refreshNews(_force: boolean): Promise<boolean> {
		const enabledSources = this.config.newsSources.filter((source) => source.enabled);
		if (enabledSources.length === 0) {
			this.configureRotationLoop();
			this.requestFooterRender();
			return false;
		}

		const now = Date.now();
		const results = await Promise.all(
			enabledSources.map(async (source) => {
				try {
					const items = await fetchNewsSource(source);
					return { source, items, fetchedAt: now, error: undefined };
				} catch (error) {
					return { source, items: [] as NewsItem[], fetchedAt: now, error: toErrorMessage(error) };
				}
			}),
		);

		const anySuccess = results.some((result) => result.items.length > 0);
		const nextItems = results
			.flatMap((result) => result.items)
			.sort((left, right) => (right.publishedAt ?? right.fetchedAt) - (left.publishedAt ?? left.fetchedAt))
			.slice(0, MAX_HEADLINES);

		this.cache = await withPetLock(async () => {
			const current = await readNewsCacheUnlocked();
			const sources = { ...current.sources };
			for (const result of results) {
				sources[result.source.id] = {
					fetchedAt: result.fetchedAt,
					items: result.items,
					error: result.error,
				};
			}
			const merged: NewsCache = {
				version: 1,
				updatedAt: now,
				items: nextItems.length > 0 ? nextItems : current.items,
				sources,
			};
			await writeNewsCacheUnlocked(merged);
			return merged;
		});

		this.reconcileTickerIndex();
		this.configureRotationLoop();
		this.installOrClearFooter();
		this.requestFooterRender();
		if (anySuccess) this.emitCurrentHeadlineSpeech();
		return anySuccess;
	}

	private isCacheStale(): boolean {
		if (this.cache.items.length === 0) return true;
		return Date.now() - this.cache.updatedAt > NEWS_STALE_MS;
	}

	private configureRefreshLoop(): void {
		if (this.refreshTimer) {
			clearInterval(this.refreshTimer);
			this.refreshTimer = undefined;
		}
		if (!this.config.newsEnabled) return;

		this.refreshTimer = setInterval(() => {
			if (this.shuttingDown) return;
			void this.ensureFresh(false).catch(() => undefined);
		}, NEWS_REFRESH_LOOP_MS);
	}

	private configureRotationLoop(): void {
		if (this.rotationTimer) {
			clearInterval(this.rotationTimer);
			this.rotationTimer = undefined;
		}
		if (!this.config.newsEnabled || this.cache.items.length === 0) return;
		if (!shouldSpeakHeadlines(this.config) && !shouldRenderFooter(this.config)) return;

		this.rotationTimer = setInterval(() => {
			if (this.shuttingDown) return;
			this.advanceTicker();
			this.emitCurrentHeadlineSpeech();
			this.requestFooterRender();
		}, Math.max(100, this.config.newsRotateMs));
	}

	private installOrClearFooter(): void {
		const ctx = this.lastContext;
		if (!ctx?.hasUI) return;

		if (!this.config.newsEnabled || !shouldRenderFooter(this.config)) {
			if (this.footerInstalled) {
				ctx.ui.setFooter(undefined);
				this.footerRequestRender = undefined;
				this.footerVersion += 1;
				this.footerInstalled = false;
			}
			return;
		}

		this.footerInstalled = true;
		const footerVersion = ++this.footerVersion;
		ctx.ui.setFooter((tui, theme, footerData) => {
			this.footerRequestRender = () => tui.requestRender();
			const unsubscribe = footerData.onBranchChange(() => tui.requestRender());

			return {
				dispose: () => {
					unsubscribe();
					if (this.footerVersion === footerVersion) {
						this.footerRequestRender = undefined;
					}
				},
				invalidate: () => {},
				render: (width: number) => {
					const line = this.renderFooterLine(width, footerData.getGitBranch(), this.lastContext?.model?.id);
					return [truncateToWidth(theme.fg("text", line), width, "", true)];
				},
			};
		});
	}

	private renderFooterLine(width: number, branch: string | null, modelId: string | undefined): string {
		const headline = this.currentHeadline;
		const left = headline
			? `📰 ${this.currentIndex + 1}/${this.cache.items.length} [${headline.sourceLabel}] ${headline.title}`
			: this.config.newsSources.some((source) => source.enabled)
				? this.refreshInFlight
					? t(this.locale(), "news.footer.refreshing")
					: t(this.locale(), "news.footer.noNews")
				: t(this.locale(), "news.footer.noSources");

		const rightParts = [
			this.cache.updatedAt > 0 ? `↻ ${formatRelativeAge(this.cache.updatedAt)}` : undefined,
			this.config.newsEnabled ? `⟳ ${formatRotateSpeed(this.config.newsRotateMs)}` : undefined,
			modelId,
			branch ? `(${branch})` : undefined,
		].filter(Boolean) as string[];
		const right = rightParts.join(" · ");

		if (!right) return truncateToWidth(left, width, "...", true);
		const availableLeft = Math.max(12, width - visibleWidth(right) - 1);
		const leftPadded = truncateToWidth(left, availableLeft, "...", true);
		const spaces = " ".repeat(Math.max(1, width - visibleWidth(leftPadded) - visibleWidth(right)));
		return `${leftPadded}${spaces}${right}`;
	}

	private get currentHeadline(): NewsItem | undefined {
		if (this.cache.items.length === 0) return undefined;
		return this.cache.items[this.currentIndex % this.cache.items.length];
	}

	private advanceTicker(): void {
		if (this.cache.items.length === 0) return;
		this.currentIndex = (this.currentIndex + 1) % this.cache.items.length;
	}

	private reconcileTickerIndex(): void {
		if (this.cache.items.length === 0) {
			this.currentIndex = 0;
			return;
		}
		this.currentIndex = this.currentIndex % this.cache.items.length;
	}

	private requestFooterRender(): void {
		this.footerRequestRender?.();
	}

	private stepHeadline(direction: 1 | -1): void {
		if (this.cache.items.length === 0) {
			this.notify(t(this.locale(), "news.notifications.noNews"), "warning");
			return;
		}
		const total = this.cache.items.length;
		this.currentIndex = (this.currentIndex + direction + total) % total;
		this.emitCurrentHeadlineSpeech();
		this.requestFooterRender();
	}

	private emitCurrentHeadlineSpeech(): void {
		if (!this.config.newsEnabled || !shouldSpeakHeadlines(this.config)) return;
		const now = Date.now();
		if (now - this.lastHeadlineSpeechAt < 8_000) return;
		const headline = this.currentHeadline;
		if (!headline) return;
		this.lastHeadlineSpeechAt = now;
		emitPetSpeech({
			text: buildHeadlineSpeech(headline, this.locale()),
			source: "news",
			animationState: "news-speaking",
			priority: 1,
			durationMs: 6_000,
			dedupeKey: headline.id,
		});
	}

	private usage(): string {
		return [
			t(this.locale(), "news.commands.usageHeader"),
			t(this.locale(), "news.commands.menu"),
			t(this.locale(), "news.commands.open"),
			t(this.locale(), "news.commands.toggle"),
			t(this.locale(), "news.commands.onOff"),
			t(this.locale(), "news.commands.nextPrev"),
			t(this.locale(), "news.commands.refresh"),
			t(this.locale(), "news.commands.config"),
			t(this.locale(), "news.commands.addRss"),
			t(this.locale(), "news.commands.remove"),
			t(this.locale(), "news.commands.status"),
		].join("\n");
	}

	private locale(): PetConfig["locale"] {
		return this.config.locale;
	}

	private notify(message: string, type: "info" | "warning" | "error" = "info"): void {
		this.lastContext?.ui.notify(message, type);
	}
}

function formatRotateSpeed(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	if (ms % 1000 === 0) return `${Math.round(ms / 1000)}s`;
	return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelativeAge(timestamp: number): string {
	const diff = Math.max(0, Date.now() - timestamp);
	if (diff < 60_000) return `${Math.max(1, Math.floor(diff / 1000))}s`;
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
	return `${Math.floor(diff / 3_600_000)}h`;
}

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

function filterCompletions(values: string[], query: string, prefix = ""): Array<{ value: string; label: string }> | null {
	const normalized = query.toLowerCase();
	const items = values
		.filter((value) => value.toLowerCase().startsWith(normalized))
		.map((value) => ({ value: `${prefix}${value}`, label: value }));
	return items.length > 0 ? items : null;
}
