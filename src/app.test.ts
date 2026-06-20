import assert from "node:assert/strict";
import test from "node:test";
import { buildAnalysisSources } from "./app";

test("buildAnalysisSources marks unresolved cards and unavailable services as limited", () => {
  const sources = buildAnalysisSources({
    document: createDocument({ unresolvedCount: 1, mainboardCount: 6 }),
    validation: { isValid: true, issues: [] },
    edhrec: null,
    recommander: null,
    recommendations: {
      summary: "Test recommendations.",
      topics: [],
    },
    winConditions: {
      finisherScore: 0,
      summary: "No finishers.",
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
        lookupStatus: "unavailable",
        error: "timeout",
        exactCount: 0,
        finisherCount: 0,
        engineCount: 0,
        nearMissCount: 0,
        exact: [],
      },
    },
  });

  assert.equal(sources.scryfall.status, "partial");
  assert.equal(sources.edhrec.status, "failed");
  assert.equal(sources.commanderSpellbook.status, "failed");
  assert.equal(sources.recommander.status, "failed");
});

test("buildAnalysisSources reports ready optional sources when data is present", () => {
  const sources = buildAnalysisSources({
    document: createDocument({ unresolvedCount: 0, mainboardCount: 6 }),
    validation: { isValid: true, issues: [] },
    edhrec: {
      source: "EDHREC",
      url: "https://edhrec.com/commanders/test-commander",
      pageLabel: "All",
      commanderNames: ["Test Commander"],
      deckCount: 10,
      themes: [],
      lists: [{ header: "Top Cards", tag: "topcards", cards: [] }],
      cardsByName: new Map(),
    },
    recommander: {
      source: "Recommander",
      url: "https://api.recommander.cards/public-release/api/decks/recommend/top",
      commanderName: "Test Commander",
      partnerName: null,
      cards: [],
      cardsByName: new Map(),
    },
    recommendations: {
      summary: "Test recommendations.",
      topics: [],
    },
    winConditions: {
      finisherScore: 0,
      summary: "No finishers.",
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
        exactCount: 0,
        finisherCount: 0,
        engineCount: 0,
        nearMissCount: 0,
        exact: [],
      },
    },
  });

  assert.equal(sources.scryfall.status, "ok");
  assert.equal(sources.edhrec.status, "ok");
  assert.equal(sources.commanderSpellbook.status, "ok");
  assert.equal(sources.recommander.status, "ok");
});

function createDocument(input: { unresolvedCount: number; mainboardCount: number }) {
  return {
    format: "edh",
    parse: {
      entries: [],
      errors: [],
      warnings: [],
      totalCards: input.mainboardCount + 1,
      uniqueCards: input.mainboardCount + 1,
    },
    result: {
      resolvedCards: [
        createResolvedCard("Test Commander", "commander"),
        ...Array.from({ length: input.mainboardCount }, (_, index) =>
          createResolvedCard(`Test Card ${index + 1}`, "mainboard"),
        ),
      ],
      unresolvedCards: Array.from({ length: input.unresolvedCount }, (_, index) => ({
        quantity: 1,
        section: "mainboard",
        requestedName: `Missing Card ${index + 1}`,
        originalLine: `1 Missing Card ${index + 1}`,
        lineNumber: index + 10,
        reason: "not found",
      })),
      resolvedCount: input.mainboardCount + 1,
      unresolvedCount: input.unresolvedCount,
    },
  } as any;
}

function createResolvedCard(name: string, section: "commander" | "mainboard") {
  return {
    quantity: 1,
    section,
    requestedName: name,
    originalLine: `1 ${name}`,
    lineNumber: 1,
    card: {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      cmc: 1,
      type_line: section === "commander" ? "Legendary Creature" : "Creature",
      color_identity: [],
      keywords: [],
      layout: "normal",
      scryfall_uri: "https://scryfall.com/card/test",
    },
  };
}
