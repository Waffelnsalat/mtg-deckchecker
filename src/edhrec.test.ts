import assert from "node:assert/strict";
import test from "node:test";
import { lookupCommanderEdhrecInsights } from "./edhrec";

test("lookupCommanderEdhrecInsights parses target-bracket commander pages", async () => {
  const restoreFetch = mockFetch((input) => {
    const url = String(input);

    assert.equal(url, "https://edhrec.com/commanders/kess-dissident-mage/optimized");

    return textResponse(
      createEdhrecHtml({
        numDecks: 1200,
        cardlists: [
          {
            header: "High Synergy Cards",
            tag: "highsynergycards",
            cardviews: [
              {
                name: "Mystical Tutor",
                url: "/cards/mystical-tutor",
                synergy: 0.47,
                inclusion: 564,
                num_decks: 564,
                potential_decks: 1200,
              },
            ],
          },
        ],
      }),
    );
  });

  try {
    const result = await lookupCommanderEdhrecInsights(createDocument("Kess, Dissident Mage"), 4);

    assert.ok(result);
    assert.equal(result?.pageLabel, "Optimized");
    assert.equal(result?.deckCount, 1200);
    assert.equal(result?.cardsByName.get("mystical tutor")?.synergy, 0.47);
  } finally {
    restoreFetch();
  }
});

test("lookupCommanderEdhrecInsights falls back to the base commander page", async () => {
  const seenUrls: string[] = [];
  const restoreFetch = mockFetch((input) => {
    const url = String(input);
    seenUrls.push(url);

    if (url === "https://edhrec.com/commanders/teysa-karlov/core") {
      return textResponse("missing", 404);
    }

    assert.equal(url, "https://edhrec.com/commanders/teysa-karlov");

    return textResponse(
      createEdhrecHtml({
        numDecks: 980,
        cardlists: [
          {
            header: "Top Cards",
            tag: "topcards",
            cardviews: [
              {
                name: "Bastion of Remembrance",
                url: "/cards/bastion-of-remembrance",
                synergy: 0.22,
                inclusion: 400,
                num_decks: 400,
                potential_decks: 980,
              },
            ],
          },
        ],
      }),
    );
  });

  try {
    const result = await lookupCommanderEdhrecInsights(createDocument("Teysa Karlov"), 2);

    assert.deepEqual(seenUrls, [
      "https://edhrec.com/commanders/teysa-karlov/core",
      "https://edhrec.com/commanders/teysa-karlov",
    ]);
    assert.ok(result);
    assert.equal(result?.pageLabel, "All");
    assert.equal(
      result?.cardsByName.get("bastion of remembrance")?.listTags.includes("topcards"),
      true,
    );
  } finally {
    restoreFetch();
  }
});

function createDocument(commanderName: string) {
  return {
    format: "edh",
    parse: {
      entries: [],
      errors: [],
      warnings: [],
      totalCards: 100,
      uniqueCards: 100,
    },
    result: {
      resolvedCards: [
        {
          quantity: 1,
          section: "commander",
          requestedName: commanderName,
          originalLine: `1 ${commanderName}`,
          lineNumber: 1,
          card: {
            id: `${encodeURIComponent(commanderName)}-id`,
            name: commanderName,
            cmc: 4,
            type_line: "Legendary Creature - Wizard",
            color_identity: ["U", "B", "R"],
            keywords: [],
            layout: "normal",
            scryfall_uri: "https://scryfall.com/card/test",
          },
        },
      ],
      unresolvedCards: [],
      resolvedCount: 1,
      unresolvedCount: 0,
    },
  } as any;
}

function mockFetch(
  implementation: (
    input: string | URL | Request,
    init?: RequestInit,
  ) =>
    | PromiseLike<{ ok: boolean; status: number; text(): Promise<string> }>
    | { ok: boolean; status: number; text(): Promise<string> },
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(implementation(input, init))) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function textResponse(payload: string, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return payload;
    },
  };
}

function createEdhrecHtml(input: {
  numDecks: number;
  cardlists: Array<{
    header: string;
    tag: string;
    cardviews: Array<{
      name: string;
      url: string;
      synergy: number;
      inclusion: number;
      num_decks: number;
      potential_decks: number;
    }>;
  }>;
}) {
  const payload = {
    props: {
      pageProps: {
        data: {
          num_decks_avg: input.numDecks,
          container: {
            json_dict: {
              cardlists: input.cardlists,
            },
          },
        },
      },
    },
  };

  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script></body></html>`;
}
