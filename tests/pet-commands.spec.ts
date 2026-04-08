import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDeletePet, findPetByDeleteQuery } from "../src/pet/engine.js";
import { createPet } from "./helpers.js";

test("deleting a missing pet is rejected safely", () => {
	const result = evaluateDeletePet([createPet({ id: "a" })], "missing");
	assert.equal(result.allowed, false);
	assert.equal(result.reason, "missing");
});

test("deleting the final remaining pet is blocked", () => {
	const result = evaluateDeletePet([createPet({ id: "solo" })], "solo");
	assert.equal(result.allowed, false);
	assert.equal(result.reason, "last-pet");
});

test("deleting one pet from a larger collection is allowed", () => {
	const result = evaluateDeletePet([createPet({ id: "a" }), createPet({ id: "b" })], "b");
	assert.equal(result.allowed, true);
	assert.equal(result.reason, null);
});

test("delete lookup prefers exact pet name and does not fall back loosely", () => {
	const pets = [createPet({ id: "a", name: "Mochi" }), createPet({ id: "b", name: "Buddy" })];
	assert.equal(findPetByDeleteQuery(pets, "Buddy")?.id, "b");
	assert.equal(findPetByDeleteQuery(pets, "Bud")?.id, undefined);
});
