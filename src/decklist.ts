import { DeckSection, ParseDecklistOptions, ParseDecklistResult, ParsedDeckEntry, ParseIssue } from "./types";

const SECTION_HEADERS: Record<string, DeckSection> = {
  commander: "commander",
  commanders: "commander",
  partner: "commander",
  partners: "commander",
  background: "commander",
  backgrounds: "commander",
  "doctor's companion": "commander",
  "doctors companion": "commander",
  deck: "mainboard",
  main: "mainboard",
  mainboard: "mainboard",
  sideboard: "sideboard",
  side: "sideboard",
  maybeboard: "maybeboard",
  maybe: "maybeboard",
  companion: "companion",
};

const SECTION_PREFIXES: Record<string, DeckSection> = {
  cmdr: "commander",
  cmndr: "commander",
  commander: "commander",
  partner: "commander",
  partners: "commander",
  background: "commander",
  backgrounds: "commander",
  "doctor's companion": "commander",
  "doctors companion": "commander",
  deck: "mainboard",
  main: "mainboard",
  mainboard: "mainboard",
  mb: "mainboard",
  sb: "sideboard",
  sideboard: "sideboard",
  maybe: "maybeboard",
  maybeboard: "maybeboard",
  companion: "companion",
};

const QUANTITY_PREFIX = /^(?<quantity>\d+)\s*x?\s+(?<card>.+)$/i;

export function parseDecklist(
  decklist: string,
  options: ParseDecklistOptions = {},
): ParseDecklistResult {
  const rawEntries: ParsedDeckEntry[] = [];
  const errors: ParseIssue[] = [];
  const warnings: string[] = [];

  let currentSection: DeckSection = "mainboard";

  const lines = decklist.split(/\r?\n/);

  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      if (currentSection === "commander" || currentSection === "companion") {
        currentSection = "mainboard";
      }
      continue;
    }

    const sectionHeader = normalizeSectionHeader(trimmedLine);
    if (sectionHeader) {
      currentSection = sectionHeader;
      continue;
    }

    if (isStandaloneBracketSectionLine(trimmedLine)) {
      currentSection = "mainboard";
      continue;
    }

    if (trimmedLine.startsWith("#") || trimmedLine.startsWith("//")) {
      continue;
    }

    const { section, line } = extractSectionPrefix(trimmedLine, currentSection);
    const parsed = parseDeckEntry(line, rawLine, lineNumber, section);

    if (!parsed) {
      errors.push({
        lineNumber,
        line: rawLine,
        message: "Could not parse this decklist line.",
      });
      continue;
    }

    rawEntries.push(parsed);
  }

  const entries = applyCommanderSelection(rawEntries, options, warnings);

  const totalCards = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const edhDeckCards = entries
    .filter((entry) => entry.section === "commander" || entry.section === "mainboard")
    .reduce((sum, entry) => sum + entry.quantity, 0);
  const uniqueCards = new Set(entries.map((entry) => normalizeLookupKey(entry.name))).size;
  const commanderCards = entries
    .filter((entry) => entry.section === "commander")
    .reduce((sum, entry) => sum + entry.quantity, 0);

  if (edhDeckCards !== 100) {
    warnings.push(`EDH decks are usually 100 cards, but this list contains ${edhDeckCards} main deck + commander cards.`);
  }

  if (commanderCards === 0) {
    warnings.push("No commander section was detected.");
  }

  if (commanderCards > 2) {
    warnings.push(`The commander section contains ${commanderCards} cards.`);
  }

  return {
    entries,
    errors,
    warnings,
    totalCards,
    uniqueCards,
  };
}

function parseDeckEntry(
  line: string,
  originalLine: string,
  lineNumber: number,
  section: DeckSection,
): ParsedDeckEntry | null {
  let workingLine = line.trim();
  let quantity = 1;

  const quantityMatch = workingLine.match(QUANTITY_PREFIX);
  if (quantityMatch?.groups) {
    quantity = Number(quantityMatch.groups.quantity);
    workingLine = quantityMatch.groups.card.trim();
  }

  workingLine = cleanupDeckEntryName(workingLine);

  if (!workingLine || Number.isNaN(quantity) || quantity < 1) {
    return null;
  }

  return {
    lineNumber,
    originalLine,
    quantity,
    name: workingLine,
    section,
  };
}

