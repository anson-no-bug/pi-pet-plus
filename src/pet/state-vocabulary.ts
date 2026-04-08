import type { PetAnimationState, PetBaseAnimationState } from "../types.js";

export interface PetStateVocabularyEntry {
	id: PetAnimationState;
	base: PetBaseAnimationState;
	labelKey: string;
}

const ENTRIES: Record<PetAnimationState, PetStateVocabularyEntry> = {
	idle: { id: "idle", base: "idle", labelKey: "pet.animation.idle" },
	"idle-blink": { id: "idle-blink", base: "idle", labelKey: "pet.animation.idle-blink" },
	thinking: { id: "thinking", base: "thinking", labelKey: "pet.animation.thinking" },
	"long-thinking": { id: "long-thinking", base: "thinking", labelKey: "pet.animation.long-thinking" },
	streaming: { id: "streaming", base: "thinking", labelKey: "pet.animation.streaming" },
	"tool-start": { id: "tool-start", base: "working", labelKey: "pet.animation.tool-start" },
	"tool-running": { id: "tool-running", base: "working", labelKey: "pet.animation.tool-running" },
	working: { id: "working", base: "working", labelKey: "pet.animation.working" },
	"tool-success": { id: "tool-success", base: "happy", labelKey: "pet.animation.tool-success" },
	happy: { id: "happy", base: "happy", labelKey: "pet.animation.happy" },
	proud: { id: "proud", base: "happy", labelKey: "pet.animation.proud" },
	"branch-choice": { id: "branch-choice", base: "celebrate", labelKey: "pet.animation.branch-choice" },
	promotion: { id: "promotion", base: "celebrate", labelKey: "pet.animation.promotion" },
	celebrate: { id: "celebrate", base: "celebrate", labelKey: "pet.animation.celebrate" },
	"tool-error": { id: "tool-error", base: "error", labelKey: "pet.animation.tool-error" },
	confused: { id: "confused", base: "error", labelKey: "pet.animation.confused" },
	error: { id: "error", base: "error", labelKey: "pet.animation.error" },
	"long-idle": { id: "long-idle", base: "idle", labelKey: "pet.animation.long-idle" },
	sleep: { id: "sleep", base: "sleep", labelKey: "pet.animation.sleep" },
	"wake-up": { id: "wake-up", base: "happy", labelKey: "pet.animation.wake-up" },
	"news-speaking": { id: "news-speaking", base: "happy", labelKey: "pet.animation.news-speaking" },
};

export const PREVIEWABLE_PET_STATES: PetAnimationState[] = [
	"idle",
	"idle-blink",
	"thinking",
	"long-thinking",
	"streaming",
	"tool-start",
	"tool-running",
	"tool-success",
	"tool-error",
	"branch-choice",
	"promotion",
	"sleep",
	"wake-up",
	"news-speaking",
];

export function getStateVocabularyEntry(state: PetAnimationState): PetStateVocabularyEntry {
	return ENTRIES[state] ?? ENTRIES.idle;
}

export function toBaseAnimationState(state: PetAnimationState): PetBaseAnimationState {
	return getStateVocabularyEntry(state).base;
}

export function isTemporaryCelebrationState(state: PetAnimationState): boolean {
	return state === "tool-success" || state === "tool-error" || state === "promotion" || state === "branch-choice" || state === "wake-up";
}
