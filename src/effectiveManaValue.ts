import { ResolvedDeckCard, ScryfallCard } from "./types";

export interface EffectiveManaValueContext {
  counts: {
    artifacts: number;
    creatures: number;
    enchantments: number;
    instants: number;
    sorceries: number;
    lands: number;
    legendary: number;
    saga: number;
  };
  cheapestCommanderCmc: number | null;
}

interface AlternativeCostCandidate {
  cost: number;
  reliability: number;
}

export function createEffectiveManaValueContext(
  cards: ResolvedDeckCard[],
): EffectiveManaValueContext {
  const counts = {
    artifacts: 0,
    creatures: 0,
    enchantments: 0,
    instants: 0,
    sorceries: 0,
    lands: 0,
    legendary: 0,
    saga: 0,
  };
  let cheapestCommanderCmc: number | null = null;

  for (const deckCard of cards) {
    const { card, quantity, section } = deckCard;

    if (hasCardType(card, "Artifact")) {
      counts.artifacts += quantity;
    }

    if (hasCardType(card, "Creature")) {
      counts.creatures += quantity;
    }

    if (hasCardType(card, "Enchantment")) {
      counts.enchantments += quantity;
    }

    if (hasCardType(card, "Instant")) {
      counts.instants += quantity;
    }

    if (hasCardType(card, "Sorcery")) {
      counts.sorceries += quantity;
    }

    if (hasCardType(card, "Land")) {
      counts.lands += quantity;
    }

    if (hasCardType(card, "Legendary")) {
      counts.legendary += quantity;
    }

    if (hasCardType(card, "Saga")) {
      counts.saga += quantity;
    }

    if (section === "commander") {
      cheapestCommanderCmc =
        cheapestCommanderCmc === null
          ? card.cmc
          : Math.min(cheapestCommanderCmc, card.cmc);
    }
  }

  return {
    counts,
    cheapestCommanderCmc,
  };
}

export function estimateEffectiveManaValue(
  card: ScryfallCard,
  context?: EffectiveManaValueContext,
) {
  const printedManaValue = Math.max(card.cmc ?? 0, 0);
  const texts = getOracleTexts(card);
  const candidates = [printedManaValue];

  for (const text of texts) {
    if (!text) {
      continue;
    }

    const normalized = normalizeText(text);

    for (const alternative of getAlternativeCostCandidates(normalized, context)) {
      candidates.push(blendAlternativeCost(printedManaValue, alternative));
    }

    const discountedCost = estimateSelfDiscountedCost(
      printedManaValue,
      normalized,
      context,
    );
    candidates.push(discountedCost);
  }

  return roundTo(clamp(Math.min(...candidates), 0, printedManaValue), 2);
}

export function sumEffectiveManaValue(
  cards: ResolvedDeckCard[],
  context?: EffectiveManaValueContext,
) {
  return cards.reduce(
    (sum, card) => sum + estimateEffectiveManaValue(card.card, context) * card.quantity,
    0,
  );
}

export function computeMedianEffectiveManaValue(
  cards: ResolvedDeckCard[],
  context?: EffectiveManaValueContext,
) {
  const manaValues: number[] = [];

  for (const card of cards) {
    const effectiveManaValue = estimateEffectiveManaValue(card.card, context);

    for (let count = 0; count < card.quantity; count += 1) {
      manaValues.push(effectiveManaValue);
    }
  }

  if (manaValues.length === 0) {
    return 0;
  }

  manaValues.sort((left, right) => left - right);
  const middleIndex = Math.floor(manaValues.length / 2);

  if (manaValues.length % 2 === 1) {
    return manaValues[middleIndex];
  }

  return (manaValues[middleIndex - 1] + manaValues[middleIndex]) / 2;
}

