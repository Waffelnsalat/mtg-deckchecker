import { CommanderColorProfile, getCommanderColorProfile } from "./commanderColorProfile";
import {
  computeMedianEffectiveManaValue,
  createEffectiveManaValueContext,
  estimateEffectiveManaValue,
  sumEffectiveManaValue,
} from "./effectiveManaValue";
import { DeckResolutionDocument, DeckStructureAnalysis, ResolvedDeckCard, ScryfallCard } from "./types";

export function analyzeDeckStructure(document: DeckResolutionDocument): DeckStructureAnalysis {
  const deckCards = document.result.resolvedCards.filter(
    (card) => card.section === "commander" || card.section === "mainboard",
  );
  const commanderCards = deckCards.filter((card) => card.section === "commander");
  const colorProfile = getCommanderColorProfile(deckCards);
  const effectiveManaContext = createEffectiveManaValueContext(deckCards);
  const counts = buildCompositionCounts(deckCards);
  const nonlandCards = deckCards.filter((card) => !hasCardType(card.card, "Land"));
  const nonlandQuantity = sumQuantities(nonlandCards);
  const averageManaValue = roundTo(
    nonlandQuantity === 0 ? 0 : sumEffectiveManaValue(nonlandCards, effectiveManaContext) / nonlandQuantity,
    2,
  );
  const medianManaValue = roundTo(
    computeMedianEffectiveManaValue(nonlandCards, effectiveManaContext),
    2,
  );
  const curve = buildManaCurve(nonlandCards, effectiveManaContext);
  const earlyShare = roundTo((curve.zeroToOne + curve.two) / Math.max(nonlandQuantity, 1), 3);
  const midShare = roundTo((curve.three + curve.four) / Math.max(nonlandQuantity, 1), 3);
  const lateShare = roundTo((curve.five + curve.sixPlus) / Math.max(nonlandQuantity, 1), 3);
  const recommendedLands = recommendLandRange(averageManaValue, earlyShare, lateShare);
  const findings = [
    assessLandCount(counts.lands, recommendedLands, averageManaValue),
    assessCreatureDensity(counts.creatures, counts, colorProfile),
    assessManaCurve(averageManaValue, earlyShare, lateShare),
  ];
  const structureScore = scoreStructure({
    landCount: counts.lands,
    creatureCount: counts.creatures,
    counts,
    colorProfile,
    averageManaValue,
    earlyShare,
    lateShare,
    recommendedLands,
  });

  return {
    structureScore,
    summary: summarizeStructureScore(structureScore),
    commanderName:
      commanderCards.length > 0
        ? commanderCards.map((card) => card.card.name).join(" + ")
        : "Unknown commander",
    counts,
    mana: {
      averageManaValue,
      medianManaValue,
      recommendedLands,
      curve,
      shares: {
        early: earlyShare,
        mid: midShare,
        late: lateShare,
      },
    },
    findings,
  };
}

function buildCompositionCounts(cards: ResolvedDeckCard[]) {
  const counts = {
    lands: 0,
    creatures: 0,
    artifacts: 0,
    enchantments: 0,
    instants: 0,
    sorceries: 0,
    planeswalkers: 0,
    battles: 0,
    other: 0,
    nonlandSpells: 0,
  };

  for (const card of cards) {
    const quantity = card.quantity;
    const matchedKnownType =
      hasCardType(card.card, "Creature") ||
      hasCardType(card.card, "Artifact") ||
      hasCardType(card.card, "Enchantment") ||
      hasCardType(card.card, "Instant") ||
      hasCardType(card.card, "Sorcery") ||
      hasCardType(card.card, "Planeswalker") ||
      hasCardType(card.card, "Battle");

    if (hasCardType(card.card, "Land")) {
      counts.lands += quantity;
    } else {
      counts.nonlandSpells += quantity;
    }

    if (hasCardType(card.card, "Creature")) {
      counts.creatures += quantity;
    }

    if (hasCardType(card.card, "Artifact")) {
      counts.artifacts += quantity;
    }

    if (hasCardType(card.card, "Enchantment")) {
      counts.enchantments += quantity;
    }

    if (hasCardType(card.card, "Instant")) {
      counts.instants += quantity;
    }

    if (hasCardType(card.card, "Sorcery")) {
      counts.sorceries += quantity;
    }

    if (hasCardType(card.card, "Planeswalker")) {
      counts.planeswalkers += quantity;
    }

    if (hasCardType(card.card, "Battle")) {
      counts.battles += quantity;
    }

    if (!hasCardType(card.card, "Land") && !matchedKnownType) {
      counts.other += quantity;
    }
  }

  return counts;
}

