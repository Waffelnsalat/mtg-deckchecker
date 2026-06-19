import {
  getRoleReason,
  getRoleWeight,
  inferAdvancedRoleProfile,
} from "./advancedCardScan";
import { applyEffectQualityDiscount } from "./activationCost";
import { lookupDeckInfiniteCombos } from "./commanderSpellbook";
import { applyCommanderAvailabilityToWinConditionHits } from "./commanderAvailability";
import { CommanderColorProfile, getCommanderColorProfile } from "./commanderColorProfile";
import {
  createEffectiveManaValueContext,
  estimateEffectiveManaValue,
  sumEffectiveManaValue,
} from "./effectiveManaValue";
import {
  analyzeCommanderInfiniteManaSinks,
  CommanderInfiniteManaSinkAnalysis,
} from "./commanderManaSink";
import {
  DeckResolutionDocument,
  DeckWinConditionComboLookup,
  DeckWinConditionAnalysis,
  ResolvedDeckCard,
  ScryfallCard,
  WinConditionTag,
  WinConditionTagHit,
  WinConditionTaggedCard,
} from "./types";

interface WinConditionContext {
  deckCards: ResolvedDeckCard[];
  effectiveManaContext: ReturnType<typeof createEffectiveManaValueContext>;
  averageManaValue: number;
  colorProfile: CommanderColorProfile;
  creatureCount: number;
}

interface FinisherProfile {
  weight: number;
  reason: string;
  repeatable?: boolean;
}

const SMALL_FIXED_DAMAGE_PATTERN =
  /\b(?:deal|deals)\s+(?<amount>1|2|3)\s+damage to each opponent\b|\beach opponent loses (?<loss>1|2|3) life\b/;

export async function analyzeDeckWinConditions(
  document: DeckResolutionDocument,
  comboLookup: (
    document: DeckResolutionDocument,
  ) => Promise<DeckWinConditionComboLookup> = lookupDeckInfiniteCombos,
): Promise<DeckWinConditionAnalysis> {
  const context = getWinConditionContext(document);
  const taggedCards = context.deckCards
    .map((card) => {
      const hits = applyCommanderAvailabilityToWinConditionHits(
        card.section,
        detectWinConditionHits(card.card, context.effectiveManaContext),
      );

      if (hits.length === 0) {
        return null;
      }

      return {
        name: card.card.name,
        quantity: card.quantity,
        section: card.section,
        finisherValue: roundTo(totalWeight(hits), 2),
        hits,
      };
    })
    .filter((card): card is WinConditionTaggedCard => card !== null)
    .sort(
      (left, right) =>
        right.finisherValue - left.finisherValue || left.name.localeCompare(right.name),
    );

  const counts = {
    combat: 0,
    direct: 0,
    alternate: 0,
    repeatable: 0,
  };

  for (const card of taggedCards) {
    for (const hit of card.hits) {
      const amount = roundTo(hit.weight * card.quantity, 2);

      if (hit.tag === "combat_finisher") {
        counts.combat += amount;
      } else if (hit.tag === "direct_finisher") {
        counts.direct += amount;
      } else if (hit.tag === "alternate_finisher") {
        counts.alternate += amount;
      } else if (hit.tag === "repeatable_finisher") {
        counts.repeatable += amount;
      }
    }
  }

  counts.combat = roundTo(counts.combat, 2);
  counts.direct = roundTo(counts.direct, 2);
  counts.alternate = roundTo(counts.alternate, 2);
  counts.repeatable = roundTo(counts.repeatable, 2);

  const comboLookupResult = await comboLookup(document);
  const commanderManaSink = analyzeCommanderInfiniteManaSinks(
    document.result.resolvedCards
      .filter((card) => card.section === "commander")
      .map((card) => card.card),
    comboLookupResult,
  );
  const comboBonus = calculateComboBonus(comboLookupResult, commanderManaSink);
  const core = roundTo(
    counts.combat + counts.direct + counts.alternate * 1.3 + counts.repeatable * 0.65,
    2,
  );
  const effectiveCore = roundTo(core + comboBonus, 2);
  const recommendations = {
    combatTarget: recommendCombatTarget(context),
    directTarget: recommendDirectTarget(context),
    coreTarget: 0,
  };
  recommendations.coreTarget = roundTo(
    recommendCoreTarget(context, recommendations.combatTarget, recommendations.directTarget),
    1,
  );

  const findings = [
    assessFinisherCore(effectiveCore, recommendations.coreTarget),
    assessCombatFinishers(
      counts.combat,
      recommendations.combatTarget,
      context,
      comboLookupResult,
    ),
    assessDirectFinishers(
      counts.direct,
      counts.repeatable,
      recommendations.directTarget,
      context,
      comboLookupResult,
    ),
    assessComboLines(comboLookupResult, comboBonus, commanderManaSink),
    assessAlternateFinishers(counts.alternate),
    assessRepeatableFinishers(counts.repeatable),
  ];
  const finisherScore = scoreFinishers({
    core: effectiveCore,
    combat: counts.combat,
    direct: counts.direct,
    alternate: counts.alternate,
    repeatable: counts.repeatable,
    comboBonus,
    combos: comboLookupResult,
    commanderManaSink,
    recommendations,
  });

  return {
    finisherScore,
    summary: summarizeFinisherScore(finisherScore),
    counts: {
      core: effectiveCore,
      combat: counts.combat,
      direct: counts.direct,
      alternate: counts.alternate,
      repeatable: counts.repeatable,
      combo: comboBonus,
    },
    recommendations,
    findings,
    taggedCards,
    combos: comboLookupResult,
  };
}

