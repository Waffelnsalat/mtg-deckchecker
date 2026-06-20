import { CommanderColorProfile, getCommanderColorProfile } from "./commanderColorProfile";
import { createEffectiveManaValueContext, sumEffectiveManaValue } from "./effectiveManaValue";
import {
  DeckLandBaseAnalysis,
  DeckResolutionDocument,
  LandBaseTag,
  LandBaseTagHit,
  LandBaseTaggedCard,
  ResolvedDeckCard,
  ScryfallCard,
} from "./types";

const BASIC_LAND_TYPES = ["Plains", "Island", "Swamp", "Mountain", "Forest"];
const COLORED_MANA_SYMBOL_PATTERN = /\{([WUBRG])\}/g;

interface LandBaseContext {
  deckCards: ResolvedDeckCard[];
  landCards: ResolvedDeckCard[];
  nonlandCards: ResolvedDeckCard[];
  colorProfile: CommanderColorProfile;
  averageManaValue: number;
  colorDemand: {
    averageColoredPips: number;
    multicolorShare: number;
  };
}

export function analyzeDeckLandBase(document: DeckResolutionDocument): DeckLandBaseAnalysis {
  const context = getLandBaseContext(document);
  const taggedCards = context.landCards
    .map((card) => {
      const hits = detectLandBaseHits(card.card);
      if (hits.length === 0) {
        return null;
      }

      return {
        name: card.card.name,
        quantity: card.quantity,
        section: card.section,
        landValue: roundTo(totalWeight(hits), 2),
        hits,
      };
    })
    .filter((card): card is LandBaseTaggedCard => card !== null)
    .sort((left, right) => right.landValue - left.landValue || left.name.localeCompare(right.name));

  const counts = {
    lands: sumQuantities(context.landCards),
    reliableUntapped: 0,
    alwaysTapped: 0,
    conditionalTapped: 0,
    typed: 0,
    fetch: 0,
    utility: 0,
    colorlessOnly: 0,
    costly: 0,
  };

  for (const land of context.landCards) {
    const hits = detectLandBaseHits(land.card);
    const quantity = land.quantity;
    const tags = new Set(hits.map((hit) => hit.tag));

    if (tags.has("always_tapped")) {
      counts.alwaysTapped += quantity;
    } else if (tags.has("conditional_tapped")) {
      counts.conditionalTapped += quantity;
    } else {
      counts.reliableUntapped += quantity;
    }

    if (tags.has("typed_land")) {
      counts.typed += quantity;
    }

    if (tags.has("fetch_land")) {
      counts.fetch += quantity;
    }

    if (tags.has("utility_land")) {
      counts.utility += quantity;
    }

    if (tags.has("colorless_only")) {
      counts.colorlessOnly += quantity;
    }

    if (tags.has("costly_land")) {
      counts.costly += quantity;
    }
  }

  const recommendations = {
    alwaysTappedMax: recommendAlwaysTappedMax(
      context.averageManaValue,
      context.colorProfile.colorCount,
    ),
    conditionalTappedMax: recommendConditionalTappedMax(
      context.averageManaValue,
      context.colorProfile.colorCount,
    ),
    colorlessOnlyMax: recommendColorlessOnlyMax(
      context.colorProfile,
      context.colorDemand,
    ),
    costlyMax: recommendCostlyLandMax(
      context.averageManaValue,
      context.colorProfile.colorCount,
    ),
  };

  const findings = [
    assessLandSpeed(counts, recommendations, context.averageManaValue),
    assessColorlessBurden(counts.colorlessOnly, recommendations.colorlessOnlyMax, context),
    assessLandQuality(counts.typed, counts.fetch, counts.utility),
    assessCostlyLands(counts.costly, recommendations.costlyMax),
  ];
  const landBaseScore = scoreLandBase(counts, recommendations, context);

  return {
    landBaseScore,
    summary: summarizeLandBaseScore(landBaseScore),
    counts,
    recommendations,
    findings,
    taggedCards,
  };
}

