import {
  analyzeCommanderInfiniteManaSinks,
  CommanderInfiniteManaSinkAnalysis,
} from "./commanderManaSink";
import {
  DeckResolutionDocument,
  DeckStrategyAnalysis,
  DeckStrategyEntry,
  DeckStrategyPerspective,
  DeckWinConditionAnalysis,
  DeckWinStrategyAnalysis,
  DeckWinStrategyPerspective,
  DeckWinStrategyPlan,
  ResolvedDeckCard,
  StrategyKey,
  ScryfallCard,
  WinConditionTag,
  WinStrategyKey,
} from "./types";

interface WinStrategyContext {
  deckCards: ResolvedDeckCard[];
  commanderNames: string[];
  creatureCount: number;
  highManaFinisherNames: string[];
  comboCardNames: string[];
  poisonCardNames: string[];
  alternateWinCardNames: string[];
  combatFinisherNames: string[];
  directFinisherNames: string[];
  repeatableFinisherNames: string[];
}

interface CandidatePlan {
  key: WinStrategyKey;
  score: number;
  reasons: string[];
  keyCards: string[];
}

const WIN_STRATEGY_LABELS: Record<WinStrategyKey, string> = {
  infinite_combo: "Infinite Combo",
  commander_damage: "Commander Damage",
  go_wide_combat: "Go-Wide Combat",
  extra_combat_pressure: "Extra Combat Pressure",
  drain_burn: "Drain / Burn",
  spell_burst: "Spell Burst",
  mill_out: "Mill Out",
  alternate_win: "Alternate Win",
  planeswalker_ultimates: "Planeswalker Ultimates",
  big_mana_haymakers: "Big Mana Haymakers",
  graveyard_pressure: "Graveyard Pressure",
  lock_attrition: "Lock / Attrition",
  poison: "Poison",
  value_attrition: "Value Attrition",
};

export function analyzeDeckWinStrategy(
  document: DeckResolutionDocument,
  strategy: DeckStrategyAnalysis,
  winConditions: DeckWinConditionAnalysis,
): DeckWinStrategyAnalysis {
  const context = getWinStrategyContext(document, winConditions);
  const commanderManaSink = analyzeCommanderInfiniteManaSinks(
    document.result.resolvedCards
      .filter((card) => card.section === "commander")
      .map((card) => card.card),
    winConditions.combos,
  );
  const perspectives = strategy.perspectives
    .map((perspective) =>
      buildWinStrategyPerspective(perspective, context, winConditions, commanderManaSink),
    )
    .filter((perspective): perspective is DeckWinStrategyPerspective => perspective !== null);
  const activePerspective =
    strategy.mainStrategy === null
      ? perspectives[0] ?? null
      : perspectives.find((entry) => entry.strategyKey === strategy.mainStrategy?.key) ?? null;

  return {
    summary: summarizeWinStrategy(activePerspective?.primaryPlan ?? null, activePerspective?.backupPlans ?? []),
    primaryPlan: activePerspective?.primaryPlan ?? null,
    backupPlans: activePerspective?.backupPlans ?? [],
    perspectives,
  };
}

function buildWinStrategyPerspective(
  perspective: DeckStrategyPerspective,
  context: WinStrategyContext,
  winConditions: DeckWinConditionAnalysis,
  commanderManaSink: CommanderInfiniteManaSinkAnalysis,
): DeckWinStrategyPerspective | null {
  const candidates = new Map<WinStrategyKey, CandidatePlan>();
  const strategies = [perspective.strategy, ...perspective.subStrategies];

  strategies.forEach((entry, index) => {
    const candidate = createStrategyDrivenPlan(
      entry,
      perspective.strategy.key,
      index === 0,
      context,
      winConditions,
      commanderManaSink,
    );
    mergeCandidate(candidates, candidate);
  });

  mergeCandidate(
    candidates,
    createGlobalComboPlan(perspective, context, winConditions, commanderManaSink),
  );
  mergeCandidate(candidates, createGlobalAlternatePlan(perspective, context, winConditions));
  mergeCandidate(candidates, createGlobalPoisonPlan(perspective, context, winConditions));
  mergeCandidate(candidates, createGlobalCombatPlan(perspective, context, winConditions));
  mergeCandidate(candidates, createGlobalDirectPlan(perspective, context, winConditions));

  const rankedPlans = [...candidates.values()]
    .filter((plan) => plan.score >= 24)
    .sort((left, right) => right.score - left.score || left.key.localeCompare(right.key));

  const primaryPlan = toPublicPlan(rankedPlans[0] ?? null);
  const backupPlans = rankedPlans
    .slice(1, 4)
    .map((plan) => toPublicPlan(plan))
    .filter((plan): plan is DeckWinStrategyPlan => plan !== null);

  return {
    strategyKey: perspective.strategy.key,
    strategyLabel: perspective.strategy.label,
    primaryPlan,
    backupPlans,
  };
}

