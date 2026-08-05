import assert from "node:assert/strict";
import test from "node:test";
import { lookupDeckComboFinder } from "./commanderSpellbook";
import { DeckResolutionDocument, DeckSection, ResolvedDeckCard, ScryfallCard } from "./types";

test("lookupDeckComboFinder normalizes complete and one-card-away combo lines", async () => {
  const restoreFetch = mockSpellbookResponse({
    results: {
      included: [
        createSpellbookCombo({
          id: "oracle-consult",
          uses: ["Demonic Consultation", "Thassa's Oracle"],
          produces: ["Win the game"],
          description: "Cast Demonic Consultation.\nCast Thassa's Oracle.",
        }),
      ],
      almostIncluded: [
        createSpellbookCombo({
          id: "breach-brain-freeze",
          uses: ["Brain Freeze", "Lion's Eye Diamond", "Underworld Breach"],
          produces: ["Mill all opponents"],
          description: "Cast Underworld Breach.\nLoop Lion's Eye Diamond and Brain Freeze.",
        }),
      ],
    },
  });

  try {
    const analysis = await lookupDeckComboFinder(
      createDocument([
        createResolvedCard("commander", "Rograkh, Son of Rohgahh"),
        createResolvedCard("mainboard", "Demonic Consultation"),
        createResolvedCard("mainboard", "Thassa's Oracle"),
        createResolvedCard("mainboard", "Brain Freeze"),
        createResolvedCard("mainboard", "Underworld Breach"),
      ]),
    );

    assert.equal(analysis.lookupStatus, "ok");
    assert.equal(analysis.counts.complete, 1);
    assert.equal(analysis.counts.missingOne, 1);
    assert.deepEqual(analysis.complete[0]?.steps, [
      "Cast Demonic Consultation.",
      "Cast Thassa's Oracle.",
    ]);
    assert.deepEqual(analysis.missingOne[0]?.missingCardNames, ["Lion's Eye Diamond"]);
    assert.equal(
      analysis.complete[0]?.cards.find((card) => card.name === "Thassa's Oracle")?.scryfallUri,
      `https://scryfall.com/card/${encodeURIComponent("Thassa's Oracle")}`,
    );
    assert.equal(
      analysis.missingOne[0]?.cards.find((card) => card.name === "Lion's Eye Diamond")?.inDeck,
      false,
    );
    assert.equal(
      analysis.missingOne[0]?.cards.find((card) => card.name === "Lion's Eye Diamond")?.scryfallUri,
      `https://scryfall.com/search?q=${encodeURIComponent(`!"Lion's Eye Diamond"`)}`,
    );
  } finally {
    restoreFetch();
  }
});

function mockSpellbookResponse(payload: unknown) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    )) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function createSpellbookCombo(input: {
  id: string;
  uses: string[];
  produces: string[];
  description: string;
}) {
  return {
    id: input.id,
    uses: input.uses.map((name) => ({
      card: {
        name,
        typeLine: "Card",
        imageUriFrontNormal: `https://cards.example/${encodeURIComponent(name)}.jpg`,
      },
      zoneLocations: ["H"],
      mustBeCommander: false,
    })),
    produces: input.produces.map((name) => ({
      feature: {
        name,
      },
      quantity: 1,
    })),
    requires: [],
    description: input.description,
    variantCount: 1,
    popularity: 100,
  };
}

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

function createResolvedCard(section: DeckSection, name: string): ResolvedDeckCard {
  const card: ScryfallCard = {
    id: `${name}-id`,
    name,
    cmc: 1,
    type_line: "Card",
    oracle_text: "",
    color_identity: [],
    keywords: [],
    layout: "normal",
    scryfall_uri: `https://scryfall.com/card/${encodeURIComponent(name)}`,
  };

  return {
    quantity: 1,
    section,
    requestedName: name,
    originalLine: `1 ${name}`,
    lineNumber: 1,
    card,
  };
}
