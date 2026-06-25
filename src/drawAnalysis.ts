import {
  DeckDrawAnalysis,
  DeckResolutionDocument,
  DrawTag,
  DrawTagHit,
  ResolvedDeckCard,
  ScryfallCard,
} from "./types";
import {
  getRoleReason,
  getRoleWeight,
  inferAdvancedRoleProfile,
} from "./advancedCardScan";
import { applyEffectQualityDiscount } from "./activationCost";
import { applyCommanderAvailabilityToDrawHits } from "./commanderAvailability";
import { CommanderColorProfile, getCommanderColorProfile } from "./commanderColorProfile";
import {
  createEffectiveManaValueContext,
  estimateEffectiveManaValue,
  sumEffectiveManaValue,
} from "./effectiveManaValue";

const NUMBER_WORDS = new Map<string, number>([
  ["a", 1],
  ["an", 1],
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
]);

export function analyzeDeckDraw(document: DeckResolutionDocument): DeckDrawAnalysis {
  const deckCards = document.result.resolvedCards.filter(
    (card) => card.section === "commander" || card.section === "mainboard",
  );
  const colorProfile = getCommanderColorProfile(deckCards);
  const effectiveManaContext = createEffectiveManaValueContext(deckCards);
  const nonlandCards = deckCards.filter((card) => !hasCardType(card.card, "Land"));
  const nonlandQuantity = sumQuantities(nonlandCards);
  const averageManaValue =
    nonlandQuantity === 0
      ? 0
      : sumEffectiveManaValue(nonlandCards, effectiveManaContext) / nonlandQuantity;

  const taggedCards = deckCards
    .map((card) => {
      const hits = applyCommanderAvailabilityToDrawHits(
        card.section,
        detectDrawHits(card.card, effectiveManaContext),
      );
      if (hits.length === 0) {
        return null;
      }

      return {
        name: card.card.name,
        quantity: card.quantity,
        section: card.section,
        drawValue: roundTo(totalTagWeight(hits), 2),
        hits,
      };
    })
    .filter((card): card is NonNullable<typeof card> => card !== null)
    .sort((left, right) => right.drawValue - left.drawValue || left.name.localeCompare(right.name));
  applyCommanderSupportedFaceDownDraw(taggedCards, deckCards);

  const counts = {
    draw: 0,
    selection: 0,
    repeatable: 0,
  };

  for (const card of taggedCards) {
    for (const hit of card.hits) {
      const amount = roundTo(hit.weight * card.quantity, 2);

      if (hit.tag === "card_draw") {
        counts.draw += amount;
      } else if (hit.tag === "card_selection") {
        counts.selection += amount;
      } else if (hit.tag === "repeatable_advantage") {
        counts.repeatable += amount;
      }
    }
  }

  counts.draw = roundTo(counts.draw, 2);
  counts.selection = roundTo(counts.selection, 2);
  counts.repeatable = roundTo(counts.repeatable, 2);

  const core = roundTo(counts.draw + counts.selection * getSelectionCoreFactor(colorProfile), 2);
  const recommendations = {
    drawTarget: recommendDrawTarget(averageManaValue, colorProfile),
    repeatableTarget: recommendRepeatableTarget(averageManaValue, colorProfile),
    coreTarget: recommendCoreDrawTarget(averageManaValue, colorProfile),
  };
  const findings = [
    assessCoreDraw(core, recommendations.coreTarget, colorProfile),
    assessDirectDraw(counts.draw, recommendations.drawTarget, counts.selection, colorProfile),
    assessRepeatableAdvantage(counts.repeatable, recommendations.repeatableTarget, colorProfile),
    assessSelectionSupport(counts.selection, counts.draw, colorProfile),
  ];
  const drawScore = scoreDraw({
    core,
    draw: counts.draw,
    selection: counts.selection,
    repeatable: counts.repeatable,
    recommendations,
    colorProfile,
  });

  return {
    drawScore,
    summary: summarizeDrawScore(drawScore),
    counts: {
      core,
      draw: counts.draw,
      selection: counts.selection,
      repeatable: counts.repeatable,
    },
    recommendations,
    findings,
    taggedCards,
  };
}

