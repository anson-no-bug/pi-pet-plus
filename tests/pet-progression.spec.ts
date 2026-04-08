import test from "node:test";
import assert from "node:assert/strict";
import { BRANCH_UNLOCK_XP, buildProgressionState, resolveProgression } from "../src/pet/progression.js";

test("reaching graduation unlocks branch choice instead of silently flattening out", () => {
	const before = resolveProgression(BRANCH_UNLOCK_XP - 1, null);
	const after = resolveProgression(BRANCH_UNLOCK_XP, null);
	assert.equal(before.branchUnlocked, false);
	assert.equal(after.branchUnlocked, true);
	assert.equal(after.branch, null);
	assert.equal(after.stage, "university");
});

test("branch choice persists into branched progression state", () => {
	const progression = buildProgressionState(BRANCH_UNLOCK_XP, "engineering");
	assert.equal(progression.branch, "engineering");
	assert.equal(progression.stage, "branched");
	assert.equal(progression.branchRank, 1);
});
