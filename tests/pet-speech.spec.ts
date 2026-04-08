import test from "node:test";
import assert from "node:assert/strict";
import { PetSpeechQueue } from "../src/pet/speech.js";
import { t } from "../src/i18n/pet.js";

test("higher-priority speech replaces lower-priority chatter", () => {
	const queue = new PetSpeechQueue();
	queue.enqueue({ text: "idle", source: "news", priority: 1, durationMs: 3_000 });
	queue.enqueue({ text: "tool error", source: "activity", priority: 5, durationMs: 3_000 });
	assert.equal(queue.peek()?.text, "tool error");
});

test("expired speech clears cleanly", () => {
	const queue = new PetSpeechQueue();
	const item = queue.enqueue({ text: "short", source: "activity", priority: 2, durationMs: 10 });
	assert.ok(item);
	assert.equal(queue.peek(item!.expiresAt + 1), undefined);
});

test("missing translation keys never render blank strings", () => {
	assert.equal(t("en", "this.key.does.not.exist"), "this.key.does.not.exist");
});