function getAlternativeCostCandidates(
  text: string,
  context?: EffectiveManaValueContext,
) {
  const candidates: AlternativeCostCandidate[] = [];
  const explicitPatterns = [
    { pattern: /\bimpending\s+\d+\s*-\s*((?:\{[^}]+\})+)/g, reliability: 0.84 },
    { pattern: /\bevoke\s+((?:\{[^}]+\})+)/g, reliability: 0.72 },
    { pattern: /\bprototype\s+((?:\{[^}]+\})+)/g, reliability: 0.74 },
    { pattern: /\bmiracle\s+((?:\{[^}]+\})+)/g, reliability: 0.38 },
    { pattern: /\bspectacle\s+((?:\{[^}]+\})+)/g, reliability: 0.56 },
    { pattern: /\bsurge\s+((?:\{[^}]+\})+)/g, reliability: 0.48 },
    { pattern: /\bblitz\s+((?:\{[^}]+\})+)/g, reliability: 0.64 },
    { pattern: /\bdash\s+((?:\{[^}]+\})+)/g, reliability: 0.62 },
    { pattern: /\bmadness\s+((?:\{[^}]+\})+)/g, reliability: 0.42 },
    { pattern: /\bcleave\s+((?:\{[^}]+\})+)/g, reliability: 0.44 },
    { pattern: /\bemerge\s+((?:\{[^}]+\})+)/g, reliability: 0.46 },
  ];

  for (const { pattern, reliability } of explicitPatterns) {
    for (const match of text.matchAll(pattern)) {
      const cost = parseManaCost(match[1]);

      if (Number.isFinite(cost)) {
        candidates.push({ cost, reliability });
      }
    }
  }

  for (const match of text.matchAll(
    /\byou may pay\s+((?:\{[^}]+\})+)\s+rather than pay this spell'?s mana cost/g,
  )) {
    const cost = parseManaCost(match[1]);

    if (Number.isFinite(cost)) {
      candidates.push({ cost, reliability: 0.72 });
    }
  }

  for (const sentence of splitIntoSentences(text)) {
    if (
      /\bcast this (?:spell|card) without paying (?:its|their) mana cost\b/.test(sentence)
    ) {
      candidates.push({
        cost: 0,
        reliability: getFreeCastReliability(sentence, context),
      });
    } else if (/\brather than pay this spell'?s mana cost\b/.test(sentence)) {
      candidates.push({
        cost: 0,
        reliability: 0.35,
      });
    }
  }

  return candidates;
}

