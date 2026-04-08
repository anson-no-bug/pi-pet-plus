import test from "node:test";
import assert from "node:assert/strict";
import { getPetAnchorMap } from "../src/pet/anchors.js";
import { PET_SPECIES, getSpeciesDefinition } from "../src/pet/species.js";

test("species list includes the expanded cute roster", () => {
	const ids = PET_SPECIES.map((species) => species.id);
	assert.deepEqual(ids, ["cat", "dog", "cow", "horse", "spark", "sprout", "drake"]);
});

test("fantasy species are individually addressable", () => {
	assert.equal(getSpeciesDefinition("spark")?.names.en, "Spark Mouse");
	assert.equal(getSpeciesDefinition("sprout")?.names.en, "Seedling");
	assert.equal(getSpeciesDefinition("drake")?.names.en, "Drakelet");
});

test("fantasy species have dedicated anchor maps", () => {
	assert.notDeepEqual(getPetAnchorMap("spark"), getPetAnchorMap("cat"));
	assert.notDeepEqual(getPetAnchorMap("drake"), getPetAnchorMap("horse"));
});