function getLandBaseContext(document: DeckResolutionDocument): LandBaseContext {
  const deckCards = document.result.resolvedCards.filter(
    (card) => card.section === "commander" || card.section === "mainboard",
  );
  const landCards = deckCards.filter((card) => hasCardType(card.card, "Land"));
  const nonlandCards = deckCards.filter((card) => !hasCardType(card.card, "Land"));
  const nonlandQuantity = sumQuantities(nonlandCards);
  const effectiveManaContext = createEffectiveManaValueContext(deckCards);

  return {
    deckCards,
    landCards,
    nonlandCards,
    colorProfile: getCommanderColorProfile(deckCards),
    averageManaValue:
      nonlandQuantity === 0
        ? 0
        : sumEffectiveManaValue(nonlandCards, effectiveManaContext) / nonlandQuantity,
    colorDemand: analyzeColorDemand(nonlandCards),
  };
}

function detectLandBaseHits(card: ScryfallCard): LandBaseTagHit[] {
  const hits = new Map<LandBaseTag, { weight: number; reasons: Set<string> }>();
  const landFaces = getLandFaces(card);

  for (const face of landFaces) {
    const typeLine = face.typeLine;
    const rawText = face.text;
    const text = normalizeText(rawText);
    const alwaysTapped = isAlwaysTappedLand(text);
    const conditionalTapped = !alwaysTapped && isConditionalTappedLand(text);
    const fetchLand = isFetchOrSearchLand(text);
    const utilityLand = isUtilityLand(rawText, fetchLand);
    const typedLand = isTypedLand(typeLine, text);
    const artifactLand = typeLine.includes("Artifact Land");
    const colorlessOnly = isColorlessOnlyLand(text);
    const costlyLand = isCostlyLand(text, fetchLand);
    const basicLand = isBasicLand(typeLine);
    const manaSource = isManaSourceLand(text, typeLine);

    addHit(hits, "land_slot", 0.2, "Occupies a land slot in the mana base.");

    if (basicLand) {
      addHit(hits, "basic_land", 0.42, "Basic land slot that supports color production and avoids nonbasic hate.");
    }

    if (manaSource) {
      addHit(hits, "mana_source", 0.42, "Provides mana or color access from the land slot.");
    }

    if (alwaysTapped) {
      addHit(hits, "always_tapped", 1, "Always enters the battlefield tapped.");
    } else if (conditionalTapped) {
      addHit(hits, "conditional_tapped", 0.85, "Often enters tapped unless a condition is met.");
    }

    if (typedLand) {
      addHit(hits, "typed_land", 0.72, "Carries basic land types for stronger land synergies.");
    }

    if (artifactLand) {
      addHit(hits, "artifact_land", 0.78, "Artifact land slot that matters for artifact count and artifact synergies.");
    }

    if (fetchLand) {
      addHit(hits, "fetch_land", 0.96, "Can search for lands and improve draw quality.");
    }

    if (utilityLand) {
      addHit(hits, "utility_land", 0.66, "Provides non-mana utility from the land slot.");
    }

    if (colorlessOnly) {
      addHit(hits, "colorless_only", 0.9, "Only produces colorless mana.");
    }

    if (costlyLand) {
      addHit(hits, "costly_land", 0.7, "Asks for life, tempo, or a real resource cost.");
    }
  }

  return [...hits.entries()].map(([tag, value]) => ({
    tag,
    weight: roundTo(value.weight, 2),
    reason: [...value.reasons].join(" "),
  }));
}

function addHit(
  hits: Map<LandBaseTag, { weight: number; reasons: Set<string> }>,
  tag: LandBaseTag,
  weight: number,
  reason: string,
) {
  const existing = hits.get(tag);
  if (!existing) {
    hits.set(tag, { weight, reasons: new Set([reason]) });
    return;
  }

  existing.weight = Math.max(existing.weight, weight);
  existing.reasons.add(reason);
}

