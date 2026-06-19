import {
  getRoleReason,
  getRoleWeight,
  inferAdvancedRoleProfile,
} from "./advancedCardScan";
import { applyActivationCostDiscount } from "./activationCost";
import { applyCommanderAvailabilityToRampHits } from "./commanderAvailability";
import { CommanderColorProfile, getCommanderColorProfile } from "./commanderColorProfile";
import {
  createEffectiveManaValueContext,
  estimateEffectiveManaValue,
  sumEffectiveManaValue,
} from "./effectiveManaValue";
import { DeckRampAnalysis, DeckResolutionDocument, RampTag, RampTagHit, ResolvedDeckCard, ScryfallCard } from "./types";

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

const LAND_REFERENCE_PATTERN =
  /\b(?:land|plains|island|swamp|mountain|forest|wastes?|desert|gates?|caves?|lair|locus|mine|power-plant|sphere|tower|urza's)\b/;
const LAND_UNTAP_PATTERN =
  /\buntap target (?:basic )?(?:land|plains|island|swamp|mountain|forest|wastes?|desert|gate|cave|lair|locus|mine|power-plant|sphere|tower|urza's)\b/;

export function analyzeDeckRamp(document: DeckResolutionDocument): DeckRampAnalysis {
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
  const colorCount = colorProfile.colorCount;
  const colorDemand = analyzeColorDemand(nonlandCards, effectiveManaContext);
  const taggedCards = deckCards
    .map((card) => {
      const hits = applyCommanderAvailabilityToRampHits(
        card.section,
        detectRampHits(card.card, effectiveManaContext),
      );
      if (hits.length === 0) {
        return null;
      }

      const rampValue = roundTo(calculateCardRampValue(hits), 2);
      return {
        name: card.card.name,
        quantity: card.quantity,
        section: card.section,
        rampValue,
        hits,
      };
    })
    .filter((card): card is NonNullable<typeof card> => card !== null)
    .sort((left, right) => right.rampValue - left.rampValue || left.name.localeCompare(right.name));

  const counts = {
    stable: 0,
    burst: 0,
    landAcceleration: 0,
    manaFixing: 0,
    costReduction: 0,
  };

  for (const card of taggedCards) {
    for (const hit of card.hits) {
      const amount = roundTo(hit.weight * card.quantity, 2);

      if (hit.tag === "stable_ramp") {
        counts.stable += amount;
      } else if (hit.tag === "burst_ramp") {
        counts.burst += amount;
      } else if (hit.tag === "land_acceleration") {
        counts.landAcceleration += amount;
      } else if (hit.tag === "mana_fixing") {
        counts.manaFixing += amount;
      } else if (hit.tag === "cost_reduction") {
        counts.costReduction += amount;
      }
    }
  }

  counts.stable = roundTo(counts.stable, 2);
  counts.burst = roundTo(counts.burst, 2);
  counts.landAcceleration = roundTo(counts.landAcceleration, 2);
  counts.manaFixing = roundTo(counts.manaFixing, 2);
  counts.costReduction = roundTo(counts.costReduction, 2);

  const core = roundTo(counts.stable + counts.landAcceleration + counts.costReduction * 0.75, 2);
  const recommendations = {
    stableTarget: recommendStableRampTarget(averageManaValue, colorCount, colorProfile),
    coreTarget: recommendCoreRampTarget(averageManaValue, colorCount, colorProfile),
    fixingTarget: recommendFixingTarget(colorCount, colorDemand),
  };
  const findings = [
    assessCoreRamp(core, recommendations.coreTarget, colorProfile),
    assessStableRamp(counts.stable, recommendations.stableTarget, colorProfile),
    assessFixing(counts.manaFixing, recommendations.fixingTarget, colorCount),
    assessBurstRamp(counts.burst, counts.stable, counts.landAcceleration),
  ];
  const rampScore = scoreRamp({
    core,
    stable: counts.stable,
    fixing: counts.manaFixing,
    burst: counts.burst,
    recommendations,
    colorCount,
  });

  return {
    rampScore,
    summary: summarizeRampScore(rampScore),
    counts: {
      core,
      stable: counts.stable,
      burst: counts.burst,
      landAcceleration: counts.landAcceleration,
      manaFixing: counts.manaFixing,
      costReduction: counts.costReduction,
    },
    recommendations,
    findings,
    taggedCards,
  };
}

function detectRampHits(
  card: ScryfallCard,
  effectiveManaContext: ReturnType<typeof createEffectiveManaValueContext>,
): RampTagHit[] {
  const hits = new Map<RampTag, { weight: number; reasons: Set<string> }>();
  const segments = getRampSegments(card);
  const effectiveManaValue = estimateEffectiveManaValue(card, effectiveManaContext);

  for (const segment of segments) {
    if (!segment.text) {
      continue;
    }

    const permanent = isPermanentType(segment.typeLine);
    const land = segment.typeLine.includes("Land");
    const reusableManaAbility = hasReusableManaAbility(segment.text);
    const reusableLandUntap = hasReusableLandUntap(segment.text);
    const allLandUntapEngine = hasAllLandUntapEngine(segment.text);
    const reusablePermanentUntap = hasReusablePermanentUntap(segment.text);
    const attackPermanentUntap = hasAttackPermanentUntap(segment.text);
    const tappedCreatureManaAbility = hasTappedCreatureManaAbility(segment.text);
    const tappedCreatureLandUntap = hasTappedCreatureLandUntap(segment.text);
    const limitedUseManaAbility = hasLimitedUseManaAbility(segment.text);
    const landAbilityCopy = hasLandAbilityCopy(segment.text);
    const tokenManaReminder = hasTokenManaReminder(segment.text);
    const sacrificeManaAbility = !tokenManaReminder && hasSacrificeManaAbility(segment.text);
    const handExileManaAbility = hasHandExileManaAbility(segment.text);
    const enhancedManaOutput = hasEnhancedManaOutput(segment.text);
    const landManaTriggerBonus = hasLandManaTriggerBonus(segment.text);
    const permanentTapMultiplier = hasPermanentTapMultiplier(segment.text);
    const landTutorToHand = hasLandTutorToHand(segment.text);
    const landFromHandAcceleration = hasLandFromHandAcceleration(segment.text);
    const attackLandAcceleration = hasAttackLandAcceleration(segment.text);
    const additionalLandPlay = hasAdditionalLandPlay(segment.text);
    const flexibleLandSearch = hasFlexibleLandSearch(segment.text);
    const anyColorMana = hasAnyColorMana(segment.text);
    const chosenColorMana = hasChosenColorMana(segment.text);
    const multiColorMana = hasMultiColorManaPattern(segment.text);
    const manaTokenInfo = getCreatedManaTokenInfo(segment.text);
    const spellTriggeredMana = hasSpellTriggeredMana(segment.text);
    const enterManaTrigger = hasEnterManaTrigger(segment.text);
    const manaPoolDoubling = hasManaPoolDoubling(segment.text);
    const rampAccelerationSource =
      hasLandToBattlefieldRamp(segment.text) ||
      landTutorToHand ||
      landFromHandAcceleration ||
      attackLandAcceleration ||
      additionalLandPlay;
    const supplementalFixingSource =
      (!land &&
        (reusableManaAbility ||
          limitedUseManaAbility ||
          reusableLandUntap ||
          allLandUntapEngine ||
          reusablePermanentUntap ||
          attackPermanentUntap ||
          tappedCreatureManaAbility ||
          tappedCreatureLandUntap ||
          landAbilityCopy ||
          permanentTapMultiplier ||
          hasRecurringManaBonus(segment.text) ||
          spellTriggeredMana)) ||
      (land &&
        (enhancedManaOutput ||
          limitedUseManaAbility ||
          reusableLandUntap ||
          allLandUntapEngine ||
          reusablePermanentUntap ||
          attackPermanentUntap ||
          landAbilityCopy ||
          permanentTapMultiplier ||
          hasRecurringManaBonus(segment.text))) ||
      rampAccelerationSource;

    if (permanent && reusableManaAbility && !sacrificeManaAbility && (!land || enhancedManaOutput)) {
      addHit(
        hits,
        "stable_ramp",
        estimateReusableManaWeight(effectiveManaValue, segment.text, {
          land,
          enhancedManaOutput,
          limitedUseManaAbility,
          permanentTapMultiplier,
        }),
        land
          ? "Produces extra mana from a land source."
          : "Reusable permanent mana source.",
      );
    }

    if (permanent && reusableLandUntap) {
      addHit(
        hits,
        "stable_ramp",
        estimateUntapRampWeight(effectiveManaValue, segment.text, "land"),
        "Repeatable land untap can generate extra mana.",
      );
    }

    if (permanent && allLandUntapEngine) {
      addHit(
        hits,
        "stable_ramp",
        estimateAllLandUntapWeight(effectiveManaValue, segment.text),
        "Untapping all lands creates repeatable mana advantage across turns.",
      );
    }

    if (permanent && reusablePermanentUntap) {
      addHit(
        hits,
        "stable_ramp",
        estimateUntapRampWeight(effectiveManaValue, segment.text, "permanent"),
        "Repeatable permanent untap can generate extra mana.",
      );
    }

    if (permanent && attackPermanentUntap) {
      addHit(
        hits,
        "stable_ramp",
        estimateUntapRampWeight(effectiveManaValue, segment.text, "permanent") * 0.8,
        "Attack-triggered permanent untap can create mana advantage.",
      );
    }

    if (permanent && tappedCreatureManaAbility) {
      addHit(
        hits,
        "stable_ramp",
        estimateCrewManaWeight(effectiveManaValue, segment.text),
        "Turns other creatures into repeatable mana sources.",
      );
    }

    if (permanent && tappedCreatureLandUntap) {
      addHit(
        hits,
        "stable_ramp",
        estimateCrewLandUntapWeight(effectiveManaValue, segment.text),
        "Turns creatures into extra land untaps.",
      );
    }

    if (permanent && limitedUseManaAbility && !sacrificeManaAbility) {
      addHit(
        hits,
        "stable_ramp",
        estimateLimitedManaWeight(effectiveManaValue, segment.text),
        "Limited-use permanent mana source.",
      );
    }

    if (permanent && landAbilityCopy) {
      addHit(
        hits,
        "stable_ramp",
        estimateLandAbilityCopyWeight(effectiveManaValue, segment.text),
        "Copies mana abilities from lands on the battlefield.",
      );
    }

    if (permanent && permanentTapMultiplier) {
      addHit(
        hits,
        "stable_ramp",
        estimateManaMultiplierWeight(effectiveManaValue, segment.text),
        "Multiplies mana from lands or permanents.",
      );
    }

    if (permanent && hasRecurringManaBonus(segment.text)) {
      addHit(
        hits,
        "stable_ramp",
        estimateRecurringManaBonusWeight(effectiveManaValue, segment.text),
        "Repeated mana gain from a permanent effect.",
      );
    }

    if (permanent && spellTriggeredMana) {
      addHit(
        hits,
        "burst_ramp",
        estimateSpellBurstWeight(effectiveManaValue, segment.text),
        "Repeated spell-cast triggers generate short-term mana.",
      );
    }

    if (permanent && enterManaTrigger) {
      addHit(
        hits,
        "burst_ramp",
        estimateEnterBurstWeight(effectiveManaValue, segment.text),
        "Enters with a one-shot mana burst.",
      );
    }

    if (!permanent && landManaTriggerBonus) {
      addHit(
        hits,
        "burst_ramp",
        estimateTemporaryMultiplierWeight(effectiveManaValue, segment.text),
        "Temporary land-based mana multiplication.",
      );
    }

    if (permanent && manaPoolDoubling) {
      addHit(
        hits,
        "burst_ramp",
        estimateManaPoolDoublingWeight(effectiveManaValue, segment.text),
        "Scales up the mana already in your pool.",
      );
    }

    if (hasLandToBattlefieldRamp(segment.text)) {
      addHit(
        hits,
        "land_acceleration",
        estimateBattlefieldLandWeight(effectiveManaValue, segment.text),
        "Moves lands directly onto the battlefield.",
      );
    }

    if (landFromHandAcceleration) {
      addHit(
        hits,
        "land_acceleration",
        estimateHandLandAccelerationWeight(effectiveManaValue, segment.text),
        "Turns lands in hand into extra battlefield mana.",
      );
    }

    if (attackLandAcceleration) {
      addHit(
        hits,
        "land_acceleration",
        estimateAttackLandWeight(effectiveManaValue, segment.text),
        "Can deploy lands from the library while attacking.",
      );
    }

    if (landTutorToHand) {
      addHit(
        hits,
        "land_acceleration",
        estimateLandTutorToHandWeight(effectiveManaValue, segment.text),
        "Finds extra lands to keep future land drops flowing.",
      );
    }

    if (additionalLandPlay) {
      addHit(
        hits,
        "land_acceleration",
        estimateAdditionalLandWeight(effectiveManaValue, segment.text),
        "Lets you play additional lands.",
      );
    }

    if (isBurstManaCard(segment.typeLine, segment.text, sacrificeManaAbility, handExileManaAbility)) {
      addHit(
        hits,
        "burst_ramp",
        estimateDirectBurstWeight(effectiveManaValue, segment.text),
        "Generates temporary mana rather than repeated mana advantage.",
      );
    }

    if (manaTokenInfo.count > 0) {
      addHit(
        hits,
        "burst_ramp",
        estimateTokenBurstWeight(effectiveManaValue, manaTokenInfo.count),
        `Creates ${manaTokenInfo.label} tokens for temporary mana.`,
      );
      addHit(
        hits,
        "mana_fixing",
        estimateFixingWeight(effectiveManaValue, {
          anyColorMana: true,
          tokenCount: manaTokenInfo.count,
          text: segment.text,
        }),
        `${capitalize(manaTokenInfo.label)} tokens can convert into flexible mana.`,
      );
    }

    if (hasGlobalCostReduction(segment.text)) {
      addHit(
        hits,
        "cost_reduction",
        estimateCostReductionWeight(effectiveManaValue, segment.text),
        "Makes future spells cheaper to cast.",
      );
    }

    if (hasCastingAssistance(segment.text)) {
      addHit(
        hits,
        "cost_reduction",
        estimateCastingAssistanceWeight(effectiveManaValue, segment.text),
        "Turns permanents into extra mana while casting spells.",
      );
    }

    if (
      (anyColorMana || chosenColorMana || multiColorMana) &&
      (supplementalFixingSource || manaTokenInfo.count > 0)
    ) {
      addHit(
        hits,
        "mana_fixing",
        estimateFixingWeight(effectiveManaValue, {
          anyColorMana,
          chosenColorMana,
          multiColorMana,
          tokenCount: 0,
          permanent,
          limitedUseManaAbility,
          text: segment.text,
        }),
        "Provides access to flexible mana colors.",
      );
    }

    if (flexibleLandSearch && rampAccelerationSource) {
      addHit(
        hits,
        "mana_fixing",
        estimateFixingWeight(effectiveManaValue, {
          flexibleLandSearch,
          text: segment.text,
        }),
        "Finds flexible land colors while ramping.",
      );
    }
  }

  detectKeywordReminderHits(card, hits);

  const advancedProfile = hits.size === 0 ? inferAdvancedRoleProfile(card) : null;
  if (advancedProfile) {
    const mappings: Array<[RampTag, string]> = [
      ["stable_ramp", "stable_ramp"],
      ["burst_ramp", "burst_ramp"],
      ["land_acceleration", "land_acceleration"],
      ["mana_fixing", "mana_fixing"],
      ["cost_reduction", "cost_reduction"],
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
    weight: roundTo(value.weight, 2),
    reason: [...value.reasons].join(" "),
  }));
}

function addHit(
  hits: Map<RampTag, { weight: number; reasons: Set<string> }>,
  tag: RampTag,
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

function assessCoreRamp(coreRamp: number, target: number, colorProfile: CommanderColorProfile) {
  if (coreRamp < target - 2) {
    return {
      code: "core_ramp_low",
      title: "Core ramp package is low",
      status: "risk",
      message: `${coreRamp.toFixed(2)} effective ramp is well below the baseline target of ${target}. ${describeCoreRampExpectations(colorProfile)}`,
    } as const;
  }

  if (coreRamp < target) {
    return {
      code: "core_ramp_light",
      title: "Core ramp package is a little light",
      status: "warning",
      message: `${coreRamp.toFixed(2)} effective ramp is slightly below the target of ${target}. ${describeCoreRampExpectations(colorProfile)}`,
    } as const;
  }

  if (coreRamp > target + 4.5) {
    return {
      code: "core_ramp_high",
      title: "Core ramp package is heavy",
      status: "note",
      message: `${coreRamp.toFixed(2)} effective ramp is above the target of ${target}. The shell should develop quickly, but some slots may be overcommitted to mana.`,
    } as const;
  }

  return {
    code: "core_ramp_fit",
    title: "Core ramp package looks healthy",
    status: "good",
    message: `${coreRamp.toFixed(2)} effective ramp lines up well with the target of ${target} for this deck.`,
  } as const;
}

function assessStableRamp(
  stableRamp: number,
  target: number,
  colorProfile: CommanderColorProfile,
) {
  if (stableRamp < target - 1.5) {
    return {
      code: "stable_ramp_low",
      title: "Stable ramp is too low",
      status: "warning",
      message: `${stableRamp.toFixed(2)} stable ramp is below the target of ${target}. ${describeStableRampExpectations(colorProfile)}`,
    } as const;
  }

  if (stableRamp > target + 4) {
    return {
      code: "stable_ramp_high",
      title: "Stable ramp is very dense",
      status: "note",
      message: `${stableRamp.toFixed(2)} stable ramp is comfortably above the target of ${target}. The deck should cast spells on time very consistently.`,
    } as const;
  }

  return {
    code: "stable_ramp_fit",
    title: "Stable ramp is on pace",
    status: "good",
    message: `${stableRamp.toFixed(2)} stable ramp is close to the target of ${target}.`,
  } as const;
}

function assessFixing(fixing: number, target: number, colorCount: number) {
  if (colorCount <= 1) {
    return {
      code: "fixing_low_need",
      title: "Color fixing demand is low",
      status: "note",
      message: "The commander is mono-color or colorless, so fixing is much less important than raw ramp.",
    } as const;
  }

  if (fixing < target) {
    return {
      code: "fixing_low",
      title: "Color fixing is light",
      status: "warning",
      message: `${fixing.toFixed(2)} supplemental fixing is below the target of ${target} for a ${colorCount}-color commander deck.`,
    } as const;
  }

  if (fixing > target + 3.5) {
    return {
      code: "fixing_high",
      title: "Color fixing is very dense",
      status: "note",
      message: `${fixing.toFixed(2)} supplemental fixing is well above the target of ${target}. The deck should cast colors smoothly, but some ramp slots may be overcommitted to color support.`,
    } as const;
  }

  return {
    code: "fixing_fit",
    title: "Color fixing looks healthy",
    status: "good",
    message: `${fixing.toFixed(2)} supplemental fixing clears the target of ${target} for this color identity.`,
  } as const;
}

function assessBurstRamp(burst: number, stable: number, landAcceleration: number) {
  if (burst >= stable + landAcceleration + 2) {
    return {
      code: "burst_ramp_heavy",
      title: "Burst mana outweighs stable ramp",
      status: "warning",
      message: `${burst.toFixed(2)} burst ramp is carrying more of the package than repeated mana sources. The deck may spike hard but fail to keep pace over longer games.`,
    } as const;
  }

  if (burst >= 3) {
    return {
      code: "burst_ramp_present",
      title: "Burst mana support is meaningful",
      status: "note",
      message: `${burst.toFixed(2)} burst ramp gives the deck explosive turns on top of its permanent mana plan.`,
    } as const;
  }

  return {
    code: "burst_ramp_light",
    title: "Burst mana stays light",
    status: "good",
    message: "The ramp package leans more on lasting mana than on short-term bursts.",
  } as const;
}

function describeCoreRampExpectations(colorProfile: CommanderColorProfile) {
  if (colorProfile.hasGreen) {
    return "This color identity has access to strong long-game ramp, so falling short matters more here.";
  }

  if (colorProfile.hasBlue && !colorProfile.hasGreen) {
    return "These colors usually lean on rocks, doublers, and cost reducers instead of green-style land ramp.";
  }

  if (colorProfile.hasBlack && !colorProfile.hasGreen) {
    return "These colors usually need rocks, doublers, or rituals to keep pace on mana.";
  }

  return "The deck may miss early development too often if the mana package stays this light.";
}

function describeStableRampExpectations(colorProfile: CommanderColorProfile) {
  if (colorProfile.hasGreen) {
    return "Green decks usually want a steadier base of permanent ramp and extra land development.";
  }

  if (colorProfile.hasBlue && !colorProfile.hasGreen) {
    return "Mono-blue and blue-heavy shells usually rely on rocks, untap pieces, and cost reducers for this slot.";
  }

  if (colorProfile.hasBlack && !colorProfile.hasGreen) {
    return "Black shells usually need rocks and mana doublers because they cannot lean on green-style land ramp.";
  }

  return "Temporary mana alone usually will not cover that gap.";
}

function scoreRamp(input: {
  core: number;
  stable: number;
  fixing: number;
  burst: number;
  recommendations: {
    coreTarget: number;
    stableTarget: number;
    fixingTarget: number;
  };
  colorCount: number;
}) {
  let score = 70;
  const stableShortfall = Math.max(input.recommendations.stableTarget - input.stable, 0);
  const coreBonusScale =
    stableShortfall > 2 ? 0.4
    : stableShortfall > 1.25 ? 0.75
    : 1;

  score += calculateTargetBonus(input.core, input.recommendations.coreTarget, 5) * coreBonusScale;
  score += calculateTargetBonus(input.stable, input.recommendations.stableTarget, 3);
  score += input.colorCount <= 1
    ? 2
    : calculateTargetBonus(input.fixing, input.recommendations.fixingTarget, 2);
  score += calculatePackageBalanceBonus(input);

  score -= calculateUnderPenalty(input.core, input.recommendations.coreTarget, 8, 6);
  score -= calculateOverPenalty(input.core, input.recommendations.coreTarget, 3.5, 1.5);

  score -= calculateUnderPenalty(input.stable, input.recommendations.stableTarget, 5, 4);
  score -= calculateOverPenalty(input.stable, input.recommendations.stableTarget, 3.5, 1.1);

  if (input.colorCount > 1) {
    score -= calculateUnderPenalty(input.fixing, input.recommendations.fixingTarget, 4, 3);
    score -= calculateOverPenalty(input.fixing, input.recommendations.fixingTarget, 4, 0.9);
  }

  if (input.burst > input.stable + 2.5) {
    score -= 3 + (input.burst - input.stable - 2.5) * 2;
  }

  if (stableShortfall > 1.5 && input.burst >= 3) {
    score -= 2.5 + (input.burst - 3) * 0.75;
  }

  if (stableShortfall > 1.75 && input.core > input.recommendations.coreTarget + 1.5) {
    score -= 1.5;
  }

  if (input.core > input.recommendations.coreTarget + 4 && input.stable > input.recommendations.stableTarget + 3) {
    score -= 2;
  }

  const coreOnPace =
    input.core >= input.recommendations.coreTarget - 0.75 &&
    input.core <= input.recommendations.coreTarget + 2;
  const stableOnPace =
    input.stable >= input.recommendations.stableTarget - 1.5 &&
    input.stable <= input.recommendations.stableTarget + 2.5;
  const fixingOnPace =
    input.colorCount <= 1 || input.fixing >= input.recommendations.fixingTarget - 0.5;

  if (coreOnPace && stableOnPace) {
    score += 9;
  }

  if (coreOnPace && stableOnPace && fixingOnPace) {
    score += 3;
  }

  return clamp(Math.round(score), 0, 100);
}

function summarizeRampScore(score: number) {
  if (score >= 86) {
    return "Ramp package is strong and well-balanced.";
  }

  if (score >= 72) {
    return "Ramp package is healthy, with a few tuning points.";
  }

  if (score >= 58) {
    return "Ramp package is playable, but uneven.";
  }

  return "Ramp package is underbuilt for the deck's mana needs.";
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

function calculatePackageBalanceBonus(input: {
  core: number;
  stable: number;
  burst: number;
  recommendations: {
    coreTarget: number;
    stableTarget: number;
  };
}) {
  let bonus = 0;

  if (input.core > 0 && input.stable >= input.core * 0.55) {
    bonus += 1;
  }

  if (input.burst <= input.stable + 2.5) {
    bonus += 1;
  }

  if (
    Math.abs(input.core - input.recommendations.coreTarget) <= 1.5 &&
    input.stable >= input.recommendations.stableTarget - 1.5
  ) {
    bonus += 1;
  }

  return bonus;
}

function recommendStableRampTarget(
  averageManaValue: number,
  colorCount: number,
  colorProfile: CommanderColorProfile,
) {
  let target = 6;

  if (averageManaValue >= 2.8) {
    target += 1;
  }

  if (averageManaValue >= 3.1) {
    target += 1;
  }

  if (averageManaValue >= 3.4) {
    target += 1;
  }

  if (averageManaValue >= 3.8) {
    target += 1;
  }

  if (colorCount >= 3) {
    target += 1;
  }

  if (colorCount >= 4) {
    target += 1;
  }

  if (colorProfile.hasGreen) {
    target += 1;
  } else if (colorCount <= 2) {
    target -= 1;
  }

  if (colorProfile.hasBlue && !colorProfile.hasGreen && colorProfile.isMonoColor) {
    target -= 1;
  }

  return clamp(target, colorProfile.hasGreen ? 6 : 4, 12);
}

function recommendCoreRampTarget(
  averageManaValue: number,
  colorCount: number,
  colorProfile: CommanderColorProfile,
) {
  let target = recommendStableRampTarget(averageManaValue, colorCount, colorProfile) + 1;

  if (averageManaValue >= 3.5) {
    target += 1;
  }

  if (!colorProfile.hasGreen && colorCount <= 2) {
    target -= 1;
  }

  return clamp(target, colorProfile.hasGreen ? 7 : 5, 13);
}

function recommendFixingTarget(
  colorCount: number,
  colorDemand: {
    averageColoredPips: number;
    multicolorShare: number;
    dominantColorShare: number;
    earlyColorPressure: number;
  },
) {
  if (colorCount <= 1) {
    return 0;
  }

  let target =
    colorCount === 2 ? 2
    : colorCount === 3 ? 3
    : colorCount === 4 ? 5
    : 6;

  if (colorDemand.averageColoredPips >= 1.3) {
    target += 1;
  }

  if (colorDemand.averageColoredPips >= 1.8) {
    target += 1;
  }

  if (colorDemand.multicolorShare >= 0.25) {
    target += 1;
  }

  if (colorCount >= 3 && colorDemand.earlyColorPressure >= 0.2) {
    target += 1;
  }

  if (colorDemand.dominantColorShare >= 0.6) {
    target -= 1;
  }

  if (colorDemand.dominantColorShare >= 0.75) {
    target -= 1;
  }

  if (colorCount >= 4 && colorDemand.dominantColorShare <= 0.38) {
    target += 1;
  }

  if (colorCount === 2) {
    return clamp(target, 1, 4);
  }

  if (colorCount === 3) {
    return clamp(target, 2, 6);
  }

  if (colorCount === 4) {
    return clamp(target, 4, 8);
  }

  return clamp(target, 5, 9);
}

function analyzeColorDemand(
  cards: ResolvedDeckCard[],
  effectiveManaContext: ReturnType<typeof createEffectiveManaValueContext>,
) {
  let totalCards = 0;
  let totalColoredPips = 0;
  let multicolorCards = 0;
  let earlyColorPressureCards = 0;
  const pipCounts = {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
  };

  for (const card of cards) {
    const manaCost = getPrimaryManaCost(card.card);
    const symbols = manaCost.match(/\{([WUBRG])\}/g) ?? [];
    const quantity = card.quantity;
    totalCards += quantity;

    if (symbols.length === 0) {
      continue;
    }

    totalColoredPips += symbols.length * quantity;
    const colorsOnCard = new Set<string>();

    for (const symbol of symbols) {
      const color = symbol[1] as keyof typeof pipCounts;
      pipCounts[color] += quantity;
      colorsOnCard.add(color);
    }

    if (colorsOnCard.size >= 2) {
      multicolorCards += quantity;
    }

    if (estimateEffectiveManaValue(card.card, effectiveManaContext) <= 3.5 && colorsOnCard.size >= 2) {
      earlyColorPressureCards += quantity;
    }
  }

  const dominantColorPips = Math.max(...Object.values(pipCounts));
  return {
    averageColoredPips: totalCards === 0 ? 0 : totalColoredPips / totalCards,
    multicolorShare: totalCards === 0 ? 0 : multicolorCards / totalCards,
    dominantColorShare: totalColoredPips === 0 ? 1 : dominantColorPips / totalColoredPips,
    earlyColorPressure: totalCards === 0 ? 0 : earlyColorPressureCards / totalCards,
  };
}

function estimateReusableManaWeight(
  cmc: number,
  text: string,
  options: {
    land: boolean;
    enhancedManaOutput: boolean;
    limitedUseManaAbility: boolean;
    permanentTapMultiplier: boolean;
  },
) {
  let magnitude = 0.95;
  const manaAmount = estimateDirectManaAmount(text);

  if (options.permanentTapMultiplier) {
    magnitude = estimateManaMultiplierWeight(cmc, text);
  } else if (manaAmount >= 3 || /\bfor each\b/.test(text) || /\bx mana\b/.test(text)) {
    magnitude = 1.45;
  } else if (manaAmount >= 2 || options.land || options.enhancedManaOutput) {
    magnitude = 1.15;
  }

  if (options.limitedUseManaAbility) {
    magnitude -= 0.18;
  }

  if (hasEntersTapped(text)) {
    magnitude -= 0.08;
  }

  return applyCardEfficiency(applyRampActivationCostDiscount(magnitude, text), cmc, "stable_ramp");
}

function estimateUntapRampWeight(cmc: number, text: string, mode: "land" | "permanent") {
  const untapCount = estimateUntapCount(text);
  const base = mode === "land"
    ? 0.7 + Math.min(0.35, Math.max(untapCount - 1, 0) * 0.2)
    : 0.45 + Math.min(0.2, Math.max(untapCount - 1, 0) * 0.1);

  return applyCardEfficiency(applyRampActivationCostDiscount(base, text), cmc, "stable_ramp");
}

function estimateAllLandUntapWeight(cmc: number, text: string) {
  let base = 1.2;

  if (/\bduring each other player's untap step\b/.test(text)) {
    base = 1.35;
  } else if (/\bat the beginning of your end step\b/.test(text)) {
    base = 1.25;
  }

  return applyCardEfficiency(applyRampActivationCostDiscount(base, text), cmc, "stable_ramp");
}

function estimateCrewManaWeight(cmc: number, text: string) {
  let base = 0.72;
  if (hasAnyColorMana(text) || hasChosenColorMana(text) || hasMultiColorManaPattern(text)) {
    base += 0.08;
  }

  return applyCardEfficiency(applyRampActivationCostDiscount(base, text), cmc, "stable_ramp");
}

function estimateCrewLandUntapWeight(cmc: number, text: string) {
  const base = 0.7 + Math.min(0.15, Math.max(estimateUntapCount(text) - 1, 0) * 0.1);
  return applyCardEfficiency(applyRampActivationCostDiscount(base, text), cmc, "stable_ramp");
}

function estimateLimitedManaWeight(cmc: number, text: string) {
  let base = 0.62;
  const manaAmount = estimateDirectManaAmount(text);

  if (manaAmount >= 2) {
    base += 0.12;
  }

  if (hasAnyColorMana(text) || hasChosenColorMana(text)) {
    base += 0.06;
  }

  return applyCardEfficiency(applyRampActivationCostDiscount(base, text), cmc, "stable_ramp");
}

function estimateLandAbilityCopyWeight(cmc: number, text: string) {
  const base = hasAnyColorMana(text) ? 0.9 : 0.8;
  return applyCardEfficiency(applyRampActivationCostDiscount(base, text), cmc, "stable_ramp");
}

function estimateManaMultiplierWeight(cmc: number, text: string) {
  let base = 1.35;

  if (/\bthree times as much\b/.test(text)) {
    base = 1.7;
  } else if (/\btwice as much\b/.test(text)) {
    base = 1.4;
  }

  if (/\bbasic land\b/.test(text)) {
    base -= 0.1;
  }

  return applyCardEfficiency(applyRampActivationCostDiscount(base, text), cmc, "stable_ramp");
}

function estimateRecurringManaBonusWeight(cmc: number, text: string) {
  let base = 0.95;

  if (/\bat the beginning of (?:each of |your |each )?[^.;]+,[^.]*\badds?\s+(?:\{[^}]+\}\s*){2,}/.test(text)) {
    base = 1.15;
  } else if (/\bfor each\b/.test(text)) {
    base = 1.2;
  }

  return applyCardEfficiency(applyRampActivationCostDiscount(base, text), cmc, "stable_ramp");
}

function estimateSpellBurstWeight(cmc: number, text: string) {
  const amount = estimateDirectManaAmount(text);
  let base = 0.8;

  if (amount >= 2) {
    base += 0.15;
  }

  return applyCardEfficiency(base, cmc, "burst_ramp");
}

function estimateEnterBurstWeight(cmc: number, text: string) {
  const amount = estimateDirectManaAmount(text);
  let base = 0.75;

  if (amount >= 3) {
    base = 1;
  } else if (amount >= 2) {
    base = 0.88;
  }

  return applyCardEfficiency(base, cmc, "burst_ramp");
}

function estimateTemporaryMultiplierWeight(cmc: number, text: string) {
  let base = 1.15;

  if (/\bthree times as much\b/.test(text)) {
    base = 1.35;
  } else if (/\btwice as much\b/.test(text) || /\ban additional\b/.test(text)) {
    base = 1.2;
  }

  return applyCardEfficiency(base, cmc, "burst_ramp");
}

function estimateManaPoolDoublingWeight(cmc: number, text: string) {
  const base = /\bdouble the amount of each type of unspent mana you have\b/.test(text) ? 1.25 : 1;
  return applyCardEfficiency(applyRampActivationCostDiscount(base, text), cmc, "burst_ramp");
}

function estimateBattlefieldLandWeight(cmc: number, text: string) {
  const landCount = estimateBattlefieldLandCount(text);
  let base = 0.95;

  if (landCount >= 3) {
    base = 2.05;
  } else if (landCount >= 2) {
    base = 1.6;
  } else if (landCount > 1) {
    base = 1.35;
  }

  if (/\bif an opponent controls more lands than you\b/.test(text) || /\bfewer lands than\b/.test(text)) {
    base += 0.1;
  }

  if (hasEntersTapped(text)) {
    base -= 0.08;
  }

  const activatedSearchTax = estimateActivatedLandSearchTax(text);
  if (activatedSearchTax > 0) {
    base -= activatedSearchTax;
  }

  return applyCardEfficiency(base, cmc, "land_acceleration");
}

function estimateHandLandAccelerationWeight(cmc: number, text: string) {
  let base = 0.62;

  if (/\bbasic land card from your hand\b/.test(text)) {
    base -= 0.04;
  }

  return applyCardEfficiency(base, cmc, "land_acceleration");
}

function estimateAttackLandWeight(cmc: number, text: string) {
  let base = 0.68;

  if (/\bdeals combat damage to a player\b/.test(text)) {
    base += 0.1;
  }

  return applyCardEfficiency(base, cmc, "land_acceleration");
}

function estimateLandTutorToHandWeight(cmc: number, text: string) {
  const landCount = estimateSearchToHandLandCount(text);
  let base = 0.35;

  if (landCount >= 3) {
    base = 0.75;
  } else if (landCount >= 2) {
    base = 0.58;
  } else if (landCount > 1) {
    base = 0.48;
  }

  if (/\bif an opponent controls more lands than you\b/.test(text) || /\bplayers who control more lands than you\b/.test(text)) {
    base += 0.08;
  }

  const activatedSearchTax = estimateActivatedLandSearchTax(text);
  if (activatedSearchTax > 0) {
    base -= Math.min(0.18, activatedSearchTax * 0.75);
  }

  return applyCardEfficiency(base, cmc, "land_acceleration");
}

function estimateAdditionalLandWeight(cmc: number, text: string) {
  let base = 0.7;

  if (/\buntil end of turn\b/.test(text)) {
    base = 0.45;
  }

  return applyCardEfficiency(base, cmc, "land_acceleration");
}

function estimateDirectBurstWeight(cmc: number, text: string) {
  return applyCardEfficiency(getBurstWeight(text), cmc, "burst_ramp");
}

function estimateTokenBurstWeight(cmc: number, tokenCount: number) {
  const base = clamp(0.45 + tokenCount * 0.18, 0.55, 1.45);
  return applyCardEfficiency(base, cmc, "burst_ramp");
}

function estimateCostReductionWeight(cmc: number, text: string) {
  const reduction = estimateCostReductionAmount(text);
  let base = 0.95 + (reduction - 1) * 0.2;
  const breadth = estimateCostReductionBreadth(text);

  return applyCardEfficiency(base * breadth, cmc, "cost_reduction");
}

function estimateCastingAssistanceWeight(cmc: number, text: string) {
  let base = 0.72;

  if (/\bpays for \{2\}/.test(text) || /\bpays for \{3\}/.test(text)) {
    base += 0.08;
  }

  return applyCardEfficiency(base, cmc, "cost_reduction");
}

function estimateFixingWeight(
  cmc: number,
  options: {
    anyColorMana?: boolean;
    chosenColorMana?: boolean;
    multiColorMana?: boolean;
    tokenCount?: number;
    permanent?: boolean;
    limitedUseManaAbility?: boolean;
    flexibleLandSearch?: boolean;
    text?: string;
  },
) {
  let base = 0.4;

  if (options.tokenCount && options.tokenCount > 0) {
    base = clamp(0.2 + options.tokenCount * 0.1, 0.25, 0.75);
  } else if (options.anyColorMana) {
    base = options.permanent ? 0.75 : 0.58;
  } else if (options.multiColorMana) {
    base = 0.55;
  } else if (options.chosenColorMana) {
    base = 0.42;
  } else if (options.flexibleLandSearch) {
    base = estimateLandSearchFixingWeight(options.text ?? "");
  }

  if (options.limitedUseManaAbility) {
    base -= 0.1;
  }

  return applyCardEfficiency(base, cmc, "mana_fixing");
}

function estimateLandSearchFixingWeight(text: string) {
  if (/\bsearch(?:es)? (?:your|their) library\b[\s\S]{0,240}?\bfor a land card\b/.test(text)) {
    return 0.58;
  }

  if (/\bsearch(?:es)? (?:your|their) library\b[\s\S]{0,240}?\bfor a basic land card\b/.test(text)) {
    return 0.4;
  }

  if (/\bsearch(?:es)? (?:your|their) library\b[\s\S]{0,240}?\bfor up to x basic land cards?\b/.test(text)) {
    return 0.45;
  }

  if (/\bsearch(?:es)? (?:your|their) library\b[\s\S]{0,240}?\bfor a forest card\b/.test(text)) {
    return 0.32;
  }

  if (/\bsearch(?:es)? (?:your|their) library\b[\s\S]{0,240}?\bfor up to x plains cards?\b/.test(text)) {
    return 0.32;
  }

  if (/\bsearch(?:es)? (?:your|their) library\b[\s\S]{0,240}?\bfor a plains, island, swamp, or mountain card\b/.test(text)) {
    return 0.5;
  }

  if (/\bsearch(?:es)? (?:your|their) library\b[\s\S]{0,240}?\bfor up to [a-z0-9x ]*forest cards?\b/.test(text)) {
    return 0.34;
  }

  return 0.35;
}

function estimateActivatedLandSearchTax(text: string) {
  const activatedSearch = /:\s*search(?:es)? (?:your|their) library\b[\s\S]{0,240}?\b(?:put|onto the battlefield|into (?:your|their) hand)\b/.test(text);
  if (!activatedSearch) {
    return 0;
  }

  let tax = 0.16;
  const manaCostMatches = [...text.matchAll(/\{(\d+)\}(?=[^:]{0,80}:)/g)];
  for (const match of manaCostMatches) {
    tax += Math.min(Number(match[1]) * 0.04, 0.12);
  }

  if (/\bsacrifice\b[^:]*:/.test(text)) {
    tax += 0.08;
  }

  if (/\{t\}(?=[^:]{0,80}:)/.test(text)) {
    tax += 0.04;
  }

  return Math.min(tax, 0.38);
}

function applyRampActivationCostDiscount(base: number, text: string) {
  return applyActivationCostDiscount(base, text, 0.08);
}

function applyCardEfficiency(base: number, cmc: number, tag: RampTag) {
  const freeManaValue =
    tag === "burst_ramp" ? 2
    : tag === "land_acceleration" ? 2
    : tag === "mana_fixing" ? 2
    : 3;
  const stepsPastCurve = Math.max(cmc - freeManaValue, 0);
  const penaltyPerStep =
    tag === "burst_ramp" ? 0.05
    : tag === "land_acceleration" ? 0.06
    : tag === "mana_fixing" ? 0.04
    : 0.07;
  let factor = 1 - stepsPastCurve * penaltyPerStep;

  if (base >= 1.4) {
    factor += 0.06;
  } else if (base >= 1.1) {
    factor += 0.03;
  }

  return roundTo(base * clamp(factor, 0.65, 1.08), 2);
}

function estimateDirectManaAmount(text: string) {
  const symbolBurstMatch = text.match(/\badd\s+(?<symbols>(?:\{[^}]+\}\s*){1,})/);
  const symbolCount = symbolBurstMatch?.groups?.symbols
    ? (symbolBurstMatch.groups.symbols.match(/\{[^}]+\}/g) ?? []).length
    : 0;

  if (symbolCount > 0) {
    return symbolCount;
  }

  const namedAmountMatch = text.match(/\badd\s+(a|an|one|two|three|four|five|six|seven|eight|nine|ten)\s+mana\b/);
  if (namedAmountMatch) {
    return toNumericCount(namedAmountMatch[1]);
  }

  if (/\btwice as much\b/.test(text)) {
    return 2;
  }

  if (/\bthree times as much\b/.test(text)) {
    return 3;
  }

  if (/\bfor each\b/.test(text) || /\bx mana\b/.test(text)) {
    return 3;
  }

  return 1;
}

