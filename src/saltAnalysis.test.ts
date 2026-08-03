import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckSalt } from "./saltAnalysis";
import { DeckResolutionDocument, DeckSection, ResolvedDeckCard, ScryfallCard } from "./types";

test("analyzeDeckSalt stays low for straightforward low-friction decks", () => {
  const analysis = analyzeDeckSalt(
    createDocument([
      createResolvedCard("commander", 1, "Value Commander", "Legendary Creature - Wizard", 3),
      createResolvedCard("mainboard", 1, "Cultivate", "Sorcery", 3, "Search your library for basic lands."),
      createResolvedCard("mainboard", 1, "Solemn Simulacrum", "Artifact Creature - Golem", 4),
      createResolvedCard("mainboard", 37, "Forest", "Basic Land - Forest", 0),
    ]),
  );

  assert.equal(analysis.saltLevel, "low");
  assert.equal(analysis.highSaltCount, 0);
  assert.equal(analysis.topCards.length, 0);
  assert.equal(analysis.findings[0]?.status, "good");
});

test("analyzeDeckSalt detects known high-salt cards and summarizes the main source", () => {
  const analysis = analyzeDeckSalt(
    createDocument([
      createResolvedCard("commander", 1, "Grand Arbiter Augustin IV", "Legendary Creature - Human Advisor", 4),
      createResolvedCard("mainboard", 1, "Winter Orb", "Artifact", 2),
      createResolvedCard("mainboard", 1, "Static Orb", "Artifact", 3),
      createResolvedCard("mainboard", 1, "Rhystic Study", "Enchantment", 3),
      createResolvedCard("mainboard", 34, "Island", "Basic Land - Island", 0),
    ]),
  );

  assert.equal(analysis.saltLevel, "extreme");
  assert.equal(analysis.highSaltCount, 3);
  assert.equal(analysis.mainSource, "Resource Denial");
  assert.equal(analysis.topCards[0]?.name, "Winter Orb");
  assert.match(analysis.summary, /social pressure/i);
});

test("analyzeDeckSalt uses oracle text heuristics for salt patterns outside the local list", () => {
  const analysis = analyzeDeckSalt(
    createDocument([
      createResolvedCard("commander", 1, "Value Commander", "Legendary Creature - Wizard", 3),
      createResolvedCard("mainboard", 1, "Custom Reset", "Sorcery", 4, "Destroy all lands."),
      createResolvedCard(
        "mainboard",
        1,
        "Custom Time Spell",
        "Sorcery",
        5,
        "Target player takes an extra turn after this one.",
      ),
      createResolvedCard("mainboard", 35, "Island", "Basic Land - Island", 0),
    ]),
  );

  assert.equal(analysis.highSaltCount, 1);
  assert.equal(analysis.topCards[0]?.category, "Mass Land Denial");
  assert.ok(analysis.topCards.some((card) => card.category === "Extra Turns"));
});

test("analyzeDeckSalt matches front-face names on modal cards", () => {
  const analysis = analyzeDeckSalt(
    createDocument([
      createResolvedCard(
        "mainboard",
        1,
        "Tergrid, God of Fright // Tergrid's Lantern",
        "Legendary Creature - God",
        5,
        "",
        {
          layout: "modal_dfc",
          card_faces: [
            {
              name: "Tergrid, God of Fright",
              type_line: "Legendary Creature - God",
              oracle_text: "",
            },
            {
              name: "Tergrid's Lantern",
              type_line: "Legendary Artifact",
              oracle_text: "",
            },
          ],
        },
      ),
      createResolvedCard("mainboard", 38, "Swamp", "Basic Land - Swamp", 0),
    ]),
  );

  assert.equal(analysis.topCards[0]?.category, "Punisher Engine");
  assert.equal(analysis.highSaltCount, 1);
});

function createDocument(resolvedCards: ResolvedDeckCard[]): DeckResolutionDocument {
  return {
    format: "edh",
    parse: {
      entries: [],
      errors: [],
      warnings: [],
      totalCards: resolvedCards.reduce((sum, card) => sum + card.quantity, 0),
      uniqueCards: resolvedCards.length,
    },
    result: {
      resolvedCards,
      unresolvedCards: [],
      resolvedCount: resolvedCards.length,
      unresolvedCount: 0,
    },
  };
}

function createResolvedCard(
  section: DeckSection,
  quantity: number,
  name: string,
  typeLine: string,
  cmc: number,
  oracleText = "",
  overrides: Partial<ScryfallCard> = {},
): ResolvedDeckCard {
  const card: ScryfallCard = {
    id: `${name}-id`,
    name,
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    layout: "normal",
    ...overrides,
    scryfall_uri: `https://scryfall.com/search?q=${encodeURIComponent(name)}`,
  };

  return {
    quantity,
    section,
    requestedName: name,
    originalLine: `${quantity} ${name}`,
    lineNumber: 1,
    card,
  };
}
