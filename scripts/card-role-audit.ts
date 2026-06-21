import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
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
const WORKSHEETS_DIR = path.join(DATA_DIR, "card-role-worksheets");
const SET_PROGRESS_JSON_PATH = path.join(DATA_DIR, "card-role-set-progress.json");
const SET_PROGRESS_TSV_PATH = path.join(DATA_DIR, "card-role-set-progress.tsv");
const SCRYFALL_SETS_URL = "https://api.scryfall.com/sets";
const SCRYFALL_SEARCH_URL = "https://api.scryfall.com/cards/search";
const USER_AGENT = "mtg-deckchecker-card-role-audit/0.1";
const PREVIEW_LIMIT = 40;
const AUDIT_STATUSES = [
  "covered",
  "missing",
  "wrong",
  "intentional_ignore",
  "needs_decision",
  "unsupported",
] as const;
const TAG_ACTIONS = ["use_existing", "add_new", "adjust_weight", "ignore"] as const;
const TAG_LAYERS = ["coreScore", "strategy", "mechanic"] as const;

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

type SetAuditStatus = "done" | "in_progress" | "pending";

interface SetProgressEntry {
  code: string;
  name: string;
  releasedAt: string | null;
  setType: string;
  cardCount: number;
  digital: boolean;
  auditStatus: SetAuditStatus;
  reviewedOracleIds: number;
  totalUniqueOracleIds: number | null;
  openOracleIds: number | null;
  progressKnown: boolean;
  worksheetPath?: string;
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
    case "worksheet":
      await writeWorksheet(args[0]);
      return;
    case "import-worksheet":
      await importWorksheet(args[0]);
      return;
    case "progress":
      await writeSetProgress();
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

async function writeWorksheet(setCode: string | undefined) {
  if (!setCode) {
    throw new Error("Pass a set code, for example: npm run audit:cards -- worksheet lea");
  }

  const [sets, ledger] = await Promise.all([loadSets(), loadAuditLedger()]);
  const set = sets.sets.find((entry) => entry.code.toLowerCase() === setCode.toLowerCase());
  if (!set) {
    throw new Error(`Set "${setCode}" is not in ${relativePath(SETS_PATH)}. Run refresh-sets first.`);
  }

  const report = await buildSetReport(set, ledger, getReviewedOracleIds(ledger));
  await mkdir(WORKSHEETS_DIR, { recursive: true });
  const outputPath = path.join(WORKSHEETS_DIR, `${set.code}-role-review.tsv`);
  await writeFile(outputPath, buildWorksheetTsv(report), "utf8");

  console.log(`Wrote ${report.uniqueCards.length} unique cards to ${relativePath(outputPath)}.`);
  console.log(`Open cards: ${report.openCards.length}`);
  console.log(`Attention candidates: ${report.needsAttention.length}`);
}

async function importWorksheet(setCode: string | undefined) {
  if (!setCode) {
    throw new Error("Pass a set code, for example: npm run audit:cards -- import-worksheet lea");
  }

  const [sets, ledger] = await Promise.all([loadSets(), loadAuditLedger()]);
  const set = sets.sets.find((entry) => entry.code.toLowerCase() === setCode.toLowerCase());
  if (!set) {
    throw new Error(`Set "${setCode}" is not in ${relativePath(SETS_PATH)}. Run refresh-sets first.`);
  }

  const worksheetPath = path.join(WORKSHEETS_DIR, `${set.code}-role-review.tsv`);
  const rows = parseWorksheetTsv(await readFile(worksheetPath, "utf8"));
  const importedAt = new Date().toISOString();
  const existingByOracleId = new Map(ledger.cards.map((entry) => [entry.oracleId, entry]));
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const status = parseAuditStatus(row.auditStatus);
    if (!status) {
      skipped += 1;
      continue;
    }

    const oracleId = requireWorksheetValue(row, "oracleId");
    const entry: AuditEntry = {
      ...existingByOracleId.get(oracleId),
      oracleId,
      name: requireWorksheetValue(row, "name"),
      firstSet: row.setCode || set.code,
      releasedAt: row.releasedAt || set.releasedAt || undefined,
      reviewedAt: importedAt,
      expectedRoles: parseList(row.expectedRoles),
      actualRoles: parseList(row.actualAnalyzerRoles),
      status,
      needsCodeChange: parseNeedsCodeChange(row.needsCodeChange, status),
      notes: row.manualNotes || undefined,
      tagDecisions: parseTagDecisionList(row.tagDecision),
    };

    existingByOracleId.set(oracleId, removeEmptyAuditFields(entry));
    imported += 1;
  }

