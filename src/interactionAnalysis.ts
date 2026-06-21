import {
  getRoleReason,
  getRoleWeight,
  inferAdvancedRoleProfile,
} from "./advancedCardScan";
import { applyEffectQualityDiscount } from "./activationCost";
import {
  applyCommanderAvailabilityToRemovalHits,
  applyCommanderAvailabilityToSpellInteractionHits,
} from "./commanderAvailability";
import { getCommanderColorProfile } from "./commanderColorProfile";
import {
  createEffectiveManaValueContext,
  estimateEffectiveManaValue,
  sumEffectiveManaValue,
} from "./effectiveManaValue";
import {
  DeckRemovalAnalysis,
  DeckResolutionDocument,
  DeckSpellInteractionAnalysis,
  RemovalTag,
  RemovalTagHit,
  RemovalTaggedCard,
  ResolvedDeckCard,
  ScryfallCard,
  SpellInteractionTag,
  SpellInteractionTagHit,
  SpellInteractionTaggedCard,
} from "./types";

interface DeckContext {
  deckCards: ResolvedDeckCard[];
  effectiveManaContext: ReturnType<typeof createEffectiveManaValueContext>;
  averageManaValue: number;
  hasBlue: boolean;
  hasBlack: boolean;
  hasWhite: boolean;
  hasRed: boolean;
  hasGreen: boolean;
  colorCount: number;
}

export function analyzeDeckRemoval(document: DeckResolutionDocument): DeckRemovalAnalysis {
  const context = getDeckContext(document);
  const taggedCards = context.deckCards
    .map((card) => {
      const hits = applyCommanderAvailabilityToRemovalHits(
        card.section,
        detectRemovalHits(card.card, context.effectiveManaContext),
      );

      if (hits.length === 0) {
        return null;
      }

      return {
        name: card.card.name,
        quantity: card.quantity,
        section: card.section,
        removalValue: roundTo(totalWeight(hits), 2),
        hits,
      };
    })
    .filter((card): card is RemovalTaggedCard => card !== null)
    .sort((left, right) => right.removalValue - left.removalValue || left.name.localeCompare(right.name));

  const counts = {
    targeted: 0,
    mass: 0,
    tempo: 0,
    handAttack: 0,
  };

  for (const card of taggedCards) {
    for (const hit of card.hits) {
      const amount = roundTo(hit.weight * card.quantity, 2);

      if (hit.tag === "targeted_removal") {
        counts.targeted += amount;
      } else if (hit.tag === "mass_removal") {
        counts.mass += amount;
      } else if (hit.tag === "tempo_removal") {
        counts.tempo += amount;
      } else if (hit.tag === "hand_attack") {
        counts.handAttack += amount;
      }
    }
  }

  counts.targeted = roundTo(counts.targeted, 2);
  counts.mass = roundTo(counts.mass, 2);
  counts.tempo = roundTo(counts.tempo, 2);
  counts.handAttack = roundTo(counts.handAttack, 2);

  const recommendations = {
    targetedTarget: recommendTargetedRemovalTarget(context),
    massTarget: recommendMassRemovalTarget(context),
    tempoTarget: recommendTempoRemovalTarget(context),
    handTarget: recommendHandAttackTarget(context.hasBlack),
  };
  const core = roundTo(
    counts.targeted + counts.mass * 1.7 + counts.tempo * 0.55 + counts.handAttack * 0.45,
    2,
  );
  const coreTarget = roundTo(
    recommendations.targetedTarget +
      recommendations.massTarget * 1.7 +
      recommendations.tempoTarget * 0.55 +
      recommendations.handTarget * 0.45,
    2,
  );
  const removalScore = scoreRemoval({
    core,
    targeted: counts.targeted,
    mass: counts.mass,
    tempo: counts.tempo,
    handAttack: counts.handAttack,
    tempoCoverageFactor: getTempoCoverageFactor(context),
    recommendations: {
      ...recommendations,
      coreTarget,
    },
  });

  return {
    removalScore,
    summary: summarizeRemovalScore(removalScore),
    counts: {
      core,
      targeted: counts.targeted,
      mass: counts.mass,
      tempo: counts.tempo,
      handAttack: counts.handAttack,
    },
    recommendations: {
      ...recommendations,
      coreTarget,
    },
    findings: [
      assessRemovalCore(core, coreTarget),
      assessTargetedRemoval(
        counts.targeted,
        recommendations.targetedTarget,
        counts.tempo,
        getTempoCoverageFactor(context),
        context.hasBlue,
      ),
      assessMassRemoval(counts.mass, recommendations.massTarget),
      assessTempoRemoval(counts.tempo, recommendations.tempoTarget, counts.targeted),
      assessHandAttack(counts.handAttack, recommendations.handTarget, context.hasBlack),
    ],
    taggedCards,
  };
}

export function analyzeDeckSpellInteraction(
  document: DeckResolutionDocument,
): DeckSpellInteractionAnalysis {
  const context = getDeckContext(document);
  const taggedCards = context.deckCards
    .map((card) => {
      const hits = applyCommanderAvailabilityToSpellInteractionHits(
        card.section,
        detectSpellInteractionHits(card.card, context.effectiveManaContext),
      );

      if (hits.length === 0) {
        return null;
      }

      return {
        name: card.card.name,
        quantity: card.quantity,
        section: card.section,
        interactionValue: roundTo(totalWeight(hits), 2),
        hits,
      };
    })
    .filter((card): card is SpellInteractionTaggedCard => card !== null)
    .sort(
      (left, right) =>
        right.interactionValue - left.interactionValue || left.name.localeCompare(right.name),
    );

  const counts = {
    hard: 0,
    soft: 0,
    spellTempo: 0,
    broad: 0,
    stax: 0,
    graveyardHate: 0,
  };

  for (const card of taggedCards) {
    for (const hit of card.hits) {
      const amount = roundTo(hit.weight * card.quantity, 2);

      if (hit.tag === "hard_stack") {
        counts.hard += amount;
      } else if (hit.tag === "soft_stack") {
        counts.soft += amount;
      } else if (hit.tag === "spell_tempo") {
        counts.spellTempo += amount;
      } else if (hit.tag === "broad_stack") {
        counts.broad += amount;
      } else if (hit.tag === "stax_piece") {
        counts.stax += amount;
      } else if (hit.tag === "graveyard_hate") {
        counts.graveyardHate += amount;
      }
    }
  }

  counts.hard = roundTo(counts.hard, 2);
  counts.soft = roundTo(counts.soft, 2);
  counts.spellTempo = roundTo(counts.spellTempo, 2);
  counts.broad = roundTo(counts.broad, 2);
  counts.stax = roundTo(counts.stax, 2);
  counts.graveyardHate = roundTo(counts.graveyardHate, 2);

  const recommendations = {
    hardTarget: recommendHardStackTarget(context.averageManaValue, context.hasBlue),
    softTarget: recommendSoftStackTarget(context.averageManaValue, context.hasBlue),
  };
  const core = roundTo(
    counts.hard +
      counts.soft * 0.8 +
      counts.spellTempo * 0.72 +
      counts.broad * 0.9 +
      counts.stax * 0.65 +
      counts.graveyardHate * 0.52,
    2,
  );
  const coreTarget =
    recommendations.hardTarget <= 0
      ? 0
      : roundTo(recommendations.hardTarget + recommendations.softTarget * 0.8 + 0.5, 2);
  const interactionScore = scoreSpellInteraction({
    core,
    hard: counts.hard,
    soft: counts.soft,
    spellTempo: counts.spellTempo,
    broad: counts.broad,
    stax: counts.stax,
    graveyardHate: counts.graveyardHate,
    recommendations: {
      ...recommendations,
      coreTarget,
    },
  });

  return {
    interactionScore,
    summary: summarizeSpellInteractionScore(interactionScore, context.hasBlue),
    counts: {
      core,
      hard: counts.hard,
      soft: counts.soft,
      spellTempo: counts.spellTempo,
      broad: counts.broad,
      stax: counts.stax,
      graveyardHate: counts.graveyardHate,
    },
    recommendations: {
      ...recommendations,
      coreTarget,
    },
    findings: [
      assessSpellInteractionCore(core, coreTarget, context.hasBlue),
      assessHardStack(counts.hard, recommendations.hardTarget, context.hasBlue),
      assessSoftStack(counts.soft, counts.spellTempo, recommendations.softTarget, context.hasBlue),
      assessBroadStack(counts.broad),
      assessStaxPieces(counts.stax),
      assessGraveyardHate(counts.graveyardHate),
    ],
    taggedCards,
  };
}

