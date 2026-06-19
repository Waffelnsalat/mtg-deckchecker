import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckWinConditions } from "./winConditionAnalysis";
import {
  DeckResolutionDocument,
  DeckSection,
  DeckWinConditionComboLookup,
  ResolvedDeckCard,
  ScryfallCard,
} from "./types";

test("analyzeDeckWinConditions classifies combat, direct, alternate, and repeatable finishers", async () => {
  const analysis = await analyzeDeckWinConditions(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Warrior", 4, "", {
        color_identity: ["R", "G", "W"],
      }),
      createResolvedCard(
        "mainboard",
        1,
        "Overrun Style",
        "Sorcery",
        5,
        "Creatures you control get +3/+3 and gain trample until end of turn.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Exsanguinate Style",
        "Sorcery",
        2,
        "Each opponent loses X life. You gain life equal to the life lost this way.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Approach Style",
        "Sorcery",
        7,
        "If this spell was cast from your hand and you've cast another spell named Approach Style this game, you win the game.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Purphoros Style",
        "Legendary Enchantment Creature - God",
        4,
        "Whenever another creature enters the battlefield under your control, Purphoros Style deals 2 damage to each opponent.",
      ),
      createResolvedCard("mainboard", 95, "Filler Spell", "Creature - Elf", 2, ""),
    ]),
    createEmptyComboLookup(),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Overrun Style")?.has("combat_finisher"));
  assert.ok(labels.get("Exsanguinate Style")?.has("direct_finisher"));
  assert.ok(labels.get("Approach Style")?.has("alternate_finisher"));
  assert.ok(labels.get("Purphoros Style")?.has("direct_finisher"));
  assert.ok(labels.get("Purphoros Style")?.has("repeatable_finisher"));
  assert.ok(analysis.counts.combat > 0);
  assert.ok(analysis.counts.direct > 0);
  assert.ok(analysis.counts.alternate > 0);
  assert.ok(analysis.counts.repeatable > 0);
});

test("analyzeDeckWinConditions catches extra combat and poison-closing text", async () => {
  const analysis = await analyzeDeckWinConditions(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Warrior", 4, "", {
        color_identity: ["R", "G"],
      }),
      createResolvedCard(
        "mainboard",
        1,
        "Relentless Assault Style",
        "Sorcery",
        4,
        "Untap all creatures that attacked this turn. After this main phase, there is an additional combat phase followed by an additional main phase.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Triumph Style",
        "Sorcery",
        4,
        "Until end of turn, creatures you control get +1/+1 and gain trample and infect.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Overwhelming Stampede Style",
        "Sorcery",
        5,
        "Until end of turn, creatures you control gain trample and get +X/+X, where X is the greatest power among creatures you control.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Mirror Entity Style",
        "Creature - Shapeshifter",
        3,
        "{X}: Creatures you control have base power and toughness X/X until end of turn.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Great Oak Guardian Style",
        "Creature - Treefolk",
        6,
        "Flash. When this creature enters, creatures target player controls get +2/+2 until end of turn. Untap them.",
      ),
      createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Elf", 2, ""),
    ]),
    createEmptyComboLookup(),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Relentless Assault Style")?.has("combat_finisher"));
  assert.ok(labels.get("Triumph Style")?.has("combat_finisher"));
  assert.ok(labels.get("Triumph Style")?.has("alternate_finisher"));
  assert.ok(labels.get("Overwhelming Stampede Style")?.has("combat_finisher"));
  assert.ok(labels.get("Mirror Entity Style")?.has("combat_finisher"));
  assert.ok(labels.get("Great Oak Guardian Style")?.has("combat_finisher"));
});

test("analyzeDeckWinConditions treats scalable any-target damage as a finisher", async () => {
  const analysis = await analyzeDeckWinConditions(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 3, "", {
        color_identity: ["R"],
      }),
      createResolvedCard(
        "mainboard",
        1,
        "Comet Storm Style",
        "Instant",
        2,
        "Multikicker {1}. Choose any target, then choose another target for each time this spell was kicked. Comet Storm deals X damage to each of them.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Crackle with Power Style",
        "Sorcery",
        5,
        "Crackle with Power deals five times X damage to each of up to X targets.",
      ),
      createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Goblin", 2, ""),
    ]),
    createEmptyComboLookup(),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Comet Storm Style")?.has("direct_finisher"));
  assert.ok(labels.get("Crackle with Power Style")?.has("direct_finisher"));
  assert.ok(analysis.counts.direct > 0);
});

test("analyzeDeckWinConditions does not treat small fixed burn as a finisher", async () => {
  const analysis = await analyzeDeckWinConditions(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 3, "", {
        color_identity: ["R"],
      }),
      createResolvedCard(
        "mainboard",
        1,
        "Lightning Bolt Style",
        "Instant",
        1,
        "This spell deals 3 damage to any target.",
      ),
      createResolvedCard("mainboard", 98, "Filler Spell", "Creature - Goblin", 2, ""),
    ]),
    createEmptyComboLookup(),
  );

  assert.ok(!analysis.taggedCards.some((card) => card.name === "Lightning Bolt Style"));
  assert.equal(analysis.counts.direct, 0);
});

test("analyzeDeckWinConditions ignores ordinary value cards", async () => {
  const analysis = await analyzeDeckWinConditions(
    createDocument([
      createResolvedCard("commander", 1, "Value Commander", "Legendary Creature - Wizard", 3, "", {
        color_identity: ["U"],
      }),
      createResolvedCard("mainboard", 50, "Bear", "Creature - Bear", 2, ""),
      createResolvedCard(
        "mainboard",
        49,
        "Divination Style",
        "Sorcery",
        3,
        "Draw two cards.",
      ),
    ]),
    createEmptyComboLookup(),
  );

  assert.equal(analysis.taggedCards.length, 0);
  assert.ok(analysis.finisherScore <= 40);
});