function createStrategyDrivenPlan(
  entry: DeckStrategyEntry,
  mainStrategyKey: StrategyKey,
  isPrimaryStrategy: boolean,
  context: WinStrategyContext,
  winConditions: DeckWinConditionAnalysis,
  commanderManaSink: CommanderInfiniteManaSinkAnalysis,
): CandidatePlan | null {
  const planKey = mapStrategyToWinPlan(entry.key, context, winConditions);
  if (planKey === null) {
    return null;
  }

  const baseScore = entry.score * (isPrimaryStrategy ? 0.88 : 0.62);
  const planSupport = getPlanSupport(planKey, context, winConditions, commanderManaSink);
  const mainPlanBonus = entry.key === mainStrategyKey ? 7 : 0;
  const score = roundTo(baseScore + planSupport.scoreBonus + mainPlanBonus, 2);
  const reasons = [
    `${entry.label} is the clearest ${isPrimaryStrategy ? "main" : "side"} strategy for this lens.`,
    ...planSupport.reasons,
  ];
  const keyCards = dedupeLabels([
    ...entry.keyCards,
    ...planSupport.keyCards,
  ]).slice(0, 6);

  return {
    key: planKey,
    score,
    reasons: reasons.slice(0, 3),
    keyCards,
  };
}

function createGlobalComboPlan(
  perspective: DeckStrategyPerspective,
  context: WinStrategyContext,
  winConditions: DeckWinConditionAnalysis,
  commanderManaSink: CommanderInfiniteManaSinkAnalysis,
): CandidatePlan | null {
  if (winConditions.combos.lookupStatus !== "ok" || winConditions.combos.exactCount <= 0) {
    return null;
  }

  const finisherBonus = winConditions.combos.finisherCount * 8;
  const engineBonus =
    winConditions.combos.engineCount * 4 +
    commanderManaSink.directFinisherCount * 3 +
    commanderManaSink.convertedEngineCount * 1.5;
  const strategyBonus =
    perspective.strategy.key === "combo" ? 24
    : ["artifacts", "spellslinger", "control"].includes(perspective.strategy.key) ? 12
    : 0;
  const sinkText =
    commanderManaSink.directFinisherCount > 0
      ? `${commanderManaSink.commanders[0]?.name ?? "The commander"} turns infinite mana into direct closing pressure.`
      : commanderManaSink.convertedEngineCount > 0
        ? `${commanderManaSink.commanders[0]?.name ?? "The commander"} can spend infinite mana on cards or scalable board pressure.`
        : "The combo package mostly looks like engine loops that still need a payoff.";

  return {
    key: "infinite_combo",
    score: roundTo(48 + finisherBonus + engineBonus + strategyBonus, 2),
    reasons: [
      `${winConditions.combos.exactCount} exact infinite combo line${winConditions.combos.exactCount === 1 ? "" : "s"} were found.`,
      winConditions.combos.finisherCount > 0
        ? `${winConditions.combos.finisherCount} of those combo lines are direct finishers.`
        : sinkText,
    ],
    keyCards: context.comboCardNames.slice(0, 6),
  };
}