function cleanupDeckEntryName(line: string): string {
  return line
    .replace(/^\[[^[\]]+\]\s*/, "")
    .replace(/\s+\*[^*]+\*\s*$/, "")
    .replace(/\s+\[[A-Za-z0-9]{2,6}\]\s*$/, "")
    .replace(/\s+\([A-Za-z0-9]{2,6}\)(?:\s+[A-Za-z0-9-]+)?\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function applyCommanderSelection(
  entries: ParsedDeckEntry[],
  options: ParseDecklistOptions,
  warnings: string[],
): ParsedDeckEntry[] {
  const adjustedEntries = entries.map((entry) => ({ ...entry }));
  const additionalCommanderName =
    options.additionalCommanderName ?? options.partnerName ?? options.backgroundName;
  const selectedLeaders = [
    { label: "Commander", name: options.commanderName },
    { label: "Additional Commander", name: additionalCommanderName },
  ]
    .filter((leader): leader is { label: string; name: string } => Boolean(leader.name?.trim()))
    .map((leader) => ({
      ...leader,
      normalizedName: normalizeLookupKey(cleanupDeckEntryName(leader.name)),
    }));

  if (selectedLeaders.length > 0) {
    for (const entry of adjustedEntries) {
      if (entry.section === "commander") {
        entry.section = "mainboard";
      }
    }

    const claimedIndices = new Set<number>();

    for (const leader of selectedLeaders) {
      const matchingIndex = adjustedEntries.findIndex(
        (entry, index) =>
          !claimedIndices.has(index) && normalizeLookupKey(entry.name) === leader.normalizedName,
      );

      if (matchingIndex === -1) {
        warnings.push(`${leader.label} "${leader.name}" was not found in the decklist.`);
        continue;
      }

      adjustedEntries[matchingIndex].section = "commander";
      claimedIndices.add(matchingIndex);
    }

    return adjustedEntries;
  }

  const hasCommanderSection = adjustedEntries.some((entry) => entry.section === "commander");
  if (!hasCommanderSection && options.assumeFirstCardAsCommander && adjustedEntries[0]) {
    adjustedEntries[0].section = "commander";
  }

  return adjustedEntries;
}

function normalizeSectionHeader(line: string): DeckSection | null {
  const normalized = line
    .replace(/^(\/\/+|#+)\s*/, "")
    .replace(/^\[(.+)\]$/, "$1")
    .toLowerCase()
    .replace(/\(\d+\)/g, "")
    .replace(/[:\-]/g, "")
    .trim();

  return SECTION_HEADERS[normalized] ?? null;
}

function isStandaloneBracketSectionLine(line: string): boolean {
  const cleanedLine = line
    .replace(/^(\/\/+|#+)\s*/, "")
    .trim();

  return /^\[[^\[\]]+\]\s*(?:\(\d+\))?$/u.test(cleanedLine);
}

function extractSectionPrefix(
  line: string,
  fallbackSection: DeckSection,
): { section: DeckSection; line: string } {
  const match = line.match(/^(?<prefix>[A-Za-z]+):\s*(?<rest>.+)$/);
  if (!match?.groups) {
    return {
      section: fallbackSection,
      line,
    };
  }

  const prefix = SECTION_PREFIXES[match.groups.prefix.toLowerCase()];
  if (!prefix) {
    return {
      section: fallbackSection,
      line,
    };
  }

  return {
    section: prefix,
    line: match.groups.rest.trim(),
  };
}

export function normalizeLookupKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\/\/\s*/g, " __split__ ")
    .replace(/\s*\/\s*/g, " __split__ ")
    .replace(/\s+/g, " ")
    .replace(/\s*__split__\s*/g, " // ")
    .trim();
}
