import {
  DeckConsistencyAnalysis,
  DeckDrawAnalysis,
  DeckPowerAnalysis,
  DeckProtectionAnalysis,
  DeckRampAnalysis,
  DeckRecursionAnalysis,
  DeckRemovalAnalysis,
  DeckSpellInteractionAnalysis,
  DeckStrategyAnalysis,
  DeckStructureAnalysis,
  DeckWeaknessAnalysis,
  DeckWeaknessExposure,
  DeckWeaknessSeverity,
  DeckWinConditionAnalysis,
  DeckWinStrategyAnalysis,
  StrategyKey,
} from "./types";

interface AdvancedRoleSummary {
  taggedCards: Array<{
    quantity: number;
    hits: Array<{
      tag: string;
      weight: number;
    }>;
  }>;
}

interface DeckWeaknessInput {
  power: DeckPowerAnalysis;
  strategy: DeckStrategyAnalysis;
  winStrategy: DeckWinStrategyAnalysis;
  structure: DeckStructureAnalysis;
  ramp: DeckRampAnalysis;
  draw: DeckDrawAnalysis;
  consistency: DeckConsistencyAnalysis;
  protection: DeckProtectionAnalysis;
  recursion: DeckRecursionAnalysis;
  winConditions: DeckWinConditionAnalysis;
  removal: DeckRemovalAnalysis;
  spellInteraction: DeckSpellInteractionAnalysis;
  advancedRoles?: AdvancedRoleSummary;
}

interface RiskDraft {
  key: string;
  label: string;
  weakAgainst: string[];
  dependency: number;
  mitigation: number;
  evidence: string[];
  answerGaps: string[];
  resistantFactors: string[];
}

const GRAVEYARD_STRATEGIES: StrategyKey[] = ["reanimator", "aristocrats", "madness", "mill"];
const BOARD_STRATEGIES: StrategyKey[] = ["tokens", "kindred", "aggro", "counters", "poison", "extra_combat"];
const COMMANDER_THREAT_STRATEGIES: StrategyKey[] = ["voltron", "mutate", "power_matter", "toughness_matter"];
const SPELL_CHAIN_STRATEGIES: StrategyKey[] = ["spellslinger", "combo", "x_spells", "exile_cast"];
const COMBAT_STRATEGIES: StrategyKey[] = ["aggro", "tokens", "kindred", "voltron", "poison", "extra_combat"];
const PERMANENT_ENGINE_STRATEGIES: StrategyKey[] = ["artifacts", "enchantress", "shrines", "sagas", "clues", "food"];
const SLOW_VALUE_STRATEGIES: StrategyKey[] = ["pillowfort", "control", "group_hug", "superfriends", "lands_matter"];

export function analyzeDeckWeaknesses(input: DeckWeaknessInput): DeckWeaknessAnalysis {
  const drafts = [
    assessGraveyardHate(input),
    assessBoardWipes(input),
    assessSpotRemovalAndEdicts(input),
    assessRuleOfLawAndStax(input),
    assessPillowfortAndFogs(input),
    assessCounterspellPressure(input),
    assessPermanentHate(input),
    assessFastCombo(input),
  ].filter((draft): draft is RiskDraft => draft !== null);

  const exposures = drafts
    .map(finalizeExposure)
    .filter((exposure) => exposure.vulnerabilityScore >= 36)
    .sort((left, right) => right.vulnerabilityScore - left.vulnerabilityScore)
    .slice(0, 6);

  const resistantTo = drafts
    .map(finalizeExposure)
    .filter((exposure) => exposure.vulnerabilityScore < 36 && exposure.resistantFactors.length > 0)
    .sort((left, right) => left.vulnerabilityScore - right.vulnerabilityScore)
    .slice(0, 3)
    .map((exposure) => `${exposure.label}: ${exposure.resistantFactors[0]}`);

  const watchPoints = exposures
    .filter((exposure) => exposure.severity !== "high")
    .slice(0, 3)
    .map((exposure) => exposure.label);

  return {
    summary: summarizeWeaknesses(exposures, input),
    exposures,
    resistantTo,
    watchPoints,
  };
}

