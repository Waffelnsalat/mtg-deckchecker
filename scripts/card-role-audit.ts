import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { analyzeDeckAdvancedRoles } from "../src/advancedCardScan";
import { analyzeDeckConsistency } from "../src/consistencyAnalysis";
import { analyzeDeckDraw } from "../src/drawAnalysis";
import { analyzeDeckRemoval, analyzeDeckSpellInteraction } from "../src/interactionAnalysis";
import { analyzeDeckRamp } from "../src/rampAnalysis";
import { analyzeDeckRecursion } from "../src/recursionAnalysis";
import { analyzeDeckProtection } from "../src/protectionAnalysis";
import { DeckResolutionDocument, DeckSection, ScryfallCard } from "../src/types";

const DATA_DIR = path.resolve(process.cwd(), "data");
const SETS_PATH = path.join(DATA_DIR, "scryfall-sets.json");
const AUDIT_PATH = path.join(DATA_DIR, "card-role-audit.json");
const SCRYFALL_SETS_URL = "https://api.scryfall.com/sets";
const SCRYFALL_SEARCH_URL = "https://api.scryfall.com/cards/search";
const USER_AGENT = "mtg-deckchecker-card-role-audit/0.1";
const PREVIEW_LIMIT = 40;

type AuditStatus =
  | "covered"
  | "missing"
  | "wrong"
  | "intentional_ignore"
  | "needs_decision"
  | "unsupported";

interface AuditLedger {
  schemaVersion: number;
  cards: AuditEntry[];
}

interface AuditEntry {
  oracleId: string;
  name: string;
  firstSet?: string;
  releasedAt?: string;
  reviewedAt?: string;
  expectedRoles?: string[];
  actualRoles?: string[];
  status: AuditStatus;
  notes?: string;
  needsCodeChange?: boolean;
  tagDecisions?: Array<{
    tag: string;
    action: "use_existing" | "add_new" | "adjust_weight" | "ignore";
    layer?: "coreScore" | "strategy" | "mechanic";
    note?: string;
  }>;
}

interface StoredSetList {
  schemaVersion: number;
  retrievedAt: string;
  sourceUrl: string;
  setCount: number;
  sets: StoredSet[];
}

interface StoredSet {
  code: string;
  name: string;
  releasedAt: string | null;
  setType: string;
  cardCount: number;
  digital: boolean;
  parentSetCode?: string | null;
  scryfallUri: string;
  searchUri: string;
}

interface ScryfallSetPayload {
  data: Array<{
    code: string;
    name: string;
    released_at?: string | null;
    set_type: string;
    card_count: number;
    digital: boolean;
    parent_set_code?: string | null;
    scryfall_uri: string;
    search_uri: string;
  }>;
}

interface ScryfallSearchPayload {
  data: ScryfallApiCard[];
  has_more?: boolean;
  next_page?: string;
}

interface ScryfallApiCard {
  id: string;
  oracle_id?: string;
  name: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  color_identity?: string[];
  keywords?: string[];
  layout?: string;
  produced_mana?: string[];
  image_uris?: ScryfallCard["image_uris"];
  card_faces?: ScryfallCard["card_faces"];
  legalities?: Record<string, string>;
  prices?: Record<string, string | null>;
  scryfall_uri: string;
  released_at?: string;
  set?: string;
  collector_number?: string;
  all_parts?: Array<{ component?: string; name?: string; type_line?: string; uri?: string }>;
  oracle_tags?: string[];
}

interface AuditedCard {
  card: ScryfallApiCard;
  oracleId: string;
  currentRoles: string[];
  scryfallTags: string[];
  auditEntry: AuditEntry | null;
}

async function main() {
  const [command = "next-set", ...args] = process.argv.slice(2);

  switch (command) {
    case "refresh-sets":
      await refreshSets();
      return;
    case "summary":
      await printSummary();
      return;
    case "next-set":
      await printNextOpenSet();
      return;
    case "set":
      await printSet(args[0]);
      return;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;
    default:
      throw new Error(`Unknown audit command "${command}". Run npm run audit:cards -- help.`);
  }
}

