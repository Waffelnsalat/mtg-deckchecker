import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckWeaknesses } from "./weaknessAnalysis";

test("analyzeDeckWeaknesses flags reanimator shells as soft to graveyard hate", () => {
  const analysis = analyzeDeckWeaknesses(createInput({
    strategyKey: "reanimator",
    strategyLabel: "Reanimator",
    winPlanKey: "graveyard_pressure",
    recursionCore: 8,
    recursionReplay: 3,
    supportCards: 18,
    targetedRemoval: 1,
    broadStack: 0,
  }));

  const graveyard = analysis.exposures.find((entry) => entry.key === "graveyard_hate");
  assert.ok(graveyard);
  assert.equal(graveyard.severity, "high");
  assert.ok(graveyard.weakAgainst.some((entry) => /graveyard hate/i.test(entry)));
});

test("analyzeDeckWeaknesses notices board-wipe risk when creature boards lack protection", () => {
  const analysis = analyzeDeckWeaknesses(createInput({
    strategyKey: "tokens",
    strategyLabel: "Tokens",
    winPlanKey: "go_wide_combat",
    creatures: 34,
    supportCards: 20,
    broadProtection: 0,
    massRecursion: 0,
  }));

  const boardWipes = analysis.exposures.find((entry) => entry.key === "board_wipes");
  assert.ok(boardWipes);
  assert.ok(boardWipes.vulnerabilityScore >= 68);
  assert.ok(boardWipes.answerGaps.some((entry) => /protection|rebuild/i.test(entry)));
});

test("analyzeDeckWeaknesses can mark a covered axis as resistant instead of weak", () => {
  const analysis = analyzeDeckWeaknesses(createInput({
    strategyKey: "tokens",
    strategyLabel: "Tokens",
    winPlanKey: "go_wide_combat",
    creatures: 28,
    supportCards: 12,
    broadProtection: 4,
    massRecursion: 2,
    battlefieldRecursion: 3,
  }));

  assert.ok(!analysis.exposures.some((entry) => entry.key === "board_wipes" && entry.severity === "high"));
  assert.ok(analysis.resistantTo.some((entry) => /Board Wipes/i.test(entry)));
});

