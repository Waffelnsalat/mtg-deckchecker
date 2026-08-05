import {
  DeckComboFinderAnalysis,
  DeckComboFinderCard,
  DeckComboFinderLine,
  DeckComboFinderLineStatus,
  DeckResolutionDocument,
  DeckWinConditionComboLookup,
  ResolvedDeckCard,
  WinConditionComboEntry,
  WinConditionComboLineType,
} from "./types";
import { createLogger } from "./logger";
import { normalizeLookupKey } from "./decklist";

const COMMANDER_SPELLBOOK_FIND_MY_COMBOS_URL =
  "https://backend.commanderspellbook.com/find-my-combos";
const COMMANDER_SPELLBOOK_SOURCE = "Commander Spellbook";
const COMMANDER_SPELLBOOK_TIMEOUT_MS = 12_000;
const COMMANDER_SPELLBOOK_MAX_TOTAL_MS = 35_000;
const COMMANDER_SPELLBOOK_MAX_ATTEMPTS = 2;
const COMMANDER_SPELLBOOK_RETRY_DELAY_MS = 1_200;
const logger = createLogger("combo-lookup");

interface CommanderSpellbookResponse {
  results?: {
    included?: CommanderSpellbookCombo[];
    almostIncluded?: CommanderSpellbookCombo[];
    includedByChangingCommanders?: CommanderSpellbookCombo[];
    almostIncludedByAddingColors?: CommanderSpellbookCombo[];
    almostIncludedByChangingCommanders?: CommanderSpellbookCombo[];
    almostIncludedByAddingColorsAndChangingCommanders?: CommanderSpellbookCombo[];
  };
}

interface CommanderSpellbookCombo {
  id: string | number;
  bracketTag?: string;
  description?: string;
  manaNeeded?: string;
  notablePrerequisites?: string;
  variantCount?: number;
  uses?: Array<{
    card?: {
      name?: string;
      typeLine?: string;
      imageUriFrontNormal?: string | null;
      imageUriFrontLarge?: string | null;
      imageUriFrontSmall?: string | null;
      scryfallUri?: string | null;
    };
    mustBeCommander?: boolean;
    zoneLocations?: string[];
  }>;
  requires?: Array<{
    template?: {
      name?: string;
    };
    quantity?: number;
  }>;
  produces?: Array<{
    quantity?: number;
    feature?: {
      name?: string;
    };
  }>;
  popularity?: number;
}

