import type { PetDelta, PetDeltaMap, PetRecord, PetState } from "../types.js";
import { applyDeltaToPet, clamp } from "../pet/logic.js";
import { withPetLock } from "./fs.js";
import { readStateUnlocked, writeStateUnlocked } from "./state.js";

export function createEmptyDelta(): PetDelta {
	return {
		xp: 0,
		mood: 0,
		toolCalls: 0,
		turns: 0,
		lastActiveAt: null,
	};
}

export function getOrCreateDelta(map: PetDeltaMap, petId: string): PetDelta {
	if (!map[petId]) map[petId] = createEmptyDelta();
	return map[petId]!;
}

export function hasPendingDeltas(map: PetDeltaMap): boolean {
	return Object.values(map).some(
		(delta) =>
			delta.xp !== 0 ||
			delta.mood !== 0 ||
			delta.toolCalls !== 0 ||
			delta.turns !== 0 ||
			delta.lastActiveAt !== null,
	);
}

export function mergeDeltaMaps(base: PetDeltaMap, incoming: PetDeltaMap): PetDeltaMap {
	const next: PetDeltaMap = { ...base };
	for (const [petId, delta] of Object.entries(incoming)) {
		const current = getOrCreateDelta(next, petId);
		current.xp += delta.xp;
		current.mood += delta.mood;
		current.toolCalls += delta.toolCalls;
		current.turns += delta.turns;
		current.lastActiveAt = Math.max(current.lastActiveAt ?? 0, delta.lastActiveAt ?? 0) || null;
	}
	return next;
}

export function applyDeltaMapToState(state: PetState, deltas: PetDeltaMap): PetState {
	return {
		...state,
		pets: state.pets.map((pet) => applyDeltaToPet(pet, deltas[pet.id]).pet),
	};
}

export function applyEffectivePet(pet: PetRecord, deltas: PetDeltaMap): PetRecord {
	return applyDeltaToPet(pet, deltas[pet.id]).pet;
}

export function clampMoodDelta(currentMood: number, delta: number): number {
	return clamp(currentMood + delta, 0, 100) - currentMood;
}

export async function flushDeltaMap(deltas: PetDeltaMap): Promise<PetState> {
	return withPetLock(async () => {
		const current = await readStateUnlocked();
		const next = applyDeltaMapToState(current, deltas);
		await writeStateUnlocked(next);
		return next;
	});
}
