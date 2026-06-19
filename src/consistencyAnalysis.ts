import {
  getRoleReason,
  getRoleWeight,
  inferAdvancedRoleProfile,
} from "./advancedCardScan";
import { applyEffectQualityDiscount } from "./activationCost";
import { applyCommanderAvailabilityToTutorHits } from "./commanderAvailability";
import { CommanderColorProfile, getCommanderColorProfile } from "./commanderColorProfile";
import {
  createEffectiveManaValueContext,
  estimateEffectiveManaValue,
  sumEffectiveManaValue,
} from "./effectiveManaValue";
import {
  DeckConsistencyAnalysis,
  DeckDrawAnalysis,
  DeckResolutionDocument,
  DeckStrategyAnalysis,
  DeckWinConditionAnalysis,
  ResolvedDeckCard,
  ScryfallCard,
  TutorTag,
  TutorTagHit,
} from "./types";

interface ConsistencyContext {
  deckCards: ResolvedDeckCard[];
  effectiveManaContext: ReturnType<typeof createEffectiveManaValueContext>;
  colorProfile: CommanderColorProfile;
  averageManaValue: number;
  mainStrategyKey: NonNullable<DeckStrategyAnalysis["mainStrategy"]>["key"] | null;
  comboCount: number;
  draw?: DeckDrawAnalysis;
}

interface SearchTutorProfile {
  kind: "direct_tutor" | "restricted_tutor" | "land_tutor";
  destination: "battlefield" | "hand" | "top" | "graveyard" | "cast" | "unknown";
  breadth: "broad" | "narrow" | "land";
  repeatable: boolean;
}

interface ConsistencyScoreInput {
  core: number;
  direct: number;
  restricted: number;
  repeatable: number;
  land: number;
  selectionSupport: number;
  recommendations: {
    coreTarget: number;
    directTarget: number;
    repeatableTarget: number;
  };
  colorProfile: CommanderColorProfile;
  mainStrategyKey: NonNullable<DeckStrategyAnalysis["mainStrategy"]>["key"] | null;
}

export function analyzeDeckConsistency(
  document: DeckResolutionDocument,
  options: {
    draw?: DeckDrawAnalysis;
    strategy?: DeckStrategyAnalysis;
    winConditions?: DeckWinConditionAnalysis;
  } = {},
): DeckConsistencyAnalysis {
  const context = getConsistencyContext(document, options);
  const taggedCards = context.deckCards
    .map((card) => {
      const hits = applyCommanderAvailabilityToTutorHits(
        card.section,
        detectTutorHits(card.card, context.effectiveManaContext),
      );

      if (hits.length === 0) {
        return null;
      }

      return {
        name: card.card.name,
        quantity: card.quantity,
        section: card.section,
        consistencyValue: roundTo(totalWeight(hits), 2),
        hits,
      };
    })
    .filter((card): card is NonNullable<typeof card> => card !== null)
    .sort(
      (left, right) =>
        right.consistencyValue - left.consistencyValue || left.name.localeCompare(right.name),
    );

  const counts = {
    direct: 0,
    restricted: 0,
    repeatable: 0,
    land: 0,
    selectionSupport: getSelectionSupport(context.draw, context.colorProfile),
  };

  for (const card of taggedCards) {
    for (const hit of card.hits) {
      const amount = roundTo(hit.weight * card.quantity, 2);

      if (hit.tag === "direct_tutor") {
        counts.direct += amount;
      } else if (hit.tag === "restricted_tutor") {
        counts.restricted += amount;
      } else if (hit.tag === "repeatable_tutor") {
        counts.repeatable += amount;
      } else if (hit.tag === "land_tutor") {
        counts.land += amount;
      }
    }
  }

  counts.direct = roundTo(counts.direct, 2);
  counts.restricted = roundTo(counts.restricted, 2);
  counts.repeatable = roundTo(counts.repeatable, 2);
  counts.land = roundTo(counts.land, 2);

  const core = roundTo(
    counts.direct * 1.35 +
      counts.restricted +
      counts.repeatable * 1.15 +
      counts.land * 0.28 +
      counts.selectionSupport,
    2,
  );
  const recommendations = {
    directTarget: recommendDirectTutorTarget(
      context.colorProfile,
      context.mainStrategyKey,
      context.comboCount,
    ),
    repeatableTarget: recommendRepeatableTutorTarget(
      context.colorProfile,
      context.mainStrategyKey,
    ),
    coreTarget: 0,
  };
  recommendations.coreTarget = roundTo(
    recommendCoreConsistencyTarget(
      context.colorProfile,
      context.mainStrategyKey,
      context.comboCount,
      recommendations.directTarget,
      recommendations.repeatableTarget,
    ),
    1,
  );

  const findings = [
    assessConsistencyCore(core, recommendations.coreTarget, context),
    assessDirectTutors(counts.direct, recommendations.directTarget, context),
    assessRepeatableTutors(
      counts.repeatable,
      recommendations.repeatableTarget,
      counts.selectionSupport,
      context,
    ),
    assessTutorMix(counts.direct, counts.restricted, counts.land, counts.selectionSupport, context),
  ];
  const consistencyScore = scoreConsistency({
    core,
    direct: counts.direct,
    restricted: counts.restricted,
    repeatable: counts.repeatable,
    land: counts.land,
    selectionSupport: counts.selectionSupport,
    recommendations,
    colorProfile: context.colorProfile,
    mainStrategyKey: context.mainStrategyKey,
  });

  return {
    consistencyScore,
    summary: summarizeConsistencyScore(consistencyScore),
    counts: {
      core,
      direct: counts.direct,
      restricted: counts.restricted,
      repeatable: counts.repeatable,
      land: counts.land,
      selectionSupport: counts.selectionSupport,
    },
    recommendations,
    findings,
    taggedCards,
  };
}

