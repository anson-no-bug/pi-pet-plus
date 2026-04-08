import type {
	LocalizedText,
	PetAnimationSet,
	PetBreedDefinition,
	PetCareerBranch,
	PetLocale,
	PetSpeciesDefinition,
	PetStageId,
} from "../types.js";

interface FaceTokens {
	eyes: string;
	top: string;
}

interface VariantTemplates {
	a: string[];
	b?: string[];
}

function createBreed(
	speciesId: string,
	id: string,
	names: LocalizedText,
	suggestedNames: string[],
	animations: PetAnimationSet,
): PetBreedDefinition {
	return { id, name: names.zh, names, speciesId, suggestedNames, animations };
}

function createSpecies(
	id: string,
	names: LocalizedText,
	breeds: PetBreedDefinition[],
	careerAnimations: PetAnimationSet,
): PetSpeciesDefinition {
	return { id, name: names.zh, names, breeds, careerAnimations };
}

const TOKENS = {
	idleA: { eyes: "o.o", top: "" },
	idleB: { eyes: "-.-", top: "" },
	thinkingA: { eyes: "o.O", top: "" },
	thinkingB: { eyes: "O.o", top: "" },
	workingA: { eyes: ">.<", top: "" },
	workingB: { eyes: ">o<", top: "" },
	happyA: { eyes: "^.^", top: "" },
	happyB: { eyes: "^o^", top: "" },
	sleepA: { eyes: "-.-", top: " zZ" },
	sleepB: { eyes: "-.-", top: " zz" },
	celebrateA: { eyes: "^o^", top: "" },
	celebrateB: { eyes: "^.^", top: "" },
	errorA: { eyes: "x.x", top: "" },
	errorB: { eyes: ";.;", top: "" },
} satisfies Record<string, FaceTokens>;

function fillTemplate(lines: string[], tokens: FaceTokens): string[] {
	return lines.map((line) => line.replaceAll("{eyes}", tokens.eyes).replaceAll("{top}", tokens.top));
}

function buildSet(templates: VariantTemplates): PetAnimationSet {
	const second = templates.b ?? templates.a;
	return {
		idle: [fillTemplate(templates.a, TOKENS.idleA), fillTemplate(second, TOKENS.idleB)],
		thinking: [fillTemplate(templates.a, TOKENS.thinkingA), fillTemplate(second, TOKENS.thinkingB)],
		working: [fillTemplate(templates.a, TOKENS.workingA), fillTemplate(second, TOKENS.workingB)],
		happy: [fillTemplate(templates.a, TOKENS.happyA), fillTemplate(second, TOKENS.happyB)],
		sleep: [fillTemplate(templates.a, TOKENS.sleepA), fillTemplate(second, TOKENS.sleepB)],
		celebrate: [fillTemplate(templates.a, TOKENS.celebrateA), fillTemplate(second, TOKENS.celebrateB)],
		error: [fillTemplate(templates.a, TOKENS.errorA), fillTemplate(second, TOKENS.errorB)],
	};
}

const CAT_VARIANTS = {
	baby: buildSet({
		a: [" /\\_/\\{top}", "( {eyes} )", " / ^ \\"],
		b: [" /\\_/\\{top}", "( {eyes} )", " / v \\"],
	}),
	school: buildSet({
		a: [" /\\_/\\{top}", "( {eyes} )", " /|_|\\", "  / \\"],
		b: [" /\\_/\\{top}", "( {eyes} )", " /|_|\\", "  /_\\"],
	}),
	highSchool: buildSet({
		a: [" /\\#_/\\{top}", "( {eyes} )", " /|_|\\", "_/   \\"],
		b: [" /\\#_/\\{top}", "( {eyes} )", " /|_|\\", "_/___\\"],
	}),
	university: buildSet({
		a: [" /^^^\\{top}", "( {eyes} )", " /|_|\\", "_/___\\"],
		b: [" /^^^\\{top}", "( {eyes} )", " /|_|\\", "_/===\\"],
	}),
	academia: buildSet({
		a: [" /---\\{top}", "( {eyes} )", " /|o|\\", "_/___\\"],
		b: [" /---\\{top}", "( {eyes} )", " /|o|\\", "_/o_o\\"],
	}),
	engineering: buildSet({
		a: [" /===\\{top}", "( {eyes} )", " /|#|\\", "_/___\\"],
		b: [" /===\\{top}", "( {eyes} )", " /|#|\\", "_/###\\"],
	}),
};