function detectDrawHits(
  card: ScryfallCard,
  effectiveManaContext: ReturnType<typeof createEffectiveManaValueContext>,
): DrawTagHit[] {
  const hits = new Map<DrawTag, { weight: number; reasons: Set<string> }>();
  const segments = getDrawSegments(card);
  const qualityText = segments.map((segment) => segment.text).join(" ");
  const effectiveManaValue = estimateEffectiveManaValue(card, effectiveManaContext);

  for (const segment of segments) {
    if (!segment.text) {
      continue;
    }

    const permanent = isPermanentType(segment.typeLine);
    const selfReplacingTopDraw = hasSelfReplacingTopDraw(segment.text);
    const directDraw = hasActualCardDraw(segment.text) && !selfReplacingTopDraw;
    const clueGeneration = hasClueGeneration(segment.text);
    const looting = isLootingPattern(segment.text);
    const wheelReset = isWheelResetPattern(segment.text);
    const selection = hasSelectionEffect(segment.text);
    const repeatableDraw = permanent && !selfReplacingTopDraw && hasRepeatableDraw(segment.text);
    const repeatableClueGeneration = permanent && hasRepeatableClueGeneration(segment.text);
    const repeatableSelection = permanent && !isPureFilteringSelection(segment.text) && hasRepeatableSelection(segment.text);
    const drawAmplifier = permanent && hasDrawAmplifier(segment.text);

    if (directDraw) {
      addHit(
        hits,
        "card_draw",
        estimateDirectDrawWeight(effectiveManaValue, segment.text, {
          looting,
          wheelReset,
          permanent,
        }),
        looting
          ? "Draws cards, but also discards as part of the effect."
          : "Provides direct card draw.",
      );
    }

    if (clueGeneration) {
      addHit(
        hits,
        "card_draw",
        estimateClueDrawWeight(effectiveManaValue, segment.text, {
          permanent,
          repeatableClueGeneration,
        }),
        "Creates Clue tokens that convert into delayed card draw.",
      );
    }

    if (selection) {
      addHit(
        hits,
        "card_selection",
        estimateSelectionWeight(effectiveManaValue, segment.text, {
          looting,
          permanent,
        }),
        "Filters, looks ahead, or accesses extra cards without clean raw draw.",
      );
    }

    if (repeatableDraw || repeatableSelection || repeatableClueGeneration || drawAmplifier) {
      addHit(
        hits,
        "repeatable_advantage",
        estimateRepeatableAdvantageWeight(effectiveManaValue, segment.text, {
          repeatableDraw,
          directDraw,
          selection,
          repeatableClueGeneration,
          drawAmplifier,
        }),
        repeatableDraw
          ? "Acts as a repeatable card-advantage engine."
          : repeatableClueGeneration
            ? "Can generate Clues repeatedly for ongoing card flow."
          : drawAmplifier
            ? "Amplifies future draw effects over time."
          : "Provides repeatable card selection over time.",
      );
    }
  }

  const advancedProfile = hits.size === 0 ? inferAdvancedRoleProfile(card) : null;
  if (advancedProfile) {
    const drawWeight = Math.max(
      getRoleWeight(advancedProfile, "direct_draw"),
      getRoleWeight(advancedProfile, "draw"),
    );
    const selectionWeight = getRoleWeight(advancedProfile, "selection");
    const repeatableWeight = Math.max(
      getRoleWeight(advancedProfile, "repeatable_advantage"),
      getRoleWeight(advancedProfile, "repeatable_draw"),
    );

    if (drawWeight > 0) {
      addHit(
        hits,
        "card_draw",
        drawWeight,
        getRoleReason(advancedProfile, "direct_draw") || getRoleReason(advancedProfile, "draw"),
      );
    }

    if (selectionWeight > 0) {
      addHit(
        hits,
        "card_selection",
        selectionWeight,
        getRoleReason(advancedProfile, "selection"),
      );
    }

    if (repeatableWeight > 0) {
      addHit(
        hits,
        "repeatable_advantage",
        repeatableWeight,
        getRoleReason(advancedProfile, "repeatable_advantage") ||
          getRoleReason(advancedProfile, "repeatable_draw"),
      );
    }
  }

  return [...hits.entries()].map(([tag, value]) => ({
    tag,
    weight: roundTo(applyEffectQualityDiscount(value.weight, qualityText), 2),
    reason: [...value.reasons].join(" "),
  }));
}