function buildManaCurve(cards: ResolvedDeckCard[], effectiveManaContext: ReturnType<typeof createEffectiveManaValueContext>) {
  const curve = {
    zeroToOne: 0,
    two: 0,
    three: 0,
    four: 0,
    five: 0,
    sixPlus: 0,
  };

  for (const card of cards) {
    const manaValue = estimateEffectiveManaValue(card.card, effectiveManaContext);

    if (manaValue <= 1) {
      curve.zeroToOne += card.quantity;
      continue;
    }

    if (manaValue <= 2) {
      curve.two += card.quantity;
      continue;
    }

    if (manaValue <= 3) {
      curve.three += card.quantity;
      continue;
    }

    if (manaValue <= 4) {
      curve.four += card.quantity;
      continue;
    }

    if (manaValue <= 5) {
      curve.five += card.quantity;
      continue;
    }

    curve.sixPlus += card.quantity;
  }

  return curve;
}

function recommendLandRange(averageManaValue: number, earlyShare: number, lateShare: number) {
  let target = 34;

  if (averageManaValue >= 2.6) {
    target += 1;
  }

  if (averageManaValue >= 2.9) {
    target += 1;
  }

  if (averageManaValue >= 3.2) {
    target += 1;
  }

  if (averageManaValue >= 3.5) {
    target += 1;
  }

  if (averageManaValue >= 3.8) {
    target += 1;
  }

  if (lateShare >= 0.12) {
    target += 1;
  }

  if (lateShare >= 0.2) {
    target += 1;
  }

  if (earlyShare >= 0.5) {
    target -= 1;
  }

  if (earlyShare >= 0.6) {
    target -= 1;
  }

  target = clamp(target, 32, 40);

  return {
    min: Math.max(30, target - 1),
    max: Math.min(41, target + 1),
    target,
  };
}

function assessLandCount(
  landCount: number,
  recommendedLands: { min: number; max: number; target: number },
  averageManaValue: number,
) {
  if (landCount < recommendedLands.min) {
    const status = landCount <= recommendedLands.min - 2 ? "risk" : "warning";
    return {
      code: "land_count_low",
      title: "Land count is low",
      status,
      message: `${landCount} lands is below the recommended ${recommendedLands.min}-${recommendedLands.max} range for an average mana value of ${averageManaValue.toFixed(2)}.`,
    } as const;
  }

  if (landCount > recommendedLands.max) {
    const status = landCount >= recommendedLands.max + 3 ? "warning" : "note";
    return {
      code: "land_count_high",
      title: "Land count is high",
      status,
      message: `${landCount} lands is above the recommended ${recommendedLands.min}-${recommendedLands.max} range. The deck may flood more often than necessary.`,
    } as const;
  }

  return {
    code: "land_count_fit",
    title: "Land count fits the curve",
    status: "good",
    message: `${landCount} lands sits inside the recommended ${recommendedLands.min}-${recommendedLands.max} range for this mana curve.`,
  } as const;
}

function assessCreatureDensity(
  creatureCount: number,
  counts: ReturnType<typeof buildCompositionCounts>,
  colorProfile: CommanderColorProfile,
) {
  const expectation = getCreatureExpectation(counts, colorProfile);

  if (creatureCount < expectation.low) {
    return {
      code: "creature_count_very_low",
      title: "Creature count is very low",
      status: expectation.shellCanBeLight ? "warning" : "risk",
      message: `${creatureCount} creatures is below the adjusted baseline of ${expectation.low} for this shell.${expectation.shellCanBeLight ? " Blue-heavy or artifact-heavy shells can get away with fewer creatures, but the list still needs a clear noncreature plan." : " The deck may struggle to keep board presence without a specific reason for being this light on creatures."}`,
    } as const;
  }

  if (creatureCount < expectation.healthy) {
    return {
      code: "creature_count_low",
      title: "Creature count is light",
      status: expectation.shellCanBeLight ? "note" : "warning",
      message: `${creatureCount} creatures is a little low for this shell.${expectation.shellCanBeLight ? " That can be normal in spell-heavy blue, black, or artifact decks." : " The deck may struggle to keep board presence without a specific plan."}`,
    } as const;
  }

  if (creatureCount > 40) {
    return {
      code: "creature_count_high",
      title: "Creature count is very high",
      status: "note",
      message: `${creatureCount} creatures gives the deck a strong board presence, but it can squeeze out interaction and utility slots if the curve is not low enough.`,
    } as const;
  }

  return {
    code: "creature_count_healthy",
    title: "Creature count looks healthy",
    status: "good",
    message: `${creatureCount} creatures is a solid baseline for maintaining pressure and board presence in Commander.`,
  } as const;
}