function assessGraveyardHate(input: DeckWeaknessInput): RiskDraft | null {
  const graveyardPlan =
    hasStrategy(input.strategy, GRAVEYARD_STRATEGIES) ||
    input.winStrategy.primaryPlan?.key === "graveyard_pressure" ||
    input.recursion.counts.core >= 5 ||
    getAdvancedTagWeight(input, ["graveyard_support", "mill_support"]) >= 5;

  if (!graveyardPlan) {
    return null;
  }

  const dependency = clamp(
    38 +
      input.recursion.counts.core * 5 +
      input.recursion.counts.replay * 3 +
      getStrategySupport(input) * 0.7,
    0,
    96,
  );
  const mitigation = clamp(
    input.removal.counts.targeted * 4 +
      input.removal.counts.tempo * 3 +
      input.spellInteraction.counts.broad * 8 +
      input.spellInteraction.counts.hard * 3,
    0,
    55,
  );

  return {
    key: "graveyard_hate",
    label: "Graveyard Hate",
    weakAgainst: ["graveyard hate decks", "Rest in Peace effects", "repeatable graveyard exile"],
    dependency,
    mitigation,
    evidence: [
      `${input.recursion.counts.core.toFixed(1)} effective recursion / graveyard access`,
      `${getStrategyLabel(input)} uses the graveyard plan enough to care about hate`,
    ],
    answerGaps:
      mitigation < 18
        ? ["few clean answers to hate permanents or hate spells were detected"]
        : [],
    resistantFactors:
      mitigation >= 24
        ? ["interaction and removal give it ways to fight through hate pieces"]
        : [],
  };
}

function assessBoardWipes(input: DeckWeaknessInput): RiskDraft | null {
  const creatureCount = input.structure.counts.creatures;
  const boardPlan = hasStrategy(input.strategy, BOARD_STRATEGIES) || creatureCount >= 28;

  if (!boardPlan) {
    return null;
  }

  const dependency = clamp(28 + creatureCount * 1.2 + getStrategySupport(input) * 0.8, 0, 94);
  const mitigation = clamp(
    input.protection.counts.broad * 11 +
      input.protection.counts.flicker * 5 +
      input.recursion.counts.mass * 8 +
      input.recursion.counts.battlefield * 3 +
      input.draw.counts.repeatable * 2,
    0,
    62,
  );

  return {
    key: "board_wipes",
    label: "Board Wipes",
    weakAgainst: ["control decks with sweepers", "mass -X/-X effects", "repeatable board resets"],
    dependency,
    mitigation,
    evidence: [
      `${creatureCount} creatures / creature-like board pieces in the shell`,
      `${input.protection.counts.broad.toFixed(1)} broad protection and ${input.recursion.counts.mass.toFixed(1)} mass recursion`,
    ],
    answerGaps:
      mitigation < 20
        ? ["the deck appears light on board protection or rebuild tools"]
        : [],
    resistantFactors:
      mitigation >= 28
        ? ["broad protection, flicker, or recursion helps rebuild after sweepers"]
        : [],
  };
}

function assessSpotRemovalAndEdicts(input: DeckWeaknessInput): RiskDraft | null {
  const commanderDamagePlan = input.winStrategy.primaryPlan?.key === "commander_damage";
  const commanderCentric =
    hasStrategy(input.strategy, COMMANDER_THREAT_STRATEGIES) ||
    commanderDamagePlan ||
    input.power.dimensions.some((dimension) => dimension.key === "resilience" && dimension.score < 45);

  if (!commanderCentric) {
    return null;
  }

  const dependency = clamp(
    34 +
      (commanderDamagePlan ? 28 : 0) +
      getStrategySupport(input) * 0.9 +
      Math.max(0, 55 - getPowerDimension(input.power, "resilience")) * 0.5,
    0,
    96,
  );
  const mitigation = clamp(
    input.protection.counts.targeted * 9 +
      input.protection.counts.equipment * 6 +
      input.protection.counts.selfBounce * 5 +
      input.recursion.counts.battlefield * 2,
    0,
    62,
  );

  return {
    key: "spot_removal_edicts",
    label: "Spot Removal and Edicts",
    weakAgainst: ["edict-heavy decks", "cheap instant-speed removal", "bounce on the key threat"],
    dependency,
    mitigation,
    evidence: [
      `${getStrategyLabel(input)} leans on a key permanent or commander-sized threat`,
      `${input.protection.counts.targeted.toFixed(1)} targeted protection and ${input.protection.counts.equipment.toFixed(1)} equipment protection`,
    ],
    answerGaps:
      mitigation < 18
        ? ["single-target protection looks thin for a commander-centric threat plan"]
        : [],
    resistantFactors:
      mitigation >= 26
        ? ["targeted protection and equipment make one-for-one removal less clean"]
        : [],
  };
}

