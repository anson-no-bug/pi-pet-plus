import type { PetLocale, PetSpeechPayload } from "../types.js";

export interface PetCoreContract {
	speak: (payload: PetSpeechPayload) => void;
	getLocale?: () => PetLocale;
}

const PET_CORE_CONTRACT_KEY = Symbol.for("pi-pet-plus.pet-core-contract");

function getContractStore(): { contract?: PetCoreContract } {
	const globalObject = globalThis as typeof globalThis & { [PET_CORE_CONTRACT_KEY]?: { contract?: PetCoreContract } };
	if (!globalObject[PET_CORE_CONTRACT_KEY]) {
		globalObject[PET_CORE_CONTRACT_KEY] = {};
	}
	return globalObject[PET_CORE_CONTRACT_KEY]!;
}

export function registerPetCoreContract(contract: PetCoreContract): () => void {
	const store = getContractStore();
	store.contract = contract;
	return () => {
		if (store.contract === contract) {
			delete store.contract;
		}
	};
}

export function getPetCoreContract(): PetCoreContract | undefined {
	return getContractStore().contract;
}

export function emitPetSpeech(payload: PetSpeechPayload): boolean {
	const contract = getPetCoreContract();
	if (!contract) return false;
	contract.speak(payload);
	return true;
}
