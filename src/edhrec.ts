import { DeckBracketNumber, DeckResolutionDocument } from "./types";

const EDHREC_COMMANDER_BASE_URL = "https://edhrec.com/commanders";
const EDHREC_SOURCE = "EDHREC";
const EDHREC_TIMEOUT_MS = 7_000;
const EDHREC_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const BRACKET_SEGMENTS: Partial<
  Record<DeckBracketNumber, { path: string; label: string }>
> = {
  2: { path: "core", label: "Core" },
  3: { path: "upgraded", label: "Upgraded" },
  4: { path: "optimized", label: "Optimized" },
  5: { path: "cedh", label: "cEDH" },
};

interface EdhrecCommanderPagePayload {
  props?: {
    pageProps?: {
      data?: {
        num_decks_avg?: number;
        container?: {
          json_dict?: {
            cardlists?: EdhrecCardListPayload[];
          };
        };
      };
    };
  };
}

interface EdhrecCardListPayload {
  header?: string;
  tag?: string;
  cardviews?: EdhrecCardViewPayload[];
}

interface EdhrecCardViewPayload {
  name?: string;
  url?: string;
  synergy?: number;
  inclusion?: number;
  num_decks?: number;
  potential_decks?: number;
}

export interface EdhrecCommanderCard {
  name: string;
  normalizedName: string;
  url: string;
  synergy: number | null;
  inclusion: number;
  numDecks: number;
  potentialDecks: number;
  listTags: string[];
  listHeaders: string[];
}

export interface EdhrecCommanderCardList {
  header: string;
  tag: string;
  cards: EdhrecCommanderCard[];
}

export interface EdhrecCommanderInsights {
  source: typeof EDHREC_SOURCE;
  url: string;
  pageLabel: string;
  commanderNames: string[];
  deckCount: number;
  lists: EdhrecCommanderCardList[];
  cardsByName: Map<string, EdhrecCommanderCard>;
}

const cache = new Map<
  string,
  { expiresAt: number; value: EdhrecCommanderInsights | null }
>();

export async function lookupCommanderEdhrecInsights(
  document: DeckResolutionDocument,
  targetBracket?: DeckBracketNumber,
): Promise<EdhrecCommanderInsights | null> {
  const commanderNames = getCommanderNames(document);

  if (commanderNames.length === 0) {
    return null;
  }

  const slug = buildCommanderSlug(commanderNames);
  const bracketSegment = targetBracket ? BRACKET_SEGMENTS[targetBracket] : undefined;
  const urls = [
    bracketSegment
      ? {
          url: `${EDHREC_COMMANDER_BASE_URL}/${slug}/${bracketSegment.path}`,
          pageLabel: bracketSegment.label,
        }
      : null,
    {
      url: `${EDHREC_COMMANDER_BASE_URL}/${slug}`,
      pageLabel: "All",
    },
  ].filter((entry): entry is { url: string; pageLabel: string } => entry !== null);

  for (const entry of urls) {
    const result = await fetchCommanderInsights(entry.url, commanderNames, entry.pageLabel);
    if (result) {
      return result;
    }
  }

  return null;
}

async function fetchCommanderInsights(
  url: string,
  commanderNames: string[],
  pageLabel: string,
): Promise<EdhrecCommanderInsights | null> {
  const cached = cache.get(url);
  const now = Date.now();

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "mtg-deckchecker/0.1",
      },
      signal: AbortSignal.timeout(EDHREC_TIMEOUT_MS),
    });

    if (!response.ok) {
      cache.set(url, {
        expiresAt: now + 60_000,
        value: null,
      });
      return null;
    }

    const html = await response.text();
    const parsed = parseCommanderInsightsHtml(html, {
      url,
      pageLabel,
      commanderNames,
    });

    cache.set(url, {
      expiresAt: now + EDHREC_CACHE_TTL_MS,
      value: parsed,
    });
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown EDHREC lookup error.";
    console.warn(`[edhrec] Commander lookup failed for ${url}: ${message}`);
    cache.set(url, {
      expiresAt: now + 60_000,
      value: null,
    });
    return null;
  }
}