function getWinConditionContext(document: DeckResolutionDocument): WinConditionContext {
  const deckCards = document.result.resolvedCards.filter(
    (card) => card.section === "commander" || card.section === "mainboard",
  );
  const nonlandCards = deckCards.filter((card) => !hasCardType(card.card, "Land"));
  const nonlandQuantity = sumQuantities(nonlandCards);
  const effectiveManaContext = createEffectiveManaValueContext(deckCards);

  return {
    deckCards,
    effectiveManaContext,
    averageManaValue:
      nonlandQuantity === 0
        ? 0
        : sumEffectiveManaValue(nonlandCards, effectiveManaContext) / nonlandQuantity,
    colorProfile: getCommanderColorProfile(deckCards),
    creatureCount: deckCards
      .filter((card) => hasCardType(card.card, "Creature"))
      .reduce((sum, card) => sum + card.quantity, 0),
  };
}

function detectWinConditionHits(
  card: ScryfallCard,
  effectiveManaContext: ReturnType<typeof createEffectiveManaValueContext>,
): WinConditionTagHit[] {
  const hits = new Map<WinConditionTag, { weight: number; reasons: Set<string> }>();
  const segments = getWinConditionSegments(card);
  const qualityText = segments.map((segment) => segment.text).join(" ");
  const effectiveManaValue = estimateEffectiveManaValue(card, effectiveManaContext);

  for (const segment of segments) {
    if (!segment.text) {
      continue;
    }

    const combat = getCombatFinisherProfile(segment.typeLine, segment.text);
    const direct = getDirectFinisherProfile(segment.typeLine, segment.text);
    const alternate = getAlternateFinisherProfile(segment.typeLine, segment.text, card.keywords);
    const repeatable = getRepeatableFinisherProfile(segment.typeLine, segment.text);

    if (combat) {
      addHit(
        hits,
        "combat_finisher",
        estimateFinisherWeight(
          effectiveManaValue,
          "combat_finisher",
          combat.weight,
          combat.repeatable,
        ),
        combat.reason,
      );
    }

    if (direct) {
      addHit(
        hits,
        "direct_finisher",
        estimateFinisherWeight(
          effectiveManaValue,
          "direct_finisher",
          direct.weight,
          direct.repeatable,
        ),
        direct.reason,
      );
    }

    if (alternate) {
      addHit(
        hits,
        "alternate_finisher",
        estimateFinisherWeight(
          effectiveManaValue,
          "alternate_finisher",
          alternate.weight,
          alternate.repeatable,
        ),
        alternate.reason,
      );
    }

    if (repeatable) {
      addHit(
        hits,
        "repeatable_finisher",
        estimateFinisherWeight(
          effectiveManaValue,
          "repeatable_finisher",
          repeatable.weight,
          repeatable.repeatable,
        ),
        repeatable.reason,
      );
    }
  }

  const advancedProfile = hits.size === 0 ? inferAdvancedRoleProfile(card) : null;
  if (advancedProfile) {
    const mappings: Array<[WinConditionTag, string]> = [
      ["combat_finisher", "combat_finisher"],
      ["direct_finisher", "direct_finisher"],
      ["alternate_finisher", "alternate_finisher"],
      ["repeatable_finisher", "repeatable_finisher"],
    ];

    for (const [tag, role] of mappings) {
      const weight = getRoleWeight(advancedProfile, role);
      if (weight <= 0) {
        continue;
      }

      addHit(hits, tag, weight, getRoleReason(advancedProfile, role));
    }
  }

  return [...hits.entries()].map(([tag, value]) => ({
    tag,
    weight: roundTo(applyEffectQualityDiscount(value.weight, qualityText), 2),
    reason: [...value.reasons].join(" "),
  }));
}

