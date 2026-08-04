import { normalizeLookupKey } from "./decklist";
import {
  DeckResolutionDocument,
  DeckSaltAnalysis,
  DeckSaltCard,
  DeckSection,
  DeckStructureFinding,
  ScryfallCard,
} from "./types";

interface SaltDefinition {
  name: string;
  saltWeight: number;
  category: string;
  reason: string;
}

interface SaltHit extends DeckSaltCard {
  exposureWeight: number;
}

const HIGH_SALT_CARDS: SaltDefinition[] = [
  defineSalt("Stasis", 4, "Lock Piece", "Locks normal untap patterns and often stalls the table."),
  defineSalt("Winter Orb", 3.9, "Resource Denial", "Restricts mana development for the whole table."),
  defineSalt("Static Orb", 3.8, "Resource Denial", "Restricts untaps and slows normal game actions."),
  defineSalt("The Tabernacle at Pendrell Vale", 3.8, "Resource Denial", "Taxes creature boards extremely hard."),
  defineSalt("Armageddon", 3.8, "Mass Land Denial", "Destroys all lands and can reset the table's mana."),
  defineSalt("Ravages of War", 3.8, "Mass Land Denial", "Destroys all lands and can reset the table's mana."),
  defineSalt("Jokulhaups", 3.7, "Mass Reset", "Removes lands and other core resources at once."),
  defineSalt("Obliterate", 3.7, "Mass Reset", "Removes lands and other core resources at once."),
  defineSalt("Apocalypse", 3.7, "Mass Reset", "Exiles hands, battlefields, and graveyards at once."),
  defineSalt("Sunder", 3.5, "Mass Land Denial", "Returns all lands and can lock players out of tempo."),
  defineSalt("Vorinclex, Voice of Hunger", 3.6, "Resource Denial", "Doubles your mana while locking down opposing lands."),
  defineSalt("Tergrid, God of Fright", 3.6, "Punisher Engine", "Turns discard and sacrifice into stolen permanents."),
  defineSalt("Jin-Gitaxias, Core Augur", 3.5, "Hand Lock", "Refills you while stripping opposing hands."),
  defineSalt("Sen Triplets", 3.5, "Theft/Control", "Lets one player use another player's hand and restricts interaction windows."),
  defineSalt("Mindslaver", 3.4, "Turn Control", "Lets one player control another player's turn."),
  defineSalt("Emrakul, the Promised End", 3.2, "Turn Control", "Can take over an opponent's turn and disrupt their own board."),
  defineSalt("Grand Arbiter Augustin IV", 3.4, "Tax/Stax", "Taxes opponents and slows spell sequencing."),
  defineSalt("Humility", 3.4, "Lock Piece", "Turns off creature text and compresses board identity."),
  defineSalt("Knowledge Pool", 3.3, "Cast Lock", "Can lock normal casting when paired with cast restriction pieces."),
  defineSalt("Teferi, Time Raveler", 3.1, "Timing Lock", "Restricts opponents to sorcery-speed interaction."),
  defineSalt("Decree of Silence", 3.1, "Lock Piece", "Can shut down several opposing spells in a row."),
  defineSalt("Drannith Magistrate", 3.3, "Lock Piece", "Blocks commanders and many cast-from-zone plans."),
  defineSalt("Gaddock Teeg", 3, "Cast Lock", "Restricts large noncreature spells and many sweepers."),
  defineSalt("Opposition Agent", 3.2, "Search Hate", "Punishes tutors and fetch-style sequencing."),
  defineSalt("Ashiok, Dream Render", 2.8, "Search Hate", "Turns off searching while pressuring graveyards."),
  defineSalt("Narset, Parter of Veils", 3.1, "Draw Lock", "Can lock draw-heavy tables out of extra cards."),
  defineSalt("Notion Thief", 3.1, "Draw Punisher", "Steals opposing draw bursts."),
  defineSalt("Sheoldred, the Apocalypse", 2.8, "Draw Punisher", "Turns normal draw patterns into life pressure."),
  defineSalt("Thassa's Oracle", 3.2, "Fast Combo", "Represents compact win lines with low table counterplay windows."),
  defineSalt("Demonic Consultation", 3.1, "Fast Combo", "Enables compact win lines with Thassa's Oracle."),
  defineSalt("Tainted Pact", 3.1, "Fast Combo", "Enables compact win lines with Thassa's Oracle."),
  defineSalt("Ad Nauseam", 3.2, "Fast Combo", "Enables explosive protected combo turns."),
  defineSalt("Underworld Breach", 3, "Combo Engine", "Enables compact graveyard combo turns."),
  defineSalt("Cyclonic Rift", 2.9, "Asymmetric Reset", "Resets opposing boards while preserving yours."),
  defineSalt("Expropriate", 2.9, "Extra Turns", "Combines extra turns with permanent theft."),
  defineSalt("Blatant Thievery", 2.8, "Theft/Control", "Takes important permanents from every opponent."),
  defineSalt("Agent of Treachery", 2.7, "Theft/Control", "Steals key permanents and can be blinked or copied."),
  defineSalt("Time Stretch", 2.8, "Extra Turns", "Creates back-to-back extra turns."),
  defineSalt("Nexus of Fate", 2.8, "Extra Turns", "Can create repeated extra-turn pressure."),
  defineSalt("Rhystic Study", 2.7, "Taxed Draw", "Creates constant table tax decisions."),
  defineSalt("Smothering Tithe", 2.7, "Taxed Mana", "Turns opposing draws into large mana bursts."),
  defineSalt("The One Ring", 2.6, "Protection/Draw Engine", "Adds protection and snowballing card advantage."),
  defineSalt("Consecrated Sphinx", 2.6, "Draw Engine", "Can overwhelm the table if unanswered."),
  defineSalt("Field of the Dead", 2.4, "Value Engine", "Generates repeatable board pressure from lands."),
  defineSalt("Seedborn Muse", 2.4, "Untap Engine", "Lets the deck act on every player's turn."),
  defineSalt("Farewell", 2.3, "Exile Sweeper", "Exiles several resource types at once."),
];

