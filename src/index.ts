import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import petCoreExtension from "./pet-core.js";
import petNewsExtension from "./pet-news.js";

export default function petBundle(pi: ExtensionAPI): void {
	petCoreExtension(pi);
	petNewsExtension(pi);
}
