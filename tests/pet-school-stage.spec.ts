import test from "node:test";
import assert from "node:assert/strict";
import { getBreedDefinition, getSpeciesDefinition } from "../src/pet/species.js";
import { renderPetWidgetLines } from "../src/ui/widget.js";
import { buildProgressionState } from "../src/pet/progression.js";
import { createPet, testTheme } from "./helpers.js";

test("baby dog uses puppy-style pre-branch art", () => {
	const species = getSpeciesDefinition("dog");
	const breed = getBreedDefinition("dog", "dog");
	assert.ok(species);
	assert.ok(breed);

	const lines = renderPetWidgetLines({
		pet: createPet({
			species: "dog",
			breed: "dog",
			totalXp: 0,
			progression: buildProgressionState(0, null),
		}),
		species: species!,
		breed: breed!,
		animationState: "idle",
		frameIndex: 0,
		locale: "en",
		theme: testTheme,
	});

	assert.ok(lines.some((line) => line.includes("/^ ^\\") || line.includes("V\\ Y /V")));
});

test("school-phase title is grouped to match the shared visual phase", () => {
	const species = getSpeciesDefinition("dog");
	const breed = getBreedDefinition("dog", "dog");
	assert.ok(species);
	assert.ok(breed);

	const lines = renderPetWidgetLines({
		pet: createPet({
			species: "dog",
			breed: "dog",
			totalXp: 360,
			progression: buildProgressionState(360, null),
		}),
		species: species!,
		breed: breed!,
		animationState: "idle",
		frameIndex: 0,
		locale: "en",
		theme: testTheme,
	});

	assert.ok(lines.some((line) => line.includes("School")));
});

test("university dog looks visually different before branching", () => {
	const species = getSpeciesDefinition("dog");
	const breed = getBreedDefinition("dog", "dog");
	assert.ok(species);
	assert.ok(breed);

	const lines = renderPetWidgetLines({
		pet: createPet({
			species: "dog",
			breed: "dog",
			totalXp: 2500,
			progression: buildProgressionState(2500, null),
		}),
		species: species!,
		breed: breed!,
		animationState: "idle",
		frameIndex: 0,
		locale: "en",
		theme: testTheme,
	});

	assert.ok(lines.some((line) => line.includes("/^##\\") || line.includes("/|_|\\") || line.includes("m m")));
	assert.ok(lines.length <= 5);
});
