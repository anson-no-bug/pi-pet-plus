import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

export interface PetNewsContract {
	openMenu: (ctx: ExtensionCommandContext) => Promise<void>;
}

const PET_NEWS_CONTRACT_KEY = Symbol.for("pi-pet-plus.pet-news-contract");

function getContractStore(): { contract?: PetNewsContract } {
	const globalObject = globalThis as typeof globalThis & {
		[PET_NEWS_CONTRACT_KEY]?: { contract?: PetNewsContract };
	};
	if (!globalObject[PET_NEWS_CONTRACT_KEY]) {
		globalObject[PET_NEWS_CONTRACT_KEY] = {};
	}
	return globalObject[PET_NEWS_CONTRACT_KEY]!;
}

export function registerPetNewsContract(contract: PetNewsContract): () => void {
	const store = getContractStore();
	store.contract = contract;
	return () => {
		if (store.contract === contract) {
			delete store.contract;
		}
	};
}

export function getPetNewsContract(): PetNewsContract | undefined {
	return getContractStore().contract;
}