function recommendAlwaysTappedMax(averageManaValue: number, colorCount: number) {
  let max =
    averageManaValue >= 3.9 ? 6
    : averageManaValue >= 3.5 ? 5
    : averageManaValue >= 3.1 ? 4
    : averageManaValue >= 2.7 ? 3
    : 2;

  if (colorCount >= 3) {
    max += 1;
  }

  return clamp(max, 1, 8);
}

function recommendConditionalTappedMax(averageManaValue: number, colorCount: number) {
  let max = recommendAlwaysTappedMax(averageManaValue, colorCount) + 2;

  if (colorCount >= 3) {
    max += 1;
  }

  return clamp(max, 3, 10);
}

function recommendColorlessOnlyMax(
  colorProfile: CommanderColorProfile,
  colorDemand: { averageColoredPips: number; multicolorShare: number },
) {
  if (colorProfile.isColorless) {
    return 99;
  }

  let max =
    colorProfile.colorCount === 1 ? 10
    : colorProfile.colorCount === 2 ? 6
    : colorProfile.colorCount === 3 ? 4
    : colorProfile.colorCount === 4 ? 2
    : 1;

  if (colorDemand.averageColoredPips >= 1.7) {
    max -= 1;
  }

  if (colorDemand.averageColoredPips >= 2.2) {
    max -= 1;
  }

  if (colorDemand.multicolorShare >= 0.18) {
    max -= 1;
  }

  return clamp(max, colorProfile.isMonoColor ? 3 : 0, 12);
}

function recommendCostlyLandMax(averageManaValue: number, colorCount: number) {
  let max =
    colorCount >= 4 ? 3
    : colorCount === 3 ? 4
    : 5;

  if (averageManaValue <= 2.7) {
    max -= 1;
  }

  return clamp(max, 2, 6);
}

function assessLandSpeed(
  counts: DeckLandBaseAnalysis["counts"],
  recommendations: DeckLandBaseAnalysis["recommendations"],
  averageManaValue: number,
) {
  if (
    counts.alwaysTapped > recommendations.alwaysTappedMax + 1 ||
    counts.conditionalTapped > recommendations.conditionalTappedMax + 2
  ) {
    return {
      code: "land_speed_low",
      title: "Land speed is dragging the deck",
      status: "risk",
      message: `${counts.alwaysTapped} always-tapped and ${counts.conditionalTapped} conditional-tapped lands is heavy for an average mana value of ${averageManaValue.toFixed(2)}. This base will slow early turns more than it should.`,
    } as const;
  }

  if (
    counts.alwaysTapped > recommendations.alwaysTappedMax ||
    counts.conditionalTapped > recommendations.conditionalTappedMax
  ) {
    return {
      code: "land_speed_mid",
      title: "Land speed is a little slow",
      status: "warning",
      message: `${counts.alwaysTapped} always-tapped and ${counts.conditionalTapped} conditional-tapped lands pushes the base above the suggested speed range. The deck may stumble more often in the opening turns.`,
    } as const;
  }

  return {
    code: "land_speed_fit",
    title: "Land speed looks healthy",
    status: "good",
    message: `${counts.reliableUntapped} lands are reliably untapped, while the tapped land count stays in a reasonable range for this shell.`,
  } as const;
}

function assessColorlessBurden(
  colorlessOnly: number,
  maxColorlessOnly: number,
  context: LandBaseContext,
) {
  if (context.colorProfile.isColorless) {
    return {
      code: "colorless_land_fit",
      title: "Colorless lands are expected here",
      status: "good",
      message: "This commander is colorless, so colorless-only lands are not a deckbuilding problem.",
    } as const;
  }

  if (colorlessOnly > maxColorlessOnly + 1) {
    return {
      code: "colorless_land_high",
      title: "Colorless burden is too high",
      status: "risk",
      message: `${colorlessOnly} colorless-only lands is above the suggested max of ${maxColorlessOnly} for this color demand. The base may miss colored spells too often.`,
    } as const;
  }

  if (colorlessOnly > maxColorlessOnly) {
    return {
      code: "colorless_land_light_warning",
      title: "Colorless burden is a little high",
      status: "warning",
      message: `${colorlessOnly} colorless-only lands is slightly above the suggested max of ${maxColorlessOnly}. That can work, but the mana base is taking on extra strain.`,
    } as const;
  }

  return {
    code: "colorless_land_fit",
    title: "Colorless burden looks controlled",
    status: "good",
    message: `${colorlessOnly} colorless-only lands stays within the suggested ceiling of ${maxColorlessOnly} for this deck.`,
  } as const;
}

