import type { NewsItem, NewsSourceConfig } from "../types.js";

const DEFAULT_USER_AGENT = "pi-pet-plus/0.1 (+https://github.com)";

export async function fetchNewsSource(source: NewsSourceConfig): Promise<NewsItem[]> {
	switch (source.type) {
		case "hn":
			return fetchHackerNews(source);
		case "rss":
			return fetchRss(source);
		default:
			return [];
	}
}

async function fetchHackerNews(source: NewsSourceConfig): Promise<NewsItem[]> {
	const url = "https://hn.algolia.com/api/v1/search?tags=front_page";
	const response = await fetch(url, {
		headers: {
			"user-agent": DEFAULT_USER_AGENT,
			accept: "application/json",
		},
	});

	if (!response.ok) {
		throw new Error(`Hacker News request failed: ${response.status}`);
	}

	const data = (await response.json()) as {
		hits?: Array<{
			objectID?: string;
			title?: string;
			story_title?: string;
			url?: string;
			story_url?: string;
			author?: string;
			points?: number;
			created_at_i?: number;
		}>;
	};

	const fetchedAt = Date.now();
	return (data.hits ?? [])
		.slice(0, source.limit ?? 10)
		.map((hit, index) => {
			const title = hit.title || hit.story_title || `Hacker News #${index + 1}`;
			const itemUrl = hit.url || hit.story_url || `https://news.ycombinator.com/item?id=${hit.objectID ?? ""}`;
			return {
				id: `hn-${hit.objectID ?? index}`,
				sourceId: source.id,
				sourceLabel: source.label,
				title,
				url: itemUrl,
				byline: hit.author,
				score: hit.points,
				publishedAt: hit.created_at_i ? hit.created_at_i * 1000 : undefined,
				fetchedAt,
			} satisfies NewsItem;
		})
		.filter((item) => item.title && item.url);
}

async function fetchRss(source: NewsSourceConfig): Promise<NewsItem[]> {
	const response = await fetch(source.url!, {
		headers: {
			"user-agent": DEFAULT_USER_AGENT,
			accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
		},
	});

	if (!response.ok) {
		throw new Error(`${source.label} RSS request failed: ${response.status}`);
	}

	const xml = await response.text();
	const fetchedAt = Date.now();
	const items = parseRssItems(xml, source, fetchedAt);
	return items.slice(0, source.limit ?? 8);
}

function parseRssItems(xml: string, source: NewsSourceConfig, fetchedAt: number): NewsItem[] {
	const itemBlocks = matchAllBlocks(xml, /<item\b[\s\S]*?<\/item>/gi);
	if (itemBlocks.length > 0) {
		return itemBlocks
			.map((block, index) => parseRssItemBlock(block, source, fetchedAt, index))
			.filter((item): item is NewsItem => item !== undefined);
	}

	const entryBlocks = matchAllBlocks(xml, /<entry\b[\s\S]*?<\/entry>/gi);
	return entryBlocks
		.map((block, index) => parseAtomEntryBlock(block, source, fetchedAt, index))
		.filter((item): item is NewsItem => item !== undefined);
}

function parseRssItemBlock(block: string, source: NewsSourceConfig, fetchedAt: number, index: number): NewsItem | undefined {
	const title = decodeHtmlEntities(stripCdata(extractXmlTag(block, "title") ?? "")).trim();
	const url = decodeHtmlEntities(stripCdata(extractXmlTag(block, "link") ?? "")).trim();
	const guid = decodeHtmlEntities(stripCdata(extractXmlTag(block, "guid") ?? "")).trim();
	const author = decodeHtmlEntities(stripCdata(extractXmlTag(block, "author") ?? extractXmlTag(block, "dc:creator") ?? "")).trim();
	const published = parseTimestamp(extractXmlTag(block, "pubDate") ?? extractXmlTag(block, "published") ?? extractXmlTag(block, "updated"));

	if (!title || !url) return undefined;

	return {
		id: guid || `${source.id}-${index}-${hashString(url)}`,
		sourceId: source.id,
		sourceLabel: source.label,
		title,
		url,
		byline: author || undefined,
		publishedAt: published,
		fetchedAt,
	};
}

function parseAtomEntryBlock(block: string, source: NewsSourceConfig, fetchedAt: number, index: number): NewsItem | undefined {
	const title = decodeHtmlEntities(stripCdata(extractXmlTag(block, "title") ?? "")).trim();
	const url = extractAtomLink(block);
	const id = decodeHtmlEntities(stripCdata(extractXmlTag(block, "id") ?? "")).trim();
	const authorBlock = extractXmlTag(block, "author") ?? "";
	const author = decodeHtmlEntities(stripCdata(extractXmlTag(authorBlock, "name") ?? "")).trim();
	const published = parseTimestamp(extractXmlTag(block, "published") ?? extractXmlTag(block, "updated"));

	if (!title || !url) return undefined;

	return {
		id: id || `${source.id}-${index}-${hashString(url)}`,
		sourceId: source.id,
		sourceLabel: source.label,
		title,
		url,
		byline: author || undefined,
		publishedAt: published,
		fetchedAt,
	};
}

function extractAtomLink(block: string): string {
	const relAlternate = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>(?:<\/link>)?/i);
	if (relAlternate?.[1]) return relAlternate[1];
	const href = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>(?:<\/link>)?/i);
	if (href?.[1]) return href[1];
	return decodeHtmlEntities(stripCdata(extractXmlTag(block, "link") ?? "")).trim();
}

function extractXmlTag(xml: string, tagName: string): string | undefined {
	const escapedTag = escapeRegExp(tagName);
	const match = xml.match(new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i"));
	return match?.[1];
}

function matchAllBlocks(text: string, pattern: RegExp): string[] {
	return Array.from(text.matchAll(pattern), (match) => match[0]).filter((value): value is string => Boolean(value));
}

function stripCdata(value: string): string {
	return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

function parseTimestamp(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const timestamp = Date.parse(decodeHtmlEntities(stripCdata(value)));
	return Number.isNaN(timestamp) ? undefined : timestamp;
}

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/\s+/g, " ")
		.trim();
}

function hashString(value: string): string {
	let hash = 0;
	for (let index = 0; index < value.length; index += 1) {
		hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
	}
	return hash.toString(16);
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
