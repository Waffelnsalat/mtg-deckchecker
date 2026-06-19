import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckStructure } from "./deckAnalysis";
import { DeckResolutionDocument, DeckSection, ResolvedDeckCard, ScryfallCard } from "./types";

test("analyzeDeckStructure reports a healthy baseline shell", () => {
  const document = createDocument([
    createResolvedCard("commander", 1, "Balanced Commander", "Legendary Creature — Human", 3),
    createResolvedCard("mainboard", 36, "Basic Plains", "Basic Land — Plains", 0),
    createResolvedCard("mainboard", 24, "Baseline Creature", "Creature — Soldier", 2),
    createResolvedCard("mainboard", 18, "Cheap Spell", "Instant", 2),
    createResolvedCard("mainboard", 12, "Support Piece", "Artifact", 4),
    createResolvedCard("mainboard", 9, "Top End", "Sorcery", 6),
  ]);

  const analysis = analyzeDeckStructure(document);

  assert.equal(analysis.counts.lands, 36);
  assert.equal(analysis.counts.creatures, 25);
  assert.equal(analysis.mana.averageManaValue, 2.95);
  assert.equal(analysis.mana.recommendedLands.target, 35);
  assert.equal(analysis.findings[0].status, "good");
  assert.equal(analysis.findings[1].status, "good");
  assert.ok(analysis.structureScore >= 80);
});

test("analyzeDeckStructure flags decks that are short on lands and too top-heavy", () => {
  const document = createDocument([
    createResolvedCard("commander", 1, "Expensive Commander", "Legendary Creature — Dragon", 5),
    createResolvedCard("mainboard", 32, "Basic Mountain", "Basic Land — Mountain", 0),
    createResolvedCard("mainboard", 10, "Big Creature", "Creature — Giant", 4),
    createResolvedCard("mainboard", 40, "Huge Spell", "Sorcery", 5),
    createResolvedCard("mainboard", 17, "Clunky Artifact", "Artifact", 6),
  ]);

  const analysis = analyzeDeckStructure(document);

  assert.equal(analysis.counts.creatures, 11);
  assert.equal(analysis.findings[0].code, "land_count_low");
  assert.equal(analysis.findings[0].status, "risk");
  assert.equal(analysis.findings[1].code, "creature_count_very_low");
  assert.equal(analysis.findings[2].code, "curve_top_heavy");
  assert.ok(analysis.structureScore < 50);
});

test("analyzeDeckStructure softens creature expectations for blue spell shells", () => {
  const document = createDocument([
    createResolvedCard(
      "commander",
      1,
      "Blue Commander",
      "Legendary Creature - Wizard",
      3,
      { color_identity: ["U"] },
    ),
    createResolvedCard("mainboard", 35, "Basic Island", "Basic Land - Island", 0),
    createResolvedCard("mainboard", 10, "Utility Creature", "Creature - Wizard", 2),
    createResolvedCard("mainboard", 28, "Instant Shell", "Instant", 2),
    createResolvedCard("mainboard", 26, "Artifact Shell", "Artifact", 2),
  ]);

  const analysis = analyzeDeckStructure(document);

  assert.equal(analysis.findings[1].code, "creature_count_low");
  assert.equal(analysis.findings[1].status, "note");
  assert.ok(analysis.structureScore > 55);
});

test("analyzeDeckStructure uses effective casting costs for self-reduced spells", () => {
  const document = createDocument([
    createResolvedCard("commander", 1, "Red Commander", "Legendary Creature - Warrior", 3),
    createResolvedCard("mainboard", 35, "Basic Mountain", "Basic Land - Mountain", 0),
    createResolvedCard("mainboard", 44, "Cheap Spell", "Instant", 2),
    createResolvedCard("mainboard", 20, "Blasphemous Act", "Sorcery", 9, {
      oracle_text: "This spell costs {1} less to cast for each creature on the battlefield.",
    }),
  ]);

  const analysis = analyzeDeckStructure(document);

  assert.ok(analysis.mana.averageManaValue < 3.1);
  assert.ok(analysis.mana.curve.sixPlus < 20);
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
  overrides: Partial<ScryfallCard> = {},
): ResolvedDeckCard {
  const card: ScryfallCard = {
    id: `${name}-${section}`,
    name,
    cmc,
    type_line: typeLine,
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
