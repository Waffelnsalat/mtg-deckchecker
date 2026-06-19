import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckPower } from "./powerAnalysis";

test("analyzeDeckPower pushes tuned combo shells into the top tier", () => {
  const analysis = analyzeDeckPower(
    createInput({
      commander: {
        impactScore: 88,
        dependencyScore: 82,
        ceilingScore: 93,
        commanderInvolvedCombos: 2,
        prior: {
          score: 16,
        },
        counts: {
          mana: 1.8,
          cards: 0.9,
          tutors: 0,
          interaction: 0,
          protection: 0,
          recursion: 0,
          combo: 1.7,
          finisher: 0.5,
          tokens: 0.4,
          costReduction: 0.2,
        },
      },
      structure: {
        structureScore: 82,
        mana: {
          averageManaValue: 2.1,
          shares: {
            early: 0.46,
            late: 0.12,
          },
        },
      },
      landBase: {
        landBaseScore: 84,
      },
      ramp: {
        rampScore: 88,
      },
      draw: {
        drawScore: 72,
      },
      consistency: {
        consistencyScore: 91,
        counts: {
          direct: 6.2,
          repeatable: 2.6,
        },
        recommendations: {
          directTarget: 4,
          repeatableTarget: 1.5,
        },
      },
      gameChangers: {
        counts: {
          total: 3,
        },
      },
      protection: {
        protectionScore: 56,
      },
      recursion: {
        recursionScore: 44,
      },
      winConditions: {
        finisherScore: 89,
        combos: {
          lookupStatus: "ok",
          exactCount: 2,
          finisherCount: 1,
          engineCount: 1,
        },
      },
      removal: {
        removalScore: 68,
      },
      spellInteraction: {
        interactionScore: 88,
      },
      strategy: {
        mainStrategy: { label: "Combo" },
        synergy: {
          synergyScore: 86,
          commanderAligned: true,
        },
      },
      winStrategy: {
        primaryPlan: { key: "infinite_combo", label: "Infinite Combo" },
      },
    }) as any,
  );

  assert.equal(analysis.powerTier, "cEDH-Adjacent");
  assert.ok(analysis.powerScore >= 8.5);
  assert.ok((analysis.dimensions.find((entry) => entry.key === "closing")?.score ?? 0) >= 85);
  assert.ok(analysis.strengths.some((entry) => entry.includes("combo")));
});

test("analyzeDeckPower keeps fair, coherent decks in the focused band", () => {
  const analysis = analyzeDeckPower(
    createInput({
      commander: {
        impactScore: 58,
        dependencyScore: 48,
        ceilingScore: 61,
        commanderInvolvedCombos: 0,
        prior: {
          score: 0,
        },
        counts: {
          mana: 0.5,
          cards: 0.7,
          tutors: 0,
          interaction: 0.2,
          protection: 0.4,
          recursion: 0,
          combo: 0,
          finisher: 0.4,
          tokens: 0.3,
          costReduction: 0,
        },
      },
      structure: {
        structureScore: 76,
        mana: {
          averageManaValue: 3,
          shares: {
            early: 0.34,
            late: 0.2,
          },
        },
      },
      landBase: {
        landBaseScore: 74,
      },
      ramp: {
        rampScore: 71,
      },
      draw: {
        drawScore: 68,
      },
      consistency: {
        consistencyScore: 54,
        counts: {
          direct: 1.1,
          repeatable: 0.7,
        },
        recommendations: {
          directTarget: 2.5,
          repeatableTarget: 1.2,
        },
      },
      gameChangers: {
        counts: {
          total: 1,
        },
      },
      protection: {
        protectionScore: 58,
      },
      recursion: {
        recursionScore: 54,
      },
      winConditions: {
        finisherScore: 66,
        combos: {
          lookupStatus: "ok",
          exactCount: 0,
          finisherCount: 0,
          engineCount: 0,
        },
      },
      removal: {
        removalScore: 61,
      },
      spellInteraction: {
        interactionScore: 57,
      },
      strategy: {
        mainStrategy: { label: "Tokens" },
        synergy: {
          synergyScore: 73,
          commanderAligned: true,
        },
      },
      winStrategy: {
        primaryPlan: { key: "go_wide_combat", label: "Go-Wide Combat" },
      },
    }) as any,
  );

  assert.equal(analysis.powerTier, "Focused");
  assert.ok(analysis.powerScore >= 5.2 && analysis.powerScore < 6.7);
  assert.equal(analysis.findings.length, 6);
});

