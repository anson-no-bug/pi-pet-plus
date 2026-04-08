import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { PetRuntime } from "./pet/engine.js";

export default function petCoreExtension(pi: ExtensionAPI): void {
	const runtime = new PetRuntime(pi);

	pi.registerCommand("pet", {
		description: "Manage your pi pet",
		getArgumentCompletions: (prefix) => runtime.getPetCommandCompletions(prefix),
		handler: async (args, ctx) => {
			await runtime.handlePetCommand(args ?? "", ctx);
		},
	});


	pi.on("session_start", async (_event, ctx) => {
		await runtime.initialize(ctx);
	});

	pi.on("session_before_switch", async () => {
		await runtime.flushPending();
	});

	pi.on("session_before_fork", async () => {
		await runtime.flushPending();
	});

	pi.on("turn_start", async (_event, ctx) => {
		runtime.recordTurn(ctx);
	});

	pi.on("message_update", async (_event, ctx) => {
		runtime.recordStreaming(ctx);
	});

	pi.on("tool_execution_start", async (_event, ctx) => {
		runtime.recordToolStart(ctx);
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		runtime.recordToolEnd(event.isError, ctx);
	});

	pi.on("turn_end", async (event, ctx) => {
		runtime.recordTurnEnd(
			event.message as { usage?: { output?: number }; content?: string | Array<{ type?: string; text?: string }> },
			event.toolResults as Array<{ isError?: boolean }>,
			ctx,
		);
	});

	pi.on("agent_end", async (_event, ctx) => {
		await runtime.recordAgentEnd(ctx);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		await runtime.shutdown(ctx);
	});
}