async function refreshSets() {
  const payload = await fetchJson<ScryfallSetPayload>(SCRYFALL_SETS_URL);
  const sets = payload.data
    .map((set): StoredSet => ({
      code: set.code,
      name: set.name,
      releasedAt: set.released_at ?? null,
      setType: set.set_type,
      cardCount: set.card_count,
      digital: set.digital,
      parentSetCode: set.parent_set_code ?? null,
      scryfallUri: set.scryfall_uri,
      searchUri: set.search_uri,
    }))
    .sort(compareSetsOldestFirst);

  await mkdir(DATA_DIR, { recursive: true });
  await writeJson(SETS_PATH, {
    schemaVersion: 1,
    retrievedAt: new Date().toISOString(),
    sourceUrl: SCRYFALL_SETS_URL,
    setCount: sets.length,
    sets,
  } satisfies StoredSetList);

  console.log(`Saved ${sets.length} Scryfall sets to ${relativePath(SETS_PATH)}.`);
  console.log(`Oldest: ${formatSet(sets[0])}`);
  console.log(`Newest: ${formatSet(sets[sets.length - 1])}`);
}

async function printSummary() {
  const [sets, ledger] = await Promise.all([loadSets(), loadAuditLedger()]);
  const reviewedOracleIds = getReviewedOracleIds(ledger);
  const statusCounts = countStatuses(ledger.cards);

  console.log(`Sets tracked: ${sets.sets.length}`);
  console.log(`Reviewed oracle IDs: ${reviewedOracleIds.size}`);
  console.log("Status counts:");
  for (const status of ["covered", "missing", "wrong", "intentional_ignore", "needs_decision", "unsupported"] as const) {
    console.log(`  ${status}: ${statusCounts.get(status) ?? 0}`);
  }
  console.log("");
  console.log("Next command:");
  console.log("  npm run audit:cards -- next-set");
}

async function printNextOpenSet() {
  const [sets, ledger] = await Promise.all([loadSets(), loadAuditLedger()]);
  const reviewedOracleIds = getReviewedOracleIds(ledger);

  for (const set of sets.sets) {
    const report = await buildSetReport(set, ledger, reviewedOracleIds);
    if (report.openCards.length > 0) {
      printSetReport(report);
      return;
    }
  }

  console.log("Every tracked Scryfall set is fully reviewed in the local audit ledger.");
}

async function printSet(setCode: string | undefined) {
  if (!setCode) {
    throw new Error("Pass a set code, for example: npm run audit:cards -- set lea");
  }

  const [sets, ledger] = await Promise.all([loadSets(), loadAuditLedger()]);
  const set = sets.sets.find((entry) => entry.code.toLowerCase() === setCode.toLowerCase());
  if (!set) {
    throw new Error(`Set "${setCode}" is not in ${relativePath(SETS_PATH)}. Run refresh-sets first.`);
  }

  printSetReport(await buildSetReport(set, ledger, getReviewedOracleIds(ledger)));
}

async function buildSetReport(
  set: StoredSet,
  ledger: AuditLedger,
  reviewedOracleIds: Set<string>,
) {
  const cards = await fetchCardsForSet(set.code);
  const uniqueCards = dedupeByOracleId(cards);
  const audited = await Promise.all(uniqueCards.map((card) => auditCard(card, ledger)));
  const openCards = audited.filter((entry) => !reviewedOracleIds.has(entry.oracleId));
  const reviewedCards = audited.filter((entry) => reviewedOracleIds.has(entry.oracleId));
  const needsAttention = openCards.filter(
    (entry) =>
      (entry.scryfallTags.length > 0 || entry.card.keywords?.length) &&
      entry.currentRoles.length === 0,
  );

  return {
    set,
    totalPrints: cards.length,
    uniqueCards: audited,
    reviewedCards,
    openCards,
    needsAttention,
  };
}

