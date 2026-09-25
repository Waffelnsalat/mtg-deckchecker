import assert from "node:assert/strict";
import test from "node:test";
import { lookupDeckInfiniteCombos } from "./commanderSpellbook";
import { DeckResolutionDocument } from "./types";

test("concurrent and repeated combo lookups share one Spellbook request", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return new Response(JSON.stringify({ results: { included: [] } }), { status: 200 });
  };

  const document = {
    result: {
      resolvedCards: [{
        section: "commander",
        quantity: 1,
        requestedName: "Cache Test Commander",
        card: { name: "Cache Test Commander" },
      }],
    },
  } as DeckResolutionDocument;

  try {
    const [first, second] = await Promise.all([
      lookupDeckInfiniteCombos(document),
      lookupDeckInfiniteCombos(document),
    ]);
    const repeated = await lookupDeckInfiniteCombos(document);
    assert.equal(requests, 1);
    assert.deepEqual(first, second);
    assert.deepEqual(first, repeated);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
