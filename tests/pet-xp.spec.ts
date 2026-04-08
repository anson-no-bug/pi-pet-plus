import test from "node:test";
import assert from "node:assert/strict";
import { OUTPUT_XP_CAP, calculateTurnOutputXp, calculateTurnXp } from "../src/pet/logic.js";

test("assistant output still grants XP even without tools", () => {
	assert.ok(calculateTurnXp({ outputChars: 400, successfulTools: 0, failedTools: 0 }) > 0);
});

test("tool-heavy turns get more XP than otherwise identical no-op turns", () => {
	const quiet = calculateTurnXp({ outputChars: 400, successfulTools: 0, failedTools: 0 });
	const busy = calculateTurnXp({ outputChars: 400, successfulTools: 3, failedTools: 0 });
	assert.ok(busy > quiet);
});

test("missing token usage metadata falls back to deterministic output length", () => {
	assert.equal(calculateTurnOutputXp({ outputChars: 180, successfulTools: 0, failedTools: 0 }), 1);
});

test("very large outputs are capped", () => {
	assert.equal(calculateTurnOutputXp({ outputTokens: 10_000, outputChars: 0, successfulTools: 0, failedTools: 0 }), OUTPUT_XP_CAP);
});
