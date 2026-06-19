import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckBracket } from "./bracketAnalysis";

test("analyzeDeckBracket keeps fair low-power decks in the lower brackets", () => {
  const analysis = analyzeDeckBracket({
    document: createDocument([]),
    power: createPowerAnalysis(4.4, {
      speed: 42,
      consistency: 48,
      interaction: 44,
      resilience: 45,
      closing: 47,
      mana: 51,
    }),
    gameChangers: createGameChangerAnalysis(0),
    winConditions: createWinConditions(),
  });

  assert.equal(analysis.recommendedBracket, 2);
  assert.equal(analysis.adjustedByRules, false);
});

test("analyzeDeckBracket keeps fair mid-score precon-like shells in bracket 2", () => {
  const analysis = analyzeDeckBracket({
    document: createDocument([]),
    power: createPowerAnalysis(6.1, {
      speed: 51,
      consistency: 47,
      interaction: 41,
      resilience: 63,
      closing: 58,
      mana: 49,
    }),
    gameChangers: createGameChangerAnalysis(0),
    winConditions: createWinConditions(),
  });

  assert.equal(analysis.recommendedBracket, 2);
  assert.equal(analysis.recommendedModifier, "+");
  assert.equal(analysis.adjustedByRules, false);
});

test("analyzeDeckBracket still gives bracket 3 to clearly upgraded fair shells", () => {
  const analysis = analyzeDeckBracket({
    document: createDocument([]),
    power: createPowerAnalysis(6.4, {
      speed: 60,
      consistency: 56,
      interaction: 46,
      resilience: 59,
      closing: 65,
      mana: 61,
    }),
    gameChangers: createGameChangerAnalysis(0),
    winConditions: createWinConditions(),
  });

  assert.equal(analysis.recommendedBracket, 3);
  assert.equal(analysis.adjustedByRules, false);
  assert.match(analysis.summary, /\n- Power read: Bracket 3/);
  assert.match(analysis.summary, /\n- Main drivers:/);
  assert.match(analysis.summary, /\n- Ceiling: Not Bracket 4/);
  assert.ok(analysis.findings.some((finding: any) => finding.code === "bracket_not_higher"));
});

test("analyzeDeckBracket raises the floor to bracket 3 when game changers are present", () => {
  const analysis = analyzeDeckBracket({
    document: createDocument([]),
    power: createPowerAnalysis(4.6, {
      speed: 44,
      consistency: 50,
      interaction: 46,
      resilience: 45,
      closing: 48,
      mana: 52,
    }),
    gameChangers: createGameChangerAnalysis(1),
    winConditions: createWinConditions(),
  });

  assert.equal(analysis.recommendedBracket, 3);
  assert.equal(analysis.recommendedModifier, "-");
  assert.equal(analysis.adjustedByRules, true);
});

test("analyzeDeckBracket raises the floor to bracket 4 for exact two-card combos", () => {
  const analysis = analyzeDeckBracket({
    document: createDocument([]),
    power: createPowerAnalysis(5.8, {
      speed: 60,
      consistency: 66,
      interaction: 52,
      resilience: 48,
      closing: 74,
      mana: 63,
    }),
    gameChangers: createGameChangerAnalysis(0),
    winConditions: createWinConditions({
      exact: [
        {
          cardNames: ["Thassa's Oracle", "Demonic Consultation"],
        },
      ],
    }),
  });

  assert.equal(analysis.signals.twoCardCombos, 1);
  assert.equal(analysis.recommendedBracket, 4);
  assert.equal(analysis.adjustedByRules, true);
  assert.match(analysis.summary, /\n- Power read: Bracket 2\+/);
  assert.match(analysis.summary, /exact two-card combo/);
  assert.match(analysis.summary, /Not Bracket 5/);
  assert.ok(analysis.findings.some((finding: any) => finding.code === "bracket_rules_floor"));
});

test("analyzeDeckBracket does not treat slow lock-only engine loops as two-card bracket floor combos", () => {
  const analysis = analyzeDeckBracket({
    document: createDocument([]),
    power: createPowerAnalysis(5.8, {
      speed: 50,
      consistency: 56,
      interaction: 52,
      resilience: 48,
      closing: 64,
      mana: 52,
    }),
    gameChangers: createGameChangerAnalysis(0),
    winConditions: createWinConditions({
      exact: [
        {
          cardNames: ["Brine Elemental", "Vesuvan Shapeshifter"],
          lineType: "engine",
          outcomeNames: ["Opponents skip their untap steps", "Lock"],
          description: "Repeat infinitely to keep opponents from untapping.",
        },
      ],
    }),
  });

  assert.equal(analysis.signals.twoCardCombos, 0);
  assert.notEqual(analysis.rulesFloor, 4);
});