function addHit(
  hits: Map<DrawTag, { weight: number; reasons: Set<string> }>,
  tag: DrawTag,
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

function applyCommanderSupportedFaceDownDraw(
  taggedCards: Array<{
    name: string;
    quantity: number;
    section: ResolvedDeckCard["section"];
    drawValue: number;
    hits: DrawTagHit[];
  }>,
  deckCards: ResolvedDeckCard[],
) {
  const commander = deckCards.find(
    (card) => card.section === "commander" && hasFaceDownDrawTrigger(card.card),
  );

  if (!commander) {
    return;
  }

  const faceDownSupport = deckCards
    .filter((card) => card.section === "mainboard" && hasFaceDownSupport(card.card))
    .reduce((sum, card) => sum + card.quantity, 0);

  if (faceDownSupport < 6) {
    return;
  }

  const commanderEntry = taggedCards.find(
    (card) => card.section === "commander" && card.name === commander.card.name,
  );

  if (!commanderEntry) {
    return;
  }

  const drawWeight = roundTo(clamp(faceDownSupport / 8, 1.2, 4.8), 2);
  const repeatableWeight = roundTo(clamp(faceDownSupport / 12, 0.8, 3.2), 2);
  const reason = `${faceDownSupport} face-down cards turn the commander's enter-trigger into a reliable card-flow engine.`;

  commanderEntry.hits.push(
    {
      tag: "card_draw",
      weight: drawWeight,
      reason,
    },
    {
      tag: "repeatable_advantage",
      weight: repeatableWeight,
      reason,
    },
  );
  commanderEntry.drawValue = roundTo(commanderEntry.drawValue + drawWeight + repeatableWeight, 2);
}

function hasFaceDownDrawTrigger(card: ScryfallCard) {
  return getDrawSegments(card).some((segment) =>
    /\bwhenever\b[\s\S]{0,80}\bface[- ]down creature\b[\s\S]{0,100}\benters\b[\s\S]{0,80}\bdraw a card\b/.test(
      segment.text,
    ),
  );
}

function hasFaceDownSupport(card: ScryfallCard) {
  if (
    card.keywords.some((keyword) =>
      ["Morph", "Megamorph", "Manifest", "Manifest Dread", "Cloak", "Disguise"].includes(
        keyword,
      ),
    )
  ) {
    return true;
  }

  return getDrawSegments(card).some((segment) =>
    /\bface[- ]down\b|\bface up\b|\bturned face up\b|\bmorph\b|\bmegamorph\b|\bmanifest(?: dread)?\b|\bcloak\b|\bdisguise\b/.test(
      segment.text,
    ),
  );
}

function assessCoreDraw(core: number, target: number, colorProfile: CommanderColorProfile) {
  if (core < target - 2) {
    return {
      code: "draw_core_low",
      title: "Card flow package is low",
      status: "risk",
      message: `${core.toFixed(2)} effective card flow is well below the baseline target of ${target}. ${describeCardFlowExpectations(colorProfile)}`,
    } as const;
  }

  if (core < target) {
    return {
      code: "draw_core_light",
      title: "Card flow package is a little light",
      status: "warning",
      message: `${core.toFixed(2)} effective card flow is slightly below the target of ${target}. ${describeCardFlowExpectations(colorProfile)}`,
    } as const;
  }

  if (core > target + 4) {
    return {
      code: "draw_core_high",
      title: "Card flow package is dense",
      status: "note",
      message: `${core.toFixed(2)} effective card flow is above the target of ${target}. The deck should keep resources moving, but some slots may be overly dedicated to draw.`,
    } as const;
  }

  return {
    code: "draw_core_fit",
    title: "Card flow package looks healthy",
    status: "good",
    message: `${core.toFixed(2)} effective card flow lines up well with the target of ${target}.`,
  } as const;
}

function assessDirectDraw(
  draw: number,
  target: number,
  selection: number,
  colorProfile: CommanderColorProfile,
) {
  const effectiveDraw = roundTo(draw + selection * getSelectionCoverageFactor(colorProfile), 2);

  if (draw < 0.35 && effectiveDraw >= target) {
    return {
      code: "direct_draw_supported_by_selection",
      title: "Raw draw is light, but coverage is acceptable",
      status: "note",
      message: `The deck has very little true raw draw, but selection and access effects lift the effective coverage to ${effectiveDraw.toFixed(2)} against a target of ${target}.`,
    } as const;
  }

  if (effectiveDraw < target - 1.5) {
    return {
      code: "direct_draw_low",
      title: "Raw card draw is too low",
      status: "warning",
      message: `${draw.toFixed(2)} raw draw is below the target of ${target}.${colorProfile.hasRed || colorProfile.hasWhite ? ` Selection helps more in these colors, but the effective coverage still lands at ${effectiveDraw.toFixed(2)}.` : " Filtering alone usually does not replace real draw."}`,
    } as const;
  }

  if (effectiveDraw > target + 4) {
    return {
      code: "direct_draw_high",
      title: "Raw card draw is very dense",
      status: "note",
      message: `${effectiveDraw.toFixed(2)} effective raw draw coverage is comfortably above the target of ${target}. The deck should refuel often.`,
    } as const;
  }

  return {
    code: "direct_draw_fit",
    title: "Raw card draw is on pace",
    status: "good",
    message:
      draw >= target
        ? `${draw.toFixed(2)} direct draw is close to the target of ${target}.`
        : `${draw.toFixed(2)} raw draw plus selection support reaches ${effectiveDraw.toFixed(2)} effective coverage against a target of ${target}.`,
  } as const;
}

function assessRepeatableAdvantage(
  repeatable: number,
  target: number,
  colorProfile: CommanderColorProfile,
) {
  if (repeatable < target - 0.8) {
    return {
      code: "repeatable_advantage_low",
      title: "Repeatable advantage is light",
      status: "warning",
      message: `${repeatable.toFixed(2)} repeatable advantage is below the target of ${target}. ${describeRepeatableExpectations(colorProfile)}`,
    } as const;
  }

  if (repeatable > target + 2.5) {
    return {
      code: "repeatable_advantage_high",
      title: "Repeatable advantage is very dense",
      status: "note",
      message: `${repeatable.toFixed(2)} repeatable advantage is well above the target of ${target}. The deck has many long-game engines.`,
    } as const;
  }

  return {
    code: "repeatable_advantage_fit",
    title: "Repeatable advantage looks healthy",
    status: "good",
    message: `${repeatable.toFixed(2)} repeatable advantage is near the target of ${target}.`,
  } as const;
}

function assessSelectionSupport(
  selection: number,
  draw: number,
  colorProfile: CommanderColorProfile,
) {
  if (selection < 0.75) {
    return {
      code: "selection_light",
      title: "Selection support is light",
      status: "note",
      message: "The deck has very little filtering or impulse access. That can be fine if the raw draw package is strong.",
    } as const;
  }

  if (selection > draw + 2) {
    return {
      code: "selection_heavy",
      title: "Selection outweighs real draw",
      status: "warning",
      message: `${selection.toFixed(2)} selection support is much heavier than the direct draw package.${colorProfile.hasRed || colorProfile.hasWhite ? " That is more acceptable in these colors, but the deck still wants enough real resource gain." : " The deck may see cards, but still fail to gain enough real resources."}`,
    } as const;
  }

  return {
    code: "selection_fit",
    title: "Selection support is useful",
    status: "good",
    message: `${selection.toFixed(2)} selection support helps smooth draws and improve card access.`,
  } as const;
}

function scoreDraw(input: {
  core: number;
  draw: number;
  selection: number;
  repeatable: number;
  recommendations: {
    coreTarget: number;
    drawTarget: number;
    repeatableTarget: number;
  };
  colorProfile: CommanderColorProfile;
}) {
  let score = 72;
  const repeatableSurplus = Math.max(
    0,
    input.repeatable - input.recommendations.repeatableTarget,
  );
  const repeatableDrawBackfill = Math.min(repeatableSurplus * 0.45, 2.5);
  const repeatableCoreBackfill = Math.min(repeatableSurplus * 0.35, 2);
  const effectiveDraw = roundTo(
    input.draw +
      input.selection * getSelectionCoverageFactor(input.colorProfile) +
      repeatableDrawBackfill,
    2,
  );
  const effectiveCore = roundTo(
    input.core + repeatableCoreBackfill,
    2,
  );
  const drawShortfall = Math.max(input.recommendations.drawTarget - effectiveDraw, 0);
  const coreBonusScale =
    drawShortfall > 2 ? 0.45
    : drawShortfall > 1 ? 0.75
    : 1;

  score += calculateTargetBonus(effectiveCore, input.recommendations.coreTarget, 4) * coreBonusScale;
  score += calculateTargetBonus(effectiveDraw, input.recommendations.drawTarget, 3);
  score += calculateTargetBonus(input.repeatable, input.recommendations.repeatableTarget, 1);

  score -= calculateUnderPenalty(effectiveCore, input.recommendations.coreTarget, 4.5, 2.8);
  score -= calculateOverPenalty(effectiveCore, input.recommendations.coreTarget, 3, 1.1);

  score -= calculateUnderPenalty(effectiveDraw, input.recommendations.drawTarget, 4.5, 2.6);
  score -= calculateOverPenalty(effectiveDraw, input.recommendations.drawTarget, 3, 1.05);

  score -= calculateUnderPenalty(input.repeatable, input.recommendations.repeatableTarget, 2, 1.5);
  score -= Math.min(
    calculateOverPenalty(input.repeatable, input.recommendations.repeatableTarget, 1.5, 1.25),
    4,
  );

  if (input.selection > input.draw + 2.5 && !(input.colorProfile.hasRed || input.colorProfile.hasWhite)) {
    score -= 1.5;
  }

  if (effectiveDraw < input.recommendations.drawTarget - 1 && input.selection >= 1.75) {
    score -= 1;
  }

  if (effectiveDraw < input.recommendations.drawTarget - 2) {
    score -= 1;
  }

  if (input.repeatable > input.recommendations.repeatableTarget + 3.5) {
    score -= 2;
  }

  if (input.repeatable > input.recommendations.repeatableTarget + 1) {
    score += Math.min(input.repeatable - input.recommendations.repeatableTarget - 1, 2.5) * 0.8;
  }

  const coreOnPace =
    effectiveCore >= input.recommendations.coreTarget - 0.75 &&
    effectiveCore <= input.recommendations.coreTarget + 2;
  const drawOnPace =
    effectiveDraw >= input.recommendations.drawTarget - 0.85 &&
    effectiveDraw <= input.recommendations.drawTarget + 2;
  const repeatableOnPace =
    input.repeatable >= input.recommendations.repeatableTarget - 0.35 &&
    input.repeatable <= input.recommendations.repeatableTarget + 1.5;

  if (coreOnPace && drawOnPace) {
    score += 3;
  }

  if (coreOnPace && drawOnPace && repeatableOnPace) {
    score += 1;
  }

  const roundedScore = Math.round(score);
  const minimumScore = input.core > 0 || input.draw > 0 || input.repeatable > 0 || input.selection > 0 ? 1 : 0;
  return clamp(Math.max(roundedScore, minimumScore), 0, 100);
}

function summarizeDrawScore(score: number) {
  if (score >= 86) {
    return "Card flow package is strong and resilient.";
  }

  if (score >= 72) {
    return "Card flow package is healthy, with a few tuning points.";
  }

  if (score >= 58) {
    return "Card flow package is playable, but uneven.";
  }

  return "Card flow package is underbuilt for longer games.";
}

function getSelectionCoreFactor(colorProfile: CommanderColorProfile) {
  if (colorProfile.hasBlue) {
    return 0.2;
  }

  if (colorProfile.hasBlack) {
    return 0.24;
  }

  if (colorProfile.hasRed || colorProfile.hasWhite) {
    return 0.35;
  }

  return 0.25;
}

function getSelectionCoverageFactor(colorProfile: CommanderColorProfile) {
  if (colorProfile.hasBlue) {
    return 0.18;
  }

  if (colorProfile.hasBlack) {
    return 0.26;
  }

  if (colorProfile.hasRed || colorProfile.hasWhite) {
    return 0.42;
  }

  return 0.28;
}

function describeCardFlowExpectations(colorProfile: CommanderColorProfile) {
  if (colorProfile.hasBlue || colorProfile.hasBlack) {
    return "These colors usually have access to stronger raw card-advantage tools, so the shortfall matters more.";
  }

  if (colorProfile.hasRed || colorProfile.hasWhite) {
    return "These colors often patch card flow through impulse access, clues, or engines instead of pure draw spells.";
  }

  return "The deck may run out of resources too quickly if the card-flow package stays this light.";
}

function describeRepeatableExpectations(colorProfile: CommanderColorProfile) {
  if (colorProfile.hasBlue || colorProfile.hasBlack || colorProfile.hasGreen) {
    return "The deck may need to rely too much on one-shot refills for colors that usually support longer-game engines well.";
  }

  if (colorProfile.hasRed || colorProfile.hasWhite) {
    return "That can be fine in faster shells, but the deck may still run out of momentum in longer games.";
  }

  return "The deck may need to rely too much on one-shot refills.";
}

function calculateTargetBonus(actual: number, target: number, maxBonus: number) {
  if (actual >= target) {
    const diff = actual - target;

    if (diff <= 0.75) {
      return maxBonus;
    }

    if (diff <= 1.5) {
      return maxBonus * 0.75;
    }

    if (diff <= 2.5) {
      return maxBonus * 0.4;
    }

    return 0;
  }

  const shortfall = target - actual;

  if (shortfall <= 0.35) {
    return maxBonus * 0.85;
  }

  if (shortfall <= 0.75) {
    return maxBonus * 0.5;
  }

  if (shortfall <= 1.25) {
    return maxBonus * 0.2;
  }

  return 0;
}

function calculateUnderPenalty(actual: number, target: number, basePenalty: number, rate: number) {
  if (actual >= target) {
    return 0;
  }

  const shortfall = target - actual;
  let penalty = basePenalty + shortfall * rate;

  if (shortfall > 1.25) {
    penalty += (shortfall - 1.25) * rate * 0.45;
  }

  if (shortfall > 2.5) {
    penalty += (shortfall - 2.5) * rate * 0.25;
  }

  return penalty;
}

function calculateOverPenalty(actual: number, target: number, grace: number, rate: number) {
  if (actual <= target + grace) {
    return 0;
  }

  return (actual - target - grace) * rate;
}

function recommendDrawTarget(averageManaValue: number, colorProfile: CommanderColorProfile) {
  let target = 9;

  if (averageManaValue >= 2.8) {
    target += 1;
  }

  if (averageManaValue >= 3.2) {
    target += 1;
  }

  if (averageManaValue >= 3.6) {
    target += 1;
  }

  if (averageManaValue <= 2.2) {
    target -= 1;
  }

  if (colorProfile.hasBlue) {
    target += 1;
  } else if ((colorProfile.hasRed || colorProfile.hasWhite) && !colorProfile.hasGreen) {
    target -= 1;
  }

  if ((colorProfile.hasRed || colorProfile.hasWhite) && colorProfile.isMonoColor) {
    target -= 1;
  }

  return clamp(target, 6, 12);
}

function recommendRepeatableTarget(
  averageManaValue: number,
  colorProfile: CommanderColorProfile,
) {
  let target = 2;

  if (averageManaValue >= 3.1) {
    target += 1;
  }

  if (averageManaValue >= 3.7) {
    target += 1;
  }

  if (colorProfile.hasBlue || colorProfile.hasBlack || colorProfile.hasGreen) {
    target += 1;
  } else if (colorProfile.hasRed && !colorProfile.hasBlue && !colorProfile.hasBlack) {
    target -= 1;
  }

  return clamp(target, 1, 4);
}

function recommendCoreDrawTarget(
  averageManaValue: number,
  colorProfile: CommanderColorProfile,
) {
  return clamp(
    recommendDrawTarget(averageManaValue, colorProfile) + (colorProfile.hasBlue ? 1 : 0),
    7,
    12,
  );
}

function estimateDirectDrawWeight(
  cmc: number,
  text: string,
  options: {
    looting: boolean;
    wheelReset: boolean;
    permanent: boolean;
  },
) {
  const drawAmount = estimateDrawAmount(text);
  let base =
    drawAmount >= 4 ? 1.35
    : drawAmount >= 3 ? 1.15
    : drawAmount >= 2 ? 0.95
    : 0.62;

  if (/\beach player draws\b/.test(text)) {
    base -= 0.12;
  }

  if (options.looting) {
    base *= 0.55;
  } else if (options.wheelReset) {
    base *= 0.8;
  }

  if (options.permanent && hasRepeatableDraw(text)) {
    base += 0.08;
  }

  return applyCardFlowEfficiency(base, cmc, "card_draw");
}

function estimateSelectionWeight(
  cmc: number,
  text: string,
  options: {
    looting: boolean;
    permanent: boolean;
  },
) {
  let base =
    hasTopLibraryAccess(text) ? 0.82
    : hasContinuousCardAccess(text) ? 0.8
    : hasRecursionEffect(text) ? 0.68
    : hasSpellCopyAccess(text) ? 0.64
    : hasImpulseSelection(text) ? 0.72
    : hasLibrarySelection(text) ? 0.6
    : options.looting ? 0.48
    : 0.3;

  if (options.permanent && hasRepeatableSelection(text)) {
    base += 0.1;
  }

  if (/\bconnive\b/.test(text) || /\bsurveil\b/.test(text)) {
    base += 0.05;
  }

  return applyCardFlowEfficiency(base, cmc, "card_selection");
}

function estimateRepeatableAdvantageWeight(
  cmc: number,
  text: string,
  options: {
    repeatableDraw: boolean;
    directDraw: boolean;
    selection: boolean;
    repeatableClueGeneration: boolean;
    drawAmplifier: boolean;
  },
) {
  const drawAmount = estimateDrawAmount(text);
  let base =
    options.repeatableDraw && drawAmount >= 2 ? 1.2
    : options.repeatableDraw ? 1
    : options.drawAmplifier ? 0.92
    : options.repeatableClueGeneration ? 0.74
    : 0.82;

  if (/\bat the beginning of\b/.test(text)) {
    base += 0.05;
  }

  if (/\{t\}[^:]*:\s*draw\b/.test(text)) {
    base -= 0.04;
  }

  if (!options.directDraw && options.selection) {
    base -= 0.08;
  }

  return applyCardFlowEfficiency(base, cmc, "repeatable_advantage");
}

function estimateClueDrawWeight(
  cmc: number,
  text: string,
  options: {
    permanent: boolean;
    repeatableClueGeneration: boolean;
  },
) {
  const clueAmount = estimateClueAmount(text);
  let base =
    clueAmount >= 3 ? 0.86
    : clueAmount >= 2 ? 0.68
    : 0.48;

  if (options.repeatableClueGeneration) {
    base += 0.08;
  } else if (options.permanent) {
    base += 0.03;
  }

  return applyCardFlowEfficiency(base, cmc + 1, "card_draw");
}

function applyCardFlowEfficiency(base: number, cmc: number, tag: DrawTag) {
  const freeManaValue =
    tag === "card_selection" ? 1.5
    : tag === "card_draw" ? 2
    : 3;
  const stepsPastCurve = Math.max(cmc - freeManaValue, 0);
  const penaltyPerStep =
    tag === "card_selection" ? 0.05
    : tag === "card_draw" ? 0.055
    : 0.06;
  let factor = 1 - stepsPastCurve * penaltyPerStep;

  if (base >= 1.2) {
    factor += 0.04;
  } else if (base >= 0.95) {
    factor += 0.02;
  }

  return roundTo(base * clamp(factor, 0.68, 1.08), 2);
}

function hasActualCardDraw(text: string) {
  return splitIntoSentences(text).some((sentence) => isActualDrawSentence(sentence));
}

function hasSelectionEffect(text: string) {
  return (
    isLootingPattern(text) ||
    hasTopLibraryFiltering(text) ||
    hasTopLibraryAccess(text) ||
    hasContinuousCardAccess(text) ||
    hasTemporaryCardAccess(text) ||
    hasRecursionEffect(text) ||
    hasSpellCopyAccess(text) ||
    hasImpulseSelection(text) ||
    hasLibrarySelection(text) ||
    /\bscry\b/.test(text) ||
    /\bsurveil\b/.test(text) ||
    /\bconnive\b/.test(text) ||
    /\bdiscover\b/.test(text) ||
    /\bcascade\b/.test(text)
  );
}

function hasClueGeneration(text: string) {
  return (
    /\binvestigate\b/.test(text) ||
    /\bcreate(?:s)?\b[^.]*\bclue tokens?\b/.test(text) ||
    /\bcreate(?:s)?\b[^.]*\bclues\b/.test(text)
  );
}

function hasImpulseSelection(text: string) {
  return (
    /\bexile the top\b[\s\S]{0,160}\byou may (?:play|cast)\b/.test(text) ||
    /\buntil end of turn, you may cast\b/.test(text) ||
    /\buntil end of turn, you may play\b/.test(text) ||
    /\buntil the end of your next turn, you may cast\b/.test(text) ||
    /\buntil the end of your next turn, you may play\b/.test(text)
  );
}

function hasLibrarySelection(text: string) {
  return (
    /\blook at the top\b[\s\S]{0,140}\bput\b[\s\S]{0,140}\binto your hand\b/.test(text) ||
    /\breveal the top\b[\s\S]{0,140}\bput\b[\s\S]{0,140}\binto your hand\b/.test(text) ||
    /\blook at\b[\s\S]{0,140}cards? of your library\b[\s\S]{0,140}\bput\b[\s\S]{0,140}\binto your hand\b/.test(text) ||
    /\bmill\b[^.]*\breturn\b[^.]*\bto your hand\b/.test(text) ||
    /\bmills?\b[\s\S]{0,180}\bput\b[\s\S]{0,140}\bfrom among (?:them|those cards|the milled cards|the cards milled this way|cards milled this way)\b[\s\S]{0,140}\binto your hand\b/.test(
      text,
    ) ||
    /\bput\b[\s\S]{0,140}\bfrom among (?:them|those cards|the milled cards|the cards milled this way|cards milled this way)\b[\s\S]{0,140}\binto your hand\b/.test(
      text,
    ) ||
    /\b(?:look at|reveal|mill)\b[\s\S]{0,180}\bput\b[\s\S]{0,140}\bfrom among (?:them|those cards|the revealed cards|the cards revealed this way|the milled cards|the cards milled this way|cards milled this way)\b[\s\S]{0,140}\bonto the battlefield\b/.test(
      text,
    )
  );
}

function hasTopLibraryFiltering(text: string) {
  return (
    /\blook at the top (?:x|\d+|one|two|three|four|five|six|seven|a|an) cards? of your library\b[\s\S]{0,180}\bput (?:them|those cards|the rest|any number of them|that card|it)\b[\s\S]{0,120}\b(?:back|on top|on the bottom|into your graveyard)\b/.test(
      text,
    ) ||
    /\brearrange\b[\s\S]{0,120}\btop (?:x|\d+|one|two|three|four|five|six|seven|a|an) cards? of your library\b/.test(
      text,
    )
  );
}

function hasTopLibraryAccess(text: string) {
  return (
    /\byou may cast(?: [^.]*?)? from the top of your library\b/.test(text) ||
    /\byou may play lands? from the top of your library\b/.test(text) ||
    /\byou may play lands and cast spells from the top of your library\b/.test(text) ||
    /\byou may play cards? from the top of your library\b/.test(text) ||
    /\byou may (?:play|cast) the top card of [^.]*opponent's library\b/.test(text)
  );
}

function hasContinuousCardAccess(text: string) {
  if (hasSelfContainedGraveyardCast(text)) {
    return false;
  }

  return (
    /\bduring each of your turns, you may (?:play|cast)\b/.test(text) ||
    /\bonce during each of your turns, you may (?:play|cast)\b/.test(text) ||
    /\byou may cast(?: [^.]*?)? from your graveyard\b/.test(text) ||
    /\byou may cast(?: [^.]*?)? from a graveyard\b/.test(text) ||
    /\byou may cast(?: [^.]*?)? from exile\b/.test(text) ||
    /\byou may play lands? from your graveyard\b/.test(text) ||
    /\byou may play lands? from exile\b/.test(text) ||
    /\byou may play(?: [^.]*?)? from your graveyard\b/.test(text) ||
    /\byou may play(?: [^.]*?)? from exile\b/.test(text) ||
    /\byou may cast(?: [^.]*?)? from among cards?[^.]*\b(?:in exile|in your graveyard|your graveyard|the top of your library)\b/.test(text) ||
    /\byou may play lands and cast spells from among cards?[^.]*\b(?:in exile|in your graveyard|your graveyard|the top of your library)\b/.test(text) ||
    /\byou may play(?: [^.]*?)? from among cards?[^.]*\b(?:in exile|in your graveyard|your graveyard|the top of your library)\b/.test(text) ||
    /\byou may (?:play|cast)(?: [^.]*?)? from among cards?[^.]*\bexiled with\b/.test(text) ||
    /\byou may (?:play|cast)(?: [^.]*?)? from among cards? exiled with\b/.test(text) ||
    /\byou may (?:play|cast)(?: [^.]*?)? from exile with\b/.test(text) ||
    /\b(?:each|every) [^.]* card in your graveyard has flashback\b/.test(text) ||
    /\b(?:each|every) [^.]* card in your graveyard has escape\b/.test(text) ||
    hasTopLibraryAccess(text)
  );
}

function hasStoredExileAccess(text: string) {
  return (
    /\bfor as long as [^.]* remains exiled[\s\S]{0,160}\byou may (?:look at (?:it|them)[^.]*\byou may )?(?:play|cast)\b/.test(text) ||
    /\byou may look at (?:it|them) as long as [^.]* remains exiled[\s\S]{0,160}\byou may (?:play|cast)\b/.test(text) ||
    /\byou may (?:look at and )?(?:play|cast) (?:that card|those cards|it|them)\b[\s\S]{0,120}\bfor as long as [^.]* remains exiled\b/.test(text) ||
    /\byou may cast [^.]* from among (?:them|those cards|the cards exiled this way|the nonland cards exiled this way)\b/.test(text) ||
    /\byou may play [^.]* from among (?:them|those cards|the cards exiled this way|the nonland cards exiled this way)\b/.test(text)
  );
}

function hasTemporaryCardAccess(text: string) {
  return (
    hasStoredExileAccess(text) ||
    /\btarget [^.]* card in your graveyard gains flashback\b/.test(text) ||
    (!hasSelfContainedGraveyardCast(text) &&
      (/\byou may cast target [^.]* card from a graveyard this turn\b/.test(text) ||
        /\byou may cast target [^.]* card from your graveyard this turn\b/.test(text))) ||
    /\byou may (?:play|cast) (?:that card|those cards|it|them) this turn\b/.test(text) ||
    /\byou may (?:play|cast) (?:that card|those cards|it|them) until end of turn\b/.test(text) ||
    /\byou may (?:play|cast) (?:that card|those cards|it|them) until the end of your next turn\b/.test(text) ||
    /\byou may cast that spell\b/.test(text) ||
    /\byou may cast the copy\b/.test(text) ||
    /\byou may cast the copies\b/.test(text)
  );
}

function hasRecursionEffect(text: string) {
  return (
    /\breturn\b[\s\S]{0,160}\bfrom your graveyard to your hand\b/.test(text) ||
    /\breturn\b[\s\S]{0,160}\bfrom your graveyard to the battlefield\b/.test(text) ||
    /\b(?:target|choose target) [^.]* card in your graveyard\b[\s\S]{0,120}\breturn it to your hand\b/.test(text) ||
    /\b(?:target|choose target) [^.]* card in your graveyard\b[\s\S]{0,120}\breturn it to the battlefield\b/.test(text) ||
    /\bput\b[\s\S]{0,160}\bfrom your graveyard onto the battlefield\b/.test(text) ||
    /\bput\b[\s\S]{0,160}\bfrom your graveyard into your hand\b/.test(text)
  );
}

function hasSpellCopyAccess(text: string) {
  return (
    /\bcopy\b[\s\S]{0,120}\byou may cast the copy\b/.test(text) ||
    /\bcopy\b[\s\S]{0,120}\byou may cast the copies\b/.test(text) ||
    /\byou may cast any number of [^.]* from among (?:them|those cards)\b/.test(text)
  );
}

function isLootingPattern(text: string) {
  return (
    /\bdraw(?:s)?\s+(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x|that many)\s+cards?\b[^.]*\bthen discard\b/.test(text) ||
    /\bdiscard (?!your hand\b)[^.]*\bthen draw(?:s)?\s+(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x|that many)\s+cards?\b/.test(text)
  );
}

function isWheelResetPattern(text: string) {
  return /\bdiscard your hand\b[^.]*\bdraw(?:s)?\s+(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x|that many)\s+cards?\b/.test(text);
}

function hasRepeatableDraw(text: string) {
  const activatedDrawPattern =
    /\{[^}]+\}[^:]*:\s*[^.]*\bdraw(?:s)?\b/.test(text) ||
    /\bpay\b[^.]*:\s*[^.]*\bdraw(?:s)?\b/.test(text) ||
    /(?:^|[ .])[\+\-−]\d+:\s*[^.]*\bdraw(?:s)?\b/.test(text);
  const triggeredDrawPattern =
    /\b(?:whenever|at the beginning of)\b[\s\S]{0,180}\bdraw(?:s)?\b/.test(text) &&
    hasActualCardDraw(text);

  if (
    hasDrawAmplifier(text) ||
    activatedDrawPattern ||
    triggeredDrawPattern
  ) {
    if (
      !/\bwhen [^.]* enters(?: the battlefield)?\b[\s\S]{0,160}\bdraw(?:s)?\b/.test(text) &&
      !/\bwhen [^.]* dies\b[\s\S]{0,160}\bdraw(?:s)?\b/.test(text)
    ) {
      return true;
    }
  }

  const sentences = splitIntoSentences(text);

  return sentences.some((sentence) => {
    if (!hasActualCardDraw(sentence)) {
      return false;
    }

    if (/\bwhen [^.]* enters(?: the battlefield)?\b/.test(sentence) || /\bwhen [^.]* dies\b/.test(sentence)) {
      return false;
    }

    return (
      /\{t\}[^:]*:\s*draw\b/.test(sentence) ||
      /\bat the beginning of\b/.test(sentence) ||
      /\bwhenever\b/.test(sentence)
    );
  });
}

