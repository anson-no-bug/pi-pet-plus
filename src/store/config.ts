import { DEFAULT_NEWS_ROTATE_MS, normalizeNewsSources } from "../news/sources.js";
import { DEFAULT_PET_LOCALE, normalizeLocale } from "../i18n/pet.js";
import type { NewsPresentationMode, PetConfig } from "../types.js";
import { PET_CONFIG_PATH, readJsonFile, withPetLock, writeJsonFileAtomic } from "./fs.js";

const ALLOWED_ANIMATION_FPS = [0, 0.5, 1, 2, 3, 4] as const;

export const DEFAULT_CONFIG: PetConfig = {
	version: 2,
	activePetId: null,
	renderMode: "ascii",
	animationEnabled: true,
	animationFps: 0.5,
	widgetEnabled: true,
	widgetPlacement: "aboveEditor",
	locale: DEFAULT_PET_LOCALE,
	newsEnabled: false,
	newsPresentation: "speech",
	newsRotateMs: DEFAULT_NEWS_ROTATE_MS,
	newsSources: normalizeNewsSources(undefined),
};

export function normalizeConfig(input: Partial<PetConfig> | undefined | null): PetConfig {
	const normalizedFps = clampAnimationFps(
		input?.animationEnabled === false && input?.animationFps === undefined ? 0 : input?.animationFps,
	);
	const animationEnabled = input?.animationEnabled === undefined ? normalizedFps > 0 : Boolean(input.animationEnabled) && normalizedFps > 0;

	return {
		version: 2,
		activePetId: typeof input?.activePetId === "string" ? input.activePetId : null,
		renderMode: "ascii",
		animationEnabled,
		animationFps: animationEnabled ? normalizedFps : 0,
		widgetEnabled: input?.widgetEnabled ?? DEFAULT_CONFIG.widgetEnabled,
		widgetPlacement: input?.widgetPlacement === "belowEditor" ? "belowEditor" : "aboveEditor",
		locale: normalizeLocale(input?.locale),
		newsEnabled: input?.newsEnabled ?? DEFAULT_CONFIG.newsEnabled,
		newsPresentation: normalizeNewsPresentation(input?.newsPresentation),
		newsRotateMs: clampNewsRotateMs(input?.newsRotateMs),
		newsSources: normalizeNewsSources(input?.newsSources),
	};
}

export async function readConfigUnlocked(): Promise<PetConfig> {
	const raw = await readJsonFile<Partial<PetConfig>>(PET_CONFIG_PATH, DEFAULT_CONFIG);
	return normalizeConfig(raw);
}

export async function writeConfigUnlocked(config: PetConfig): Promise<void> {
	await writeJsonFileAtomic(PET_CONFIG_PATH, normalizeConfig(config));
}

export async function loadConfig(): Promise<PetConfig> {
	return withPetLock(async () => readConfigUnlocked());
}

export async function saveConfig(config: PetConfig): Promise<void> {
	await withPetLock(async () => writeConfigUnlocked(config));
}

export function clampAnimationFps(value: number | undefined): number {
	if (typeof value !== "number" || Number.isNaN(value)) return DEFAULT_CONFIG.animationFps;
	const safeValue = Math.max(0, value);
	let best: number = ALLOWED_ANIMATION_FPS[0];
	let bestDistance = Number.POSITIVE_INFINITY;
	for (const candidate of ALLOWED_ANIMATION_FPS) {
		const distance = Math.abs(candidate - safeValue);
		if (distance < bestDistance) {
			best = candidate;
			bestDistance = distance;
		}
	}
	return best;
}

export function clampNewsRotateMs(value: number | undefined): number {
	if (typeof value !== "number" || Number.isNaN(value)) return DEFAULT_CONFIG.newsRotateMs;
	return Math.max(100, Math.min(10_000, Math.round(value / 50) * 50));
}

export function normalizeNewsPresentation(value: NewsPresentationMode | string | undefined): NewsPresentationMode {
	if (value === "footer" || value === "speech+footer") return value;
	return "speech";
}