function getDeckContext(document: DeckResolutionDocument): DeckContext {
  const deckCards = document.result.resolvedCards.filter(
    (card) => card.section === "commander" || card.section === "mainboard",
  );
  const colorProfile = getCommanderColorProfile(deckCards);
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
    hasBlue: colorProfile.hasBlue,
    hasBlack: colorProfile.hasBlack,
    hasWhite: colorProfile.hasWhite,
    hasRed: colorProfile.hasRed,
    hasGreen: colorProfile.hasGreen,
    colorCount: colorProfile.colorCount,
  };
}

function detectRemovalHits(
  card: ScryfallCard,
  effectiveManaContext: ReturnType<typeof createEffectiveManaValueContext>,
): RemovalTagHit[] {
  const hits = new Map<RemovalTag, { weight: number; reasons: Set<string> }>();
  const segments = getInteractionSegments(card);
  const qualityText = segments.map((segment) => segment.text).join(" ");
  const effectiveManaValue = estimateEffectiveManaValue(card, effectiveManaContext);

  for (const segment of segments) {
    if (!segment.text) {
      continue;
    }

    const targeted = getTargetedRemovalProfile(segment.text);
    const mass = getMassRemovalProfile(segment.text);
    const tempo = getTempoRemovalProfile(segment.text);
    const handAttack = getHandAttackProfile(segment.text);

    if (targeted) {
      addWeightedHit(
        hits,
        "targeted_removal",
        estimateRemovalWeight(effectiveManaValue, "targeted_removal", targeted.weight),
        targeted.reason,
      );
    }

    if (mass) {
      addWeightedHit(
        hits,
        "mass_removal",
        estimateRemovalWeight(effectiveManaValue, "mass_removal", mass.weight),
        mass.reason,
      );
    }

    if (tempo) {
      addWeightedHit(
        hits,
        "tempo_removal",
        estimateRemovalWeight(effectiveManaValue, "tempo_removal", tempo.weight),
        tempo.reason,
      );
    }

    if (handAttack) {
      addWeightedHit(
        hits,
        "hand_attack",
        estimateRemovalWeight(effectiveManaValue, "hand_attack", handAttack.weight),
        handAttack.reason,
      );
    }
  }

  const advancedProfile = hits.size === 0 ? inferAdvancedRoleProfile(card) : null;
  if (advancedProfile) {
    const mappings: Array<[RemovalTag, string]> = [
      ["targeted_removal", "targeted_removal"],
      ["mass_removal", "mass_removal"],
      ["tempo_removal", "tempo_removal"],
      ["hand_attack", "hand_attack"],
    ];

    for (const [tag, role] of mappings) {
      const weight = getRoleWeight(advancedProfile, role);
      if (weight <= 0) {
        continue;
      }

      addWeightedHit(hits, tag, weight, getRoleReason(advancedProfile, role));
    }
  }

  return [...hits.entries()].map(([tag, value]) => ({
    tag,
    weight: roundTo(applyEffectQualityDiscount(value.weight, qualityText), 2),
    reason: [...value.reasons].join(" "),
  }));
}

function detectSpellInteractionHits(
  card: ScryfallCard,
  effectiveManaContext: ReturnType<typeof createEffectiveManaValueContext>,
): SpellInteractionTagHit[] {
  const hits = new Map<SpellInteractionTag, { weight: number; reasons: Set<string> }>();
  const segments = getInteractionSegments(card);
  const qualityText = segments.map((segment) => segment.text).join(" ");
  const effectiveManaValue = estimateEffectiveManaValue(card, effectiveManaContext);

  for (const segment of segments) {
    if (!segment.text) {
      continue;
    }

    const hard = getHardStackProfile(segment.text);
    const soft = getSoftStackProfile(segment.text);
    const spellTempo = getSpellTempoProfile(segment.text);
    const broad = getBroadStackProfile(segment.text);
    const stax = getStaxProfile(segment.text);
    const graveyardHate = getGraveyardHateProfile(segment.text);

    if (hard) {
      addWeightedHit(
        hits,
        "hard_stack",
        estimateSpellInteractionWeight(effectiveManaValue, "hard_stack", hard.weight),
        hard.reason,
      );
    }

    if (soft) {
      addWeightedHit(
        hits,
        "soft_stack",
        estimateSpellInteractionWeight(effectiveManaValue, "soft_stack", soft.weight),
        soft.reason,
      );
    }

    if (spellTempo) {
      addWeightedHit(
        hits,
        "spell_tempo",
        estimateSpellInteractionWeight(effectiveManaValue, "spell_tempo", spellTempo.weight),
        spellTempo.reason,
      );
    }

    if (broad) {
      addWeightedHit(
        hits,
        "broad_stack",
        estimateSpellInteractionWeight(effectiveManaValue, "broad_stack", broad.weight),
        broad.reason,
      );
    }

    if (stax) {
      addWeightedHit(
        hits,
        "stax_piece",
        estimateSpellInteractionWeight(effectiveManaValue, "stax_piece", stax.weight),
        stax.reason,
      );
    }

    if (graveyardHate) {
      addWeightedHit(
        hits,
        "graveyard_hate",
        estimateSpellInteractionWeight(effectiveManaValue, "graveyard_hate", graveyardHate.weight),
        graveyardHate.reason,
      );
    }
  }

  const advancedProfile = hits.size === 0 ? inferAdvancedRoleProfile(card) : null;
  if (advancedProfile) {
    const mappings: Array<[SpellInteractionTag, string]> = [
      ["hard_stack", "hard_stack"],
      ["soft_stack", "soft_stack"],
      ["spell_tempo", "spell_tempo"],
      ["broad_stack", "broad_stack"],
      ["stax_piece", "hate_piece"],
      ["graveyard_hate", "graveyard_hate"],
    ];

    for (const [tag, role] of mappings) {
      const weight = getRoleWeight(advancedProfile, role);
      if (weight <= 0) {
        continue;
      }

      addWeightedHit(hits, tag, weight, getRoleReason(advancedProfile, role));
    }
  }

  return [...hits.entries()].map(([tag, value]) => ({
    tag,
    weight: roundTo(applyEffectQualityDiscount(value.weight, qualityText), 2),
    reason: [...value.reasons].join(" "),
  }));
}