function estimateSelfDiscountedCost(
  printedManaValue: number,
  text: string,
  context?: EffectiveManaValueContext,
) {
  let bestCost = printedManaValue;

  for (const match of text.matchAll(
    /\bthis spell costs\s+((?:\{[^}]+\})+)\s+less to cast(?:\s+(for each|if)\s+([^.;)]+))?/g,
  )) {
    const discountPerUnit = parseManaCost(match[1]);

    if (!Number.isFinite(discountPerUnit)) {
      continue;
    }

    const qualifierType = match[2] ?? null;
    const qualifierText = match[3] ?? "";
    let estimatedDiscount = discountPerUnit;

    if (qualifierType === "for each") {
      estimatedDiscount *= estimateConditionUnits(qualifierText, context);
    } else if (qualifierType === "if") {
      estimatedDiscount *= 0.6;
    }

    bestCost = Math.min(bestCost, printedManaValue - estimatedDiscount);
  }

  for (const match of text.matchAll(/\baffinity for ([^.(]+)(?:\(|$)/g)) {
    const estimatedDiscount = estimateAffinityDiscount(match[1], context);
    bestCost = Math.min(bestCost, printedManaValue - estimatedDiscount);
  }

  if (/\bconvoke\b/.test(text)) {
    bestCost = Math.min(bestCost, printedManaValue - estimateConvokeDiscount(context));
  }

  if (/\bimprovise\b/.test(text)) {
    bestCost = Math.min(bestCost, printedManaValue - estimateImproviseDiscount(context));
  }

  if (/\bdelve\b/.test(text)) {
    bestCost = Math.min(bestCost, printedManaValue - estimateDelveDiscount(printedManaValue));
  }

  if (/\bundaunted\b/.test(text)) {
    bestCost = Math.min(bestCost, printedManaValue - 1.6);
  }

  return clamp(bestCost, 0, printedManaValue);
}

function blendAlternativeCost(
  printedManaValue: number,
  alternative: AlternativeCostCandidate,
) {
  return printedManaValue - (printedManaValue - alternative.cost) * alternative.reliability;
}

function estimateConditionUnits(
  qualifierText: string,
  context?: EffectiveManaValueContext,
) {
  if (!qualifierText) {
    return 1;
  }

  if (
    /\bcreature(?:s)? on the battlefield\b/.test(qualifierText) ||
    /\bcreature(?:s)? among permanents on the battlefield\b/.test(qualifierText)
  ) {
    return 4.8;
  }

  if (
    /\bcreature(?:s)? you control\b/.test(qualifierText) ||
    /\battacking creature(?:s)?\b/.test(qualifierText)
  ) {
    return estimateControlledPermanentUnits(context?.counts.creatures ?? 0, 2.8);
  }

  if (/\bartifact(?:s)? you control\b/.test(qualifierText)) {
    return estimateControlledPermanentUnits(context?.counts.artifacts ?? 0, 2.6);
  }

  if (/\benchantment(?:s)? you control\b/.test(qualifierText)) {
    return estimateControlledPermanentUnits(context?.counts.enchantments ?? 0, 2.2);
  }

  if (/\bhistoric permanent(?:s)?\b/.test(qualifierText)) {
    return estimateControlledPermanentUnits(
      (context?.counts.artifacts ?? 0) + (context?.counts.legendary ?? 0) + (context?.counts.saga ?? 0),
      3,
    );
  }

  if (/\bcard(?:s)? in your graveyard\b/.test(qualifierText)) {
    return 1.8;
  }

  if (/\bcard(?:s)? in your hand\b/.test(qualifierText)) {
    return 1.4;
  }

  if (/\bopponent(?:s)?\b/.test(qualifierText)) {
    return 1.5;
  }

  return 1;
}

function estimateAffinityDiscount(target: string, context?: EffectiveManaValueContext) {
  const normalizedTarget = normalizeText(target);

  if (normalizedTarget.includes("artifact")) {
    return estimateControlledPermanentUnits(context?.counts.artifacts ?? 0, 2.7) * 0.82;
  }

  if (normalizedTarget.includes("enchantment")) {
    return estimateControlledPermanentUnits(context?.counts.enchantments ?? 0, 2.2) * 0.78;
  }

  if (normalizedTarget.includes("creature")) {
    return estimateControlledPermanentUnits(context?.counts.creatures ?? 0, 2.8) * 0.7;
  }

  if (normalizedTarget.includes("historic")) {
    const historicCount =
      (context?.counts.artifacts ?? 0) + (context?.counts.legendary ?? 0) + (context?.counts.saga ?? 0);
    return estimateControlledPermanentUnits(historicCount, 3) * 0.78;
  }

  return 1.2;
}

function estimateConvokeDiscount(context?: EffectiveManaValueContext) {
  return estimateControlledPermanentUnits(context?.counts.creatures ?? 0, 2.5) * 0.58;
}

function estimateImproviseDiscount(context?: EffectiveManaValueContext) {
  return estimateControlledPermanentUnits(context?.counts.artifacts ?? 0, 2.4) * 0.56;
}

function estimateDelveDiscount(printedManaValue: number) {
  if (printedManaValue >= 7) {
    return 2.2;
  }

  if (printedManaValue >= 5) {
    return 1.7;
  }

  return 1;
}

function estimateControlledPermanentUnits(count: number, cap: number) {
  if (count >= 28) {
    return cap;
  }

  if (count >= 20) {
    return Math.min(cap, 2.6);
  }

  if (count >= 14) {
    return Math.min(cap, 2);
  }

  if (count >= 9) {
    return Math.min(cap, 1.4);
  }

  if (count >= 5) {
    return Math.min(cap, 0.9);
  }

  return 0.5;
}

function getFreeCastReliability(
  sentence: string,
  context?: EffectiveManaValueContext,
) {
  if (sentence.includes("if you control a commander")) {
    const cheapestCommanderCmc = context?.cheapestCommanderCmc;

    if (cheapestCommanderCmc === null || cheapestCommanderCmc === undefined) {
      return 0.45;
    }

    if (cheapestCommanderCmc <= 1) {
      return 0.76;
    }

    if (cheapestCommanderCmc <= 2) {
      return 0.68;
    }

    if (cheapestCommanderCmc <= 4) {
      return 0.56;
    }

    return 0.42;
  }

  if (sentence.includes("if an opponent controls")) {
    return 0.4;
  }

  if (sentence.includes("if it") || sentence.includes("if you")) {
    return 0.32;
  }

  return 0.26;
}

function getOracleTexts(card: ScryfallCard) {
  return [card.oracle_text, ...(card.card_faces ?? []).map((face) => face.oracle_text)].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
}

function parseManaCost(manaCost: string) {
  const symbols = [...manaCost.matchAll(/\{([^}]+)\}/g)].map((match) => match[1].trim().toLowerCase());

  if (symbols.length === 0) {
    return Number.NaN;
  }

  let total = 0;

  for (const symbol of symbols) {
    if (/^\d+$/.test(symbol)) {
      total += Number(symbol);
      continue;
    }

    if (symbol === "x") {
      total += 1;
      continue;
    }

    if (symbol.includes("/")) {
      const parts = symbol.split("/");

      if (parts.some((part) => /^[wubrgc]$/.test(part))) {
        total += 1;
        continue;
      }

      const numericPart = parts.find((part) => /^\d+$/.test(part));
      total += numericPart ? Math.min(Number(numericPart), 1) : 1;
      continue;
    }

    total += 1;
  }

  return total;
}

function hasCardType(card: ScryfallCard, typeName: string) {
  if (card.type_line.includes(typeName)) {
    return true;
  }

  return (card.card_faces ?? []).some((face) => face.type_line?.includes(typeName));
}

function splitIntoSentences(text: string) {
  return text
    .split(/[.!?](?:\s+|$)/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