function estimateUntapCount(text: string) {
  const numericMatch = text.match(/\buntap\s+(x|one|two|three|four|five|six|seven|eight|nine|ten)\s+target lands?\b/);
  if (numericMatch?.[1]) {
    return numericMatch[1] === "x" ? 2 : toNumericCount(numericMatch[1]);
  }

  if (/\buntap two target lands\b/.test(text)) {
    return 2;
  }

  return 1;
}

function estimateBattlefieldLandCount(text: string) {
  const numericMatch = text.match(/\b(?:put|search(?:es)? [\s\S]{0,240}?for)\s+(?:up to )?(all|x|one|two|three|four|five|six|seven|eight|nine|ten|a|an)?\s*(?:basic )?(?:land|plains|island|swamp|mountain|forest|wastes?) cards?\b[\s\S]{0,240}?\bonto the battlefield\b/);
  const value = numericMatch?.[1];

  if (!value) {
    if (/\bonto the battlefield\b/.test(text) && /\bland card\b/.test(text)) {
      return 1;
    }

    return 1;
  }

  if (value === "all") {
    return 2.5;
  }

  if (value === "x") {
    return 2;
  }

  return toNumericCount(value);
}

function estimateSearchToHandLandCount(text: string) {
  const numericMatch = text.match(/\bsearch(?:es)? (?:your|their) library\b[\s\S]{0,240}?\bfor up to (x|one|two|three|four|five|six|seven|eight|nine|ten)\b/);
  if (numericMatch?.[1]) {
    return numericMatch[1] === "x" ? 2 : toNumericCount(numericMatch[1]);
  }

  if (/\bnumber of players who control more lands than you\b/.test(text)) {
    return 2;
  }

  return 1;
}

