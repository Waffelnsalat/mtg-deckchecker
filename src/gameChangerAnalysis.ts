import { normalizeLookupKey } from "./decklist";
import {
  DeckGameChangerAnalysis,
  DeckResolutionDocument,
  DeckSection,
  DeckStructureFinding,
  ResolvedDeckCard,
} from "./types";

// Official Commander Game Changers list:
// - Commander Brackets Beta Update, October 21, 2025
// - Commander Brackets Beta Update, February 9, 2026 (adds Farewell and Biorhythm)
const OFFICIAL_GAME_CHANGER_NAMES = [
  "Ad Nauseam",
  "Ancient Tomb",
  "Aura Shards",
  "Biorhythm",
  "Bolas's Citadel",
  "Braids, Cabal Minion",
  "Chrome Mox",
  "Coalition Victory",
  "Consecrated Sphinx",
  "Crop Rotation",
  "Cyclonic Rift",
  "Demonic Tutor",
  "Drannith Magistrate",
  "Enlightened Tutor",
  "Farewell",
  "Fierce Guardianship",
  "Field of the Dead",
  "Force of Will",
  "Gaea's Cradle",
  "Gamble",
  "Gifts Ungiven",
  "Glacial Chasm",
  "Grand Arbiter Augustin IV",
  "Grim Monolith",
  "Humility",
  "Imperial Seal",
  "Intuition",
  "Jeska's Will",
  "Lion's Eye Diamond",
  "Mana Vault",
  "Mishra's Workshop",
  "Mox Diamond",
  "Mystical Tutor",
  "Narset, Parter of Veils",
  "Natural Order",
  "Necropotence",
  "Notion Thief",
  "Opposition Agent",
  "Orcish Bowmasters",
  "Panoptic Mirror",
  "Rhystic Study",
  "Seedborn Muse",
  "Serra's Sanctum",
  "Smothering Tithe",
  "Survival of the Fittest",
  "Teferi's Protection",
  "Tergrid, God of Fright",
  "Thassa's Oracle",
  "The One Ring",
  "The Tabernacle at Pendrell Vale",
  "Underworld Breach",
  "Vampiric Tutor",
  "Worldly Tutor",
] as const;

const GAME_CHANGER_MAP = new Map(
  OFFICIAL_GAME_CHANGER_NAMES.map((name) => [normalizeLookupKey(name), name]),
);
const BRACKET_THREE_GAME_CHANGER_CAP = 3;

export function analyzeDeckGameChangers(
  document: DeckResolutionDocument,
): DeckGameChangerAnalysis {
  const deckCards = document.result.resolvedCards.filter(
    (card) =>
      card.section === "commander" ||
      card.section === "mainboard" ||
      card.section === "companion",
  );
  const taggedCards = deckCards
    .map((card) => {
      const matchedName = findMatchedGameChanger(card);
      if (!matchedName) {
        return null;
      }

      return {
        name: card.card.name,
        quantity: card.quantity,
        section: card.section,
        matchedName,
      };
    })
    .filter((card): card is NonNullable<typeof card> => card !== null)
    .sort(compareTaggedCards);

  const uniqueMatched = new Set(taggedCards.map((card) => normalizeLookupKey(card.matchedName)));
  const counts = {
    total: taggedCards.reduce((sum, card) => sum + card.quantity, 0),
    unique: uniqueMatched.size,
    commander: sumSection(taggedCards, "commander"),
    mainboard: sumSection(taggedCards, "mainboard"),
    companion: sumSection(taggedCards, "companion"),
  };
  const bracket = {
    bracketOneTwoLegal: counts.total === 0,
    bracketThreeLegal: counts.total <= BRACKET_THREE_GAME_CHANGER_CAP,
    bracketThreeCap: BRACKET_THREE_GAME_CHANGER_CAP,
  };
  const findings = buildFindings(counts, bracket);

  return {
    summary: summarizeGameChangers(counts.total, bracket),
    counts,
    bracket,
    findings,
    taggedCards,
  };
}

function findMatchedGameChanger(card: ResolvedDeckCard) {
  const candidates = collectCardNameCandidates(card);

  for (const candidate of candidates) {
    const matched = GAME_CHANGER_MAP.get(candidate);
    if (matched) {
      return matched;
    }
  }

  return null;
}

function collectCardNameCandidates(card: ResolvedDeckCard) {
  const names = new Set<string>();
  names.add(normalizeLookupKey(card.card.name));
  names.add(normalizeLookupKey(card.requestedName));

  for (const face of card.card.card_faces ?? []) {
    names.add(normalizeLookupKey(face.name));
  }

  return names;
}

function buildFindings(
  counts: DeckGameChangerAnalysis["counts"],
  bracket: DeckGameChangerAnalysis["bracket"],
): DeckStructureFinding[] {
  const findings: DeckStructureFinding[] = [];

  if (counts.total === 0) {
    findings.push({
      code: "game_changers_clear",
      title: "No Game Changers detected",
      status: "good",
      message: "This deck clears the current Game Changer gate for Bracket 1-2 and stays within the Bracket 3 cap.",
    });
  } else if (bracket.bracketThreeLegal) {
    findings.push({
      code: "game_changers_present",
      title: "Game Changers are present",
      status: "warning",
      message: `This deck contains ${counts.total} Game Changer${counts.total === 1 ? "" : "s"}. That rules it out of Bracket 1-2, but it still stays within the current Bracket 3 cap of ${bracket.bracketThreeCap}.`,
    });
  } else {
    findings.push({
      code: "game_changers_over_cap",
      title: "Game Changer cap is exceeded",
      status: "risk",
      message: `This deck contains ${counts.total} Game Changers, which is above the current Bracket 3 cap of ${bracket.bracketThreeCap}.`,
    });
  }

  if (counts.commander > 0) {
    findings.push({
      code: "game_changers_in_command_zone",
      title: "A Game Changer sits in the command zone",
      status: "warning",
      message: "At least one Game Changer is always available from the command zone, so table expectations should account for that immediately.",
    });
  }

  if (counts.companion > 0) {
    findings.push({
      code: "game_changers_in_companion",
      title: "Companion counts too",
      status: "note",
      message: "A companion Game Changer still counts toward the bracket cap even though it sits outside the 99.",
    });
  }

  return findings;
}

function summarizeGameChangers(
  total: number,
  bracket: DeckGameChangerAnalysis["bracket"],
) {
  if (total === 0) {
    return "No official Game Changers were detected.";
  }

  if (bracket.bracketThreeLegal) {
    return `${total} Game Changer${total === 1 ? "" : "s"} detected. The deck no longer fits Bracket 1-2, but it stays within the current Bracket 3 cap.`;
  }

  return `${total} Game Changers detected. The deck exceeds the current Bracket 3 cap.`;
}

function sumSection(
  taggedCards: DeckGameChangerAnalysis["taggedCards"],
  section: DeckSection,
) {
  return taggedCards
    .filter((card) => card.section === section)
    .reduce((sum, card) => sum + card.quantity, 0);
}

function compareTaggedCards(
  left: DeckGameChangerAnalysis["taggedCards"][number],
  right: DeckGameChangerAnalysis["taggedCards"][number],
) {
  const sectionOrder: Record<DeckSection, number> = {
    commander: 0,
    companion: 1,
    mainboard: 2,
    sideboard: 3,
    maybeboard: 4,
  };

  return (
    sectionOrder[left.section] - sectionOrder[right.section] ||
    left.matchedName.localeCompare(right.matchedName) ||
    left.name.localeCompare(right.name)
  );
}