function assessRuleOfLawAndStax(input: DeckWeaknessInput): RiskDraft | null {
  const spellChainPlan =
    hasStrategy(input.strategy, SPELL_CHAIN_STRATEGIES) ||
    input.winStrategy.primaryPlan?.key === "spell_burst" ||
    input.winStrategy.primaryPlan?.key === "infinite_combo";

  if (!spellChainPlan) {
    return null;
  }

  const dependency = clamp(
    36 +
      getStrategySupport(input) * 1.1 +
      input.consistency.counts.direct * 3 +
      (input.winStrategy.primaryPlan?.key === "infinite_combo" ? 18 : 0),
    0,
    96,
  );
  const mitigation = clamp(
    input.removal.counts.targeted * 4 +
      input.removal.counts.tempo * 4 +
      input.spellInteraction.counts.hard * 5 +
      input.spellInteraction.counts.broad * 7,
    0,
    60,
  );

  return {
    key: "rule_of_law_stax",
    label: "Rule of Law / Stax",
    weakAgainst: ["Rule of Law decks", "tax and lock pieces", "Drannith-style restriction decks"],
    dependency,
    mitigation,
    evidence: [
      `${getStrategyLabel(input)} wants chained spells, tutoring, or compact combo turns`,
      `${input.spellInteraction.counts.hard.toFixed(1)} hard stack answers and ${input.removal.counts.targeted.toFixed(1)} targeted removal`,
    ],
    answerGaps:
      mitigation < 20
        ? ["not enough interaction was detected to reliably clear hate pieces before the payoff turn"]
        : [],
    resistantFactors:
      mitigation >= 28
        ? ["stack interaction and removal can protect the key turn against hate"]
        : [],
  };
}

function assessPillowfortAndFogs(input: DeckWeaknessInput): RiskDraft | null {
  const combatPlan =
    hasStrategy(input.strategy, COMBAT_STRATEGIES) ||
    ["commander_damage", "go_wide_combat", "extra_combat_pressure", "poison"].includes(
      input.winStrategy.primaryPlan?.key ?? "",
    );

  if (!combatPlan) {
    return null;
  }

  const dependency = clamp(
    36 +
      input.winConditions.counts.combat * 7 +
      getStrategySupport(input) * 0.75,
    0,
    94,
  );
  const mitigation = clamp(
    input.removal.counts.targeted * 4 +
      input.removal.counts.mass * 4 +
      input.winConditions.counts.direct * 9 +
      input.spellInteraction.counts.broad * 5,
    0,
    58,
  );

  return {
    key: "pillowfort_fogs",
    label: "Pillowfort and Fogs",
    weakAgainst: ["pillowfort decks", "Fog effects", "Propaganda / Ghostly Prison effects"],
    dependency,
    mitigation,
    evidence: [
      `${input.winConditions.counts.combat.toFixed(1)} combat finisher pressure detected`,
      `${input.winConditions.counts.direct.toFixed(1)} direct finisher pressure as a backup`,
    ],
    answerGaps:
      mitigation < 18
        ? ["few noncombat finishers or clean answers to pillowfort pieces were detected"]
        : [],
    resistantFactors:
      mitigation >= 26
        ? ["direct pressure or removal gives it ways around combat taxes"]
        : [],
  };
}