const HIGH_SALT_BY_NAME = new Map(
  HIGH_SALT_CARDS.map((entry) => [normalizeLookupKey(entry.name), entry]),
);

export function analyzeDeckSalt(document: DeckResolutionDocument): DeckSaltAnalysis {
  const deckCards = document.result.resolvedCards.filter(isSaltRelevantSection);
  const saltHits = deckCards
    .map(detectSaltHit)
    .filter((card): card is SaltHit => card !== null)
    .sort(compareSaltCards);
  const topCards: DeckSaltCard[] = saltHits.map(({ exposureWeight, ...card }) => card);
  const totalSaltWeight = roundOne(topCards.reduce(
    (sum, card) => sum + card.saltWeight * card.quantity,
    0,
  ));
  const highSaltCount = topCards.reduce(
    (sum, card) => sum + (card.saltWeight >= 3 ? card.quantity : 0),
    0,
  );
  const saltScore = calculateSaltScore(saltHits);
  const saltLevel = getSaltLevel(saltScore);
  const mainSource = getMainSaltSource(topCards);
  const findings = buildSaltFindings({
    saltScore,
    highSaltCount,
    totalSaltWeight,
    topCards,
    mainSource,
  });

  return {
    summary: summarizeSalt(saltScore, saltLevel, topCards, mainSource),
    saltScore,
    saltLevel,
    totalSaltWeight,
    highSaltCount,
    mainSource,
    topCards: topCards.slice(0, 8),
    findings,
  };
}

function defineSalt(
  name: string,
  saltWeight: number,
  category: string,
  reason: string,
): SaltDefinition {
  return {
    name,
    saltWeight,
    category,
    reason,
  };
}

function isSaltRelevantSection(card: { section: DeckSection }) {
  return card.section === "commander" || card.section === "mainboard" || card.section === "companion";
}

function detectSaltHit(card: {
  card: ScryfallCard;
  quantity: number;
  section: DeckSection;
}): SaltHit | null {
  const exact = findExactSaltDefinition(card.card);
  const heuristic = detectHeuristicSalt(card.card);
  const best = chooseStrongerSaltDefinition(exact, heuristic);

  if (!best) {
    return null;
  }

  return {
    name: card.card.name,
    quantity: card.quantity,
    section: card.section,
    saltWeight: best.saltWeight,
    category: best.category,
    reason: best.reason,
    exposureWeight:
      best.saltWeight *
      Math.sqrt(Math.max(1, card.quantity)) *
      getSaltExposureMultiplier(card.card, card.section),
  };
}

function findExactSaltDefinition(card: ScryfallCard): SaltDefinition | null {
  for (const alias of getCardAliases(card)) {
    const definition = HIGH_SALT_BY_NAME.get(alias);
    if (definition) {
      return definition;
    }
  }

  return null;
}