test("analyzeDeckPower keeps baseline fair shells out of the upper sixes by default", () => {
  const analysis = analyzeDeckPower(createInput() as any);

  assert.equal(analysis.powerTier, "Focused");
  assert.ok(analysis.powerScore <= 6.1);
});

test("analyzeDeckPower does not let finishers hide a weak shell", () => {
  const analysis = analyzeDeckPower(
    createInput({
      commander: {
        impactScore: 29,
        dependencyScore: 34,
        ceilingScore: 37,
        commanderInvolvedCombos: 0,
        prior: {
          score: 0,
        },
        counts: {
          mana: 0,
          cards: 0.2,
          tutors: 0,
          interaction: 0,
          protection: 0,
          recursion: 0,
          combo: 0,
          finisher: 0.1,
          tokens: 0,
          costReduction: 0,
        },
      },
      structure: {
        structureScore: 41,
        mana: {
          averageManaValue: 4.3,
          shares: {
            early: 0.19,
            late: 0.35,
          },
        },
        counts: {
          lands: 33,
        },
      },
      landBase: {
        landBaseScore: 36,
        counts: {
          alwaysTapped: 8,
          colorlessOnly: 6,
        },
      },
      ramp: {
        rampScore: 32,
      },
      draw: {
        drawScore: 34,
      },
      consistency: {
        consistencyScore: 28,
        counts: {
          direct: 0,
          repeatable: 0.3,
        },
        recommendations: {
          directTarget: 2,
          repeatableTarget: 1,
        },
      },
      protection: {
        protectionScore: 26,
      },
      recursion: {
        recursionScore: 31,
      },
      winConditions: {
        finisherScore: 77,
      },
      removal: {
        removalScore: 33,
      },
      spellInteraction: {
        interactionScore: 24,
      },
      strategy: {
        mainStrategy: { label: "Big Mana" },
        synergy: {
          synergyScore: 51,
          commanderAligned: false,
        },
      },
      winStrategy: {
        primaryPlan: { key: "big_mana_haymakers", label: "Big Mana Haymakers" },
      },
    }) as any,
  );

  assert.equal(analysis.powerTier, "Casual");
  assert.ok(analysis.powerScore < 4.5);
  assert.ok(
    (analysis.dimensions.find((entry) => entry.key === "closing")?.score ?? 0) >
      (analysis.dimensions.find((entry) => entry.key === "mana")?.score ?? 100),
  );
});

test("analyzeDeckPower gives real credit to high-impact commanders without replacing shell quality", () => {
  const weakCommander = analyzeDeckPower(
    createInput({
      commander: {
        impactScore: 34,
        dependencyScore: 28,
        ceilingScore: 39,
        commanderInvolvedCombos: 0,
        prior: {
          score: 0,
        },
        counts: {
          mana: 0,
          cards: 0.2,
          tutors: 0,
          interaction: 0,
          protection: 0,
          recursion: 0,
          combo: 0,
          finisher: 0.2,
          tokens: 0,
          costReduction: 0,
        },
      },
      strategy: {
        mainStrategy: { label: "Artifacts" },
        synergy: {
          synergyScore: 74,
          commanderAligned: false,
        },
      },
    }) as any,
  );
  const strongCommander = analyzeDeckPower(
    createInput({
      commander: {
        impactScore: 87,
        dependencyScore: 79,
        ceilingScore: 92,
        commanderInvolvedCombos: 2,
        prior: {
          score: 16,
        },
        counts: {
          mana: 1.7,
          cards: 1,
          tutors: 0.2,
          interaction: 0.2,
          protection: 0,
          recursion: 0,
          combo: 1.6,
          finisher: 0.5,
          tokens: 0.4,
          costReduction: 0.2,
        },
      },
      strategy: {
        mainStrategy: { label: "Artifacts" },
        synergy: {
          synergyScore: 74,
          commanderAligned: true,
        },
      },
      winConditions: {
        combos: {
          lookupStatus: "ok",
          exactCount: 2,
          finisherCount: 0,
          engineCount: 2,
        },
      },
    }) as any,
  );

  assert.ok(strongCommander.powerScore > weakCommander.powerScore + 0.4);
  assert.ok(strongCommander.strengths.some((entry) => entry.includes("command zone")));
});