function addHit(
  hits: Map<WinConditionTag, { weight: number; reasons: Set<string> }>,
  tag: WinConditionTag,
  weight: number,
  reason: string,
) {
  const existing = hits.get(tag);

  if (!existing) {
    hits.set(tag, {
      weight,
      reasons: new Set([reason]),
    });
    return;
  }

  existing.weight = Math.max(existing.weight, weight);
  existing.reasons.add(reason);
}

function getCombatFinisherProfile(typeLine: string, text: string): FinisherProfile | null {
  if (hasExtraCombat(text)) {
    return {
      weight: isRepeatableFinisherText(text) ? 1.05 : 0.98,
      reason: "Extra combat steps are a strong combat-closing tool.",
      repeatable: isRepeatableFinisherText(text),
    };
  }

  if (hasTeamOverrun(text)) {
    return {
      weight: 0.96,
      reason: "Team-wide power boosts with evasion or trample often close combat quickly.",
    };
  }

  if (hasTeamUnblockable(text)) {
    return {
      weight: 0.88,
      reason: "Team-wide unblockable or double-strike effects help convert a board into lethal combat.",
    };
  }

  if (typeLine.includes("Creature") && hasRepeatableAttackPump(text)) {
    return {
      weight: 0.82,
      reason: "Repeatable combat payoff can turn attacks into a real closing plan.",
      repeatable: true,
    };
  }

  return null;
}

function getDirectFinisherProfile(typeLine: string, text: string): FinisherProfile | null {
  if (hasTableLossOrDamage(text)) {
    return {
      weight: isScalingDirectFinisher(text) ? 1 : 0.88,
      reason: "Direct life-loss or damage to the whole table is a clear finishing route.",
      repeatable: isRepeatableFinisherText(text),
    };
  }

  if (typeLine.includes("Creature") && hasAttackTriggeredTableDamage(text)) {
    return {
      weight: 0.86,
      reason: "Attack-triggered table damage can finish games through combat stalls.",
      repeatable: true,
    };
  }

  if (hasScalableTargetDamage(text)) {
    return {
      weight: /\bx\b/.test(text) ? 0.72 : 0.54,
      reason: "Scalable direct damage can close games once the deck has enough mana.",
      repeatable: isRepeatableFinisherText(text),
    };
  }

  return null;
}

function getAlternateFinisherProfile(
  typeLine: string,
  text: string,
  keywords: string[],
): FinisherProfile | null {
  if (hasExplicitWinCondition(text)) {
    return {
      weight: 1.08,
      reason: "Explicit win-the-game or lose-the-game text is a true alternate finisher.",
      repeatable: isRepeatableFinisherText(text),
    };
  }

  if (hasTeamInfectFinisher(text) || hasPoisonFinish(text, keywords)) {
    return {
      weight: 0.96,
      reason: "Poison-based closing text gives the deck an alternate path to lethal.",
      repeatable: isRepeatableFinisherText(text) || keywords.includes("Infect"),
    };
  }

  if (typeLine.includes("Sorcery") && hasMassMillFinish(text)) {
    return {
      weight: 0.84,
      reason: "Large mill effects can function as alternate finishers in the right shell.",
    };
  }

  return null;
}

function getRepeatableFinisherProfile(typeLine: string, text: string): FinisherProfile | null {
  if (!isRepeatableFinisherText(text) || !isPermanentType(typeLine)) {
    return null;
  }

  if (hasTableLossOrDamage(text) || hasAttackTriggeredTableDamage(text)) {
    return {
      weight: 0.92,
      reason: "Repeatable table damage or drain gives the deck ongoing closing pressure.",
      repeatable: true,
    };
  }

  if (hasRepeatableAttackPump(text) || hasExtraCombat(text)) {
    return {
      weight: 0.74,
      reason: "Repeatable combat payoff provides sustained closing pressure.",
      repeatable: true,
    };
  }

  if (hasExplicitWinCondition(text)) {
    return {
      weight: 0.88,
      reason: "A repeatable alternate-win line becomes much easier to convert into a finish.",
      repeatable: true,
    };
  }

  return null;
}

