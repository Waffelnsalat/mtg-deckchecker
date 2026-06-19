import {
  DeckWinConditionComboLookup,
  ScryfallCard,
  WinConditionComboEntry,
} from "./types";

type InfiniteManaProfileKind = "any" | "colorless" | "colored";
type CommanderManaSinkKind =
  | "cards"
  | "tutor"
  | "recursion"
  | "direct_finisher"
  | "board_finisher"
  | "interaction";

interface InfiniteManaProfile {
  combo: WinConditionComboEntry;
  kind: InfiniteManaProfileKind;
  colors: string[];
}

interface CommanderManaSinkAbility {
  cost: string;
  effect: string;
  kinds: CommanderManaSinkKind[];
  requiredColors: string[];
}

export interface CommanderInfiniteManaSinkProfile {
  name: string;
  kinds: CommanderManaSinkKind[];
  primaryKind: CommanderManaSinkKind;
  exactManaComboCount: number;
  convertedEngineCount: number;
  reason: string;
}

export interface CommanderInfiniteManaSinkAnalysis {
  infiniteManaComboCount: number;
  convertedEngineCount: number;
  directFinisherCount: number;
  boardFinisherCount: number;
  commanders: CommanderInfiniteManaSinkProfile[];
}

const COLOR_WORD_TO_SYMBOL: Record<string, string> = {
  white: "W",
  blue: "U",
  black: "B",
  red: "R",
  green: "G",
};

const SINK_PRIORITY: Record<CommanderManaSinkKind, number> = {
  direct_finisher: 6,
  board_finisher: 5,
  tutor: 4,
  cards: 3,
  recursion: 2,
  interaction: 1,
};

export function analyzeCommanderInfiniteManaSinks(
  commanders: ScryfallCard[],
  combos: DeckWinConditionComboLookup,
): CommanderInfiniteManaSinkAnalysis {
  if (combos.lookupStatus !== "ok" || commanders.length === 0) {
    return createEmptyAnalysis();
  }

  const manaProfiles = combos.exact
    .map(getInfiniteManaProfile)
    .filter((profile): profile is InfiniteManaProfile => profile !== null);

  if (manaProfiles.length === 0) {
    return createEmptyAnalysis();
  }

  const convertedEngineIds = new Set<string>();
  const directFinisherIds = new Set<string>();
  const boardFinisherIds = new Set<string>();

  const commanderProfiles = commanders
    .map((card) => {
      const abilities = getCommanderManaSinkAbilities(card);

      if (abilities.length === 0) {
        return null;
      }

      const matchedComboIds = new Set<string>();
      const matchedKinds = new Set<CommanderManaSinkKind>();
      let convertedEngineCount = 0;
      let bestAbility: CommanderManaSinkAbility | null = null;
      let bestScore = -1;

      for (const ability of abilities) {
        const matchingProfiles = manaProfiles.filter((profile) =>
          abilityMatchesInfiniteMana(ability, profile),
        );

        if (matchingProfiles.length === 0) {
          continue;
        }

        const score =
          getAbilityPriority(ability.kinds) * 10 + matchingProfiles.length * 2;

        if (score > bestScore) {
          bestAbility = ability;
          bestScore = score;
        }

        ability.kinds.forEach((kind) => matchedKinds.add(kind));

        for (const profile of matchingProfiles) {
          matchedComboIds.add(profile.combo.id);

          if (profile.combo.lineType === "engine") {
            convertedEngineCount += 1;
            convertedEngineIds.add(profile.combo.id);
          }

          if (ability.kinds.includes("direct_finisher")) {
            directFinisherIds.add(profile.combo.id);
          }

          if (ability.kinds.includes("board_finisher")) {
            boardFinisherIds.add(profile.combo.id);
          }
        }
      }

      if (matchedComboIds.size === 0 || bestAbility === null) {
        return null;
      }

      const kinds = [...matchedKinds].sort(
        (left, right) => SINK_PRIORITY[right] - SINK_PRIORITY[left],
      );

      return {
        name: card.name,
        kinds,
        primaryKind: kinds[0],
        exactManaComboCount: matchedComboIds.size,
        convertedEngineCount,
        reason: `${card.name} can spend infinite mana through "${bestAbility.cost}: ${bestAbility.effect}"`,
      } satisfies CommanderInfiniteManaSinkProfile;
    })
    .filter((profile): profile is CommanderInfiniteManaSinkProfile => profile !== null)
    .sort(
      (left, right) =>
        right.convertedEngineCount - left.convertedEngineCount ||
        right.exactManaComboCount - left.exactManaComboCount ||
        left.name.localeCompare(right.name),
    );

  return {
    infiniteManaComboCount: manaProfiles.length,
    convertedEngineCount: convertedEngineIds.size,
    directFinisherCount: directFinisherIds.size,
    boardFinisherCount: boardFinisherIds.size,
    commanders: commanderProfiles,
  };
}

export function getCommanderInfiniteManaSinkProfile(
  analysis: CommanderInfiniteManaSinkAnalysis,
  commanderName: string,
) {
  const normalized = normalizeText(commanderName);
  return (
    analysis.commanders.find((profile) => normalizeText(profile.name) === normalized) ?? null
  );
}

function createEmptyAnalysis(): CommanderInfiniteManaSinkAnalysis {
  return {
    infiniteManaComboCount: 0,
    convertedEngineCount: 0,
    directFinisherCount: 0,
    boardFinisherCount: 0,
    commanders: [],
  };
}

