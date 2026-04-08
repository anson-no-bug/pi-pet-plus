import type { ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { t } from "../i18n/pet.js";
import type { NewsItem, PetLocale } from "../types.js";

interface NewsOverlayOptions {
	items: NewsItem[];
	updatedAt: number;
	locale: PetLocale;
	onDone: () => void;
}

export async function openNewsOverlay(
	ctx: ExtensionContext,
	items: NewsItem[],
	updatedAt: number,
	locale: PetLocale,
): Promise<void> {
	await ctx.ui.custom<void>((_tui, theme, _kb, done) => {
		return new NewsOverlayComponent({ items, updatedAt, locale, onDone: () => done(undefined) }, theme);
	}, {
		overlay: true,
		overlayOptions: {
			anchor: "center",
			width: 90,
			maxHeight: 22,
			margin: 1,
		},
	});
}

class NewsOverlayComponent {
	private readonly items: NewsItem[];
	private readonly updatedAt: number;
	private readonly locale: PetLocale;
	private readonly onDone: () => void;
	private readonly theme: Theme;
	private selectedIndex = 0;

	constructor(options: NewsOverlayOptions, theme: Theme) {
		this.items = options.items;
		this.updatedAt = options.updatedAt;
		this.locale = options.locale;
		this.onDone = options.onDone;
		this.theme = theme;
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c") || matchesKey(data, "return")) {
			this.onDone();
			return;
		}

		if (matchesKey(data, "up")) {
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
			return;
		}

		if (matchesKey(data, "down")) {
			this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
		}
	}

	render(width: number): string[] {
		const th = this.theme;
		const innerWidth = Math.max(48, width - 2);
		const leftWidth = Math.min(42, Math.max(28, Math.floor(innerWidth * 0.48)));
		const rightWidth = Math.max(18, innerWidth - leftWidth - 1);
		const lines: string[] = [];
		const subtitle = this.updatedAt > 0
			? t(this.locale, "news.overlay.updatedAt", { time: new Date(this.updatedAt).toLocaleTimeString() })
			: t(this.locale, "news.overlay.never");

		lines.push(th.fg("border", `╭${"─".repeat(innerWidth)}╮`));
		lines.push(
			th.fg("border", "│") +
				padAnsi(th.fg("accent", th.bold(t(this.locale, "news.overlay.title"))) + th.fg("dim", `  ${subtitle}`), innerWidth) +
				th.fg("border", "│"),
		);
		lines.push(th.fg("border", `├${"─".repeat(innerWidth)}┤`));

		const listLines = this.buildListLines(leftWidth);
		const detailLines = this.buildDetailLines(rightWidth);
		const contentHeight = Math.max(listLines.length, detailLines.length);
		for (let index = 0; index < contentHeight; index += 1) {
			const left = padAnsi(listLines[index] ?? "", leftWidth);
			const right = padAnsi(detailLines[index] ?? "", rightWidth);
			lines.push(th.fg("border", "│") + left + th.fg("border", "│") + right + th.fg("border", "│"));
		}

		lines.push(th.fg("border", `├${"─".repeat(innerWidth)}┤`));
		lines.push(
			th.fg("border", "│") +
				padAnsi(th.fg("dim", t(this.locale, "news.overlay.help")), innerWidth) +
				th.fg("border", "│"),
		);
		lines.push(th.fg("border", `╰${"─".repeat(innerWidth)}╯`));

		return lines.map((line) => truncateToWidth(line, width, "", true));
	}

	invalidate(): void {}

	private buildListLines(width: number): string[] {
		const th = this.theme;
		const lines = [th.fg("accent", t(this.locale, "news.overlay.list")), th.fg("dim", `${this.selectedIndex + 1}/${this.items.length || 1}`), ""];
		const maxVisible = 8;
		const start = Math.max(0, Math.min(this.selectedIndex - Math.floor(maxVisible / 2), Math.max(0, this.items.length - maxVisible)));
		const visibleItems = this.items.slice(start, start + maxVisible);

		if (visibleItems.length === 0) {
			lines.push(th.fg("dim", t(this.locale, "news.overlay.empty")));
			return lines;
		}

		for (const [offset, item] of visibleItems.entries()) {
			const absoluteIndex = start + offset;
			const selected = absoluteIndex === this.selectedIndex;
			const prefix = selected ? th.fg("accent", "❯ ") : "  ";
			const title = selected ? th.fg("accent", item.title) : item.title;
			lines.push(truncateToWidth(`${prefix}${title}`, width, "...", true));
			lines.push(truncateToWidth(`   ${th.fg("dim", item.sourceLabel)}`, width, "...", true));
		}

		return lines;
	}

	private buildDetailLines(width: number): string[] {
		const th = this.theme;
		const item = this.items[this.selectedIndex];
		if (!item) {
			return [th.fg("dim", t(this.locale, "news.overlay.emptyDetail"))];
		}

		const published = item.publishedAt ? new Date(item.publishedAt).toLocaleString() : "-";
		const metadata = [item.sourceLabel, item.byline, item.score !== undefined ? `${item.score} pts` : undefined]
			.filter(Boolean)
			.join(" · ");

		return [
			th.fg("accent", t(this.locale, "news.overlay.detail")),
			th.fg("dim", metadata || "-"),
			"",
			...wrapText(item.title, width).map((line, index) => (index === 0 ? th.bold(line) : line)),
			"",
			th.fg("muted", t(this.locale, "news.overlay.publishedAt", { time: published })),
			th.fg("muted", t(this.locale, "news.overlay.link")),
			th.fg("accent", createHyperlink(item.url, t(this.locale, "news.overlay.openLink"))),
			th.fg("dim", formatUrlForDisplay(item.url, width)),
		].map((line) => truncateToWidth(line, width, "...", true));
	}
}

function createHyperlink(url: string, label: string): string {
	return `\x1b]8;;${url}\x07${label}\x1b]8;;\x07`;
}

function formatUrlForDisplay(url: string, width: number): string {
	try {
		const parsed = new URL(url);
		const display = `${parsed.hostname}${parsed.pathname}${parsed.search}`;
		return truncateToWidth(display, Math.max(12, width), "...", true);
	} catch {
		return truncateToWidth(url.replace(/^https?:\/\//, ""), Math.max(12, width), "...", true);
	}
}

function wrapText(text: string, width: number): string[] {
	const words = text.split(/\s+/).filter(Boolean);
	if (words.length === 0) return [""];
	const lines: string[] = [];
	let current = "";

	for (const word of words) {
		const next = current ? `${current} ${word}` : word;
		if (visibleWidth(next) <= width) {
			current = next;
			continue;
		}
		if (current) lines.push(current);
		current = word;
	}

	if (current) lines.push(current);
	return lines;
}

function padAnsi(text: string, width: number): string {
	const trimmed = truncateToWidth(text, width, "", true);
	return trimmed + " ".repeat(Math.max(0, width - visibleWidth(trimmed)));
}