function estimateCostReductionAmount(text: string) {
  const match = text.match(/\bcosts?\s+\{(?<amount>\d+)\}\s+less to cast\b/);
  if (match?.groups?.amount) {
    return Number(match.groups.amount);
  }

  return 1;
}

function estimateCostReductionBreadth(text: string) {
  if (/\bcommander spells you cast\b/.test(text)) {
    return 0.68;
  }

  if (/\bchosen type\b/.test(text) || /\bcreature type\b/.test(text) || /\bdragons?\b/.test(text)) {
    return 0.72;
  }

  if (/\b(red|green|white|blue|black) or (red|green|white|blue|black)\b/.test(text)) {
    return 0.78;
  }

  if (/\bnonartifact spells you cast\b/.test(text) || /\bcreature spells you cast\b/.test(text)) {
    return 0.82;
  }

  if (/\bspells you cast\b/.test(text)) {
    return 1;
  }

  return 0.8;
}

function hasReusableManaAbility(text: string) {
  return (
    /\{t\}\s*(?:,\s*[^:.]+)?\s*:\s*(?:[^.]{0,80}\.\s*)?[^.]{0,120}\badds?\b/.test(text) ||
    /\bat the beginning of (?:each of |your |each )?[^.;]+,[^.]*\badds?\b/.test(text)
  );
}