function createGlobalAlternatePlan(
  perspective: DeckStrategyPerspective,
  context: WinStrategyContext,
  winConditions: DeckWinConditionAnalysis,
): CandidatePlan | null {
  if (winConditions.counts.alternate <= 0) {
    return null;
  }

  return {
    key: "alternate_win",
    score: roundTo(
      26 +
        winConditions.counts.alternate * 18 +
        (["control", "superfriends", "group_hug"].includes(perspective.strategy.key) ? 6 : 0),
      2,
    ),
    reasons: [
      `${formatDecimal(winConditions.counts.alternate)} alternate-finisher value is present in the shell.`,
      "The deck has a real non-standard route to ending the game.",
    ],
    keyCards: context.alternateWinCardNames.slice(0, 6),
  };
}

function createGlobalPoisonPlan(
  perspective: DeckStrategyPerspective,
  context: WinStrategyContext,
  winConditions: DeckWinConditionAnalysis,
): CandidatePlan | null {
  if (context.poisonCardNames.length === 0) {
    return null;
  }

  return {
    key: "poison",
    score: roundTo(
      28 +
        context.poisonCardNames.length * 9 +
        (perspective.strategy.key === "counters" ? 8 : 0) +
        winConditions.counts.alternate * 4,
      2,
    ),
    reasons: [
      "Poison or infect text gives the deck a real alternate lethal route.",
      perspective.strategy.key === "counters"
        ? "The counters shell reinforces that poison plan naturally."
        : "Those cards push the deck toward poison-based kills.",
    ],
    keyCards: context.poisonCardNames.slice(0, 6),
  };
}

function createGlobalCombatPlan(
  perspective: DeckStrategyPerspective,
  context: WinStrategyContext,
  winConditions: DeckWinConditionAnalysis,
): CandidatePlan | null {
  if (winConditions.counts.combat <= 0 || context.creatureCount < 14) {
    return null;
  }

  const strategyBonus =
    ["tokens", "kindred", "aggro", "counters"].includes(perspective.strategy.key) ? 10
    : perspective.strategy.key === "extra_combat" ? 8
    : 0;

  return {
    key: "go_wide_combat",
    score: roundTo(24 + winConditions.counts.combat * 10 + strategyBonus, 2),
    reasons: [
      `${formatDecimal(winConditions.counts.combat)} combat-finisher value plus ${context.creatureCount} creatures points toward combat kills.`,
      "The deck looks capable of converting a board into lethal pressure.",
    ],
    keyCards: dedupeLabels(context.combatFinisherNames).slice(0, 6),
  };
}

function createGlobalDirectPlan(
  perspective: DeckStrategyPerspective,
  context: WinStrategyContext,
  winConditions: DeckWinConditionAnalysis,
): CandidatePlan | null {
  const directPressure = winConditions.counts.direct + winConditions.counts.repeatable * 0.7;
  if (directPressure <= 1.2) {
    return null;
  }

  const strategyBonus =
    ["aristocrats", "group_slug", "lifegain", "spellslinger"].includes(perspective.strategy.key)
      ? 8
      : 0;

  return {
    key: "drain_burn",
    score: roundTo(24 + directPressure * 9 + strategyBonus, 2),
    reasons: [
      `${formatDecimal(directPressure)} direct finishing pressure points toward drain, burn, or reach-based closes.`,
      "The shell can close without relying only on combat damage.",
    ],
    keyCards: dedupeLabels([
      ...context.directFinisherNames,
      ...context.repeatableFinisherNames,
    ]).slice(0, 6),
  };
}

