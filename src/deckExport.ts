import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeLookupKey, parseDecklist } from "./decklist";
import { DeckValidationError, validateEdhDeck } from "./deckValidation";
import { resolveDeckEntries } from "./scryfall";
import { DeckExportDocument, DeckResolutionDocument, DeckValidationResult } from "./types";

const GENERATED_EXPORTS_DIR = path.resolve(process.cwd(), "generated-decks");

interface CreateDeckExportOptions {
  createdBy: "cli" | "web";
  commanderName?: string;
  additionalCommanderName?: string;
  partnerName?: string;
  backgroundName?: string;
  companionName?: string;
  fileStem?: string;
  inputLabel?: string;
  outputPath?: string;
  assumeFirstCardAsCommander?: boolean;
}

export async function resolveDecklistToDocument(
  decklist: string,
  options: Pick<
    CreateDeckExportOptions,
    | "commanderName"
    | "additionalCommanderName"
    | "partnerName"
    | "backgroundName"
    | "companionName"
    | "assumeFirstCardAsCommander"
  > = {},
): Promise<DeckResolutionDocument> {
  const { document, validation } = await resolveDecklistForAnalysis(decklist, options);

  if (!validation.isValid) {
    throw new DeckValidationError(validation);
  }

  return document;
}

export async function resolveDecklistForAnalysis(
  decklist: string,
  options: Pick<
    CreateDeckExportOptions,
    | "commanderName"
    | "additionalCommanderName"
    | "partnerName"
    | "backgroundName"
    | "companionName"
    | "assumeFirstCardAsCommander"
  > = {},
): Promise<{ document: DeckResolutionDocument; validation: DeckValidationResult }> {
  const parsedDecklist = parseDecklist(decklist, {
    commanderName: options.commanderName,
    additionalCommanderName:
      options.additionalCommanderName ?? options.partnerName ?? options.backgroundName,
    partnerName: options.partnerName,
    backgroundName: options.backgroundName,
    assumeFirstCardAsCommander: options.assumeFirstCardAsCommander ?? true,
  });

  if (parsedDecklist.entries.length === 0) {
    throw new Error("No deck cards could be parsed from the submitted decklist.");
  }

  const resolvedDeck = await resolveDeckEntries(parsedDecklist.entries);
  const companionDeck = options.companionName
    ? await resolveCompanionEntry(parsedDecklist.entries, options.companionName)
    : { cards: [], unmatched: [] };

  const document: DeckResolutionDocument = {
    format: "edh",
    parse: parsedDecklist,
    result: {
      resolvedCards: [...resolvedDeck.cards, ...companionDeck.cards],
      unresolvedCards: [...resolvedDeck.unmatched, ...companionDeck.unmatched],
      resolvedCount: resolvedDeck.cards.length + companionDeck.cards.length,
      unresolvedCount: resolvedDeck.unmatched.length + companionDeck.unmatched.length,
    },
  };

  const validation = validateEdhDeck(document, {
    commanderName: options.commanderName,
    additionalCommanderName:
      options.additionalCommanderName ?? options.partnerName ?? options.backgroundName,
    partnerName: options.partnerName,
    backgroundName: options.backgroundName,
    companionName: options.companionName,
  });

  if (document.result.resolvedCount === 0) {
    throw new Error("No deck cards could be resolved from the submitted decklist.");
  }

  return {
    document,
    validation,
  };
}

export async function createDeckExport(
  decklist: string,
  options: CreateDeckExportOptions,
): Promise<{ document: DeckExportDocument; fileName: string; outputPath: string }> {
  const resolvedDocument = await resolveDecklistToDocument(decklist, {
    commanderName: options.commanderName,
    additionalCommanderName: options.additionalCommanderName,
    partnerName: options.partnerName,
    backgroundName: options.backgroundName,
    companionName: options.companionName,
    assumeFirstCardAsCommander: options.assumeFirstCardAsCommander,
  });
  const fileName = options.outputPath
    ? path.basename(options.outputPath)
    : makeDeckExportFileName(options.fileStem);
  const outputPath = options.outputPath ?? path.join(GENERATED_EXPORTS_DIR, fileName);

  const document: DeckExportDocument = {
    ...resolvedDocument,
    source: {
      createdBy: options.createdBy,
      inputLabel: options.inputLabel,
      fileName,
      outputPath,
      exportedAt: new Date().toISOString(),
    },
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  return {
    document,
    fileName,
    outputPath,
  };
}

export function getGeneratedExportsDir(): string {
  return GENERATED_EXPORTS_DIR;
}

export function makeDeckExportFileName(fileStem?: string): string {
  const safeStem = sanitizeFileStem(fileStem ?? "edh-deck");
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `${safeStem}-${timestamp}.json`;
}

function sanitizeFileStem(fileStem: string): string {
  const stem = fileStem
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return stem || "edh-deck";
}

async function resolveCompanionEntry(entries: DeckResolutionDocument["parse"]["entries"], companionName: string) {
  const normalizedCompanionName = normalizeLookupKey(companionName);
  const hasCompanionEntry = entries.some(
    (entry) =>
      entry.section === "companion" &&
      normalizeLookupKey(entry.name) === normalizedCompanionName,
  );

  if (hasCompanionEntry) {
    return { cards: [], unmatched: [] };
  }

  return resolveDeckEntries([
    {
      lineNumber: 0,
      originalLine: `1 ${companionName}`,
      quantity: 1,
      name: companionName.trim(),
      section: "companion",
    },
  ]);
}
