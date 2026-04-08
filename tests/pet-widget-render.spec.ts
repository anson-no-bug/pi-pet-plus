import test from "node:test";
import assert from "node:assert/strict";
import { getBreedDefinition, getSpeciesDefinition } from "../src/pet/species.js";
import { renderPetWidgetLines } from "../src/ui/widget.js";
import { createPet, testTheme } from "./helpers.js";

test("widget renders body and speech bubble together", () => {
	const species = getSpeciesDefinition("cat");
	const breed = getBreedDefinition("cat", "cat");
	assert.ok(species);
	assert.ok(breed);

	const lines = renderPetWidgetLines({
		pet: createPet(),
		species: species!,
		breed: breed!,
		animationState: "tool-success",
		frameIndex: 0,
		locale: "en",
		theme: testTheme,
		speech: {
			id: "speech-1",
			text: "All done.",
			durationMs: 1000,
			priority: 3,
			source: "activity",
			expiresAt: Date.now() + 1000,
		},
		maxWidth: 64,
	});

	assert.ok(lines.some((line) => line.includes("Lv.1")));
	assert.ok(lines.every((line) => !line.includes("Cat")));
	assert.ok(lines.every((line) => !line.includes("Kitty")));
	assert.ok(lines.at(-1)?.includes("All done."));
	assert.ok(lines.every((line) => line.length <= 64));
});