function mapStrategyToWinPlan(
  key: StrategyKey,
  context: WinStrategyContext,
  winConditions: DeckWinConditionAnalysis,
): WinStrategyKey | null {
  switch (key) {
    case "combo":
      return "infinite_combo";
    case "voltron":
      return "commander_damage";
    case "extra_combat":
      return "extra_combat_pressure";
    case "extra_upkeep":
      return "value_attrition";
    case "tap_untap":
      return winConditions.counts.combat > 0 ? "go_wide_combat" : "lock_attrition";
    case "dice_rolls":
      return context.combatFinisherNames.length > 0 ? "go_wide_combat" : "value_attrition";
    case "coin_flip":
      return winConditions.combos.exactCount > 0 ? "infinite_combo" : "value_attrition";
    case "face_down":
      return context.combatFinisherNames.length > 0 ? "go_wide_combat" : "value_attrition";
    case "dungeons":
      return winConditions.counts.repeatable > 0 ? "value_attrition" : "graveyard_pressure";
    case "madness":
      return winConditions.combos.exactCount > 0 ? "infinite_combo" : "graveyard_pressure";
    case "ninjutsu":
      return "go_wide_combat";
    case "curses":
      return "drain_burn";
    case "exile_cast":
      return winConditions.combos.exactCount > 0 ? "infinite_combo" : "value_attrition";
    case "food":
      return winConditions.counts.direct > 0 ? "drain_burn" : "value_attrition";
    case "clues":
      return winConditions.counts.combat > 0 ? "go_wide_combat" : "value_attrition";
    case "energy":
      return winConditions.counts.combat > 0 ? "go_wide_combat" : "value_attrition";
    case "sagas":
      return winConditions.counts.alternate > 0 ? "alternate_win" : "value_attrition";
    case "monarch":
      return "value_attrition";
    case "theft":
      return "value_attrition";
    case "goad":
      return winConditions.counts.direct > 0 ? "drain_burn" : "lock_attrition";
    case "shrines":
      return winConditions.counts.direct > 0 ? "drain_burn" : "value_attrition";
    case "cycling":
      return winConditions.combos.exactCount > 0 ? "infinite_combo" : "value_attrition";
    case "mutate":
      return context.combatFinisherNames.length > 0 ? "commander_damage" : "value_attrition";
    case "poison":
      return "poison";
    case "battles":
      return winConditions.counts.alternate > 0 ? "alternate_win" : "value_attrition";
    case "pillowfort":
      return "lock_attrition";
    case "copy_clone":
      return winConditions.combos.exactCount > 0 ? "infinite_combo" : "value_attrition";
    case "power_matter":
      return context.combatFinisherNames.length > 0 ? "go_wide_combat" : "value_attrition";
    case "mana_value_matter":
      return winConditions.combos.exactCount > 0 ? "infinite_combo" : "big_mana_haymakers";
    case "x_spells":
      return winConditions.combos.exactCount > 0 ? "infinite_combo" : "spell_burst";
    case "legends_matter":
      return winConditions.counts.combat > 0 ? "go_wide_combat" : "value_attrition";
    case "toughness_matter":
      return "go_wide_combat";
    case "pingers":
      return "drain_burn";
    case "tokens":
    case "kindred":
    case "aggro":
      return "go_wide_combat";
    case "aristocrats":
    case "group_slug":
    case "lifegain":
      return "drain_burn";
    case "spellslinger":
      return winConditions.combos.exactCount > 0 ? "infinite_combo" : "spell_burst";
    case "mill":
      return "mill_out";
    case "superfriends":
      return "planeswalker_ultimates";
    case "reanimator":
      return "graveyard_pressure";
    case "stax":
    case "control":
      return "lock_attrition";
    case "treasure":
    case "lands_matter":
      return "big_mana_haymakers";
    case "artifacts":
      return winConditions.combos.exactCount > 0 ? "infinite_combo" : "big_mana_haymakers";
    case "counters":
      return context.poisonCardNames.length > 0 ? "poison" : "go_wide_combat";
    case "enchantress":
    case "blink":
    case "group_hug":
      return winConditions.counts.alternate > 0 ? "alternate_win" : "value_attrition";
    default:
      return "value_attrition";
  }
}

