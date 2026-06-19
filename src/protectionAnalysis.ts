import {
  getRoleReason,
  getRoleWeight,
  inferAdvancedRoleProfile,
} from "./advancedCardScan";
import { applyEffectQualityDiscount } from "./activationCost";
import { applyCommanderAvailabilityToProtectionHits } from "./commanderAvailability";
import { CommanderColorProfile, getCommanderColorProfile } from "./commanderColorProfile";
import {
  createEffectiveManaValueContext,
  estimateEffectiveManaValue,
  sumEffectiveManaValue,
} from "./effectiveManaValue";
import {
  DeckProtectionAnalysis,
  DeckResolutionDocument,
  ProtectionTag,
  ProtectionTagHit,
  ProtectionTaggedCard,
  ResolvedDeckCard,
  ScryfallCard,
} from "./types";

interface ProtectionContext {
  deckCards: ResolvedDeckCard[];
  effectiveManaContext: ReturnType<typeof createEffectiveManaValueContext>;
  averageManaValue: number;
  colorProfile: CommanderColorProfile;
}

interface ProtectionProfile {
  weight: number;
  reason: string;
  repeatable?: boolean;
}

const PROTECTIVE_KEYWORD_PATTERN =
  /(?:hexproof|shroud|indestructible|ward(?:\s*\{[^}]+\})?|protection from(?: everything| all colors| each color| [^.,;"]+)?)/;

export function analyzeDeckProtection(document: DeckResolutionDocument): DeckProtectionAnalysis {
  const context = getProtectionContext(document);
  const taggedCards = context.deckCards
    .map((card) => {
      const hits = applyCommanderAvailabilityToProtectionHits(
        card.section,
        detectProtectionHits(card.card, context.effectiveManaContext),
      );

      if (hits.length === 0) {
        return null;
      }

      return {
        name: card.card.name,
        quantity: card.quantity,
        section: card.section,
        protectionValue: roundTo(totalWeight(hits), 2),
        hits,
      };
    })
    .filter((card): card is ProtectionTaggedCard => card !== null)
    .sort(
      (left, right) =>
        right.protectionValue - left.protectionValue || left.name.localeCompare(right.name),
    );

  const counts = {
    broad: 0,
    targeted: 0,
    equipment: 0,
    selfBounce: 0,
    flicker: 0,
  };

  for (const card of taggedCards) {
    for (const hit of card.hits) {
      const amount = roundTo(hit.weight * card.quantity, 2);

      if (hit.tag === "broad_protection") {
        counts.broad += amount;
      } else if (hit.tag === "targeted_protection") {
        counts.targeted += amount;
      } else if (hit.tag === "equipment_protection") {
        counts.equipment += amount;
      } else if (hit.tag === "self_bounce") {
        counts.selfBounce += amount;
      } else if (hit.tag === "flicker") {
        counts.flicker += amount;
      }
    }
  }

  counts.broad = roundTo(counts.broad, 2);
  counts.targeted = roundTo(counts.targeted, 2);
  counts.equipment = roundTo(counts.equipment, 2);
  counts.selfBounce = roundTo(counts.selfBounce, 2);
  counts.flicker = roundTo(counts.flicker, 2);

  const core = roundTo(
    counts.targeted +
      counts.broad * 1.2 +
      counts.equipment * 0.85 +
      counts.selfBounce * 0.35 +
      counts.flicker * 0.7,
    2,
  );
  const recommendations = {
    targetedTarget: recommendTargetedProtectionTarget(
      context.averageManaValue,
      context.colorProfile,
    ),
    broadTarget: recommendBroadProtectionTarget(context.averageManaValue, context.colorProfile),
    coreTarget: 0,
  };
  recommendations.coreTarget = roundTo(
    recommendations.targetedTarget + recommendations.broadTarget * 1.2 + 0.6,
    1,
  );

  const findings = [
    assessProtectionCore(core, recommendations.coreTarget, context.colorProfile),
    assessTargetedProtection(
      counts.targeted,
      counts.equipment,
      counts.selfBounce,
      counts.flicker,
      recommendations.targetedTarget,
      context.colorProfile,
    ),
    assessBroadProtection(
      counts.broad,
      counts.flicker,
      recommendations.broadTarget,
      context.colorProfile,
    ),
    assessProtectionUtility(counts.equipment, counts.selfBounce, counts.flicker),
  ];
  const protectionScore = scoreProtection({
    broad: counts.broad,
    targeted: counts.targeted,
    equipment: counts.equipment,
    selfBounce: counts.selfBounce,
    flicker: counts.flicker,
    core,
    recommendations,
  });

  return {
    protectionScore,
    summary: summarizeProtectionScore(protectionScore),
    counts: {
      core,
      broad: counts.broad,
      targeted: counts.targeted,
      equipment: counts.equipment,
      selfBounce: counts.selfBounce,
      flicker: counts.flicker,
    },
    recommendations,
    findings,
    taggedCards,
  };
}

function getProtectionContext(document: DeckResolutionDocument): ProtectionContext {
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

function detectProtectionHits(
  card: ScryfallCard,
  effectiveManaContext: ReturnType<typeof createEffectiveManaValueContext>,
): ProtectionTagHit[] {
  const hits = new Map<ProtectionTag, { weight: number; reasons: Set<string> }>();
  const segments = getProtectionSegments(card);
  const qualityText = segments.map((segment) => segment.text).join(" ");
  const effectiveManaValue = estimateEffectiveManaValue(card, effectiveManaContext);

  for (const segment of segments) {
    if (!segment.text) {
      continue;
    }

    const broad = getBroadProtectionProfile(segment.text);
    const targeted = getTargetedProtectionProfile(segment.typeLine, segment.text);
    const equipment = getEquipmentProtectionProfile(segment.typeLine, segment.text);
    const selfBounce = getSelfBounceProtectionProfile(segment.text);
    const flicker = getFlickerProtectionProfile(segment.text);

    if (broad) {
      addHit(
        hits,
        "broad_protection",
        estimateProtectionWeight(
          effectiveManaValue,
          "broad_protection",
          broad.weight,
          broad.repeatable,
        ),
        broad.reason,
      );
    }

    if (targeted) {
      addHit(
        hits,
        "targeted_protection",
        estimateProtectionWeight(
          effectiveManaValue,
          "targeted_protection",
          targeted.weight,
          targeted.repeatable,
        ),
        targeted.reason,
      );
    }

    if (equipment) {
      addHit(
        hits,
        "equipment_protection",
        estimateProtectionWeight(
          effectiveManaValue,
          "equipment_protection",
          equipment.weight,
          equipment.repeatable,
        ),
        equipment.reason,
      );
    }

    if (selfBounce) {
      addHit(
        hits,
        "self_bounce",
        estimateProtectionWeight(
          effectiveManaValue,
          "self_bounce",
          selfBounce.weight,
          selfBounce.repeatable,
        ),
        selfBounce.reason,
      );
    }

    if (flicker) {
      addHit(
        hits,
        "flicker",
        estimateProtectionWeight(
          effectiveManaValue,
          "flicker",
          flicker.weight,
          flicker.repeatable,
        ),
        flicker.reason,
      );
    }
  }

  const advancedProfile = hits.size === 0 ? inferAdvancedRoleProfile(card) : null;
  if (advancedProfile) {
    const mappings: Array<[ProtectionTag, string]> = [
      ["broad_protection", "broad_protection"],
      ["targeted_protection", "targeted_protection"],
      ["equipment_protection", "equipment_protection"],
      ["self_bounce", "self_bounce"],
      ["flicker", "flicker"],
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
  hits: Map<ProtectionTag, { weight: number; reasons: Set<string> }>,
  tag: ProtectionTag,
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

function getBroadProtectionProfile(text: string): ProtectionProfile | null {
  if (hasBroadPhasing(text)) {
    return {
      weight: 1.06,
      reason: "Broad phasing protects multiple permanents at once.",
    };
  }

  if (hasBroadKeywordProtection(text)) {
    return {
      weight: hasStaticBroadProtection(text) ? 1.05 : 0.96,
      reason: "Protects several permanents with broad shielding text.",
      repeatable: hasStaticBroadProtection(text),
    };
  }

  if (hasBroadDamageShield(text)) {
    return {
      weight: 0.8,
      reason: "Prevents a large amount of damage to your board.",
    };
  }

  if (hasCombatPhaseShield(text)) {
    return {
      weight: 0.72,
      reason: "Prevents an opponent's combat step, which protects your life total and key permanents from attacks.",
    };
  }

  if (hasBroadRegeneration(text)) {
    return {
      weight: 0.76,
      reason: "Can regenerate a wider part of the battlefield.",
    };
  }

  return null;
}

function getTargetedProtectionProfile(typeLine: string, text: string): ProtectionProfile | null {
  if (hasAttachedProtection(text) && !typeLine.includes("Equipment")) {
    return {
      weight: 0.9,
      reason: "Provides ongoing attached protection to a single permanent.",
      repeatable: true,
    };
  }

  if (hasTargetedPhasing(text)) {
    return {
      weight: isRepeatableProtectionText(text) ? 0.98 : 0.9,
      reason: "Phases out a single permanent to protect it.",
      repeatable: isRepeatableProtectionText(text),
    };
  }

  if (hasTargetedKeywordProtection(text)) {
    return {
      weight: isRepeatableProtectionText(text) ? 0.94 : 0.86,
      reason: "Gives a single permanent protective keywords like hexproof, indestructible, ward, or protection.",
      repeatable: isRepeatableProtectionText(text),
    };
  }

  if (hasTargetedDamageShield(text)) {
    return {
      weight: isRepeatableProtectionText(text) ? 0.76 : 0.66,
      reason: "Prevents damage to protect a single permanent in combat or burn exchanges.",
      repeatable: isRepeatableProtectionText(text),
    };
  }

  if (hasTargetedRegeneration(text)) {
    return {
      weight: isRepeatableProtectionText(text) ? 0.74 : 0.64,
      reason: "Regenerates a permanent to keep it on the battlefield.",
      repeatable: isRepeatableProtectionText(text),
    };
  }

  return null;
}

function getEquipmentProtectionProfile(typeLine: string, text: string): ProtectionProfile | null {
  if (!typeLine.includes("Equipment")) {
    return null;
  }

  const sentences = splitIntoSentences(text);
  const equipmentSentence = sentences.find(
    (sentence) =>
      /\bequipped (?:creature|permanent)\b[^.]{0,120}\bhas\b/.test(sentence) ||
      hasEquipmentActivatedProtection(sentence),
  );

  if (
    !equipmentSentence ||
    (!PROTECTIVE_KEYWORD_PATTERN.test(equipmentSentence) &&
      !hasEquipmentGrantedProtectionAbility(equipmentSentence) &&
      !hasEquipmentActivatedProtection(equipmentSentence))
  ) {
    return null;
  }

  const equipCost = getLowestEquipCost(text);
  const strength =
    /\bprotection from everything\b/.test(equipmentSentence) ||
      /\bindestructible\b/.test(equipmentSentence) ||
      /\bhexproof\b/.test(equipmentSentence) ||
      /\bshroud\b/.test(equipmentSentence)
        ? 0.96
        : hasEquipmentActivatedProtection(equipmentSentence)
          ? 0.92
        : /\b(?:phase out|phases out)\b/.test(equipmentSentence)
          ? 0.92
        : /\bprotection from\b/.test(equipmentSentence)
          ? 0.9
        : 0.78;
  const costAdjustment =
    equipCost <= 0 ? 0.12
    : equipCost === 1 ? 0.06
    : equipCost === 2 ? 0
    : equipCost === 3 ? -0.06
    : -0.12;

  return {
    weight: clamp(roundTo(strength + costAdjustment, 2), 0.68, 1.12),
    reason: "Equipment gives repeatable protection to the creature it supports.",
    repeatable: true,
  };
}

function getSelfBounceProtectionProfile(text: string): ProtectionProfile | null {
  if (!hasSelfBounce(text)) {
    return null;
  }

  return {
    weight: isRepeatableProtectionText(text) ? 0.68 : 0.54,
    reason: "Can save your own permanent by returning it to hand.",
    repeatable: isRepeatableProtectionText(text),
  };
}

function getFlickerProtectionProfile(text: string): ProtectionProfile | null {
  if (hasMassFlicker(text)) {
    return {
      weight: isRepeatableProtectionText(text) ? 1.02 : 0.92,
      reason: "Mass flicker can protect multiple permanents at once while reusing enters-the-battlefield value.",
      repeatable: isRepeatableProtectionText(text),
    };
  }

  if (hasSingleTargetFlicker(text)) {
    return {
      weight: isRepeatableProtectionText(text) ? 0.88 : 0.72,
      reason: "Single-target flicker can save a key permanent and reset it.",
      repeatable: isRepeatableProtectionText(text),
    };
  }

  return null;
}

function estimateProtectionWeight(
  cmc: number,
  tag: ProtectionTag,
  base: number,
  repeatable = false,
) {
  const curvePoint =
    tag === "broad_protection" ? 3
    : tag === "equipment_protection" ? 2
    : tag === "flicker" ? 3
    : 2;
  const penaltyPerStep =
    tag === "broad_protection" ? 0.045
    : tag === "equipment_protection" ? 0.04
    : tag === "flicker" ? 0.045
    : 0.055;
  const stepsPastCurve = Math.max(cmc - curvePoint, 0);
  let factor = 1 - stepsPastCurve * penaltyPerStep;

  if (repeatable) {
    factor += 0.04;
  }

  return roundTo(base * clamp(factor, 0.72, 1.08), 2);
}

function assessProtectionCore(
  core: number,
  target: number,
  colorProfile: CommanderColorProfile,
) {
  if (core < target - 1.2) {
    return {
      code: "protection_core_low",
      title: "Protection package is light",
      status: "warning",
      message: `${core.toFixed(2)} effective protection is below the target of ${target}. ${describeProtectionExpectations(colorProfile)}`,
    } as const;
  }

  if (core > target + 3.5) {
    return {
      code: "protection_core_high",
      title: "Protection package is dense",
      status: "note",
      message: `${core.toFixed(2)} effective protection is above the target of ${target}. The deck should defend key pieces often, but some slots may be overcommitted to shielding.`,
    } as const;
  }

  return {
    code: "protection_core_fit",
    title: "Protection package looks healthy",
    status: "good",
    message: `${core.toFixed(2)} effective protection lines up well with the target of ${target}.`,
  } as const;
}

function assessTargetedProtection(
  targeted: number,
  equipment: number,
  selfBounce: number,
  flicker: number,
  target: number,
  colorProfile: CommanderColorProfile,
) {
  const coverage = roundTo(
    targeted + equipment * 0.6 + selfBounce * 0.2 + flicker * 0.3,
    2,
  );

  if (targeted < 0.35 && coverage >= target) {
    return {
      code: "targeted_protection_supported",
      title: "Direct protection is light, but support is present",
      status: "note",
      message: `True targeted protection is low, but equipment, bounce, and flicker lift the effective coverage to ${coverage.toFixed(2)} against a target of ${target}.`,
    } as const;
  }

  if (coverage < target - 0.75) {
    return {
      code: "targeted_protection_low",
      title: "Single-target protection is low",
      status: "warning",
      message: `${coverage.toFixed(2)} effective single-target protection is below the target of ${target}. ${describeTargetedProtectionExpectations(colorProfile)}`,
    } as const;
  }

  return {
    code: "targeted_protection_fit",
    title: "Single-target protection is on pace",
    status: "good",
    message: `${coverage.toFixed(2)} effective single-target protection is close to the target of ${target}.`,
  } as const;
}

function assessBroadProtection(
  broad: number,
  flicker: number,
  target: number,
  colorProfile: CommanderColorProfile,
) {
  const coverage = roundTo(broad + flicker * 0.35, 2);

  if (target <= 0) {
    return {
      code: "broad_protection_optional",
      title: "Broad protection is optional here",
      status: coverage > 0 ? "good" : "note",
      message:
        coverage > 0
          ? `${coverage.toFixed(2)} broad protection coverage is a useful bonus for this color identity.`
          : "This color identity is not expected to rely on a dense package of broad protection effects.",
    } as const;
  }

  if (coverage < target - 0.6) {
    return {
      code: "broad_protection_low",
      title: "Broad protection is light",
      status: "note",
      message: `${coverage.toFixed(2)} broad protection coverage is below the target of ${target}. ${describeBroadProtectionExpectations(colorProfile)}`,
    } as const;
  }

  return {
    code: "broad_protection_fit",
    title: "Broad protection looks healthy",
    status: "good",
    message: `${coverage.toFixed(2)} broad protection coverage is near the target of ${target}.`,
  } as const;
}

function assessProtectionUtility(equipment: number, selfBounce: number, flicker: number) {
  const utility = roundTo(equipment + selfBounce + flicker, 2);

  if (utility <= 0) {
    return {
      code: "protection_utility_none",
      title: "Utility protection is absent",
      status: "note",
      message: "The deck has no equipment, self-bounce, or flicker support helping to protect key pieces.",
    } as const;
  }

  if (utility >= 3.5) {
    return {
      code: "protection_utility_dense",
      title: "Utility protection is dense",
      status: "good",
      message: `${utility.toFixed(2)} utility protection from equipment, bounce, or flicker gives the shell multiple backup lines.`,
    } as const;
  }

  return {
    code: "protection_utility_present",
    title: "Utility protection is present",
    status: "good",
    message: `${utility.toFixed(2)} utility protection adds resilience through equipment, bounce, or flicker support.`,
  } as const;
}

function scoreProtection(input: {
  core: number;
  broad: number;
  targeted: number;
  equipment: number;
  selfBounce: number;
  flicker: number;
  recommendations: {
    coreTarget: number;
    broadTarget: number;
    targetedTarget: number;
  };
}) {
  const targetedCoverage = roundTo(
    input.targeted + input.equipment * 0.6 + input.selfBounce * 0.2 + input.flicker * 0.3,
    2,
  );
  const broadCoverage = roundTo(input.broad + input.flicker * 0.35, 2);
  const utility = roundTo(input.equipment + input.selfBounce + input.flicker, 2);
  let score = 70;

  score += calculateTargetBonus(input.core, input.recommendations.coreTarget, 5);
  score += calculateTargetBonus(targetedCoverage, input.recommendations.targetedTarget, 4.5);

  if (input.recommendations.broadTarget > 0) {
    score += calculateTargetBonus(broadCoverage, input.recommendations.broadTarget, 2.5);
  }

  if (utility >= 1.25) {
    score += Math.min(utility - 1.25, 2);
  }

  score -= calculateUnderPenalty(input.core, input.recommendations.coreTarget, 6.5, 4.2);
  score -= calculateOverPenalty(input.core, input.recommendations.coreTarget, 3.25, 0.55);
  score -= calculateUnderPenalty(targetedCoverage, input.recommendations.targetedTarget, 5.2, 3.2);
  score -= calculateOverPenalty(targetedCoverage, input.recommendations.targetedTarget, 2.5, 0.45);

  if (input.recommendations.broadTarget > 0) {
    score -= calculateUnderPenalty(broadCoverage, input.recommendations.broadTarget, 1.8, 1.8);
    score -= calculateOverPenalty(broadCoverage, input.recommendations.broadTarget, 1.75, 0.35);
  }

  if (input.targeted < 0.25 && input.equipment + input.flicker < 1.25) {
    score -= 3;
  }

  return clamp(Math.round(score), 0, 100);
}

function summarizeProtectionScore(score: number) {
  if (score >= 86) {
    return "Protection package is strong and well-rounded.";
  }

  if (score >= 72) {
    return "Protection package is healthy, with a few tuning points.";
  }

  if (score >= 58) {
    return "Protection package is playable, but uneven.";
  }

  return "Protection package is underbuilt for defending key pieces.";
}

function recommendTargetedProtectionTarget(
  averageManaValue: number,
  colorProfile: CommanderColorProfile,
) {
  let target = 1;

  if (colorProfile.hasWhite || colorProfile.hasGreen || colorProfile.hasBlue) {
    target += 1;
  }

  if (averageManaValue >= 3.2) {
    target += 1;
  }

  if (averageManaValue <= 2.2) {
    target -= 1;
  }

  return clamp(target, 1, 3);
}

function recommendBroadProtectionTarget(
  averageManaValue: number,
  colorProfile: CommanderColorProfile,
) {
  let target = 0;

  if (colorProfile.hasWhite || colorProfile.hasGreen) {
    target += 1;
  } else if (colorProfile.hasBlue && averageManaValue >= 2.8) {
    target += 1;
  }

  if (averageManaValue >= 3.8 && (colorProfile.hasWhite || colorProfile.hasGreen || colorProfile.hasBlue)) {
    target += 1;
  }

  return clamp(target, 0, 2);
}

function describeProtectionExpectations(colorProfile: CommanderColorProfile) {
  if (colorProfile.hasWhite && colorProfile.hasBlue) {
    return "White-blue shells usually cover this with indestructible, phasing, flicker, or equipment.";
  }

  if (colorProfile.hasWhite) {
    return "White shells usually cover this with indestructible, protection effects, blink, or equipment.";
  }

  if (colorProfile.hasGreen) {
    return "Green shells usually cover this with hexproof-style spells and a few broader shields.";
  }

  if (colorProfile.hasBlue) {
    return "Blue shells usually cover this with phasing, bounce, blink, or equipment rather than indestructible.";
  }

  return "This color identity usually leans more on selective shielding, equipment, or utility protection than on dense broad shields.";
}

function describeTargetedProtectionExpectations(colorProfile: CommanderColorProfile) {
  if (colorProfile.hasWhite || colorProfile.hasGreen || colorProfile.hasBlue) {
    return "These colors usually have access to a few clean single-target shields.";
  }

  return "These colors often lean on boots, bounce, or a small number of selective protection effects instead of a deep package.";
}

function describeBroadProtectionExpectations(colorProfile: CommanderColorProfile) {
  if (colorProfile.hasWhite) {
    return "White often covers this with team indestructible, phasing, or blink effects.";
  }

  if (colorProfile.hasGreen) {
    return "Green often covers this with broad hexproof or indestructible effects.";
  }

  if (colorProfile.hasBlue) {
    return "Blue usually relies on a few phasing or blink effects rather than many broad shields.";
  }

  return "Broad protection is not expected to be dense here, but one clean effect still helps against sweepers.";
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

    if (diff <= 1.25) {
      return maxBonus * 0.72;
    }

    if (diff <= 2.25) {
      return maxBonus * 0.35;
    }

    return 0;
  }

  const shortfall = target - actual;

  if (shortfall <= 0.3) {
    return maxBonus * 0.8;
  }

  if (shortfall <= 0.75) {
    return maxBonus * 0.45;
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
    penalty += (shortfall - 1.2) * rate * 0.4;
  }

  return penalty;
}

function calculateOverPenalty(actual: number, target: number, grace: number, rate: number) {
  if (target <= 0 || actual <= target + grace) {
    return 0;
  }

  return (actual - target - grace) * rate;
}

function getProtectionSegments(card: ScryfallCard) {
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

function hasBroadKeywordProtection(text: string) {
  return (
    /\b(?:other )?(?:creatures|permanents|artifacts|enchantments|tokens|nonland permanents) you control (?:gain|have)\b[^.]{0,160}(?:hexproof|shroud|indestructible|ward|protection from)\b/.test(
      text,
    ) ||
    /\beach\b[^.]{0,80}\b(?:creature|permanent)\b[^.]{0,60}\byou control\b[^.]{0,120}(?:gain|has|have)\b[^.]{0,120}(?:hexproof|shroud|indestructible|ward|protection from)\b/.test(
      text,
    )
  );
}

function hasStaticBroadProtection(text: string) {
  return (
    /\b(?:other )?(?:creatures|permanents|artifacts|enchantments|tokens|nonland permanents) you control have\b[^.]{0,160}(?:hexproof|shroud|indestructible|ward|protection from)\b/.test(
      text,
    ) &&
    !/\buntil end of turn\b/.test(text)
  );
}

function hasBroadPhasing(text: string) {
  return (
    /\ball permanents you control phase out\b/.test(text) ||
    /\b(?:creatures|permanents) you control phase out\b/.test(text) ||
    /\beach\b[^.]{0,80}\b(?:creature|permanent)\b[^.]{0,60}\byou control\b[^.]{0,120}\bphases out\b/.test(
      text,
    )
  );
}

function hasBroadDamageShield(text: string) {
  return (
    /\bprevent all damage that would be dealt to\b[^.]{0,120}\b(?:creatures|permanents) you control\b/.test(
      text,
    ) ||
    /\bif damage would be dealt to\b[^.]{0,120}\b(?:creatures|permanents) you control\b[^.]{0,140}\bprevent that damage\b/.test(
      text,
    )
  );
}

function hasCombatPhaseShield(text: string) {
  return /\btarget opponent skips? (?:their|his or her) next combat phase\b/.test(text);
}

function hasBroadRegeneration(text: string) {
  return (
    /\bregenerate each creature you control\b/.test(text) ||
    /\b(?:creatures|other creatures) you control gain\b[^.]{0,120}\bregenerate\b/.test(text)
  );
}

function hasTargetedKeywordProtection(text: string) {
  return splitIntoSentences(text).some(
    (sentence) =>
      /\b(?:another |up to one |any )?target\b[^.]{0,120}\b(?:creature|permanent|artifact|enchantment|planeswalker|commander)\b[^.]{0,140}\b(?:gain|gains|has)\b[^.]{0,140}(?:hexproof|shroud|indestructible|ward|protection from)\b/.test(
        sentence,
      ) && !/\btarget opponent\b/.test(sentence),
  );
}

function hasTargetedPhasing(text: string) {
  return splitIntoSentences(text).some(
    (sentence) =>
      /\b(?:another |up to one |any )?target\b[^.]{0,120}\b(?:creature|permanent|artifact|enchantment|planeswalker|commander)\b[^.]{0,140}\b(?:phase out|phases out)\b/.test(
        sentence,
      ) && !/\btarget opponent\b/.test(sentence),
  );
}

function hasTargetedDamageShield(text: string) {
  return splitIntoSentences(text).some((sentence) =>
    /\bprevent all damage that would be dealt to\b[^.]{0,120}\btarget\b[^.]{0,100}\b(?:creature|permanent|artifact|enchantment|planeswalker|commander)\b/.test(
      sentence,
    ),
  );
}

function hasTargetedRegeneration(text: string) {
  return splitIntoSentences(text).some(
    (sentence) =>
      /\bregenerate\b[^.]{0,80}\btarget\b[^.]{0,100}\b(?:creature|permanent|artifact)\b/.test(
        sentence,
      ) ||
      /\btarget\b[^.]{0,120}\b(?:creature|permanent|artifact)\b[^.]{0,120}\bgains? regenerate\b/.test(
        sentence,
      ),
  );
}

function hasAttachedProtection(text: string) {
  return splitIntoSentences(text).some(
    (sentence) =>
      /\benchanted (?:creature|permanent) has\b[^.]{0,120}(?:hexproof|shroud|indestructible|ward|protection from)\b/.test(
        sentence,
      ) ||
      /\bfortified land has\b[^.]{0,120}(?:hexproof|shroud|indestructible|ward|protection from)\b/.test(
        sentence,
      ),
  );
}

function hasEquipmentGrantedProtectionAbility(sentence: string) {
  return (
    /\bequipped (?:creature|permanent)\b[^.]{0,140}\bhas\b[^.]{0,220}\b(?:phase out|phases out)\b/.test(
      sentence,
    ) ||
    /\bequipped (?:creature|permanent)\b[^.]{0,140}\bhas\b[^.]{0,220}\breturn this (?:creature|permanent) to (?:its|their) owner's hand\b/.test(
      sentence,
    ) ||
    /\bequipped (?:creature|permanent)\b[^.]{0,140}\bhas\b[^.]{0,220}\bexile this (?:creature|permanent)\b[^.]{0,140}\breturn (?:it|this card)\b[^.]{0,120}\bto the battlefield\b/.test(
      sentence,
    ) ||
    /\bequipped (?:creature|permanent)\b[^.]{0,140}\bhas\b[^.]{0,220}\bregenerate this (?:creature|permanent)\b/.test(
      sentence,
    )
  );
}

function hasEquipmentActivatedProtection(sentence: string) {
  return (
    /\{[^}]+\}\s*:\s*equipped (?:creature|permanent)\b[^.]{0,160}\b(?:phase out|phases out)\b/.test(
      sentence,
    ) ||
    /\{[^}]+\}\s*:\s*return equipped (?:creature|permanent)\b[^.]{0,160}\bto (?:its|their) owner's hand\b/.test(
      sentence,
    ) ||
    /\{[^}]+\}\s*:\s*exile equipped (?:creature|permanent)\b[^.]{0,180}\breturn (?:it|that card)\b[^.]{0,120}\bto the battlefield\b/.test(
      sentence,
    ) ||
    /\{[^}]+\}\s*:\s*regenerate equipped (?:creature|permanent)\b/.test(sentence)
  );
}