const DOG_VARIANTS = {
	baby: buildSet({
		a: [" /^ ^\\{top}", "/ {eyes} \\", "V\\ Y /V", " / - \\"],
		b: [" /^ ^\\{top}", "/ {eyes} \\", "V\\ Y /V", " / ~ \\"],
	}),
	school: buildSet({
		a: [" /^ ^\\{top}", "/ {eyes} \\", "V\\ Y /V", " /|_|\\"],
		b: [" /^ ^\\{top}", "/ {eyes} \\", "V\\ Y /V", " /|=|\\"],
	}),
	highSchool: buildSet({
		a: [" /^#^\\{top}", "/ {eyes} \\", "V\\ Y /V", " /|=|\\"],
		b: [" /^#^\\{top}", "/ {eyes} \\", "V\\ Y /V", " /|#|\\"],
	}),
	university: buildSet({
		a: [" /^##\\{top}", "/ {eyes} \\", "V\\ Y /V", " /|_|\\", "  m m"],
		b: [" /^##\\{top}", "/ {eyes} \\", "V\\ Y /V", " /|=|\\", "  m m"],
	}),
	academia: buildSet({
		a: [" /^AA\\{top}", "/ {eyes} \\", "V\\ Y /V", " /|o|\\", "  m m"],
		b: [" /^AA\\{top}", "/ {eyes} \\", "V\\ Y /V", " /|o|\\", "  w w"],
	}),
	engineering: buildSet({
		a: [" /^EE\\{top}", "/ {eyes} \\", "V\\ Y /V", " /|#|\\", "  m m"],
		b: [" /^EE\\{top}", "/ {eyes} \\", "V\\ Y /V", " /|#|\\", "  w w"],
	}),
};

const COW_VARIANTS = {
	baby: buildSet({
		a: ["  (__){top}", "  ({eyes})", " /|  |\\"],
		b: ["  (__){top}", "  ({eyes})", " /|__|\\"],
	}),
	school: buildSet({
		a: ["  ^__^{top}", "  ({eyes})", " /|__|\\", "  vv v"],
		b: ["  ^__^{top}", "  ({eyes})", " /|==|\\", "  vv v"],
	}),
	highSchool: buildSet({
		a: ["  ^##^{top}", "  ({eyes})", " /|==|\\", " _vv_v_"],
		b: ["  ^##^{top}", "  ({eyes})", " /|##|\\", " _vv_v_"],
	}),
	university: buildSet({
		a: ["  ^^^^{top}", "  ({eyes})", " /|__|\\", " _|__|_"],
		b: ["  ^^^^{top}", "  ({eyes})", " /|==|\\", " _|__|_"],
	}),
	academia: buildSet({
		a: ["  ^AA^{top}", "  ({eyes})", " /|oo|\\", " _|__|_"],
		b: ["  ^AA^{top}", "  ({eyes})", " /|oo|\\", " _|oo|_"],
	}),
	engineering: buildSet({
		a: ["  ^EE^{top}", "  ({eyes})", " /|##|\\", " _|__|_"],
		b: ["  ^EE^{top}", "  ({eyes})", " /|##|\\", " _|##|_"],
	}),
};

const HORSE_VARIANTS = {
	baby: buildSet({
		a: ["  //\\{top}", " (( {eyes} ))", "  \\\\__//", "   /  \\"],
		b: ["  //\\{top}", " (( {eyes} ))", "  \\\\__//", "   /==\\"],
	}),
	school: buildSet({
		a: ["  //\\{top}", " (( {eyes} ))", "  \\\\__//", "  /|__|\\"],
		b: ["  //\\{top}", " (( {eyes} ))", "  \\\\__//", "  /|==|\\"],
	}),
	highSchool: buildSet({
		a: ["  /##\\{top}", " (( {eyes} ))", "  \\\\__//", "  /|==|\\"],
		b: ["  /##\\{top}", " (( {eyes} ))", "  \\\\__//", "  /|##|\\"],
	}),
	university: buildSet({
		a: ["  /^^\\{top}", " (( {eyes} ))", "  \\\\__//", "  /|__|\\", "   /  \\"],
		b: ["  /^^\\{top}", " (( {eyes} ))", "  \\\\__//", "  /|==|\\", "   /  \\"],
	}),
	academia: buildSet({
		a: ["  /AA\\{top}", " (( {eyes} ))", "  \\\\__//", "  /|oo|\\", "   /  \\"],
		b: ["  /AA\\{top}", " (( {eyes} ))", "  \\\\__//", "  /|oo|\\", "   /==\\"],
	}),
	engineering: buildSet({
		a: ["  /EE\\{top}", " (( {eyes} ))", "  \\\\__//", "  /|##|\\", "   /  \\"],
		b: ["  /EE\\{top}", " (( {eyes} ))", "  \\\\__//", "  /|##|\\", "   /==\\"],
	}),
};

