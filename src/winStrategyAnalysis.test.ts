import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckWinStrategy } from "./winStrategyAnalysis";
import {
  DeckResolutionDocument,
  DeckSection,
  DeckStrategyAnalysis,
  DeckStrategyEntry,
  DeckStrategyPerspective,
  DeckWinConditionAnalysis,
  ResolvedDeckCard,
  ScryfallCard,
  StrategyKey,
  WinConditionTag,
  WinConditionTagHit,
} from "./types";

test("analyzeDeckWinStrategy prioritizes infinite combo when exact combo lines exist", () => {
  const analysis = analyzeDeckWinStrategy(
    createDocument([
      createResolvedCard("commander", 1, "Urza, Lord High Artificer", "Legendary Creature - Human Artificer", 4),
      createResolvedCard("mainboard", 1, "Isochron Scepter", "Artifact", 2),
      createResolvedCard("mainboard", 1, "Dramatic Reversal", "Instant", 2),
    ]),
    createStrategyAnalysis("artifacts", ["combo"]),
    createWinConditions({
      combos: {
        exactCount: 1,
        engineCount: 1,
        exact: [
          {
            id: "isochron-reversal",
            comboValue: 1.3,
            lineType: "engine",
            cardNames: ["Dramatic Reversal", "Isochron Scepter"],
            outcomeNames: ["Infinite mana"],
            description: "Infinite mana loop.",
            notablePrerequisites: [],
            variantCount: 1,
            commanderInvolved: false,
          },
        ],
      },
      counts: {
        combo: 1.3,
      },
    }),
  );

  assert.equal(analysis.primaryPlan?.key, "infinite_combo");
  assert.equal(analysis.perspectives.find((entry) => entry.strategyKey === "combo")?.primaryPlan?.key, "infinite_combo");
});

test("analyzeDeckWinStrategy notes commander mana sinks for engine combos", () => {
  const analysis = analyzeDeckWinStrategy(
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
      createResolvedCard("mainboard", 1, "Basalt Monolith", "Artifact", 3),
      createResolvedCard("mainboard", 1, "Rings of Brighthearth", "Artifact", 3),
    ]),
    createStrategyAnalysis("combo", ["artifacts"]),
    createWinConditions({
      combos: {
        exactCount: 1,
        engineCount: 1,
        exact: [
          {
            id: "basalt-rings",
            comboValue: 1.2,
            lineType: "engine",
            cardNames: ["Basalt Monolith", "Rings of Brighthearth"],
            outcomeNames: ["Infinite colorless mana"],
            description: "Infinite colorless mana.",
            notablePrerequisites: [],
            variantCount: 1,
            commanderInvolved: false,
          },
        ],
      },
      counts: {
        combo: 1.2,
      },
    }),
  );

  assert.equal(analysis.primaryPlan?.key, "infinite_combo");
  assert.ok(
    analysis.primaryPlan?.reasons.some((reason) => reason.includes("Thrasios, Triton Hero")),
  );
});

test("analyzeDeckWinStrategy maps voltron shells to commander damage", () => {
  const analysis = analyzeDeckWinStrategy(
    createDocument([
      createResolvedCard("commander", 1, "Rograkh, Son of Rohgahh", "Legendary Creature - Kobold Warrior", 0),
      createResolvedCard("mainboard", 1, "Blackblade Reforged", "Legendary Artifact - Equipment", 2),
      createResolvedCard("mainboard", 1, "Embercleave", "Legendary Artifact - Equipment", 6),
    ]),
    createStrategyAnalysis("voltron", ["aggro"]),
    createWinConditions({
      counts: {
        core: 2.4,
        combat: 1.8,
      },
      taggedCards: [
        createTaggedFinisher("Embercleave", ["combat_finisher"]),
      ],
    }),
  );

  assert.equal(analysis.primaryPlan?.key, "commander_damage");
  assert.ok(analysis.primaryPlan?.keyCards.includes("Rograkh, Son of Rohgahh"));
});

test("analyzeDeckWinStrategy maps superfriends shells to planeswalker ultimates", () => {
  const analysis = analyzeDeckWinStrategy(
    createDocument([
      createResolvedCard("commander", 1, "Atraxa, Praetors' Voice", "Legendary Creature - Phyrexian Angel Horror", 4),
      createResolvedCard("mainboard", 1, "Teferi, Hero of Dominaria", "Legendary Planeswalker - Teferi", 5),
      createResolvedCard("mainboard", 1, "The Chain Veil", "Legendary Artifact", 4),
    ]),
    createStrategyAnalysis("superfriends", ["counters"]),
    createWinConditions({
      counts: {
        core: 1.8,
        repeatable: 1.2,
        alternate: 0.4,
      },
      taggedCards: [
        createTaggedFinisher("Teferi, Hero of Dominaria", ["repeatable_finisher"]),
      ],
    }),
  );

  assert.equal(analysis.primaryPlan?.key, "planeswalker_ultimates");
});

