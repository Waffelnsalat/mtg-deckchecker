import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckConsistency } from "./consistencyAnalysis";
import {
  DeckDrawAnalysis,
  DeckResolutionDocument,
  DeckSection,
  DeckStrategyAnalysis,
  DeckWinConditionAnalysis,
  ResolvedDeckCard,
  ScryfallCard,
} from "./types";

test("analyzeDeckConsistency classifies direct, restricted, repeatable, and land tutors", () => {
  const analysis = analyzeDeckConsistency(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Tutor Commander",
        "Legendary Creature - Human Wizard",
        3,
        "Draw a card.",
        { color_identity: ["B", "G"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Demonic Tutor",
        "Sorcery",
        2,
        "Search your library for a card, put that card into your hand, then shuffle.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Eladamri's Call",
        "Instant",
        2,
        "Search your library for a creature card, reveal it, put it into your hand, then shuffle.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Expedition Map",
        "Artifact",
        1,
        "{2}, {T}, Sacrifice Expedition Map: Search your library for a land card, reveal it, put it into your hand, then shuffle.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Survival of the Fittest",
        "Enchantment",
        2,
        "{G}, Discard a creature card: Search your library for a creature card, reveal it, put it into your hand, then shuffle.",
      ),
      createResolvedCard("mainboard", 95, "Forest", "Basic Land - Forest", 0, ""),
    ]),
  );

  assert.ok(analysis.counts.direct > 0);
  assert.ok(analysis.counts.restricted > 0);
  assert.ok(analysis.counts.land > 0);
  assert.ok(analysis.counts.repeatable > 0);
});

test("analyzeDeckConsistency boosts commanders that tutor", () => {
  const commanderAnalysis = analyzeDeckConsistency(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Zur Style Commander",
        "Legendary Creature - Human Wizard",
        4,
        "Whenever Zur Style Commander attacks, search your library for an enchantment card with mana value 3 or less and put it onto the battlefield, then shuffle.",
        { color_identity: ["W", "U", "B"] },
      ),
      createResolvedCard("mainboard", 99, "Island", "Basic Land - Island", 0, ""),
    ]),
  );

  const mainboardAnalysis = analyzeDeckConsistency(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Value Commander",
        "Legendary Creature - Human Wizard",
        4,
        "Draw a card.",
        { color_identity: ["W", "U", "B"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Zur Style Commander",
        "Creature - Human Wizard",
        4,
        "Whenever Zur Style Commander attacks, search your library for an enchantment card with mana value 3 or less and put it onto the battlefield, then shuffle.",
      ),
      createResolvedCard("mainboard", 98, "Island", "Basic Land - Island", 0, ""),
    ]),
  );

  assert.ok(commanderAnalysis.counts.restricted > mainboardAnalysis.counts.restricted);
  assert.ok(commanderAnalysis.counts.repeatable > mainboardAnalysis.counts.repeatable);
});