function parseCommanderInsightsHtml(
  html: string,
  input: {
    url: string;
    pageLabel: string;
    commanderNames: string[];
  },
): EdhrecCommanderInsights | null {
  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );

  if (!nextDataMatch) {
    return null;
  }

  const payload = JSON.parse(nextDataMatch[1]) as EdhrecCommanderPagePayload;
  const data = payload.props?.pageProps?.data;
  const cardlists = data?.container?.json_dict?.cardlists ?? [];

  if (cardlists.length === 0) {
    return null;
  }

  const cardsByName = new Map<string, EdhrecCommanderCard>();
  const lists = cardlists
    .map((list) => normalizeCardList(list, cardsByName))
    .filter((list): list is EdhrecCommanderCardList => list !== null);

  if (lists.length === 0) {
    return null;
  }

  return {
    source: EDHREC_SOURCE,
    url: input.url,
    pageLabel: input.pageLabel,
    commanderNames: input.commanderNames,
    deckCount: toNumber(data?.num_decks_avg),
    lists,
    cardsByName,
  };
}

function normalizeCardList(
  list: EdhrecCardListPayload,
  cardsByName: Map<string, EdhrecCommanderCard>,
): EdhrecCommanderCardList | null {
  const header = list.header?.trim() ?? "";
  const tag = list.tag?.trim() ?? "";

  if (!header || !tag) {
    return null;
  }

  const cards = (list.cardviews ?? [])
    .map((card) => normalizeCardView(card, header, tag, cardsByName))
    .filter((card): card is EdhrecCommanderCard => card !== null);

  return {
    header,
    tag,
    cards,
  };
}

function normalizeCardView(
  card: EdhrecCardViewPayload,
  header: string,
  tag: string,
  cardsByName: Map<string, EdhrecCommanderCard>,
): EdhrecCommanderCard | null {
  const name = card.name?.trim();
  const url = card.url?.trim();

  if (!name || !url) {
    return null;
  }

  const normalizedName = normalizeText(name);
  const existing = cardsByName.get(normalizedName);
  const synergy = Number.isFinite(card.synergy) ? Number(card.synergy) : null;

  if (existing) {
    if (synergy !== null && (existing.synergy === null || synergy > existing.synergy)) {
      existing.synergy = synergy;
    }

    existing.inclusion = Math.max(existing.inclusion, toNumber(card.inclusion));
    existing.numDecks = Math.max(existing.numDecks, toNumber(card.num_decks));
    existing.potentialDecks = Math.max(existing.potentialDecks, toNumber(card.potential_decks));

    if (!existing.listTags.includes(tag)) {
      existing.listTags.push(tag);
    }

    if (!existing.listHeaders.includes(header)) {
      existing.listHeaders.push(header);
    }

    return existing;
  }

  const normalized: EdhrecCommanderCard = {
    name,
    normalizedName,
    url: url.startsWith("http") ? url : `https://edhrec.com${url}`,
    synergy,
    inclusion: toNumber(card.inclusion),
    numDecks: toNumber(card.num_decks),
    potentialDecks: toNumber(card.potential_decks),
    listTags: [tag],
    listHeaders: [header],
  };

  cardsByName.set(normalizedName, normalized);
  return normalized;
}

function getCommanderNames(document: DeckResolutionDocument) {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const card of document.result.resolvedCards) {
    if (card.section !== "commander") {
      continue;
    }

    const normalizedName = normalizeText(card.card.name);
    if (seen.has(normalizedName)) {
      continue;
    }

    seen.add(normalizedName);
    names.push(card.card.name);
  }

  return names;
}

function buildCommanderSlug(names: string[]) {
  return names.map(slugify).join("-");
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .trim()
    .toLowerCase();
}

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