function assessManaCurve(averageManaValue: number, earlyShare: number, lateShare: number) {
  if (averageManaValue >= 3.8 || lateShare >= 0.32) {
    return {
      code: "curve_top_heavy",
      title: "Mana curve is top-heavy",
      status: "risk",
      message: `The average mana value is ${averageManaValue.toFixed(2)}, and ${Math.round(lateShare * 100)}% of nonland cards cost five or more. This shell will often start slowly.`,
    } as const;
  }

  if (averageManaValue >= 3.4 || lateShare >= 0.24 || earlyShare < 0.22) {
    return {
      code: "curve_slow",
      title: "Mana curve is a little slow",
      status: "warning",
      message: `The average mana value is ${averageManaValue.toFixed(2)}. The deck should still function, but it will want stronger mana support and cleaner early turns.`,
    } as const;
  }

  if (earlyShare >= 0.48 && lateShare <= 0.18) {
    return {
      code: "curve_low",
      title: "Mana curve is low and efficient",
      status: "good",
      message: `${Math.round(earlyShare * 100)}% of nonland cards cost two or less, so the deck should develop quickly and make good use of early mana.`,
    } as const;
  }

  return {
    code: "curve_balanced",
    title: "Mana curve looks balanced",
    status: "good",
    message: `The average mana value is ${averageManaValue.toFixed(2)}, with a reasonable spread between early, mid, and late-game cards.`,
  } as const;
}

function scoreStructure(input: {
  landCount: number;
  creatureCount: number;
  counts: ReturnType<typeof buildCompositionCounts>;
  colorProfile: CommanderColorProfile;
  averageManaValue: number;
  earlyShare: number;
  lateShare: number;
  recommendedLands: {
    min: number;
    max: number;
    target: number;
  };
}) {
  let score = 100;
  const creatureExpectation = getCreatureExpectation(input.counts, input.colorProfile);

  if (input.landCount < input.recommendedLands.min) {
    score -= 12 + (input.recommendedLands.min - input.landCount) * 4;
  } else if (input.landCount > input.recommendedLands.max) {
    score -= 8 + (input.landCount - input.recommendedLands.max) * 3;
  } else {
    score -= Math.abs(input.landCount - input.recommendedLands.target);
  }

  if (input.creatureCount < creatureExpectation.low) {
    score -= creatureExpectation.shellCanBeLight ? 10 : 18;
  } else if (input.creatureCount < creatureExpectation.healthy) {
    score -= creatureExpectation.shellCanBeLight ? 4 : 8;
  } else if (input.creatureCount > 42) {
    score -= 5;
  }

  if (input.lateShare >= 0.32) {
    score -= 16;
  } else if (input.lateShare >= 0.24) {
    score -= 8;
  }

  if (input.earlyShare < 0.18) {
    score -= 12;
  } else if (input.earlyShare < 0.28) {
    score -= 5;
  }

  if (input.averageManaValue >= 3.8) {
    score -= 10;
  } else if (input.averageManaValue >= 3.4) {
    score -= 4;
  }

  if (input.averageManaValue <= 2.2 && input.landCount > 38) {
    score -= 6;
  }

  return clamp(Math.round(score), 0, 100);
}

function summarizeStructureScore(score: number) {
  if (score >= 86) {
    return "Stable baseline for a Commander deck.";
  }

  if (score >= 72) {
    return "Healthy shell with a few structural flags.";
  }

  if (score >= 58) {
    return "Playable shell, but the basics are uneven.";
  }

  return "Structural risk is high before synergy even matters.";
}

function getCreatureExpectation(
  counts: ReturnType<typeof buildCompositionCounts>,
  colorProfile: CommanderColorProfile,
) {
  let low = 12;
  let healthy = 20;
  const spellHeavyNoncreatureShell =
    counts.instants + counts.sorceries + counts.artifacts >= counts.creatures + 15;
  const artifactControlShell =
    counts.artifacts >= 16 && (colorProfile.hasBlue || colorProfile.hasWhite);
  const shellCanBeLight =
    ((colorProfile.hasBlue || colorProfile.hasBlack) && spellHeavyNoncreatureShell) ||
    artifactControlShell ||
    (colorProfile.hasBlue && !colorProfile.hasGreen) ||
    (colorProfile.hasBlack && !colorProfile.hasGreen && !colorProfile.hasWhite);

  if (shellCanBeLight) {
    low -= 3;
    healthy -= 4;
  }

  if (colorProfile.hasGreen || colorProfile.hasWhite) {
    healthy += 1;
  }

  return {
    low: clamp(low, 8, 16),
    healthy: clamp(healthy, 14, 24),
    shellCanBeLight,
  };
}

function hasCardType(card: ScryfallCard, typeName: string) {
  if (card.type_line.includes(typeName)) {
    return true;
  }

  return (card.card_faces ?? []).some((face) => face.type_line?.includes(typeName));
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