test("analyzeDeckConsistency counts library dig into hand or battlefield as restricted access", () => {
  const analysis = analyzeDeckConsistency(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Golgari Commander",
        "Legendary Creature - Druid",
        3,
        "Whenever you cast a creature spell, you gain 1 life.",
        { color_identity: ["B", "G"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Mill Pick Style",
        "Instant",
        2,
        "Mill three cards. You may put a creature or land card from among the cards milled this way into your hand.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Battlefield Pick Style",
        "Sorcery",
        4,
        "Look at the top five cards of your library. You may put a creature card from among them onto the battlefield.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Reveal Until Style",
        "Enchantment",
        4,
        "Whenever you attack, reveal cards from the top of your library until you reveal a creature card. Put that card onto the battlefield.",
      ),
      createResolvedCard("mainboard", 96, "Forest", "Basic Land - Forest", 0, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Mill Pick Style")?.has("restricted_tutor"));
  assert.ok(labels.get("Battlefield Pick Style")?.has("restricted_tutor"));
  assert.ok(labels.get("Reveal Until Style")?.has("restricted_tutor"));
  assert.ok(labels.get("Reveal Until Style")?.has("repeatable_tutor"));
  assert.ok(analysis.counts.restricted > 1);
});

test("analyzeDeckConsistency raises tutor expectations for combo colors and plans", () => {
  const redAggro = analyzeDeckConsistency(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Red Aggro Commander",
        "Legendary Creature - Warrior",
        3,
        "Whenever Red Aggro Commander attacks, it gets +1/+0 until end of turn.",
        { color_identity: ["R"] },
      ),
      createResolvedCard("mainboard", 99, "Mountain", "Basic Land - Mountain", 0, ""),
    ]),
    {
      strategy: createStrategyStub("aggro"),
    },
  );

  const dimirCombo = analyzeDeckConsistency(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Dimir Combo Commander",
        "Legendary Creature - Wizard",
        3,
        "Draw a card.",
        { color_identity: ["U", "B"] },
      ),
      createResolvedCard("mainboard", 99, "Island", "Basic Land - Island", 0, ""),
    ]),
    {
      strategy: createStrategyStub("combo"),
      winConditions: createWinConditionStub(1),
    },
  );

  assert.ok(dimirCombo.recommendations.directTarget > redAggro.recommendations.directTarget);
  assert.ok(dimirCombo.recommendations.coreTarget > redAggro.recommendations.coreTarget);
});

test("analyzeDeckConsistency uses card-flow access as a small consistency backfill", () => {
  const withoutDraw = analyzeDeckConsistency(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Selection Commander",
        "Legendary Creature - Wizard",
        3,
        "Draw a card.",
        { color_identity: ["U", "R"] },
      ),
      createResolvedCard("mainboard", 99, "Island", "Basic Land - Island", 0, ""),
    ]),
  );

  const withDraw = analyzeDeckConsistency(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Selection Commander",
        "Legendary Creature - Wizard",
        3,
        "Draw a card.",
        { color_identity: ["U", "R"] },
      ),
      createResolvedCard("mainboard", 99, "Island", "Basic Land - Island", 0, ""),
    ]),
    {
      draw: createDrawStub(6, 2),
    },
  );

  assert.equal(withoutDraw.counts.selectionSupport, 0);
  assert.ok(withDraw.counts.selectionSupport > 0);
  assert.ok(withDraw.counts.core > withoutDraw.counts.core);
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

function createDrawStub(selection: number, repeatable: number): DeckDrawAnalysis {
  return {
    drawScore: 0,
    summary: "",
    counts: {
      core: 0,
      draw: 0,
      selection,
      repeatable,
    },
    recommendations: {
      coreTarget: 0,
      drawTarget: 0,
      repeatableTarget: 0,
    },
    findings: [],
    taggedCards: [],
  };
}

function createStrategyStub(key: NonNullable<DeckStrategyAnalysis["mainStrategy"]>["key"]): DeckStrategyAnalysis {
  return {
    summary: "",
    mainStrategy: {
      key,
      label: key,
      score: 0,
      rawScore: 0,
      confidence: 0,
      keyCards: [],
      reasons: [],
    },
    subStrategies: [],
    topStrategies: [],
    synergy: null,
    perspectives: [],
  };
}

function createWinConditionStub(exactCount: number): DeckWinConditionAnalysis {
  return {
    finisherScore: 0,
    summary: "",
    counts: {
      core: 0,
      combat: 0,
      direct: 0,
      alternate: 0,
      repeatable: 0,
      combo: 0,
    },
    recommendations: {
      coreTarget: 0,
      combatTarget: 0,
      directTarget: 0,
    },
    findings: [],
    taggedCards: [],
    combos: {
      source: "Commander Spellbook",
      lookupStatus: "ok",
      exactCount,
      finisherCount: 0,
      engineCount: exactCount,
      nearMissCount: 0,
      exact: [],
    },
  };
}