function assessLandQuality(typed: number, fetch: number, utility: number) {
  const quality = fetch * 1.2 + typed * 0.9 + utility * 0.45;

  if (quality >= 7) {
    return {
      code: "land_quality_high",
      title: "Land quality looks strong",
      status: "good",
      message: `${fetch} fetch/search lands, ${typed} typed lands, and ${utility} utility lands gives the base meaningful flexibility and upside.`,
    } as const;
  }

  if (quality >= 3.5) {
    return {
      code: "land_quality_mid",
      title: "Land quality has some upside",
      status: "note",
      message: `The land base has some quality texture from fetch/search lands, typed lands, or utility slots without being overloaded.`,
    } as const;
  }

  return {
    code: "land_quality_low",
    title: "Land base is mostly functional lands",
    status: "note",
    message: "The land base is mostly straightforward mana production with limited land-slot upside. That is fine if the speed and color balance are clean.",
  } as const;
}

function assessCostlyLands(costly: number, maxCostly: number) {
  if (costly > maxCostly) {
    return {
      code: "costly_lands_high",
      title: "Too many lands come with a cost",
      status: "warning",
      message: `${costly} lands ask for life, bounce, or another real resource cost. The base may be paying too much for its utility.`,
    } as const;
  }

  if (costly > 0) {
    return {
      code: "costly_lands_present",
      title: "Costly lands stay controlled",
      status: "note",
      message: `${costly} lands come with a meaningful drawback, but the total still looks manageable.`,
    } as const;
  }

  return {
    code: "costly_lands_low",
    title: "Land drawbacks stay light",
    status: "good",
    message: "The land base is not leaning heavily on life loss or tempo-negative utility lands.",
  } as const;
}

function scoreLandBase(
  counts: DeckLandBaseAnalysis["counts"],
  recommendations: DeckLandBaseAnalysis["recommendations"],
  context: LandBaseContext,
) {
  let score = 70;
  const alwaysTappedOver = Math.max(0, counts.alwaysTapped - recommendations.alwaysTappedMax);
  const conditionalTappedOver = Math.max(
    0,
    counts.conditionalTapped - recommendations.conditionalTappedMax,
  );
  const colorlessOver = Math.max(0, counts.colorlessOnly - recommendations.colorlessOnlyMax);
  const costlyOver = Math.max(0, counts.costly - recommendations.costlyMax);

  score -= counts.alwaysTapped * 2.25;
  score -= counts.conditionalTapped * 0.8;
  score -= counts.costly * 0.6;

  if (!context.colorProfile.isColorless) {
    score -= counts.colorlessOnly * 1.4;
  }

  score -= alwaysTappedOver * 8;
  score -= conditionalTappedOver * 4;
  score -= colorlessOver * 10;
  score -= costlyOver * 4;

  if (counts.alwaysTapped > recommendations.alwaysTappedMax + 2) {
    score -= 4;
  }

  if (counts.conditionalTapped > recommendations.conditionalTappedMax + 3) {
    score -= 3;
  }

  const qualityBonus = Math.min(
    9,
    counts.fetch * 1.2 + counts.typed * 0.8 + Math.min(counts.utility, 6) * 0.45,
  );
  score += qualityBonus;

  if (
    counts.reliableUntapped >=
    counts.lands - recommendations.alwaysTappedMax - Math.max(0, recommendations.conditionalTappedMax - 2)
  ) {
    score += 1;
  }

  const noMajorLandPressure =
    alwaysTappedOver === 0 &&
    conditionalTappedOver === 0 &&
    colorlessOver === 0 &&
    costlyOver === 0;

  if (
    noMajorLandPressure &&
    qualityBonus >= 6 &&
    counts.alwaysTapped === 0 &&
    counts.conditionalTapped <= Math.max(1, Math.floor(recommendations.conditionalTappedMax / 3)) &&
    counts.colorlessOnly <= (context.colorProfile.isMonoColor ? 1 : 0) &&
    counts.costly <= 1
  ) {
    score += 6;
  } else if (noMajorLandPressure && qualityBonus >= 4.5 && counts.alwaysTapped <= 1) {
    score += 2;
  }

  return clamp(Math.round(score), 0, 100);
}