function estimateFinisherWeight(
  cmc: number,
  tag: WinConditionTag,
  base: number,
  repeatable = false,
) {
  const curvePoint =
    tag === "alternate_finisher" ? 4
    : tag === "combat_finisher" ? 4
    : tag === "repeatable_finisher" ? 4
    : 3;
  const penaltyPerStep =
    tag === "alternate_finisher" ? 0.035
    : tag === "combat_finisher" ? 0.04
    : tag === "repeatable_finisher" ? 0.04
    : 0.045;
  const stepsPastCurve = Math.max(cmc - curvePoint, 0);
  let factor = 1 - stepsPastCurve * penaltyPerStep;

  if (repeatable) {
    factor += 0.04;
  }

  return roundTo(base * clamp(factor, 0.72, 1.08), 2);
}

function recommendCombatTarget(context: WinConditionContext) {
  let target =
    context.creatureCount >= 24 ? 1.4
    : context.creatureCount >= 16 ? 1
    : context.creatureCount >= 10 ? 0.6
    : 0.2;

  if (context.colorProfile.hasGreen || context.colorProfile.hasWhite || context.colorProfile.hasRed) {
    target += 0.2;
  }

  if (context.averageManaValue >= 3.4 && context.creatureCount >= 16) {
    target += 0.2;
  }

  return roundTo(clamp(target, 0, 2), 1);
}

function recommendDirectTarget(context: WinConditionContext) {
  let target =
    context.colorProfile.hasRed || context.colorProfile.hasBlack ? 0.8
    : context.colorProfile.hasBlue ? 0.5
    : 0.3;

  if (context.creatureCount <= 12) {
    target += 0.2;
  }

  if (context.averageManaValue <= 2.4 && (context.colorProfile.hasRed || context.colorProfile.hasBlack)) {
    target += 0.2;
  }

  return roundTo(clamp(target, 0.2, 1.4), 1);
}

function recommendCoreTarget(
  context: WinConditionContext,
  combatTarget: number,
  directTarget: number,
) {
  let target = 1.6 + combatTarget * 0.6 + directTarget * 0.6;

  if (context.averageManaValue >= 3.6) {
    target += 0.3;
  }

  if (context.creatureCount >= 24) {
    target += 0.2;
  }

  return clamp(target, 1.8, 3.4);
}

function assessFinisherCore(core: number, target: number) {
  if (core < target - 1) {
    return {
      code: "finisher_core_low",
      title: "Closing package is light",
      status: "warning",
      message: `${core.toFixed(2)} effective finishing power is below the target of ${target}. The deck may generate value but struggle to actually end games.`,
    } as const;
  }

  if (core > target + 3) {
    return {
      code: "finisher_core_high",
      title: "Closing package is dense",
      status: "note",
      message: `${core.toFixed(2)} effective finishing power is above the target of ${target}. The deck should close games reliably, but some slots may be overcommitted to finishers.`,
    } as const;
  }

  return {
    code: "finisher_core_fit",
    title: "Closing package looks healthy",
    status: "good",
    message: `${core.toFixed(2)} effective finishing power lines up well with the target of ${target}.`,
  } as const;
}

function assessCombatFinishers(
  combat: number,
  target: number,
  context: WinConditionContext,
  combos: DeckWinConditionComboLookup,
) {
  if (target <= 0) {
    return {
      code: "combat_finishers_optional",
      title: "Combat finishers are optional here",
      status: combat > 0 ? "good" : "note",
      message:
        combat > 0
          ? `${combat.toFixed(2)} combat finishing power is a useful bonus for this shell.`
          : "This shell is not expected to rely heavily on combat-based finishers.",
    } as const;
  }

  if (combat < target - 0.5) {
    return {
      code: "combat_finishers_low",
      title:
        combos.finisherCount > 0 ? "Combat finishers are light, but combos help" : "Combat finishers are light",
      status: combos.finisherCount > 0 ? "good" : "note",
      message:
        combos.finisherCount > 0
          ? `${combat.toFixed(2)} combat finishing power is below the target of ${target}, but ${combos.finisherCount} exact combo finisher line${combos.finisherCount === 1 ? "" : "s"} give this deck another way to close games.`
          : context.creatureCount >= 16
            ? `${combat.toFixed(2)} combat finishing power is below the target of ${target}. Creature-heavy shells usually want at least one or two clean closers.`
            : `${combat.toFixed(2)} combat finishing power is below the target of ${target}.`,
    } as const;
  }

  return {
    code: "combat_finishers_fit",
    title: "Combat finishers look healthy",
    status: "good",
    message: `${combat.toFixed(2)} combat finishing power is close to the target of ${target}.`,
  } as const;
}