function hasSacrificeManaAbility(text: string) {
  return /\{t\},?\s*sacrifice\b[^.]*:\s*add\b/.test(text) || /\bsacrifice [^.]*:\s*add\b/.test(text);
}

function hasReusableLandUntap(text: string) {
  return (
    (
      /\{t\}\s*:\s*[^.]{0,80}\buntap\b/.test(text) ||
      /\{x\}\s*,\s*\{t\}\s*:\s*[^.]{0,80}\buntap\b/.test(text)
    ) &&
    (
      LAND_UNTAP_PATTERN.test(text) ||
      /\buntap\s+(?:x|one|two|three|four)?\s*target lands?\b/.test(text)
    )
  );
}

function hasAllLandUntapEngine(text: string) {
  return /\buntap all lands you control\b/.test(text);
}

function hasReusablePermanentUntap(text: string) {
  return (
    /\{t\}\s*:\s*[^.]{0,80}\buntap another target (?:permanent|artifact|creature|land)\b/.test(text) ||
    /\{q\}\s*:\s*[^.]{0,80}\badd\b/.test(text)
  );
}

function hasAttackPermanentUntap(text: string) {
  return (
    /\bwhenever\b[^.]{0,120}\bis attacked\b[^.]{0,180}\buntap all (?:nonland permanents|artifacts|lands) you control\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\battacks\b[^.]{0,180}\buntap all (?:nonland permanents|artifacts|lands) you control\b/.test(text) ||
    /\bduring each other player's untap step\b[^.]{0,180}\buntap all (?:artifacts|nonland permanents|lands) you control\b/.test(text)
  );
}