export async function lookupDeckInfiniteCombos(
  document: DeckResolutionDocument,
): Promise<DeckWinConditionComboLookup> {
  const commanderNames = getCommanderNames(document);
  const decklists = buildCommanderSpellbookDecklists(document);

  try {
    const response = await fetchCommanderSpellbookCombos(decklists);

    if (!response.ok) {
      throw new Error(
        `Commander Spellbook request failed with status ${response.status}.`,
      );
    }

    const payload = (await response.json()) as CommanderSpellbookResponse;
    const results = payload.results ?? {};
    const exact = dedupeExactCombos(
      (results.included ?? []).map((combo) => normalizeExactCombo(combo, commanderNames)),
    );

    return {
      source: COMMANDER_SPELLBOOK_SOURCE,
      lookupStatus: "ok",
      error: undefined,
      exactCount: exact.length,
      finisherCount: exact.filter((combo) => combo.lineType === "finisher").length,
      engineCount: exact.filter((combo) => combo.lineType === "engine").length,
      nearMissCount: countNearMisses(results),
      exact,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown combo lookup error.";
    logger.warn("Commander Spellbook lookup failed.", message);
    return {
      source: COMMANDER_SPELLBOOK_SOURCE,
      lookupStatus: "unavailable",
      error: message,
      exactCount: 0,
      finisherCount: 0,
      engineCount: 0,
      nearMissCount: 0,
      exact: [],
    };
  }
}

export async function lookupDeckComboFinder(
  document: DeckResolutionDocument,
): Promise<DeckComboFinderAnalysis> {
  const commanderNames = getCommanderNames(document);
  const deckNameSet = getDeckNameSet(document);
  const deckCardUriMap = getDeckCardUriMap(document);
  const decklists = buildCommanderSpellbookDecklists(document);

  try {
    const response = await fetchCommanderSpellbookCombos(decklists);

    if (!response.ok) {
      throw new Error(
        `Commander Spellbook request failed with status ${response.status}.`,
      );
    }

    const payload = (await response.json()) as CommanderSpellbookResponse;
    const results = payload.results ?? {};
    const complete = dedupeComboFinderLines(
      (results.included ?? []).map((combo) =>
        normalizeComboFinderLine(combo, {
          status: "complete",
          commanderNames,
          deckNameSet,
          deckCardUriMap,
        }),
      ),
    );
    const missingOne = dedupeComboFinderLines(
      (results.almostIncluded ?? []).map((combo) =>
        normalizeComboFinderLine(combo, {
          status: "missing_one",
          commanderNames,
          deckNameSet,
          deckCardUriMap,
        }),
      ),
    ).filter((combo) => combo.missingCardNames.length + combo.missingTemplates.length <= 1);
    const colorLocked = dedupeComboFinderLines(
      (results.almostIncludedByAddingColors ?? []).map((combo) =>
        normalizeComboFinderLine(combo, {
          status: "color_locked",
          commanderNames,
          deckNameSet,
          deckCardUriMap,
        }),
      ),
    );
    const commanderSwap = dedupeComboFinderLines(
      [
        ...(results.includedByChangingCommanders ?? []),
        ...(results.almostIncludedByChangingCommanders ?? []),
        ...(results.almostIncludedByAddingColorsAndChangingCommanders ?? []),
      ].map((combo) =>
        normalizeComboFinderLine(combo, {
          status: "commander_swap",
          commanderNames,
          deckNameSet,
          deckCardUriMap,
        }),
      ),
    );

    return buildComboFinderAnalysis({
      lookupStatus: "ok",
      complete,
      missingOne,
      colorLocked,
      commanderSwap,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown combo lookup error.";
    logger.warn("Commander Spellbook finder lookup failed.", message);
    return buildComboFinderAnalysis({
      lookupStatus: "unavailable",
      error: message,
      complete: [],
      missingOne: [],
      colorLocked: [],
      commanderSwap: [],
    });
  }
}

async function fetchCommanderSpellbookCombos(decklists: string[]) {
  let lastError: Error | null = null;
  const startedAt = Date.now();

  for (const decklist of decklists) {
    for (let attempt = 1; attempt <= COMMANDER_SPELLBOOK_MAX_ATTEMPTS; attempt += 1) {
      const remainingMs = COMMANDER_SPELLBOOK_MAX_TOTAL_MS - (Date.now() - startedAt);
      if (remainingMs <= 0) {
        throw lastError ?? new Error("Commander Spellbook lookup timed out.");
      }

      try {
        const response = await fetch(COMMANDER_SPELLBOOK_FIND_MY_COMBOS_URL, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "text/plain",
            "User-Agent": "mtg-deckchecker/0.1",
          },
          signal: AbortSignal.timeout(Math.min(COMMANDER_SPELLBOOK_TIMEOUT_MS, remainingMs)),
          body: decklist,
        });

        if (!response.ok) {
          const details = await safeReadResponseText(response);
          throw new Error(
            `Commander Spellbook request failed with status ${response.status}${details ? `: ${details}` : "."}`,
          );
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown combo lookup error.");

        if (attempt < COMMANDER_SPELLBOOK_MAX_ATTEMPTS) {
          const delayMs = Math.min(
            COMMANDER_SPELLBOOK_RETRY_DELAY_MS,
            Math.max(0, COMMANDER_SPELLBOOK_MAX_TOTAL_MS - (Date.now() - startedAt)),
          );
          if (delayMs > 0) {
            await delay(delayMs);
          }
        }
      }
    }
  }

  throw lastError ?? new Error("Commander Spellbook lookup failed.");
}

function buildCommanderSpellbookDecklists(document: DeckResolutionDocument) {
  const canonical = buildCommanderSpellbookDecklist(document, (card) => card.card.name);
  const requested = buildCommanderSpellbookDecklist(document, (card) => card.requestedName);
  const requestedFlat = buildCommanderSpellbookDecklist(
    document,
    (card) => card.requestedName,
    false,
  );

  return [...new Set([canonical, requested, requestedFlat])];
}

function buildCommanderSpellbookDecklist(
  document: DeckResolutionDocument,
  getName: (card: ResolvedDeckCard) => string,
  includeCommanderHeader = true,
) {
  const deckCards = document.result.resolvedCards.filter(
    (card) => card.section === "commander" || card.section === "mainboard",
  );
  const commanders = deckCards.filter((card) => card.section === "commander");
  const mainboard = deckCards.filter((card) => card.section === "mainboard");
  const lines: string[] = [];

  if (includeCommanderHeader && commanders.length > 0) {
    lines.push("// COMMANDER");

    for (const card of commanders) {
      lines.push(formatDecklistLine(card, getName));
    }

    lines.push("");
  } else {
    for (const card of commanders) {
      lines.push(formatDecklistLine(card, getName));
    }
  }

  for (const card of mainboard) {
    lines.push(formatDecklistLine(card, getName));
  }

  return lines.join("\n");
}

function formatDecklistLine(card: ResolvedDeckCard, getName: (card: ResolvedDeckCard) => string) {
  return `${card.quantity} ${getName(card)}`;
}

function normalizeExactCombo(
  combo: CommanderSpellbookCombo,
  commanderNames: Set<string>,
): WinConditionComboEntry {
  const cardNames = [...new Set((combo.uses ?? []).flatMap((use) => {
    const name = use.card?.name?.trim();
    return name ? [name] : [];
  }))].sort((left, right) => left.localeCompare(right));
  const outcomeNames = normalizeOutcomeNames(combo.produces ?? []);
  const lineType = determineComboLineType(outcomeNames);
  const commanderInvolved =
    (combo.uses ?? []).some((use) => use.mustBeCommander) ||
    cardNames.some((name) => commanderNames.has(name));

  return {
    id: String(combo.id),
    comboValue: estimateComboValue({
      cardCount: cardNames.length,
      lineType,
      commanderInvolved,
      manaNeeded: combo.manaNeeded ?? "",
      notablePrerequisites: combo.notablePrerequisites ?? "",
      outcomeNames,
    }),
    lineType,
    cardNames,
    outcomeNames,
    description: combo.description?.trim() ?? "",
    manaNeeded: combo.manaNeeded?.trim() || undefined,
    notablePrerequisites: splitPrerequisites(combo.notablePrerequisites),
    bracketTag: combo.bracketTag,
    variantCount: combo.variantCount ?? 1,
    commanderInvolved,
  };
}

function normalizeComboFinderLine(
  combo: CommanderSpellbookCombo,
  input: {
    status: DeckComboFinderLineStatus;
    commanderNames: Set<string>;
    deckNameSet: Set<string>;
    deckCardUriMap: Map<string, string>;
  },
): DeckComboFinderLine {
  const cards = normalizeComboFinderCards(combo, input.deckNameSet, input.deckCardUriMap);
  const cardNames = cards.map((card) => card.name);
  const missingCardNames = cards
    .filter((card) => !card.inDeck)
    .map((card) => card.name);
  const missingTemplates = normalizeMissingTemplates(combo);
  const outcomeNames = normalizeOutcomeNames(combo.produces ?? []);
  const lineType = determineComboLineType(outcomeNames);
  const commanderInvolved =
    (combo.uses ?? []).some((use) => use.mustBeCommander) ||
    cardNames.some((name) => input.commanderNames.has(name));

  return {
    id: String(combo.id),
    status: input.status,
    statusLabel: getComboFinderStatusLabel(input.status),
    lineType,
    cardNames,
    missingCardNames,
    missingTemplates,
    cards,
    outcomeNames,
    description: combo.description?.trim() ?? "",
    steps: splitComboSteps(combo.description),
    manaNeeded: combo.manaNeeded?.trim() || undefined,
    notablePrerequisites: splitPrerequisites(combo.notablePrerequisites),
    bracketTag: combo.bracketTag,
    variantCount: combo.variantCount ?? 1,
    commanderInvolved,
    popularity: combo.popularity,
  };
}

function normalizeComboFinderCards(
  combo: CommanderSpellbookCombo,
  deckNameSet: Set<string>,
  deckCardUriMap: Map<string, string>,
): DeckComboFinderCard[] {
  const byName = new Map<string, DeckComboFinderCard>();

  for (const use of combo.uses ?? []) {
    const name = use.card?.name?.trim();
    if (!name) {
      continue;
    }

    const existing = byName.get(name);
    const normalizedName = normalizeName(name);
    const next: DeckComboFinderCard = {
      name,
      typeLine: use.card?.typeLine,
      imageUri:
        use.card?.imageUriFrontNormal ??
        use.card?.imageUriFrontLarge ??
        use.card?.imageUriFrontSmall ??
        undefined,
      scryfallUri:
        use.card?.scryfallUri?.trim() ||
        deckCardUriMap.get(normalizedName) ||
        createScryfallSearchUri(name),
      inDeck: deckNameSet.has(normalizedName),
      mustBeCommander: Boolean(use.mustBeCommander),
      zoneLocations: use.zoneLocations ?? [],
    };

    byName.set(name, existing ? mergeComboFinderCard(existing, next) : next);
  }

  return [...byName.values()].sort(
    (left, right) => Number(right.inDeck) - Number(left.inDeck) || left.name.localeCompare(right.name),
  );
}

function mergeComboFinderCard(left: DeckComboFinderCard, right: DeckComboFinderCard): DeckComboFinderCard {
  return {
    name: left.name,
    typeLine: left.typeLine ?? right.typeLine,
    imageUri: left.imageUri ?? right.imageUri,
    scryfallUri: left.scryfallUri || right.scryfallUri,
    inDeck: left.inDeck || right.inDeck,
    mustBeCommander: left.mustBeCommander || right.mustBeCommander,
    zoneLocations: [...new Set([...left.zoneLocations, ...right.zoneLocations])],
  };
}

function normalizeMissingTemplates(combo: CommanderSpellbookCombo) {
  return [
    ...new Set(
      (combo.requires ?? [])
        .map((requirement) => {
          const name = requirement.template?.name?.trim();
          if (!name) {
            return "";
          }

          return requirement.quantity && requirement.quantity > 1
            ? `${requirement.quantity}x ${name}`
            : name;
        })
        .filter(Boolean),
    ),
  ];
}

function splitComboSteps(description?: string) {
  return (description ?? "")
    .split(/\n+/)
    .map((step) => step.trim())
    .filter(Boolean);
}

function getComboFinderStatusLabel(status: DeckComboFinderLineStatus) {
  switch (status) {
    case "complete":
      return "Complete combo";
    case "missing_one":
      return "One piece missing";
    case "color_locked":
      return "Needs color change";
    case "commander_swap":
      return "Needs commander change";
  }
}

function normalizeOutcomeNames(
  produces: NonNullable<CommanderSpellbookCombo["produces"]>,
) {
  return produces
    .map((produce) => {
      const name = produce.feature?.name?.trim();

      if (!name) {
        return null;
      }

      return produce.quantity && produce.quantity > 1 ? `${produce.quantity}x ${name}` : name;
    })
    .filter((name): name is string => name !== null);
}

function determineComboLineType(outcomeNames: string[]): WinConditionComboLineType {
  return outcomeNames.some(isFinisherOutcome) ? "finisher" : "engine";
}

function isFinisherOutcome(outcomeName: string) {
  const text = outcomeName.toLowerCase();

  return (
    /\bwin the game\b/.test(text) ||
    /\blose the game\b/.test(text) ||
    /\beach opponent\b/.test(text) ||
    /\bdamage\b/.test(text) ||
    /\blife\b/.test(text) ||
    /\bcombat\b/.test(text) ||
    /\bturns?\b/.test(text) ||
    /\bpoison\b/.test(text) ||
    /\bmill\b/.test(text)
  );
}

function estimateComboValue(input: {
  cardCount: number;
  lineType: WinConditionComboLineType;
  commanderInvolved: boolean;
  manaNeeded: string;
  notablePrerequisites: string;
  outcomeNames: string[];
}) {
  let value = input.lineType === "finisher" ? 1.45 : 1.05;

  if (input.outcomeNames.some((name) => /\bwin the game\b|\blose the game\b|\binfinite turns\b/i.test(name))) {
    value += 0.2;
  }

  if (input.cardCount <= 2) {
    value += 0.15;
  } else if (input.cardCount >= 4) {
    value -= 0.1;
  }

  if (input.commanderInvolved) {
    value += 0.12;
  }

  if (input.manaNeeded) {
    value -= 0.05;
  }

  if (splitPrerequisites(input.notablePrerequisites).length >= 2) {
    value -= 0.06;
  }

  return roundTo(clamp(value, 0.8, 1.8), 2);
}

function splitPrerequisites(text?: string) {
  if (!text) {
    return [];
  }

  return text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function dedupeExactCombos(combos: WinConditionComboEntry[]) {
  const bySignature = new Map<string, WinConditionComboEntry>();

  for (const combo of combos) {
    const signature = [
      combo.lineType,
      combo.cardNames.join("|"),
      [...combo.outcomeNames].sort((left, right) => left.localeCompare(right)).join("|"),
    ].join("::");
    const existing = bySignature.get(signature);

    if (!existing || combo.comboValue > existing.comboValue) {
      bySignature.set(signature, combo);
    }
  }

  return [...bySignature.values()].sort(
    (left, right) =>
      right.comboValue - left.comboValue ||
      left.cardNames.length - right.cardNames.length ||
      left.cardNames.join(", ").localeCompare(right.cardNames.join(", ")),
    );
}

function buildComboFinderAnalysis(input: {
  lookupStatus: DeckComboFinderAnalysis["lookupStatus"];
  error?: string;
  complete: DeckComboFinderLine[];
  missingOne: DeckComboFinderLine[];
  colorLocked: DeckComboFinderLine[];
  commanderSwap: DeckComboFinderLine[];
}): DeckComboFinderAnalysis {
  const counts = {
    complete: input.complete.length,
    missingOne: input.missingOne.length,
    colorLocked: input.colorLocked.length,
    commanderSwap: input.commanderSwap.length,
    total:
      input.complete.length +
      input.missingOne.length +
      input.colorLocked.length +
      input.commanderSwap.length,
  };

  return {
    source: COMMANDER_SPELLBOOK_SOURCE,
    lookupStatus: input.lookupStatus,
    error: input.error,
    summary: summarizeComboFinder(counts, input.lookupStatus),
    counts,
    complete: input.complete.slice(0, 80),
    missingOne: input.missingOne.slice(0, 120),
    colorLocked: input.colorLocked.slice(0, 40),
    commanderSwap: input.commanderSwap.slice(0, 40),
  };
}

function summarizeComboFinder(
  counts: DeckComboFinderAnalysis["counts"],
  lookupStatus: DeckComboFinderAnalysis["lookupStatus"],
) {
  if (lookupStatus !== "ok") {
    return "Combo lookup is currently unavailable. Try again later.";
  }

  if (counts.complete === 0 && counts.missingOne === 0) {
    return "No complete or one-card-away Commander Spellbook combo lines were found for this list.";
  }

  return `${counts.complete} complete combo line${counts.complete === 1 ? "" : "s"} and ${counts.missingOne} one-card-away line${counts.missingOne === 1 ? "" : "s"} found.`;
}

function dedupeComboFinderLines(combos: DeckComboFinderLine[]) {
  const bySignature = new Map<string, DeckComboFinderLine>();

  for (const combo of combos) {
    const signature = [
      combo.status,
      combo.cardNames.join("|"),
      [...combo.outcomeNames].sort((left, right) => left.localeCompare(right)).join("|"),
      combo.missingTemplates.join("|"),
    ].join("::");
    const existing = bySignature.get(signature);

    if (!existing || compareComboFinderLines(combo, existing) < 0) {
      bySignature.set(signature, combo);
    }
  }

  return [...bySignature.values()].sort(compareComboFinderLines);
}

function compareComboFinderLines(left: DeckComboFinderLine, right: DeckComboFinderLine) {
  return (
    getLineTypeRank(right.lineType) - getLineTypeRank(left.lineType) ||
    Number(right.commanderInvolved) - Number(left.commanderInvolved) ||
    left.missingCardNames.length + left.missingTemplates.length -
      (right.missingCardNames.length + right.missingTemplates.length) ||
    left.cardNames.length - right.cardNames.length ||
    (right.popularity ?? 0) - (left.popularity ?? 0) ||
    left.cardNames.join(", ").localeCompare(right.cardNames.join(", "))
  );
}

function getLineTypeRank(lineType: WinConditionComboLineType) {
  return lineType === "finisher" ? 2 : 1;
}

function getCommanderNames(document: DeckResolutionDocument) {
  return new Set(
    document.result.resolvedCards
      .filter((card) => card.section === "commander")
      .map((card) => card.card.name),
  );
}

function getDeckNameSet(document: DeckResolutionDocument) {
  return new Set(
    document.result.resolvedCards
      .filter((card) => card.section === "commander" || card.section === "mainboard" || card.section === "companion")
      .flatMap((card) => [card.card.name, card.requestedName])
      .map(normalizeName),
  );
}

function getDeckCardUriMap(document: DeckResolutionDocument) {
  const byName = new Map<string, string>();

  for (const card of document.result.resolvedCards) {
    if (card.section !== "commander" && card.section !== "mainboard" && card.section !== "companion") {
      continue;
    }

    if (!card.card.scryfall_uri) {
      continue;
    }

    byName.set(normalizeName(card.card.name), card.card.scryfall_uri);
    byName.set(normalizeName(card.requestedName), card.card.scryfall_uri);
  }

  return byName;
}

function createScryfallSearchUri(name: string) {
  return `https://scryfall.com/search?q=${encodeURIComponent(`!"${name}"`)}`;
}

function normalizeName(name: string) {
  return normalizeLookupKey(name);
}

function countNearMisses(results: NonNullable<CommanderSpellbookResponse["results"]>) {
  return (
    (results.almostIncluded?.length ?? 0) +
    (results.includedByChangingCommanders?.length ?? 0) +
    (results.almostIncludedByAddingColors?.length ?? 0) +
    (results.almostIncludedByChangingCommanders?.length ?? 0) +
    (results.almostIncludedByAddingColorsAndChangingCommanders?.length ?? 0)
  );
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function safeReadResponseText(response: Response) {
  try {
    const text = (await response.text()).trim();
    return text.length > 0 ? text.slice(0, 240) : "";
  } catch {
    return "";
  }
}