function assessDirectFinishers(
  direct: number,
  repeatable: number,
  target: number,
  context: WinConditionContext,
  combos: DeckWinConditionComboLookup,
) {
  const coverage = roundTo(direct + repeatable * 0.35, 2);

  if (coverage < target - 0.4) {
    return {
      code: "direct_finishers_low",
      title:
        combos.finisherCount > 0 ? "Direct finishers are light, but combos help" : "Direct finishers are light",
      status: combos.finisherCount > 0 ? "good" : "note",
      message:
        combos.finisherCount > 0
          ? `${coverage.toFixed(2)} direct finishing power is below the target of ${target}, but ${combos.finisherCount} exact combo finisher line${combos.finisherCount === 1 ? "" : "s"} reduce the need for raw reach.`
          : context.colorProfile.hasRed || context.colorProfile.hasBlack
            ? `${coverage.toFixed(2)} direct finishing power is below the target of ${target}. These colors often support at least some reach or drain to close games.`
            : `${coverage.toFixed(2)} direct finishing power is below the target of ${target}.`,
    } as const;
  }

  return {
    code: "direct_finishers_fit",
    title: "Direct finishers look healthy",
    status: "good",
    message: `${coverage.toFixed(2)} direct finishing power is close to the target of ${target}.`,
  } as const;
}

function assessComboLines(
  combos: DeckWinConditionComboLookup,
  comboBonus: number,
  commanderManaSink: CommanderInfiniteManaSinkAnalysis,
) {
  if (combos.lookupStatus === "unavailable") {
    return {
      code: "combo_lookup_unavailable",
      title: "Infinite combo lookup is unavailable",
      status: "note",
      message:
        "Commander Spellbook combo lookup did not respond for this scan, so infinite-combo lines were not counted this time.",
    } as const;
  }

  if (combos.exactCount <= 0) {
    return {
      code: combos.nearMissCount > 0 ? "combo_lines_near_miss" : "combo_lines_none",
      title:
        combos.nearMissCount > 0
          ? "No exact infinite combos were found"
          : "Infinite combos are absent",
      status: "note",
      message:
        combos.nearMissCount > 0
          ? `No exact infinite combo lines were found, but Commander Spellbook flagged ${combos.nearMissCount} near-miss line${combos.nearMissCount === 1 ? "" : "s"}.`
          : "No exact infinite combo lines were found in Commander Spellbook. That is normal for many Commander shells.",
    } as const;
  }

  if (combos.finisherCount > 0) {
    return {
      code: "combo_lines_present",
      title: "Infinite combo finishers are present",
      status: "good",
      message: `${combos.exactCount} exact infinite combo line${combos.exactCount === 1 ? "" : "s"} were found, with ${combos.finisherCount} counting as direct finishing lines. They add ${comboBonus.toFixed(2)} effective finisher value.`,
    } as const;
  }

  if (commanderManaSink.directFinisherCount > 0) {
    const commanderText = commanderManaSink.commanders
      .map((profile) => profile.name)
      .slice(0, 2)
      .join(" and ");

    return {
      code: "combo_lines_command_zone_finisher",
      title: "Infinite mana converts through the commander",
      status: "good",
      message: `${combos.exactCount} exact infinite combo line${combos.exactCount === 1 ? "" : "s"} were found. ${commanderText} can convert infinite mana into direct closing pressure, so those engine lines function much more like real finishers and add ${comboBonus.toFixed(2)} effective finisher value.`,
    } as const;
  }

  if (commanderManaSink.convertedEngineCount > 0) {
    const commanderText = commanderManaSink.commanders
      .map((profile) => profile.name)
      .slice(0, 2)
      .join(" and ");

    return {
      code: "combo_engines_command_zone_sink",
      title: "Infinite mana converts through the commander",
      status: "good",
      message: `${combos.exactCount} exact infinite combo line${combos.exactCount === 1 ? "" : "s"} were found. ${commanderText} can spend infinite mana on cards, tutoring, or scalable pressure, so the engine package is less likely to stall than a dead loop would be.`,
    } as const;
  }

  return {
    code: "combo_engines_present",
    title: "Infinite combo engines are present",
    status: "good",
    message: `${combos.exactCount} exact infinite combo line${combos.exactCount === 1 ? "" : "s"} were found. These are mostly engine loops, so the deck still needs a payoff to convert them into a win.`,
  } as const;
}

