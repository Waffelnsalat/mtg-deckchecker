import assert from "node:assert/strict";
import test from "node:test";
import { DeckValidationError } from "./deckValidation";
import { resolveDecklistForAnalysis, resolveDecklistToDocument } from "./deckExport";
import { ScryfallCard } from "./types";

test("resolveDecklistForAnalysis returns validation issues without throwing", async () => {
  const restoreFetch = mockFetch((input, init) => {
    const url = String(input);

    if (url.endsWith("/cards/collection")) {
      const payload = JSON.parse(String(init?.body));
      assert.deepEqual(payload.identifiers, [
        { name: "Krenko, Mob Boss" },
        { name: "Mountain" },
      ]);

      return jsonResponse({
        data: [
          createCard("krenko", "Krenko, Mob Boss", "Legendary Creature - Goblin", ["R"], {
            oracleText: "Create Goblin tokens.",
            legalities: { commander: "legal" },
          }),
          createCard("mountain", "Mountain", "Basic Land - Mountain", ["R"], {
            oracleText: "({T}: Add {R}.)",
          }),
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  try {
    const result = await resolveDecklistForAnalysis("1 Krenko, Mob Boss\n1 Mountain");

    assert.equal(result.document.result.resolvedCount, 2);
    assert.equal(result.validation.isValid, false);
    assert.ok(result.validation.issues.some((issue) => issue.code === "mainboard_size"));
  } finally {
    restoreFetch();
  }
});

test("resolveDecklistToDocument still rejects invalid EDH decks", async () => {
  const restoreFetch = mockFetch((input) => {
    const url = String(input);

    if (url.endsWith("/cards/collection")) {
      return jsonResponse({
        data: [
          createCard("krenko", "Krenko, Mob Boss", "Legendary Creature - Goblin", ["R"], {
            oracleText: "Create Goblin tokens.",
            legalities: { commander: "legal" },
          }),
          createCard("mountain", "Mountain", "Basic Land - Mountain", ["R"], {
            oracleText: "({T}: Add {R}.)",
          }),
        ],
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  });

  try {
    await assert.rejects(
      () => resolveDecklistToDocument("1 Krenko, Mob Boss\n1 Mountain"),
      DeckValidationError,
    );
  } finally {
    restoreFetch();
  }
});

function createCard(
  id: string,
  name: string,
  typeLine: string,
  colorIdentity: string[],
  options: {
    oracleText?: string;
    legalities?: Record<string, string>;
  } = {},
): ScryfallCard {
  return {
    id,
    name,
    cmc: 0,
    type_line: typeLine,
    oracle_text: options.oracleText,
    color_identity: colorIdentity,
    keywords: [],
    layout: "normal",
    legalities: options.legalities,
    scryfall_uri: `https://scryfall.com/card/test/${id}`,
  };
}

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