function getPlanSupport(
  key: WinStrategyKey,
  context: WinStrategyContext,
  winConditions: DeckWinConditionAnalysis,
  commanderManaSink: CommanderInfiniteManaSinkAnalysis,
): { scoreBonus: number; reasons: string[]; keyCards: string[] } {
  switch (key) {
    case "infinite_combo":
      return {
        scoreBonus:
          winConditions.combos.exactCount > 0
            ? 20 +
              winConditions.combos.finisherCount * 6 +
              winConditions.combos.engineCount * 3 +
              commanderManaSink.directFinisherCount * 2.5 +
              commanderManaSink.convertedEngineCount * 1.2
            : 4,
        reasons:
          winConditions.combos.exactCount > 0
            ? [
                commanderManaSink.directFinisherCount > 0
                  ? `${winConditions.combos.exactCount} exact combo line${winConditions.combos.exactCount === 1 ? "" : "s"} support this plan, and ${commanderManaSink.commanders[0]?.name ?? "the commander"} turns infinite mana into a closing outlet.`
                  : commanderManaSink.convertedEngineCount > 0
                    ? `${winConditions.combos.exactCount} exact combo line${winConditions.combos.exactCount === 1 ? "" : "s"} support this plan, and ${commanderManaSink.commanders[0]?.name ?? "the commander"} converts infinite mana into cards or scalable pressure.`
                    : `${winConditions.combos.exactCount} exact combo line${winConditions.combos.exactCount === 1 ? "" : "s"} support this plan.`,
              ]
            : ["The shell hints at combo lines, but the exact combo package still looks light."],
        keyCards: context.comboCardNames,
      };
    case "commander_damage":
      return {
        scoreBonus: 18 + winConditions.counts.combat * 8,
        reasons: [
          `${context.commanderNames.join(" + ")} looks like the focal threat for closing through combat.`,
        ],
        keyCards: [...context.commanderNames, ...context.combatFinisherNames],
      };
    case "go_wide_combat":
      return {
        scoreBonus: 10 + winConditions.counts.combat * 8 + context.creatureCount * 0.15,
        reasons: [
          `${context.creatureCount} creatures plus combat finishers suggest a board-based closing plan.`,
        ],
        keyCards: context.combatFinisherNames,
      };
    case "extra_combat_pressure":
      return {
        scoreBonus: 14 + winConditions.counts.combat * 9,
        reasons: ["Extra combat effects are one of the clearest ways this deck converts pressure into kills."],
        keyCards: context.combatFinisherNames,
      };
    case "drain_burn":
      return {
        scoreBonus: 12 + winConditions.counts.direct * 9 + winConditions.counts.repeatable * 6,
        reasons: ["Direct damage, drain, or repeatable pressure gives the deck non-combat reach."],
        keyCards: dedupeLabels([...context.directFinisherNames, ...context.repeatableFinisherNames]),
      };
    case "spell_burst":
      return {
        scoreBonus: 10 + winConditions.counts.direct * 7 + winConditions.counts.combo * 5,
        reasons: ["The shell looks built to chain spell-based pressure into a closing burst turn."],
        keyCards: dedupeLabels([...context.directFinisherNames, ...context.comboCardNames]),
      };
    case "mill_out":
      return {
        scoreBonus: 12 + winConditions.counts.alternate * 7 + winConditions.counts.direct * 4,
        reasons: ["The deck pressures libraries instead of life totals as its main finishing route."],
        keyCards: dedupeLabels([...context.alternateWinCardNames, ...context.directFinisherNames]),
      };
    case "alternate_win":
      return {
        scoreBonus: 14 + winConditions.counts.alternate * 10,
        reasons: ["A clear alternate-win package gives the deck a nonstandard closing plan."],
        keyCards: context.alternateWinCardNames,
      };
    case "planeswalker_ultimates":
      return {
        scoreBonus: 14 + winConditions.counts.repeatable * 5 + winConditions.counts.alternate * 5,
        reasons: ["The deck looks set up to snowball planeswalkers into ultimates or inevitability."],
        keyCards: dedupeLabels([...context.alternateWinCardNames, ...context.repeatableFinisherNames]),
      };
    case "big_mana_haymakers":
      return {
        scoreBonus: 8 + context.highManaFinisherNames.length * 5 + winConditions.counts.combat * 4,
        reasons: ["Large finishers suggest the deck wants to ramp or develop into haymaker turns."],
        keyCards: context.highManaFinisherNames,
      };
    case "graveyard_pressure":
      return {
        scoreBonus: 10 + winConditions.counts.combat * 5 + winConditions.counts.direct * 4,
        reasons: ["The deck looks like it wants to recycle or reanimate threats as its closing engine."],
        keyCards: dedupeLabels([...context.highManaFinisherNames, ...context.combatFinisherNames]),
      };
    case "lock_attrition":
      return {
        scoreBonus: 10 + winConditions.counts.repeatable * 6 + winConditions.counts.combo * 4,
        reasons: ["The shell looks more interested in constraining the game, then closing through inevitability."],
        keyCards: dedupeLabels([...context.repeatableFinisherNames, ...context.comboCardNames]),
      };
    case "poison":
      return {
        scoreBonus: 12 + context.poisonCardNames.length * 7,
        reasons: ["Poison counters give the deck a separate lethal threshold to attack."],
        keyCards: context.poisonCardNames,
      };
    case "value_attrition":
      return {
        scoreBonus: 6 + winConditions.counts.repeatable * 4 + winConditions.counts.core * 2,
        reasons: ["The shell looks likely to win by stacking value, pressure, and repeated exchanges over time."],
        keyCards: dedupeLabels([...context.repeatableFinisherNames, ...context.directFinisherNames]),
      };
  }
}

