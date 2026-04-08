import { buildProgressionState, calculateLegacyTotalXp, normalizeCareerBranch, resolveProgression } from "../pet/progression.js";
import type { PetRecord, PetState } from "../types.js";
import { PET_STATE_PATH, readJsonFile, withPetLock, writeJsonFileAtomic } from "./fs.js";

export const DEFAULT_STATE: PetState = {
	version: 2,
	pets: [],
};

export function normalizePetRecord(input: Partial<PetRecord> | undefined | null): PetRecord {
	const totalXp = normalizePositiveInteger(
		input?.totalXp,
		calculateLegacyTotalXp(input?.level, input?.xp),
	);
	const requestedBranch = normalizeCareerBranch(readLegacyBranch(input));
	const progression = buildProgressionState(totalXp, requestedBranch);
	const resolved = resolveProgression(totalXp, progression.branch);

	const normalizedSpecies = normalizeSpeciesId(input?.species);
	return {
		id: input?.id ?? "",
		name: input?.name?.trim() || "Mochi",
		species: normalizedSpecies,
		breed: normalizeBreedId(normalizedSpecies, input?.breed),
		level: resolved.displayLevel,
		xp: resolved.segmentProgressXp,
		totalXp,
		mood: clampMood(input?.mood),
		createdAt: normalizeTimestamp(input?.createdAt),
		lastActiveAt: normalizeTimestamp(input?.lastActiveAt),
		stats: {
			toolCalls: normalizePositiveInteger(input?.stats?.toolCalls, 0),
			turns: normalizePositiveInteger(input?.stats?.turns, 0),
		},
		progression,
	};
}

export function normalizeState(input: Partial<PetState> | undefined | null): PetState {
	const pets = Array.isArray(input?.pets)
		? input.pets
				.map((pet) => normalizePetRecord(pet))
				.filter((pet) => pet.id.length > 0)
		: [];

	return {
		version: 2,
		pets,
	};
}

export async function readStateUnlocked(): Promise<PetState> {
	const raw = await readJsonFile<Partial<PetState>>(PET_STATE_PATH, DEFAULT_STATE);
	return normalizeState(raw);
}

export async function writeStateUnlocked(state: PetState): Promise<void> {
	await writeJsonFileAtomic(PET_STATE_PATH, normalizeState(state));
}

export async function loadState(): Promise<PetState> {
	return withPetLock(async () => readStateUnlocked());
}

export async function saveState(state: PetState): Promise<void> {
	await withPetLock(async () => writeStateUnlocked(state));
}

function normalizeSpeciesId(species: string | undefined): string {
	if (species === "sheep") return "horse";
	if (species === "cat" || species === "dog" || species === "cow" || species === "horse") return species;
	return "cat";
}

function normalizeBreedId(species: string, _breed: string | undefined): string {
	return species;
}

function readLegacyBranch(input: Partial<PetRecord> | undefined | null): string | null | undefined {
	const candidate = input as Partial<PetRecord> & {
		branch?: string | null;
		progression?: Partial<PetRecord["progression"]>;
	};
	return candidate?.progression?.branch ?? candidate?.branch;
}

function clampMood(value: number | undefined): number {
	if (typeof value !== "number" || Number.isNaN(value)) return 70;
	return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
	if (typeof value !== "number" || Number.isNaN(value)) return fallback;
	return Math.max(0, Math.floor(value));
}

function normalizeTimestamp(value: number | undefined): number {
	if (typeof value !== "number" || Number.isNaN(value)) return Date.now();
	return Math.max(0, Math.floor(value));
}
