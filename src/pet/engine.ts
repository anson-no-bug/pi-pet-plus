import { randomUUID } from "node:crypto";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { registerPetCoreContract } from "../contracts/pet-events.js";
import { getPetNewsContract } from "../contracts/pet-news-events.js";
import { t } from "../i18n/pet.js";
import { BASE_TURN_XP, SUCCESSFUL_TOOL_XP, animationLabel, calculateTurnXp } from "./logic.js";
import { BRANCH_RANK_THRESHOLDS, buildProgressionState, resolveProgression, SCHOOL_STAGES } from "./progression.js";
import {
	DEFAULT_BREED_ID,
	DEFAULT_SPECIES_ID,
	getBreedDefinition,
	getLocalizedSpeciesName,
	getSpeciesDefinition,
	getSuggestedName,
	PET_SPECIES,
} from "./species.js";
import { PetSpeechQueue } from "./speech.js";
import { PREVIEWABLE_PET_STATES } from "./state-vocabulary.js";
import { clampAnimationFps, DEFAULT_CONFIG, normalizeConfig, readConfigUnlocked, writeConfigUnlocked } from "../store/config.js";
import {
	applyEffectivePet,
	clampMoodDelta,
	flushDeltaMap,
	getOrCreateDelta,
	hasPendingDeltas,
	mergeDeltaMaps,
} from "../store/flush.js";
import { withPetLock } from "../store/fs.js";
import { DEFAULT_STATE, normalizeState, readStateUnlocked, writeStateUnlocked } from "../store/state.js";
import type {
	PetAnimationState,
	PetBreedDefinition,
	PetCareerBranch,
	PetConfig,
	PetDeltaMap,
	PetLocale,
	PetRecord,
	PetSpeechPayload,
	PetSpeciesDefinition,
	PetState,
} from "../types.js";
import { openEvolutionOverlay } from "../ui/evolution-overlay.js";
import { openPetConfig } from "../ui/pet-config.js";
import { openPetSelector, type PetSelectorItem } from "../ui/pet-selector.js";
import { renderPetWidgetLines } from "../ui/widget.js";
import { getCareerTitle } from "./careers.js";

const WIDGET_KEY = "pi-pet-widget";
const FLUSH_DEBOUNCE_MS = 45_000;
const SYNC_INTERVAL_MS = 30_000;
const LONG_IDLE_AFTER_MS = 90_000;
const SLEEP_AFTER_MS = 8 * 60_000;
const SUCCESS_MS = 2_400;
const ERROR_MS = 3_600;
const CELEBRATE_MS = 4_200;
const WAKE_UP_MS = 2_200;
const PREVIEW_MS = 6_000;
const DEMO_STEP_MS = 1_600;

export interface DeletePetEvaluation {
	allowed: boolean;
	reason: "missing" | "last-pet" | null;
}

export function evaluateDeletePet(pets: PetRecord[], targetPetId: string): DeletePetEvaluation {
	if (!pets.some((pet) => pet.id === targetPetId)) return { allowed: false, reason: "missing" };
	if (pets.length <= 1) return { allowed: false, reason: "last-pet" };
	return { allowed: true, reason: null };
}

export function findPetByDeleteQuery(pets: PetRecord[], query: string): PetRecord | undefined {
	const normalized = query.trim().toLowerCase();
	if (!normalized) return undefined;

	const exactId = pets.find((pet) => pet.id.toLowerCase() === normalized);
	if (exactId) return exactId;

	const exactName = pets.find((pet) => pet.name.trim().toLowerCase() === normalized);
	if (exactName) return exactName;

	const uniqueIdPrefixMatches = pets.filter((pet) => pet.id.toLowerCase().startsWith(normalized));
	if (uniqueIdPrefixMatches.length === 1) return uniqueIdPrefixMatches[0];

	return undefined;
}

export class PetRuntime {
	private config: PetConfig = DEFAULT_CONFIG;
	private state: PetState = DEFAULT_STATE;
	private deltas: PetDeltaMap = {};
	private activityAnimationState: PetAnimationState = "idle";
	private transientAnimationState: PetAnimationState | null = null;
	private transientStateUntil = 0;
	private frameIndex = 0;
	private lastActivityAt = Date.now();
	private animationTimer?: ReturnType<typeof setInterval>;
	private syncTimer?: ReturnType<typeof setInterval>;
	private flushTimer?: ReturnType<typeof setTimeout>;
	private flushInFlight?: Promise<void>;
	private syncInFlight = false;
	private initialized = false;
	private shuttingDown = false;
	private lastContext?: ExtensionContext;
	private previewSequenceToken = 0;
	private readonly speechQueue = new PetSpeechQueue();
	private branchPromptInFlight = false;
	private disposeContract?: () => void;
	private transientExpiryTimer?: ReturnType<typeof setTimeout>;
	private speechExpiryTimer?: ReturnType<typeof setTimeout>;

	constructor(private readonly pi: ExtensionAPI) {
		this.disposeContract = registerPetCoreContract({
			speak: (payload) => this.receiveExternalSpeech(payload),
			getLocale: () => this.config.locale,
		});
	}

	async initialize(ctx: ExtensionContext): Promise<void> {
		this.shuttingDown = false;
		this.rememberContext(ctx);
		await this.bootstrapStore();
		this.startSyncLoop();
		this.startAnimationLoop();
		this.render();
	}

	setContext(ctx: ExtensionContext): void {
		this.rememberContext(ctx);
	}