function assessCounterspellPressure(input: DeckWeaknessInput): RiskDraft | null {
  const stackSensitive =
    ["infinite_combo", "spell_burst", "alternate_win", "big_mana_haymakers"].includes(
      input.winStrategy.primaryPlan?.key ?? "",
    ) || hasStrategy(input.strategy, ["combo", "x_spells", "spellslinger"]);

  if (!stackSensitive) {
    return null;
  }

  const dependency = clamp(
    34 +
      input.winConditions.counts.combo * 8 +
      input.consistency.counts.direct * 4 +
      (input.winStrategy.primaryPlan?.key === "big_mana_haymakers" ? 16 : 0),
    0,
    94,
  );
  const mitigation = clamp(
    input.spellInteraction.counts.hard * 8 +
      input.spellInteraction.counts.soft * 4 +
      input.consistency.counts.repeatable * 4 +
      input.draw.counts.repeatable * 2,
    0,
    62,
  );

  return {
    key: "counterspell_pressure",
    label: "Counterspell Pressure",
    weakAgainst: ["draw-go control decks", "blue tempo shells", "counterspell-heavy pods"],
    dependency,
    mitigation,
    evidence: [
      `${input.winStrategy.primaryPlan?.label ?? "The main win plan"} can be stopped on the stack`,
      `${input.spellInteraction.counts.hard.toFixed(1)} hard stack answers in the deck`,
    ],
    answerGaps:
      mitigation < 18
        ? ["the deck has limited stack protection or redundant access for key spells"]
        : [],
    resistantFactors:
      mitigation >= 27
        ? ["own stack interaction and repeatable access help force key spells through"]
        : [],
  };
}

function assessPermanentHate(input: DeckWeaknessInput): RiskDraft | null {
  const permanentPlan =
    hasStrategy(input.strategy, PERMANENT_ENGINE_STRATEGIES) ||
    input.structure.counts.artifacts >= 16 ||
    input.structure.counts.enchantments >= 14;

  if (!permanentPlan) {
    return null;
  }

  const permanentCount = input.structure.counts.artifacts + input.structure.counts.enchantments;
  const dependency = clamp(30 + permanentCount * 1.4 + getStrategySupport(input) * 0.75, 0, 92);
  const mitigation = clamp(
    input.recursion.counts.battlefield * 4 +
      input.recursion.counts.hand * 3 +
      input.protection.counts.broad * 8 +
      input.spellInteraction.counts.hard * 3,
    0,
    56,
  );

  return {
    key: "artifact_enchantment_hate",
    label: "Artifact / Enchantment Hate",
    weakAgainst: ["Bane of Progress effects", "Austere Command-style wipes", "repeatable artifact or enchantment removal"],
    dependency,
    mitigation,
    evidence: [
      `${permanentCount} artifacts/enchantments are part of the shell`,
      `${input.recursion.counts.battlefield.toFixed(1)} battlefield recursion and ${input.protection.counts.broad.toFixed(1)} broad protection`,
    ],
    answerGaps:
      mitigation < 18
        ? ["few rebuild or protection tools for permanent engines were detected"]
        : [],
    resistantFactors:
      mitigation >= 25
        ? ["recursion or broad protection helps recover key engines"]
        : [],
  };
}

function assessFastCombo(input: DeckWeaknessInput): RiskDraft | null {
  const slowPlan =
    hasStrategy(input.strategy, SLOW_VALUE_STRATEGIES) ||
    getPowerDimension(input.power, "speed") < 52 ||
    input.winStrategy.primaryPlan?.key === "value_attrition" ||
    input.winStrategy.primaryPlan?.key === "lock_attrition";

  if (!slowPlan) {
    return null;
  }

  const dependency = clamp(
    62 -
      getPowerDimension(input.power, "speed") * 0.45 +
      Math.max(0, 58 - getPowerDimension(input.power, "interaction")) * 0.8,
    0,
    88,
  );
  const mitigation = clamp(
      input.spellInteraction.counts.hard * 7 +
      input.spellInteraction.counts.soft * 3 +
      input.removal.counts.handAttack * 5 +
      (input.spellInteraction.counts.stax ?? 0) * 7 +
      input.consistency.counts.direct * 1.5,
    0,
    58,
  );

  return {
    key: "fast_combo",
    label: "Fast Combo",
    weakAgainst: ["fast combo decks", "turbo tutor shells", "protected early win attempts"],
    dependency,
    mitigation,
    evidence: [
      `speed ${Math.round(getPowerDimension(input.power, "speed"))}, interaction ${Math.round(getPowerDimension(input.power, "interaction"))}`,
      `${input.spellInteraction.counts.stax?.toFixed(1) ?? "0.0"} stax pressure and ${input.spellInteraction.counts.hard.toFixed(1)} hard stack answers`,
    ],
    answerGaps:
      mitigation < 20
        ? ["early stack interaction, hand pressure, or stax pressure looks light"]
        : [],
    resistantFactors:
      mitigation >= 28
        ? ["stack interaction, hand pressure, or stax pieces help slow fast combo"]
        : [],
  };
}

