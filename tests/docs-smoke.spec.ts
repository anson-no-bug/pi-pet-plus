import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const requiredFiles = ["README.md", "README.zh.md", "CONTRIBUTING.md", "LICENSE"];

test("core publishable docs exist", async () => {
	await Promise.all(requiredFiles.map((file) => access(file)));
});

test("README documents the split modules", async () => {
	const readme = await readFile("README.md", "utf8");
	assert.match(readme, /pet-core/);
	assert.match(readme, /pet-news/);
});
