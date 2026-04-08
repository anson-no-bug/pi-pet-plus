import { mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";

const PET_DIR_NAME = "pet";
const LOCK_TIMEOUT_MS = 8_000;
const LOCK_POLL_MS = 80;
const LOCK_STALE_MS = 20_000;

export const PET_ROOT_DIR = join(getAgentDir(), PET_DIR_NAME);
export const PET_CONFIG_PATH = join(PET_ROOT_DIR, "config.json");
export const PET_STATE_PATH = join(PET_ROOT_DIR, "state.json");
export const PET_NEWS_CACHE_PATH = join(PET_ROOT_DIR, "news-cache.json");
export const PET_LOCK_PATH = join(PET_ROOT_DIR, "state.lock");

export async function ensurePetRootDir(): Promise<void> {
	await mkdir(PET_ROOT_DIR, { recursive: true });
}

export async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
	try {
		const content = await readFile(path, "utf8");
		return JSON.parse(content) as T;
	} catch (error) {
		if (isMissingFileError(error)) return fallback;
		return fallback;
	}
}

export async function writeJsonFileAtomic(path: string, value: unknown): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	const tempPath = `${path}.${process.pid}.${Date.now()}.tmp`;
	const payload = `${JSON.stringify(value, null, 2)}\n`;
	await writeFile(tempPath, payload, "utf8");
	await rename(tempPath, path);
}

export async function withPetLock<T>(fn: () => Promise<T>): Promise<T> {
	await ensurePetRootDir();
	const startedAt = Date.now();

	for (;;) {
		let handle: Awaited<ReturnType<typeof open>> | undefined;
		try {
			handle = await open(PET_LOCK_PATH, "wx");
			await handle.writeFile(`${process.pid} ${Date.now()}\n`, "utf8");
			try {
				return await fn();
			} finally {
				await handle.close().catch(() => undefined);
				await rm(PET_LOCK_PATH, { force: true }).catch(() => undefined);
			}
		} catch (error) {
			if (!isAlreadyExistsError(error)) throw error;
			await clearStaleLockIfNeeded();
			if (Date.now() - startedAt > LOCK_TIMEOUT_MS) {
				throw new Error("Timed out acquiring pi pet store lock");
			}
			await sleep(LOCK_POLL_MS);
		}
	}
}

async function clearStaleLockIfNeeded(): Promise<void> {
	try {
		const info = await stat(PET_LOCK_PATH);
		if (Date.now() - info.mtimeMs > LOCK_STALE_MS) {
			await rm(PET_LOCK_PATH, { force: true });
		}
	} catch {
		// Best effort cleanup.
	}
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
	return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isAlreadyExistsError(error: unknown): error is NodeJS.ErrnoException {
	return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}

async function sleep(ms: number): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, ms));
}
