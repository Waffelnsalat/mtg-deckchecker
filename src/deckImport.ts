export type SupportedDeckImportSource = "archidekt" | "moxfield";

export interface ImportedDecklistCard {
  name: string;
  quantity: number;
  section: "commander" | "mainboard" | "companion" | "sideboard" | "maybeboard";
}

export interface ImportedDecklistResult {
  source: SupportedDeckImportSource;
  sourceLabel: string;
  title: string;
  canonicalUrl: string;
  decklist: string;
  cards: ImportedDecklistCard[];
}

export class DeckImportError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "DeckImportError";
    this.statusCode = statusCode;
  }
}

const DECK_IMPORT_TIMEOUT_MS = 20_000;
const MOXFIELD_BROWSER_TIMEOUT_MS = 45_000;
const MOXFIELD_BROWSER_RESPONSE_TIMEOUT_MS = 12_000;
const ALLOW_HEADED_BROWSER_FALLBACK =
  process.env.MTG_DECKCHECKER_ALLOW_HEADED_BROWSER === "1";

interface ParsedDeckImportUrl {
  source: SupportedDeckImportSource;
  canonicalUrl: string;
  deckId: string;
}

interface ArchidektDeckCard {
  categories?: string[];
  companion?: boolean;
  quantity?: number;
  card?: {
    displayName?: string | null;
    oracleCard?: {
      name?: string | null;
    } | null;
  } | null;
}

interface ArchidektDeckResponse {
  id: number;
  name?: string;
  cards?: ArchidektDeckCard[];
}

interface MoxfieldBoardCard {
  quantity?: number;
  card?: {
    name?: string | null;
  } | null;
}

interface MoxfieldDeckBoard {
  cards?: Record<string, MoxfieldBoardCard>;
}

interface MoxfieldDeckResponse {
  id: string;
  name?: string;
  boards?: Record<string, MoxfieldDeckBoard>;
}

export async function importDecklistFromUrl(input: string): Promise<ImportedDecklistResult> {
  const parsedUrl = parseDeckImportUrl(input);

  switch (parsedUrl.source) {
    case "archidekt":
      return importArchidektDeck(parsedUrl);
    case "moxfield":
      return importMoxfieldDeck(parsedUrl);
    default:
      throw new DeckImportError("Only public Archidekt and Moxfield deck URLs are supported.");
  }
}

