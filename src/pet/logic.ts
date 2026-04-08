import { t } from "../i18n/pet.js";
import { buildProgressionState, resolveProgression } from "./progression.js";
import { getStateVocabularyEntry } from "./state-vocabulary.js";
import type { PetAnimationState, PetDelta, PetLocale, PetRecord } from "../types.js";

export interface LevelProgress {
	level: number;
	xp: number;
	leveledUp: boolean;
}

export interface AssistantWorkSnapshot {
	outputTokens?: number;
	outputChars: number;
	successfulTools: number;
	failedTools: number;
}

export const BASE_TURN_XP = 3;
export const SUCCESSFUL_TOOL_XP = 4;
export const MULTI_TOOL_BONUS_CAP = 3;
export const OUTPUT_XP_CAP = 18;

export function xpForLevel(level: number): number {
	return Math.floor(10 + level * 5);
}

export function applyXp(level: number, xp: number, delta: number): LevelProgress {
	let nextLevel = Math.max(1, Math.floor(level));
	let nextXp = Math.max(0, Math.floor(xp + delta));
	let leveledUp = false;

	while (nextXp >= xpForLevel(nextLevel)) {
		nextXp -= xpForLevel(nextLevel);
		nextLevel += 1;
		leveledUp = true;
	}

	return { level: nextLevel, xp: nextXp, leveledUp };
}

export function applyDeltaToPet(pet: PetRecord, delta: PetDelta | undefined): { pet: PetRecord; leveledUp: boolean } {
	if (!delta) return { pet, leveledUp: false };

	const nextTotalXp = Math.max(0, Math.floor(pet.totalXp + delta.xp));
	const before = resolveProgression(pet.totalXp, pet.progression.branch);
	const after = resolveProgression(nextTotalXp, pet.progression.branch);

	return {
		pet: {
			...pet,
			level: after.displayLevel,
			xp: after.segmentProgressXp,
			totalXp: nextTotalXp,
			progression: buildProgressionState(nextTotalXp, pet.progression.branch),
			mood: clamp(pet.mood + delta.mood, 0, 100),
			lastActiveAt: Math.max(pet.lastActiveAt, delta.lastActiveAt ?? 0),
			stats: {
				toolCalls: pet.stats.toolCalls + delta.toolCalls,
				turns: pet.stats.turns + delta.turns,
			},
		},
		leveledUp:
			after.displayLevel > before.displayLevel ||
			(after.branch === before.branch && after.branchRank > before.branchRank) ||
			(before.branch === null && after.branch !== null),
	};
}

export function moodLabel(mood: number, locale: PetLocale): string {
	if (mood >= 85) return t(locale, "pet.mood.veryHappy");
	if (mood >= 70) return t(locale, "pet.mood.happy");
	if (mood >= 55) return t(locale, "pet.mood.calm");
	if (mood >= 35) return t(locale, "pet.mood.focused");
	if (mood >= 20) return t(locale, "pet.mood.sleepy");
	return t(locale, "pet.mood.grumpy");
}

export function animationLabel(state: PetAnimationState, locale: PetLocale): string {
	return t(locale, getStateVocabularyEntry(state).labelKey);
}

export function calculateTurnOutputXp(snapshot: AssistantWorkSnapshot): number {
	if (typeof snapshot.outputTokens === "number" && snapshot.outputTokens > 0) {
		return clamp(Math.round(snapshot.outputTokens / 160), 1, OUTPUT_XP_CAP);
	}
	return clamp(Math.round(snapshot.outputChars / 180), snapshot.outputChars > 0 ? 1 : 0, 12);
}

export function calculateTurnCompletionBonus(snapshot: AssistantWorkSnapshot): number {
	if (snapshot.successfulTools < 2) return 0;
	return clamp(snapshot.successfulTools - 1, 0, MULTI_TOOL_BONUS_CAP);
}

export function calculateTurnXp(snapshot: AssistantWorkSnapshot): number {
	return calculateTurnOutputXp(snapshot) + calculateTurnCompletionBonus(snapshot);
}

export function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