  ledger.cards = [...existingByOracleId.values()].sort(compareAuditEntries);
  await writeJson(AUDIT_PATH, ledger);

  console.log(`Imported ${imported} reviewed cards from ${relativePath(worksheetPath)}.`);
  console.log(`Skipped ${skipped} rows without auditStatus.`);
  console.log(`Updated ${relativePath(AUDIT_PATH)}.`);
}

async function writeSetProgress() {
  const [sets, ledger, worksheetProgress] = await Promise.all([
    loadSets(),
    loadAuditLedger(),
    loadWorksheetProgress(),
  ]);
  const ledgerCounts = countLedgerEntriesByFirstSet(ledger);
  const entries = sets.sets.map((set): SetProgressEntry => {
    const worksheet = worksheetProgress.get(set.code);
    if (worksheet) {
      return {
        code: set.code,
        name: set.name,
        releasedAt: set.releasedAt,
        setType: set.setType,
        cardCount: set.cardCount,
        digital: set.digital,
        auditStatus:
          worksheet.openOracleIds === 0
            ? "done"
            : worksheet.reviewedOracleIds > 0
              ? "in_progress"
              : "pending",
        reviewedOracleIds: worksheet.reviewedOracleIds,
        totalUniqueOracleIds: worksheet.totalUniqueOracleIds,
        openOracleIds: worksheet.openOracleIds,
        progressKnown: true,
        worksheetPath: worksheet.worksheetPath,
      };
    }

    const reviewedOracleIds = ledgerCounts.get(set.code) ?? 0;
    return {
      code: set.code,
      name: set.name,
      releasedAt: set.releasedAt,
      setType: set.setType,
      cardCount: set.cardCount,
      digital: set.digital,
      auditStatus: reviewedOracleIds > 0 ? "in_progress" : "pending",
      reviewedOracleIds,
      totalUniqueOracleIds: null,
      openOracleIds: null,
      progressKnown: false,
    };
  });
  const summary = countSetProgress(entries);

  await writeJson(SET_PROGRESS_JSON_PATH, {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceSets: relativePath(SETS_PATH),
    sourceLedger: relativePath(AUDIT_PATH),
    note: "Set progress is exact when a worksheet exists. Sets without worksheets are marked from ledger firstSet counts only.",
    summary,
    sets: entries,
  });
  await writeFile(SET_PROGRESS_TSV_PATH, buildSetProgressTsv(entries), "utf8");

  console.log(`Wrote ${entries.length} set progress rows.`);
  console.log(`Done: ${summary.done}`);
  console.log(`In progress: ${summary.inProgress}`);
  console.log(`Pending: ${summary.pending}`);
  console.log(`JSON: ${relativePath(SET_PROGRESS_JSON_PATH)}`);
  console.log(`TSV: ${relativePath(SET_PROGRESS_TSV_PATH)}`);
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

function buildWorksheetTsv(report: Awaited<ReturnType<typeof buildSetReport>>) {
  const headers = [
    "setCode",
    "setName",
    "releasedAt",
    "collectorNumber",
    "name",
    "oracleId",
    "auditStatus",
    "expectedRoles",
    "actualAnalyzerRoles",
    "needsCodeChange",
    "tagDecision",
    "manualNotes",
    "typeLine",
    "manaCost",
    "manaValue",
    "colors",
    "colorIdentity",
    "keywords",
    "scryfallOracleTags",
    "attentionHint",
    "scryfallUrl",
    "oracleText",
  ];
  const rows = report.uniqueCards.map((entry) => {
    const audit = entry.auditEntry;
    return [
      report.set.code,
      report.set.name,
      report.set.releasedAt ?? "",
      entry.card.collector_number ?? "",
      entry.card.name,
      entry.oracleId,
      audit?.status ?? "",
      audit?.expectedRoles?.join(", ") ?? "",
      entry.currentRoles.join(", "),
      audit?.needsCodeChange === undefined ? "" : String(audit.needsCodeChange),
      formatTagDecisions(audit),
      audit?.notes ?? "",
      entry.card.type_line ?? "",
      entry.card.mana_cost ?? "",
      entry.card.cmc ?? "",
      entry.card.colors?.join("") ?? "",
      entry.card.color_identity?.join("") ?? "",
      entry.card.keywords?.join(", ") ?? "",
      entry.scryfallTags.join(", "),
      getAttentionHint(entry),
      entry.card.scryfall_uri,
      getOracleText(entry.card),
    ].map(formatTsvCell).join("\t");
  });

  return `${headers.join("\t")}\n${rows.join("\n")}\n`;
}

function formatTagDecisions(audit: AuditEntry | null) {
  return audit?.tagDecisions
    ?.map((decision) =>
      [
        decision.tag,
        decision.action,
        decision.layer,
        decision.note,
      ].filter(Boolean).join(":"),
    )
    .join(" | ") ?? "";
}

function getAttentionHint(entry: AuditedCard) {
  if (entry.auditEntry) {
    return "already reviewed";
  }

  if ((entry.scryfallTags.length > 0 || entry.card.keywords?.length) && entry.currentRoles.length === 0) {
    return "has Scryfall tags/keywords but no analyzer role";
  }

  if (entry.currentRoles.length > 0) {
    return "verify analyzer roles";
  }

  return "manual review";
}

function getOracleText(card: ScryfallApiCard) {
  if (card.card_faces?.length) {
    return card.card_faces
      .map((face) => `${face.name}: ${face.oracle_text ?? ""}`)
      .join(" // ");
  }

  return card.oracle_text ?? "";
}

function formatTsvCell(value: unknown) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\t/g, " ")
    .trim();
}

