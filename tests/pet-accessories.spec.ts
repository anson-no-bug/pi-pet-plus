import test from "node:test";
import assert from "node:assert/strict";
import { getPetAnchorMap } from "../src/pet/anchors.js";
import { getCareerAccessory } from "../src/pet/careers.js";

test("each core species exposes its own anchor positions", () => {
	const cat = getPetAnchorMap("cat");
	const dog = getPetAnchorMap("dog");
	assert.notDeepEqual(cat, dog);
});

test("career accessories are species-specific", () => {
	const cat = getCareerAccessory("cat", "engineering", 3);
	const dog = getCareerAccessory("dog", "engineering", 3);
	assert.equal(cat.length > 0, true);
	assert.equal(dog.length > 0, true);
	assert.notDeepEqual(cat, dog);
});