test("analyzeDeckBracket still treats compact infinite-mana engines as bracket floor combos", () => {
  const analysis = analyzeDeckBracket({
    document: createDocument([]),
    power: createPowerAnalysis(5.8, {
      speed: 55,
      consistency: 58,
      interaction: 52,
      resilience: 48,
      closing: 68,
      mana: 58,
    }),
    gameChangers: createGameChangerAnalysis(0),
    winConditions: createWinConditions({
      exact: [
        {
          cardNames: ["Basalt Monolith", "Rings of Brighthearth"],
          lineType: "engine",
          outcomeNames: ["Infinite colorless mana"],
        },
      ],
    }),
  });

  assert.equal(analysis.signals.twoCardCombos, 1);
  assert.equal(analysis.rulesFloor, 4);
});

test("analyzeDeckBracket keeps bracket 5 reserved for very high-end cEDH signals", () => {
  const analysis = analyzeDeckBracket({
    document: createDocument([]),
    power: createPowerAnalysis(9.4, {
      speed: 84,
      consistency: 87,
      interaction: 74,
      resilience: 63,
      closing: 88,
      mana: 82,
    }, "cEDH-Adjacent"),
    gameChangers: createGameChangerAnalysis(3),
    winConditions: createWinConditions({
      exact: [
        {
          cardNames: ["Thassa's Oracle", "Demonic Consultation"],
        },
        {
          cardNames: ["Underworld Breach", "Lion's Eye Diamond"],
        },
      ],
    }),
  });

  assert.equal(analysis.recommendedBracket, 5);
  assert.equal(analysis.powerBracket, 5);
});

test("analyzeDeckBracket detects extra turns and mass land denial as higher-bracket barometers", () => {
  const analysis = analyzeDeckBracket({
    document: createDocument([
      createResolvedCard(
        "mainboard",
        "Temporal Manipulation",
        "Sorcery",
        "Target player takes an extra turn after this one.",
      ),
      createResolvedCard(
        "mainboard",
        "Armageddon",
        "Sorcery",
        "Destroy all lands.",
      ),
    ]),
    power: createPowerAnalysis(5.2, {
      speed: 55,
      consistency: 54,
      interaction: 50,
      resilience: 44,
      closing: 57,
      mana: 58,
    }),
    gameChangers: createGameChangerAnalysis(0),
    winConditions: createWinConditions(),
  });

  assert.equal(analysis.signals.extraTurns, 1);
  assert.equal(analysis.signals.massLandDenial, 1);
  assert.equal(analysis.recommendedBracket, 4);
});

test("analyzeDeckBracket keeps high-scoring but fair shells in bracket 3 when optimized signals are missing", () => {
  const analysis = analyzeDeckBracket({
    document: createDocument([]),
    power: createPowerAnalysis(7.4, {
      speed: 74,
      consistency: 61,
      interaction: 37,
      resilience: 72,
      closing: 79,
      mana: 80,
    }, "High Power"),
    gameChangers: createGameChangerAnalysis(0),
    winConditions: createWinConditions(),
  });

  assert.equal(analysis.recommendedBracket, 3);
  assert.equal(analysis.recommendedModifier, "");
  assert.equal(analysis.adjustedByRules, false);
  assert.match(analysis.summary, /Not Bracket 4/);
  assert.match(analysis.summary, /power score 7\.4 is below 8\.05/);
  assert.match(analysis.summary, /consistency 61 is below 66/);
});

test("analyzeDeckBracket explains above-target reads without awkward trimming language", () => {
  const analysis = analyzeDeckBracket({
    document: createDocument([]),
    power: createPowerAnalysis(6.4, {
      speed: 55,
      consistency: 75,
      interaction: 76,
      resilience: 59,
      closing: 74,
      mana: 58,
    }),
    gameChangers: createGameChangerAnalysis(0),
    winConditions: createWinConditions(),
    targetBracket: 2,
  });
  const targetFinding = analysis.findings.find(
    (finding: any) => finding.code === "bracket_target_fit",
  );

  assert.equal(analysis.targetAlignment, "above");
  assert.match(analysis.summary, /Target fit: Not Bracket 2 \(Core\) because to fit Bracket 2/);
  assert.match(analysis.summary, /power score would need to stay below 6\.2/);
  assert.match(analysis.summary, /consistency or closing power would need to fall below 60 \/ 64; currently 75 \/ 74/);
  assert.match(analysis.summary, /interaction or consistency would need to fall below 54 \/ 56; currently 76 \/ 75/);
  assert.ok(targetFinding);
  assert.match(targetFinding.message, /current read is Bracket 3/);
  assert.match(targetFinding.message, /Either accept the higher bracket or use lower-pressure swaps/);
  assert.doesNotMatch(targetFinding.message, /trimming speed/);
});

