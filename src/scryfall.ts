import { normalizeLookupKey } from "./decklist";
import { mapWithConcurrency } from "./asyncUtils";
import { ParsedDeckEntry, ResolvedDeckCard, ScryfallCard, UnresolvedDeckCard } from "./types";

const SCRYFALL_API_BASE = "https://api.scryfall.com";
const SCRYFALL_BATCH_SIZE = 75;
const SCRYFALL_TIMEOUT_MS = 15_000;
const SCRYFALL_RETRY_DELAYS_MS = [0, 700, 1_600];
const SCRYFALL_FUZZY_CONCURRENCY = 4;
const SCRYFALL_MIN_REQUEST_INTERVAL_MS = 120;

const cardLookupCache = new Map<string, ScryfallCard>();
const finalUnmatchedCache = new Set<string>();
let scryfallRequestQueue = Promise.resolve();
let nextScryfallRequestAt = 0;

interface ScryfallCollectionResponse {
  data: ScryfallCard[];
  not_found?: Array<{ name?: string }>;
}

export async function resolveDeckEntries(
  entries: ParsedDeckEntry[],
): Promise<{ cards: ResolvedDeckCard[]; unmatched: UnresolvedDeckCard[] }> {
  const uniqueNames = [...new Set(entries.map((entry) => entry.name))];
  const cardsByRequestedName = new Map<string, ScryfallCard>();
  const collectionMatches = await resolveScryfallCardsByName(uniqueNames);

  for (const card of collectionMatches.values()) {
    storeCardAliases(cardsByRequestedName, card);
  }

  const namesToRetry = uniqueNames.filter((name) => {
    const cacheKey = normalizeLookupKey(name);
    return !collectionMatches.has(cacheKey) && !finalUnmatchedCache.has(cacheKey);
  });

  const fuzzyResults = await mapWithConcurrency(
    namesToRetry,
    SCRYFALL_FUZZY_CONCURRENCY,
    async (name) => {
      try {
        const card = await fetchFuzzyCard(name);
        return { name, card: matchesRequestedName(name, card) ? card : null };
      } catch {
        return { name, card: null };
      }
    },
  );

  for (const result of fuzzyResults) {
    if (result.card) {
      storeCardAliases(cardsByRequestedName, result.card);
      storeGlobalCardAliases(result.card);
      cardsByRequestedName.set(normalizeLookupKey(result.name), result.card);
    } else {
      finalUnmatchedCache.add(normalizeLookupKey(result.name));
    }
  }

  const cards: ResolvedDeckCard[] = [];
  const unmatched: UnresolvedDeckCard[] = [];

  for (const entry of entries) {
    const card = cardsByRequestedName.get(normalizeLookupKey(entry.name));

    if (!card) {
      unmatched.push({
        quantity: entry.quantity,
        section: entry.section,
        requestedName: entry.name,
        originalLine: entry.originalLine,
        lineNumber: entry.lineNumber,
        reason: "No matching Scryfall card was found.",
      });
      continue;
    }

    cards.push({
      quantity: entry.quantity,
      section: entry.section,
      requestedName: entry.name,
      originalLine: entry.originalLine,
      lineNumber: entry.lineNumber,
      card,
    });
  }

  return {
    cards,
    unmatched,
  };
}

export async function resolveScryfallCardsByName(names: string[]): Promise<Map<string, ScryfallCard>> {
  const cardsByRequestedName = new Map<string, ScryfallCard>();
  const namesToFetch: string[] = [];
  const seenNames = new Set<string>();

  for (const name of names) {
    const cacheKey = normalizeLookupKey(name);

    if (!cacheKey || seenNames.has(cacheKey)) {
      continue;
    }

    seenNames.add(cacheKey);

    const cachedCard = cardLookupCache.get(cacheKey);
    if (cachedCard) {
      cardsByRequestedName.set(cacheKey, cachedCard);
      continue;
    }

    if (!finalUnmatchedCache.has(cacheKey)) {
      namesToFetch.push(name);
    }
  }

  for (const batch of chunk(namesToFetch, SCRYFALL_BATCH_SIZE)) {
    const response = await fetchCollectionBatch(batch);

    for (const card of response.data) {
      storeGlobalCardAliases(card);
    }

    const notFound = new Set(
      (response.not_found ?? [])
        .map((missing) => missing.name)
        .filter((name): name is string => Boolean(name))
        .map(normalizeLookupKey),
    );

    for (const name of batch) {
      const cacheKey = normalizeLookupKey(name);
      const cachedCard = cardLookupCache.get(cacheKey);

      if (cachedCard) {
        cardsByRequestedName.set(cacheKey, cachedCard);
      } else if (notFound.has(cacheKey)) {
        continue;
      }
    }
  }

  return cardsByRequestedName;
}

export async function fetchScryfallCardByExactName(name: string): Promise<ScryfallCard | null> {
  const cacheKey = normalizeLookupKey(name);

  if (!cacheKey) {
    return null;
  }

  const cachedCard = cardLookupCache.get(cacheKey);
  if (cachedCard) {
    return cachedCard;
  }

  if (finalUnmatchedCache.has(cacheKey)) {
    return null;
  }

  try {
    const response = await fetchScryfallWithRetry(
      `${SCRYFALL_API_BASE}/cards/named?exact=${encodeURIComponent(name)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "mtg-deckchecker/0.1",
        },
      },
    );

    if (!response.ok) {
      finalUnmatchedCache.add(cacheKey);
      return null;
    }

    const card = toPublicCardShape((await response.json()) as ScryfallCard);
    storeGlobalCardAliases(card);
    cardLookupCache.set(cacheKey, card);
    return card;
  } catch {
    return null;
  }
}

async function fetchCollectionBatch(names: string[]): Promise<ScryfallCollectionResponse> {
  const response = await fetchScryfallWithRetry(`${SCRYFALL_API_BASE}/cards/collection`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "mtg-deckchecker/0.1",
    },
    body: JSON.stringify({
      identifiers: names.map((name) => ({ name })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Scryfall collection request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as ScryfallCollectionResponse;

  return {
    ...payload,
    data: payload.data.map(toPublicCardShape),
  };
}

async function fetchFuzzyCard(name: string): Promise<ScryfallCard> {
  const response = await fetchScryfallWithRetry(
    `${SCRYFALL_API_BASE}/cards/named?fuzzy=${encodeURIComponent(name)}`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "mtg-deckchecker/0.1",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Scryfall fuzzy request failed for "${name}" with status ${response.status}.`);
  }

  return toPublicCardShape((await response.json()) as ScryfallCard);
}

