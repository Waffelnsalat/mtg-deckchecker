import {
  getRoleReason,
  getRoleWeight,
  inferAdvancedRoleProfile,
} from "./advancedCardScan";
import { applyEffectQualityDiscount } from "./activationCost";
import { applyCommanderAvailabilityToRecursionHits } from "./commanderAvailability";
import { CommanderColorProfile, getCommanderColorProfile } from "./commanderColorProfile";
import {
  createEffectiveManaValueContext,
  estimateEffectiveManaValue,
  sumEffectiveManaValue,
} from "./effectiveManaValue";
import {
  DeckRecursionAnalysis,
  DeckResolutionDocument,
  RecursionTag,
  RecursionTagHit,
  RecursionTaggedCard,
  ResolvedDeckCard,
  ScryfallCard,
} from "./types";

interface RecursionContext {
  deckCards: ResolvedDeckCard[];
  effectiveManaContext: ReturnType<typeof createEffectiveManaValueContext>;
  averageManaValue: number;
  colorProfile: CommanderColorProfile;
}

interface RecursionProfile {
  weight: number;
  reason: string;
  repeatable?: boolean;
}

export function analyzeDeckRecursion(document: DeckResolutionDocument): DeckRecursionAnalysis {
  const context = getRecursionContext(document);
  const taggedCards = context.deckCards
    .map((card) => {
      const hits = applyCommanderAvailabilityToRecursionHits(
        card.section,
        detectRecursionHits(card.card, context.effectiveManaContext),
      );

      if (hits.length === 0) {
        return null;
      }

      return {
        name: card.card.name,
        quantity: card.quantity,
        section: card.section,
        recursionValue: roundTo(totalWeight(hits), 2),
        hits,
      };
    })
    .filter((card): card is RecursionTaggedCard => card !== null)
    .sort(
      (left, right) => right.recursionValue - left.recursionValue || left.name.localeCompare(right.name),
    );

  const counts = {
    battlefield: 0,
    hand: 0,
    replay: 0,
    mass: 0,
    library: 0,
  };

  for (const card of taggedCards) {
    for (const hit of card.hits) {
      const amount = roundTo(hit.weight * card.quantity, 2);

      if (hit.tag === "battlefield_recursion") {
        counts.battlefield += amount;
      } else if (hit.tag === "hand_recursion") {
        counts.hand += amount;
      } else if (hit.tag === "replay_recursion") {
        counts.replay += amount;
      } else if (hit.tag === "mass_recursion") {
        counts.mass += amount;
      } else if (hit.tag === "library_recursion") {
        counts.library += amount;
      }
    }
  }

  counts.battlefield = roundTo(counts.battlefield, 2);
  counts.hand = roundTo(counts.hand, 2);
  counts.replay = roundTo(counts.replay, 2);
  counts.mass = roundTo(counts.mass, 2);
  counts.library = roundTo(counts.library, 2);

  const core = roundTo(
    counts.battlefield * 1.15 +
      counts.hand +
      counts.replay +
      counts.mass * 1.25 +
      counts.library * 0.55,
    2,
  );
  const recommendations = {
    battlefieldTarget: recommendBattlefieldTarget(
      context.averageManaValue,
      context.colorProfile,
    ),
    replayTarget: recommendReplayTarget(context.averageManaValue, context.colorProfile),
    coreTarget: 0,
  };
  recommendations.coreTarget = roundTo(
    recommendCoreTarget(
      context.averageManaValue,
      context.colorProfile,
      recommendations.battlefieldTarget,
      recommendations.replayTarget,
    ),
    1,
  );

  const findings = [
    assessRecursionCore(core, recommendations.coreTarget, context.colorProfile),
    assessBattlefieldRecursion(
      counts.battlefield,
      counts.mass,
      recommendations.battlefieldTarget,
      context.colorProfile,
    ),
    assessReplayRecursion(
      counts.replay,
      counts.library,
      recommendations.replayTarget,
      context.colorProfile,
    ),
    assessRecoveryUtility(counts.hand, counts.library, counts.mass),
  ];
  const recursionScore = scoreRecursion({
    core,
    battlefield: counts.battlefield,
    hand: counts.hand,
    replay: counts.replay,
    mass: counts.mass,
    library: counts.library,
    recommendations,
  });

  return {
    recursionScore,
    summary: summarizeRecursionScore(recursionScore),
    counts: {
      core,
      battlefield: counts.battlefield,
      hand: counts.hand,
      replay: counts.replay,
      mass: counts.mass,
      library: counts.library,
    },
    recommendations,
    findings,
    taggedCards,
  };
}