function parseWorksheetTsv(input: string) {
  const lines = input.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = lines.shift()?.split("\t") ?? [];
  if (headers.length === 0) {
    throw new Error("Worksheet is empty or missing a TSV header row.");
  }

  return lines.map((line, index) => {
    const cells = line.split("\t");
    const row: Record<string, string> = {};
    headers.forEach((header, cellIndex) => {
      row[header] = cells[cellIndex]?.trim() ?? "";
    });
    row.__line = String(index + 2);
    return row;
  });
}

async function loadWorksheetProgress() {
  const progress = new Map<string, {
    reviewedOracleIds: number;
    totalUniqueOracleIds: number;
    openOracleIds: number;
    worksheetPath: string;
  }>();
  let files: string[] = [];

  try {
    files = await readdir(WORKSHEETS_DIR);
  } catch {
    return progress;
  }

  for (const fileName of files) {
    const match = /^(.+)-role-review\.tsv$/.exec(fileName);
    if (!match) {
      continue;
    }

    const worksheetPath = path.join(WORKSHEETS_DIR, fileName);
    const rows = parseWorksheetTsv(await readFile(worksheetPath, "utf8"));
    const reviewedOracleIds = rows.filter((row) => Boolean(parseAuditStatus(row.auditStatus))).length;
    const totalUniqueOracleIds = rows.length;
    progress.set(match[1], {
      reviewedOracleIds,
      totalUniqueOracleIds,
      openOracleIds: totalUniqueOracleIds - reviewedOracleIds,
      worksheetPath: relativePath(worksheetPath),
    });
  }

  return progress;
}

function countLedgerEntriesByFirstSet(ledger: AuditLedger) {
  const counts = new Map<string, number>();
  for (const entry of ledger.cards) {
    if (!entry.firstSet) {
      continue;
    }
    counts.set(entry.firstSet, (counts.get(entry.firstSet) ?? 0) + 1);
  }
  return counts;
}

function countSetProgress(entries: SetProgressEntry[]) {
  return {
    done: entries.filter((entry) => entry.auditStatus === "done").length,
    inProgress: entries.filter((entry) => entry.auditStatus === "in_progress").length,
    pending: entries.filter((entry) => entry.auditStatus === "pending").length,
  };
}