function getInfiniteManaProfile(combo: WinConditionComboEntry): InfiniteManaProfile | null {
  const text = [...(combo.outcomeNames ?? []), combo.description ?? ""].join(" ").toLowerCase();

  if (!/\binfinite\b/.test(text) || !/\bmana\b/.test(text)) {
    return null;
  }

  if (/\bcolorless mana\b/.test(text)) {
    return {
      combo,
      kind: "colorless",
      colors: [],
    };
  }

  const colors = extractColorWords(text);

  if (colors.length > 0 && !/\bany color\b/.test(text)) {
    return {
      combo,
      kind: "colored",
      colors,
    };
  }

  return {
    combo,
    kind: "any",
    colors: [],
  };
}

function getCommanderManaSinkAbilities(card: ScryfallCard) {
  const texts = getCommanderTexts(card);
  const abilities: CommanderManaSinkAbility[] = [];

  for (const text of texts) {
    for (const rawLine of text.split(/\r?\n+/)) {
      const line = rawLine.trim();
      const separator = line.indexOf(":");

      if (separator <= 0) {
        continue;
      }

      const cost = line.slice(0, separator).trim();
      const effect = line.slice(separator + 1).trim();

      if (!cost || !effect || !/\{[^}]+\}/.test(cost)) {
        continue;
      }

      const lowerCost = cost.toLowerCase();
      if (
        /\{t\}|\{q\}/.test(lowerCost) ||
        /\bsacrifice\b/.test(lowerCost) ||
        /\bdiscard\b/.test(lowerCost) ||
        /\bexile\b/.test(lowerCost) ||
        /\bpay\b/.test(lowerCost) ||
        /\bremove\b/.test(lowerCost)
      ) {
        continue;
      }

      const requiredColors = getRequiredColorsFromCost(cost);
      const kinds = getManaSinkKinds(effect);

      if (kinds.length === 0) {
        continue;
      }

      abilities.push({
        cost,
        effect,
        kinds,
        requiredColors,
      });
    }
  }

  return abilities;
}

function getCommanderTexts(card: ScryfallCard) {
  const texts = [card.oracle_text ?? ""];

  for (const face of card.card_faces ?? []) {
    if (face.oracle_text) {
      texts.push(face.oracle_text);
    }
  }

  return texts.filter((text) => text.trim().length > 0);
}

function getRequiredColorsFromCost(cost: string) {
  const colors = new Set<string>();

  for (const match of cost.matchAll(/\{([^}]+)\}/g)) {
    const symbol = match[1].toUpperCase();

    for (const part of symbol.split("/")) {
      if (/^[WUBRG]$/.test(part)) {
        colors.add(part);
      }
    }
  }

  return [...colors];
}

function getManaSinkKinds(effect: string) {
  const lower = effect.toLowerCase();
  const kinds = new Set<CommanderManaSinkKind>();

  if (
    /\bdeal(?:s)?\b[^.]{0,80}\bdamage\b/.test(lower) ||
    /\beach opponent loses\b/.test(lower) ||
    /\btarget opponent loses\b/.test(lower) ||
    /\btarget player mills?\b/.test(lower) ||
    /\bpoison\b/.test(lower) ||
    /\bwin the game\b/.test(lower) ||
    /\blose the game\b/.test(lower)
  ) {
    kinds.add("direct_finisher");
  }

  if (
    /\bcreate\b[^.]{0,90}\bcreature token\b/.test(lower) ||
    /\bput\b[^.]{0,90}\+1\/\+1 counters?\b/.test(lower) ||
    /\bput\b[^.]{0,90}\bcounters?\b[^.]{0,30}\bon\b[^.]{0,20}(?:target )?(?:creature|commander|this)\b/.test(lower) ||
    /\bgets \+\d+\/\+\d+\b/.test(lower) ||
    /\bgets \+x\/\+0\b/.test(lower)
  ) {
    kinds.add("board_finisher");
  }

  if (
    /\bdraw\b/.test(lower) ||
    /\bscry\b/.test(lower) ||
    /\blook at the top\b/.test(lower) ||
    /\breveal the top\b/.test(lower) ||
    /\bexile the top\b/.test(lower) ||
    /\bmay play that card\b/.test(lower) ||
    /\bput that card into your hand\b/.test(lower)
  ) {
    kinds.add("cards");
  }

  if (/\bsearch your library\b/.test(lower)) {
    kinds.add("tutor");
  }

  if (
    /\breturn target\b[^.]{0,120}\bfrom your graveyard\b/.test(lower) ||
    /\bcast target\b[^.]{0,120}\bfrom your graveyard\b/.test(lower)
  ) {
    kinds.add("recursion");
  }

  if (
    /\bdestroy target\b/.test(lower) ||
    /\bexile target\b/.test(lower) ||
    /\breturn target\b[^.]{0,80}\bto (?:its owner's )?hand\b/.test(lower) ||
    /\bcounter target spell\b/.test(lower)
  ) {
    kinds.add("interaction");
  }

  return [...kinds];
}

function abilityMatchesInfiniteMana(
  ability: CommanderManaSinkAbility,
  profile: InfiniteManaProfile,
) {
  if (profile.kind === "any") {
    return true;
  }

  if (profile.kind === "colorless") {
    return ability.requiredColors.length === 0;
  }

  return ability.requiredColors.every((color) => profile.colors.includes(color));
}

function extractColorWords(text: string) {
  const colors = new Set<string>();

  for (const [word, symbol] of Object.entries(COLOR_WORD_TO_SYMBOL)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) {
      colors.add(symbol);
    }
  }

  return [...colors];
}

function getAbilityPriority(kinds: CommanderManaSinkKind[]) {
  return kinds.reduce((best, kind) => Math.max(best, SINK_PRIORITY[kind]), 0);
}

function normalizeText(text: string) {
  return text.toLowerCase().replace(/[^\w]+/g, " ").trim();
}
