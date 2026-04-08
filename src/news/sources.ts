import type { NewsSourceConfig } from "../types.js";

export const DEFAULT_NEWS_ROTATE_MS = 100;

export const DEFAULT_NEWS_SOURCES: NewsSourceConfig[] = [
	{
		id: "hn",
		type: "hn",
		label: "Hacker News",
		enabled: true,
		limit: 10,
	},
	{
		id: "lobsters",
		type: "rss",
		label: "Lobsters",
		enabled: false,
		url: "https://lobste.rs/rss",
		limit: 8,
	},
	{
		id: "github-blog",
		type: "rss",
		label: "GitHub Blog",
		enabled: false,
		url: "https://github.blog/feed/",
		limit: 8,
	},
];

export function normalizeNewsSources(input: NewsSourceConfig[] | undefined | null): NewsSourceConfig[] {
	const defaults = new Map(DEFAULT_NEWS_SOURCES.map((source) => [source.id, source]));
	const result: NewsSourceConfig[] = [];

	for (const defaultSource of DEFAULT_NEWS_SOURCES) {
		const override = input?.find((source) => source.id === defaultSource.id);
		result.push(normalizeNewsSource({ ...defaultSource, ...override }) ?? defaultSource);
	}

	for (const source of input ?? []) {
		if (defaults.has(source.id)) continue;
		const normalized = normalizeNewsSource(source);
		if (normalized) result.push(normalized);
	}

	return dedupeSources(result);
}

export function normalizeNewsSource(input: Partial<NewsSourceConfig> | undefined | null): NewsSourceConfig | undefined {
	if (!input?.id || typeof input.id !== "string") return undefined;
	const type = input.type === "rss" ? "rss" : input.type === "hn" ? "hn" : undefined;
	if (!type) return undefined;

	if (type === "rss" && (!input.url || typeof input.url !== "string")) return undefined;

	return {
		id: input.id,
		type,
		label: typeof input.label === "string" && input.label.trim() ? input.label.trim() : input.id,
		enabled: input.enabled ?? false,
		url: type === "rss" ? input.url : undefined,
		limit: clampLimit(input.limit),
	};
}

export function createCustomRssSource(url: string, label?: string): NewsSourceConfig {
	const normalizedUrl = normalizeUrl(url);
	const safeLabel = label?.trim() || inferLabelFromUrl(normalizedUrl);
	const id = slugify(`rss-${safeLabel}-${new URL(normalizedUrl).hostname}`);

	return {
		id,
		type: "rss",
		label: safeLabel,
		enabled: true,
		url: normalizedUrl,
		limit: 8,
	};
}

export function normalizeUrl(url: string): string {
	const trimmed = url.trim();
	if (!trimmed) throw new Error("RSS URL is required");
	const normalized = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
	return new URL(normalized).toString();
}

function clampLimit(value: number | undefined): number {
	if (typeof value !== "number" || Number.isNaN(value)) return 8;
	return Math.max(3, Math.min(20, Math.floor(value)));
}

function inferLabelFromUrl(url: string): string {
	const parsed = new URL(url);
	return parsed.hostname.replace(/^www\./, "");
}

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);
}

function dedupeSources(sources: NewsSourceConfig[]): NewsSourceConfig[] {
	const seen = new Set<string>();
	const result: NewsSourceConfig[] = [];
	for (const source of sources) {
		if (seen.has(source.id)) continue;
		seen.add(source.id);
		result.push(source);
	}
	return result;
}
