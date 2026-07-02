import assert from "node:assert/strict";
import test from "node:test";
import {
  parseDeckImportUrl,
  serializeImportedDecklist,
  importDecklistFromUrl,
} from "./deckImport";

test("parseDeckImportUrl accepts Archidekt and Moxfield deck URLs", () => {
  assert.deepEqual(parseDeckImportUrl("https://archidekt.com/decks/7184014/example"), {
    source: "archidekt",
    deckId: "7184014",
    canonicalUrl: "https://archidekt.com/decks/7184014",
  });

  assert.deepEqual(parseDeckImportUrl("https://www.moxfield.com/decks/tMvGIJGLn0qxiyoEEeNSmA"), {
    source: "moxfield",
    deckId: "tMvGIJGLn0qxiyoEEeNSmA",
    canonicalUrl: "https://moxfield.com/decks/tMvGIJGLn0qxiyoEEeNSmA",
  });
});

test("serializeImportedDecklist keeps playable and supplemental deck sections", () => {
  assert.equal(
    serializeImportedDecklist([
      { section: "commander", quantity: 1, name: "The Ur-Dragon" },
      { section: "companion", quantity: 1, name: "Jegantha, the Wellspring" },
      { section: "mainboard", quantity: 1, name: "Sol Ring" },
      { section: "attraction", quantity: 1, name: "Haunted House" },
      { section: "sticker", quantity: 1, name: "Eldrazi Guacamole Tightrope" },
      { section: "sideboard", quantity: 1, name: "Swords to Plowshares" },
      { section: "maybeboard", quantity: 1, name: "Cyclonic Rift" },
    ]),
    [
      "[COMMANDER]",
      "1 The Ur-Dragon",
      "",
      "[COMPANION]",
      "1 Jegantha, the Wellspring",
      "",
      "[DECK]",
      "1 Sol Ring",
      "",
      "[ATTRACTION DECK]",
      "1 Haunted House",
      "",
      "[STICKER SHEETS]",
      "1 Eldrazi Guacamole Tightrope",
    ].join("\n"),
  );
});

test("importDecklistFromUrl maps Archidekt cards into decklist text", async () => {
  const restoreFetch = mockFetch((input) => {
    const url = String(input);

    assert.equal(url, "https://archidekt.com/api/decks/7184014/");

    return jsonResponse({
      name: "Sample Archidekt Deck",
      cards: [
        {
          quantity: 1,
          categories: ["Commander"],
          companion: false,
          card: {
            oracleCard: {
              name: "Raffine, Scheming Seer",
            },
          },
        },
        {
          quantity: 1,
          categories: ["Land"],
          companion: false,
          card: {
            oracleCard: {
              name: "Command Tower",
            },
          },
        },
        {
          quantity: 1,
          categories: ["Attraction Deck"],
          companion: false,
          card: {
            oracleCard: {
              name: "Haunted House",
            },
          },
        },
        {
          quantity: 1,
          categories: ["Sticker Sheets"],
          companion: false,
          card: {
            oracleCard: {
              name: "Eldrazi Guacamole Tightrope",
            },
          },
        },
        {
          quantity: 1,
          categories: ["Land"],
          companion: true,
          card: {
            oracleCard: {
              name: "Jegantha, the Wellspring",
            },
          },
        },
      ],
    });
  });

  try {
    const result = await importDecklistFromUrl("https://archidekt.com/decks/7184014/sample");

    assert.equal(result.source, "archidekt");
    assert.equal(result.title, "Sample Archidekt Deck");
    assert.equal(
      result.decklist,
      [
        "[COMMANDER]",
        "1 Raffine, Scheming Seer",
        "",
        "[COMPANION]",
        "1 Jegantha, the Wellspring",
        "",
        "[DECK]",
        "1 Command Tower",
        "",
        "[ATTRACTION DECK]",
        "1 Haunted House",
        "",
        "[STICKER SHEETS]",
        "1 Eldrazi Guacamole Tightrope",
      ].join("\n"),
    );
    assert.deepEqual(
      result.cards.map((card) => card.name),
      [
        "Raffine, Scheming Seer",
        "Command Tower",
        "Haunted House",
        "Eldrazi Guacamole Tightrope",
        "Jegantha, the Wellspring",
      ],
    );
  } finally {
    restoreFetch();
  }
});

test("importDecklistFromUrl maps Moxfield boards into decklist text", async () => {
  const restoreFetch = mockFetch((input) => {
    const url = String(input);

    assert.equal(url, "https://api2.moxfield.com/v3/decks/all/tMvGIJGLn0qxiyoEEeNSmA");

    return jsonResponse({
      name: "Sample Moxfield Deck",
      boards: {
        commanders: {
          cards: {
            commander: {
              quantity: 1,
              card: { name: "The Rani" },
            },
          },
        },
        companions: {
          cards: {},
        },
        mainboard: {
          cards: {
            mainA: {
              quantity: 1,
              card: { name: "Idol of Oblivion" },
            },
            mainB: {
              quantity: 2,
              card: { name: "Mountain" },
            },
          },
        },
        sideboard: {
          cards: {
            side: {
              quantity: 1,
              card: { name: "Chaos Warp" },
            },
          },
        },
        maybeboard: {
          cards: {},
        },
        attractions: {
          cards: {
            attraction: {
              quantity: 1,
              card: { name: "Haunted House" },
            },
          },
        },
        stickers: {
          cards: {
            sticker: {
              quantity: 1,
              card: { name: "Eldrazi Guacamole Tightrope" },
            },
          },
        },
      },
    });
  });

  try {
    const result = await importDecklistFromUrl("https://moxfield.com/decks/tMvGIJGLn0qxiyoEEeNSmA");

    assert.equal(result.source, "moxfield");
    assert.equal(result.title, "Sample Moxfield Deck");
    assert.equal(
      result.decklist,
      [
        "[COMMANDER]",
        "1 The Rani",
        "",
        "[DECK]",
        "1 Idol of Oblivion",
        "2 Mountain",
        "",
        "[ATTRACTION DECK]",
        "1 Haunted House",
        "",
        "[STICKER SHEETS]",
        "1 Eldrazi Guacamole Tightrope",
      ].join("\n"),
    );
    assert.deepEqual(
      result.cards.map((card) => card.name),
      ["The Rani", "Idol of Oblivion", "Mountain", "Haunted House", "Eldrazi Guacamole Tightrope"],
    );
  } finally {
    restoreFetch();
  }
});

function mockFetch(
  implementation: (
    input: string | URL | Request,
    init?: RequestInit,
  ) =>
    | PromiseLike<{ ok: boolean; status: number; json(): Promise<unknown> }>
    | { ok: boolean; status: number; json(): Promise<unknown> },
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