function hasTappedCreatureManaAbility(text: string) {
  return (
    /\{t\}\s*,\s*tap an untapped [^.]* you control:\s*[^.]{0,80}\badds?\b/.test(text) ||
    /\btap an untapped [^.]* you control:\s*[^.]{0,80}\badds?\b/.test(text)
  );
}

function hasTappedCreatureLandUntap(text: string) {
  return /\btap an untapped [^.]* you control:\s*[^.]{0,80}\buntap target (?:basic )?land\b/.test(text);
}

function hasLimitedUseManaAbility(text: string) {
  return (
    /\{t\}\s*,\s*remove [^.]* counter[^.]*:\s*(?:choose [^.]+\.\s*)?[^.]{0,80}\badd\b/.test(text) ||
    /\{t\}\s*,\s*remove [^.]*:\s*(?:choose [^.]+\.\s*)?[^.]{0,80}\badd\b/.test(text) ||
    /\bremove [^.]* counter[^.]*:\s*(?:choose [^.]+\.\s*)?[^.]{0,80}\badds?\b/.test(text)
  );
}

function hasLandAbilityCopy(text: string) {
  return (
    /\bhas all activated abilities of all lands on the battlefield\b/.test(text) ||
    /\bhas all activated abilities of target land\b/.test(text)
  );
}