function hasDrawAmplifier(text: string) {
  return (
    /\bif you would draw a card\b[\s\S]{0,180}\bdraw(?:s)?\s+(?:an additional|a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x|that many)\s+cards?\s+instead\b/.test(text) ||
    /\bif you would draw\b[\s\S]{0,180}\bdraw(?:s)?\s+that many cards?\s+plus\b/.test(text) ||
    /\bdraw an additional card\b/.test(text)
  );
}

function hasRepeatableSelection(text: string) {
  if (isPureFilteringSelection(text)) {
    return false;
  }

  if (
    /\bat the beginning of\b[\s\S]{0,140}\bexile the top\b[\s\S]{0,140}\byou may (?:play|cast)\b/.test(text) ||
    /\bwhenever\b[\s\S]{0,140}\bexile the top\b[\s\S]{0,140}\byou may (?:play|cast)\b/.test(text) ||
    hasTopLibraryAccess(text) ||
    /\bduring each of your turns, you may (?:play|cast)\b/.test(text)
  ) {
    return true;
  }

  const sentences = splitIntoSentences(text);

  return sentences.some((sentence) => {
    if (!hasSelectionEffect(sentence)) {
      return false;
    }

    if (/\bwhen [^.]* enters(?: the battlefield)?\b/.test(sentence) || /\bwhen [^.]* dies\b/.test(sentence)) {
      return false;
    }

    return (
      hasContinuousCardAccess(sentence) ||
      hasRecursionEffect(sentence) ||
      /\{t\}[^:]*:/.test(sentence) ||
      /\bat the beginning of\b/.test(sentence) ||
      /\bwhenever\b/.test(sentence)
    );
  });
}