function detectHeuristicSalt(card: ScryfallCard): SaltDefinition | null {
  const text = getOracleText(card);
  const typeLine = getTypeLine(card);
  const name = card.name;

  if (/\bdestroy all lands\b|\bexile all lands\b|\breturn all lands\b/.test(text)) {
    return defineSalt(
      name,
      3.4,
      "Mass Land Denial",
      "Mass land denial often creates high table frustration even when it is strategically correct.",
    );
  }

  if (/\b(players?|opponents?) can't untap\b|\bskip (their|your|that player's) untap step\b/.test(text)) {
    return defineSalt(
      name,
      3.2,
      "Lock Piece",
      "Untap denial can prevent players from taking normal game actions.",
    );
  }

  if (/\bcan't cast spells? from anywhere other than their hands\b|\bcan't cast spells? from graveyards\b/.test(text)) {
    return defineSalt(
      name,
      2.9,
      "Lock Piece",
      "Cast restriction attacks commanders, graveyard plans, and alternate zones.",
    );
  }

  if (/\bcan't search librar/.test(text)) {
    return defineSalt(
      name,
      2.8,
      "Search Hate",
      "Search denial can blank tutors, fetch lands, and ramp lines.",
    );
  }

  if (/\bcan't draw more than one card\b|\bif an opponent would draw.*instead\b/.test(text)) {
    return defineSalt(
      name,
      2.8,
      "Draw Lock",
      "Draw restriction or replacement effects can shut off normal card flow.",
    );
  }

  if (/\bwhenever an opponent draws a card\b.*\bcreate.*treasure\b/.test(text)) {
    return defineSalt(
      name,
      2.5,
      "Taxed Mana",
      "Draw-tax mana engines can snowball from normal table actions.",
    );
  }

  if (/\bwhenever an opponent casts a spell\b.*\b(draw a card|pay \{1\})\b/.test(text)) {
    return defineSalt(
      name,
      2.5,
      "Taxed Draw",
      "Spell-tax draw engines create repeated tax decisions.",
    );
  }

  if (/\btakes? an extra turn\b/.test(text)) {
    return defineSalt(
      name,
      typeLine.includes("Sorcery") || typeLine.includes("Instant") ? 2.2 : 2.5,
      "Extra Turns",
      "Extra-turn effects can compress table agency if chained or copied.",
    );
  }

  if (/\bcan't activate abilities\b/.test(text)) {
    return defineSalt(
      name,
      2.2,
      "Ability Hate",
      "Activated-ability denial can shut off large parts of some decks.",
    );
  }

  if (/\bcontrol target player\b|\byou control (that|target) player\b/.test(text)) {
    return defineSalt(
      name,
      3,
      "Turn Control",
      "Controlling another player's decisions tends to create high social friction.",
    );
  }

  if (/\bgain control of target\b|\bgain control of (up to )?one target\b/.test(text)) {
    return defineSalt(
      name,
      2.5,
      "Theft/Control",
      "Permanent theft can create more table frustration than ordinary removal.",
    );
  }

  if (/\beach opponent discards\b|\btarget opponent discards (their|his or her) hand\b/.test(text)) {
    return defineSalt(
      name,
      2.5,
      "Discard Pressure",
      "Repeatable or broad discard can make players feel locked out of the game.",
    );
  }

  return null;
}

function chooseStrongerSaltDefinition(
  left: SaltDefinition | null,
  right: SaltDefinition | null,
) {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return left.saltWeight >= right.saltWeight ? left : right;
}

function calculateSaltScore(saltHits: SaltHit[]) {
  const exposurePressure = saltHits.reduce((sum, card) => sum + card.exposureWeight, 0);
  const categoryPressure = [...getSaltCategoryExposure(saltHits).values()].reduce(
    (sum, exposure) => sum + Math.sqrt(exposure),
    0,
  );
  const pressure = exposurePressure + categoryPressure * 0.45;

  return Math.min(100, Math.round(100 * (1 - Math.exp(-pressure / 13))));
}

function getSaltExposureMultiplier(card: ScryfallCard, section: DeckSection) {
  const manaValue = Number.isFinite(card.cmc) ? card.cmc : 0;
  const manaAccess =
    manaValue <= 2
      ? 1
      : manaValue <= 3
        ? 0.92
        : manaValue <= 4
          ? 0.82
          : manaValue <= 5
            ? 0.7
            : manaValue <= 6
              ? 0.58
              : 0.45;
  const sectionAccess =
    section === "commander"
      ? 1.25
      : section === "companion"
        ? 0.9
        : 1;

  return manaAccess * sectionAccess;
}

