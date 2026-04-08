export type PetBaseAnimationState = "idle" | "thinking" | "working" | "happy" | "sleep" | "celebrate" | "error";

export type PetAnimationState =
	| PetBaseAnimationState
	| "idle-blink"
	| "long-thinking"
	| "streaming"
	| "tool-start"
	| "tool-running"
	| "tool-success"
	| "tool-error"
	| "confused"
	| "proud"
	| "branch-choice"
	| "promotion"
	| "long-idle"
	| "wake-up"
	| "news-speaking";

export type PetRenderMode = "ascii";
export type WidgetPlacement = "aboveEditor" | "belowEditor";
export type NewsSourceType = "hn" | "rss";
export type PetLocale = "zh" | "en";
export type NewsPresentationMode = "speech" | "speech+footer" | "footer";
export type PetStageId = "baby" | "kindergarten" | "elementary" | "middle-school" | "high-school" | "university" | "branched";
export type PetCareerBranch = "academia" | "engineering";
export type PetSpeechSource = "system" | "activity" | "progression" | "news";

export interface LocalizedText {
	zh: string;
	en: string;
}

export interface PetAnimationSet {
	idle: string[][];
	thinking: string[][];
	working: string[][];
	happy: string[][];
	sleep: string[][];
	celebrate: string[][];
	error: string[][];
}

export interface PetAnchor {
	line: number;
	column: number;
}

export interface PetAnchorMap {
	head: PetAnchor;
	chest: PetAnchor;
	speechOrigin: PetAnchor;
}

export interface PetBreedDefinition {
	id: string;
	name: string;
	names: LocalizedText;
	speciesId: string;
	suggestedNames: string[];
	animations: PetAnimationSet;
}

export interface PetSpeciesDefinition {
	id: string;
	name: string;
	names: LocalizedText;
	breeds: PetBreedDefinition[];
	careerAnimations: PetAnimationSet;
}

export interface PetStats {
	toolCalls: number;
	turns: number;
}

export interface PetProgressionState {
	stage: PetStageId;
	branch: PetCareerBranch | null;
	branchRank: number;
}

export interface PetRecord {
	id: string;
	name: string;
	species: string;
	breed: string;
	level: number;
	xp: number;
	totalXp: number;
	mood: number;
	createdAt: number;
	lastActiveAt: number;
	stats: PetStats;
	progression: PetProgressionState;
}

export interface PetState {
	version: 2;
	pets: PetRecord[];
}

export interface NewsSourceConfig {
	id: string;
	type: NewsSourceType;
	label: string;
	enabled: boolean;
	url?: string;
	limit?: number;
}

export interface NewsItem {
	id: string;
	sourceId: string;
	sourceLabel: string;
	title: string;
	url: string;
	byline?: string;
	score?: number;
	publishedAt?: number;
	fetchedAt: number;
}

export interface NewsSourceSnapshot {
	fetchedAt: number;
	items: NewsItem[];
	error?: string;
}

export interface NewsCache {
	version: 1;
	updatedAt: number;
	items: NewsItem[];
	sources: Record<string, NewsSourceSnapshot>;
}

export interface PetConfig {
	version: 2;
	activePetId: string | null;
	renderMode: PetRenderMode;
	animationEnabled: boolean;
	animationFps: number;
	widgetEnabled: boolean;
	widgetPlacement: WidgetPlacement;
	locale: PetLocale;
	newsEnabled: boolean;
	newsPresentation: NewsPresentationMode;
	newsRotateMs: number;
	newsSources: NewsSourceConfig[];
}

export interface PetDelta {
	xp: number;
	mood: number;
	toolCalls: number;
	turns: number;
	lastActiveAt: number | null;
}

export type PetDeltaMap = Record<string, PetDelta>;

export interface PetStoreSnapshot {
	config: PetConfig;
	state: PetState;
}

export interface PetSpeechPayload {
	text?: string;
	localeKey?: string;
	params?: Record<string, string | number>;
	durationMs?: number;
	priority?: number;
	source?: PetSpeechSource;
	animationState?: PetAnimationState;
	dedupeKey?: string;
}

export interface PetSpeechItem {
	id: string;
	text: string;
	durationMs: number;
	priority: number;
	source: PetSpeechSource;
	expiresAt: number;
	animationState?: PetAnimationState;
	dedupeKey?: string;
}
