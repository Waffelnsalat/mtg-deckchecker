import { DeckResolutionDocument } from "./types";
import { createLogger } from "./logger";

const RECOMMANDER_SOURCE = "Recommander";
const RECOMMANDER_API_URL =
  "https://api.recommander.cards/public-release/api/decks/recommend/top";
const RECOMMANDER_TIMEOUT_MS = 7_000;
const RECOMMANDER_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const logger = createLogger("recommander");

interface RecommanderApiCard {
  oracle_id?: string;
  name?: string;
  score?: number;
}

interface RecommanderApiResponse {
  result_code?: string;
  data?: {
    recommendations?: RecommanderApiCard[];
  };
  error?: {
    messages?: string[];
  } | null;
}

export interface RecommanderCardRecommendation {
  oracleId: string | null;
  name: string;
  normalizedName: string;
  score: number;
  rank: number;
}

export interface RecommanderInsights {
  source: typeof RECOMMANDER_SOURCE;
  url: string;
  commanderName: string;
  partnerName: string | null;
  cards: RecommanderCardRecommendation[];
  cardsByName: Map<string, RecommanderCardRecommendation>;
}

interface LookupRecommanderOptions {
  deckCardNamesOverride?: string[];
  excludeDeckCardNames?: string[];
}

const cache = new Map<string, { expiresAt: number; value: RecommanderInsights | null }>();

export async function lookupRecommanderRecommendations(
  document: DeckResolutionDocument,
  options: LookupRecommanderOptions = {},
): Promise<RecommanderInsights | null> {
  const commanderCards = document.result.resolvedCards.filter(
    (card) => card.section === "commander",
  );
  const commanderName = commanderCards[0]?.card.name;

  if (!commanderName) {
    return null;
  }

  const partnerName = commanderCards[1]?.card.name ?? null;
  const deck = prepareDeckCardNames(document, options);

  if (deck.length < 5) {
    return null;
  }

  const cacheKey = buildCacheKey(commanderName, partnerName, deck);
  const cached = cache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const response = await fetch(RECOMMANDER_API_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "mtg-deckchecker/0.1",
      },
      body: JSON.stringify({
        card_format: "name",
        commander: commanderName,
        partner: partnerName,
        deck,
      }),
      signal: AbortSignal.timeout(RECOMMANDER_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn("Lookup failed with non-OK status.", {
        status: response.status,
        commanderName,
      });
      cache.set(cacheKey, { expiresAt: now + 60_000, value: null });
      return null;
    }

    const payload = (await response.json()) as RecommanderApiResponse;

    if (payload.result_code !== "success") {
      const message = payload.error?.messages?.join("; ") || payload.result_code || "unknown error";
      logger.warn("Lookup failed.", { commanderName, message });
      cache.set(cacheKey, { expiresAt: now + 60_000, value: null });
      return null;
    }

    const cards = normalizeRecommendations(payload.data?.recommendations ?? []);
    const insights: RecommanderInsights = {
      source: RECOMMANDER_SOURCE,
      url: RECOMMANDER_API_URL,
      commanderName,
      partnerName,
      cards,
      cardsByName: new Map(cards.map((card) => [card.normalizedName, card])),
    };

    cache.set(cacheKey, {
      expiresAt: now + RECOMMANDER_CACHE_TTL_MS,
      value: insights,
    });
    return insights;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Recommander lookup error.";
    logger.warn("Lookup failed.", { commanderName, message });
    cache.set(cacheKey, { expiresAt: now + 60_000, value: null });
    return null;
  }
}

function prepareDeckCardNames(
  document: DeckResolutionDocument,
  options: LookupRecommanderOptions,
) {
  const excludedNames = new Set(
    (options.excludeDeckCardNames ?? []).map((name) => normalizeText(name)),
  );
  const sourceNames =
    options.deckCardNamesOverride ??
    document.result.resolvedCards
      .filter((card) => card.section === "mainboard")
      .map((card) => card.card.name);

  const uniqueNames = new Map<string, string>();

  for (const name of sourceNames) {
    const normalizedName = normalizeText(name);
    if (!normalizedName || excludedNames.has(normalizedName)) {
      continue;
    }

    if (!uniqueNames.has(normalizedName)) {
      uniqueNames.set(normalizedName, name);
    }
  }

  return [...uniqueNames.values()].sort((left, right) => left.localeCompare(right));
}

function normalizeRecommendations(cards: RecommanderApiCard[]) {
  return cards
    .map((card) => ({
      oracleId: card.oracle_id?.trim() || null,
      name: card.name?.trim() ?? "",
      normalizedName: normalizeText(card.name ?? ""),
      score: Number.isFinite(card.score) ? Number(card.score) : 0,
    }))
    .filter((card) => card.name && card.normalizedName && card.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .map((card, index) => ({
      ...card,
      rank: index + 1,
    }));
}

function buildCacheKey(commanderName: string, partnerName: string | null, deck: string[]) {
  return JSON.stringify({
    commander: normalizeText(commanderName),
    partner: partnerName ? normalizeText(partnerName) : null,
    deck: deck.map((name) => normalizeText(name)).sort(),
  });
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .trim()
    .toLowerCase();
}
