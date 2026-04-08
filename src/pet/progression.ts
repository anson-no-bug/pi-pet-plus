import type { PetCareerBranch, PetProgressionState, PetStageId } from "../types.js";

export interface SchoolStageDefinition {
	id: Exclude<PetStageId, "branched">;
	startXp: number;
	titleKey: string;
}

export interface ProgressionResolution {
	totalXp: number;
	stage: PetStageId;
	branch: PetCareerBranch | null;
	branchRank: number;
	branchUnlocked: boolean;
	displayLevel: number;
	titleKey: string;
	segmentStartXp: number;
	nextSegmentXp: number;
	segmentProgressXp: number;
	segmentLengthXp: number;
}

export const SCHOOL_STAGES: SchoolStageDefinition[] = [
	{ id: "baby", startXp: 0, titleKey: "pet.progress.stage.baby" },
	{ id: "kindergarten", startXp: 120, titleKey: "pet.progress.stage.school" },
	{ id: "elementary", startXp: 360, titleKey: "pet.progress.stage.school" },
	{ id: "middle-school", startXp: 840, titleKey: "pet.progress.stage.school" },
	{ id: "high-school", startXp: 1500, titleKey: "pet.progress.stage.high-school" },
	{ id: "university", startXp: 2500, titleKey: "pet.progress.stage.university" },
];

export const BRANCH_UNLOCK_XP = 3600;
export const BRANCH_RANK_THRESHOLDS = [3600, 5200, 7200, 9600] as const;
export const FINAL_BRANCH_SEGMENT_XP = 2600;

export function legacyXpForLevel(level: number): number {
	return Math.floor(10 + level * 5);
}

export function calculateLegacyTotalXp(level: number | undefined, xp: number | undefined): number {
	const safeLevel = Math.max(1, Math.floor(level ?? 1));
	const safeXp = Math.max(0, Math.floor(xp ?? 0));
	let total = safeXp;
	for (let current = 1; current < safeLevel; current += 1) {
		total += legacyXpForLevel(current);
	}
	return total;
}

export function normalizeCareerBranch(value: string | null | undefined): PetCareerBranch | null {
	if (value === "academia" || value === "engineering") return value;
	return null;
}

export function hasReachedBranchUnlock(totalXp: number): boolean {
	return totalXp >= BRANCH_UNLOCK_XP;
}

export function resolveProgression(totalXp: number, branch: PetCareerBranch | null): ProgressionResolution {
	const safeTotalXp = Math.max(0, Math.floor(totalXp));
	const normalizedBranch = hasReachedBranchUnlock(safeTotalXp) ? branch : null;

	if (normalizedBranch) {
		const branchRank = resolveBranchRank(safeTotalXp);
		const segmentStartXp = BRANCH_RANK_THRESHOLDS[Math.max(0, branchRank - 1)] ?? BRANCH_RANK_THRESHOLDS[0];
		const nextSegmentXp = BRANCH_RANK_THRESHOLDS[branchRank] ?? segmentStartXp + FINAL_BRANCH_SEGMENT_XP;
		return {
			totalXp: safeTotalXp,
			stage: "branched",
			branch: normalizedBranch,
			branchRank,
			branchUnlocked: true,
			displayLevel: 6 + branchRank,
			titleKey: `pet.progress.rank.${normalizedBranch}.${branchRank}`,
			segmentStartXp,
			nextSegmentXp,
			segmentProgressXp: Math.max(0, safeTotalXp - segmentStartXp),
			segmentLengthXp: Math.max(1, nextSegmentXp - segmentStartXp),
		};
	}

	const stage = resolveSchoolStage(safeTotalXp);
	const stageIndex = SCHOOL_STAGES.findIndex((entry) => entry.id === stage.id);
	const nextStageXp = SCHOOL_STAGES[stageIndex + 1]?.startXp ?? BRANCH_UNLOCK_XP;
	return {
		totalXp: safeTotalXp,
		stage: stage.id,
		branch: null,
		branchRank: 0,
		branchUnlocked: hasReachedBranchUnlock(safeTotalXp),
		displayLevel: stageIndex + 1,
		titleKey: stage.titleKey,
		segmentStartXp: stage.startXp,
		nextSegmentXp: nextStageXp,
		segmentProgressXp: Math.max(0, safeTotalXp - stage.startXp),
		segmentLengthXp: Math.max(1, nextStageXp - stage.startXp),
	};
}

export function buildProgressionState(totalXp: number, branch: PetCareerBranch | null): PetProgressionState {
	const resolved = resolveProgression(totalXp, branch);
	return {
		stage: resolved.stage,
		branch: resolved.branch,
		branchRank: resolved.branchRank,
	};
}

export function progressionTitleKey(totalXp: number, branch: PetCareerBranch | null): string {
	return resolveProgression(totalXp, branch).titleKey;
}

export function progressionStageKey(stage: PetStageId): string {
	return `pet.progress.stage.${stage}`;
}

function resolveSchoolStage(totalXp: number): SchoolStageDefinition {
	let current = SCHOOL_STAGES[0]!;
	for (const stage of SCHOOL_STAGES) {
		if (totalXp >= stage.startXp) current = stage;
	}
	return current;
}

function resolveBranchRank(totalXp: number): number {
	let rank = 1;
	for (let index = 0; index < BRANCH_RANK_THRESHOLDS.length; index += 1) {
		if (totalXp >= BRANCH_RANK_THRESHOLDS[index]!) {
			rank = index + 1;
		}
	}
	return Math.max(1, Math.min(BRANCH_RANK_THRESHOLDS.length, rank));
}
