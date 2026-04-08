import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { getSettingsListTheme } from "@mariozechner/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Text } from "@mariozechner/pi-tui";
import { t } from "../i18n/pet.js";
import type { PetConfig, PetLocale } from "../types.js";

export async function openPetConfig(
	ctx: ExtensionContext,
	config: PetConfig,
	locale: PetLocale,
	onChange: (id: string, value: string) => Promise<void> | void,
): Promise<void> {
	const items = buildItems(config, locale);

	await ctx.ui.custom<void>((tui, theme, _kb, done) => {
		const container = new Container();
		container.addChild(new Text(theme.fg("accent", theme.bold(t(locale, "pet.config.title"))), 1, 0));
		container.addChild(new Text(theme.fg("dim", t(locale, "pet.config.subtitle")), 1, 0));

		const settingsList = new SettingsList(
			items,
			Math.min(items.length + 2, 14),
			getSettingsListTheme(),
			(id, newValue) => {
				void onChange(id, newValue);
			},
			() => done(undefined),
		);

		container.addChild(settingsList);
		container.addChild(new Text(theme.fg("dim", t(locale, "pet.config.help")), 1, 0));

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
			width: 62,
			maxHeight: 18,
			margin: 1,
		},
	});
}

function buildItems(config: PetConfig, locale: PetLocale): SettingItem[] {
	return [
		{
			id: "widgetEnabled",
			label: t(locale, "pet.config.widgetEnabled"),
			currentValue: config.widgetEnabled ? "on" : "off",
			values: ["on", "off"],
		},
		{
			id: "locale",
			label: t(locale, "pet.config.locale"),
			currentValue: config.locale,
			values: ["zh", "en"],
		},
		{
			id: "animationFps",
			label: t(locale, "pet.config.animationFps"),
			currentValue: String(config.animationEnabled ? config.animationFps : 0),
			values: ["0", "0.5", "1", "2", "3", "4"],
			description: [
				t(locale, "pet.config.animationFps.off"),
				t(locale, "pet.config.animationFps.0_5"),
				t(locale, "pet.config.animationFps.1"),
				t(locale, "pet.config.animationFps.2"),
				t(locale, "pet.config.animationFps.3"),
				t(locale, "pet.config.animationFps.4"),
			].join(" · "),
		},
		{
			id: "widgetPlacement",
			label: t(locale, "pet.config.widgetPlacement"),
			currentValue: config.widgetPlacement === "belowEditor" ? "below" : "above",
			values: ["above", "below"],
			description: `${t(locale, "pet.config.widgetPlacement.above")} / ${t(locale, "pet.config.widgetPlacement.below")}`,
		},
	];
}