function printSetReport(report: Awaited<ReturnType<typeof buildSetReport>>) {
  console.log(`${formatSet(report.set)}`);
  console.log(`Prints: ${report.totalPrints}`);
  console.log(`Unique oracle IDs in set: ${report.uniqueCards.length}`);
  console.log(`Reviewed in ledger: ${report.reviewedCards.length}`);
  console.log(`Open: ${report.openCards.length}`);
  console.log(`Open with Scryfall oracle tags or keywords but no analyzer role: ${report.needsAttention.length}`);
  console.log("");

  if (report.needsAttention.length > 0) {
    console.log("Attention candidates:");
    printCardRows(report.needsAttention.slice(0, PREVIEW_LIMIT));
    if (report.needsAttention.length > PREVIEW_LIMIT) {
      console.log(`  ... ${report.needsAttention.length - PREVIEW_LIMIT} more attention candidates`);
    }
    console.log("");
  }

  console.log("Open review queue:");
  printCardRows(report.openCards.slice(0, PREVIEW_LIMIT));
  if (report.openCards.length > PREVIEW_LIMIT) {
    console.log(`  ... ${report.openCards.length - PREVIEW_LIMIT} more open cards`);
  }
  console.log("");
  console.log("Add decisions to data/card-role-audit.json, then rerun this command.");
}

function printCardRows(cards: AuditedCard[]) {
  for (const entry of cards) {
    console.log(`- ${entry.card.name}`);
    console.log(`  oracleId: ${entry.oracleId}`);
    console.log(`  type: ${entry.card.type_line ?? "-"}`);
    console.log(`  scryfallTags: ${entry.scryfallTags.length ? entry.scryfallTags.join(", ") : "-"}`);
    console.log(`  keywords: ${entry.card.keywords?.length ? entry.card.keywords.join(", ") : "-"}`);
    console.log(`  analyzerRoles: ${entry.currentRoles.length ? entry.currentRoles.join(", ") : "-"}`);
    console.log(`  url: ${entry.card.scryfall_uri}`);
  }
}

async function auditCard(card: ScryfallApiCard, ledger: AuditLedger): Promise<AuditedCard> {
  const oracleId = card.oracle_id ?? card.id;
  const auditEntry = ledger.cards.find((entry) => entry.oracleId === oracleId) ?? null;
  const currentRoles = await detectCurrentRoles(card);

  return {
    card,
    oracleId,
    currentRoles,
    scryfallTags: getScryfallTags(card),
    auditEntry,
  };
}

async function detectCurrentRoles(card: ScryfallApiCard) {
  const document = createSingleCardDocument(card);
  const roles = new Set<string>();

  for (const entry of analyzeDeckRamp(document).taggedCards[0]?.hits ?? []) {
    roles.add(entry.tag);
  }
  for (const entry of analyzeDeckDraw(document).taggedCards[0]?.hits ?? []) {
    roles.add(entry.tag);
  }
  for (const entry of analyzeDeckConsistency(document).taggedCards[0]?.hits ?? []) {
    roles.add(entry.tag);
  }
  for (const entry of analyzeDeckRemoval(document).taggedCards[0]?.hits ?? []) {
    roles.add(entry.tag);
  }
  for (const entry of analyzeDeckSpellInteraction(document).taggedCards[0]?.hits ?? []) {
    roles.add(entry.tag);
  }
  for (const entry of analyzeDeckProtection(document).taggedCards[0]?.hits ?? []) {
    roles.add(entry.tag);
  }
  for (const entry of analyzeDeckRecursion(document).taggedCards[0]?.hits ?? []) {
    roles.add(entry.tag);
  }
  for (const entry of analyzeDeckAdvancedRoles(document).taggedCards[0]?.hits ?? []) {
    roles.add(entry.tag);
  }

  return [...roles].sort();
}

