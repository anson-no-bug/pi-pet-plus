import type { PetAnchorMap, PetAnimationState, PetCareerBranch, PetLocale, PetStageId } from "../types.js";
import { t } from "../i18n/pet.js";

export interface CareerBranchDefinition {
	id: PetCareerBranch;
	labelKey: string;
	description: Record<PetLocale, string>;
	rankKeys: string[];
}

export interface AccessoryOverlay {
	anchor: keyof Pick<PetAnchorMap, "head" | "chest">;
	text: string;
}

const CAREER_BRANCHES: CareerBranchDefinition[] = [
	{
		id: "academia",
		labelKey: "pet.progress.branch.academia",
		description: {
			zh: "从硕士到院士，走书卷和研究路线。",
			en: "From master's student to academian, focused on scholarship and research.",
		},
		rankKeys: [1, 2, 3, 4].map((rank) => `pet.progress.rank.academia.${rank}`),
	},
	{
		id: "engineering",
		labelKey: "pet.progress.branch.engineering",
		description: {
			zh: "从实习到领域专家，强调做事和产出。",
			en: "From intern to domain expert, focused on building and shipping.",
		},
		rankKeys: [1, 2, 3, 4].map((rank) => `pet.progress.rank.engineering.${rank}`),
	},
];

const SPECIES_ACCESSORIES: Record<string, Record<PetCareerBranch, { head: string[]; chest: string[] }>> = {
	cat: {
		academia: { head: ["---", "---", "---", "---"], chest: ["( )", "{ }", "***", "@@@"] },
		engineering: { head: ["===", "===", "===", "==="], chest: ["[_]", "[=]", "[*]", "[@]"] },
	},
	dog: {
		academia: { head: ["~~~", "~~~", "~~~", "~~~"], chest: ["< >", "{ }", "+++", "###"] },
		engineering: { head: ["+++", "+++", "+++", "+++"], chest: ["|_|", "|=|", "|*|", "|@|"] },
	},
	cow: {
		academia: { head: ["___", "___", "___", "___"], chest: ["{ }", "{*}", "***", "@@@"] },
		engineering: { head: ["###", "###", "###", "###"], chest: ["{_}", "{=}", "{*}", "{@}"] },
	},
	horse: {
		academia: { head: ["///", "///", "///", "///"], chest: ["< >", "<*>", "***", "@@@"] },
		engineering: { head: ["///", "///", "///", "///"], chest: ["/_/", "/=/", "/*/", "/@/"] },
	},
};

const MILESTONE_ACCESSORIES: Record<string, Partial<Record<"graduation" | "branch-choice" | "promotion", AccessoryOverlay[]>>> = {
	cat: {
		graduation: [{ anchor: "head", text: "___" }, { anchor: "chest", text: "***" }],
		"branch-choice": [{ anchor: "head", text: "?!?" }],
		promotion: [{ anchor: "chest", text: "***" }],
	},
	dog: {
		graduation: [{ anchor: "head", text: "___" }, { anchor: "chest", text: "***" }],
		"branch-choice": [{ anchor: "head", text: "?!?" }],
		promotion: [{ anchor: "chest", text: "+++" }],
	},
	cow: {
		graduation: [{ anchor: "head", text: "___" }, { anchor: "chest", text: "***" }],
		"branch-choice": [{ anchor: "head", text: "?!?" }],
		promotion: [{ anchor: "chest", text: "***" }],
	},
	horse: {
		graduation: [{ anchor: "head", text: "___" }, { anchor: "chest", text: "***" }],
		"branch-choice": [{ anchor: "head", text: "?!?" }],
		promotion: [{ anchor: "chest", text: "***" }],
	},
};

export function getCareerBranchDefinition(branch: PetCareerBranch): CareerBranchDefinition {
	return CAREER_BRANCHES.find((item) => item.id === branch) ?? CAREER_BRANCHES[0]!;
}

export function getCareerBranchChoices(locale: PetLocale): Array<{ branch: PetCareerBranch; label: string; description: string }> {
	return CAREER_BRANCHES.map((branch) => ({
		branch: branch.id,
		label: t(locale, branch.labelKey),
		description: branch.description[locale],
	}));
}

export function getCareerTitle(locale: PetLocale, branch: PetCareerBranch, rank: number): string {
	const definition = getCareerBranchDefinition(branch);
	const key = definition.rankKeys[Math.max(0, Math.min(definition.rankKeys.length - 1, rank - 1))] ?? definition.rankKeys[0]!;
	return t(locale, key);
}

export function getCareerAccessory(speciesId: string, branch: PetCareerBranch | null, branchRank: number): AccessoryOverlay[] {
	if (!branch || branchRank <= 0) return [];
	const set = SPECIES_ACCESSORIES[speciesId]?.[branch];
	if (!set) return [];
	const index = Math.max(0, Math.min(set.head.length - 1, branchRank - 1));
	return [
		{ anchor: "head", text: set.head[index]! },
		{ anchor: "chest", text: set.chest[index]! },
	];
}

export function getMilestoneAccessory(speciesId: string, state: PetAnimationState): AccessoryOverlay[] {
	if (state === "branch-choice") return MILESTONE_ACCESSORIES[speciesId]?.graduation ?? [];
	if (state === "promotion") return MILESTONE_ACCESSORIES[speciesId]?.promotion ?? [];
	if (state === "celebrate") return MILESTONE_ACCESSORIES[speciesId]?.graduation ?? [];
	return [];
}

export function getSchoolStageAccessory(_stage: PetStageId, _hasBranch: boolean): AccessoryOverlay[] {
	return [];
}