function summarizeLandBaseScore(score: number) {
  if (score >= 86) {
    return "Land base should play smoothly and carry useful upside.";
  }

  if (score >= 72) {
    return "Land base looks serviceable with a few quality flags.";
  }

  if (score >= 58) {
    return "Land base has noticeable speed or stability drag.";
  }

  return "Land base is likely to slow the deck or strain colors.";
}

function analyzeColorDemand(nonlandCards: ResolvedDeckCard[]) {
  const totalCards = Math.max(sumQuantities(nonlandCards), 1);
  let coloredPips = 0;
  let multicolorCards = 0;

  for (const card of nonlandCards) {
    const manaCost = getPrimaryManaCost(card.card);
    const coloredSymbols = manaCost.match(COLORED_MANA_SYMBOL_PATTERN) ?? [];
    const distinctColors = new Set(coloredSymbols.map((symbol) => symbol[1]));

    coloredPips += coloredSymbols.length * card.quantity;
    if (distinctColors.size >= 2) {
      multicolorCards += card.quantity;
    }
  }

  return {
    averageColoredPips: roundTo(coloredPips / totalCards, 2),
    multicolorShare: roundTo(multicolorCards / totalCards, 3),
  };
}

function getLandFaces(card: ScryfallCard) {
  if (!card.card_faces?.length) {
    return hasCardType(card, "Land")
      ? [{ typeLine: card.type_line, text: card.oracle_text ?? "" }]
      : [];
  }

  return card.card_faces
    .filter((face) => face.type_line?.includes("Land"))
    .map((face) => ({
      typeLine: face.type_line ?? "",
      text: face.oracle_text ?? "",
    }));
}

function isAlwaysTappedLand(text: string) {
  if (!/\benters the battlefield tapped\b/.test(text)) {
    return false;
  }

  return !/\bunless\b|\byou may\b|\bif you don'?t\b|\bif you control\b|\bas [^.]* enters\b/.test(text);
}

function isConditionalTappedLand(text: string) {
  if (!/\benters the battlefield tapped\b/.test(text)) {
    return false;
  }

  return /\bunless\b|\byou may\b|\bif you don'?t\b|\bif you control\b|\bas [^.]* enters\b/.test(text);
}

function isTypedLand(typeLine: string, text: string) {
  const typeMatches = BASIC_LAND_TYPES.filter((type) => typeLine.includes(type)).length;
  if (/\bBasic Land\b/.test(typeLine)) {
    return false;
  }

  return typeMatches >= 1 || /\bis every basic land type\b/.test(text);
}

function isBasicLand(typeLine: string) {
  return /\bBasic Land\b/.test(typeLine);
}

function isManaSourceLand(text: string, typeLine: string) {
  return (
    isBasicLand(typeLine) ||
    /:\s*add\b/.test(text) ||
    /\(\{t\}: add\b/.test(text) ||
    /\badd one mana\b/.test(text) ||
    /\badd (?:one|two|three|x) mana of\b/.test(text)
  );
}

function isFetchOrSearchLand(text: string) {
  return (
    /\bsearch your library\b/.test(text) &&
    /\b(?:land|plains|island|swamp|mountain|forest)\b/.test(text) &&
    (/\bonto the battlefield\b/.test(text) || /\binto your hand\b/.test(text))
  );
}

function isUtilityLand(text: string, fetchLand: boolean) {
  if (!text || fetchLand) {
    return false;
  }

  const rawLines = text
    .split(/\r?\n/)
    .flatMap((line) => line.split(/(?<=\.)\s+/))
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of rawLines) {
    const normalizedLine = normalizeText(line);

    if (isIgnorableLandLine(normalizedLine)) {
      continue;
    }

    if (hasUtilityAbilityLine(normalizedLine)) {
      return true;
    }
  }

  return false;
}