function createSingleCardDocument(card: ScryfallApiCard): DeckResolutionDocument {
  return {
    format: "edh",
    parse: {
      entries: [],
      errors: [],
      warnings: [],
      totalCards: 1,
      uniqueCards: 1,
    },
    result: {
      resolvedCards: [
        {
          quantity: 1,
          section: "mainboard" as DeckSection,
          requestedName: card.name,
          originalLine: `1 ${card.name}`,
          lineNumber: 1,
          card: toScryfallCard(card),
        },
      ],
      unresolvedCards: [],
      resolvedCount: 1,
      unresolvedCount: 0,
    },
  };
}

function toScryfallCard(card: ScryfallApiCard): ScryfallCard {
  return {
    id: card.id,
    oracle_id: card.oracle_id,
    name: card.name,
    mana_cost: card.mana_cost ?? "",
    cmc: card.cmc ?? 0,
    type_line: card.type_line ?? "",
    oracle_text: card.oracle_text ?? "",
    colors: card.colors ?? [],
    color_identity: card.color_identity ?? [],
    keywords: card.keywords ?? [],
    layout: card.layout ?? "normal",
    produced_mana: card.produced_mana,
    image_uris: card.image_uris,
    card_faces: card.card_faces,
    legalities: card.legalities,
    prices: card.prices,
    scryfall_uri: card.scryfall_uri,
  };
}

function getScryfallTags(card: ScryfallApiCard) {
  return [...new Set(card.oracle_tags ?? [])].sort();
}

async function fetchCardsForSet(setCode: string) {
  const cards: ScryfallApiCard[] = [];
  let url = `${SCRYFALL_SEARCH_URL}?q=${encodeURIComponent(`e:${setCode}`)}&unique=prints&order=set`;

  while (url) {
    const payload = await fetchJson<ScryfallSearchPayload>(url);
    cards.push(...payload.data);
    url = payload.has_more && payload.next_page ? payload.next_page : "";
  }

  return cards;
}

function dedupeByOracleId(cards: ScryfallApiCard[]) {
  const seen = new Set<string>();
  const uniqueCards: ScryfallApiCard[] = [];

  for (const card of cards) {
    const oracleId = card.oracle_id ?? card.id;
    if (seen.has(oracleId)) {
      continue;
    }

    seen.add(oracleId);
    uniqueCards.push(card);
  }

  return uniqueCards;
}

async function loadSets() {
  try {
    return JSON.parse(await readFile(SETS_PATH, "utf8")) as StoredSetList;
  } catch {
    throw new Error(`Missing ${relativePath(SETS_PATH)}. Run npm run audit:cards -- refresh-sets first.`);
  }
}

async function loadAuditLedger() {
  return JSON.parse(await readFile(AUDIT_PATH, "utf8")) as AuditLedger;
}

function getReviewedOracleIds(ledger: AuditLedger) {
  return new Set(ledger.cards.map((entry) => entry.oracleId));
}

function countStatuses(entries: AuditEntry[]) {
  const counts = new Map<AuditStatus, number>();
  for (const entry of entries) {
    counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1);
  }
  return counts;
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Scryfall request failed ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

async function writeJson(filePath: string, value: unknown) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compareSetsOldestFirst(left: StoredSet, right: StoredSet) {
  const leftDate = left.releasedAt ?? "9999-99-99";
  const rightDate = right.releasedAt ?? "9999-99-99";
  return leftDate.localeCompare(rightDate) || left.code.localeCompare(right.code);
}

function formatSet(set: StoredSet | undefined) {
  if (!set) {
    return "-";
  }

  return `${set.releasedAt ?? "unknown"} ${set.code} - ${set.name} (${set.setType}, ${set.cardCount} cards${set.digital ? ", digital" : ""})`;
}

function relativePath(filePath: string) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function printHelp() {
  console.log("Card role audit commands:");
  console.log("  npm run audit:cards -- refresh-sets  Fetch and store every Scryfall set.");
  console.log("  npm run audit:cards -- summary       Show ledger progress.");
  console.log("  npm run audit:cards -- next-set      Show the oldest set with open oracle IDs.");
  console.log("  npm run audit:cards -- set <code>    Show audit status for one set.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