function isPureFilteringSelection(text: string) {
  return (
    hasTopLibraryFiltering(text) &&
    !hasTopLibraryAccess(text) &&
    !hasContinuousCardAccess(text) &&
    !hasTemporaryCardAccess(text) &&
    !hasImpulseSelection(text) &&
    !hasLibrarySelection(text) &&
    !isLootingPattern(text)
  );
}

function hasRepeatableClueGeneration(text: string) {
  const sentences = splitIntoSentences(text);

  return sentences.some((sentence) => {
    if (!hasClueGeneration(sentence)) {
      return false;
    }

    if (/\bwhen [^.]* enters(?: the battlefield)?\b/.test(sentence) || /\bwhen [^.]* dies\b/.test(sentence)) {
      return false;
    }

    return (
      /\{t\}[^:]*:/.test(sentence) ||
      /\bat the beginning of\b/.test(sentence) ||
      /\bwhenever\b/.test(sentence)
    );
  });
}

function estimateDrawAmount(text: string) {
  const sentence = splitIntoSentences(text).find((part) => isActualDrawSentence(part)) ?? text;
  const countMatch = sentence.match(/\bdraw(?:s)?\s+(?<count>an additional|a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x|that many)\s+cards?\b/);
  const count = countMatch?.groups?.count;

  if (!count) {
    if (/\bdraw(?:s)?\s+cards?\s+equal to\b/.test(sentence) || /\bdraw(?:s)?\s+a card for each\b/.test(sentence)) {
      return 2.5;
    }

    return 1;
  }

  if (count === "an additional") {
    return 1;
  }

  if (count === "x") {
    return 2.5;
  }

  if (count === "that many") {
    return 2.2;
  }

  return toNumericCount(count);
}

