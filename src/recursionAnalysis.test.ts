import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckRecursion } from "./recursionAnalysis";
import { DeckResolutionDocument, DeckSection, ResolvedDeckCard, ScryfallCard } from "./types";

test("analyzeDeckRecursion classifies battlefield, hand, replay, mass, and library recursion", () => {
  const analysis = analyzeDeckRecursion(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Shaman", 4, "", {
        color_identity: ["B", "G"],
      }),
      createResolvedCard(
        "mainboard",
        1,
        "Reanimate Style",
        "Sorcery",
        1,
        "Put target creature card from a graveyard onto the battlefield under your control. You lose life equal to its mana value.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Regrowth Style",
        "Sorcery",
        2,
        "Return target card from your graveyard to your hand.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Snapcaster Style",
        "Creature - Human Wizard",
        2,
        "When this creature enters, target instant or sorcery card in your graveyard gains flashback until end of turn. The flashback cost is equal to its mana cost.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Past in Flames Style",
        "Sorcery",
        4,
        "Each instant and sorcery card in your graveyard gains flashback until end of turn. The flashback cost is equal to its mana cost.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Living Death Style",
        "Sorcery",
        5,
        "Each player exiles all creature cards from their graveyard, then sacrifices all creatures they control, then puts all cards they exiled this way onto the battlefield.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Noxious Revival Style",
        "Instant",
        1,
        "Put target card from a graveyard on top of its owner's library.",
      ),
      createResolvedCard("mainboard", 93, "Filler Spell", "Creature - Elf", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Reanimate Style")?.has("battlefield_recursion"));
  assert.ok(labels.get("Regrowth Style")?.has("hand_recursion"));
  assert.ok(labels.get("Snapcaster Style")?.has("replay_recursion"));
  assert.ok(labels.get("Past in Flames Style")?.has("replay_recursion"));
  assert.ok(labels.get("Living Death Style")?.has("mass_recursion"));
  assert.ok(labels.get("Living Death Style")?.has("battlefield_recursion"));
  assert.ok(labels.get("Noxious Revival Style")?.has("library_recursion"));
  assert.ok(analysis.counts.battlefield > 0);
  assert.ok(analysis.counts.hand > 0);
  assert.ok(analysis.counts.replay > 0);
  assert.ok(analysis.counts.mass > 0);
  assert.ok(analysis.counts.library > 0);
});

test("analyzeDeckRecursion does not count self-contained flashback as deck recursion", () => {
  const analysis = analyzeDeckRecursion(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Shaman", 4, "", {
        color_identity: ["B", "R"],
      }),
      createResolvedCard(
        "mainboard",
        1,
        "Faithless Looting Style",
        "Sorcery",
        1,
        "Draw two cards, then discard two cards. Flashback {2}{R}.",
        { keywords: ["Flashback"] },
      ),
      createResolvedCard("mainboard", 98, "Filler Spell", "Creature - Goblin", 2, ""),
    ]),
  );

  assert.ok(!analysis.taggedCards.some((card) => card.name === "Faithless Looting Style"));
  assert.equal(analysis.counts.replay, 0);
});

test("analyzeDeckRecursion catches ongoing graveyard replay effects", () => {
  const analysis = analyzeDeckRecursion(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Elemental", 6, "", {
        color_identity: ["B", "G", "U"],
      }),
      createResolvedCard(
        "mainboard",
        1,
        "Muldrotha Style",
        "Legendary Creature - Elemental Avatar",
        6,
        "During each of your turns, you may play up to one permanent card of each permanent type from your graveyard.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Crucible Style",
        "Artifact",
        3,
        "You may play lands from your graveyard.",
      ),
      createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Muldrotha Style")?.has("replay_recursion"));
  assert.ok(labels.get("Crucible Style")?.has("replay_recursion"));
});

test("analyzeDeckRecursion ignores ordinary non-recursion cards", () => {
  const analysis = analyzeDeckRecursion(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Human", 3),
      createResolvedCard("mainboard", 50, "Bear", "Creature - Bear", 2, ""),
      createResolvedCard(
        "mainboard",
        49,
        "Removal Spell",
        "Instant",
        2,
        "Destroy target creature.",
      ),
    ]),
  );

  assert.equal(analysis.taggedCards.length, 0);
  assert.ok(analysis.recursionScore <= 40);
});

test("analyzeDeckRecursion boosts commander recursion roles", () => {
  const analysis = analyzeDeckRecursion(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Meren Style",
        "Legendary Creature - Human Shaman",
        4,
        "At the beginning of your end step, return target creature card from your graveyard to your hand.",
        { color_identity: ["B", "G"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Recovery Creature",
        "Creature - Human Shaman",
        4,
        "At the beginning of your end step, return target creature card from your graveyard to your hand.",
      ),
      createResolvedCard("mainboard", 98, "Filler Spell", "Creature - Elf", 2, ""),
    ]),
  );

  const commander = analysis.taggedCards.find((card) => card.name === "Meren Style");
  const mainboard = analysis.taggedCards.find((card) => card.name === "Recovery Creature");

  assert.ok((commander?.recursionValue ?? 0) > (mainboard?.recursionValue ?? 0));
});

test("analyzeDeckRecursion keeps heavier recursion targets for recursive colors", () => {
  const gruul = analyzeDeckRecursion(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Gruul Commander",
        "Legendary Creature - Warrior",
        4,
        "",
        { color_identity: ["R", "G"] },
      ),
      createResolvedCard("mainboard", 99, "Filler Spell", "Creature - Elf", 2, ""),
    ]),
  );

  const colorless = analyzeDeckRecursion(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Colorless Commander",
        "Legendary Artifact Creature - Construct",
        4,
        "",
        { color_identity: [] },
      ),
      createResolvedCard("mainboard", 99, "Filler Spell", "Artifact", 2, ""),
    ]),
  );

  assert.ok(gruul.recommendations.coreTarget > colorless.recommendations.coreTarget);
  assert.ok(gruul.recommendations.replayTarget >= colorless.recommendations.replayTarget);
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
