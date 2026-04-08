import test from "node:test";
import assert from "node:assert/strict";
import { shouldRenderFooter, shouldSpeakHeadlines } from "../src/news/runtime.js";

test("speech mode delivers headlines through pet speech only", () => {
	assert.equal(shouldSpeakHeadlines({ newsPresentation: "speech" }), true);
	assert.equal(shouldRenderFooter({ newsPresentation: "speech" }), false);
});

test("speech+footer enables both presentation layers", () => {
	assert.equal(shouldSpeakHeadlines({ newsPresentation: "speech+footer" }), true);
	assert.equal(shouldRenderFooter({ newsPresentation: "speech+footer" }), true);
});

test("footer mode disables speech delivery", () => {
	assert.equal(shouldSpeakHeadlines({ newsPresentation: "footer" }), false);
	assert.equal(shouldRenderFooter({ newsPresentation: "footer" }), true);
});