test("analyzeDeckWinStrategy maps reanimator shells to graveyard pressure", () => {
  const analysis = analyzeDeckWinStrategy(
    createDocument([
      createResolvedCard("commander", 1, "Meren of Clan Nel Toth", "Legendary Creature - Human Shaman", 4),
      createResolvedCard("mainboard", 1, "Sheoldred, Whispering One", "Legendary Creature - Phyrexian Praetor", 7),
      createResolvedCard("mainboard", 1, "Reanimate", "Sorcery", 1),
    ]),
    createStrategyAnalysis("reanimator", ["aristocrats"]),
    createWinConditions({
      counts: {
        core: 2.2,
        combat: 1.3,
        direct: 0.6,
      },
      taggedCards: [
        createTaggedFinisher("Sheoldred, Whispering One", ["combat_finisher"]),
      ],
    }),
  );

  assert.equal(analysis.primaryPlan?.key, "graveyard_pressure");
});

test("analyzeDeckWinStrategy promotes poison for counters shells with infect finishers", () => {
  const analysis = analyzeDeckWinStrategy(
    createDocument([
      createResolvedCard("commander", 1, "Atraxa, Praetors' Voice", "Legendary Creature - Phyrexian Angel Horror", 4),
      createResolvedCard(
        "mainboard",
        1,
        "Triumph of the Hordes",
        "Sorcery",
        4,
        "Until end of turn, creatures you control get +1/+1 and gain trample and infect.",
        { keywords: ["Infect"] },
      ),
    ]),
    createStrategyAnalysis("counters", ["tokens"]),
    createWinConditions({
      counts: {
        core: 2.1,
        combat: 1.2,
        alternate: 1,
      },
      taggedCards: [
        createTaggedFinisher("Triumph of the Hordes", ["combat_finisher", "alternate_finisher"]),
      ],
    }),
  );

  assert.equal(analysis.primaryPlan?.key, "poison");
});

function createStrategyAnalysis(
  mainKey: StrategyKey,
  subKeys: StrategyKey[] = [],
): DeckStrategyAnalysis {
  const mainEntry = createStrategyEntry(mainKey, 78, 5.2);
  const subStrategies = subKeys.map((key, index) =>
    createStrategyEntry(key, 58 - index * 6, 2.4 - index * 0.3),
  );
  const perspectives: DeckStrategyPerspective[] = [mainEntry, ...subStrategies].map((entry) => ({
    strategy: entry,
    subStrategies: [mainEntry, ...subStrategies].filter((candidate) => candidate.key !== entry.key).slice(0, 3),
    synergy: {
      synergyScore: 72,
      summary: `${entry.label} is supported well enough to be treated as a real shell.`,
      supportCards: 16,
      coreCards: 7,
      focusScore: 68,
      commanderAligned: true,
      finisherAligned: true,
      recommendations: {
        supportTarget: 12,
        coreTarget: 6,
      },
      findings: [],
    },
  }));

  return {
    summary: `${mainEntry.label} looks like the main plan.`,
    mainStrategy: mainEntry,
    subStrategies,
    topStrategies: [mainEntry, ...subStrategies],
    synergy: perspectives[0].synergy,
    perspectives,
  };
}

function createStrategyEntry(
  key: StrategyKey,
  score: number,
  rawScore: number,
): DeckStrategyEntry {
  return {
    key,
    label: key
      .split("_")
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" "),
    score,
    rawScore,
    confidence: 0.72,
    keyCards: [`${key} support`],
    reasons: [`${key} reason`],
  };
}

function createWinConditions(input: {
  counts?: Partial<DeckWinConditionAnalysis["counts"]>;
  taggedCards?: DeckWinConditionAnalysis["taggedCards"];
  combos?: Partial<DeckWinConditionAnalysis["combos"]>;
}): DeckWinConditionAnalysis {
  return {
    finisherScore: 72,
    summary: "Finishers are present.",
    counts: {
      core: 1.4,
      combat: 0,
      direct: 0,
      alternate: 0,
      repeatable: 0,
      combo: 0,
      ...input.counts,
    },
    recommendations: {
      coreTarget: 2.2,
      combatTarget: 1,
      directTarget: 0.8,
    },
    findings: [],
    taggedCards: input.taggedCards ?? [],
    combos: {
      source: "Commander Spellbook",
      lookupStatus: "ok",
      exactCount: 0,
      finisherCount: 0,
      engineCount: 0,
      nearMissCount: 0,
      exact: [],
      ...input.combos,
    },
  };
}

function createTaggedFinisher(name: string, tags: WinConditionTag[]) {
  return {
    name,
    quantity: 1,
    section: "mainboard" as DeckSection,
    finisherValue: 1,
    hits: tags.map((tag) => ({
      tag,
      weight: 1,
      reason: `${tag} reason`,
    })) satisfies WinConditionTagHit[],
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