function getSaltCategoryExposure(cards: SaltHit[]) {
  const byCategory = new Map<string, number>();
  for (const card of cards) {
    byCategory.set(card.category, (byCategory.get(card.category) ?? 0) + card.exposureWeight);
  }

  return byCategory;
}

function getSaltLevel(score: number) {
  if (score >= 75) {
    return "extreme";
  }

  if (score >= 50) {
    return "high";
  }

  if (score >= 25) {
    return "medium";
  }

  return "low";
}

function getMainSaltSource(cards: DeckSaltCard[]) {
  if (cards.length === 0) {
    return "Low";
  }

  const byCategory = new Map<string, number>();
  for (const card of cards) {
    byCategory.set(card.category, (byCategory.get(card.category) ?? 0) + card.saltWeight * card.quantity);
  }

  return [...byCategory.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? "Mixed";
}

function summarizeSalt(
  saltScore: number,
  saltLevel: DeckSaltAnalysis["saltLevel"],
  topCards: DeckSaltCard[],
  mainSource: string,
) {
  if (saltLevel === "low") {
    return "Table salt looks low. The deck does not lean on many commonly disliked pressure pieces.";
  }

  const leadCards = topCards.slice(0, 3).map((card) => card.name).join(", ");
  const sourceText = mainSource === "Mixed" ? "mixed pressure pieces" : mainSource.toLowerCase();
  return `Table salt reads ${saltLevel} at ${saltScore}/100, mostly from ${sourceText}${leadCards ? ` (${leadCards})` : ""}. This is social pressure, not raw power.`;
}

function buildSaltFindings(input: {
  saltScore: number;
  highSaltCount: number;
  totalSaltWeight: number;
  topCards: DeckSaltCard[];
  mainSource: string;
}): DeckStructureFinding[] {
  const findings: DeckStructureFinding[] = [];

  if (input.saltScore >= 75) {
    findings.push({
      code: "salt_extreme",
      title: "Very high table salt",
      status: "risk",
      message: `${input.highSaltCount} high-salt card${input.highSaltCount === 1 ? "" : "s"} and ${input.totalSaltWeight.toFixed(1)} total salt weight may make the deck feel oppressive before the power score tells the full story.`,
    });
  } else if (input.saltScore >= 50) {
    findings.push({
      code: "salt_high",
      title: "High table salt",
      status: "warning",
      message: `${input.highSaltCount} high-salt card${input.highSaltCount === 1 ? "" : "s"} push social pressure up. The main source is ${input.mainSource}.`,
    });
  } else if (input.saltScore >= 25) {
    findings.push({
      code: "salt_medium",
      title: "Some table salt",
      status: "note",
      message: "A few cards may draw extra attention, but the deck is not heavily built around high-friction play patterns.",
    });
  } else {
    findings.push({
      code: "salt_low",
      title: "Low table salt",
      status: "good",
      message: "No major high-salt package stands out from the resolved decklist.",
    });
  }

  const topCard = input.topCards[0];
  if (topCard) {
    findings.push({
      code: "salt_top_card",
      title: `Saltiest card: ${topCard.name}`,
      status: topCard.saltWeight >= 3 ? "warning" : "note",
      message: `${topCard.category}: ${topCard.reason}`,
    });
  }

  return findings;
}

function compareSaltCards(left: DeckSaltCard, right: DeckSaltCard) {
  return (
    right.saltWeight * right.quantity -
      left.saltWeight * left.quantity ||
    right.saltWeight - left.saltWeight ||
    left.name.localeCompare(right.name)
  );
}

function getCardAliases(card: ScryfallCard) {
  return [
    card.name,
    ...(card.card_faces ?? []).map((face) => face.name),
    ...card.name.split("//"),
  ]
    .map((name) => normalizeLookupKey(name))
    .filter(Boolean);
}

function getOracleText(card: ScryfallCard) {
  return [
    card.oracle_text,
    ...(card.card_faces ?? []).map((face) => face.oracle_text ?? ""),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function getTypeLine(card: ScryfallCard) {
  return [
    card.type_line,
    ...(card.card_faces ?? []).map((face) => face.type_line ?? ""),
  ]
    .filter(Boolean)
    .join(" ");
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