function addWeightedHit<Tag extends string>(
  hits: Map<Tag, { weight: number; reasons: Set<string> }>,
  tag: Tag,
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

function getTargetedRemovalProfile(text: string) {
  const chosenRemoval = getChosenRemovalProfile(text);
  if (chosenRemoval) {
    return chosenRemoval;
  }

  if (hasAuraNeutralizationRemoval(text)) {
    return {
      weight: 0.72,
      reason: "Neutralizes an opposing permanent through an aura-style removal effect.",
    };
  }

  if (hasChosenAnyTargetDamage(text)) {
    return {
      weight: 0.72,
      reason: "Uses scalable damage to clear one or more battlefield resources.",
    };
  }

  if (hasShuffleAwayRemoval(text)) {
    return {
      weight: 0.86,
      reason: "Removes a permanent by shuffling it into its owner's library.",
    };
  }

  if (hasConditionalExileThatCreature(text)) {
    return {
      weight: 0.82,
      reason: "Can upgrade creature tapping into exile when its condition is met.",
    };
  }

  if (hasCrossSentenceEdictRemoval(text)) {
    return {
      weight: 0.76,
      reason: "Removes opposing resources through an edict-style sacrifice effect.",
    };
  }

  const sentences = splitIntoSentences(text);

  for (const sentence of sentences) {
    if (hasDestroyRemoval(sentence)) {
      return {
        weight: 1,
        reason: "Provides direct targeted removal on the battlefield.",
      };
    }

    if (hasExileRemoval(sentence)) {
      return {
        weight: 1.08,
        reason: "Exiles an opposing permanent directly.",
      };
    }

    if (hasEdictRemoval(sentence)) {
      return {
        weight: 0.74,
        reason: "Removes a resource through a sacrifice effect.",
      };
    }

    if (hasFightRemoval(sentence)) {
      return {
        weight: 0.66,
        reason: "Interacts with creatures through fight or punch text.",
      };
    }

    if (hasShrinkRemoval(sentence)) {
      return {
        weight: 0.7,
        reason: "Uses targeted shrink as creature removal.",
      };
    }

    const damageAmount = getTargetedRemovalDamage(sentence);
    if (damageAmount > 0) {
      return {
        weight:
          damageAmount >= 5 ? 0.88
          : damageAmount >= 4 ? 0.76
          : damageAmount >= 3 ? 0.62
          : 0.42,
        reason: "Uses targeted damage to clear a resource from the battlefield.",
      };
    }
  }

  return null;
}

function getChosenRemovalProfile(text: string) {
  if (hasChosenDestroyRemoval(text)) {
    return {
      weight: 0.94,
      reason: "Removes chosen battlefield resources without targeting them.",
    };
  }

  if (hasChosenExileRemoval(text)) {
    return {
      weight: 1.02,
      reason: "Exiles chosen battlefield resources without targeting them.",
    };
  }

  return null;
}

function getMassRemovalProfile(text: string) {
  if (/\b(?:destroy|exile) all nonland permanents\b/.test(text) || /\b(?:destroy|exile) all permanents\b/.test(text)) {
    return {
      weight: 1.3,
      reason: "Clears nearly the whole battlefield at once.",
    };
  }

  if (/\b(?:destroy|exile|return) all creatures\b/.test(text) || /\ball creatures get -(?:x|\d+)\/-(?:x|\d+)\b/.test(text)) {
    return {
      weight: 1.1,
      reason: "Sweeps creatures off the battlefield.",
    };
  }

  if (/\b(?:destroy|exile) all artifacts and enchantments\b/.test(text) || /\b(?:destroy|exile) all artifacts\b/.test(text) || /\b(?:destroy|exile) all enchantments\b/.test(text)) {
    return {
      weight: 1,
      reason: "Sweeps a full permanent class from the board.",
    };
  }

  if (
    /\bdestroy each nonland permanent\b[^.]{0,120}\bmana value (?:x|\d+) or less\b/.test(text) ||
    /\bfor each attacking creature\b[^.]{0,160}\bputs? it on (?:their|its) choice of the top or bottom of (?:their|its) library\b/.test(text) ||
    /\beach creature gets -(?:x|\d+)\/-(?:x|\d+)\b/.test(text) ||
    /\bdeals? (?:x|\d+) damage to each creature\b/.test(text) ||
    /\bdeals? (?:x|\d+) damage to each creature and each planeswalker\b/.test(text)
  ) {
    return {
      weight: 1,
      reason: "Uses global damage or shrink as a sweeper.",
    };
  }

  if (/\beach player sacrifices all (?:artifacts|creatures|enchantments)\b/.test(text)) {
    return {
      weight: 1.05,
      reason: "Forces a table-wide sacrifice of battlefield resources.",
    };
  }

  return null;
}

function getTempoRemovalProfile(text: string) {
  if (hasChoiceTuckAcrossSentences(text, "permanent")) {
    return {
      weight: 0.78,
      reason: "Temporarily removes a battlefield resource by tucking it away.",
    };
  }

  const sentences = splitIntoSentences(text);

  for (const sentence of sentences) {
    if (hasSplitCreatureBounce(sentence)) {
      return {
        weight: 0.68,
        reason: "Temporarily removes an opposing creature while rescuing one of your own.",
      };
    }

    if (hasTemporaryTheft(sentence)) {
      return {
        weight: 0.58,
        reason: "Temporarily removes a battlefield resource by stealing it for a turn.",
      };
    }

    if (hasPermanentBounce(sentence)) {
      return {
        weight: 0.68,
        reason: "Temporarily removes a battlefield resource by bouncing it.",
      };
    }

    if (hasPermanentTuck(sentence)) {
      return {
        weight: 0.78,
        reason: "Removes a battlefield resource by putting it back into the library.",
      };
    }
  }

  return null;
}

function getHandAttackProfile(text: string) {
  if (hasCrossSentenceTargetedDiscard(text)) {
    return {
      weight: 0.6,
      reason: "Attacks opposing resources in hand directly.",
    };
  }

  const sentences = splitIntoSentences(text);

  for (const sentence of sentences) {
    if (hasTargetedDiscard(sentence)) {
      return {
        weight: 0.6,
        reason: "Attacks opposing resources in hand directly.",
      };
    }

    if (hasBroadDiscard(sentence)) {
      return {
        weight: 0.5,
        reason: "Pressures multiple opponents' hands at once.",
      };
    }

    if (hasHandExile(sentence)) {
      return {
        weight: 0.68,
        reason: "Exiles a card from an opponent's hand.",
      };
    }
  }

  return null;
}

function getHardStackProfile(text: string) {
  const sentences = splitIntoSentences(text);

  for (const sentence of sentences) {
    if (hasHardCounter(sentence)) {
      return {
        weight: 1,
        reason: "Stops a spell cleanly on the stack.",
      };
    }

    if (hasSpellExile(sentence)) {
      return {
        weight: 1.04,
        reason: "Exiles a spell directly from the stack.",
      };
    }
  }

  return null;
}

function getSoftStackProfile(text: string) {
  const sentences = splitIntoSentences(text);

  for (const sentence of sentences) {
    if (hasSoftCounter(sentence)) {
      return {
        weight: 0.78,
        reason: "Interacts with a spell conditionally.",
      };
    }
  }

  return null;
}

function getSpellTempoProfile(text: string) {
  if (hasChoiceTuckAcrossSentences(text, "spell")) {
    return {
      weight: 0.92,
      reason: "Answers a spell by tucking it away.",
    };
  }

  const sentences = splitIntoSentences(text);

  for (const sentence of sentences) {
    if (hasSpellBounce(sentence)) {
      return {
        weight: 0.86,
        reason: "Answers a spell by returning it to hand.",
      };
    }

    if (hasSpellTuck(sentence)) {
      return {
        weight: 0.92,
        reason: "Answers a spell by moving it into the library.",
      };
    }
  }

  return null;
}

function getBroadStackProfile(text: string) {
  if (
    /\bcounter all spells\b/.test(text) ||
    /\bexile all other spells\b/.test(text) ||
    /\bexile any number of target spells?\b/.test(text) ||
    /\bcounter all abilities\b/.test(text) ||
    /\bcounter target spell or ability\b/.test(text) ||
    /\bexile target spell or ability\b/.test(text) ||
    /\bcounter target activated or triggered ability\b/.test(text)
  ) {
    return {
      weight: 1.02,
      reason: "Covers more than a single ordinary spell line on the stack.",
    };
  }

  return null;
}

function getStaxProfile(text: string) {
  if (hasAsymmetricStaxText(text)) {
    return {
      weight: 1,
      reason: "Restricts opponents through asymmetric tax, lock, or hate text.",
    };
  }

  if (hasSymmetricStaxText(text)) {
    return {
      weight: 0.72,
      reason: "Creates a table-wide tax or lock effect that can constrain opponents if the deck is built around it.",
    };
  }

  return null;
}

function getGraveyardHateProfile(text: string) {
  if (hasRepeatableGraveyardHateText(text)) {
    return {
      weight: 0.92,
      reason: "Restricts graveyard use repeatedly or through a static replacement effect.",
    };
  }

  if (hasOneShotGraveyardHateText(text)) {
    return {
      weight: 0.62,
      reason: "Exiles graveyards or key graveyard cards as interaction.",
    };
  }

  return null;
}

function estimateRemovalWeight(cmc: number, tag: RemovalTag, base: number) {
  const curvePoint =
    tag === "mass_removal" ? 4
    : tag === "tempo_removal" ? 2
    : tag === "hand_attack" ? 2
    : 2;
  const penaltyPerStep =
    tag === "mass_removal" ? 0.045
    : tag === "tempo_removal" ? 0.055
    : 0.06;
  const stepsPastCurve = Math.max(cmc - curvePoint, 0);
  let factor = 1 - stepsPastCurve * penaltyPerStep;

  if (base >= 1.2) {
    factor += 0.05;
  } else if (base >= 1) {
    factor += 0.02;
  }

  return roundTo(base * clamp(factor, 0.7, 1.08), 2);
}

function estimateSpellInteractionWeight(cmc: number, tag: SpellInteractionTag, base: number) {
  const curvePoint =
    tag === "broad_stack" || tag === "stax_piece" || tag === "graveyard_hate" ? 3
    : tag === "spell_tempo" ? 2
    : 2;
  const penaltyPerStep =
    tag === "broad_stack" || tag === "stax_piece" || tag === "graveyard_hate" ? 0.05
    : tag === "spell_tempo" ? 0.055
    : 0.06;
  const stepsPastCurve = Math.max(cmc - curvePoint, 0);
  let factor = 1 - stepsPastCurve * penaltyPerStep;

  if (base >= 1) {
    factor += 0.02;
  }

  return roundTo(base * clamp(factor, 0.72, 1.06), 2);
}

function assessRemovalCore(core: number, target: number) {
  if (core < target - 1.75) {
    return {
      code: "removal_core_low",
      title: "Removal package is light",
      status: "risk",
      message: `${core.toFixed(2)} effective removal is well below the target of ${target}. The deck may struggle to clear opposing resources.`,
    } as const;
  }

  if (core < target) {
    return {
      code: "removal_core_light",
      title: "Removal package is a little light",
      status: "warning",
      message: `${core.toFixed(2)} effective removal is below the target of ${target}. A few more answers would make the shell safer.`,
    } as const;
  }

  if (core > target + 4) {
    return {
      code: "removal_core_high",
      title: "Removal package is dense",
      status: "note",
      message: `${core.toFixed(2)} effective removal is above the target of ${target}. The deck should answer threats often, but some slots may be overcommitted.`,
    } as const;
  }

  return {
    code: "removal_core_fit",
    title: "Removal package looks healthy",
    status: "good",
    message: `${core.toFixed(2)} effective removal lines up well with the target of ${target}.`,
  } as const;
}

function assessTargetedRemoval(
  targeted: number,
  target: number,
  tempo: number,
  tempoCoverageFactor: number,
  hasBlue: boolean,
) {
  const coverage = roundTo(targeted + tempo * tempoCoverageFactor, 2);

  if (targeted < 0.25 && coverage >= target) {
    return {
      code: "targeted_removal_covered_by_tempo",
      title: "Clean removal is light, but coverage is acceptable",
      status: "note",
      message: `The deck has very little true targeted removal, but tempo answers raise the effective coverage to ${coverage.toFixed(2)} against a target of ${target}.${hasBlue ? " That can be acceptable in blue tempo shells." : ""}`,
    } as const;
  }

  if (coverage < target - 1.5) {
    return {
      code: "targeted_removal_low",
      title: "Targeted removal is low",
      status: "warning",
      message: `${targeted.toFixed(2)} targeted removal is below the target of ${target}.${hasBlue && tempo > 0 ? ` Tempo answers lift the effective coverage to ${coverage.toFixed(2)}, but the deck still lacks clean removal.` : ""}`,
    } as const;
  }

  if (coverage > target + 3) {
    return {
      code: "targeted_removal_high",
      title: "Targeted removal is dense",
      status: "note",
      message: `${coverage.toFixed(2)} effective targeted coverage is well above the target of ${target}.`,
    } as const;
  }

  return {
    code: "targeted_removal_fit",
    title: "Targeted removal is on pace",
    status: "good",
    message:
      targeted >= target
        ? `${targeted.toFixed(2)} targeted removal is close to the target of ${target}.`
        : `${targeted.toFixed(2)} clean removal plus tempo support reaches ${coverage.toFixed(2)} effective coverage against a target of ${target}.`,
  } as const;
}

function assessMassRemoval(mass: number, target: number) {
  if (mass < target - 0.75) {
    return {
      code: "mass_removal_low",
      title: "Sweepers are light",
      status: "warning",
      message: `${mass.toFixed(2)} sweepers is below the target of ${target}.`,
    } as const;
  }

  if (mass > target + 2) {
    return {
      code: "mass_removal_high",
      title: "Sweepers are dense",
      status: "note",
      message: `${mass.toFixed(2)} sweepers is comfortably above the target of ${target}.`,
    } as const;
  }

  return {
    code: "mass_removal_fit",
    title: "Sweeper density looks healthy",
    status: "good",
    message: `${mass.toFixed(2)} sweepers is near the target of ${target}.`,
  } as const;
}

function assessTempoRemoval(tempo: number, target: number, targeted: number) {
  if (tempo < Math.max(0.75, target - 1)) {
    return {
      code: "tempo_removal_light",
      title: "Tempo removal is light",
      status: "note",
      message: `${tempo.toFixed(2)} tempo removal is below the target of ${target}. That can be fine if the clean answers are strong.`,
    } as const;
  }

  if (tempo > targeted + 2.5) {
    return {
      code: "tempo_removal_heavy",
      title: "Tempo removal outweighs clean answers",
      status: "warning",
      message: `${tempo.toFixed(2)} tempo removal is much heavier than the targeted package. The deck may delay threats without removing enough of them.`,
    } as const;
  }

  return {
    code: "tempo_removal_fit",
    title: "Tempo removal complements the shell",
    status: "good",
    message: `${tempo.toFixed(2)} tempo removal adds flexibility without replacing too many clean answers.`,
  } as const;
}

function assessHandAttack(handAttack: number, target: number, hasBlack: boolean) {
  if (target <= 0) {
    return {
      code: "hand_attack_optional",
      title: "Hand attack is optional here",
      status: handAttack > 0 ? "good" : "note",
      message:
        handAttack > 0
          ? `${handAttack.toFixed(2)} hand disruption adds useful pressure even though this color identity is not expected to lean on it.`
          : "This color identity is not expected to rely on hand attack.",
    } as const;
  }

  if (handAttack < target) {
    return {
      code: "hand_attack_light",
      title: hasBlack ? "Hand attack is light for black" : "Hand attack is light",
      status: "note",
      message: `${handAttack.toFixed(2)} hand attack is below the optional target of ${target}.`,
    } as const;
  }

  return {
    code: "hand_attack_fit",
    title: "Hand attack adds pressure",
    status: "good",
    message: `${handAttack.toFixed(2)} hand attack gives the deck another way to trade with opposing resources.`,
  } as const;
}

function assessSpellInteractionCore(core: number, target: number, hasBlue: boolean) {
  if (target <= 0) {
    return {
      code: "spell_interaction_optional",
      title: "Spell interaction is optional here",
      status: core > 0 ? "good" : "note",
      message:
        core > 0
          ? `${core.toFixed(2)} stack-facing interaction is a useful bonus for a deck that is not expected to lean on countermagic.`
          : "This color identity is not expected to rely heavily on spell interaction.",
    } as const;
  }

  if (core < target - 1) {
    return {
      code: "spell_interaction_low",
      title: hasBlue ? "Spell interaction is low for blue" : "Spell interaction is light",
      status: "warning",
      message: `${core.toFixed(2)} effective spell interaction is below the target of ${target}.`,
    } as const;
  }

  if (core > target + 2.5) {
    return {
      code: "spell_interaction_high",
      title: "Spell interaction is dense",
      status: "note",
      message: `${core.toFixed(2)} effective spell interaction is above the target of ${target}.`,
    } as const;
  }

  return {
    code: "spell_interaction_fit",
    title: "Spell interaction looks healthy",
    status: "good",
    message: `${core.toFixed(2)} effective spell interaction is near the target of ${target}.`,
  } as const;
}

function assessHardStack(hard: number, target: number, hasBlue: boolean) {
  if (target <= 0) {
    return {
      code: "hard_stack_optional",
      title: "Hard stack answers are optional here",
      status: hard > 0 ? "good" : "note",
      message:
        hard > 0
          ? `${hard.toFixed(2)} hard stack answers is extra coverage for this color identity.`
          : "Hard stack answers are not required for this color identity.",
    } as const;
  }

  if (hard < target - 1) {
    return {
      code: "hard_stack_low",
      title: hasBlue ? "Hard stack answers are low for blue" : "Hard stack answers are light",
      status: "warning",
      message: `${hard.toFixed(2)} hard stack answers is below the target of ${target}.`,
    } as const;
  }

  return {
    code: "hard_stack_fit",
    title: "Hard stack answers are on pace",
    status: "good",
    message: `${hard.toFixed(2)} hard stack answers is close to the target of ${target}.`,
  } as const;
}

function assessSoftStack(soft: number, spellTempo: number, target: number, hasBlue: boolean) {
  const support = roundTo(soft + spellTempo, 2);

  if (target <= 0) {
    return {
      code: "soft_stack_optional",
      title: "Soft stack tools are optional here",
      status: support > 0 ? "good" : "note",
      message:
        support > 0
          ? `${support.toFixed(2)} conditional or tempo stack pieces adds some flexibility.`
          : "Conditional counters and spell tempo are optional for this color identity.",
    } as const;
  }

  if (support < target - 0.75) {
    return {
      code: "soft_stack_low",
      title: hasBlue ? "Soft stack support is low for blue" : "Soft stack support is light",
      status: "note",
      message: `${support.toFixed(2)} conditional counters and spell tempo is below the target of ${target}.`,
    } as const;
  }

  return {
    code: "soft_stack_fit",
    title: "Soft stack support looks healthy",
    status: "good",
    message: `${support.toFixed(2)} conditional counters and spell tempo complements the stack package well.`,
  } as const;
}

function assessBroadStack(broad: number) {
  if (broad <= 0) {
    return {
      code: "broad_stack_none",
      title: "Broad stack coverage is absent",
      status: "note",
      message: "The deck has no broader stack coverage pieces. That is normal for most Commander decks.",
    } as const;
  }

  return {
    code: "broad_stack_present",
    title: "Broad stack coverage is present",
    status: "good",
    message: `${broad.toFixed(2)} broad stack interaction gives the deck extra reach against complicated turns.`,
  } as const;
}

function assessStaxPieces(stax: number) {
  if (stax <= 0) {
    return {
      code: "stax_none",
      title: "Stax pressure is absent",
      status: "note",
      message: "No tax, lock, or hate pieces were detected. That is normal unless the deck is trying to slow opponents down.",
    } as const;
  }

  return {
    code: "stax_present",
    title: "Stax pressure is present",
    status: "good",
    message: `${stax.toFixed(2)} tax, lock, or hate pressure gives the deck another way to constrain opposing game plans.`,
  } as const;
}

function assessGraveyardHate(graveyardHate: number) {
  if (graveyardHate <= 0) {
    return {
      code: "graveyard_hate_none",
      title: "Graveyard hate is absent",
      status: "note",
      message: "No graveyard hate was detected. That is acceptable in some metas, but graveyard-heavy pods may punish it.",
    } as const;
  }

  return {
    code: "graveyard_hate_present",
    title: "Graveyard hate is present",
    status: "good",
    message: `${graveyardHate.toFixed(2)} graveyard hate gives the deck tools against recursion, reanimator, and graveyard engines.`,
  } as const;
}

function scoreRemoval(input: {
  core: number;
  targeted: number;
  mass: number;
  tempo: number;
  handAttack: number;
  tempoCoverageFactor: number;
  recommendations: {
    coreTarget: number;
    targetedTarget: number;
    massTarget: number;
    tempoTarget: number;
    handTarget: number;
  };
}) {
  let score = 70;
  const targetedCoverage = roundTo(input.targeted + input.tempo * input.tempoCoverageFactor, 2);

  score += calculateTargetBonus(input.core, input.recommendations.coreTarget, 5);
  score += calculateTargetBonus(targetedCoverage, input.recommendations.targetedTarget, 4.5);
  score += calculateTargetBonus(input.mass, input.recommendations.massTarget, 3);
  score += calculateTargetBonus(input.tempo, input.recommendations.tempoTarget, 2);

  if (input.recommendations.handTarget > 0) {
    score += calculateTargetBonus(input.handAttack, input.recommendations.handTarget, 1);
  }

  score -= calculateUnderPenalty(input.core, input.recommendations.coreTarget, 8, 4.8);
  score -= calculateOverPenalty(input.core, input.recommendations.coreTarget, 4, 0.75);
  score -= calculateUnderPenalty(targetedCoverage, input.recommendations.targetedTarget, 6.5, 3.8);
  score -= calculateOverPenalty(targetedCoverage, input.recommendations.targetedTarget, 3, 0.55);
  score -= calculateUnderPenalty(input.mass, input.recommendations.massTarget, 4, 3);
  score -= calculateOverPenalty(input.mass, input.recommendations.massTarget, 1.5, 0.65);
  score -= calculateUnderPenalty(input.tempo, input.recommendations.tempoTarget, 1.8, 1.4);
  score -= calculateOverPenalty(input.tempo, input.recommendations.tempoTarget, 2.5, 0.35);

  if (input.recommendations.handTarget > 0) {
    score -= calculateUnderPenalty(input.handAttack, input.recommendations.handTarget, 1.4, 0.9);
  }

  if (input.targeted < input.recommendations.targetedTarget - 1.5 && input.tempo > input.targeted + 2) {
    score -= 2.5;
  }

  if (input.mass === 0 && input.recommendations.massTarget >= 2) {
    score -= 2;
  }

  return clamp(Math.round(score), 0, 100);
}

function scoreSpellInteraction(input: {
  core: number;
  hard: number;
  soft: number;
  spellTempo: number;
  broad: number;
  stax: number;
  graveyardHate: number;
  recommendations: {
    coreTarget: number;
    hardTarget: number;
    softTarget: number;
  };
}) {
  if (input.recommendations.coreTarget <= 0) {
    return clamp(Math.round(70 + Math.min(input.core, 3) * 2), 0, 100);
  }

  let score = 70;

  score += calculateTargetBonus(input.core, input.recommendations.coreTarget, 5);
  score += calculateTargetBonus(input.hard, input.recommendations.hardTarget, 4);
  score += calculateTargetBonus(input.soft + input.spellTempo, input.recommendations.softTarget, 2.5);

  score -= calculateUnderPenalty(input.core, input.recommendations.coreTarget, 6, 4);
  score -= calculateOverPenalty(input.core, input.recommendations.coreTarget, 3, 0.55);
  score -= calculateUnderPenalty(input.hard, input.recommendations.hardTarget, 5, 3.2);
  score -= calculateOverPenalty(input.hard, input.recommendations.hardTarget, 2, 0.4);
  score -= calculateUnderPenalty(input.soft + input.spellTempo, input.recommendations.softTarget, 2, 1.8);

  if (input.hard < input.recommendations.hardTarget - 1 && input.broad > input.hard + 1.5) {
    score -= 1.5;
  }

  return clamp(Math.round(score), 0, 100);
}

function summarizeRemovalScore(score: number) {
  if (score >= 86) {
    return "Removal package is strong and well-rounded.";
  }

  if (score >= 72) {
    return "Removal package is healthy, with a few tuning points.";
  }

  if (score >= 58) {
    return "Removal package is playable, but uneven.";
  }

  return "Removal package is underbuilt for a full Commander table.";
}

function summarizeSpellInteractionScore(score: number, hasBlue: boolean) {
  if (!hasBlue && score >= 80) {
    return "Spell interaction is optional here, and the current package is acceptable.";
  }

  if (score >= 86) {
    return "Spell interaction is strong and well-rounded.";
  }

  if (score >= 72) {
    return "Spell interaction is healthy, with a few tuning points.";
  }

  if (score >= 58) {
    return "Spell interaction is playable, but uneven.";
  }

  return "Spell interaction is underbuilt for the game plan.";
}

function calculateTargetBonus(actual: number, target: number, maxBonus: number) {
  if (target <= 0) {
    return 0;
  }

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
  if (target <= 0 || actual >= target) {
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
  if (target <= 0 || actual <= target + grace) {
    return 0;
  }

  return (actual - target - grace) * rate;
}

function recommendTargetedRemovalTarget(context: DeckContext) {
  let target =
    context.hasWhite || context.hasBlack ? 5
    : context.hasRed ? 4
    : context.hasGreen ? 3
    : context.hasBlue ? 2
    : 3;

  if (context.colorCount >= 3 && (context.hasWhite || context.hasBlack || context.hasRed)) {
    target += 1;
  }

  if (context.averageManaValue >= 3.4) {
    target += 1;
  } else if (context.averageManaValue <= 2.2) {
    target -= 1;
  }

  return clamp(target, context.hasBlue && !context.hasWhite && !context.hasBlack && !context.hasRed ? 1 : 2, 7);
}

function recommendMassRemovalTarget(context: DeckContext) {
  let target = context.hasBlue && !context.hasWhite && !context.hasBlack && !context.hasRed ? 0 : 1;

  if (context.hasWhite || context.hasBlack) {
    target += 1;
  }

  if (context.averageManaValue >= 3.5) {
    target += 1;
  }

  if (context.averageManaValue <= 2.1) {
    target -= 1;
  }

  return clamp(target, 0, 3);
}

function recommendTempoRemovalTarget(context: DeckContext) {
  let target =
    context.hasBlue ? (context.colorCount === 1 ? 3 : 2)
    : context.hasRed ? 1
    : 0;

  if (context.averageManaValue >= 3.3 && context.hasBlue) {
    target += 1;
  }

  return clamp(target, 0, 4);
}

function recommendHandAttackTarget(hasBlack: boolean) {
  return hasBlack ? 1 : 0;
}

function getTempoCoverageFactor(context: DeckContext) {
  if (context.hasBlue && !context.hasWhite && !context.hasBlack && !context.hasRed) {
    return 0.72;
  }

  if (context.hasBlue) {
    return 0.58;
  }

  return 0.35;
}

function recommendHardStackTarget(averageManaValue: number, hasBlue: boolean) {
  if (!hasBlue) {
    return 0;
  }

  let target = 2;

  if (averageManaValue <= 2.7) {
    target += 1;
  }

  if (averageManaValue <= 2.2) {
    target += 1;
  }

  return clamp(target, 2, 4);
}

function recommendSoftStackTarget(averageManaValue: number, hasBlue: boolean) {
  if (!hasBlue) {
    return 0;
  }

  let target = 1;

  if (averageManaValue <= 2.7) {
    target += 1;
  }

  return clamp(target, 1, 2);
}

function getInteractionSegments(card: ScryfallCard) {
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

function splitIntoSentences(text: string) {
  return text
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function hasDestroyRemoval(sentence: string) {
  return (
    /\bdestroy\b[^.]{0,120}\btarget\b/.test(sentence) &&
    hasPermanentTargetDescriptor(sentence) &&
    !hasSelfTargetDescriptor(sentence)
  );
}

function hasExileRemoval(sentence: string) {
  return (
    /\bexile\b[^.]{0,120}\btarget\b/.test(sentence) &&
    hasPermanentTargetDescriptor(sentence) &&
    !/\btarget spell\b/.test(sentence) &&
    !hasSelfTargetDescriptor(sentence) &&
    !hasSameSentenceReturnFlicker(sentence)
  );
}

function hasPermanentBounce(sentence: string) {
  return (
    (
      /\breturn\b[^.]{0,40}\btarget\b[^.]{0,140}\b(?:nonland permanent|permanent|creature|artifact|enchantment|planeswalker|spell or permanent|permanent or spell)\b[^.]{0,120}\bto (?:its|their) owner's hand\b/.test(sentence) ||
      /\breturn\b[^.]{0,80}\b(?:one|two|three|four|five|six|\d+|up to \d+|up to [a-z]+)\s+target\b[^.]{0,140}\b(?:creatures?|artifacts?|enchantments?|planeswalkers?|permanents?|nonland permanents?)\b[^.]{0,120}\bto (?:their|its) owners'? hands?\b/.test(sentence)
    ) &&
    !hasSelfTargetDescriptor(sentence)
  );
}

function hasSplitCreatureBounce(sentence: string) {
  return /\breturn target creature you control and target creature you don'?t control to their owners'? hands\b/.test(
    sentence,
  );
}

function hasPermanentTuck(sentence: string) {
  return (
    /\bput\b[^.]{0,40}\btarget\b[^.]{0,140}\b(?:nonland permanent|permanent|creature|artifact|enchantment|planeswalker|spell or permanent|permanent or spell)\b[^.]{0,140}\b(?:on the top or bottom of|on top of|on the bottom of|into)\b[^.]{0,60}\blibrary\b/.test(sentence) &&
    !/\bgraveyard\b/.test(sentence) &&
    !hasSelfTargetDescriptor(sentence)
  );
}

function hasChoiceTuckAcrossSentences(text: string, mode: "spell" | "permanent") {
  const targetPattern =
    mode === "spell"
      ? /\bchoose target (?:spell|spell or permanent|permanent or spell)\b/
      : /\bchoose target (?:permanent|spell or permanent|permanent or spell)\b/;

  return (
    targetPattern.test(text) &&
    /\bits owner puts it on the top or bottom of (?:their|their owner's|its owner's) library\b/.test(text)
  );
}

function hasCrossSentenceEdictRemoval(text: string) {
  return (
    /\b(?:target (?:opponent|player)|each opponent|each player|each other player|for each opponent)\b[\s\S]{0,220}\bsacrifices?\b[\s\S]{0,120}\b(?:artifacts?|creatures?|enchantments?|planeswalkers?|battles?|permanents?|tokens?)\b/.test(
      text,
    ) &&
    !/\byou sacrifice\b/.test(text)
  );
}

function hasEdictRemoval(sentence: string) {
  return (
    /\b(?:target (?:opponent|player)|each opponent|each player|each other player|for each opponent)\b[^.]{0,120}\bsacrifices?\b/.test(
      sentence,
    ) &&
    /\b(?:artifacts?|creatures?|enchantments?|planeswalkers?|battles?|permanents?|tokens?)\b/.test(sentence) &&
    !/\byou sacrifice\b/.test(sentence)
  );
}

function hasFightRemoval(sentence: string) {
  return (
    /\bfight\b[^.]{0,120}\btarget creature\b/.test(sentence) ||
    /\bdeals damage equal to (?:its|their) power to target\b/.test(sentence)
  );
}

function hasShrinkRemoval(sentence: string) {
  return /\btarget\b[^.]{0,60}\bcreature\b[^.]{0,60}\bgets -(?:x|\d+)\/-(?:x|\d+)\b/.test(sentence);
}

function getTargetedRemovalDamage(sentence: string) {
  if (/\bdeals? (?:\w+\s+times\s+)?x damage to each of up to x targets?\b/.test(sentence)) {
    return 5;
  }

  const targetPattern =
    /\bdeals?\s+(?<amount>x|\d+)\s+damage (?:divided as you choose among any number of targets?|to (?:up to one |any other |another |any )?target(?:\b| (?:creature|planeswalker|creature or planeswalker|attacking creature|blocking creature|attacking or blocking creature|artifact creature)\b))/;
  const match = sentence.match(targetPattern);
  const amount = match?.groups?.amount;

  if (!amount) {
    return 0;
  }

  if (amount === "x") {
    return 4;
  }

  return Number.parseInt(amount, 10) || 0;
}

function hasAuraNeutralizationRemoval(text: string) {
  return (
    /\benchant (?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b/.test(text) &&
    (
      /\benchanted (?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b[^.]{0,180}\bloses all abilities\b/.test(text) ||
      /\benchanted (?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b[^.]{0,180}\bis (?:a|an)\b[^.]{0,120}\b(?:land|forest|treasure|insect|frog|elk|coward)\b/.test(text) ||
      /\benchanted (?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b[^.]{0,180}\bcan't attack or block\b/.test(text)
    )
  );
}

function hasChosenAnyTargetDamage(text: string) {
  return /\bchoose any target\b[\s\S]{0,180}\bdeals? (?:x|\d+|that much) damage to each of them\b/.test(text);
}

function hasShuffleAwayRemoval(text: string) {
  return (
    /\btarget permanent\b[^.]{0,120}\bshuffles? (?:it|itself) into (?:their|its) owner's library\b/.test(text) ||
    /\bthe owner of target permanent\b[^.]{0,120}\bshuffles? it into (?:their|its) library\b/.test(text)
  );
}

function hasConditionalExileThatCreature(text: string) {
  return /\btap target creature\b[\s\S]{0,140}\bexile that creature\b/.test(text);
}

function hasTemporaryTheft(sentence: string) {
  return (
    /\bgain control of\b[^.]{0,120}\b(?:target|enchanted)\b[^.]{0,120}\b(?:creature|artifact|enchantment|planeswalker|permanent)\b[^.]{0,160}\buntil end of turn\b/.test(
      sentence,
    ) &&
    !hasSelfTargetDescriptor(sentence)
  );
}

function hasTargetedDiscard(sentence: string) {
  return (
    /\btarget (?:player|opponent)\b[^.]{0,120}\bdiscards?\b/.test(sentence) ||
    /\b(?:look at|reveal)\b[^.]{0,80}\btarget (?:player|opponent)'s hand\b[^.]{0,140}\bdiscard\b/.test(sentence) ||
    /\btarget (?:player|opponent) reveals? (?:their|his or her) hand\b[^.]{0,140}\bchoose\b[^.]{0,120}\b(?:that player|they) discards?\b/.test(sentence)
  );
}

function hasBroadDiscard(sentence: string) {
  return /\beach (?:opponent|player) discards?\b/.test(sentence);
}

function hasCrossSentenceTargetedDiscard(text: string) {
  return /\btarget (?:player|opponent) reveals? (?:their|his or her) hand\b[^.]*\.\s*you choose\b[^.]*\.\s*(?:that player|they) discards?\b/.test(text);
}

function hasHandExile(sentence: string) {
  return (
    /\bexile\b[^.]{0,120}\b(?:a|that|target)\b[^.]{0,120}\bcard\b[^.]{0,140}\bfrom (?:target|that) (?:player|opponent)'s hand\b/.test(sentence) ||
    /\bchoose\b[^.]{0,120}\ba\b[^.]{0,120}\bcard\b[^.]{0,120}\bfrom (?:target|that) (?:player|opponent)'s hand\b[^.]{0,120}\bexile\b/.test(sentence)
  );
}

function hasHardCounter(sentence: string) {
  return (
    /\bcounter (?:up to one )?target (?:spell|noncreature spell|creature spell|instant or sorcery spell|artifact spell|enchantment spell|legendary spell)\b/.test(sentence) &&
    !/\bunless\b/.test(sentence)
  );
}

function hasSoftCounter(sentence: string) {
  return (
    /\bcounter (?:up to one )?target (?:spell|noncreature spell|creature spell|instant or sorcery spell)\b[^.]{0,120}\bunless\b/.test(sentence) ||
    /\bcounter target spell if\b/.test(sentence)
  );
}

function hasSpellExile(sentence: string) {
  return /\bexile target spell\b/.test(sentence);
}

function hasSpellBounce(sentence: string) {
  return /\breturn target spell\b[^.]*\bto (?:its|their) owner's hand\b/.test(sentence);
}

function hasSpellTuck(sentence: string) {
  return (
    /\bput target spell\b[^.]*\b(?:on the top or bottom of|on top of|on the bottom of|into)\b[^.]*\blibrary\b/.test(sentence) ||
    /\bchoose target spell\b[^.]*\b(?:on the top or bottom of|on top of|on the bottom of|into)\b[^.]*\blibrary\b/.test(sentence)
  );
}

function hasAsymmetricStaxText(text: string) {
  return (
    /\bopponents? can'?t\b[^.]{0,180}\b(?:cast|activate|search|draw|untap|gain life|play lands?|attack|block)\b/.test(text) ||
    /\byour opponents? can'?t\b[^.]{0,180}\b(?:cast|activate|search|draw|untap|gain life|play lands?|attack|block)\b/.test(text) ||
    /\bopponents? can'?t cast spells? from\b/.test(text) ||
    /\bopponents? can'?t cast more than\b/.test(text) ||
    /\bopponents? can'?t draw more than\b/.test(text) ||
    /\beach opponent can'?t cast more than\b/.test(text) ||
    /\beach opponent can'?t draw more than\b/.test(text) ||
    /\beach opponent can'?t search\b/.test(text) ||
    /\bif an opponent would search\b[^.]{0,160}\binstead\b/.test(text) ||
    /\bif an opponent would draw\b[^.]{0,160}\binstead\b/.test(text) ||
    /\bplayers can'?t search libraries\b/.test(text) ||
    /\bopponents? can'?t search libraries\b/.test(text) ||
    /\byour opponents? can'?t search\b/.test(text) ||
    /\bspells your opponents cast\b[^.]{0,120}\bcost\b[^.]{0,80}\bmore\b/.test(text) ||
    /\bnoncreature spells your opponents cast\b[^.]{0,120}\bcost\b[^.]{0,80}\bmore\b/.test(text) ||
    /\b(?:artifact|artifacts|enchantment|enchantments|creature|creatures) (?:spells? )?(?:your )?opponents cast\b[^.]{0,120}\bcost\b[^.]{0,80}\bmore\b/.test(text) ||
    /\bactivated abilities of (?:artifacts|creatures|nonland permanents|permanents) your opponents control can'?t be activated\b/.test(text) ||
    /\bactivated abilities of sources your opponents control can'?t be activated\b/.test(text) ||
    /\bactivated abilities of sources with the chosen name can'?t be activated\b/.test(text) ||
    /\bactivated abilities of (?:the )?chosen sources? can'?t be activated\b/.test(text) ||
    /\b(?:artifacts|creatures|lands|nonbasic lands|permanents) your opponents control enter (?:the battlefield )?tapped\b/.test(text) ||
    /\bnonbasic lands your opponents control\b[^.]{0,100}\bare mountains\b/.test(text) ||
    /\bnonbasic lands your opponents control\b[^.]{0,100}\bdon'?t untap\b/.test(text) ||
    /\bopponents? can'?t untap more than\b/.test(text) ||
    /\beach opponent can'?t untap more than\b/.test(text) ||
    /\bcreatures can'?t attack you unless\b[^.]{0,100}\bpays?\b/.test(text) ||
    /\bcreatures your opponents control can'?t attack\b/.test(text) ||
    /\bcreatures your opponents control enter (?:the battlefield )?tapped\b/.test(text) ||
    /\bplayers can cast spells and activate abilities only during their own turns\b/.test(text) ||
    /\bopponents? can'?t cast spells or activate abilities\b/.test(text) ||
    /\bopponents? can'?t cast spells? during\b/.test(text) ||
    /\bnoncreature spells with mana value\b[^.]{0,120}\bcan'?t be cast\b/.test(text) ||
    /\bif a creature would enter\b[^.]{0,120}\bexile it instead\b/.test(text) ||
    /\bif a nontoken creature would enter\b[^.]{0,140}\bexile it instead\b/.test(text) ||
    /\bcreature cards in graveyards and libraries can'?t enter the battlefield\b/.test(text) ||
    /\bcreatures entering\b[^.]{0,80}\bdon'?t cause abilities to trigger\b/.test(text) ||
    /\bcreatures entering or dying\b[^.]{0,80}\bdon'?t cause abilities to trigger\b/.test(text) ||
    /\bentering\b[^.]{0,80}\bdon'?t cause abilities to trigger\b/.test(text) ||
    /\btriggered abilities\b[^.]{0,120}\bdon'?t trigger\b/.test(text)
  );
}

function hasSymmetricStaxText(text: string) {
  return (
    /\bplayers can'?t cast more than\b/.test(text) ||
    /\beach player can'?t cast more than\b/.test(text) ||
    /\beach player\b[^.]{0,160}\bcan'?t cast additional\b/.test(text) ||
    /\beach player can'?t draw more than\b/.test(text) ||
    /\bplayers can'?t draw more than\b/.test(text) ||
    /\bplayers can'?t cast spells? from\b/.test(text) ||
    /\bplayers can'?t search libraries\b/.test(text) ||
    /\bif a player would search\b[^.]{0,160}\binstead\b/.test(text) ||
    /\bif a player would draw\b[^.]{0,160}\binstead\b/.test(text) ||
    /\bplayers can'?t activate\b[^.]{0,140}\babilities\b/.test(text) ||
    /\bactivated abilities of (?:artifacts|creatures|nonland permanents|permanents) can'?t be activated\b/.test(text) ||
    /\bnoncreature spells cost\b[^.]{0,80}\bmore\b/.test(text) ||
    /\bspells cost\b[^.]{0,80}\bmore to cast\b/.test(text) ||
    /\beach spell\b[^.]{0,120}\bcosts?\b[^.]{0,120}\bmore to cast\b/.test(text) ||
    /\bspells cast by another player\b[^.]{0,120}\bcost\b[^.]{0,80}\bmore\b/.test(text) ||
    /\beach spell that would cost less than\b[^.]{0,180}\bcosts?\b[^.]{0,120}\bto cast\b/.test(text) ||
    /\bwhenever a player casts\b[^.]{0,160}\bcounter that spell\b/.test(text) ||
    /\bif a land is tapped for two or more mana\b[^.]{0,160}\bproduces \{c\} instead\b/.test(text) ||
    /\b(?:artifacts|creatures|lands|nonbasic lands|permanents) enter (?:the battlefield )?tapped\b/.test(text) ||
    /\bnonbasic lands\b[^.]{0,100}\bare mountains\b/.test(text) ||
    /\bnonbasic lands\b[^.]{0,100}\bdon'?t untap\b/.test(text) ||
    /\bnonbasic lands lose all abilities\b/.test(text) ||
    /\bplayers can'?t play lands\b/.test(text) ||
    /\b(?:lands|nonbasic lands) don'?t untap during\b/.test(text) ||
    /\bplayers can'?t untap more than\b/.test(text) ||
    /\beach player can'?t untap more than\b/.test(text) ||
    /\bplayers skip their untap steps?\b/.test(text) ||
    /\beach player skips? (?:their|his or her) untap step\b/.test(text) ||
    /\bcreatures have\b[^.]{0,160}\bdestroy this creature unless you pay\b/.test(text) ||
    /\b(?:artifact|artifacts|creature|creatures) (?:has|have)\b[^.]{0,160}\bsacrifice\b[^.]{0,120}\bunless you pay\b/.test(text) ||
    /\b(?:artifacts|creatures|permanents) entering\b[^.]{0,80}\bdon'?t cause abilities to trigger\b/.test(text) ||
    /\bcreatures entering\b[^.]{0,80}\bdon'?t cause abilities to trigger\b/.test(text) ||
    /\bcreatures entering or dying\b[^.]{0,80}\bdon'?t cause abilities to trigger\b/.test(text) ||
    /\btriggered abilities\b[^.]{0,120}\bdon'?t trigger\b/.test(text)
  );
}

function hasRepeatableGraveyardHateText(text: string) {
  return (
    /\bif (?:a|one or more|one or more creature|one or more nonland) cards? (?:or tokens? )?would be put into (?:an opponent's|a|any|their) graveyard\b[^.]{0,180}\bexile (?:it|them|that card|those cards) instead\b/.test(
      text,
    ) ||
    /\bif (?:a|one or more|one or more creature|one or more nonland) cards? (?:or tokens? )?would be put into (?:an opponent's|a|any|their) graveyard from anywhere\b[^.]{0,180}\bexile (?:it|them|that card|those cards) instead\b/.test(
      text,
    ) ||
    /\bif (?:a|one or more|one or more creature|one or more nonland) cards? would be put into (?:an opponent's|a|any|their) graveyard from anywhere\b[^.]{0,180}\bexile\b/.test(
      text,
    ) ||
    /\bcards? in graveyards can'?t\b/.test(text) ||
    /\bplayers can'?t cast spells? from graveyards\b/.test(text) ||
    /\bopponents? can'?t cast spells? from graveyards\b/.test(text) ||
    /\bgraveyards can'?t be the targets?\b/.test(text) ||
    /\bcreature cards in graveyards\b[^.]{0,120}\bcan'?t enter the battlefield\b/.test(text)
  );
}

function hasOneShotGraveyardHateText(text: string) {
  return (
    /\bexile (?:all|each|target|up to \w+ target|up to \d+ target)\b[^.]{0,180}\b(?:cards?|graveyard|graveyards)\b[^.]{0,120}\bfrom (?:target player's|each player's|all|a|an|any|their|that player's|your opponents?') graveyard/.test(
      text,
    ) ||
    /\bexile target player's graveyard\b/.test(text) ||
    /\bexile all graveyards\b/.test(text) ||
    /\bexile all cards? from (?:all|each|target player's|a|an|any) graveyards?\b/.test(text) ||
    /\btarget player exiles? (?:all|each)\b[^.]{0,120}\bfrom their graveyard\b/.test(text) ||
    /\bexile up to \w+ target cards? from (?:a|an|target player's|any) graveyard\b/.test(text) ||
    /\bexile target card from (?:a|an|target player's|any) graveyard\b/.test(text) ||
    /\bwhen\b[^.]{0,120}\benters the battlefield\b[^.]{0,160}\bexile\b[^.]{0,120}\bgraveyard\b/.test(text)
  );
}

function hasPermanentTargetDescriptor(sentence: string) {
  return /\b(?:up to one |another |other |any number of )?target\b[^.]{0,140}\b(?:artifact|artifacts|creature|creatures|enchantment|enchantments|planeswalker|planeswalkers|battle|battles|permanent|permanents|nonland permanent|nonland permanents|token|tokens|attacking|blocking)\b/.test(sentence);
}

function hasChosenDestroyRemoval(text: string) {
  return (
    hasChosenPermanentDescriptor(text) &&
    /\bdestroy\b[^.]{0,80}\b(?:the chosen|those|them|it)\b/.test(text) &&
    !hasSelfChoiceDescriptor(text)
  );
}

function hasChosenExileRemoval(text: string) {
  return (
    hasChosenPermanentDescriptor(text) &&
    /\bexile\b[^.]{0,80}\b(?:the chosen|those|them|it)\b/.test(text) &&
    !hasSelfChoiceDescriptor(text) &&
    !hasCrossSentenceReturnFlicker(text)
  );
}

function hasChosenPermanentDescriptor(text: string) {
  return /\b(?:choose|chooses)\b[^.]{0,160}\b(?:artifact|artifacts|creature|creatures|enchantment|enchantments|planeswalker|planeswalkers|battle|battles|permanent|permanents|nonland permanent|nonland permanents)\b/.test(text);
}

function hasSelfTargetDescriptor(sentence: string) {
  return /\btarget\b[^.]{0,100}\b(?:creature|creatures|permanent|permanents|artifact|artifacts|enchantment|enchantments|planeswalker|planeswalkers|commander|commanders|nonland permanent|nonland permanents)\b[^.]{0,100}\b(?:you control|you own)\b/.test(sentence);
}

function hasSelfChoiceDescriptor(text: string) {
  return /\b(?:choose|chooses)\b[^.]{0,160}\b(?:artifact|artifacts|creature|creatures|permanent|permanents|nonland permanent|nonland permanents)\b[^.]{0,120}\b(?:you control|you own)\b/.test(text);
}

function hasSameSentenceReturnFlicker(sentence: string) {
  return (
    /\bexile\b[^.]{0,180}\btarget\b/.test(sentence) &&
    /\breturn (?:it|that card|them|those cards)\b[^.]{0,120}\bto the battlefield\b/.test(sentence) &&
    !/\btarget spell\b/.test(sentence)
  );
}

function hasCrossSentenceReturnFlicker(text: string) {
  return /\breturn (?:it|them|those cards|the chosen [a-z ]+)\b[^.]{0,120}\bto the battlefield\b/.test(text);
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

function sumQuantities(cards: ResolvedDeckCard[]) {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}

function totalWeight(hits: Array<{ weight: number }>) {
  return hits.reduce((sum, hit) => sum + hit.weight, 0);
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