test("analyzeDeckPower keeps resilient fair shells out of the high-power band by default", () => {
  const analysis = analyzeDeckPower(
    createInput({
      commander: {
        impactScore: 40.2,
        dependencyScore: 41.6,
        ceilingScore: 51.2,
        commanderInvolvedCombos: 0,
        prior: {
          score: 0,
        },
        counts: {
          mana: 0.4,
          cards: 0,
          tutors: 0,
          interaction: 0,
          protection: 0,
          recursion: 0,
          combo: 0,
          finisher: 0,
          tokens: 0,
          costReduction: 0,
        },
      },
      structure: {
        structureScore: 99,
        mana: {
          averageManaValue: 2.55,
          shares: {
            early: 0.42,
            late: 0.12,
          },
        },
      },
      landBase: {
        landBaseScore: 90,
      },
      ramp: {
        rampScore: 67,
      },
      draw: {
        drawScore: 34,
      },
      consistency: {
        consistencyScore: 54,
        counts: {
          direct: 0.4,
          repeatable: 0.8,
        },
        recommendations: {
          directTarget: 2,
          repeatableTarget: 1,
        },
      },
      protection: {
        protectionScore: 91,
      },
      recursion: {
        recursionScore: 85,
      },
      winConditions: {
        finisherScore: 75,
        combos: {
          lookupStatus: "ok",
          exactCount: 0,
          finisherCount: 0,
          engineCount: 0,
        },
      },
      removal: {
        removalScore: 57,
      },
      spellInteraction: {
        interactionScore: 34,
      },
      strategy: {
        mainStrategy: { label: "Reanimator" },
        synergy: {
          synergyScore: 82,
          commanderAligned: false,
        },
      },
      winStrategy: {
        primaryPlan: { key: "graveyard_pressure", label: "Graveyard Pressure" },
      },
    }) as any,
  );

  assert.equal(analysis.powerTier, "Focused");
  assert.ok(analysis.powerScore < 6.3);
  assert.ok((analysis.dimensions.find((entry) => entry.key === "interaction")?.score ?? 100) < 50);
});

test("analyzeDeckPower does not let one clunky multi-card combo push a precon-style shell into bracket four territory", () => {
  const analysis = analyzeDeckPower(
    createInput({
      commander: {
        impactScore: 25.3,
        dependencyScore: 42.8,
        ceilingScore: 33.1,
        commanderInvolvedCombos: 0,
        prior: {
          score: 0,
        },
        counts: {
          mana: 0.1,
          cards: 0,
          tutors: 0,
          interaction: 0,
          protection: 0.2,
          recursion: 0.6,
          combo: 0,
          finisher: 0.2,
          tokens: 0.2,
          costReduction: 0,
        },
      },
      structure: {
        structureScore: 80,
        mana: {
          averageManaValue: 3,
          shares: {
            early: 0.36,
            late: 0.18,
          },
          recommendedLands: {
            target: 36,
          },
        },
      },
      landBase: {
        landBaseScore: 88,
      },
      ramp: {
        rampScore: 81,
      },
      draw: {
        drawScore: 26,
      },
      consistency: {
        consistencyScore: 64.7,
        counts: {
          direct: 0,
          repeatable: 0.4,
        },
        recommendations: {
          directTarget: 2,
          repeatableTarget: 1,
        },
      },
      protection: {
        protectionScore: 45,
      },
      recursion: {
        recursionScore: 82,
      },
      winConditions: {
        finisherScore: 91,
        combos: {
          lookupStatus: "ok",
          exactCount: 1,
          finisherCount: 1,
          engineCount: 0,
          exact: [
            {
              id: "combo-0",
              comboValue: 1.65,
              lineType: "finisher",
              cardNames: ["Darksteel Reactor", "Dawnsire, Sunstar Dreadnought", "Resourceful Defense"],
              outcomeNames: ["Win the game"],
              description: "",
              notablePrerequisites: ["Dawnsire has twenty or more charge counters on it."],
              variantCount: 1,
              commanderInvolved: false,
            },
          ],
        },
      },
      removal: {
        removalScore: 27,
      },
      spellInteraction: {
        interactionScore: 43,
      },
      strategy: {
        mainStrategy: { label: "Counters (Charge)" },
        synergy: {
          synergyScore: 100,
          commanderAligned: true,
        },
      },
      winStrategy: {
        primaryPlan: { key: "go_wide_combat", label: "Go-Wide Combat" },
      },
    }) as any,
  );

  assert.equal(analysis.powerTier, "Focused");
  assert.ok(analysis.powerScore < 6.4);
});