function hasSelfBounce(text: string) {
  return splitIntoSentences(text).some((sentence) =>
    /\breturn\b[^.]{0,60}\b(?:another |up to one )?target\b[^.]{0,120}\b(?:creature|permanent|artifact|enchantment|planeswalker|nonland permanent)\b[^.]{0,100}\b(?:you control|you own)\b[^.]{0,120}\bto (?:its|their) owner's hand\b/.test(
      sentence,
    ),
  );
}

function hasSingleTargetFlicker(text: string) {
  return splitIntoSentences(text).some(
    (sentence) =>
      /\bexile\b[^.]{0,120}\b(?:another |up to one )?target\b[^.]{0,140}\b(?:creature|permanent|artifact|enchantment|planeswalker|nonland permanent)\b[^.]{0,180}\breturn (?:it|that card)\b[^.]{0,120}\bto the battlefield\b/.test(
        sentence,
      ) && !/\buntil\b[^.]{0,100}\bleaves the battlefield\b/.test(sentence),
  );
}

function hasMassFlicker(text: string) {
  return (
    /\bexile any number of target\b[^.]{0,140}\b(?:creatures|permanents)\b[^.]{0,200}\breturn those cards\b[^.]{0,140}\bto the battlefield\b/.test(
      text,
    ) ||
    /\bexile each\b[^.]{0,120}\b(?:creature|permanent)\b[^.]{0,120}\byou control\b[^.]{0,200}\breturn those cards\b[^.]{0,140}\bto the battlefield\b/.test(
      text,
    ) ||
    /\bexile all\b[^.]{0,120}\b(?:creatures|permanents)\b[^.]{0,120}\byou control\b[^.]{0,200}\breturn those cards\b[^.]{0,140}\bto the battlefield\b/.test(
      text,
    ) ||
    /\bexile (?:each|all)\b[^.]{0,120}\b(?:creature|permanent)s?\b[^.]{0,120}\byou control\b[\s\S]{0,220}\breturn those cards\b[\s\S]{0,160}\bto the battlefield\b/.test(
      text,
    )
  );
}

function isRepeatableProtectionText(text: string) {
  return (
    /\{[^}]+\}\s*:\s*/.test(text) ||
    /\bat the beginning of\b/.test(text) ||
    /\bwhenever\b/.test(text) ||
    /\bequipped creature has\b/.test(text) ||
    /\benchanted (?:creature|permanent) has\b/.test(text) ||
    /\b(?:creatures|permanents) you control have\b/.test(text)
  );
}

function getLowestEquipCost(text: string) {
  const matches = [...text.matchAll(/\bequip(?: [^.]*)?\s*\{(?<cost>\d+)\}/g)];
  const numericCosts = matches
    .map((match) => Number.parseInt(match.groups?.cost ?? "", 10))
    .filter((cost) => Number.isFinite(cost));

  if (numericCosts.length === 0) {
    return 2;
  }

  return Math.min(...numericCosts);
}

function splitIntoSentences(text: string) {
  return text
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
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

  return card.card_faces?.some((face) => face.type_line?.includes(typeName)) ?? false;
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
