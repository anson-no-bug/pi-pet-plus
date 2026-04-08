import type { Theme } from "@mariozechner/pi-coding-agent";
import { buildProgressionState } from "../src/pet/progression.js";
import type { PetRecord } from "../src/types.js";

export const testTheme = {
	fg: (_color: string, text: string) => text,
	bg: (_color: string, text: string) => text,
	bold: (text: string) => text,
	italic: (text: string) => text,
	underline: (text: string) => text,
	strikethrough: (text: string) => text,
	inverse: (text: string) => text,
	reset: (text: string) => text,
} as unknown as Theme;

export function createPet(overrides: Partial<PetRecord> = {}): PetRecord {
	const totalXp = overrides.totalXp ?? 0;
	return {
		id: overrides.id ?? "pet-1",
		name: overrides.name ?? "Mochi",
		species: overrides.species ?? "cat",
		breed: overrides.breed ?? (overrides.species ?? "cat"),
		level: overrides.level ?? 1,
		xp: overrides.xp ?? 0,
		totalXp,
		mood: overrides.mood ?? 72,
		createdAt: overrides.createdAt ?? 1,
		lastActiveAt: overrides.lastActiveAt ?? 1,
		stats: overrides.stats ?? { toolCalls: 0, turns: 0 },
		progression: overrides.progression ?? buildProgressionState(totalXp, null),
	};
}
