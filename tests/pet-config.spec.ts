import test from "node:test";
import assert from "node:assert/strict";
import { clampAnimationFps, normalizeConfig } from "../src/store/config.js";

test("normalizeConfig keeps locale and slower animation cadence", () => {
	const config = normalizeConfig({ locale: "en", animationFps: 0.5, animationEnabled: true });
	assert.equal(config.locale, "en");
	assert.equal(config.animationFps, 0.5);
	assert.equal(config.animationEnabled, true);
});

test("normalizeConfig falls back for invalid locale and cadence", () => {
	const config = normalizeConfig({ locale: "fr" as never, animationFps: Number.NaN });
	assert.equal(config.locale, "zh");
	assert.equal(config.animationFps, 0.5);
});

test("off animation normalizes to a disabled widget cadence", () => {
	const config = normalizeConfig({ animationEnabled: false });
	assert.equal(config.animationEnabled, false);
	assert.equal(config.animationFps, 0);
	assert.equal(clampAnimationFps(0.6), 0.5);
});