async function fetchScryfallWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < SCRYFALL_RETRY_DELAYS_MS.length; attempt += 1) {
    await waitForScryfallTurn();

    const delayMs =
      attempt > 0 && lastError instanceof Response
        ? getRetryDelayMs(lastError, attempt)
        : SCRYFALL_RETRY_DELAYS_MS[attempt];
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(SCRYFALL_TIMEOUT_MS),
      });

      if (!shouldRetryScryfallResponse(response) || attempt === SCRYFALL_RETRY_DELAYS_MS.length - 1) {
        return response;
      }

      lastError = response;
    } catch (error) {
      lastError = error;
      if (attempt === SCRYFALL_RETRY_DELAYS_MS.length - 1) {
        break;
      }
    }
  }

  const message =
    lastError instanceof Response
      ? `Scryfall request failed with status ${lastError.status}.`
      : lastError instanceof Error
        ? lastError.message
        : "Unknown network error.";
  throw new Error(`Scryfall request failed after ${SCRYFALL_RETRY_DELAYS_MS.length} attempts. ${message}`);
}

function shouldRetryScryfallResponse(response: Response) {
  return response.status === 429 || response.status >= 500;
}

function getRetryDelayMs(response: Response, attempt: number) {
  const retryAfter = response.headers?.get?.("retry-after");
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : Number.NaN;

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(10_000, retryAfterSeconds * 1_000);
  }

  return SCRYFALL_RETRY_DELAYS_MS[attempt] ?? SCRYFALL_RETRY_DELAYS_MS.at(-1) ?? 1_600;
}

async function waitForScryfallTurn() {
  const wait = scryfallRequestQueue.then(async () => {
    const now = Date.now();
    const delayMs = Math.max(0, nextScryfallRequestAt - now);

    if (delayMs > 0) {
      await sleep(delayMs);
    }

    nextScryfallRequestAt = Date.now() + SCRYFALL_MIN_REQUEST_INTERVAL_MS;
  });

  scryfallRequestQueue = wait.catch(() => {});
  await wait;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function toPublicCardShape(card: ScryfallCard): ScryfallCard {
  return {
    id: card.id,
    oracle_id: card.oracle_id,
    name: card.name,
    printed_name: card.printed_name,
    flavor_name: card.flavor_name,
    mana_cost: card.mana_cost,
    cmc: card.cmc,
    type_line: card.type_line,
    oracle_text: card.oracle_text,
    power: card.power,
    toughness: card.toughness,
    colors: card.colors,
    color_identity: card.color_identity ?? [],
    keywords: card.keywords ?? [],
    layout: card.layout,
    produced_mana: card.produced_mana,
    image_uris: card.image_uris,
    card_faces: card.card_faces?.map((face) => ({
      name: face.name,
      printed_name: face.printed_name,
      flavor_name: face.flavor_name,
      mana_cost: face.mana_cost,
      type_line: face.type_line,
      oracle_text: face.oracle_text,
      power: face.power,
      toughness: face.toughness,
      colors: face.colors,
      image_uris: face.image_uris,
    })),
    legalities: card.legalities,
    prices: card.prices,
    scryfall_uri: card.scryfall_uri,
  };
}

function storeCardAliases(cardsByRequestedName: Map<string, ScryfallCard>, card: ScryfallCard) {
  for (const alias of getCardAliases(card)) {
    cardsByRequestedName.set(alias, card);
  }

  for (const face of card.card_faces ?? []) {
    for (const alias of getFaceAliases(face)) {
      cardsByRequestedName.set(alias, card);
    }
  }
}

function storeGlobalCardAliases(card: ScryfallCard) {
  for (const alias of getAllCardAliases(card)) {
    cardLookupCache.set(alias, card);
    finalUnmatchedCache.delete(alias);
  }
}

function matchesRequestedName(requestedName: string, card: ScryfallCard): boolean {
  const normalizedRequestedName = normalizeLookupKey(requestedName);

  return getAllCardAliases(card).has(normalizedRequestedName);
}

function getAllCardAliases(card: ScryfallCard) {
  const aliases = new Set<string>(getCardAliases(card));

  for (const face of card.card_faces ?? []) {
    for (const alias of getFaceAliases(face)) {
      aliases.add(alias);
    }
  }

  return aliases;
}

function getCardAliases(card: ScryfallCard) {
  const aliases = new Set<string>();
  addAlias(aliases, card.name);
  addAlias(aliases, card.printed_name);
  addAlias(aliases, card.flavor_name);
  return aliases;
}

function getFaceAliases(face: NonNullable<ScryfallCard["card_faces"]>[number]) {
  const aliases = new Set<string>();
  addAlias(aliases, face.name);
  addAlias(aliases, face.printed_name);
  addAlias(aliases, face.flavor_name);
  return aliases;
}

function addAlias(aliases: Set<string>, value?: string) {
  if (!value?.trim()) {
    return;
  }

  aliases.add(normalizeLookupKey(value));
}