function getRecursionContext(document: DeckResolutionDocument): RecursionContext {
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
  };
}

function detectRecursionHits(
  card: ScryfallCard,
  effectiveManaContext: ReturnType<typeof createEffectiveManaValueContext>,
): RecursionTagHit[] {
  const hits = new Map<RecursionTag, { weight: number; reasons: Set<string> }>();
  const segments = getRecursionSegments(card);
  const qualityText = segments.map((segment) => segment.text).join(" ");
  const effectiveManaValue = estimateEffectiveManaValue(card, effectiveManaContext);

  for (const segment of segments) {
    if (!segment.text) {
      continue;
    }

    const battlefield = getBattlefieldRecursionProfile(segment.text);
    const hand = getHandRecursionProfile(segment.text);
    const replay = getReplayRecursionProfile(segment.text);
    const mass = getMassRecursionProfile(segment.text);
    const library = getLibraryRecursionProfile(segment.text);

    if (battlefield) {
      addHit(
        hits,
        "battlefield_recursion",
        estimateRecursionWeight(
          effectiveManaValue,
          "battlefield_recursion",
          battlefield.weight,
          battlefield.repeatable,
        ),
        battlefield.reason,
      );
    }

    if (hand) {
      addHit(
        hits,
        "hand_recursion",
        estimateRecursionWeight(
          effectiveManaValue,
          "hand_recursion",
          hand.weight,
          hand.repeatable,
        ),
        hand.reason,
      );
    }

    if (replay) {
      addHit(
        hits,
        "replay_recursion",
        estimateRecursionWeight(
          effectiveManaValue,
          "replay_recursion",
          replay.weight,
          replay.repeatable,
        ),
        replay.reason,
      );
    }

    if (mass) {
      addHit(
        hits,
        "mass_recursion",
        estimateRecursionWeight(
          effectiveManaValue,
          "mass_recursion",
          mass.weight,
          mass.repeatable,
        ),
        mass.reason,
      );
    }

    if (library) {
      addHit(
        hits,
        "library_recursion",
        estimateRecursionWeight(
          effectiveManaValue,
          "library_recursion",
          library.weight,
          library.repeatable,
        ),
        library.reason,
      );
    }
  }

  const advancedProfile = hits.size === 0 ? inferAdvancedRoleProfile(card) : null;
  if (advancedProfile) {
    const mappings: Array<[RecursionTag, string]> = [
      ["battlefield_recursion", "battlefield_recursion"],
      ["hand_recursion", "hand_recursion"],
      ["replay_recursion", "replay_recursion"],
      ["mass_recursion", "mass_recursion"],
      ["library_recursion", "library_recursion"],
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
  hits: Map<RecursionTag, { weight: number; reasons: Set<string> }>,
  tag: RecursionTag,
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

function getBattlefieldRecursionProfile(text: string): RecursionProfile | null {
  if (hasMassLivingDeathStyle(text)) {
    return {
      weight: 1.12,
      reason: "Mass graveyard return brings resources back onto the battlefield.",
    };
  }

  if (hasGraveyardTokenCopy(text)) {
    return {
      weight: 0.9,
      reason: "Turns graveyard cards into battlefield presence through token copies.",
      repeatable: isRepeatableRecursion(text),
    };
  }

  if (hasBattlefieldRecursion(text)) {
    return {
      weight:
        /\bunder your control\b/.test(text) || /\bfrom a graveyard\b/.test(text) || /\bin a graveyard\b/.test(text)
          ? 1
          : 0.94,
      reason: "Returns a spent card directly to the battlefield.",
      repeatable: isRepeatableRecursion(text),
    };
  }

  return null;
}

function getHandRecursionProfile(text: string): RecursionProfile | null {
  if (!hasHandRecursion(text)) {
    return null;
  }

  return {
    weight: /\bany number of\b|\bup to (?:two|three|four|five|\d+)\b|\ball\b|\beach\b/.test(text)
      ? 0.9
      : 0.78,
    reason: "Recovers spent cards back to hand for another use.",
    repeatable: isRepeatableRecursion(text),
  };
}

function getReplayRecursionProfile(text: string): RecursionProfile | null {
  if (!hasReplayRecursion(text)) {
    return null;
  }

  return {
    weight:
      /\beach\b[^.]{0,80}\bnonland card\b[^.]{0,100}\bhas escape\b/.test(text) ||
      /\bduring each of your turns, you may\b/.test(text)
        ? 0.98
        : 0.88,
    reason: "Lets the deck cast or play resources again from the graveyard.",
    repeatable: isRepeatableRecursion(text),
  };
}

function getMassRecursionProfile(text: string): RecursionProfile | null {
  if (!hasMassRecursion(text)) {
    return null;
  }

  return {
    weight:
      /\beach player\b/.test(text) || /\ball\b[^.]{0,120}\bfrom (?:their|your|all) graveyards\b/.test(text)
        ? 1.02
        : 0.94,
    reason: "Returns multiple resources from the graveyard in one shot.",
  };
}

function getLibraryRecursionProfile(text: string): RecursionProfile | null {
  if (!hasLibraryRecursion(text)) {
    return null;
  }

  return {
    weight: /\bon top of your library\b/.test(text) ? 0.54 : 0.46,
    reason: "Recycles spent cards back into future draws.",
    repeatable: isRepeatableRecursion(text),
  };
}

function estimateRecursionWeight(
  cmc: number,
  tag: RecursionTag,
  base: number,
  repeatable = false,
) {
  const curvePoint =
    tag === "mass_recursion" ? 5
    : tag === "battlefield_recursion" ? 4
    : tag === "replay_recursion" ? 3
    : 3;
  const penaltyPerStep =
    tag === "mass_recursion" ? 0.04
    : tag === "battlefield_recursion" ? 0.045
    : tag === "replay_recursion" ? 0.05
    : 0.055;
  const stepsPastCurve = Math.max(cmc - curvePoint, 0);
  let factor = 1 - stepsPastCurve * penaltyPerStep;

  if (repeatable) {
    factor += 0.04;
  }

  return roundTo(base * clamp(factor, 0.72, 1.08), 2);
}

function recommendBattlefieldTarget(averageManaValue: number, colorProfile: CommanderColorProfile) {
  let target = 0;

  if (colorProfile.hasBlack) {
    target += 1;
  }

  if (colorProfile.hasWhite || colorProfile.hasGreen) {
    target += 0.5;
  }

  if (averageManaValue >= 3.4 && (colorProfile.hasBlack || colorProfile.hasWhite || colorProfile.hasGreen)) {
    target += 0.5;
  }

  return roundTo(clamp(target, 0, 2), 1);
}

function recommendReplayTarget(averageManaValue: number, colorProfile: CommanderColorProfile) {
  let target = 0;

  if (colorProfile.hasBlack || colorProfile.hasGreen) {
    target += 0.8;
  }

  if (colorProfile.hasBlue || colorProfile.hasRed) {
    target += 0.6;
  }

  if (averageManaValue >= 3.2 && !colorProfile.isColorless) {
    target += 0.3;
  }

  return roundTo(clamp(target, 0, 1.8), 1);
}

function recommendCoreTarget(
  averageManaValue: number,
  colorProfile: CommanderColorProfile,
  battlefieldTarget: number,
  replayTarget: number,
) {
  let target = 0.6;

  if (colorProfile.hasBlack || colorProfile.hasGreen || colorProfile.hasWhite) {
    target += 0.9;
  }

  if (colorProfile.hasBlue || colorProfile.hasRed) {
    target += 0.3;
  }

  if (colorProfile.colorCount >= 3 && (colorProfile.hasBlack || colorProfile.hasGreen || colorProfile.hasWhite)) {
    target += 0.4;
  }

  if (averageManaValue >= 3.4) {
    target += 0.3;
  }

  target += battlefieldTarget * 0.3 + replayTarget * 0.2;

  return clamp(target, colorProfile.isColorless ? 0.5 : 0.8, 3.8);
}

function assessRecursionCore(
  core: number,
  target: number,
  colorProfile: CommanderColorProfile,
) {
  if (core < target - 0.9) {
    return {
      code: "recursion_core_low",
      title: "Recursion package is light",
      status: "warning",
      message: `${core.toFixed(2)} effective recursion is below the target of ${target}. ${describeRecursionExpectations(colorProfile)}`,
    } as const;
  }

  if (core > target + 2.8) {
    return {
      code: "recursion_core_high",
      title: "Recursion package is dense",
      status: "note",
      message: `${core.toFixed(2)} effective recursion is above the target of ${target}. The deck should recover well from trades and sweepers, but some slots may be overly dedicated to recovery.`,
    } as const;
  }

  return {
    code: "recursion_core_fit",
    title: "Recursion package looks healthy",
    status: "good",
    message: `${core.toFixed(2)} effective recursion lines up well with the target of ${target}.`,
  } as const;
}

function assessBattlefieldRecursion(
  battlefield: number,
  mass: number,
  target: number,
  colorProfile: CommanderColorProfile,
) {
  const coverage = roundTo(battlefield + mass * 0.35, 2);

  if (target <= 0) {
    return {
      code: "battlefield_recursion_optional",
      title: "Battlefield recursion is optional here",
      status: coverage > 0 ? "good" : "note",
      message:
        coverage > 0
          ? `${coverage.toFixed(2)} battlefield recursion is a useful bonus for this color identity.`
          : "This color identity is not expected to rely on direct battlefield recursion.",
    } as const;
  }

  if (coverage < target - 0.5) {
    return {
      code: "battlefield_recursion_low",
      title: "Battlefield recursion is light",
      status: "note",
      message: `${coverage.toFixed(2)} battlefield recursion is below the target of ${target}. ${describeBattlefieldRecursionExpectations(colorProfile)}`,
    } as const;
  }

  return {
    code: "battlefield_recursion_fit",
    title: "Battlefield recursion looks healthy",
    status: "good",
    message: `${coverage.toFixed(2)} battlefield recursion is close to the target of ${target}.`,
  } as const;
}

function assessReplayRecursion(
  replay: number,
  library: number,
  target: number,
  colorProfile: CommanderColorProfile,
) {
  const coverage = roundTo(replay + library * 0.25, 2);

  if (target <= 0) {
    return {
      code: "replay_recursion_optional",
      title: "Graveyard replay is optional here",
      status: coverage > 0 ? "good" : "note",
      message:
        coverage > 0
          ? `${coverage.toFixed(2)} graveyard replay is a useful bonus for this color identity.`
          : "This color identity is not expected to rely on graveyard replay effects.",
    } as const;
  }

  if (coverage < target - 0.5) {
    return {
      code: "replay_recursion_low",
      title: "Graveyard replay is light",
      status: "note",
      message: `${coverage.toFixed(2)} graveyard replay is below the target of ${target}. ${describeReplayExpectations(colorProfile)}`,
    } as const;
  }

  return {
    code: "replay_recursion_fit",
    title: "Graveyard replay looks healthy",
    status: "good",
    message: `${coverage.toFixed(2)} graveyard replay is close to the target of ${target}.`,
  } as const;
}

function assessRecoveryUtility(hand: number, library: number, mass: number) {
  const utility = roundTo(hand + library + mass, 2);

  if (utility <= 0) {
    return {
      code: "recursion_utility_none",
      title: "Recovery utility is absent",
      status: "note",
      message: "The deck has little direct recovery to hand, library, or mass recursion support.",
    } as const;
  }

  if (utility >= 2.5) {
    return {
      code: "recursion_utility_dense",
      title: "Recovery utility is dense",
      status: "good",
      message: `${utility.toFixed(2)} recovery utility gives the shell several ways to reclaim spent resources.`,
    } as const;
  }

  return {
    code: "recursion_utility_present",
    title: "Recovery utility is present",
    status: "good",
    message: `${utility.toFixed(2)} recovery utility gives the deck some resilience after trades or wipes.`,
  } as const;
}

function scoreRecursion(input: {
  core: number;
  battlefield: number;
  hand: number;
  replay: number;
  mass: number;
  library: number;
  recommendations: {
    coreTarget: number;
    battlefieldTarget: number;
    replayTarget: number;
  };
}) {
  const battlefieldCoverage = roundTo(input.battlefield + input.mass * 0.35, 2);
  const replayCoverage = roundTo(input.replay + input.library * 0.25, 2);
  let score = 70;

  score += calculateTargetBonus(input.core, input.recommendations.coreTarget, 5);
  score += calculateTargetBonus(battlefieldCoverage, input.recommendations.battlefieldTarget, 3.5);
  score += calculateTargetBonus(replayCoverage, input.recommendations.replayTarget, 3);

  if (input.hand >= 1) {
    score += Math.min(input.hand - 1, 1.5);
  }

  score -= calculateUnderPenalty(input.core, input.recommendations.coreTarget, 5.8, 3.8);
  score -= calculateOverPenalty(input.core, input.recommendations.coreTarget, 2.8, 0.45);
  score -= calculateUnderPenalty(battlefieldCoverage, input.recommendations.battlefieldTarget, 2.6, 2.2);
  score -= calculateOverPenalty(battlefieldCoverage, input.recommendations.battlefieldTarget, 1.8, 0.35);
  score -= calculateUnderPenalty(replayCoverage, input.recommendations.replayTarget, 2.2, 2);
  score -= calculateOverPenalty(replayCoverage, input.recommendations.replayTarget, 1.6, 0.3);

  if (input.core < input.recommendations.coreTarget - 0.8 && input.hand < 0.5 && input.replay < 0.5) {
    score -= 2;
  }

  if (
    input.core <= 0 &&
    input.battlefield <= 0 &&
    input.hand <= 0 &&
    input.replay <= 0 &&
    input.mass <= 0 &&
    input.library <= 0
  ) {
    score -= 35;
  }

  return clamp(Math.round(score), 0, 100);
}

function summarizeRecursionScore(score: number) {
  if (score >= 86) {
    return "Recursion package is strong and well-rounded.";
  }

  if (score >= 72) {
    return "Recursion package is healthy, with a few tuning points.";
  }

  if (score >= 58) {
    return "Recursion package is playable, but uneven.";
  }

  return "Recursion package is underbuilt for long-game resilience.";
}

function describeRecursionExpectations(colorProfile: CommanderColorProfile) {
  if (colorProfile.hasBlack || colorProfile.hasGreen || colorProfile.hasWhite) {
    return "These colors usually support a few real recursion pieces, especially for creatures, permanents, or broad recovery.";
  }

  if (colorProfile.hasBlue || colorProfile.hasRed) {
    return "These colors usually lean more on replay effects, spell recovery, or selective graveyard value than on heavy reanimation.";
  }

  return "Colorless shells are not expected to lean heavily on recursion, but a little recovery still helps.";
}

function describeBattlefieldRecursionExpectations(colorProfile: CommanderColorProfile) {
  if (colorProfile.hasBlack || colorProfile.hasWhite || colorProfile.hasGreen) {
    return "These colors usually have access to at least some direct battlefield recovery.";
  }

  return "Direct battlefield recursion is not a core expectation here, but even one clean effect can improve resilience.";
}

function describeReplayExpectations(colorProfile: CommanderColorProfile) {
  if (colorProfile.hasBlue || colorProfile.hasRed) {
    return "These colors often express recursion as replay from the graveyard rather than classic reanimation.";
  }

  if (colorProfile.hasBlack || colorProfile.hasGreen) {
    return "These colors often support graveyard replay alongside traditional recursion.";
  }

  return "Graveyard replay is more optional here, but it still adds resilience if the deck can support it.";
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

function getRecursionSegments(card: ScryfallCard) {
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

function hasBattlefieldRecursion(text: string) {
  return (
    /\b(?:return|put)\b[^.]{0,220}\b(?:target|another target|up to one target|up to two target|up to three target|a|an)\b[^.]{0,160}\b(?:card|creature|permanent|artifact|enchantment|planeswalker|battle|land)\b[^.]{0,160}\b(?:from|in)\s+(?:your|a|any|that|their)\s+graveyard\b[^.]{0,180}\b(?:to|onto) the battlefield\b/.test(
      text,
    ) ||
    /\breturn\b[^.]{0,220}\bthis card\b[^.]{0,160}\bfrom your graveyard\b[^.]{0,180}\b(?:to|onto) the battlefield\b/.test(
      text,
    )
  );
}

function hasGraveyardTokenCopy(text: string) {
  return /\bcreate\b[^.]{0,120}\ba token that's a copy of\b[^.]{0,160}\bcard in (?:your|a|any) graveyard\b/.test(
    text,
  );
}

function hasHandRecursion(text: string) {
  return (
    /\b(?:return|put)\b[^.]{0,220}\b(?:target|another target|up to one target|up to two target|up to three target|any number of target|all)\b[^.]{0,180}\b(?:card|creature|permanent|artifact|enchantment|planeswalker|battle|land)\b[^.]{0,160}\b(?:from|in)\s+(?:your|a|any|that|their)\s+graveyard\b[^.]{0,180}\b(?:to|into)\s+your hand\b/.test(
      text,
    ) ||
    /\breturn\b[^.]{0,220}\bthis card\b[^.]{0,160}\bfrom your graveyard\b[^.]{0,180}\bto your hand\b/.test(
      text,
    )
  );
}

function hasReplayRecursion(text: string) {
  if (hasSelfContainedGraveyardCast(text)) {
    return false;
  }

  return (
    /\byou may\b[^.]{0,220}\b(?:play|cast)\b[^.]{0,160}\bfrom your graveyard\b/.test(text) ||
    /\bduring each of your turns, you may\b[^.]{0,220}\bfrom your graveyard\b/.test(text) ||
    /\bcards? in your graveyard (?:has|have)\s+escape\b/.test(text) ||
    /\btarget\b[^.]{0,120}\bcard in your graveyard\b[^.]{0,180}\bgains flashback\b/.test(text) ||
    /\b(?:each|every|instant|sorcery|nonland|creature|artifact|enchantment|permanent)[^.]{0,140}\bcards? in your graveyard\b[^.]{0,180}\bgains? flashback\b/.test(text)
  );
}

function hasSelfContainedGraveyardCast(text: string) {
  return (
    /\byou may cast this card from your graveyard\b/.test(text) ||
    (/\bflashback\b/.test(text) &&
      !/\btarget\b[^.]{0,120}\bcard in your graveyard\b[^.]{0,180}\bgains flashback\b/.test(
        text,
      ) &&
      !/\bcards? in your graveyard\b[^.]{0,180}\b(?:has|have|gains?) flashback\b/.test(text))
  );
}

function hasMassRecursion(text: string) {
  return (
    /\b(?:return|put)\b[^.]{0,80}\b(?:all|each|any number of|up to (?:two|three|four|five|\d+))\b[^.]{0,220}\b(?:from|in)\s+(?:your|a|any|their|all)\s+graveyard\b/.test(
      text,
    ) ||
    /\beach player\b[^.]{0,220}\b(?:returns?|puts?)\b[^.]{0,220}\bgraveyard\b/.test(text) ||
    hasMassLivingDeathStyle(text)
  );
}

function hasMassLivingDeathStyle(text: string) {
  return (
    /\beach player exiles all\b[^.]{0,180}\bfrom their graveyard\b[^.]{0,220}\bputs all cards they exiled this way onto the battlefield\b/.test(
      text,
    ) ||
    /\breturn all\b[^.]{0,180}\bfrom (?:your|all|their) graveyards\b[^.]{0,180}\bto the battlefield\b/.test(
      text,
    )
  );
}

function hasLibraryRecursion(text: string) {
  return (
    /\b(?:put|return)\b[^.]{0,220}\b(?:target|another target|up to one target|up to two target|up to three target|any number of target|all)\b[^.]{0,180}\b(?:card|cards|creature|permanent|artifact|enchantment|planeswalker|battle|land)\b[^.]{0,160}\b(?:from|in)\s+(?:your|a|any|that|their)\s+graveyard\b[^.]{0,220}\b(?:on top of|on the bottom of|into)\s+(?:your|its owner's|their owner's)\s+library\b/.test(
      text,
    ) ||
    /\bshuffle\b[^.]{0,220}\b(?:target|up to (?:two|three|four|five|\d+) target|any number of target|all)\b[^.]{0,180}\b(?:card|cards)\b[^.]{0,160}\bfrom your graveyard\b[^.]{0,180}\binto your library\b/.test(
      text,
    )
  );
}

function isRepeatableRecursion(text: string) {
  return (
    /\{[^}]+\}\s*:\s*/.test(text) ||
    /\bat the beginning of\b/.test(text) ||
    /\bwhenever\b/.test(text) ||
    /\bduring each of your turns\b/.test(text) ||
    /\bonce during each of your turns\b/.test(text)
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
