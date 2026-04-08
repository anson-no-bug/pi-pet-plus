import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { NewsRuntime } from "./news/runtime.js";

export default function petNewsExtension(pi: ExtensionAPI): void {
	const runtime = new NewsRuntime(pi);

	pi.registerCommand("news", {
		description: "Manage pet-news headlines and sources",
		getArgumentCompletions: (prefix) => runtime.getCommandCompletions(prefix),
		handler: async (args, ctx) => {
			await runtime.handleCommand(args ?? "", ctx);
		},
	});

	pi.on("session_start", async (_event, ctx) => {
		await runtime.initialize(ctx);
	});

	pi.on("model_select", async (_event, ctx) => {
		runtime.setContext(ctx);
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		await runtime.shutdown(ctx);
	});
}