const SPARK_VARIANTS = {
	baby: buildSet({
		a: [" /V V\\{top}", "( {eyes} )", " \\\\ v //", "  /_\\"],
		b: [" /V V\\{top}", "( {eyes} )", " \\\\ v //", "  /#\\"],
	}),
	school: buildSet({
		a: [" /V V\\{top}", "( {eyes} )", " \\\\ v //", " /|_|\\"],
		b: [" /V V\\{top}", "( {eyes} )", " \\\\ v //", " /|=|\\"],
	}),
	highSchool: buildSet({
		a: [" /V#V\\{top}", "( {eyes} )", " \\\\ v //", " /|=|\\"],
		b: [" /V#V\\{top}", "( {eyes} )", " \\\\ v //", " /|#|\\"],
	}),
	university: buildSet({
		a: [" /^^^\\{top}", "( {eyes} )", " \\\\ v //", " /|_|\\", "  / \\"],
		b: [" /^^^\\{top}", "( {eyes} )", " \\\\ v //", " /|=|\\", "  / \\"],
	}),
	academia: buildSet({
		a: [" /AAA\\{top}", "( {eyes} )", " \\\\ v //", " /|o|\\", "  / \\"],
		b: [" /AAA\\{top}", "( {eyes} )", " \\\\ v //", " /|o|\\", "  /_\\"],
	}),
	engineering: buildSet({
		a: [" /EEE\\{top}", "( {eyes} )", " \\\\ v //", " /|#|\\", "  / \\"],
		b: [" /EEE\\{top}", "( {eyes} )", " \\\\ v //", " /|#|\\", "  /#\\"],
	}),
};

const SPROUT_VARIANTS = {
	baby: buildSet({
		a: ["  \\|/{top}", " ( {eyes} )", " /|_|\\", "  |*|"],
		b: ["  \\|/{top}", " ( {eyes} )", " /|_|\\", "  |^|"],
	}),
	school: buildSet({
		a: ["  \\|/{top}", " ( {eyes} )", " /|_|\\", " /_|_\\"],
		b: ["  \\|/{top}", " ( {eyes} )", " /|_|\\", " /_=_\\"],
	}),
	highSchool: buildSet({
		a: ["  \\#/{top}", " ( {eyes} )", " /|_|\\", " /_=_\\"],
		b: ["  \\#/{top}", " ( {eyes} )", " /|_|\\", " /_#_\\"],
	}),
	university: buildSet({
		a: ["  \\^/{top}", " ( {eyes} )", " /|_|\\", " /_|_\\", "  |*|"],
		b: ["  \\^/{top}", " ( {eyes} )", " /|_|\\", " /_|_\\", "  |o|"],
	}),
	academia: buildSet({
		a: ["  \\A/{top}", " ( {eyes} )", " /|o|\\", " /_|_\\", "  |*|"],
		b: ["  \\A/{top}", " ( {eyes} )", " /|o|\\", " /_|_\\", "  |o|"],
	}),
	engineering: buildSet({
		a: ["  \\E/{top}", " ( {eyes} )", " /|#|\\", " /_|_\\", "  |*|"],
		b: ["  \\E/{top}", " ( {eyes} )", " /|#|\\", " /_|_\\", "  |#|"],
	}),
};

const DRAKE_VARIANTS = {
	baby: buildSet({
		a: ["  /^^\\{top}", " ( {eyes} )", " /|><|\\", "  / \\"],
		b: ["  /^^\\{top}", " ( {eyes} )", " /|><|\\", "  /#\\"],
	}),
	school: buildSet({
		a: ["  /^^\\{top}", " ( {eyes} )", " /|><|\\", " /_|_\\"],
		b: ["  /^^\\{top}", " ( {eyes} )", " /|><|\\", " /_=_\\"],
	}),
	highSchool: buildSet({
		a: ["  /##\\{top}", " ( {eyes} )", " /|><|\\", " /_=_\\"],
		b: ["  /##\\{top}", " ( {eyes} )", " /|><|\\", " /_#_\\"],
	}),
	university: buildSet({
		a: [" /^^^^\\{top}", "( {eyes} )", " /|><|\\", " /_|_\\", "  / \\"],
		b: [" /^^^^\\{top}", "( {eyes} )", " /|><|\\", " /_|_\\", "  /#\\"],
	}),
	academia: buildSet({
		a: [" /AAAA\\{top}", "( {eyes} )", " /|><|\\", " /|o|\\", "  / \\"],
		b: [" /AAAA\\{top}", "( {eyes} )", " /|><|\\", " /|o|\\", "  /_\\"],
	}),
	engineering: buildSet({
		a: [" /EEEE\\{top}", "( {eyes} )", " /|><|\\", " /|#|\\", "  / \\"],
		b: [" /EEEE\\{top}", "( {eyes} )", " /|><|\\", " /|#|\\", "  /#\\"],
	}),
};

const SPECIES_VARIANTS = {
	cat: CAT_VARIANTS,
	dog: DOG_VARIANTS,
	cow: COW_VARIANTS,
	horse: HORSE_VARIANTS,
	spark: SPARK_VARIANTS,
	sprout: SPROUT_VARIANTS,
	drake: DRAKE_VARIANTS,
};