function getWinStrategyContext(
  document: DeckResolutionDocument,
  winConditions: DeckWinConditionAnalysis,
): WinStrategyContext {
  const deckCards = document.result.resolvedCards.filter(
    (card) =>
      card.section === "commander" ||
      card.section === "mainboard" ||
      card.section === "companion",
  );
  const cardMap = new Map(deckCards.map((card) => [card.card.name, card]));
  const highManaFinisherNames = winConditions.taggedCards
    .filter((card) => (cardMap.get(card.name)?.card.cmc ?? 0) >= 6)
    .map((card) => card.name);

  return {
    deckCards,
    commanderNames: deckCards
      .filter((card) => card.section === "commander")
      .map((card) => card.card.name),
    creatureCount: deckCards.reduce(
      (sum, card) => sum + (hasCardType(card.card, "Creature") ? card.quantity : 0),
      0,
    ),
    highManaFinisherNames: dedupeLabels(highManaFinisherNames),
    comboCardNames: dedupeLabels(
      winConditions.combos.exact.flatMap((combo) => combo.cardNames),
    ),
    poisonCardNames: dedupeLabels(
      deckCards
        .filter((card) => hasPoisonStrategyText(card.card))
        .map((card) => card.card.name),
    ),
    alternateWinCardNames: dedupeLabels(
      winConditions.taggedCards
        .filter((card) => hasWinConditionTag(card, "alternate_finisher"))
        .map((card) => card.name),
    ),
    combatFinisherNames: dedupeLabels(
      winConditions.taggedCards
        .filter((card) => hasWinConditionTag(card, "combat_finisher"))
        .map((card) => card.name),
    ),
    directFinisherNames: dedupeLabels(
      winConditions.taggedCards
        .filter((card) => hasWinConditionTag(card, "direct_finisher"))
        .map((card) => card.name),
    ),
    repeatableFinisherNames: dedupeLabels(
      winConditions.taggedCards
        .filter((card) => hasWinConditionTag(card, "repeatable_finisher"))
        .map((card) => card.name),
    ),
  };
}

function hasPoisonStrategyText(card: ScryfallCard) {
  if (card.keywords.includes("Infect") || card.keywords.includes("Toxic")) {
    return true;
  }

  return getTextSegments(card).some((text) =>
    /\bpoison counters?\b|\bgain infect\b|\btoxic\b|\bten or more poison counters\b/.test(text),
  );
}

function hasCardType(card: ScryfallCard, typeName: string) {
  if (card.type_line.includes(typeName)) {
    return true;
  }

  return card.card_faces?.some((face) => face.type_line?.includes(typeName)) ?? false;
}

