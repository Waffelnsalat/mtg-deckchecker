import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckGameChangers } from "./gameChangerAnalysis";
import { DeckResolutionDocument, DeckSection, ResolvedDeckCard, ScryfallCard } from "./types";

test("analyzeDeckGameChangers counts commander, mainboard, and companion game changers", () => {
  const analysis = analyzeDeckGameChangers(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Grand Arbiter Augustin IV",
        "Legendary Creature - Human Advisor",
        4,
      ),
      createResolvedCard("mainboard", 1, "Mana Vault", "Artifact", 1),
      createResolvedCard("mainboard", 1, "Farewell", "Sorcery", 6),
      createResolvedCard("companion", 1, "Umori, the Collector", "Legendary Creature - Ooze", 4),
      createResolvedCard("mainboard", 96, "Island", "Basic Land - Island", 0),
    ]),
  );

  assert.equal(analysis.counts.total, 3);
  assert.equal(analysis.counts.unique, 3);
  assert.equal(analysis.counts.commander, 1);
  assert.equal(analysis.counts.mainboard, 2);
  assert.equal(analysis.counts.companion, 0);
  assert.equal(analysis.bracket.bracketOneTwoLegal, false);
  assert.equal(analysis.bracket.bracketThreeLegal, true);
});

test("analyzeDeckGameChangers tracks bracket thresholds", () => {
  const clean = analyzeDeckGameChangers(
    createDocument([
      createResolvedCard("commander", 1, "Value Commander", "Legendary Creature - Wizard", 3),
      createResolvedCard("mainboard", 99, "Island", "Basic Land - Island", 0),
    ]),
  );

  const capped = analyzeDeckGameChangers(
    createDocument([
      createResolvedCard("commander", 1, "Grand Arbiter Augustin IV", "Legendary Creature - Human Advisor", 4),
      createResolvedCard("mainboard", 1, "Mana Vault", "Artifact", 1),
      createResolvedCard("mainboard", 1, "The One Ring", "Legendary Artifact", 4),
      createResolvedCard("mainboard", 97, "Island", "Basic Land - Island", 0),
    ]),
  );

  const overCap = analyzeDeckGameChangers(
    createDocument([
      createResolvedCard("commander", 1, "Grand Arbiter Augustin IV", "Legendary Creature - Human Advisor", 4),
      createResolvedCard("mainboard", 1, "Mana Vault", "Artifact", 1),
      createResolvedCard("mainboard", 1, "The One Ring", "Legendary Artifact", 4),
      createResolvedCard("mainboard", 1, "Farewell", "Sorcery", 6),
      createResolvedCard("mainboard", 96, "Island", "Basic Land - Island", 0),
    ]),
  );

  assert.equal(clean.bracket.bracketOneTwoLegal, true);
  assert.equal(clean.bracket.bracketThreeLegal, true);
  assert.equal(capped.bracket.bracketOneTwoLegal, false);
  assert.equal(capped.bracket.bracketThreeLegal, true);
  assert.equal(overCap.bracket.bracketThreeLegal, false);
  assert.equal(overCap.findings[0].code, "game_changers_over_cap");
});

test("analyzeDeckGameChangers matches front-face names on modal cards", () => {
  const analysis = analyzeDeckGameChangers(
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
      createResolvedCard("commander", 1, "Value Commander", "Legendary Creature - Wizard", 3),
      createResolvedCard("mainboard", 98, "Swamp", "Basic Land - Swamp", 0),
    ]),
  );

  assert.equal(analysis.counts.total, 1);
  assert.equal(analysis.taggedCards[0]?.matchedName, "Tergrid, God of Fright");
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
    id: `${name}-${section}`,
    name,
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    layout: "normal",
    scryfall_uri: "https://scryfall.com",
    ...overrides,
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