test("analyzeDeckBracket explains why below-target decks are not at the selected bracket yet", () => {
  const analysis = analyzeDeckBracket({
    document: createDocument([]),
    power: createPowerAnalysis(5.7, {
      speed: 49,
      consistency: 51,
      interaction: 41,
      resilience: 48,
      closing: 55,
      mana: 50,
    }),
    gameChangers: createGameChangerAnalysis(0),
    winConditions: createWinConditions(),
    targetBracket: 3,
  });
  const targetFinding = analysis.findings.find(
    (finding: any) => finding.code === "bracket_target_fit",
  );

  assert.equal(analysis.targetAlignment, "below");
  assert.match(analysis.summary, /Target fit: Not Bracket 3 \(Upgraded\) yet because/);
  assert.match(analysis.summary, /speed 49 and consistency 51 are below upgraded pacing/);
  assert.ok(targetFinding);
  assert.match(targetFinding.message, /Recommendations can focus on those gaps/);
});

test("analyzeDeckBracket keeps borderline optimized shells in bracket 3 until they clearly clear the higher gate", () => {
  const analysis = analyzeDeckBracket({
    document: createDocument([]),
    power: createPowerAnalysis(7.95, {
      speed: 80,
      consistency: 72,
      interaction: 58,
      resilience: 63,
      closing: 84,
      mana: 78,
    }, "High Power"),
    gameChangers: createGameChangerAnalysis(1),
    winConditions: createWinConditions({
      exact: [
        {
          cardNames: ["A", "B", "C"],
        },
      ],
    }),
  });

  assert.equal(analysis.recommendedBracket, 3);
  assert.equal(analysis.recommendedModifier, "+");
  assert.equal(analysis.adjustedByRules, false);
});

test("analyzeDeckBracket still gives bracket 4 to truly optimized non-cEDH shells", () => {
  const analysis = analyzeDeckBracket({
    document: createDocument([]),
    power: createPowerAnalysis(8.2, {
      speed: 80,
      consistency: 72,
      interaction: 58,
      resilience: 63,
      closing: 84,
      mana: 78,
    }, "High Power"),
    gameChangers: createGameChangerAnalysis(1),
    winConditions: createWinConditions({
      exact: [
        {
          cardNames: ["A", "B", "C"],
        },
      ],
    }),
  });

  assert.equal(analysis.recommendedBracket, 4);
  assert.equal(analysis.adjustedByRules, false);
});

function createPowerAnalysis(
  powerScore: number,
  dimensions: Record<string, number>,
  powerTier = "Focused",
) {
  return {
    powerScore,
    powerIndex: powerScore * 10,
    powerTier,
    summary: "",
    strengths: [],
    weaknesses: [],
    findings: [],
    dimensions: [
      createDimension("speed", "Speed", dimensions.speed),
      createDimension("consistency", "Consistency", dimensions.consistency),
      createDimension("interaction", "Interaction", dimensions.interaction),
      createDimension("resilience", "Resilience", dimensions.resilience),
      createDimension("closing", "Closing Power", dimensions.closing),
      createDimension("mana", "Mana Quality", dimensions.mana),
    ],
  } as any;
}

function createDimension(key: string, label: string, score: number) {
  return {
    key,
    label,
    score,
    summary: "",
  };
}

function createGameChangerAnalysis(total: number) {
  return {
    summary: "",
    counts: {
      total,
      unique: total,
      commander: 0,
      mainboard: total,
      companion: 0,
    },
    bracket: {
      bracketOneTwoLegal: total === 0,
      bracketThreeLegal: total <= 3,
      bracketThreeCap: 3,
    },
    findings: [],
    taggedCards: [],
  } as any;
}

function createWinConditions(
  overrides: {
    exact?: Array<{
      cardNames: string[];
      lineType?: "finisher" | "engine";
      outcomeNames?: string[];
      description?: string;
    }>;
  } = {},
) {
  const exact = (overrides.exact ?? []).map((combo, index) => ({
    id: `combo-${index}`,
    comboValue: 1.4,
    lineType: combo.lineType ?? "finisher",
    cardNames: combo.cardNames,
    outcomeNames: combo.outcomeNames ?? ["Win the game"],
    description: combo.description ?? "",
    bracketTag: "S",
    variantCount: 1,
    commanderInvolved: false,
  }));

  return {
    finisherScore: 0,
    summary: "",
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
      source: "test",
      lookupStatus: "ok",
      exactCount: exact.length,
      finisherCount: exact.length,
      engineCount: 0,
      nearMissCount: 0,
      exact,
    },
  } as any;
}

function createDocument(resolvedCards: any[]) {
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
      resolvedCards,
      unresolvedCards: [],
      resolvedCount: resolvedCards.length,
      unresolvedCount: 0,
    },
  } as any;
}

function createResolvedCard(
  section: string,
  name: string,
  typeLine: string,
  oracleText: string,
) {
  return {
    quantity: 1,
    section,
    requestedName: name,
    originalLine: `1 ${name}`,
    lineNumber: 1,
    card: {
      id: `${name}-id`,
      name,
      cmc: 4,
      type_line: typeLine,
      oracle_text: oracleText,
      color_identity: [],
      keywords: [],
      layout: "normal",
      scryfall_uri: "https://scryfall.com/card/test",
    },
  };
}
