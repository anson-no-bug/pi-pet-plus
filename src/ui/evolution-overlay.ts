import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { t } from "../i18n/pet.js";
import { getCareerBranchChoices } from "../pet/careers.js";
import type { PetCareerBranch, PetLocale } from "../types.js";

export async function openEvolutionOverlay(ctx: ExtensionContext, locale: PetLocale): Promise<PetCareerBranch | null> {
	if (!ctx.hasUI) return null;
	const choices = getCareerBranchChoices(locale);
	const selected = await ctx.ui.select(
		t(locale, "pet.evolution.title"),
		choices.map((choice) => `${choice.label} — ${choice.description}`),
	);
	if (!selected) return null;
	return choices.find((choice) => `${choice.label} — ${choice.description}` === selected)?.branch ?? null;
}
