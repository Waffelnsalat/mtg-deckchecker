import assert from "node:assert/strict";
import test from "node:test";
import { resolveDeckEntries } from "./scryfall";
import { ParsedDeckEntry, ScryfallCard } from "./types";

test("resolveDeckEntries accepts flavor-name reprints through fuzzy lookup", async () => {
  const restoreFetch = mockFetch((input, init) => {
    const url = String(input);

    if (url.endsWith("/cards/collection")) {
      const payload = JSON.parse(String(init?.body));
      assert.deepEqual(payload.identifiers, [{ name: "The Imperial City of Archades" }]);

      return jsonResponse({
        data: [],
        not_found: [{ name: "The Imperial City of Archades" }],
      });
    }

    if (url.includes("/cards/named?fuzzy=")) {
      return jsonResponse({
        id: "wall-of-omens",
        name: "Wall of Omens",
        flavor_name: "The Imperial City of Archades",
        cmc: 2,
        type_line: "Creature - Wall",
        oracle_text: "Defender\nWhen Wall of Omens enters the battlefield, draw a card.",
        color_identity: ["W"],
        keywords: ["Defender"],
        layout: "normal",
        scryfall_uri: "https://scryfall.com/card/fin/999/wall-of-omens",
      } satisfies Partial<ScryfallCard>);
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  try {
    const result = await resolveDeckEntries([
      createEntry("The Imperial City of Archades"),
    ]);

    assert.equal(result.unmatched.length, 0);
    assert.equal(result.cards.length, 1);
    assert.equal(result.cards[0]?.card.name, "Wall of Omens");
    assert.equal(result.cards[0]?.requestedName, "The Imperial City of Archades");
  } finally {
    restoreFetch();
  }
});

test("resolveDeckEntries accepts room cards with loose slash formatting", async () => {
  const restoreFetch = mockFetch((input, init) => {
    const url = String(input);

    if (url.endsWith("/cards/collection")) {
      const payload = JSON.parse(String(init?.body));
      assert.deepEqual(payload.identifiers, [{ name: "Restricted Office / Lecture Hall" }]);

      return jsonResponse({
        data: [],
        not_found: [{ name: "Restricted Office / Lecture Hall" }],
      });
    }

    if (url.includes("/cards/named?fuzzy=")) {
      return jsonResponse({
        id: "restricted-office-lecture-hall",
        name: "Restricted Office // Lecture Hall",
        cmc: 11,
        type_line: "Enchantment - Room // Enchantment - Room",
        color_identity: ["W", "U"],
        keywords: [],
        layout: "split",
        card_faces: [
          {
            name: "Restricted Office",
            type_line: "Enchantment - Room",
            oracle_text: "When you unlock this door, destroy all creatures with power 3 or greater.",
          },
          {
            name: "Lecture Hall",
            type_line: "Enchantment - Room",
            oracle_text: "Other permanents you control have hexproof.",
          },
        ],
        scryfall_uri: "https://scryfall.com/card/dsk/227/restricted-office-lecture-hall",
      } satisfies Partial<ScryfallCard>);
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  try {
    const result = await resolveDeckEntries([
      createEntry("Restricted Office / Lecture Hall"),
    ]);

    assert.equal(result.unmatched.length, 0);
    assert.equal(result.cards.length, 1);
    assert.equal(result.cards[0]?.card.name, "Restricted Office // Lecture Hall");
  } finally {
    restoreFetch();
  }
});

function createEntry(name: string): ParsedDeckEntry {
  return {
    lineNumber: 1,
    originalLine: `1 ${name}`,
    quantity: 1,
    name,
    section: "mainboard",
  };
}

function mockFetch(
  implementation: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => PromiseLike<{ ok: boolean; status: number; json(): Promise<unknown> }> | { ok: boolean; status: number; json(): Promise<unknown> },
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(implementation(input, init))) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return payload;
    },
  };
}