function hasCastingAssistance(text: string) {
  return (
    /\bhelp cast\b/.test(text) ||
    /\bpays for \{[0-9wubrgcxyz]+\}/.test(text) ||
    /\byou may tap [^.]* rather than pay\b/.test(text)
  );
}

function hasManaPoolDoubling(text: string) {
  return /\bdouble the amount of each type of unspent mana you have\b/.test(text);
}

function hasEnhancedManaOutput(text: string) {
  return (
    /\{t\}\s*:\s*add\s+(?:\{[^}]+\}\s*){2,}/.test(text) ||
    /\badd\s+(two|three|four|five|six|seven|eight|nine|ten)\s+mana\b/.test(text) ||
    /\badd\b[^.]*for each\b/.test(text) ||
    /\bfor each\b[^.]*\badd\b/.test(text) ||
    /\badd\b[^.]*x mana\b/.test(text) ||
    /\ban additional\b[^.]*mana\b/.test(text) ||
    hasLandManaTriggerBonus(text)
  );
}

function hasRecurringManaBonus(text: string) {
  return (
    hasLandManaTriggerBonus(text) ||
    /\bat the beginning of (?:each of |your |each )?[^.;]+,[^.]*\badds?\b/.test(text)
  );
}

function hasLandToBattlefieldRamp(text: string) {
  return (
    hasSearchToBattlefieldLandRamp(text) ||
    /\breveal\b[^.]*\bland cards?\b[^.]*\bonto the battlefield\b/.test(text) ||
    /\bput (?:up to )?(?:all|one|two|three|four|x|that|those|a|an)?\s*land cards?\b[^.]*\bonto the battlefield\b/.test(text)
  );
}