function assessAlternateFinishers(alternate: number) {
  if (alternate <= 0) {
    return {
      code: "alternate_finishers_none",
      title: "Alternate finishers are absent",
      status: "note",
      message: "The deck has no clear alternate-win finisher. That is normal for many Commander shells.",
    } as const;
  }

  return {
    code: "alternate_finishers_present",
    title: "Alternate finisher is present",
    status: "good",
    message: `${alternate.toFixed(2)} alternate finishing power gives the deck another way to close the game.`,
  } as const;
}

function assessRepeatableFinishers(repeatable: number) {
  if (repeatable <= 0) {
    return {
      code: "repeatable_finishers_none",
      title: "Repeatable closing pressure is absent",
      status: "note",
      message: "The deck does not lean on repeatable finishing engines. That is fine if the one-shot closers are strong enough.",
    } as const;
  }

  return {
    code: "repeatable_finishers_present",
    title: "Repeatable closing pressure is present",
    status: "good",
    message: `${repeatable.toFixed(2)} repeatable finishing pressure gives the deck a way to keep closing games over several turns.`,
  } as const;
}

function scoreFinishers(input: {
  core: number;
  combat: number;
  direct: number;
  alternate: number;
  repeatable: number;
  comboBonus: number;
  combos: DeckWinConditionComboLookup;
  commanderManaSink: CommanderInfiniteManaSinkAnalysis;
  recommendations: {
    coreTarget: number;
    combatTarget: number;
    directTarget: number;
  };
}) {
  const directCoverage = roundTo(input.direct + input.repeatable * 0.35, 2);
  const combatPenaltyFactor =
    input.combos.finisherCount > 0 ? 0.3
    : input.commanderManaSink.directFinisherCount > 0 ? 0.4
    : input.commanderManaSink.convertedEngineCount > 0 ? 0.48
    : input.combos.engineCount > 0 ? 0.6
    : 1;
  const directPenaltyFactor =
    input.combos.finisherCount > 0 ? 0.2
    : input.commanderManaSink.directFinisherCount > 0 ? 0.32
    : input.commanderManaSink.convertedEngineCount > 0 ? 0.42
    : input.combos.engineCount > 0 ? 0.55
    : 1;
  let score = 70;

  score += calculateTargetBonus(input.core, input.recommendations.coreTarget, 5.5);
  score += calculateTargetBonus(input.combat, input.recommendations.combatTarget, 3.5);
  score += calculateTargetBonus(directCoverage, input.recommendations.directTarget, 3);
  score += Math.min(input.comboBonus * 4.8, 14);

  if (input.alternate > 0) {
    score += Math.min(input.alternate, 1.5);
  }

  score -= calculateUnderPenalty(input.core, input.recommendations.coreTarget, 6, 4);
  score -= calculateOverPenalty(input.core, input.recommendations.coreTarget, 2.8, 0.45);
  score -=
    calculateUnderPenalty(input.combat, input.recommendations.combatTarget, 2.6, 2.1) *
    combatPenaltyFactor;
  score -=
    calculateUnderPenalty(directCoverage, input.recommendations.directTarget, 2.4, 2) *
    directPenaltyFactor;

  if (input.core <= 0 && input.combat <= 0 && input.direct <= 0 && input.alternate <= 0) {
    score -= 35;
  }

  return clamp(Math.round(score), 0, 100);
}

