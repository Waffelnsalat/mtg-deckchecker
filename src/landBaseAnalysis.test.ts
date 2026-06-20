import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckLandBase } from "./landBaseAnalysis";
import { DeckResolutionDocument, DeckSection, ResolvedDeckCard, ScryfallCard } from "./types";

test("analyzeDeckLandBase classifies tapped, fetch, utility, typed, colorless, and costly lands", () => {
  const analysis = analyzeDeckLandBase(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Esper Commander",
        "Legendary Creature - Human",
        3,
        "",
        { color_identity: ["W", "U", "B"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Tapland Style",
        "Land",
        0,
        "Tapland Style enters the battlefield tapped. {T}: Add {U}.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Checkland Style",
        "Land",
        0,
        "Checkland Style enters the battlefield tapped unless you control an Island or a Swamp. {T}: Add {U} or {B}.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Fetchland Style",
        "Land",
        0,
        "{T}, Pay 1 life, Sacrifice Fetchland Style: Search your library for an Island or Swamp card, put it onto the battlefield, then shuffle.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Utility Waste Style",
        "Land",
        0,
        "{T}: Add {C}. {3}, {T}: Draw a card.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Painland Style",
        "Land",
        0,
        "{T}: Add {C}. {T}: Add {U} or {B}. Painland Style deals 1 damage to you.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Typed Dual Style",
        "Land - Island Swamp",
        0,
        "({T}: Add {U} or {B}.)",
      ),
      createResolvedCard(
        "mainboard",
        93,
        "Filler Spell",
        "Instant",
        2,
        "",
        { mana_cost: "{1}{U}" },
      ),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.equal(analysis.counts.alwaysTapped, 1);
  assert.equal(analysis.counts.conditionalTapped, 1);
  assert.equal(analysis.counts.fetch, 1);
  assert.equal(analysis.counts.utility, 1);
  assert.equal(analysis.counts.typed, 1);
  assert.equal(analysis.counts.colorlessOnly, 1);
  assert.equal(analysis.counts.costly, 1);
  assert.ok(labels.get("Tapland Style")?.has("always_tapped"));
  assert.ok(labels.get("Checkland Style")?.has("conditional_tapped"));
  assert.ok(labels.get("Fetchland Style")?.has("fetch_land"));
  assert.ok(labels.get("Utility Waste Style")?.has("utility_land"));
  assert.ok(labels.get("Utility Waste Style")?.has("colorless_only"));
  assert.ok(labels.get("Painland Style")?.has("costly_land"));
  assert.ok(labels.get("Typed Dual Style")?.has("typed_land"));
});

test("analyzeDeckLandBase gives every land a baseline tag", () => {
  const analysis = analyzeDeckLandBase(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Mono Green Commander",
        "Legendary Creature - Elf",
        3,
        "",
        { color_identity: ["G"] },
      ),
      createResolvedCard("mainboard", 20, "Forest", "Basic Land - Forest", 0, "({T}: Add {G}.)"),
      createResolvedCard("mainboard", 1, "Plain Dual", "Land", 0, "{T}: Add {G} or {W}."),
      createResolvedCard("mainboard", 1, "Artifact Seat Style", "Artifact Land", 0, "{T}: Add {U}."),
      createResolvedCard("mainboard", 1, "Maze Style", "Land", 0, "{T}: Untap target attacking creature. Prevent all combat damage that would be dealt to and dealt by that creature this turn."),
      createResolvedCard("mainboard", 76, "Filler Spell", "Creature - Elf", 2, "", { mana_cost: "{1}{G}" }),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Forest")?.has("land_slot"));
  assert.ok(labels.get("Forest")?.has("basic_land"));
  assert.ok(labels.get("Forest")?.has("mana_source"));
  assert.ok(labels.get("Plain Dual")?.has("land_slot"));
  assert.ok(labels.get("Plain Dual")?.has("mana_source"));
  assert.ok(labels.get("Artifact Seat Style")?.has("artifact_land"));
  assert.ok(labels.get("Maze Style")?.has("land_slot"));
  assert.ok(labels.get("Maze Style")?.has("utility_land"));
  assert.equal(analysis.taggedCards.filter((card) => card.section === "mainboard").length, 4);
});

test("analyzeDeckLandBase punishes too many always-tapped lands in a low-curve shell", () => {
  const analysis = analyzeDeckLandBase(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Izzet Commander",
        "Legendary Creature - Wizard",
        2,
        "",
        { color_identity: ["U", "R"] },
      ),
      createResolvedCard(
        "mainboard",
        12,
        "Tapland Style",
        "Land",
        0,
        "Tapland Style enters the battlefield tapped. {T}: Add {U} or {R}.",
      ),
      createResolvedCard(
        "mainboard",
        24,
        "Basic Island",
        "Basic Land - Island",
        0,
        "({T}: Add {U}.)",
      ),
      createResolvedCard(
        "mainboard",
        63,
        "Cheap Spell",
        "Instant",
        1,
        "",
        { mana_cost: "{U}" },
      ),
    ]),
  );

  assert.ok(analysis.recommendations.alwaysTappedMax <= 3);
  assert.ok(analysis.landBaseScore < 70);
  assert.equal(analysis.findings[0].code, "land_speed_low");
});