function hasAdditionalLandPlay(text: string) {
  return /\byou may play (?:an|one) additional land\b/.test(text);
}

function hasLandFromHandAcceleration(text: string) {
  return /\byou may put (?:a|an|one)?\s*(?:basic )?(?:land|plains|island|swamp|mountain|forest|wastes?) card from your hand onto the battlefield tapped\b/.test(text);
}

function hasAttackLandAcceleration(text: string) {
  return (
    /\bif it'?s a land card, you may put it onto the battlefield tapped\b/.test(text) ||
    /\bwhenever [^.]* attacks\b[^.]*\bland card\b[^.]*\bonto the battlefield tapped\b/.test(text)
  );
}

function hasLandTutorToHand(text: string) {
  return (
    /\bsearch(?:es)? (?:your|their) library\b[\s\S]{0,240}?\b(?:land|plains|island|swamp|mountain|forest|wastes?) cards?\b[\s\S]{0,240}?\binto (?:your|their) hand\b/.test(text) ||
    /\bsearch(?:es)? (?:your|their) library\b[\s\S]{0,240}?\b(?:land|plains|island|swamp|mountain|forest|wastes?) cards?\b[\s\S]{0,240}?\bput (?:it|that card|them|those cards) into (?:your|their) hand\b/.test(text)
  );
}

function hasFlexibleLandSearch(text: string) {
  const searchClause = getSearchToBattlefieldClause(text);
  if (!searchClause) {
    return (
      /\breveal\b[^.]*\bland cards?\b[^.]*\bonto the battlefield\b/.test(text) ||
      hasLandTutorToHand(text)
    );
  }

  return LAND_REFERENCE_PATTERN.test(searchClause);
}

function hasGlobalCostReduction(text: string) {
  return (
    !/\bthis spell costs\b/.test(text) &&
    (
      /\bcosts?\b[^.]*\bless to cast\b/.test(text) ||
      /\byou may pay\b[^.]{0,80}\brather than pay (?:the )?mana cost\b/.test(text)
    )
  );
}

function hasAnyColorMana(text: string) {
  if (/\bspend mana as though it were mana of any color\b/.test(text)) {
    return false;
  }

  return (
    /\bmana of any color\b/.test(text) ||
    /\bmana of any type\b/.test(text) ||
    /\bany combination of colors\b/.test(text) ||
    /\bin any combination of colors\b/.test(text) ||
    /\bcolors in your commander'?s color identity\b/.test(text)
  );
}

function hasChosenColorMana(text: string) {
  return /\bchoose a color\b/.test(text) && /\bchosen color\b/.test(text) && /\badds?\b/.test(text);
}

function hasMultiColorManaPattern(text: string) {
  const addClauses = text.match(/\badd\b[^.]*/g) ?? [];

  return addClauses.some((clause) => {
    const colors = new Set((clause.match(/\{([wubrg])\}/g) ?? []).map((symbol) => symbol[1]));
    return colors.size >= 2;
  });
}

function hasEntersTapped(text: string) {
  return /\benters tapped\b/.test(text) || /\benters the battlefield tapped\b/.test(text);
}

function getCreatedManaTokenInfo(text: string) {
  const match = text.match(/\bcreate\s+(?<count>x|\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten)?\s*(?:[^.]*?)\b(?<token>treasure|gold)\s+tokens?\b/);
  if (!match?.groups?.count) {
    const tokenMatch = text.match(/\bcreate\b[^.]*\b(?<token>treasure|gold)\s+tokens?\b/);
    return {
      count: tokenMatch?.groups?.token ? 1 : 0,
      label: tokenMatch?.groups?.token ?? "mana",
    };
  }

  return {
    count: toNumericCount(match.groups.count),
    label: match.groups.token ?? "mana",
  };
}

