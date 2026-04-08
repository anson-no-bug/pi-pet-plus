import test from "node:test";
import assert from "node:assert/strict";
import { normalizePetRecord } from "../src/store/state.js";

test("legacy saved pets migrate cleanly into the new schema", () => {
	const migrated = normalizePetRecord({
		id: "legacy",
		name: "Mochi",
		species: "cat",
		breed: "orange-tabby",
		level: 4,
		xp: 12,
		mood: 70,
		createdAt: 1,
		lastActiveAt: 2,
		stats: { toolCalls: 5, turns: 6 },
	});

	assert.ok(migrated.totalXp > 0);
	assert.equal(migrated.progression.branch, null);
	assert.equal(migrated.progression.branchRank, 0);
});

test("invalid stored branch values normalize safely", () => {
	const migrated = normalizePetRecord({
		id: "bad-branch",
		name: "Mochi",
		totalXp: 4000,
		progression: { stage: "branched", branch: "wizard" as never, branchRank: 99 },
	});

	assert.equal(migrated.progression.branch, null);
	assert.equal(migrated.progression.stage, "university");
});