export function parseDeckImportUrl(input: string): ParsedDeckImportUrl {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(input.trim());
  } catch {
    throw new DeckImportError("Enter a valid deck URL first.");
  }

  const hostname = parsedUrl.hostname.replace(/^www\./i, "").toLowerCase();
  const normalizedPath = parsedUrl.pathname.replace(/\/+$/, "");

  if (hostname === "archidekt.com") {
    const match = normalizedPath.match(/^\/decks\/(\d+)(?:\/|$)/i);
    if (!match) {
      throw new DeckImportError("Archidekt URLs must look like https://archidekt.com/decks/<id>/...");
    }

    return {
      source: "archidekt",
      deckId: match[1],
      canonicalUrl: `https://archidekt.com/decks/${match[1]}`,
    };
  }

  if (hostname === "moxfield.com") {
    const match = normalizedPath.match(/^\/decks\/([^/?#]+)(?:\/|$)/i);
    if (!match) {
      throw new DeckImportError("Moxfield URLs must look like https://moxfield.com/decks/<id>.");
    }

    return {
      source: "moxfield",
      deckId: match[1],
      canonicalUrl: `https://moxfield.com/decks/${match[1]}`,
    };
  }

  throw new DeckImportError("Only public Archidekt and Moxfield deck URLs are supported.");
}

export function serializeImportedDecklist(cards: ImportedDecklistCard[]): string {
  const lines: string[] = [];

  appendDeckSection(lines, "COMMANDER", cards.filter((card) => card.section === "commander"));
  appendDeckSection(lines, "COMPANION", cards.filter((card) => card.section === "companion"));
  appendDeckSection(lines, "DECK", cards.filter((card) => card.section === "mainboard"));

  return lines.join("\n").trim();
}

async function importArchidektDeck(parsedUrl: ParsedDeckImportUrl): Promise<ImportedDecklistResult> {
  const response = await fetch(`https://archidekt.com/api/decks/${parsedUrl.deckId}/`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "mtg-deckchecker/0.1",
    },
    signal: AbortSignal.timeout(DECK_IMPORT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const message =
      response.status === 404
        ? "Archidekt deck not found or not public."
        : `Archidekt import failed with status ${response.status}.`;
    throw new DeckImportError(message, response.status === 404 ? 404 : 502);
  }

  const payload = (await response.json()) as ArchidektDeckResponse;
  const cards = convertArchidektCards(payload.cards ?? []);

  if (cards.length === 0) {
    throw new DeckImportError("Archidekt deck did not contain any importable cards.", 400);
  }

  return {
    source: "archidekt",
    sourceLabel: "Archidekt",
    title: payload.name?.trim() || `Archidekt Deck ${parsedUrl.deckId}`,
    canonicalUrl: parsedUrl.canonicalUrl,
    decklist: serializeImportedDecklist(cards),
    cards,
  };
}

async function importMoxfieldDeck(parsedUrl: ParsedDeckImportUrl): Promise<ImportedDecklistResult> {
  const payload = await fetchMoxfieldDeck(parsedUrl);
  const cards = convertMoxfieldBoards(payload.boards ?? {});

  if (cards.length === 0) {
    throw new DeckImportError("Moxfield deck did not contain any importable cards.", 400);
  }

  return {
    source: "moxfield",
    sourceLabel: "Moxfield",
    title: payload.name?.trim() || `Moxfield Deck ${parsedUrl.deckId}`,
    canonicalUrl: parsedUrl.canonicalUrl,
    decklist: serializeImportedDecklist(cards),
    cards,
  };
}

function convertArchidektCards(cards: ArchidektDeckCard[]): ImportedDecklistCard[] {
  return cards
    .map((deckCard) => {
      const name = getArchidektCardName(deckCard);
      const quantity = normalizeImportedQuantity(deckCard.quantity);
      const section = getArchidektCardSection(deckCard);

      if (!name || quantity <= 0 || isIgnoredImportSection(section)) {
        return null;
      }

      return {
        name,
        quantity,
        section,
      } as ImportedDecklistCard;
    })
    .filter(isImportedDecklistCard);
}

function getArchidektCardName(deckCard: ArchidektDeckCard): string {
  return (
    deckCard.card?.oracleCard?.name?.trim() ||
    deckCard.card?.displayName?.trim() ||
    ""
  );
}

function getArchidektCardSection(
  deckCard: ArchidektDeckCard,
): ImportedDecklistCard["section"] {
  const categories = new Set((deckCard.categories ?? []).map((category) => category.trim()));

  if (deckCard.companion) {
    return "companion";
  }

  if (categories.has("Commander")) {
    return "commander";
  }

  if (categories.has("Maybeboard")) {
    return "maybeboard";
  }

  if (categories.has("Sideboard")) {
    return "sideboard";
  }

  return "mainboard";
}

async function fetchMoxfieldDeck(parsedUrl: ParsedDeckImportUrl): Promise<MoxfieldDeckResponse> {
  const apiUrl = `https://api2.moxfield.com/v3/decks/all/${parsedUrl.deckId}`;

  try {
    const directResponse = await fetch(apiUrl, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(DECK_IMPORT_TIMEOUT_MS),
    });

    if (directResponse.ok) {
      return (await directResponse.json()) as MoxfieldDeckResponse;
    }

    if (directResponse.status === 404) {
      throw new DeckImportError("Moxfield deck not found or not public.", 404);
    }
  } catch (error) {
    if (error instanceof DeckImportError) {
      throw error;
    }

    // Browser fallback below handles locked-down environments.
  }

  return fetchMoxfieldDeckWithBrowser(parsedUrl);
}

async function fetchMoxfieldDeckWithBrowser(
  parsedUrl: ParsedDeckImportUrl,
): Promise<MoxfieldDeckResponse> {
  let playwright: typeof import("playwright-core");

  try {
    playwright = await import("playwright-core");
  } catch {
    throw new DeckImportError(
      "Moxfield blocked the direct server import, and the browser fallback is unavailable.",
      502,
    );
  }

  const apiUrl = `https://api2.moxfield.com/v3/decks/all/${parsedUrl.deckId}`;
  let lastError: unknown = null;

  const headlessModes = ALLOW_HEADED_BROWSER_FALLBACK ? [true, false] : [true];

  for (const headless of headlessModes) {
    const browser = await launchSystemChromium(playwright, headless);

    try {
      const page = await browser.newPage();
      const responsePromise = page.waitForResponse(
        (response) => isMoxfieldDeckApiUrl(response.url(), apiUrl),
        { timeout: MOXFIELD_BROWSER_RESPONSE_TIMEOUT_MS },
      ).then((response) => readMoxfieldBrowserResponse(response));

      await page.goto(parsedUrl.canonicalUrl, {
        waitUntil: "domcontentloaded",
        timeout: MOXFIELD_BROWSER_TIMEOUT_MS,
      });

      return await firstSuccessfulMoxfieldBrowserResult(
        fetchMoxfieldDeckFromPage(page, apiUrl),
        responsePromise,
      );
    } catch (error) {
      if (error instanceof DeckImportError) {
        throw error;
      }

      lastError = error;
    } finally {
      await browser.close();
    }
  }

  throw new DeckImportError(
    lastError instanceof Error
      ? `Moxfield import could not be completed in this environment. ${lastError.message}`
      : "Moxfield import could not be completed in this environment.",
    502,
  );
}

function isMoxfieldDeckApiUrl(responseUrl: string, apiUrl: string) {
  try {
    const response = new URL(responseUrl);
    const expected = new URL(apiUrl);

    return response.origin === expected.origin && response.pathname === expected.pathname;
  } catch {
    return responseUrl.startsWith(apiUrl);
  }
}

function createMoxfieldStatusError(status: number) {
  if (status === 404) {
    return new DeckImportError("Moxfield deck not found or not public.", 404);
  }

  if (status === 403) {
    return new DeckImportError(
      "Moxfield blocked automated import in this environment. Export the deck as text from Moxfield and paste it into the decklist box.",
      502,
    );
  }

  return new DeckImportError(`Moxfield import failed with status ${status}.`, 502);
}

async function firstSuccessfulMoxfieldBrowserResult(
  ...lookups: Array<Promise<MoxfieldDeckResponse>>
) {
  try {
    return await Promise.any(lookups);
  } catch (error) {
    const errors = error instanceof AggregateError ? error.errors : [error];
    const notFound = errors.find(
      (entry): entry is DeckImportError =>
        entry instanceof DeckImportError && entry.statusCode === 404,
    );

    if (notFound) {
      throw notFound;
    }

    const firstError = errors.find((entry): entry is Error => entry instanceof Error);
    throw new Error(firstError?.message ?? "Moxfield browser lookup failed.");
  }
}

async function readMoxfieldBrowserResponse(response: import("playwright-core").Response) {
  if (!response.ok()) {
    throw createMoxfieldStatusError(response.status());
  }

  return (await response.json()) as MoxfieldDeckResponse;
}

async function fetchMoxfieldDeckFromPage(
  page: import("playwright-core").Page,
  apiUrl: string,
) {
  const response = await page.context().request.get(apiUrl, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: "https://moxfield.com/",
    },
    timeout: MOXFIELD_BROWSER_RESPONSE_TIMEOUT_MS,
  });

  if (!response.ok()) {
    throw createMoxfieldStatusError(response.status());
  }

  return (await response.json()) as MoxfieldDeckResponse;
}