function isBurstManaCard(
  typeLine: string,
  text: string,
  sacrificeManaAbility: boolean,
  handExileManaAbility = false,
) {
  const directManaText = containsManaAddPhrase(text);

  if (typeLine.includes("Instant") || typeLine.includes("Sorcery")) {
    return directManaText;
  }

  if (sacrificeManaAbility || handExileManaAbility) {
    return true;
  }

  return /\bwhen [^.]* enters the battlefield, add\b/.test(text) || /\buntil end of turn\b[^.]*\badd\b/.test(text);
}

function hasHandExileManaAbility(text: string) {
  return (
    /\bexile\b[^.]{0,120}\bfrom your hand\b[^.]{0,80}\badd\b[^.]{0,40}\{[wubrgc]/.test(text) ||
    /\bexile\b[^.]{0,80}\bthis card from your hand\b[^.]{0,80}\badd\b/.test(text)
  );
}

function hasSpellTriggeredMana(text: string) {
  return /\bwhenever you cast [^.]*spell\b[^.]*\badd\b/.test(text);
}

function hasEnterManaTrigger(text: string) {
  return /\bwhen [^.]* enters(?: the battlefield)?\b[^.]*\badds?\b/.test(text);
}

function hasPermanentTapMultiplier(text: string) {
  return /\bif you tap (?:a |an )?(?:basic )?(?:land|permanent)\b[^.]*\bfor mana\b[^.]*\bit produces (?:twice|three times|\w+ times) as much of that mana instead\b/.test(text);
}

function containsManaAddPhrase(text: string) {
  return (
    /\badd\b/.test(text) &&
    (
      /\{[wubrgcxyz]\}/.test(text) ||
      /\bmana of any color\b/.test(text) ||
      /\bmana of any type\b/.test(text) ||
      /\bany combination of colors\b/.test(text) ||
      /\b(two|three|four|five|six|seven|eight|nine|ten)\s+mana\b/.test(text) ||
      /\bx mana\b/.test(text)
    )
  );
}

function getBurstWeight(text: string) {
  const symbolBurstMatch = text.match(/\badd\s+(?<symbols>(?:\{[^}]+\}\s*){2,})/);
  const symbolCount = symbolBurstMatch?.groups?.symbols
    ? (symbolBurstMatch.groups.symbols.match(/\{[^}]+\}/g) ?? []).length
    : 0;

  if (symbolCount >= 3) {
    return 1.25;
  }

  if (symbolCount === 2) {
    return 1;
  }

  if (/\badd\b[^.]*for each\b/.test(text) || /\bx mana\b/.test(text)) {
    return 1.5;
  }

  if (/\badd\s+(three|four|five|six|seven|eight|nine|ten)\s+mana\b/.test(text)) {
    return 1.25;
  }

  if (/\badd\s+two\s+mana\b/.test(text)) {
    return 1;
  }

  return 0.75;
}

function getPrimaryManaCost(card: ScryfallCard) {
  const candidates = [card.mana_cost, ...(card.card_faces ?? []).map((face) => face.mana_cost)]
    .filter((cost): cost is string => typeof cost === "string" && cost.length > 0);

  if (candidates.length === 0) {
    return "";
  }

  return candidates.sort((left, right) => countColoredManaSymbols(right) - countColoredManaSymbols(left))[0];
}

function countColoredManaSymbols(manaCost: string) {
  return (manaCost.match(/\{[WUBRG]\}/g) ?? []).length;
}

function getRampSegments(card: ScryfallCard) {
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

function detectKeywordReminderHits(
  card: ScryfallCard,
  hits: Map<RampTag, { weight: number; reasons: Set<string> }>,
) {
  const keywordNames = new Set(card.keywords.map((keyword) => keyword.toLowerCase()));
  const keywordLines = getKeywordReminderLines(card, keywordNames);

  for (const line of keywordLines) {
    const manaTokenInfo = getCreatedManaTokenInfo(line);

    if (hasReusableManaAbility(line)) {
      addHit(hits, "stable_ramp", 1, "Keyword reminder text includes reusable mana production.");
    }

    if (hasLandToBattlefieldRamp(line)) {
      addHit(hits, "land_acceleration", 1, "Keyword reminder text moves lands onto the battlefield.");
    }

    if (hasAdditionalLandPlay(line)) {
      addHit(hits, "land_acceleration", 0.75, "Keyword reminder text grants extra land drops.");
    }

    if (containsManaAddPhrase(line) || manaTokenInfo.count > 0) {
      addHit(
        hits,
        "burst_ramp",
        manaTokenInfo.count > 0 ? roundTo(Math.min(1.5, manaTokenInfo.count * 0.5), 2) : getBurstWeight(line),
        "Keyword reminder text generates temporary mana.",
      );
    }

    if (hasGlobalCostReduction(line)) {
      addHit(hits, "cost_reduction", 1, "Keyword reminder text reduces future spell costs.");
    }

    if (hasCastingAssistance(line)) {
      addHit(hits, "cost_reduction", 1, "Keyword reminder text converts permanents into mana while casting.");
    }

    if (hasAnyColorMana(line) || manaTokenInfo.count > 0) {
      addHit(hits, "mana_fixing", 0.75, "Keyword reminder text enables flexible mana.");
    }
  }
}

function getKeywordReminderLines(card: ScryfallCard, keywordNames: Set<string>) {
  const rawBlocks = [card.oracle_text, ...(card.card_faces ?? []).map((face) => face.oracle_text)]
    .filter((part): part is string => typeof part === "string" && part.length > 0);

  const lines = rawBlocks.flatMap((block) => block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));

  return lines
    .filter((line) => looksLikeKeywordReminderLine(line, keywordNames))
    .map((line) => normalizeText(line));
}

function looksLikeKeywordReminderLine(line: string, keywordNames: Set<string>) {
  const normalizedLine = line.toLowerCase();

  for (const keyword of keywordNames) {
    if (normalizedLine.startsWith(keyword)) {
      return true;
    }
  }

  return /^[a-z][a-z' -]*(?: \d+)?(?: \([^)]*\))$/i.test(line);
}

function hasTokenManaReminder(text: string) {
  return /\btoken is an artifact with\b[^"]*"sacrifice this token:\s*add\b/.test(text);
}

function hasLandManaTriggerBonus(text: string) {
  return (
    /\bwhenever enchanted [^.]* is tapped for mana\b/.test(text) ||
    /\bwhenever (?:you|a player|each player|an opponent)\s+tap(?:s)?\s+(?:a |an |one or more )?(?:basic )?(?:land|plains|island|swamp|mountain|forest|wastes?|desert|gate|cave|lair|locus|mine|power-plant|sphere|tower|urza's)\b[^.]*\bfor mana\b[^.]*\badds?\b/.test(text) ||
    /\bwhenever (?:a |an |one or more )?(?:basic )?(?:land|plains|island|swamp|mountain|forest|wastes?|desert|gate|cave|lair|locus|mine|power-plant|sphere|tower|urza's)(?:'s ability)?\b[^.]*\b(?:is tapped for mana|causes you to add)\b[^.]*\badds?\b/.test(text)
  );
}

function hasSearchToBattlefieldLandRamp(text: string) {
  const clause = getSearchToBattlefieldClause(text);
  return clause !== null && LAND_REFERENCE_PATTERN.test(clause);
}

function getSearchToBattlefieldClause(text: string) {
  const match = text.match(/\bsearch(?:es)? (?:your|their) library\b[\s\S]{0,240}?\bonto the battlefield\b/);
  return match?.[0] ?? null;
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

function calculateCardRampValue(hits: RampTagHit[]) {
  return hits.reduce((sum, hit) => {
    const displayWeight =
      hit.tag === "mana_fixing" ? 0.35
      : hit.tag === "cost_reduction" ? 0.85
      : 1;
    return sum + hit.weight * displayWeight;
  }, 0);
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

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
