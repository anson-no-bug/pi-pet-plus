import type { Theme } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { t } from "../i18n/pet.js";
import { getPetAnchorMap } from "../pet/anchors.js";
import { getCareerAccessory, getCareerTitle, getMilestoneAccessory, getSchoolStageAccessory } from "../pet/careers.js";
import { animationLabel, moodLabel } from "../pet/logic.js";
import { resolveProgression } from "../pet/progression.js";
import { toBaseAnimationState } from "../pet/state-vocabulary.js";
import { getCareerBranchAnimations, getSchoolStageAnimations } from "../pet/species.js";
import type { PetAnimationSet, PetAnimationState, PetBreedDefinition, PetLocale, PetRecord, PetSpeechItem, PetSpeciesDefinition } from "../types.js";

interface PetRenderInput {
	pet: PetRecord;
	species: PetSpeciesDefinition;
	breed: PetBreedDefinition;
	animationState: PetAnimationState;
	frameIndex: number;
	locale: PetLocale;
	theme: Theme;
	speech?: PetSpeechItem;
	maxWidth?: number;
}

export function renderPetWidgetLines(input: PetRenderInput): string[] {
	const progression = resolveProgression(input.pet.totalXp, input.pet.progression.branch);
	const title = progression.branch
		? getCareerTitle(input.locale, progression.branch, progression.branchRank)
		: progression.branchUnlocked
			? t(input.locale, "pet.progress.branch.pending")
			: t(input.locale, progression.titleKey);
	const art = buildArtLines(input).map((line) => input.theme.fg(getAnimationColor(input.animationState), line));
	const info = [
		input.theme.fg("accent", input.theme.bold(input.pet.name)),
		input.theme.fg("muted", `Lv.${input.pet.level} · ${title}`),
		`${renderProgressBar(progression.segmentProgressXp, progression.segmentLengthXp, 10, input.theme)} ${progression.segmentProgressXp}/${progression.segmentLengthXp} XP`,
		input.theme.fg(
			input.animationState === "error" || input.animationState === "tool-error" ? "error" : "dim",
			`${animationLabel(input.animationState, input.locale)} · ${moodLabel(input.pet.mood, input.locale)} · ${input.pet.stats.toolCalls} tools`,
		),
	];

	const lines = joinColumns(art, info, input.maxWidth);
	if (!input.speech?.text) return lines;
	const bubble = `${input.theme.fg("accent", "╰─ ")}${input.speech.text}`;
	return [...lines, input.maxWidth ? truncateToWidth(bubble, input.maxWidth, "...", true) : bubble];
}

export function renderPetPreviewLines(input: PetRenderInput): string[] {
	const lines = renderPetWidgetLines(input);
	const progression = resolveProgression(input.pet.totalXp, input.pet.progression.branch);
	const footer = [
		input.theme.fg("muted", `${t(input.locale, "pet.selector.mood")} ${input.pet.mood}/100 · ${t(input.locale, "pet.selector.turns")} ${input.pet.stats.turns}`),
		input.theme.fg("dim", `${t(input.locale, "pet.selector.created")} ${new Date(input.pet.createdAt).toLocaleDateString()} · ${progression.totalXp} total XP`),
	];
	const maxWidth = input.maxWidth;

	if (!maxWidth) return [...lines, ...footer];
	return [...lines, ...footer.map((line) => truncateToWidth(line, maxWidth, "...", true))];
}

export function padAnsi(text: string, width: number): string {
	const truncated = truncateToWidth(text, width, "", true);
	const missing = Math.max(0, width - visibleWidth(truncated));
	return truncated + " ".repeat(missing);
}

function joinColumns(art: string[], info: string[], maxWidth?: number): string[] {
	const artWidth = Math.max(0, ...art.map((line) => visibleWidth(line)));
	const lineCount = Math.max(art.length, info.length);
	const lines: string[] = [];

	for (let index = 0; index < lineCount; index += 1) {
		const artLine = padAnsi(art[index] ?? "", artWidth);
		const infoLine = info[index] ?? "";
		const combined = `${artLine}  ${infoLine}`.trimEnd();
		lines.push(maxWidth ? truncateToWidth(combined, maxWidth, "...", true) : combined);
	}

	return lines;
}

function renderProgressBar(current: number, total: number, width: number, theme: Theme): string {
	const safeTotal = Math.max(1, total);
	const filled = Math.max(0, Math.min(width, Math.round((current / safeTotal) * width)));
	return theme.fg("success", "█".repeat(filled)) + theme.fg("dim", "░".repeat(width - filled));
}

function buildArtLines(input: PetRenderInput): string[] {
	const progression = resolveProgression(input.pet.totalXp, input.pet.progression.branch);
	const animations = progression.branch
		? getCareerBranchAnimations(input.species.id, progression.branch, input.species.careerAnimations)
		: getSchoolStageAnimations(input.species.id, input.breed, progression.stage);
	const baseState = toBaseAnimationState(input.animationState);
	const frame = getAnimationFrame(animations, baseState, input.frameIndex);
	const withStageAccessory = applyOverlays(
		frame,
		input.species.id,
		getSchoolStageAccessory(progression.stage, Boolean(progression.branch)),
	);
	const withCareerAccessory = applyOverlays(
		withStageAccessory,
		input.species.id,
		getCareerAccessory(input.species.id, input.pet.progression.branch, input.pet.progression.branchRank),
	);
	return applyOverlays(withCareerAccessory, input.species.id, getMilestoneAccessory(input.species.id, input.animationState));
}

function applyOverlays(lines: string[], speciesId: string, overlays: Array<{ anchor: "head" | "chest"; text: string }>): string[] {
	if (overlays.length === 0) return [...lines];
	const anchors = getPetAnchorMap(speciesId);
	const next = [...lines];
	for (const overlay of overlays) {
		const anchor = anchors[overlay.anchor];
		if (!anchor) continue;
		next[anchor.line] = replaceAt(next[anchor.line] ?? "", anchor.column, overlay.text);
	}
	return next;
}

function replaceAt(line: string, column: number, text: string): string {
	const padded = line.padEnd(column + text.length, " ");
	return `${padded.slice(0, column)}${text}${padded.slice(column + text.length)}`;
}

function getAnimationFrame(animations: PetAnimationSet, state: keyof PetAnimationSet, frameIndex: number): string[] {
	const frames = animations[state] ?? animations.idle;
	if (frames.length === 0) return [];
	return frames[Math.abs(frameIndex) % frames.length] ?? frames[0]!;
}

function getAnimationColor(state: PetAnimationState): "accent" | "success" | "error" | "warning" | "muted" {
	switch (state) {
		case "tool-success":
		case "happy":
		case "proud":
		case "promotion":
		case "celebrate":
		case "wake-up":
			return "success";
		case "tool-error":
		case "confused":
		case "error":
			return "error";
		case "tool-start":
		case "tool-running":
		case "working":
			return "warning";
		case "sleep":
		case "long-idle":
			return "muted";
		default:
			return "accent";
	}
}
