import type { NewsCache, NewsItem, NewsSourceSnapshot } from "../types.js";
import { PET_NEWS_CACHE_PATH, readJsonFile, withPetLock, writeJsonFileAtomic } from "./fs.js";

export const DEFAULT_NEWS_CACHE: NewsCache = {
	version: 1,
	updatedAt: 0,
	items: [],
	sources: {},
};

export function normalizeNewsCache(input: Partial<NewsCache> | undefined | null): NewsCache {
	const rawSources = input?.sources ?? {};
	const sources: Record<string, NewsSourceSnapshot> = {};

	for (const [sourceId, snapshot] of Object.entries(rawSources)) {
		sources[sourceId] = normalizeSourceSnapshot(snapshot);
	}

	return {
		version: 1,
		updatedAt: normalizeTimestamp(input?.updatedAt),
		items: Array.isArray(input?.items) ? input.items.map(normalizeNewsItem).filter(Boolean) as NewsItem[] : [],
		sources,
	};
}

export async function readNewsCacheUnlocked(): Promise<NewsCache> {
	const raw = await readJsonFile<Partial<NewsCache>>(PET_NEWS_CACHE_PATH, DEFAULT_NEWS_CACHE);
	return normalizeNewsCache(raw);
}

export async function writeNewsCacheUnlocked(cache: NewsCache): Promise<void> {
	await writeJsonFileAtomic(PET_NEWS_CACHE_PATH, normalizeNewsCache(cache));
}

export async function loadNewsCache(): Promise<NewsCache> {
	return withPetLock(async () => readNewsCacheUnlocked());
}

export async function saveNewsCache(cache: NewsCache): Promise<void> {
	await withPetLock(async () => writeNewsCacheUnlocked(cache));
}

function normalizeSourceSnapshot(input: Partial<NewsSourceSnapshot> | undefined): NewsSourceSnapshot {
	return {
		fetchedAt: normalizeTimestamp(input?.fetchedAt),
		items: Array.isArray(input?.items) ? input.items.map(normalizeNewsItem).filter(Boolean) as NewsItem[] : [],
		error: typeof input?.error === "string" ? input.error : undefined,
	};
}

function normalizeNewsItem(input: Partial<NewsItem> | undefined): NewsItem | undefined {
	if (!input?.id || !input.title || !input.url || !input.sourceId || !input.sourceLabel) return undefined;
	return {
		id: input.id,
		sourceId: input.sourceId,
		sourceLabel: input.sourceLabel,
		title: input.title,
		url: input.url,
		byline: typeof input.byline === "string" ? input.byline : undefined,
		score: typeof input.score === "number" ? input.score : undefined,
		publishedAt: typeof input.publishedAt === "number" ? input.publishedAt : undefined,
		fetchedAt: normalizeTimestamp(input.fetchedAt),
	};
}

function normalizeTimestamp(value: number | undefined): number {
	if (typeof value !== "number" || Number.isNaN(value)) return 0;
	return Math.max(0, Math.floor(value));
}