function estimateClueAmount(text: string) {
  if (/\binvestigate twice\b/.test(text)) {
    return 2;
  }

  if (/\binvestigate\b[^.]*\bfor each\b/.test(text) || /\binvestigate x times\b/.test(text)) {
    return 2.5;
  }

  const clueCountMatch = text.match(
    /\bcreate(?:s)?\b[^.]*\b(?<count>a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x|that many)\s+clue tokens?\b/,
  );
  const count = clueCountMatch?.groups?.count;

  if (!count) {
    return 1;
  }

  if (count === "x") {
    return 2.5;
  }

  if (count === "that many") {
    return 2.2;
  }

  return toNumericCount(count);
}

function splitIntoSentences(text: string) {
  return text
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function isActualDrawSentence(sentence: string) {
  if (
    !(
      /\bdraw(?:s)?\s+(?:an additional|a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x|that many)\s+cards?\b/.test(sentence) ||
      /\bdraw(?:s)?\s+cards?\s+equal to\b/.test(sentence) ||
      /\bdraw(?:s)?\s+a card for each\b/.test(sentence)
    )
  ) {
    return false;
  }

  if (
    /\bif [^.]*\bwould draw\b/.test(sentence) ||
    /\binstead of drawing\b/.test(sentence) ||
    /\bskip your draw step\b/.test(sentence) ||
    /\bcan't draw cards?\b/.test(sentence) ||
    /\bexcept the first one you draw\b/.test(sentence)
  ) {
    return false;
  }

  if (
    /\btarget opponent may draw\b/.test(sentence) &&
    !/\byou (?:may )?draw\b|\beach player (?:may )?draws?\b/.test(sentence)
  ) {
    return false;
  }

  if (
    /\b(?:when|whenever)\s+[^,]*\bdraws?\b[^,]*,/.test(sentence) &&
    !/,\s*(?:you|that player|its controller|they|each player|each opponent)\s+draw(?:s)?\b/.test(sentence) &&
    !/,\s*draw(?:s)?\b/.test(sentence)
  ) {
    return false;
  }

  return true;
}

function hasSelfReplacingTopDraw(text: string) {
  return /\bdraw a card\b[^.]{0,120}\bput [^.]{0,100}\bon top of (?:its|your) owner'?s library\b/.test(
    text,
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

function getDrawSegments(card: ScryfallCard) {
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

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasCardType(card: ScryfallCard, typeName: string) {
  if (card.type_line.includes(typeName)) {
    return true;
  }

  return (card.card_faces ?? []).some((face) => face.type_line?.includes(typeName));
}

function isPermanentType(typeLine: string) {
  return (
    typeLine.includes("Artifact") ||
    typeLine.includes("Creature") ||
    typeLine.includes("Enchantment") ||
    typeLine.includes("Planeswalker") ||
    typeLine.includes("Land") ||
    typeLine.includes("Battle")
  );
}

function totalTagWeight(hits: DrawTagHit[]) {
  return hits.reduce((sum, hit) => sum + hit.weight, 0);
}

function sumQuantities(cards: ResolvedDeckCard[]) {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}

function toNumericCount(value: string) {
  const directNumber = Number(value);
  if (Number.isFinite(directNumber) && directNumber > 0) {
    return directNumber;
  }

  return NUMBER_WORDS.get(value) ?? 1;
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