async function launchSystemChromium(
  playwright: typeof import("playwright-core"),
  headless: boolean,
) {
  const channelCandidates =
    process.platform === "win32"
      ? ["msedge", "chrome"]
      : ["chrome", "msedge"];
  let lastError: unknown = null;

  for (const channel of channelCandidates) {
    try {
      return await playwright.chromium.launch({
        channel,
        headless,
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw new DeckImportError(
    lastError instanceof Error
      ? `Moxfield import needs a local Chromium browser. ${lastError.message}`
      : "Moxfield import needs a local Chromium browser.",
    502,
  );
}

function convertMoxfieldBoards(
  boards: Record<string, MoxfieldDeckBoard>,
): ImportedDecklistCard[] {
  return [
    ...extractMoxfieldBoardCards(boards.commanders, "commander"),
    ...extractMoxfieldBoardCards(boards.companions, "companion"),
    ...extractMoxfieldBoardCards(boards.mainboard, "mainboard"),
  ];
}

function isIgnoredImportSection(section: ImportedDecklistCard["section"]) {
  return section === "sideboard" || section === "maybeboard";
}

function isImportedDecklistCard(
  card: ImportedDecklistCard | null,
): card is ImportedDecklistCard {
  return card !== null;
}

function extractMoxfieldBoardCards(
  board: MoxfieldDeckBoard | undefined,
  section: ImportedDecklistCard["section"],
): ImportedDecklistCard[] {
  return Object.values(board?.cards ?? {})
    .map((deckCard) => {
      const name = deckCard.card?.name?.trim() ?? "";
      const quantity = normalizeImportedQuantity(deckCard.quantity);

      if (!name || quantity <= 0) {
        return null;
      }

      return {
        name,
        quantity,
        section,
      } satisfies ImportedDecklistCard;
    })
    .filter((card): card is ImportedDecklistCard => Boolean(card));
}

function normalizeImportedQuantity(quantity: number | undefined): number {
  const safeQuantity = Number(quantity ?? 0);
  return Number.isFinite(safeQuantity) ? Math.max(0, Math.floor(safeQuantity)) : 0;
}

function appendDeckSection(
  lines: string[],
  label: string,
  cards: ImportedDecklistCard[],
) {
  if (cards.length === 0) {
    return;
  }

  if (lines.length > 0) {
    lines.push("");
  }

  lines.push(`[${label}]`);

  cards.forEach((card) => {
    lines.push(`${card.quantity} ${card.name}`);
  });
}