test("analyzeDeckWinConditions boosts commander finishers", async () => {
  const analysis = await analyzeDeckWinConditions(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Impact Commander",
        "Legendary Enchantment Creature - God",
        4,
        "Whenever another creature enters the battlefield under your control, Impact Commander deals 2 damage to each opponent.",
        { color_identity: ["R"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Impact Engine",
        "Enchantment",
        2,
        "Whenever another creature enters the battlefield under your control, Impact Engine deals 1 damage to each opponent.",
      ),
      createResolvedCard("mainboard", 98, "Filler Spell", "Creature - Goblin", 2, ""),
    ]),
    createEmptyComboLookup(),
  );

  const commander = analysis.taggedCards.find((card) => card.name === "Impact Commander");
  const engine = analysis.taggedCards.find((card) => card.name === "Impact Engine");

  assert.ok((commander?.finisherValue ?? 0) > (engine?.finisherValue ?? 0));
});

test("analyzeDeckWinConditions expects more combat finishers from creature-heavy shells", async () => {
  const creatureHeavy = await analyzeDeckWinConditions(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Selesnya Commander",
        "Legendary Creature - Knight",
        4,
        "",
        { color_identity: ["G", "W"] },
      ),
      createResolvedCard("mainboard", 30, "Filler Creature", "Creature - Soldier", 3, ""),
      createResolvedCard("mainboard", 69, "Filler Spell", "Sorcery", 2, ""),
    ]),
    createEmptyComboLookup(),
  );

  const spellHeavy = await analyzeDeckWinConditions(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Dimir Commander",
        "Legendary Creature - Wizard",
        4,
        "",
        { color_identity: ["U", "B"] },
      ),
      createResolvedCard("mainboard", 8, "Filler Creature", "Creature - Rogue", 3, ""),
      createResolvedCard("mainboard", 91, "Filler Spell", "Sorcery", 2, ""),
    ]),
    createEmptyComboLookup(),
  );

  assert.ok(creatureHeavy.recommendations.combatTarget > spellHeavy.recommendations.combatTarget);
});

test("analyzeDeckWinConditions counts exact infinite combos toward finisher score", async () => {
  const analysis = await analyzeDeckWinConditions(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Urza, Lord High Artificer",
        "Legendary Creature - Human Artificer",
        4,
        "",
        { color_identity: ["U"] },
      ),
      createResolvedCard("mainboard", 1, "Isochron Scepter", "Artifact", 2, ""),
      createResolvedCard("mainboard", 1, "Dramatic Reversal", "Instant", 2, ""),
      createResolvedCard("mainboard", 1, "Sol Ring", "Artifact", 1, ""),
      createResolvedCard("mainboard", 96, "Filler Spell", "Instant", 1, ""),
    ]),
    async () => ({
      source: "Commander Spellbook",
      lookupStatus: "ok",
      exactCount: 1,
      finisherCount: 0,
      engineCount: 1,
      nearMissCount: 0,
      exact: [
        {
          id: "isochron-reversal",
          comboValue: 1.3,
          lineType: "engine",
          cardNames: ["Dramatic Reversal", "Isochron Scepter"],
          outcomeNames: ["Infinite mana nonland permanents you control can produce"],
          description: "Infinite mana loop.",
          manaNeeded: "",
          notablePrerequisites: ["Nonland permanents you control can tap to produce at least {3}."],
          bracketTag: "S",
          variantCount: 1,
          commanderInvolved: false,
        },
      ],
    }),
  );

  assert.equal(analysis.combos.exactCount, 1);
  assert.ok(analysis.counts.combo > 0);
  assert.ok(analysis.finisherScore > 40);
  assert.ok(
    analysis.findings.some((finding) => finding.code === "combo_engines_present"),
  );
});

test("analyzeDeckWinConditions recognizes commanders that convert infinite mana", async () => {
  const analysis = await analyzeDeckWinConditions(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Thrasios, Triton Hero",
        "Legendary Creature - Merfolk Wizard",
        2,
        "{4}: Scry 1, then reveal the top card of your library. If it's a land card, put it onto the battlefield tapped. Otherwise draw a card.",
        { color_identity: ["G", "U"] },
      ),
      createResolvedCard("mainboard", 1, "Basalt Monolith", "Artifact", 3, ""),
      createResolvedCard("mainboard", 1, "Rings of Brighthearth", "Artifact", 3, ""),
      createResolvedCard("mainboard", 97, "Filler Spell", "Instant", 1, ""),
    ]),
    async () => ({
      source: "Commander Spellbook",
      lookupStatus: "ok",
      exactCount: 1,
      finisherCount: 0,
      engineCount: 1,
      nearMissCount: 0,
      exact: [
        {
          id: "basalt-rings",
          comboValue: 1.2,
          lineType: "engine",
          cardNames: ["Basalt Monolith", "Rings of Brighthearth"],
          outcomeNames: ["Infinite colorless mana"],
          description: "Infinite colorless mana.",
          manaNeeded: "",
          notablePrerequisites: [],
          bracketTag: "B",
          variantCount: 1,
          commanderInvolved: false,
        },
      ],
    }),
  );

  assert.ok(
    analysis.findings.some((finding) => finding.code === "combo_engines_command_zone_sink"),
  );
  assert.ok(analysis.counts.combo > 1.2);
  assert.ok(analysis.finisherScore > 40);
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

function createEmptyComboLookup() {
  return async () =>
    ({
      source: "Commander Spellbook",
      lookupStatus: "ok",
      exactCount: 0,
      finisherCount: 0,
      engineCount: 0,
      nearMissCount: 0,
      exact: [],
    }) satisfies DeckWinConditionComboLookup;
}