test("analyzeDeckLandBase punishes colorless burden in color-hungry multicolor decks", () => {
  const analysis = analyzeDeckLandBase(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Grixis Commander",
        "Legendary Creature - Wizard",
        4,
        "",
        { color_identity: ["U", "B", "R"] },
      ),
      createResolvedCard(
        "mainboard",
        8,
        "Utility Waste Style",
        "Land",
        0,
        "{T}: Add {C}. {4}, {T}: Draw a card.",
      ),
      createResolvedCard(
        "mainboard",
        28,
        "Tri Land Style",
        "Land",
        0,
        "Tri Land Style enters the battlefield tapped unless you control two or more other lands. {T}: Add {U}, {B}, or {R}.",
      ),
      createResolvedCard(
        "mainboard",
        63,
        "Color Hungry Spell",
        "Sorcery",
        3,
        "",
        { mana_cost: "{U}{B}{R}" },
      ),
    ]),
  );

  assert.ok(analysis.recommendations.colorlessOnlyMax <= 3);
  assert.ok(analysis.landBaseScore < 75);
  assert.ok(["colorless_land_high", "colorless_land_light_warning"].includes(analysis.findings[1].code));
});

test("analyzeDeckLandBase does not hand out 100 to merely strong mana bases", () => {
  const analysis = analyzeDeckLandBase(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Abzan Commander",
        "Legendary Creature - Knight",
        3,
        "",
        { color_identity: ["W", "B", "G"] },
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Fetchland Style",
        "Land",
        0,
        "{T}, Pay 1 life, Sacrifice Fetchland Style: Search your library for a Forest or Plains card, put it onto the battlefield, then shuffle.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Typed Dual Style",
        "Land - Forest Plains",
        0,
        "({T}: Add {G} or {W}.)",
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Checkland Style",
        "Land",
        0,
        "Checkland Style enters the battlefield tapped unless you control a Forest or a Plains. {T}: Add {G} or {W}.",
      ),
      createResolvedCard(
        "mainboard",
        2,
        "Utility Waste Style",
        "Land",
        0,
        "{T}: Add {C}. {4}, {T}: Draw a card.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Painland Style",
        "Land",
        0,
        "{T}: Add {C}. {T}: Add {W} or {B}. Painland Style deals 1 damage to you.",
      ),
      createResolvedCard(
        "mainboard",
        20,
        "Basic Forest",
        "Basic Land - Forest",
        0,
        "({T}: Add {G}.)",
      ),
      createResolvedCard(
        "mainboard",
        63,
        "Midrange Spell",
        "Creature - Knight",
        3,
        "",
        { mana_cost: "{1}{W}{B}" },
      ),
    ]),
  );

  assert.ok(analysis.landBaseScore >= 72);
  assert.ok(analysis.landBaseScore < 100);
});

test("analyzeDeckLandBase does not treat speed conditions or drawbacks as utility", () => {
  const analysis = analyzeDeckLandBase(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Jeskai Commander",
        "Legendary Creature - Monk",
        3,
        "",
        { color_identity: ["W", "U", "R"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Shockland Style",
        "Land - Plains Island",
        0,
        "As Shockland Style enters the battlefield, you may pay 2 life. If you don't, it enters tapped. ({T}: Add {W} or {U}.)",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Painland Style",
        "Land",
        0,
        "{T}: Add {C}. {T}: Add {U} or {R}. Painland Style deals 1 damage to you.",
      ),
      createResolvedCard(
        "mainboard",
        97,
        "Filler Spell",
        "Instant",
        2,
        "",
        { mana_cost: "{1}{U}" },
      ),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(!labels.get("Shockland Style")?.has("utility_land"));
  assert.ok(!labels.get("Painland Style")?.has("utility_land"));
  assert.ok(labels.get("Painland Style")?.has("costly_land"));
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