function calculateComboBonus(
  combos: DeckWinConditionComboLookup,
  commanderManaSink: CommanderInfiniteManaSinkAnalysis,
) {
  if (combos.lookupStatus !== "ok" || combos.exact.length === 0) {
    return 0;
  }

  const [best, ...rest] = combos.exact;
  let bonus = best.comboValue;

  for (const combo of rest.slice(0, 4)) {
    bonus += combo.comboValue * (combo.lineType === "finisher" ? 0.45 : 0.3);
  }

  if (commanderManaSink.directFinisherCount > 0) {
    bonus += 0.55 + Math.min(0.8, commanderManaSink.directFinisherCount * 0.22);
  } else if (commanderManaSink.convertedEngineCount > 0) {
    bonus += 0.28 + Math.min(0.55, commanderManaSink.convertedEngineCount * 0.14);
  }

  return roundTo(clamp(bonus, 0, 4.2), 2);
}

function summarizeFinisherScore(score: number) {
  if (score >= 86) {
    return "Closing package is strong and well-rounded.";
  }

  if (score >= 72) {
    return "Closing package is healthy, with a few tuning points.";
  }

  if (score >= 58) {
    return "Closing package is playable, but uneven.";
  }

  return "Closing package is underbuilt for ending games cleanly.";
}

function calculateTargetBonus(actual: number, target: number, maxBonus: number) {
  if (target <= 0) {
    return 0;
  }

  if (actual >= target) {
    const diff = actual - target;

    if (diff <= 0.6) {
      return maxBonus;
    }

    if (diff <= 1.2) {
      return maxBonus * 0.72;
    }

    if (diff <= 2.2) {
      return maxBonus * 0.35;
    }

    return 0;
  }

  const shortfall = target - actual;

  if (shortfall <= 0.3) {
    return maxBonus * 0.78;
  }

  if (shortfall <= 0.7) {
    return maxBonus * 0.42;
  }

  return 0;
}

function calculateUnderPenalty(actual: number, target: number, basePenalty: number, rate: number) {
  if (target <= 0 || actual >= target) {
    return 0;
  }

  const shortfall = target - actual;
  let penalty = basePenalty + shortfall * rate;

  if (shortfall > 1.2) {
    penalty += (shortfall - 1.2) * rate * 0.35;
  }

  return penalty;
}

function calculateOverPenalty(actual: number, target: number, grace: number, rate: number) {
  if (target <= 0 || actual <= target + grace) {
    return 0;
  }

  return (actual - target - grace) * rate;
}

function getWinConditionSegments(card: ScryfallCard) {
  if (!card.card_faces?.length) {
    return [
      {
        typeLine: card.type_line,
        text: normalizeText(card.oracle_text ?? ""),
      },
    ];
  }

  return card.card_faces.map((face) => ({
    typeLine: face.type_line ?? "",
    text: normalizeText(face.oracle_text ?? ""),
  }));
}

function hasExtraCombat(text: string) {
  return (
    /\bafter this (?:main )?phase, there is an additional combat phase\b/.test(text) ||
    /\buntap all (?:creatures|attacking creatures) you control\b[^.]{0,160}\badditional combat phase\b/.test(text) ||
    /\badditional combat phase\b/.test(text)
  );
}

function hasTeamOverrun(text: string) {
  return (
    /\bcreatures you control get [^.]*(?:\+\d+\/\+\d+|\+x\/\+x|\+\d+\/\+0)\b[^.]{0,160}\b(?:trample|double strike|flying|menace|haste|infect)\b/.test(
      text,
    ) ||
    /\bcreatures you control gain\b[^.]{0,80}\b(?:trample|double strike|flying|menace|haste|infect)\b[^.]{0,160}\bget [^.]*(?:\+\d+\/\+\d+|\+x\/\+x|\+\d+\/\+0)\b/.test(
      text,
    ) ||
    /\bcreatures you control\b[^.]{0,160}\bhave base power and toughness x\/x\b/.test(text) ||
    /\battacking creatures you control get [^.]*(?:\+\d+\/\+\d+|\+\d+\/\+0|\+x\/\+x)\b[^.]{0,160}\b(?:trample|double strike|flying|menace)\b/.test(
      text,
    ) ||
    /\bcreatures target player controls get \+\d+\/\+\d+\b[\s\S]{0,140}\buntap them\b/.test(text) ||
    /\bcreatures you control gain infect\b/.test(text)
  );
}

function hasTeamUnblockable(text: string) {
  return (
    /\bcreatures you control (?:are|become) unblockable\b/.test(text) ||
    /\bcreatures you control can't be blocked this turn\b/.test(text) ||
    /\bcreatures you control gain double strike\b/.test(text) ||
    /\bcreatures you control gain menace\b/.test(text)
  );
}