const catAnimations = CAT_VARIANTS.highSchool;
const dogAnimations = DOG_VARIANTS.highSchool;
const cowAnimations = COW_VARIANTS.highSchool;
const horseAnimations = HORSE_VARIANTS.highSchool;
const sparkAnimations = SPARK_VARIANTS.highSchool;
const sproutAnimations = SPROUT_VARIANTS.highSchool;
const drakeAnimations = DRAKE_VARIANTS.highSchool;

export const PET_SPECIES: PetSpeciesDefinition[] = [
	createSpecies(
		"cat",
		{ zh: "猫", en: "Cat" },
		[createBreed("cat", "cat", { zh: "小猫", en: "Kitty" }, ["Mochi", "Yuzu", "Mikan"], catAnimations)],
		CAT_VARIANTS.engineering,
	),
	createSpecies(
		"dog",
		{ zh: "狗", en: "Dog" },
		[createBreed("dog", "dog", { zh: "小狗", en: "Puppy" }, ["Momo", "Yuki", "Buddy"], dogAnimations)],
		DOG_VARIANTS.engineering,
	),
	createSpecies(
		"cow",
		{ zh: "牛", en: "Cow" },
		[createBreed("cow", "cow", { zh: "小牛", en: "Calf" }, ["Moochi", "Cream", "Daisy"], cowAnimations)],
		COW_VARIANTS.engineering,
	),
	createSpecies(
		"horse",
		{ zh: "马", en: "Horse" },
		[createBreed("horse", "horse", { zh: "小马", en: "Foal" }, ["Comet", "Maple", "Nova"], horseAnimations)],
		HORSE_VARIANTS.engineering,
	),
	createSpecies(
		"spark",
		{ zh: "电气鼠", en: "Spark Mouse" },
		[createBreed("spark", "spark", { zh: "电气鼠", en: "Spark Mouse" }, ["Bolt", "Pika", "Zing"], sparkAnimations)],
		SPARK_VARIANTS.engineering,
	),
	createSpecies(
		"sprout",
		{ zh: "种子兽", en: "Seedling" },
		[createBreed("sprout", "sprout", { zh: "种子兽", en: "Seedling" }, ["Bud", "Moss", "Sprig"], sproutAnimations)],
		SPROUT_VARIANTS.engineering,
	),
	createSpecies(
		"drake",
		{ zh: "火龙兽", en: "Drakelet" },
		[createBreed("drake", "drake", { zh: "火龙兽", en: "Drakelet" }, ["Ember", "Cinder", "Flare"], drakeAnimations)],
		DRAKE_VARIANTS.engineering,
	),
];

export const DEFAULT_SPECIES_ID = "cat";
export const DEFAULT_BREED_ID = "cat";

export function getSpeciesDefinition(speciesId: string): PetSpeciesDefinition | undefined {
	return PET_SPECIES.find((species) => species.id === speciesId);
}

export function getBreedDefinition(speciesId: string, breedId: string): PetBreedDefinition | undefined {
	return getSpeciesDefinition(speciesId)?.breeds.find((breed) => breed.id === breedId) ?? getSpeciesDefinition(speciesId)?.breeds[0];
}

export function getSuggestedName(speciesId: string, breedId: string, seed = 0): string {
	const breed = getBreedDefinition(speciesId, breedId);
	const names = breed?.suggestedNames ?? ["Mochi"];
	return names[Math.abs(seed) % names.length] ?? "Mochi";
}

export function getLocalizedSpeciesName(locale: PetLocale, species: PetSpeciesDefinition): string {
	return species.names[locale] ?? species.name;
}

export function getLocalizedBreedName(locale: PetLocale, breed: PetBreedDefinition): string {
	return breed.names[locale] ?? breed.name;
}

export function getSchoolStageAnimations(speciesId: string, breed: PetBreedDefinition, stage: PetStageId): PetAnimationSet {
	const species = SPECIES_VARIANTS[speciesId as keyof typeof SPECIES_VARIANTS];
	if (!species) return breed.animations;
	if (stage === "baby") return species.baby;
	if (stage === "kindergarten" || stage === "elementary" || stage === "middle-school") return species.school;
	if (stage === "high-school") return species.highSchool;
	if (stage === "university") return species.university;
	return breed.animations;
}

export function getCareerBranchAnimations(speciesId: string, branch: PetCareerBranch | null, fallback: PetAnimationSet): PetAnimationSet {
	if (!branch) return fallback;
	const species = SPECIES_VARIANTS[speciesId as keyof typeof SPECIES_VARIANTS];
	if (!species) return fallback;
	if (branch === "academia") return species.academia;
	if (branch === "engineering") return species.engineering;
	return fallback;
}