	async shutdown(ctx?: ExtensionContext): Promise<void> {
		if (ctx) this.rememberContext(ctx);
		this.shuttingDown = true;
		this.stopAnimationLoop();
		this.stopSyncLoop();
		this.disposeContract?.();
		this.disposeContract = undefined;
		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = undefined;
		}
		if (this.transientExpiryTimer) clearTimeout(this.transientExpiryTimer);
		if (this.speechExpiryTimer) clearTimeout(this.speechExpiryTimer);
		await this.flushPending({ reportErrors: false });
	}

	async flushPending(options: { reportErrors?: boolean } = {}): Promise<void> {
		if (this.flushInFlight) {
			await this.flushInFlight;
			return;
		}
		if (!hasPendingDeltas(this.deltas)) return;

		if (this.flushTimer) {
			clearTimeout(this.flushTimer);
			this.flushTimer = undefined;
		}

		const snapshot = this.deltas;
		this.deltas = {};

		this.flushInFlight = (async () => {
			try {
				this.state = await flushDeltaMap(snapshot);
			} catch (error) {
				this.deltas = mergeDeltaMaps(this.deltas, snapshot);
				if (options.reportErrors !== false) {
					this.notify(t(this.locale(), "pet.notifications.flushError", { error: toErrorMessage(error) }), "error");
				}
				throw error;
			} finally {
				this.flushInFlight = undefined;
				if (!this.shuttingDown) {
					this.render();
					if (hasPendingDeltas(this.deltas)) this.scheduleFlush();
				}
			}
		})();

		await this.flushInFlight;
	}

	async handlePetCommand(rawArgs: string, ctx: ExtensionCommandContext): Promise<void> {
		this.rememberContext(ctx);
		if (!this.initialized) await this.initialize(ctx);

		const trimmed = rawArgs.trim();
		if (!trimmed) {
			await this.showPetMenu(ctx);
			return;
		}

		const [subcommand, ...rest] = trimmed.split(/\s+/);
		const value = rest.join(" ").trim();

		switch (subcommand) {
			case "new":
				await this.handleCreatePet(value, ctx);
				return;
			case "rename":
				await this.handleRenamePet(value, ctx);
				return;
			case "switch":
				await this.handleSwitchPet(value, ctx);
				return;
			case "delete":
				await this.handleDeletePet(value, ctx);
				return;
			case "news":
				await this.handleOpenNewsMenu(ctx);
				return;
			case "branch":
				await this.handleBranchSelection(value, ctx);
				return;
			case "dev":
				await this.handleDevCommand(value, ctx);
				return;
			case "preview":
				await this.handlePreview(value, ctx);
				return;
			case "demo":
				void this.runPreviewDemo();
				this.notify(t(this.locale(), "pet.notifications.demoing"));
				return;
			case "config":
				if (!ctx.hasUI) {
					this.notify(t(this.locale(), "pet.notifications.needUi"), "warning");
					return;
				}
				await openPetConfig(ctx, this.config, this.locale(), async (id, nextValue) => {
					await this.handleConfigChange(id, nextValue);
				});
				return;
			case "toggle":
				await this.updateConfigPatch({ widgetEnabled: !this.config.widgetEnabled });
				this.notify(this.config.widgetEnabled ? t(this.locale(), "pet.notifications.widgetOn") : t(this.locale(), "pet.notifications.widgetOff"));
				return;
			case "status":
				this.showStatus();
				return;
			case "help":
			default:
				this.notify(this.petUsage(), subcommand === "help" ? "info" : "warning");
				return;
		}
	}


	getPetCommandCompletions(prefix: string): Array<{ value: string; label: string }> | null {
		const trimmed = prefix.trimStart();
		if (!trimmed.includes(" ")) {
			return filterCompletions([
				"status",
				"new",
				"rename",
				"switch",
				"delete",
				"news",
				"branch",
				"preview",
				"demo",
				"config",
				"toggle",
				"dev",
			], trimmed);
		}

		if (trimmed.startsWith("switch ") || trimmed.startsWith("delete ")) {
			const isDelete = trimmed.startsWith("delete ");
			const prefixLabel = isDelete ? "delete " : "switch ";
			const tail = trimmed.slice(prefixLabel.length).toLowerCase();
			return filterCompletions(this.state.pets.map((pet) => pet.name), tail, prefixLabel);
		}

		if (trimmed.startsWith("preview ")) {
			const tail = trimmed.slice("preview ".length).toLowerCase();
			return filterCompletions(PREVIEWABLE_PET_STATES, tail, "preview ");
		}

		if (trimmed.startsWith("branch ")) {
			const tail = trimmed.slice("branch ".length).toLowerCase();
			return filterCompletions(["academia", "engineering"], tail, "branch ");
		}

		if (trimmed.startsWith("dev ")) {
			const tail = trimmed.slice("dev ".length);
			if (!tail.includes(" ")) {
				return filterCompletions(["xp", "stage", "branch", "reset"], tail.toLowerCase(), "dev ");
			}
			if (tail.startsWith("stage ")) {
				return filterCompletions(["baby", "kindergarten", "elementary", "middle-school", "high-school", "university"], tail.slice("stage ".length).toLowerCase(), "dev stage ");
			}
			if (tail.startsWith("branch ")) {
				return filterCompletions(["none", "academia", "engineering"], tail.slice("branch ".length).toLowerCase(), "dev branch ");
			}
		}

		return null;
	}

	recordTurn(ctx: ExtensionContext): void {
		this.rememberContext(ctx);
		const { wokeUp } = this.noteActivity();
		const beforeAfter = this.mutateActivePet((delta, before) => {
			delta.turns += 1;
			delta.xp += BASE_TURN_XP;
			delta.lastActiveAt = Date.now();
			delta.mood += clampMoodDelta(before.mood, 1);
		});
		this.setActivityState("thinking");
		if (wokeUp) {
			this.queueSpeechByKey("pet.speech.wakeup", {}, { source: "activity", animationState: "wake-up", priority: 5, durationMs: WAKE_UP_MS });
		}
		this.handleProgressionTransition(beforeAfter.before, beforeAfter.after);
	}

	recordStreaming(ctx: ExtensionContext): void {
		this.rememberContext(ctx);
		this.noteActivity();
		if (this.activityAnimationState === "tool-running") return;
		this.setActivityState("streaming");
	}

	recordToolStart(ctx: ExtensionContext): void {
		this.rememberContext(ctx);
		this.noteActivity();
		this.setActivityState("tool-running");
		this.setTransientState("tool-start", 900);
	}

	recordToolEnd(isError: boolean, ctx: ExtensionContext): void {
		this.rememberContext(ctx);
		const beforeAfter = this.mutateActivePet((delta, before) => {
			delta.toolCalls += 1;
			delta.lastActiveAt = Date.now();
			if (isError) {
				delta.mood += clampMoodDelta(before.mood, -7);
				return;
			}
			delta.xp += SUCCESSFUL_TOOL_XP;
			delta.mood += clampMoodDelta(before.mood, 3);
		});

		this.handleProgressionTransition(beforeAfter.before, beforeAfter.after);

		if (isError) {
			this.queueSpeechByKey("pet.speech.toolError", {}, { source: "activity", animationState: "tool-error", priority: 5, durationMs: ERROR_MS });
			return;
		}

		this.queueSpeechByKey("pet.speech.toolSuccess", {}, { source: "activity", animationState: "tool-success", priority: 3, durationMs: SUCCESS_MS });
	}

	recordTurnEnd(
		message: { usage?: { output?: number }; content?: string | Array<{ type?: string; text?: string }> },
		toolResults: Array<{ isError?: boolean }>,
		ctx: ExtensionContext,
	): void {
		this.rememberContext(ctx);
		this.noteActivity();
		const successfulTools = toolResults.filter((tool) => !tool.isError).length;
		const failedTools = toolResults.length - successfulTools;
		const outputChars = typeof message.content === "string"
			? message.content.length
			: (message.content ?? []).reduce((total, item) => {
					if (item?.type !== "text") return total;
					return total + (item.text?.length ?? 0);
				}, 0);
		const turnXp = calculateTurnXp({
			outputTokens: message.usage?.output,
			outputChars,
			successfulTools,
			failedTools,
		});
		if (turnXp <= 0) return;

		const beforeAfter = this.mutateActivePet((delta, before) => {
			delta.xp += turnXp;
			delta.lastActiveAt = Date.now();
			delta.mood += clampMoodDelta(before.mood, successfulTools > 0 ? 2 : 1);
		});
		this.handleProgressionTransition(beforeAfter.before, beforeAfter.after);
	}

	async recordAgentEnd(ctx: ExtensionContext): Promise<void> {
		this.rememberContext(ctx);
		this.setActivityState("idle");
		this.render();
		await this.maybePromptForBranchChoice(ctx);
	}

	getCurrentAnimationState(): PetAnimationState {
		return this.resolveAnimationState();
	}

	private async bootstrapStore(): Promise<void> {
		const snapshot = await withPetLock(async () => {
			let config = await readConfigUnlocked();
			let state = await readStateUnlocked();
			let changed = false;

			if (state.pets.length === 0) {
				const starter = this.createPetRecord(DEFAULT_SPECIES_ID, DEFAULT_BREED_ID, getSuggestedName(DEFAULT_SPECIES_ID, DEFAULT_BREED_ID));
				state = { ...state, pets: [starter] };
				config = { ...config, activePetId: starter.id };
				changed = true;
			}

			const reconciled = this.reconcileStore(config, state);
			config = reconciled.config;
			state = reconciled.state;
			changed ||= reconciled.changed;

			if (changed) {
				await writeStateUnlocked(state);
				await writeConfigUnlocked(config);
			}

			return { config, state };
		});

		this.config = snapshot.config;
		this.state = snapshot.state;
		this.initialized = true;
		this.lastActivityAt = Date.now();
	}

	private reconcileStore(config: PetConfig, state: PetState): { config: PetConfig; state: PetState; changed: boolean } {
		const nextState = normalizeState(state);
		let nextConfig = normalizeConfig(config);
		let changed = false;

		if (nextState.pets.length === 0 && nextConfig.activePetId !== null) {
			nextConfig = { ...nextConfig, activePetId: null };
			changed = true;
		}

		if (nextState.pets.length > 0 && !nextState.pets.some((pet) => pet.id === nextConfig.activePetId)) {
			nextConfig = { ...nextConfig, activePetId: nextState.pets[0]!.id };
			changed = true;
		}

		return { config: nextConfig, state: nextState, changed };
	}

	private startAnimationLoop(): void {
		this.stopAnimationLoop();
		if (!this.lastContext?.hasUI) return;
		if (!this.config.widgetEnabled) {
			this.lastContext.ui.setWidget(WIDGET_KEY, undefined);
			return;
		}
		if (!this.config.animationEnabled || this.config.animationFps <= 0) {
			this.render();
			return;
		}

		const intervalMs = Math.round(1000 / clampAnimationFps(this.config.animationFps));
		this.animationTimer = setInterval(() => {
			if (this.shuttingDown) return;
			this.frameIndex += 1;
			this.render();
		}, intervalMs);
	}

	private stopAnimationLoop(): void {
		if (!this.animationTimer) return;
		clearInterval(this.animationTimer);
		this.animationTimer = undefined;
	}

	private startSyncLoop(): void {
		this.stopSyncLoop();
		this.syncTimer = setInterval(() => {
			void this.syncFromDisk();
		}, SYNC_INTERVAL_MS);
	}

	private stopSyncLoop(): void {
		if (!this.syncTimer) return;
		clearInterval(this.syncTimer);
		this.syncTimer = undefined;
	}

	private async syncFromDisk(): Promise<void> {
		if (this.shuttingDown || this.syncInFlight) return;
		this.syncInFlight = true;
		try {
			const snapshot = await withPetLock(async () => ({
				config: await readConfigUnlocked(),
				state: await readStateUnlocked(),
			}));
			const reconciled = this.reconcileStore(snapshot.config, snapshot.state);
			const previousConfig = this.config;
			this.config = reconciled.config;
			this.state = reconciled.state;
			if (
				previousConfig.widgetEnabled !== this.config.widgetEnabled ||
				previousConfig.animationEnabled !== this.config.animationEnabled ||
				previousConfig.animationFps !== this.config.animationFps ||
				previousConfig.widgetPlacement !== this.config.widgetPlacement
			) {
				this.startAnimationLoop();
			}
			this.render();
		} finally {
			this.syncInFlight = false;
		}
	}

	private noteActivity(): { wokeUp: boolean } {
		const now = Date.now();
		const wokeUp = now - this.lastActivityAt > SLEEP_AFTER_MS;
		this.lastActivityAt = now;
		return { wokeUp };
	}

	private scheduleFlush(): void {
		if (this.flushTimer) clearTimeout(this.flushTimer);
		this.flushTimer = setTimeout(() => {
			void this.flushPending().catch((error) => {
				this.notify(t(this.locale(), "pet.notifications.flushError", { error: toErrorMessage(error) }), "error");
			});
		}, FLUSH_DEBOUNCE_MS);
	}

	private resolveAnimationState(): PetAnimationState {
		const now = Date.now();
		if (this.transientAnimationState && now >= this.transientStateUntil) {
			this.transientAnimationState = null;
			this.transientStateUntil = 0;
		}
		if (this.transientAnimationState) return this.transientAnimationState;
		if (now - this.lastActivityAt > SLEEP_AFTER_MS) return "sleep";
		if (now - this.lastActivityAt > LONG_IDLE_AFTER_MS && this.activityAnimationState === "idle") return "long-idle";
		return this.activityAnimationState;
	}

	private setActivityState(state: PetAnimationState): void {
		this.activityAnimationState = state;
		this.render();
	}

	private setTransientState(state: PetAnimationState, durationMs: number): void {
		this.transientAnimationState = state;
		this.transientStateUntil = Date.now() + durationMs;
		if (this.transientExpiryTimer) clearTimeout(this.transientExpiryTimer);
		this.transientExpiryTimer = setTimeout(() => this.render(), durationMs + 25);
		this.render();
	}

	private async handlePreview(stateArg: string, ctx: ExtensionCommandContext): Promise<void> {
		let stateName = stateArg.trim().toLowerCase();
		if (!stateName && ctx.hasUI) {
			const selected = await ctx.ui.select(t(this.locale(), "pet.preview.title"), PREVIEWABLE_PET_STATES);
			if (!selected) return;
			stateName = selected;
		}

		const state = this.parseAnimationState(stateName);
		if (!state) {
			this.notify("/pet preview <state>", "warning");
			return;
		}

		this.previewSequenceToken += 1;
		this.noteActivity();
		this.frameIndex = 0;
		this.setTransientState(state, PREVIEW_MS);
		this.notify(t(this.locale(), "pet.notifications.previewing", { state: animationLabel(state, this.locale()) }));
	}

	private async runPreviewDemo(): Promise<void> {
		const token = ++this.previewSequenceToken;
		const states: PetAnimationState[] = ["idle", "thinking", "tool-running", "tool-success", "promotion", "tool-error", "sleep"];
		this.noteActivity();
		this.frameIndex = 0;

		for (const state of states) {
			if (this.previewSequenceToken !== token) return;
			this.setTransientState(state, DEMO_STEP_MS);
			await delay(DEMO_STEP_MS + 120);
		}
	}

	private render(): void {
		if (this.shuttingDown) return;
		const ctx = this.lastContext;
		if (!ctx?.hasUI) return;
		if (!this.config.widgetEnabled) {
			ctx.ui.setWidget(WIDGET_KEY, undefined);
			return;
		}

		const pet = this.getActivePet();
		if (!pet) {
			ctx.ui.setWidget(WIDGET_KEY, undefined);
			return;
		}

		const speech = this.speechQueue.peek();
		const { species, breed } = this.resolveDefinitions(pet);
		const lines = renderPetWidgetLines({
			pet,
			species,
			breed,
			animationState: this.resolveAnimationState(),
			frameIndex: this.frameIndex,
			locale: this.locale(),
			theme: ctx.ui.theme,
			speech,
		});
		ctx.ui.setWidget(WIDGET_KEY, lines, { placement: this.config.widgetPlacement });
	}

	private showStatus(): void {
		const pet = this.getActivePet();
		if (!pet) {
			this.notify(t(this.locale(), "pet.notifications.noPet"), "warning");
			return;
		}

		const progression = resolveProgression(pet.totalXp, pet.progression.branch);
		const title = progression.branch
			? getCareerTitle(this.locale(), progression.branch, progression.branchRank)
			: progression.branchUnlocked
				? t(this.locale(), "pet.progress.branch.pending")
				: t(this.locale(), progression.titleKey);
		this.notify(
			[
				`${pet.name} · Lv.${pet.level}`,
				`${title}`,
				`${t(this.locale(), "pet.status.progress")}: ${progression.segmentProgressXp}/${progression.segmentLengthXp} XP (${pet.totalXp} total)`,
				`${t(this.locale(), "pet.status.mood")}: ${pet.mood}/100 · ${pet.stats.toolCalls} ${t(this.locale(), "pet.status.tools")} · ${pet.stats.turns} ${t(this.locale(), "pet.status.turns")}`,
				`${t(this.locale(), "pet.status.state")}: ${animationLabel(this.resolveAnimationState(), this.locale())}`,
			].join("\n"),
		);
	}

	private async showPetMenu(ctx: ExtensionCommandContext): Promise<void> {
		if (!ctx.hasUI) {
			this.showStatus();
			return;
		}

		const toggleLabel = this.config.widgetEnabled ? t(this.locale(), "pet.menu.toggle.hide") : t(this.locale(), "pet.menu.toggle.show");
		const choice = await ctx.ui.select(t(this.locale(), "pet.menu.title"), [
			t(this.locale(), "pet.menu.status"),
			t(this.locale(), "pet.menu.switch"),
			t(this.locale(), "pet.menu.new"),
			t(this.locale(), "pet.menu.delete"),
			t(this.locale(), "pet.menu.news"),
			t(this.locale(), "pet.menu.branch"),
			t(this.locale(), "pet.menu.config"),
			toggleLabel,
		]);

		switch (choice) {
			case undefined:
				return;
			case t(this.locale(), "pet.menu.status"):
				this.showStatus();
				break;
			case t(this.locale(), "pet.menu.switch"):
				await this.handleSwitchPet("", ctx);
				break;
			case t(this.locale(), "pet.menu.new"):
				await this.handleCreatePet("", ctx);
				break;
			case t(this.locale(), "pet.menu.delete"):
				await this.handleDeletePet("", ctx);
				break;
			case t(this.locale(), "pet.menu.news"):
				await this.handleOpenNewsMenu(ctx);
				break;
			case t(this.locale(), "pet.menu.branch"):
				await this.handleBranchSelection("", ctx);
				break;
			case t(this.locale(), "pet.menu.config"):
				await openPetConfig(ctx, this.config, this.locale(), async (id, nextValue) => {
					await this.handleConfigChange(id, nextValue);
				});
				break;
			case toggleLabel:
				await this.updateConfigPatch({ widgetEnabled: !this.config.widgetEnabled });
				this.notify(this.config.widgetEnabled ? t(this.locale(), "pet.notifications.widgetOn") : t(this.locale(), "pet.notifications.widgetOff"));
				break;
			default:
				break;
		}
	}

	private async handleCreatePet(nameArg: string, ctx: ExtensionCommandContext): Promise<void> {
		let speciesId = DEFAULT_SPECIES_ID;
		let breedId = DEFAULT_BREED_ID;

		if (ctx.hasUI) {
			const speciesChoice = await ctx.ui.select(
				t(this.locale(), "pet.create.species"),
				PET_SPECIES.map((species) => `${getLocalizedSpeciesName(this.locale(), species)} (${species.id})`),
			);
			if (!speciesChoice) return;
			const species = PET_SPECIES.find((item) => speciesChoice.endsWith(`(${item.id})`));
			if (!species) return;
			speciesId = species.id;
			breedId = species.breeds[0]?.id ?? species.id;
		}

		const suggestedName = getSuggestedName(speciesId, breedId, this.state.pets.length);
		let name = nameArg.trim() || suggestedName;
		if (ctx.hasUI && !nameArg.trim()) {
			const result = await ctx.ui.input(t(this.locale(), "pet.create.name"), suggestedName);
			if (result === undefined) return;
			name = result.trim() || suggestedName;
		}

		const pet = this.createPetRecord(speciesId, breedId, name);
		await this.writeStore((currentConfig, currentState) => ({
			config: { ...currentConfig, activePetId: pet.id },
			state: { ...currentState, pets: [...currentState.pets, pet] },
		}));

		const { species } = this.resolveDefinitions(pet);
		this.notify(
			t(this.locale(), "pet.notifications.adopted", {
				name: pet.name,
				species: getLocalizedSpeciesName(this.locale(), species),
				breed: getLocalizedSpeciesName(this.locale(), species),
			}),
		);
	}

	private async handleRenamePet(nameArg: string, ctx: ExtensionCommandContext): Promise<void> {
		const active = this.getBaseActivePet();
		if (!active) {
			this.notify(t(this.locale(), "pet.notifications.noRenameTarget"), "warning");
			return;
		}

		let name = nameArg.trim();
		if (!name && ctx.hasUI) {
			const input = await ctx.ui.input(t(this.locale(), "pet.create.name"), active.name);
			if (input === undefined) return;
			name = input.trim();
		}
		if (!name) {
			this.notify(t(this.locale(), "pet.notifications.renameUsage"), "warning");
			return;
		}

		const sanitized = sanitizeName(name, active.name);
		await this.writeStore((currentConfig, currentState) => ({
			config: currentConfig,
			state: {
				...currentState,
				pets: currentState.pets.map((pet) => (pet.id === active.id ? { ...pet, name: sanitized } : pet)),
			},
		}));
		this.notify(t(this.locale(), "pet.notifications.renamed", { name: sanitized }));
	}

	private async handleSwitchPet(query: string, ctx: ExtensionCommandContext): Promise<void> {
		if (this.state.pets.length === 0) {
			this.notify(t(this.locale(), "pet.notifications.noPetYet"), "warning");
			return;
		}

		if (query) {
			const match = this.findPetByQuery(query);
			if (!match) {
				this.notify(t(this.locale(), "pet.notifications.petMissing", { query }), "warning");
				return;
			}
			await this.setActivePet(match.id);
			this.notify(t(this.locale(), "pet.notifications.switched", { name: match.name }));
			return;
		}

		if (!ctx.hasUI) {
			this.notify(t(this.locale(), "pet.notifications.switchUsage"), "warning");
			return;
		}

		const petId = await openPetSelector(ctx, this.buildSelectorItems(), this.config.activePetId, this.resolveAnimationState(), this.locale());
		if (!petId || petId === this.config.activePetId) return;
		await this.setActivePet(petId);
		const pet = this.state.pets.find((item) => item.id === petId);
		if (pet) this.notify(t(this.locale(), "pet.notifications.switched", { name: pet.name }));
	}

	private async handleDeletePet(query: string, ctx: ExtensionCommandContext): Promise<void> {
		if (this.state.pets.length === 0) {
			this.notify(t(this.locale(), "pet.notifications.noPet"), "warning");
			return;
		}

		let target = query.trim() ? findPetByDeleteQuery(this.state.pets, query) : this.getBaseActivePet();
		if (!target && ctx.hasUI && !query.trim()) {
			const petId = await openPetSelector(ctx, this.buildSelectorItems(), this.config.activePetId, this.resolveAnimationState(), this.locale());
			if (!petId) return;
			target = this.state.pets.find((pet) => pet.id === petId);
		}
		if (!target) {
			if (query.trim()) {
				this.notify(t(this.locale(), "pet.notifications.deleteMissing", { query }), "warning");
			} else {
				this.notify(t(this.locale(), "pet.notifications.deleteUsage"), "warning");
			}
			return;
		}

		const evaluation = evaluateDeletePet(this.state.pets, target.id);
		if (!evaluation.allowed) {
			this.notify(
				evaluation.reason === "last-pet"
					? t(this.locale(), "pet.notifications.deleteBlockedLast")
					: t(this.locale(), "pet.notifications.deleteMissing", { query: target.name }),
				"warning",
			);
			return;
		}

		await this.writeStore((currentConfig, currentState) => {
			const remainingPets = currentState.pets.filter((pet) => pet.id !== target?.id);
			const nextActivePetId = currentConfig.activePetId === target?.id ? remainingPets[0]?.id ?? null : currentConfig.activePetId;
			return {
				config: { ...currentConfig, activePetId: nextActivePetId },
				state: { ...currentState, pets: remainingPets },
			};
		});

		this.notify(t(this.locale(), "pet.notifications.deleted", { name: target.name }));
	}

	private async handleBranchSelection(query: string, ctx: ExtensionCommandContext): Promise<void> {
		const active = this.getBaseActivePet();
		if (!active) {
			this.notify(t(this.locale(), "pet.notifications.noPet"), "warning");
			return;
		}

		const resolved = resolveProgression(active.totalXp, active.progression.branch);
		if (resolved.branch) {
			this.notify(t(this.locale(), "pet.notifications.branchAlreadyChosen", { title: getCareerTitle(this.locale(), resolved.branch, resolved.branchRank) }), "info");
			return;
		}
		if (!resolved.branchUnlocked) {
			this.notify(t(this.locale(), "pet.notifications.branchUnavailable"), "warning");
			return;
		}

		const selectedBranch = this.parseBranch(query) ?? (await openEvolutionOverlay(ctx, this.locale()));
		if (!selectedBranch) return;

		await this.writeStore((currentConfig, currentState) => ({
			config: currentConfig,
			state: {
				...currentState,
				pets: currentState.pets.map((pet) => (pet.id === active.id ? applyBranchChoice(pet, selectedBranch) : pet)),
			},
		}));

		const title = getCareerTitle(this.locale(), selectedBranch, resolveProgression(active.totalXp, selectedBranch).branchRank);
		this.queueSpeechByKey("pet.speech.branchChosen", { title }, { source: "progression", animationState: "promotion", priority: 5, durationMs: CELEBRATE_MS });
		this.notify(t(this.locale(), "pet.notifications.branchChosen", { title }));
	}

	private async handleOpenNewsMenu(ctx: ExtensionCommandContext): Promise<void> {
		const contract = getPetNewsContract();
		if (!contract) {
			this.notify(t(this.locale(), "pet.notifications.newsUnavailable"), "warning");
			return;
		}
		await contract.openMenu(ctx);
	}

	private async handleDevCommand(value: string, _ctx: ExtensionCommandContext): Promise<void> {
		const active = this.getBaseActivePet();
		if (!active) {
			this.notify(t(this.locale(), "pet.notifications.noPet"), "warning");
			return;
		}

		const [action, ...rest] = value.split(/\s+/).filter(Boolean);
		if (!action) {
			this.notify("/pet dev xp <totalXp> | /pet dev stage <stage> | /pet dev branch <name> [rank] | /pet dev reset", "info");
			return;
		}

		switch (action) {
			case "reset":
				await this.setPetDebugProgress(active.id, 0, null);
				this.notify("pet debug reset -> totalXp=0, branch=none");
				return;
			case "xp": {
				const totalXp = Number(rest[0]);
				if (!Number.isFinite(totalXp)) {
					this.notify("Usage: /pet dev xp <totalXp>", "warning");
					return;
				}
				await this.setPetDebugProgress(active.id, Math.max(0, Math.floor(totalXp)), active.progression.branch);
				this.notify(`pet debug -> totalXp=${Math.max(0, Math.floor(totalXp))}`);
				return;
			}
			case "stage": {
				const stageName = rest[0]?.toLowerCase();
				const stage = SCHOOL_STAGES.find((item) => item.id === stageName);
				if (!stage) {
					this.notify("Usage: /pet dev stage <baby|kindergarten|elementary|middle-school|high-school|university>", "warning");
					return;
				}
				await this.setPetDebugProgress(active.id, stage.startXp, null);
				this.notify(`pet debug -> stage=${stage.id}, totalXp=${stage.startXp}`);
				return;
			}
			case "branch": {
				const branchName = rest[0]?.toLowerCase() ?? "none";
				if (branchName === "none") {
					const totalXp = Math.min(active.totalXp, SCHOOL_STAGES[SCHOOL_STAGES.length - 1]!.startXp);
					await this.setPetDebugProgress(active.id, totalXp, null);
					this.notify(`pet debug -> branch=none, totalXp=${totalXp}`);
					return;
				}
				const branch = this.parseBranch(branchName);
				const rank = Math.max(1, Math.min(BRANCH_RANK_THRESHOLDS.length, Number(rest[1] ?? 1) || 1));
				if (!branch) {
					this.notify("Usage: /pet dev branch <none|academia|engineering> [rank]", "warning");
					return;
				}
				const totalXp = BRANCH_RANK_THRESHOLDS[rank - 1]!;
				await this.setPetDebugProgress(active.id, totalXp, branch);
				this.notify(`pet debug -> branch=${branch}, rank=${rank}, totalXp=${totalXp}`);
				return;
			}
			default:
				this.notify("Usage: /pet dev xp <totalXp> | /pet dev stage <stage> | /pet dev branch <name> [rank] | /pet dev reset", "warning");
				return;
		}
	}

	private async maybePromptForBranchChoice(ctx: ExtensionContext): Promise<void> {
		if (this.branchPromptInFlight || !ctx.hasUI) return;
		const active = this.getBaseActivePet();
		if (!active) return;
		const resolved = resolveProgression(active.totalXp, active.progression.branch);
		if (!resolved.branchUnlocked || resolved.branch) return;

		this.branchPromptInFlight = true;
		try {
			this.notify(t(this.locale(), "pet.notifications.branchPrompt"), "info");
			const selected = await openEvolutionOverlay(ctx, this.locale());
			if (!selected) return;
			await this.handleBranchSelection(selected, ctx as ExtensionCommandContext);
		} finally {
			this.branchPromptInFlight = false;
		}
	}

	private async handleConfigChange(id: string, value: string): Promise<void> {
		switch (id) {
			case "widgetEnabled":
				await this.updateConfigPatch({ widgetEnabled: value === "on" });
				return;
			case "locale":
				await this.updateConfigPatch({ locale: value === "en" ? "en" : "zh" });
				return;
			case "animationFps": {
				const numeric = Number(value);
				await this.updateConfigPatch({ animationFps: numeric, animationEnabled: numeric > 0 });
				return;
			}
			case "widgetPlacement":
				await this.updateConfigPatch({ widgetPlacement: value === "below" ? "belowEditor" : "aboveEditor" });
				return;
			default:
				return;
		}
	}

	private async setActivePet(petId: string): Promise<void> {
		await this.writeStore((currentConfig, currentState) => ({
			config: { ...currentConfig, activePetId: petId },
			state: currentState,
		}));
		this.frameIndex = 0;
		this.setTransientState("tool-success", SUCCESS_MS);
	}

	private async updateConfigPatch(patch: Partial<PetConfig>): Promise<void> {
		await this.applyConfigTransform((currentConfig) => {
			const animationFps = patch.animationFps !== undefined ? clampAnimationFps(patch.animationFps) : currentConfig.animationFps;
			const animationEnabled =
				patch.animationEnabled !== undefined
					? patch.animationEnabled && animationFps > 0
					: patch.animationFps !== undefined
						? animationFps > 0
						: currentConfig.animationEnabled;
			return {
				...currentConfig,
				...patch,
				animationFps: animationEnabled ? animationFps : 0,
				animationEnabled,
			};
		});
	}

	private async setPetDebugProgress(petId: string, totalXp: number, branch: PetCareerBranch | null): Promise<void> {
		await this.writeStore((currentConfig, currentState) => ({
			config: currentConfig,
			state: {
				...currentState,
				pets: currentState.pets.map((pet) => {
					if (pet.id !== petId) return pet;
					const progression = buildProgressionState(totalXp, branch);
					const resolved = resolveProgression(totalXp, progression.branch);
					return {
						...pet,
						totalXp,
						level: resolved.displayLevel,
						xp: resolved.segmentProgressXp,
						progression,
					};
				}),
			},
		}));
	}

	private async applyConfigTransform(transform: (config: PetConfig) => PetConfig): Promise<void> {
		await this.writeStore((currentConfig, currentState) => ({
			config: transform(currentConfig),
			state: currentState,
		}));
	}

	private async writeStore(
		transaction: (config: PetConfig, state: PetState) => { config: PetConfig; state: PetState },
	): Promise<void> {
		await this.flushPending();
		const snapshot = await withPetLock(async () => {
			const currentConfig = await readConfigUnlocked();
			const currentState = await readStateUnlocked();
			const next = transaction(currentConfig, currentState);
			const reconciled = this.reconcileStore(next.config, next.state);
			await writeStateUnlocked(reconciled.state);
			await writeConfigUnlocked(reconciled.config);
			return reconciled;
		});

		this.config = snapshot.config;
		this.state = snapshot.state;
		this.startAnimationLoop();
		this.render();
	}

	private createPetRecord(speciesId: string, breedId: string, name: string): PetRecord {
		const now = Date.now();
		const totalXp = 0;
		return {
			id: randomUUID(),
			name: sanitizeName(name, getSuggestedName(speciesId, breedId)),
			species: speciesId,
			breed: breedId,
			level: 1,
			xp: 0,
			totalXp,
			mood: 72,
			createdAt: now,
			lastActiveAt: now,
			stats: {
				toolCalls: 0,
				turns: 0,
			},
			progression: buildProgressionState(totalXp, null),
		};
	}

	private buildSelectorItems(): PetSelectorItem[] {
		return this.state.pets.map((pet) => {
			const effective = applyEffectivePet(pet, this.deltas);
			const { species, breed } = this.resolveDefinitions(effective);
			return { pet: effective, species, breed };
		});
	}

	private getBaseActivePet(): PetRecord | undefined {
		return this.state.pets.find((pet) => pet.id === this.config.activePetId);
	}

	private getActivePet(): PetRecord | undefined {
		const base = this.getBaseActivePet();
		if (!base) return undefined;
		return applyEffectivePet(base, this.deltas);
	}

	private resolveDefinitions(pet: PetRecord): { species: PetSpeciesDefinition; breed: PetBreedDefinition } {
		const species = getSpeciesDefinition(pet.species) ?? getSpeciesDefinition(DEFAULT_SPECIES_ID)!;
		const breed = getBreedDefinition(species.id, pet.breed) ?? species.breeds[0]!;
		return { species, breed };
	}

	private findPetByQuery(query: string): PetRecord | undefined {
		const normalized = query.trim().toLowerCase();
		if (!normalized) return undefined;

		return this.state.pets.find((pet) => pet.id.toLowerCase().startsWith(normalized) || pet.name.toLowerCase().includes(normalized));
	}

	private petUsage(): string {
		return [
			t(this.locale(), "pet.commands.usageHeader"),
			t(this.locale(), "pet.commands.openMenu"),
			t(this.locale(), "pet.commands.status"),
			t(this.locale(), "pet.commands.new"),
			t(this.locale(), "pet.commands.rename"),
			t(this.locale(), "pet.commands.switch"),
			t(this.locale(), "pet.commands.switchByName"),
			t(this.locale(), "pet.commands.delete"),
			t(this.locale(), "pet.commands.news"),
			t(this.locale(), "pet.commands.branch"),
			t(this.locale(), "pet.commands.preview"),
			t(this.locale(), "pet.commands.demo"),
			t(this.locale(), "pet.commands.config"),
			t(this.locale(), "pet.commands.toggle"),
			"/pet dev xp <totalXp>         临时设置总经验 / temp set total XP",
			"/pet dev stage <stage>        临时跳到学段 / temp jump to stage",
			"/pet dev branch <name> [rank] 临时设置职业线 / temp set branch",
			"/pet dev reset                重置测试状态 / reset debug state",
		].join("\n");
	}

	private notify(message: string, type: "info" | "warning" | "error" = "info"): void {
		this.lastContext?.ui.notify(message, type);
	}

	private rememberContext(ctx: ExtensionContext): void {
		this.lastContext = ctx;
	}

	private parseAnimationState(value: string): PetAnimationState | undefined {
		return PREVIEWABLE_PET_STATES.find((state) => state === value);
	}

	private parseBranch(value: string): PetCareerBranch | null {
		switch (value.trim().toLowerCase()) {
			case "academia":
				return "academia";
			case "engineering":
				return "engineering";
			default:
				return null;
		}
	}

	private locale(): PetLocale {
		return this.config.locale;
	}

	private mutateActivePet(
		mutator: (delta: ReturnType<typeof getOrCreateDelta>, before: PetRecord) => void,
	): { before?: PetRecord; after?: PetRecord } {
		const before = this.getActivePet();
		if (!before) return {};
		const delta = getOrCreateDelta(this.deltas, before.id);
		mutator(delta, before);
		this.scheduleFlush();
		const after = this.getActivePet();
		return { before, after };
	}

	private handleProgressionTransition(before?: PetRecord, after?: PetRecord): void {
		if (!before || !after) return;
		const beforeProgress = resolveProgression(before.totalXp, before.progression.branch);
		const afterProgress = resolveProgression(after.totalXp, after.progression.branch);

		if (!beforeProgress.branchUnlocked && afterProgress.branchUnlocked && !afterProgress.branch) {
			this.queueSpeechByKey("pet.speech.graduation", {}, { source: "progression", animationState: "branch-choice", priority: 5, durationMs: CELEBRATE_MS });
			this.notify(t(this.locale(), "pet.notifications.branchPrompt"), "info");
			return;
		}

		if (beforeProgress.branch === afterProgress.branch && afterProgress.branch && afterProgress.branchRank > beforeProgress.branchRank) {
			const title = getCareerTitle(this.locale(), afterProgress.branch, afterProgress.branchRank);
			this.queueSpeechByKey("pet.speech.promotion", { title }, { source: "progression", animationState: "promotion", priority: 5, durationMs: CELEBRATE_MS });
			return;
		}

		if (afterProgress.displayLevel > beforeProgress.displayLevel) {
			this.setTransientState(afterProgress.branch ? "promotion" : "celebrate", SUCCESS_MS);
		}
	}

	private queueSpeechByKey(
		key: string,
		params: Record<string, string | number>,
		options: Omit<PetSpeechPayload, "text" | "localeKey" | "params"> = {},
	): void {
		this.receiveExternalSpeech({ ...options, localeKey: key, params });
	}

	private receiveExternalSpeech(payload: PetSpeechPayload): void {
		const text = payload.text ?? (payload.localeKey ? t(this.locale(), payload.localeKey, payload.params ?? {}) : "");
		if (!text.trim()) return;
		this.speechQueue.enqueue({ ...payload, text });
		if (payload.animationState) {
			this.setTransientState(payload.animationState, payload.durationMs ?? SUCCESS_MS);
		}
		const expiresIn = payload.durationMs ?? 3_200;
		if (this.speechExpiryTimer) clearTimeout(this.speechExpiryTimer);
		this.speechExpiryTimer = setTimeout(() => this.render(), expiresIn + 25);
		this.render();
	}
}

function applyBranchChoice(pet: PetRecord, branch: PetCareerBranch): PetRecord {
	const resolved = resolveProgression(pet.totalXp, branch);
	return {
		...pet,
		level: resolved.displayLevel,
		xp: resolved.segmentProgressXp,
		progression: buildProgressionState(pet.totalXp, branch),
	};
}

function sanitizeName(name: string, fallback: string): string {
	const trimmed = name.trim();
	if (!trimmed) return fallback;
	return trimmed.slice(0, 24);
}

function filterCompletions(values: string[], query: string, prefix = ""): Array<{ value: string; label: string }> | null {
	const normalized = query.toLowerCase();
	const items = values
		.filter((value) => value.toLowerCase().startsWith(normalized))
		.map((value) => ({ value: `${prefix}${value}`, label: value }));
	return items.length > 0 ? items : null;
}

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

async function delay(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}