function finalizeExposure(draft: RiskDraft): DeckWeaknessExposure {
  const vulnerabilityScore = clamp(Math.round(draft.dependency - draft.mitigation + 26), 0, 100);
  const severity = getSeverity(vulnerabilityScore);

  return {
    key: draft.key,
    label: draft.label,
    severity,
    vulnerabilityScore,
    weakAgainst: draft.weakAgainst,
    summary: buildExposureSummary(draft, vulnerabilityScore),
    evidence: draft.evidence,
    answerGaps: draft.answerGaps,
    resistantFactors: draft.resistantFactors,
  };
}

function buildExposureSummary(draft: RiskDraft, vulnerabilityScore: number) {
  if (vulnerabilityScore >= 68) {
    return `${draft.label} is a real pressure point because the deck relies on that axis more than it appears to answer it.`;
  }

  if (vulnerabilityScore >= 48) {
    return `${draft.label} is worth watching; the plan uses this axis, but there is some counterplay already present.`;
  }

  return `${draft.label} is present as a matchup concern, but the deck has enough overlap to avoid reading as clearly soft to it.`;
}

function summarizeWeaknesses(exposures: DeckWeaknessExposure[], input: DeckWeaknessInput) {
  if (exposures.length === 0) {
    return "No clear strategic soft spot stands out from the current tags. The deck may still have meta-specific problems, but no archetype hate axis dominates the read.";
  }

  const top = exposures[0];
  const plan = input.strategy.mainStrategy?.label ?? input.winStrategy.primaryPlan?.label ?? "this strategy";
  return `${plan} is most exposed to ${top.label.toLowerCase()}. The list below separates hard weak matchups from softer watch points based on dependency versus available answers.`;
}

function getSeverity(score: number): DeckWeaknessSeverity {
  if (score >= 68) {
    return "high";
  }

  if (score >= 48) {
    return "medium";
  }

  return "low";
}

function hasStrategy(strategy: DeckStrategyAnalysis, keys: StrategyKey[]) {
  const keySet = new Set(keys);
  return [
    strategy.mainStrategy,
    strategy.detectedMainStrategy,
    ...strategy.subStrategies,
    ...strategy.topStrategies.slice(0, 4),
  ].some((entry) => entry !== null && entry !== undefined && keySet.has(entry.key));
}

function getStrategySupport(input: DeckWeaknessInput) {
  return input.strategy.synergy?.supportCards ?? input.strategy.perspectives[0]?.synergy.supportCards ?? 0;
}

function getStrategyLabel(input: DeckWeaknessInput) {
  return input.strategy.mainStrategy?.label ?? input.winStrategy.primaryPlan?.label ?? "The detected plan";
}

function getPowerDimension(power: DeckPowerAnalysis, key: "speed" | "interaction" | "resilience") {
  return power.dimensions.find((dimension) => dimension.key === key)?.score ?? 0;
}

function getAdvancedTagWeight(input: DeckWeaknessInput, tags: string[]) {
  const tagSet = new Set(tags);
  let total = 0;

  for (const card of input.advancedRoles?.taggedCards ?? []) {
    for (const hit of card.hits) {
      if (tagSet.has(hit.tag)) {
        total += hit.weight * card.quantity;
      }
    }
  }

  return total;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