function createInput(overrides: Record<string, any> = {}) {
  const strategy = {
    key: overrides.strategyKey ?? "control",
    label: overrides.strategyLabel ?? "Control",
    score: 70,
    rawScore: 12,
    confidence: 80,
    keyCards: [],
    reasons: [],
  };

  return {
    power: {
      powerScore: 6.2,
      powerIndex: 62,
      powerTier: "Focused",
      summary: "Test power.",
      dimensions: [
        { key: "speed", label: "Speed", score: overrides.speed ?? 55, summary: "" },
        { key: "consistency", label: "Consistency", score: 60, summary: "" },
        { key: "interaction", label: "Interaction", score: overrides.interaction ?? 50, summary: "" },
        { key: "resilience", label: "Resilience", score: overrides.resilience ?? 50, summary: "" },
        { key: "closing", label: "Closing Power", score: 62, summary: "" },
        { key: "mana", label: "Mana Quality", score: 58, summary: "" },
      ],
      strengths: [],
      weaknesses: [],
      findings: [],
    },
    strategy: {
      summary: "Test strategy.",
      detectedMainStrategy: strategy,
      mainStrategy: strategy,
      subStrategies: [],
      topStrategies: [strategy],
      synergy: {
        synergyScore: 70,
        summary: "Test synergy.",
        supportCards: overrides.supportCards ?? 10,
        coreCards: overrides.coreCards ?? 5,
        focusScore: 70,
        commanderAligned: true,
        finisherAligned: true,
        recommendations: {
          supportTarget: 10,
          coreTarget: 5,
        },
        findings: [],
      },
      perspectives: [],
    },
    winStrategy: {
      summary: "Test win strategy.",
      primaryPlan: {
        key: overrides.winPlanKey ?? "value_attrition",
        label: overrides.winPlanLabel ?? "Value Attrition",
        summary: "",
        reasons: [],
        keyCards: [],
      },
      backupPlans: [],
      perspectives: [],
    },
    structure: {
      structureScore: 60,
      summary: "Test structure.",
      commanderName: "Test Commander",
      counts: {
        lands: 36,
        creatures: overrides.creatures ?? 12,
        artifacts: overrides.artifacts ?? 6,
        enchantments: overrides.enchantments ?? 4,
        instants: 8,
        sorceries: 8,
        planeswalkers: 0,
        battles: 0,
        other: 0,
        nonlandSpells: 63,
      },
      mana: {
        averageManaValue: 3,
        medianManaValue: 3,
        recommendedLands: { min: 35, max: 38, target: 36 },
        curve: { zeroToOne: 5, two: 12, three: 16, four: 12, five: 8, sixPlus: 4 },
        shares: { early: 0.3, mid: 0.45, late: 0.25 },
      },
      findings: [],
    },
    ramp: {
      rampScore: 60,
      summary: "",
      counts: { core: 8, stable: 7, burst: 0, landAcceleration: 1, manaFixing: 2, costReduction: 0 },
      recommendations: { coreTarget: 8, stableTarget: 6, fixingTarget: 2 },
      findings: [],
      taggedCards: [],
    },
    draw: {
      drawScore: 60,
      summary: "",
      counts: { core: 8, draw: 5, selection: 2, repeatable: overrides.repeatableDraw ?? 1 },
      recommendations: { coreTarget: 8, drawTarget: 5, repeatableTarget: 2 },
      findings: [],
      taggedCards: [],
    },
    consistency: {
      consistencyScore: 55,
      summary: "",
      counts: { core: 3, direct: overrides.directTutors ?? 0, restricted: 1, repeatable: 0, land: 1, selectionSupport: 0 },
      recommendations: { coreTarget: 3, directTarget: 1, repeatableTarget: 0 },
      findings: [],
      taggedCards: [],
    },
    gameChangers: {
      summary: "",
      counts: { total: 0, unique: 0, commander: 0, mainboard: 0, companion: 0 },
      bracket: { bracketOneTwoLegal: true, bracketThreeLegal: true, bracketThreeCap: 3 },
      findings: [],
      taggedCards: [],
    },
    protection: {
      protectionScore: 45,
      summary: "",
      counts: {
        core: 2,
        broad: overrides.broadProtection ?? 0,
        targeted: overrides.targetedProtection ?? 1,
        equipment: overrides.equipmentProtection ?? 0,
        selfBounce: 0,
        flicker: overrides.flickerProtection ?? 0,
      },
      recommendations: { coreTarget: 3, broadTarget: 1, targetedTarget: 2 },
      findings: [],
      taggedCards: [],
    },
    recursion: {
      recursionScore: 45,
      summary: "",
      counts: {
        core: overrides.recursionCore ?? 1,
        battlefield: overrides.battlefieldRecursion ?? 0,
        hand: 0,
        replay: overrides.recursionReplay ?? 0,
        mass: overrides.massRecursion ?? 0,
        library: 0,
      },
      recommendations: { coreTarget: 2, battlefieldTarget: 1, replayTarget: 1 },
      findings: [],
      taggedCards: [],
    },
    winConditions: {
      finisherScore: 60,
      summary: "",
      counts: {
        core: 4,
        combat: overrides.combatFinishers ?? 2,
        direct: overrides.directFinishers ?? 0,
        alternate: 0,
        repeatable: 1,
        combo: overrides.comboFinishers ?? 0,
      },
      recommendations: { coreTarget: 4, combatTarget: 2, directTarget: 1 },
      findings: [],
      taggedCards: [],
      combos: {
        source: "Commander Spellbook",
        lookupStatus: "ok",
        exactCount: 0,
        finisherCount: 0,
        engineCount: 0,
        nearMissCount: 0,
        exact: [],
      },
    },
    removal: {
      removalScore: 50,
      summary: "",
      counts: {
        core: 5,
        targeted: overrides.targetedRemoval ?? 3,
        mass: overrides.massRemoval ?? 1,
        tempo: overrides.tempoRemoval ?? 0,
        handAttack: overrides.handAttack ?? 0,
      },
      recommendations: { coreTarget: 5, targetedTarget: 3, massTarget: 1, tempoTarget: 1, handTarget: 0 },
      findings: [],
      taggedCards: [],
    },
    spellInteraction: {
      interactionScore: 45,
      summary: "",
      counts: {
        core: 2,
        hard: overrides.hardStack ?? 1,
        soft: overrides.softStack ?? 0,
        spellTempo: 0,
        broad: overrides.broadStack ?? 0,
        stax: overrides.stax ?? 0,
        graveyardHate: 0,
      },
      recommendations: { coreTarget: 2, hardTarget: 1, softTarget: 1 },
      findings: [],
      taggedCards: [],
    },
    advancedRoles: {
      taggedCards: [],
    },
  } as any;
}
