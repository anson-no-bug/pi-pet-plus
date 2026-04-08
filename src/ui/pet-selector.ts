import type { ExtensionContext, Theme } from "@mariozechner/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { t } from "../i18n/pet.js";
import { getLocalizedSpeciesName } from "../pet/species.js";
import { renderPetPreviewLines } from "./widget.js";
import type { PetAnimationState, PetBreedDefinition, PetLocale, PetRecord, PetSpeciesDefinition } from "../types.js";

export interface PetSelectorItem {
	pet: PetRecord;
	species: PetSpeciesDefinition;
	breed: PetBreedDefinition;
}

interface SelectorProps {
	items: PetSelectorItem[];
	activePetId: string | null;
	activeAnimationState: PetAnimationState;
	locale: PetLocale;
	theme: Theme;
	onDone: (petId: string | null) => void;
}

export async function openPetSelector(
	ctx: ExtensionContext,
	items: PetSelectorItem[],
	activePetId: string | null,
	activeAnimationState: PetAnimationState,
	locale: PetLocale,
): Promise<string | null> {
	if (items.length === 0) return null;

	return ctx.ui.custom<string | null>((_tui, theme, _kb, done) => {
		return new PetSelectorComponent({
			items,
			activePetId,
			activeAnimationState,
			locale,
			theme,
			onDone: done,
		});
	}, {
		overlay: true,
		overlayOptions: {
			anchor: "center",
			width: 76,
			maxHeight: 20,
			margin: 1,
		},
	});
}

class PetSelectorComponent {
	private readonly items: PetSelectorItem[];
	private readonly theme: Theme;
	private readonly activePetId: string | null;
	private readonly activeAnimationState: PetAnimationState;
	private readonly locale: PetLocale;
	private readonly onDone: (petId: string | null) => void;
	private selectedIndex: number;

	constructor(props: SelectorProps) {
		this.items = props.items;
		this.theme = props.theme;
		this.activePetId = props.activePetId;
		this.activeAnimationState = props.activeAnimationState;
		this.locale = props.locale;
		this.onDone = props.onDone;
		const activeIndex = this.items.findIndex((item) => item.pet.id === props.activePetId);
		this.selectedIndex = activeIndex >= 0 ? activeIndex : 0;
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c")) {
			this.onDone(null);
			return;
		}

		if (matchesKey(data, "up")) {
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
			return;
		}

		if (matchesKey(data, "down")) {
			this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
			return;
		}

		if (matchesKey(data, "return")) {
			this.onDone(this.items[this.selectedIndex]?.pet.id ?? null);
		}
	}

	render(width: number): string[] {
		const th = this.theme;
		const innerWidth = Math.max(40, width - 2);
		const leftWidth = Math.min(28, Math.max(22, Math.floor(innerWidth * 0.38)));
		const rightWidth = Math.max(16, innerWidth - leftWidth - 1);
		const lines: string[] = [];

		lines.push(th.fg("border", `╭${"─".repeat(innerWidth)}╮`));
		lines.push(
			th.fg("border", "│") +
				padAnsi(
					th.fg("accent", th.bold(t(this.locale, "pet.selector.title"))) + th.fg("dim", `  ${t(this.locale, "pet.selector.count", { count: this.items.length })}`),
					innerWidth,
				) +
				th.fg("border", "│"),
		);
		lines.push(th.fg("border", `├${"─".repeat(innerWidth)}┤`));

		const listLines = this.buildListLines(leftWidth);
		const previewLines = this.buildPreviewLines(rightWidth);
		const contentHeight = Math.max(listLines.length, previewLines.length);

		for (let index = 0; index < contentHeight; index += 1) {
			const left = padAnsi(listLines[index] ?? "", leftWidth);
			const right = padAnsi(previewLines[index] ?? "", rightWidth);
			lines.push(th.fg("border", "│") + left + th.fg("border", "│") + right + th.fg("border", "│"));
		}

		lines.push(th.fg("border", `├${"─".repeat(innerWidth)}┤`));
		lines.push(
			th.fg("border", "│") +
				padAnsi(th.fg("dim", t(this.locale, "pet.selector.help")), innerWidth) +
				th.fg("border", "│"),
		);
		lines.push(th.fg("border", `╰${"─".repeat(innerWidth)}╯`));

		return lines.map((line) => truncateToWidth(line, width, "", true));
	}

	invalidate(): void {}

	private buildListLines(width: number): string[] {
		const th = this.theme;
		const lines = [th.fg("accent", t(this.locale, "pet.selector.collection")), th.fg("dim", `${this.selectedIndex + 1}/${this.items.length}`), ""];

		const maxVisible = 6;
		const start = Math.max(0, Math.min(this.selectedIndex - Math.floor(maxVisible / 2), this.items.length - maxVisible));
		const visibleItems = this.items.slice(start, start + maxVisible);

		for (const [offset, item] of visibleItems.entries()) {
			const absoluteIndex = start + offset;
			const selected = absoluteIndex === this.selectedIndex;
			const active = item.pet.id === this.activePetId;
			const prefix = selected ? th.fg("accent", "❯ ") : "  ";
			const suffix = active ? th.fg("success", " ●") : "";
			const base = `${item.pet.name} · Lv.${item.pet.level}`;
			const text = selected ? th.fg("accent", base) : base;
			lines.push(truncateToWidth(`${prefix}${text}${suffix}`, width, "...", true));
			lines.push(
				truncateToWidth(
					`   ${th.fg("dim", getLocalizedSpeciesName(this.locale, item.species))}`,
					width,
					"...",
					true,
				),
			);
		}

		return lines;
	}

	private buildPreviewLines(width: number): string[] {
		const selected = this.items[this.selectedIndex];
		if (!selected) return [];

		const animationState: PetAnimationState = selected.pet.id === this.activePetId ? this.activeAnimationState : "idle";

		return [
			this.theme.fg("accent", t(this.locale, "pet.selector.preview")),
			this.theme.fg("dim", selected.pet.id === this.activePetId ? t(this.locale, "pet.selector.current") : t(this.locale, "pet.selector.switch")),
			"",
			...renderPetPreviewLines({
				pet: selected.pet,
				species: selected.species,
				breed: selected.breed,
				animationState,
				frameIndex: this.selectedIndex,
				locale: this.locale,
				theme: this.theme,
				maxWidth: width,
			}),
		].map((line) => truncateToWidth(line, width, "...", true));
	}
}

function padAnsi(text: string, width: number): string {
	const trimmed = truncateToWidth(text, width, "", true);
	const padding = Math.max(0, width - visibleWidth(trimmed));
	return trimmed + " ".repeat(padding);
}