function isIgnorableLandLine(text: string) {
  return (
    isManaAbilityLine(text) ||
    /\benters the battlefield tapped\b/.test(text) ||
    /\benters tapped\b/.test(text) ||
    /\bas [^.]* enters the battlefield\b/.test(text) ||
    /\bif you don'?t\b[^.]*\benters tapped\b/.test(text) ||
    /\bis every basic land type\b/.test(text) ||
    /\bpay \d+ life\b/.test(text) ||
    /\blose \d+ life\b/.test(text) ||
    /\bdeals? \d+ damage to you\b/.test(text) ||
    /\breturn a land you control to its owner'?s hand\b/.test(text) ||
    /\bsacrifice [^.]* unless\b/.test(text) ||
    /\bsacrifice [^.]* at the beginning of the next end step\b/.test(text) ||
    (text.startsWith("(") && text.includes(": add"))
  );
}

function hasUtilityAbilityLine(text: string) {
  if (/:/.test(text) && !isManaAbilityLine(text)) {
    return true;
  }

  return (
    /\bcycling\b/.test(text) ||
    /\bchannel\b/.test(text) ||
    /\bhideaway\b/.test(text) ||
    /\bscry\b/.test(text) ||
    /\bsurveil\b/.test(text) ||
    /\binvestigate\b/.test(text) ||
    /\bcreate\b/.test(text) ||
    /\bdraw a card\b/.test(text) ||
    /\blook at the top\b/.test(text) ||
    /\bmill\b/.test(text) ||
    /\breturn target\b/.test(text) ||
    /\bdestroy\b/.test(text) ||
    /\bexile\b/.test(text) ||
    /\bdeal\b/.test(text) ||
    /\bbecomes\b[^.]*\bcreature\b/.test(text) ||
    /\btarget\b[^.]*\b(can'?t|gets|gains|loses)\b/.test(text) ||
    /\bsearch your library\b/.test(text) ||
    /\bcast\b[^.]*\bfrom exile\b/.test(text) ||
    /\bplay\b[^.]*\bthis turn\b/.test(text)
  );
}

function isColorlessOnlyLand(text: string) {
  const addClauses = [...text.matchAll(/:\s*add\s+([^.]*)/g)].map((match) => match[1]);
  if (addClauses.length === 0) {
    return false;
  }

  let hasManaAbility = false;
  for (const clause of addClauses) {
    hasManaAbility = true;
    if (/\{[wubrg]\}/.test(clause) || /\bany color\b|\bany type\b|\bany combination of colors\b/.test(clause)) {
      return false;
    }

    if (/\bthat land could produce\b/.test(clause)) {
      return false;
    }
  }

  return hasManaAbility;
}

function isCostlyLand(text: string, fetchLand: boolean) {
  if (fetchLand) {
    return false;
  }

  return (
    /\bpay \d+ life\b/.test(text) ||
    /\blose \d+ life\b/.test(text) ||
    /\bdeals? \d+ damage to you\b/.test(text) ||
    /\breturn a land you control to its owner'?s hand\b/.test(text) ||
    /\bsacrifice [^.]* at the beginning of the next end step\b/.test(text) ||
    /\bsacrifice [^.]* unless\b/.test(text)
  );
}

function isManaAbilityLine(text: string) {
  return /:\s*add\b/.test(text);
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
  return (manaCost.match(COLORED_MANA_SYMBOL_PATTERN) ?? []).length;
}

function hasCardType(card: ScryfallCard, typeName: string) {
  if (card.type_line.includes(typeName)) {
    return true;
  }

  return (card.card_faces ?? []).some((face) => face.type_line?.includes(typeName));
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function totalWeight(hits: LandBaseTagHit[]) {
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
