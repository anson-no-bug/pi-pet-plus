import type { PetAnchorMap } from "../types.js";

export const PET_ANCHORS: Record<string, PetAnchorMap> = {
	cat: {
		head: { line: 0, column: 1 },
		chest: { line: 2, column: 2 },
		speechOrigin: { line: 0, column: 6 },
	},
	dog: {
		head: { line: 0, column: 1 },
		chest: { line: 2, column: 3 },
		speechOrigin: { line: 0, column: 7 },
	},
	cow: {
		head: { line: 0, column: 1 },
		chest: { line: 2, column: 2 },
		speechOrigin: { line: 0, column: 6 },
	},
	horse: {
		head: { line: 0, column: 1 },
		chest: { line: 2, column: 2 },
		speechOrigin: { line: 0, column: 7 },
	},
	spark: {
		head: { line: 0, column: 1 },
		chest: { line: 2, column: 2 },
		speechOrigin: { line: 0, column: 7 },
	},
	sprout: {
		head: { line: 0, column: 1 },
		chest: { line: 2, column: 2 },
		speechOrigin: { line: 0, column: 6 },
	},
	drake: {
		head: { line: 0, column: 1 },
		chest: { line: 2, column: 1 },
		speechOrigin: { line: 0, column: 8 },
	},
};

export function getPetAnchorMap(speciesId: string): PetAnchorMap {
	return PET_ANCHORS[speciesId] ?? PET_ANCHORS.cat;
}
