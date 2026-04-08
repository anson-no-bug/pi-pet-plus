import { randomUUID } from "node:crypto";
import type { PetSpeechItem, PetSpeechPayload, PetSpeechSource } from "../types.js";

const DEFAULT_DURATION_MS = 3_200;

const DEFAULT_PRIORITY_BY_SOURCE: Record<PetSpeechSource, number> = {
	system: 3,
	activity: 2,
	progression: 4,
	news: 1,
};

export class PetSpeechQueue {
	private current?: PetSpeechItem;

	enqueue(payload: PetSpeechPayload): PetSpeechItem | undefined {
		const item = createSpeechItem(payload);
		const active = this.peek();

		if (!active) {
			this.current = item;
			return item;
		}

		if (active.dedupeKey && item.dedupeKey && active.dedupeKey === item.dedupeKey) {
			this.current = item;
			return item;
		}

		if (item.priority >= active.priority || active.source === "news") {
			this.current = item;
			return item;
		}

		return undefined;
	}

	peek(now = Date.now()): PetSpeechItem | undefined {
		if (!this.current) return undefined;
		if (this.current.expiresAt <= now) {
			this.current = undefined;
			return undefined;
		}
		return this.current;
	}

	clear(): void {
		this.current = undefined;
	}
}

export function createSpeechItem(payload: PetSpeechPayload, now = Date.now()): PetSpeechItem {
	const source = payload.source ?? "system";
	const durationMs = Math.max(1_200, Math.floor(payload.durationMs ?? DEFAULT_DURATION_MS));
	return {
		id: randomUUID(),
		text: payload.text ?? "",
		durationMs,
		priority: payload.priority ?? DEFAULT_PRIORITY_BY_SOURCE[source],
		source,
		expiresAt: now + durationMs,
		animationState: payload.animationState,
		dedupeKey: payload.dedupeKey,
	};
}