function buildSetProgressTsv(entries: SetProgressEntry[]) {
  const headers = [
    "code",
    "name",
    "releasedAt",
    "setType",
    "cardCount",
    "digital",
    "auditStatus",
    "reviewedOracleIds",
    "totalUniqueOracleIds",
    "openOracleIds",
    "progressKnown",
    "worksheetPath",
  ];
  const rows = entries.map((entry) =>
    [
      entry.code,
      entry.name,
      entry.releasedAt ?? "",
      entry.setType,
      entry.cardCount,
      entry.digital,
      entry.auditStatus,
      entry.reviewedOracleIds,
      entry.totalUniqueOracleIds ?? "",
      entry.openOracleIds ?? "",
      entry.progressKnown,
      entry.worksheetPath ?? "",
    ].map(formatTsvCell).join("\t"),
  );

  return `${headers.join("\t")}\n${rows.join("\n")}\n`;
}

function parseAuditStatus(value: string | undefined): AuditStatus | null {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  if (AUDIT_STATUSES.includes(normalized as AuditStatus)) {
    return normalized as AuditStatus;
  }

  throw new Error(`Invalid auditStatus "${value}". Use one of: ${AUDIT_STATUSES.join(", ")}`);
}

function parseNeedsCodeChange(value: string | undefined, status: AuditStatus) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return status === "missing" || status === "wrong";
  }

  if (["true", "yes", "ja", "1"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "nein", "0"].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid needsCodeChange "${value}". Use true/false or leave it empty.`);
}

function parseList(value: string | undefined) {
  return value
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseTagDecisionList(value: string | undefined): AuditEntry["tagDecisions"] {
  const decisions = value
    ?.split("|")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(parseTagDecision);

  return decisions?.length ? decisions : undefined;
}

function parseTagDecision(value: string) {
  const [tag = "", action = "", layer = "", ...noteParts] = value.split(":").map((part) => part.trim());
  if (!tag) {
    throw new Error(`Invalid tagDecision "${value}". Expected tag:action:layer:note.`);
  }

  if (!TAG_ACTIONS.includes(action as AuditEntry["tagDecisions"][number]["action"])) {
    throw new Error(`Invalid tagDecision action "${action}". Use one of: ${TAG_ACTIONS.join(", ")}`);
  }

  const decision: AuditEntry["tagDecisions"][number] = {
    tag,
    action: action as AuditEntry["tagDecisions"][number]["action"],
  };

  if (layer) {
    if (!TAG_LAYERS.includes(layer as NonNullable<AuditEntry["tagDecisions"][number]["layer"]>)) {
      throw new Error(`Invalid tagDecision layer "${layer}". Use one of: ${TAG_LAYERS.join(", ")}`);
    }
    decision.layer = layer as NonNullable<AuditEntry["tagDecisions"][number]["layer"]>;
  }

  const note = noteParts.join(":").trim();
  if (note) {
    decision.note = note;
  }

  return decision;
}

function requireWorksheetValue(row: Record<string, string>, field: string) {
  const value = row[field]?.trim();
  if (!value) {
    throw new Error(`Worksheet row ${row.__line ?? "?"} is missing required field "${field}".`);
  }

  return value;
}

function removeEmptyAuditFields(entry: AuditEntry) {
  const normalized = { ...entry };
  if (!normalized.expectedRoles?.length) {
    delete normalized.expectedRoles;
  }
  if (!normalized.actualRoles?.length) {
    delete normalized.actualRoles;
  }
  if (!normalized.tagDecisions?.length) {
    delete normalized.tagDecisions;
  }
  if (!normalized.notes) {
    delete normalized.notes;
  }
  return normalized;
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

function compareAuditEntries(left: AuditEntry, right: AuditEntry) {
  return (
    (left.releasedAt ?? "9999-99-99").localeCompare(right.releasedAt ?? "9999-99-99") ||
    (left.firstSet ?? "").localeCompare(right.firstSet ?? "") ||
    left.name.localeCompare(right.name)
  );
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
  console.log("  npm run audit:cards -- worksheet <code>  Write a TSV review worksheet for one set.");
  console.log("  npm run audit:cards -- import-worksheet <code>  Import reviewed TSV rows into the ledger.");
  console.log("  npm run audit:cards -- progress     Write done/in-progress/pending status for every set.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