function hasWinConditionTag(
  card: { hits: Array<{ tag: WinConditionTag }> },
  tag: WinConditionTag,
) {
  return card.hits.some((hit) => hit.tag === tag);
}

function getTextSegments(card: ScryfallCard) {
  if (!card.card_faces?.length) {
    return [normalizeText(card.oracle_text ?? "")];
  }

  return card.card_faces.map((face) => normalizeText(face.oracle_text ?? ""));
}

function mergeCandidate(
  candidates: Map<WinStrategyKey, CandidatePlan>,
  candidate: CandidatePlan | null,
) {
  if (!candidate) {
    return;
  }

  const existing = candidates.get(candidate.key);
  if (!existing) {
    candidates.set(candidate.key, {
      ...candidate,
      reasons: dedupeLabels(candidate.reasons).slice(0, 3),
      keyCards: dedupeLabels(candidate.keyCards).slice(0, 6),
    });
    return;
  }

  existing.score = Math.max(existing.score, candidate.score);
  existing.reasons = dedupeLabels([...existing.reasons, ...candidate.reasons]).slice(0, 3);
  existing.keyCards = dedupeLabels([...existing.keyCards, ...candidate.keyCards]).slice(0, 6);
}

function toPublicPlan(candidate: CandidatePlan | null): DeckWinStrategyPlan | null {
  if (!candidate) {
    return null;
  }

  return {
    key: candidate.key,
    label: WIN_STRATEGY_LABELS[candidate.key],
    summary: summarizePlan(candidate.key),
    reasons: candidate.reasons,
    keyCards: candidate.keyCards,
  };
}

function summarizeWinStrategy(
  primaryPlan: DeckWinStrategyPlan | null,
  backupPlans: DeckWinStrategyPlan[],
) {
  if (!primaryPlan) {
    return "No single closing plan stands out yet. The shell still reads as mixed setup or value.";
  }

  if (backupPlans.length === 0) {
    return `The deck mainly looks to win through ${primaryPlan.label}.`;
  }

  if (backupPlans.length === 1) {
    return `The deck mainly looks to win through ${primaryPlan.label}, with ${backupPlans[0].label} as the clearest backup plan.`;
  }

  return `The deck mainly looks to win through ${primaryPlan.label}, with ${backupPlans[0].label} and ${backupPlans[1].label} as backup plans.`;
}

function summarizePlan(key: WinStrategyKey) {
  switch (key) {
    case "infinite_combo":
      return "Assemble a compact loop and convert it into a lethal or deterministic endgame.";
    case "commander_damage":
      return "Protect and scale a single threat until commander-damage kills become realistic.";
    case "go_wide_combat":
      return "Build a wide board and convert it into lethal combat with team-wide payoffs.";
    case "extra_combat_pressure":
      return "Use repeated combat steps to turn one combat-ready board into a finishing sequence.";
    case "drain_burn":
      return "Close games through life-loss, damage, or repeatable reach instead of board combat alone.";
    case "spell_burst":
      return "Chain spells into one explosive turn that converts card flow into lethal pressure.";
    case "mill_out":
      return "Empty opposing libraries and end the game on that axis instead of life totals.";
    case "alternate_win":
      return "Lean on explicit nonstandard win conditions as a real route to ending the game.";
    case "planeswalker_ultimates":
      return "Snowball planeswalker loyalty and convert that inevitability into ultimates or table control.";
    case "big_mana_haymakers":
      return "Ramp or develop into expensive haymakers that take over the table on resolution.";
    case "graveyard_pressure":
      return "Use the graveyard as the engine for recurring threats and closing through reused pressure.";
    case "lock_attrition":
      return "Constrict the game, then win once the table is pinned under repeated interaction or inevitability.";
    case "poison":
      return "Push poison counters as the lethal threshold instead of relying on normal damage.";
    case "value_attrition":
      return "Accumulate enough repeatable value and pressure that the table eventually collapses.";
  }
}

function dedupeLabels(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function formatDecimal(value: number) {
  return value.toFixed(2).replace(/\.00$/, "");
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