function getConsistencyContext(
  document: DeckResolutionDocument,
  options: {
    draw?: DeckDrawAnalysis;
    strategy?: DeckStrategyAnalysis;
    winConditions?: DeckWinConditionAnalysis;
  },
): ConsistencyContext {
  const deckCards = document.result.resolvedCards.filter(
    (card) => card.section === "commander" || card.section === "mainboard",
  );
  const nonlandCards = deckCards.filter((card) => !hasCardType(card.card, "Land"));
  const nonlandQuantity = sumQuantities(nonlandCards);
  const effectiveManaContext = createEffectiveManaValueContext(deckCards);

  return {
    deckCards,
    effectiveManaContext,
    colorProfile: getCommanderColorProfile(deckCards),
    averageManaValue:
      nonlandQuantity === 0
        ? 0
        : sumEffectiveManaValue(nonlandCards, effectiveManaContext) / nonlandQuantity,
    mainStrategyKey: options.strategy?.mainStrategy?.key ?? null,
    comboCount: options.winConditions?.combos.exactCount ?? 0,
    draw: options.draw,
  };
}

function detectTutorHits(
  card: ScryfallCard,
  effectiveManaContext: ReturnType<typeof createEffectiveManaValueContext>,
): TutorTagHit[] {
  const hits = new Map<TutorTag, { weight: number; reasons: Set<string> }>();
  const segments = getConsistencySegments(card);
  const qualityText = segments.map((segment) => segment.text).join(" ");
  const effectiveManaValue = estimateEffectiveManaValue(card, effectiveManaContext);

  for (const segment of segments) {
    if (!segment.text) {
      continue;
    }

    const tutorProfile = getTutorProfile(segment.text, segment.typeLine);
    if (!tutorProfile) {
      continue;
    }

    addHit(
      hits,
      tutorProfile.kind,
      estimateTutorWeight(effectiveManaValue, tutorProfile),
      describeTutorProfile(tutorProfile),
    );

    if (tutorProfile.repeatable) {
      addHit(
        hits,
        "repeatable_tutor",
        estimateRepeatableTutorWeight(effectiveManaValue, tutorProfile),
        "Provides repeatable access to specific cards over multiple turns.",
      );
    }
  }

  const advancedProfile = hits.size === 0 ? inferAdvancedRoleProfile(card) : null;
  if (advancedProfile) {
    const mappings: Array<[TutorTag, string]> = [
      ["direct_tutor", "direct_tutor"],
      ["restricted_tutor", "restricted_tutor"],
      ["repeatable_tutor", "repeatable_tutor"],
      ["land_tutor", "land_tutor"],
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

function getTutorProfile(text: string, typeLine: string): SearchTutorProfile | null {
  const normalized = normalizeText(text);
  const permanent = isPermanentType(typeLine);
  const hasSearchLibrary = /\bsearch(?:es)?\b[^.]{0,220}\byour library\b/.test(normalized);
  const hasTransmuteTutor =
    /\btransmute\b/.test(normalized) &&
    /\bsearch(?:es)?\b[^.]{0,220}\byour library\b[^.]{0,220}\bfor a card with the same mana value\b/.test(
      normalized,
    );
  const libraryDigProfile = getLibraryDigTutorProfile(normalized, permanent);

  if (!hasSearchLibrary && !hasTransmuteTutor) {
    return libraryDigProfile;
  }

  const destination = getTutorDestination(normalized);
  const repeatable = isRepeatableTutor(normalized, permanent);

  if (isLandTutor(normalized)) {
    return {
      kind: "land_tutor",
      destination,
      breadth: "land",
      repeatable,
    };
  }

  if (hasTransmuteTutor || isRestrictedTutor(normalized)) {
    return {
      kind: "restricted_tutor",
      destination,
      breadth: isBroadRestrictedTutor(normalized) ? "broad" : "narrow",
      repeatable,
    };
  }

  if (isDirectTutor(normalized)) {
    return {
      kind: "direct_tutor",
      destination,
      breadth: "broad",
      repeatable,
    };
  }

  return null;
}

function getLibraryDigTutorProfile(text: string, permanent: boolean): SearchTutorProfile | null {
  if (!hasLibraryDigAccess(text)) {
    return null;
  }

  const destination =
    /\bonto the battlefield\b/.test(text) ? "battlefield"
    : /\binto your hand\b/.test(text) ? "hand"
    : "unknown";

  if (destination === "unknown") {
    return null;
  }

  return {
    kind: "restricted_tutor",
    destination,
    breadth: isBroadLibraryDig(text) ? "broad" : "narrow",
    repeatable: isRepeatableLibraryDig(text, permanent),
  };
}

function hasLibraryDigAccess(text: string) {
  return (
    /\b(?:look at|reveal)\b[\s\S]{0,180}\b(?:top|cards? of your library)\b[\s\S]{0,220}\bput\b[\s\S]{0,160}\b(?:from among them|from among those cards|from among the revealed cards|from among the cards revealed this way|one of them)\b[\s\S]{0,160}\b(?:into your hand|onto the battlefield)\b/.test(
      text,
    ) ||
    /\bmills?\b[\s\S]{0,180}\bput\b[\s\S]{0,160}\b(?:from among them|from among those cards|from among the milled cards|from among the cards milled this way|from among cards milled this way)\b[\s\S]{0,160}\b(?:into your hand|onto the battlefield)\b/.test(
      text,
    ) ||
    /\bput\b[\s\S]{0,160}\b(?:from among them|from among those cards|from among the revealed cards|from among the cards revealed this way|from among the milled cards|from among the cards milled this way|from among cards milled this way)\b[\s\S]{0,160}\b(?:into your hand|onto the battlefield)\b/.test(
      text,
    ) ||
    /\breveal cards? from the top of your library until\b[\s\S]{0,220}\bput (?:that card|it|one of them)\b[\s\S]{0,120}\b(?:into your hand|onto the battlefield)\b/.test(
      text,
    )
  );
}

function isBroadLibraryDig(text: string) {
  return (
    /\bput (?:a|one|that|it)?\s*cards?\b[\s\S]{0,120}\b(?:into your hand|onto the battlefield)\b/.test(text) ||
    /\bput one of them into your hand\b/.test(text)
  );
}

function isRepeatableLibraryDig(text: string, permanent: boolean) {
  return (
    permanent &&
    !/\benters the battlefield\b/.test(text) &&
    /\b(?:whenever|at the beginning of|during each of your turns|attacks)\b/.test(text)
  );
}

function isLandTutor(text: string) {
  return (
    /\bsearch(?:es)?\b[^.]{0,220}\byour library\b[^.]{0,220}\bfor\b[^.]{0,150}\b(?:basic |snow |nonbasic )?(?:land|forest|plains|island|swamp|mountain|desert|gate|cave|locus)\s+cards?\b/.test(
      text,
    ) ||
    /\bsearch(?:es)?\b[^.]{0,220}\byour library\b[^.]{0,220}\bfor\b[^.]{0,150}\ba land card\b/.test(
      text,
    )
  );
}

function isRestrictedTutor(text: string) {
  return (
    /\bsearch(?:es)?\b[^.]{0,220}\byour library\b[^.]{0,220}\bfor\b[^.]{0,170}\b(?:artifact|creature|enchantment|instant|sorcery|planeswalker|battle|equipment|aura|permanent|legendary|historic|dragon|wizard|elf|goblin|vampire|zombie|sliver)\s+cards?\b/.test(
      text,
    ) ||
    /\bsearch(?:es)?\b[^.]{0,220}\byour library\b[^.]{0,220}\bfor\b[^.]{0,170}\bcard with\b/.test(
      text,
    ) ||
    /\bsearch(?:es)?\b[^.]{0,220}\byour library\b[^.]{0,220}\bfor\b[^.]{0,170}\bcard named\b/.test(
      text,
    )
  );
}

function isBroadRestrictedTutor(text: string) {
  return (
    /\b(?:artifact or enchantment|instant or sorcery|creature or enchantment|artifact, creature, or land)\s+cards?\b/.test(
      text,
    ) ||
    /\b(?:artifact|creature|enchantment|instant|sorcery|permanent)\s+cards?\b/.test(text)
  );
}

function isDirectTutor(text: string) {
  return (
    /\bsearch(?:es)?\b[^.]{0,220}\byour library\b[^.]{0,220}\bfor\b[^.]{0,120}\b(?:a|an|one|two|three|four|five|\d+|up to (?:one|two|three|four|five|\d+)|any number of)\s+cards?\b/.test(
      text,
    ) ||
    /\bsearch(?:es)?\b[^.]{0,220}\byour library\b[^.]{0,220}\bfor a card\b/.test(text)
  );
}

function getTutorDestination(
  text: string,
): SearchTutorProfile["destination"] {
  if (/\bonto the battlefield\b/.test(text)) {
    return "battlefield";
  }

  if (/\binto your hand\b|\bput (?:it|them) into your hand\b/.test(text)) {
    return "hand";
  }

  if (/\bon top of\b[^.]{0,40}\blibrary\b/.test(text)) {
    return "top";
  }

  if (/\binto your graveyard\b|\bput (?:it|them) into your graveyard\b/.test(text)) {
    return "graveyard";
  }

  if (/\byou may cast\b|\bcast that card\b/.test(text)) {
    return "cast";
  }

  return "unknown";
}

function isRepeatableTutor(text: string, permanent: boolean) {
  if (!permanent) {
    return false;
  }

  if (/\benters the battlefield\b/.test(text) && !/\bwhenever\b/.test(text)) {
    return false;
  }

  return (
    /\{[^}]+\}[^.]{0,200}\bsearch(?:es)?\b[^.]{0,120}\byour library\b/.test(text) ||
    /\b(?:whenever|at the beginning of|during each of your turns)\b[^.]{0,220}\bsearch(?:es)?\b[^.]{0,120}\byour library\b/.test(
      text,
    ) ||
    /\battacks\b[^.]{0,180}\bsearch(?:es)?\b[^.]{0,120}\byour library\b/.test(text)
  );
}

function estimateTutorWeight(cmc: number, profile: SearchTutorProfile) {
  let weight = 0;

  if (profile.kind === "direct_tutor") {
    weight = profile.destination === "battlefield" ? 1.2 : profile.destination === "hand" ? 1.08 : profile.destination === "top" ? 0.95 : profile.destination === "graveyard" ? 0.82 : 1;
  } else if (profile.kind === "restricted_tutor") {
    weight =
      profile.breadth === "broad"
        ? profile.destination === "battlefield"
          ? 1.02
          : 0.9
        : profile.destination === "battlefield"
          ? 0.84
          : 0.74;
  } else {
    weight =
      profile.destination === "battlefield"
        ? 0.48
        : profile.destination === "hand"
          ? 0.32
          : 0.28;
  }

  if (profile.repeatable && profile.kind !== "land_tutor") {
    weight += 0.08;
  }

  return roundTo(weight * getTutorEfficiencyMultiplier(cmc), 2);
}

function estimateRepeatableTutorWeight(cmc: number, profile: SearchTutorProfile) {
  const base =
    profile.kind === "direct_tutor"
      ? 1
      : profile.kind === "restricted_tutor"
        ? profile.breadth === "broad"
          ? 0.88
          : 0.72
        : 0.52;

  return roundTo(base * getTutorEfficiencyMultiplier(cmc), 2);
}

function getTutorEfficiencyMultiplier(cmc: number) {
  if (cmc <= 1) {
    return 1.18;
  }

  if (cmc <= 2) {
    return 1.12;
  }

  if (cmc <= 3) {
    return 1.04;
  }

  if (cmc >= 6) {
    return 0.82;
  }

  if (cmc >= 5) {
    return 0.9;
  }

  return 1;
}

function describeTutorProfile(profile: SearchTutorProfile) {
  if (profile.kind === "direct_tutor") {
    return "Searches for almost any card, which is a direct consistency boost.";
  }

  if (profile.kind === "restricted_tutor") {
    return profile.breadth === "broad"
      ? "Searches for a broad package of cards and improves access to the main plan."
      : "Searches for a narrower package of cards that still improves consistency.";
  }

  return "Searches for lands, which helps setup and some strategy lines.";
}

function getSelectionSupport(
  draw: DeckDrawAnalysis | undefined,
  colorProfile: CommanderColorProfile,
) {
  if (!draw) {
    return 0;
  }

  const selectionFactor = colorProfile.hasRed || colorProfile.hasWhite ? 0.28 : 0.22;
  const repeatableFactor = colorProfile.hasBlue || colorProfile.hasBlack ? 0.2 : 0.14;

  return roundTo(
    draw.counts.selection * selectionFactor + draw.counts.repeatable * repeatableFactor,
    2,
  );
}

function recommendDirectTutorTarget(
  colorProfile: CommanderColorProfile,
  mainStrategyKey: NonNullable<DeckStrategyAnalysis["mainStrategy"]>["key"] | null,
  comboCount: number,
) {
  let target = 0.35;

  if (colorProfile.hasBlack) {
    target += 1.25;
  }

  if (colorProfile.hasBlue) {
    target += 0.45;
  }

  if (colorProfile.hasGreen) {
    target += 0.4;
  }

  if (colorProfile.hasWhite) {
    target += 0.25;
  }

  if (colorProfile.hasRed) {
    target += 0.1;
  }

  target += getStrategyTutorPressure(mainStrategyKey).direct;
  target += Math.min(1.1, comboCount * 0.55);

  return roundTo(clamp(target, 0.5, 4.8), 1);
}

function recommendRepeatableTutorTarget(
  colorProfile: CommanderColorProfile,
  mainStrategyKey: NonNullable<DeckStrategyAnalysis["mainStrategy"]>["key"] | null,
) {
  let target = 0.15;

  if (colorProfile.hasBlue) {
    target += 0.35;
  }

  if (colorProfile.hasGreen) {
    target += 0.3;
  }

  if (colorProfile.hasBlack) {
    target += 0.22;
  }

  if (colorProfile.hasWhite) {
    target += 0.18;
  }

  target += getStrategyTutorPressure(mainStrategyKey).repeatable;

  return roundTo(clamp(target, 0.2, 2.6), 1);
}

function recommendCoreConsistencyTarget(
  colorProfile: CommanderColorProfile,
  mainStrategyKey: NonNullable<DeckStrategyAnalysis["mainStrategy"]>["key"] | null,
  comboCount: number,
  directTarget: number,
  repeatableTarget: number,
) {
  let target =
    directTarget * 1.45 +
    repeatableTarget * 0.95 +
    colorProfile.colorCount * 0.18 +
    (colorProfile.hasBlue || colorProfile.hasWhite || colorProfile.hasGreen ? 0.45 : 0.15);

  target += getStrategyTutorPressure(mainStrategyKey).core;
  target += Math.min(1.2, comboCount * 0.6);

  return clamp(target, 1.4, 8.4);
}

function getStrategyTutorPressure(
  key: NonNullable<DeckStrategyAnalysis["mainStrategy"]>["key"] | null,
) {
  switch (key) {
    case "combo":
      return { direct: 0.85, repeatable: 0.3, core: 1.15 };
    case "control":
      return { direct: 0.45, repeatable: 0.2, core: 0.6 };
    case "reanimator":
    case "spellslinger":
    case "artifacts":
    case "enchantress":
      return { direct: 0.3, repeatable: 0.15, core: 0.4 };
    case "tokens":
    case "kindred":
    case "aggro":
    case "extra_combat":
      return { direct: -0.1, repeatable: 0, core: -0.15 };
    default:
      return { direct: 0, repeatable: 0, core: 0 };
  }
}

function assessConsistencyCore(
  core: number,
  target: number,
  context: ConsistencyContext,
) {
  if (core < target - 1.4) {
    return {
      code: "consistency_core_low",
      title: "Consistency package is light",
      status: "risk",
      message: `${core.toFixed(2)} total consistency is well below the rough target of ${target}. ${describeConsistencyExpectation(context)}`,
    } as const;
  }

  if (core < target) {
    return {
      code: "consistency_core_light",
      title: "Consistency package is a little light",
      status: "warning",
      message: `${core.toFixed(2)} total consistency is slightly below the rough target of ${target}. ${describeConsistencyExpectation(context)}`,
    } as const;
  }

  if (core > target + 3.2) {
    return {
      code: "consistency_core_dense",
      title: "Consistency package is very dense",
      status: "note",
      message: `${core.toFixed(2)} total consistency is clearly above the target of ${target}. The deck should find the same lines often, but some slots are heavily dedicated to access.`,
    } as const;
  }

  return {
    code: "consistency_core_fit",
    title: "Consistency package looks healthy",
    status: "good",
    message: `${core.toFixed(2)} total consistency lines up well with the target of ${target}.`,
  } as const;
}

function assessDirectTutors(
  direct: number,
  target: number,
  context: ConsistencyContext,
) {
  if (direct < target - 0.8) {
    return {
      code: "direct_tutors_low",
      title: "Direct tutors are light",
      status: context.colorProfile.hasBlack || context.mainStrategyKey === "combo" ? "warning" : "note",
      message: `${direct.toFixed(2)} direct tutors is below the rough target of ${target}. ${describeDirectTutorExpectation(context)}`,
    } as const;
  }

  if (direct > target + 1.8) {
    return {
      code: "direct_tutors_dense",
      title: "Direct tutors are dense",
      status: "note",
      message: `${direct.toFixed(2)} direct tutors is well above the target of ${target}. The deck should assemble key cards very reliably.`,
    } as const;
  }

  return {
    code: "direct_tutors_fit",
    title: "Direct tutors are on pace",
    status: "good",
    message: `${direct.toFixed(2)} direct tutors sits close to the rough target of ${target}.`,
  } as const;
}

function assessRepeatableTutors(
  repeatable: number,
  target: number,
  selectionSupport: number,
  context: ConsistencyContext,
) {
  if (repeatable < target - 0.45 && selectionSupport < 1) {
    return {
      code: "repeatable_tutors_low",
      title: "Long-game access is thin",
      status: "warning",
      message: `${repeatable.toFixed(2)} repeatable tutors and ${selectionSupport.toFixed(2)} access support leave the deck with a fairly shallow consistency floor. ${describeRepeatableExpectation(context)}`,
    } as const;
  }

  if (repeatable > target + 1.2) {
    return {
      code: "repeatable_tutors_dense",
      title: "Long-game access is strong",
      status: "good",
      message: `${repeatable.toFixed(2)} repeatable tutors is above the target of ${target}, which gives the deck strong midgame access.`,
    } as const;
  }

  return {
    code: "repeatable_tutors_fit",
    title: "Long-game access looks reasonable",
    status: "good",
    message: `${repeatable.toFixed(2)} repeatable tutors plus ${selectionSupport.toFixed(2)} access support gives the deck a workable consistency floor.`,
  } as const;
}

function assessTutorMix(
  direct: number,
  restricted: number,
  land: number,
  selectionSupport: number,
  context: ConsistencyContext,
) {
  if (land > direct + restricted + 1.8) {
    return {
      code: "tutor_mix_land_heavy",
      title: "Consistency is mostly land-based",
      status: "note",
      message: `${land.toFixed(2)} of the tutor package is tied up in lands. That helps setup, but it does less to find payoff cards or specific lines.`,
    } as const;
  }

  if (direct + restricted < 1 && selectionSupport >= 1.5) {
    return {
      code: "consistency_via_access",
      title: "Consistency leans on access instead of tutors",
      status: "note",
      message: `${selectionSupport.toFixed(2)} access support is doing more work than direct search. ${describeSelectionBackfill(context)}`,
    } as const;
  }

  return {
    code: "tutor_mix_balanced",
    title: "Tutor mix looks balanced",
    status: "good",
    message: `${(direct + restricted).toFixed(2)} broad or restricted tutors plus ${land.toFixed(2)} land tutors gives the deck a balanced mix of setup and card access.`,
  } as const;
}

function scoreConsistency(input: ConsistencyScoreInput) {
  const coreRatio = input.core / Math.max(input.recommendations.coreTarget, 0.1);
  const directRatio = input.direct / Math.max(input.recommendations.directTarget, 0.1);
  const repeatableRatio = input.repeatable / Math.max(input.recommendations.repeatableTarget, 0.1);
  const accessRatio = input.selectionSupport / Math.max(getAccessSupportTarget(input.colorProfile), 0.4);

  let score =
    12 +
    clamp(coreRatio, 0, 1.35) * 42 +
    clamp(directRatio, 0, 1.35) * 18 +
    clamp(repeatableRatio, 0, 1.35) * 12 +
    clamp(accessRatio, 0, 1.35) * 10 +
    clamp(input.restricted, 0, 4) * 2.8;

  if (coreRatio < 0.55) {
    score -= 15;
  }

  if (directRatio < 0.45 && (input.colorProfile.hasBlack || input.mainStrategyKey === "combo")) {
    score -= 8;
  }

  if (repeatableRatio < 0.45 && accessRatio < 0.55) {
    score -= 6;
  }

  if (input.land > input.direct + input.restricted + 2) {
    score -= 6;
  }

  if (coreRatio > 1.85) {
    score -= Math.min(8, Math.round((coreRatio - 1.85) * 10));
  }

  return clamp(Math.round(score), 0, 100);
}

function getAccessSupportTarget(colorProfile: CommanderColorProfile) {
  let target = 0.7;

  if (colorProfile.hasBlue) {
    target += 0.45;
  }

  if (colorProfile.hasRed) {
    target += 0.25;
  }

  if (colorProfile.hasWhite) {
    target += 0.2;
  }

  return roundTo(target, 1);
}

function summarizeConsistencyScore(score: number) {
  if (score >= 82) {
    return "The deck should find its important cards very reliably.";
  }

  if (score >= 68) {
    return "The deck has a solid consistency package with a few softer spots.";
  }

  if (score >= 48) {
    return "The deck has some consistency tools, but it will not assemble the same lines every game.";
  }

  return "The deck is still fairly loose on tutors and reliable card access.";
}

function describeConsistencyExpectation(context: ConsistencyContext) {
  if (context.mainStrategyKey === "combo") {
    return "Combo shells usually want more ways to line up specific pieces.";
  }

  if (context.colorProfile.hasBlack) {
    return "Black-based shells usually have access to more reliable tutor density than this.";
  }

  if (context.colorProfile.hasBlue || context.colorProfile.hasGreen) {
    return "These colors usually support a bit more reliable card access or search than this.";
  }

  return "This does not have to mean true black-style tutor density, but the shell still wants clearer access to its key cards.";
}

function describeDirectTutorExpectation(context: ConsistencyContext) {
  if (context.mainStrategyKey === "combo") {
    return "Combo plans are usually strongest when they can find exact pieces more often.";
  }

  if (context.colorProfile.hasBlack) {
    return "Black especially tends to convert deck slots into direct access more efficiently than this.";
  }

  if (context.colorProfile.hasRed && !context.colorProfile.hasBlack && !context.colorProfile.hasGreen) {
    return "In these colors that often means more redundancy or card access, not necessarily premium Demonic Tutor-style effects.";
  }

  return "That can be fine in fair shells, but it lowers how often the deck assembles specific plans on time.";
}

function describeRepeatableExpectation(context: ConsistencyContext) {
  if (context.colorProfile.hasBlue || context.colorProfile.hasGreen) {
    return "Blue and green shells often get more long-game access from repeatable search or engines.";
  }

  return "That usually means the deck is more dependent on opening hands and one-shot access.";
}

function describeSelectionBackfill(context: ConsistencyContext) {
  if (context.colorProfile.hasRed || context.colorProfile.hasWhite) {
    return "That is a normal pattern in colors that rely more on redundancy, impulse access, and selection than true broad tutors.";
  }

  return "That can still work, but it is less exact than true search effects.";
}

function addHit(
  hits: Map<TutorTag, { weight: number; reasons: Set<string> }>,
  tag: TutorTag,
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

function getConsistencySegments(card: ScryfallCard) {
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

function isPermanentType(typeLine: string) {
  return /artifact|creature|enchantment|planeswalker|battle/i.test(typeLine);
}

function hasCardType(card: ScryfallCard, type: string) {
  return card.type_line.toLowerCase().includes(type.toLowerCase());
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/\u2014/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sumQuantities(cards: ResolvedDeckCard[]) {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}

function totalWeight(hits: TutorTagHit[]) {
  return hits.reduce((sum, hit) => sum + hit.weight, 0);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
