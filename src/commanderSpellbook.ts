import {
  DeckResolutionDocument,
  DeckWinConditionComboLookup,
  ResolvedDeckCard,
  WinConditionComboEntry,
  WinConditionComboLineType,
} from "./types";
import { createLogger } from "./logger";

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
    };
    mustBeCommander?: boolean;
  }>;
  produces?: Array<{
    quantity?: number;
    feature?: {
      name?: string;
    };
  }>;
}

export async function lookupDeckInfiniteCombos(
  document: DeckResolutionDocument,
): Promise<DeckWinConditionComboLookup> {
  const commanderNames = new Set(
    document.result.resolvedCards
      .filter((card) => card.section === "commander")
      .map((card) => card.card.name),
  );
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
