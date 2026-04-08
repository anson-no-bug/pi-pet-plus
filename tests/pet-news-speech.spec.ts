import test from "node:test";
import assert from "node:assert/strict";
import { buildHeadlineSpeech } from "../src/news/runtime.js";

test("headline speech includes source label and title", () => {
	const speech = buildHeadlineSpeech(
		{
			id: "1",
			sourceId: "hn",
			sourceLabel: "Hacker News",
			title: "Pi pets graduate into careers",
			url: "https://example.com",
			fetchedAt: Date.now(),
		},
		"en",
	);

	assert.match(speech, /Hacker News/);
	assert.match(speech, /Pi pets graduate into careers/);
});