function hasRepeatableAttackPump(text: string) {
  return (
    /\bwhenever\b[^.]{0,160}\battacks?\b[^.]{0,200}\bcreatures you control get\b/.test(text) ||
    /\bat the beginning of combat\b[^.]{0,200}\bcreatures you control get\b/.test(text) ||
    /\bwhenever one or more creatures you control deal combat damage\b[^.]{0,160}\beach opponent\b/.test(text)
  );
}

function hasTableLossOrDamage(text: string) {
  return (
    /\beach opponent loses\b[^.]{0,120}\blife\b/.test(text) ||
    /\b(?:deal|deals)\b[^.]{0,80}\bdamage to each opponent\b/.test(text) ||
    /\beach opponent loses x life\b/.test(text) ||
    /\beach opponent loses life equal to\b/.test(text) ||
    /\b(?:deal|deals)\b[^.]{0,80}\bthat much damage to each opponent\b/.test(text)
  );
}

function hasScalableTargetDamage(text: string) {
  return (
    /\bdeals? (?:x|that much) damage to (?:any (?:other )?target|target (?:player|opponent))\b/.test(text) ||
    /\bdeals? (?:\w+\s+times\s+)?x damage to each of up to x targets?\b/.test(text) ||
    /\bdeals? (?:x|that much) damage divided as you choose among any number of targets?\b/.test(text) ||
    /\bchoose any target\b[\s\S]{0,180}\bdeals? (?:x|that much) damage to each of them\b/.test(text)
  );
}

function hasAttackTriggeredTableDamage(text: string) {
  return (
    /\bwhenever\b[^.]{0,140}\battacks?\b[^.]{0,180}\beach opponent\b[^.]{0,120}\b(?:loses|lose|takes|take|deals?)\b/.test(
      text,
    ) ||
    /\bwhenever\b[^.]{0,160}\benters the battlefield\b[^.]{0,180}\beach opponent\b[^.]{0,120}\b(?:loses|lose|takes|take|deals?)\b/.test(
      text,
    )
  );
}

function isScalingDirectFinisher(text: string) {
  return (
    /\bx\b/.test(text) ||
    /\bequal to\b/.test(text) ||
    /\bfor each\b/.test(text) ||
    !SMALL_FIXED_DAMAGE_PATTERN.test(text)
  );
}

function hasExplicitWinCondition(text: string) {
  return (
    /\byou win the game\b/.test(text) ||
    /\btarget opponent loses the game\b/.test(text) ||
    /\beach opponent loses the game\b/.test(text) ||
    /\bthat player loses the game\b/.test(text)
  );
}

function hasTeamInfectFinisher(text: string) {
  return /\bcreatures you control\b[^.]{0,160}\bgain\b[^.]{0,80}\binfect\b/.test(text);
}

function hasPoisonFinish(text: string, keywords: string[]) {
  return (
    keywords.includes("Infect") ||
    /\beach opponent gets\b[^.]{0,120}\bpoison counters?\b/.test(text) ||
    /\bthat player gets\b[^.]{0,120}\bpoison counters?\b/.test(text) ||
    /\bten or more poison counters\b/.test(text)
  );
}

function hasMassMillFinish(text: string) {
  return (
    /\btarget player mills half their library\b/.test(text) ||
    /\beach opponent mills\b[^.]{0,120}\b(?:x|\d+|that many)\b/.test(text) ||
    /\btarget player mills\b[^.]{0,120}\bhalf\b/.test(text)
  );
}

function isRepeatableFinisherText(text: string) {
  return (
    /\{[^}]+\}\s*:\s*/.test(text) ||
    /\bat the beginning of\b/.test(text) ||
    /\bwhenever\b/.test(text)
  );
}

function isPermanentType(typeLine: string) {
  return (
    typeLine.includes("Artifact") ||
    typeLine.includes("Creature") ||
    typeLine.includes("Enchantment") ||
    typeLine.includes("Planeswalker") ||
    typeLine.includes("Battle")
  );
}

function hasCardType(card: ScryfallCard, typeName: string) {
  if (card.type_line.includes(typeName)) {
    return true;
  }

  return card.card_faces?.some((face) => face.type_line?.includes(typeName)) ?? false;
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function totalWeight(hits: Array<{ weight: number }>) {
  return hits.reduce((sum, hit) => sum + hit.weight, 0);
}

function sumQuantities(cards: ResolvedDeckCard[]) {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