function createInput(overrides: any = {}) {
  return deepMerge(
    {
      structure: {
        structureScore: 70,
        summary: "",
        counts: {
          lands: 36,
        },
        mana: {
          averageManaValue: 3,
          shares: {
            early: 0.33,
            late: 0.18,
          },
          recommendedLands: {
            target: 36,
          },
        },
      },
      landBase: {
        landBaseScore: 70,
        counts: {
          alwaysTapped: 3,
          colorlessOnly: 2,
        },
        recommendations: {
          alwaysTappedMax: 4,
          colorlessOnlyMax: 3,
        },
      },
      ramp: {
        rampScore: 68,
      },
      commander: {
        summary: "",
        impactScore: 50,
        dependencyScore: 45,
        ceilingScore: 52,
        commanderInvolvedCombos: 0,
        prior: {
          matched: [],
          score: 0,
        },
        counts: {
          mana: 0.3,
          cards: 0.4,
          tutors: 0,
          interaction: 0.1,
          protection: 0.1,
          recursion: 0,
          combo: 0,
          finisher: 0.2,
          tokens: 0,
          costReduction: 0,
        },
        keyRoles: [],
        findings: [],
        taggedCommanders: [],
      },
      draw: {
        drawScore: 65,
        counts: {
          draw: 8,
          repeatable: 2,
        },
      },
      consistency: {
        consistencyScore: 52,
        counts: {
          direct: 1,
          repeatable: 0.8,
        },
        recommendations: {
          directTarget: 2,
          repeatableTarget: 1,
        },
      },
      gameChangers: {
        counts: {
          total: 0,
        },
      },
      protection: {
        protectionScore: 52,
        counts: {
          broad: 1,
        },
        recommendations: {
          broadTarget: 1.4,
        },
      },
      recursion: {
        recursionScore: 45,
        counts: {
          replay: 0.5,
        },
        recommendations: {
          replayTarget: 1.5,
        },
      },
      winConditions: {
        finisherScore: 62,
        combos: {
          lookupStatus: "ok",
          exactCount: 0,
          finisherCount: 0,
          engineCount: 0,
        },
      },
      removal: {
        removalScore: 56,
      },
      spellInteraction: {
        interactionScore: 48,
      },
      strategy: {
        mainStrategy: { label: "Midrange" },
        synergy: {
          synergyScore: 68,
          commanderAligned: true,
        },
        perspectives: [],
      },
      winStrategy: {
        primaryPlan: { key: "value_attrition", label: "Value Attrition" },
      },
    },
    overrides,
  );
}

function deepMerge(base: any, overrides: any): any {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    return overrides ?? base;
  }

  const output = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof output[key] === "object" &&
      output[key] !== null &&
      !Array.isArray(output[key])
    ) {
      output[key] = deepMerge(output[key], value);
      continue;
    }

    output[key] = value;
  }

  return output;
}
