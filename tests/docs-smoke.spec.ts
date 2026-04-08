import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const requiredFiles = [
	"README.md",
	"CONTRIBUTING.md",
	"LICENSE",
	"docs/architecture/pet-core.md",
	"docs/architecture/pet-news.md",
	"docs/examples/locale-and-progression.md",
];

test("core open-source docs exist", async () => {
	await Promise.all(requiredFiles.map((file) => access(file)));
});

test("README documents the split modules", async () => {
	const readme = await readFile("README.md", "utf8");
	assert.match(readme, /pet-core/);
	assert.match(readme, /pet-news/);
});
