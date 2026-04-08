import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { getSettingsListTheme } from "@mariozechner/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Text } from "@mariozechner/pi-tui";
import { newsPresentationLabel, t } from "../i18n/pet.js";
import type { NewsSourceConfig, PetConfig, PetLocale } from "../types.js";

export async function openNewsConfig(
	ctx: ExtensionContext,
	config: PetConfig,
	locale: PetLocale,
	onChange: (id: string, value: string) => Promise<void> | void,
): Promise<void> {
	const items = buildItems(config, locale);

	await ctx.ui.custom<void>((tui, theme, _kb, done) => {
		const container = new Container();
		container.addChild(new Text(theme.fg("accent", theme.bold(t(locale, "news.config.title"))), 1, 0));
		container.addChild(new Text(theme.fg("dim", t(locale, "news.config.subtitle")), 1, 0));

		const settingsList = new SettingsList(
			items,
			Math.min(items.length + 2, 18),
			getSettingsListTheme(),
			(id, newValue) => {
				void onChange(id, newValue);
			},
			() => done(undefined),
			{ enableSearch: true },
		);

		container.addChild(settingsList);
		container.addChild(new Text(theme.fg("dim", t(locale, "news.config.removeHint")), 1, 0));

		return {
			render(width: number): string[] {
				return container.render(width);
			},
			invalidate(): void {
				container.invalidate();
			},
			handleInput(data: string): void {
				settingsList.handleInput?.(data);
				tui.requestRender();
			},
		};
	}, {
		overlay: true,
		overlayOptions: {
			anchor: "center",
			width: 72,
			maxHeight: 22,
			margin: 1,
		},
	});
}

function buildItems(config: PetConfig, locale: PetLocale): SettingItem[] {
	const items: SettingItem[] = [
		{
			id: "newsEnabled",
			label: t(locale, "news.config.enabled"),
			currentValue: config.newsEnabled ? "on" : "off",
			values: ["on", "off"],
		},
		{
			id: "newsPresentation",
			label: t(locale, "news.config.presentation"),
			currentValue: config.newsPresentation,
			values: ["speech", "speech+footer", "footer"],
			description: ["speech", "speech+footer", "footer"].map((mode) => newsPresentationLabel(locale, mode as typeof config.newsPresentation)).join(" · "),
		},
		{
			id: "newsRotateMs",
			label: t(locale, "news.config.rotateMs"),
			currentValue: String(config.newsRotateMs),
			values: ["100", "300", "1000", "3000"],
			description: "100ms · 300ms · 1s · 3s",
		},
	];

	for (const source of config.newsSources) {
		items.push(sourceToSettingItem(source));
	}

	return items;
}

function sourceToSettingItem(source: NewsSourceConfig): SettingItem {
	const suffix = source.type === "rss" && source.url ? ` (${source.id})` : "";
	return {
		id: `source:${source.id}`,
		label: `${source.label}${suffix}`,
		currentValue: source.enabled ? "on" : "off",
		values: ["on", "off"],
	};
}
