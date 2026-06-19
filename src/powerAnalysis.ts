import {
  DeckCommanderAnalysis,
  DeckConsistencyAnalysis,
  DeckGameChangerAnalysis,
  DeckLandBaseAnalysis,
  DeckPowerAnalysis,
  DeckPowerDimension,
  DeckPowerDimensionKey,
  DeckPowerTier,
  DeckProtectionAnalysis,
  DeckRampAnalysis,
  DeckRecursionAnalysis,
  DeckRemovalAnalysis,
  DeckSpellInteractionAnalysis,
  DeckStrategyAnalysis,
  DeckStructureAnalysis,
  DeckStructureFinding,
  DeckWinConditionAnalysis,
  DeckWinStrategyAnalysis,
  WinStrategyKey,
} from "./types";

interface DeckPowerInput {
  commander: DeckCommanderAnalysis;
  structure: DeckStructureAnalysis;
  landBase: DeckLandBaseAnalysis;
  ramp: DeckRampAnalysis;
  draw: {
    drawScore: number;
    counts: {
      draw: number;
      repeatable: number;
    };
  };
  consistency: DeckConsistencyAnalysis;
  gameChangers: DeckGameChangerAnalysis;
  protection: DeckProtectionAnalysis;
  recursion: DeckRecursionAnalysis;
  winConditions: DeckWinConditionAnalysis;
  removal: DeckRemovalAnalysis;
  spellInteraction: DeckSpellInteractionAnalysis;
  strategy: DeckStrategyAnalysis;
  winStrategy: DeckWinStrategyAnalysis;
}

const DIMENSION_LABELS: Record<DeckPowerDimensionKey, string> = {
  speed: "Speed",
  consistency: "Consistency",
  interaction: "Interaction",
  resilience: "Resilience",
  closing: "Closing Power",
  mana: "Mana Quality",
};

const WIN_PLAN_TEMPO: Record<WinStrategyKey, number> = {
  infinite_combo: 92,
  commander_damage: 68,
  go_wide_combat: 63,
  extra_combat_pressure: 76,
  drain_burn: 66,
  spell_burst: 82,
  mill_out: 54,
  alternate_win: 60,
  planeswalker_ultimates: 50,
  big_mana_haymakers: 56,
  graveyard_pressure: 58,
  lock_attrition: 48,
  poison: 72,
  value_attrition: 46,
};

const WIN_PLAN_CLOSING: Record<WinStrategyKey, number> = {
  infinite_combo: 95,
  commander_damage: 72,
  go_wide_combat: 69,
  extra_combat_pressure: 80,
  drain_burn: 74,
  spell_burst: 81,
  mill_out: 58,
  alternate_win: 68,
  planeswalker_ultimates: 62,
  big_mana_haymakers: 64,
  graveyard_pressure: 69,
  lock_attrition: 60,
  poison: 77,
  value_attrition: 55,
};

export function analyzeDeckPower(input: DeckPowerInput): DeckPowerAnalysis {
  const strategySynergy =
    input.strategy.synergy?.synergyScore ??
    input.strategy.perspectives[0]?.synergy.synergyScore ??
    0;
  const primaryPlanKey = input.winStrategy.primaryPlan?.key ?? null;
  const planClarity = getPlanClarityScore(input.strategy, input.winStrategy);
  const curveEfficiency = getCurveEfficiencyScore(input.structure);
  const closingTempo = primaryPlanKey === null ? 42 : WIN_PLAN_TEMPO[primaryPlanKey];
  const closingPlanStrength = primaryPlanKey === null ? 44 : WIN_PLAN_CLOSING[primaryPlanKey];
  const exactComboCount =
    input.winConditions.combos.lookupStatus === "ok" ? input.winConditions.combos.exactCount : 0;
  const comboPressure = getComboPressure(input.winConditions);

  const speed = clampScore(
    input.ramp.rampScore * 0.38 +
      input.landBase.landBaseScore * 0.21 +
      curveEfficiency * 0.19 +
      closingTempo * 0.14 +
      Math.min(input.consistency.consistencyScore, 84) * 0.08 +
      input.commander.counts.mana * 2.4 +
      input.commander.counts.costReduction * 1.8 +
      Math.min(input.gameChangers.counts.total, 3) * 1.5 +
      getComboSpeedBonus(comboPressure),
  );

  const consistency = clampScore(
      input.consistency.consistencyScore * 0.52 +
      input.draw.drawScore * 0.24 +
      strategySynergy * 0.16 +
      planClarity * 0.08 +
      input.commander.counts.cards * 2.2 +
      input.commander.counts.tutors * 2 +
      getConsistencyBonus(input.consistency, comboPressure),
  );

  const interaction = clampScore(
    input.removal.removalScore * 0.56 +
      input.spellInteraction.interactionScore * 0.44 +
      input.commander.counts.interaction * 1.4 +
      getInteractionModifier(input.removal.removalScore, input.spellInteraction.interactionScore),
  );

  const resilience = clampScore(
    input.protection.protectionScore * 0.45 +
      input.recursion.recursionScore * 0.35 +
      strategySynergy * 0.12 +
      planClarity * 0.08 +
      input.commander.counts.protection * 1.8 +
      input.commander.counts.recursion * 1.6 +
      getResilienceModifier(input.protection, input.recursion),
  );

  const closing = clampScore(
      input.winConditions.finisherScore * 0.46 +
      strategySynergy * 0.22 +
      closingPlanStrength * 0.18 +
      input.consistency.consistencyScore * 0.1 +
      input.commander.counts.combo * 2.6 +
      input.commander.counts.finisher * 2.2 +
      getClosingModifier(comboPressure, primaryPlanKey),
  );

  const mana = clampScore(
      input.landBase.landBaseScore * 0.58 +
      input.structure.structureScore * 0.24 +
      input.ramp.rampScore * 0.18 +
      input.commander.counts.mana * 1.2 +
      input.commander.counts.costReduction * 1 -
      getManaPenalty(input.structure, input.landBase),
  );

  const dimensions: DeckPowerDimension[] = [
    createDimension("speed", speed, {
      planClarity,
      primaryPlanKey,
      exactComboCount,
      comboPressure,
      strategySynergy,
    }),
    createDimension("consistency", consistency, {
      planClarity,
      primaryPlanKey,
      exactComboCount,
      comboPressure,
      strategySynergy,
    }),
    createDimension("interaction", interaction, {
      planClarity,
      primaryPlanKey,
      exactComboCount,
      comboPressure,
      strategySynergy,
    }),
    createDimension("resilience", resilience, {
      planClarity,
      primaryPlanKey,
      exactComboCount,
      comboPressure,
      strategySynergy,
    }),
    createDimension("closing", closing, {
      planClarity,
      primaryPlanKey,
      exactComboCount,
      comboPressure,
      strategySynergy,
    }),
    createDimension("mana", mana, {
      planClarity,
      primaryPlanKey,
      exactComboCount,
      comboPressure,
      strategySynergy,
    }),
  ];

  let powerIndex =
    speed * 0.21 +
    consistency * 0.2 +
    interaction * 0.19 +
    resilience * 0.11 +
    closing * 0.2 +
    mana * 0.09;

  powerIndex += getPowerAdjustment(input, {
    speed,
    consistency,
    interaction,
    resilience,
    closing,
    mana,
    planClarity,
    exactComboCount,
    comboPressure,
    strategySynergy,
  });
  powerIndex = clampScore(powerIndex);

  const powerScore = mapPowerScore(powerIndex);
  const powerTier = getPowerTier(powerScore);
  const findings = dimensions.map((dimension) => createDimensionFinding(dimension));
  const strengths = buildStrengths(dimensions, input, exactComboCount, comboPressure);
  const weaknesses = buildWeaknesses(dimensions, input, exactComboCount);
  const summary = buildPowerSummary(powerScore, powerTier, strengths, weaknesses);

  return {
    powerScore,
    powerIndex,
    powerTier,
    summary,
    dimensions,
    strengths,
    weaknesses,
    findings,
  };
}

function createDimension(
  key: DeckPowerDimensionKey,
  score: number,
  context: {
    planClarity: number;
    primaryPlanKey: WinStrategyKey | null;
    exactComboCount: number;
    comboPressure: number;
    strategySynergy: number;
  },
): DeckPowerDimension {
  return {
    key,
    label: DIMENSION_LABELS[key],
    score,
    summary: summarizeDimension(key, score, context),
  };
}

function summarizeDimension(
  key: DeckPowerDimensionKey,
  score: number,
  context: {
    planClarity: number;
    primaryPlanKey: WinStrategyKey | null;
    exactComboCount: number;
    comboPressure: number;
    strategySynergy: number;
  },
): string {
  switch (key) {
    case "speed":
      if (score >= 75) {
        return `The shell ramps cleanly, develops mana well, and converts setup into action quickly${context.comboPressure >= 1.9 ? ", with combo pressure on top" : ""}.`;
      }

      if (score >= 55) {
        return "The deck should get moving on a reasonable timeline, but it is not especially explosive.";
      }

      return "The shell looks slower to deploy than stronger tables usually allow.";

    case "consistency":
      if (score >= 75) {
        return "Draw, tutors, and strategy focus make the main plan show up reliably.";
      }

      if (score >= 55) {
        return "The deck can usually find its plan, but the shell still has some variance.";
      }

      return "The shell still looks swingy and may not find the same game plan often enough.";

    case "interaction":
      if (score >= 75) {
        return "Removal and stack interaction together give the deck strong coverage against opposing plans.";
      }

      if (score >= 55) {
        return "The deck can answer some pressure, but the interactive package is not especially dense.";
      }

      return "The shell is light on answers and may struggle to slow stronger decks down.";

    case "resilience":
      if (score >= 75) {
        return "Protection and recursion make the deck relatively hard to knock off its plan.";
      }

      if (score >= 55) {
        return "The deck can recover from some disruption, but it is not built to grind forever.";
      }

      return "Once the deck is disrupted, it does not have much insulation or recovery behind it.";

    case "closing":
      if (score >= 75) {
        return `The deck has a clear route to ending games${context.primaryPlanKey ? ` through ${formatWinPlanLabel(context.primaryPlanKey).toLowerCase()}` : ""}.`;
      }

      if (score >= 55) {
        return "The deck can close games, but the finishing package is still more fair than brutal.";
      }

      return "The shell has trouble turning setup and value into a clean endgame.";

    case "mana":
      if (score >= 75) {
        return "Land quality, curve fit, and ramp support point to a clean mana base.";
      }

      if (score >= 55) {
        return "The mana should function, but it still has some friction in speed or source quality.";
      }

      return "The mana base still looks shaky enough to drag down the rest of the shell.";
  }
}

function createDimensionFinding(dimension: DeckPowerDimension): DeckStructureFinding {
  return {
    code: `power_${dimension.key}`,
    title: dimension.label,
    status: getDimensionStatus(dimension.score),
    message: dimension.summary,
  };
}

function getDimensionStatus(score: number): DeckStructureFinding["status"] {
  if (score >= 72) {
    return "good";
  }

  if (score >= 52) {
    return "note";
  }

  if (score >= 35) {
    return "warning";
  }

  return "risk";
}

function buildStrengths(
  dimensions: DeckPowerDimension[],
  input: DeckPowerInput,
  exactComboCount: number,
  comboPressure: number,
): string[] {
  const dimensionNotes = [...dimensions]
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .filter((dimension) => dimension.score >= 60)
    .map((dimension) => strengthLineForDimension(dimension));

  if (comboPressure >= 2.1 || exactComboCount >= 2) {
    dimensionNotes.unshift(
      `${exactComboCount} exact infinite combo line${exactComboCount === 1 ? "" : "s"} raise the shell's ceiling immediately.`,
    );
  }

  if (input.commander.impactScore >= 75) {
    dimensionNotes.unshift("The command zone is a major engine rather than just a color anchor.");
  }

  if (input.strategy.mainStrategy?.label && input.strategy.synergy?.commanderAligned) {
    dimensionNotes.push(
      `${input.strategy.mainStrategy.label} is meaningfully reinforced by the command zone.`,
    );
  }

  return dedupeStrings(dimensionNotes).slice(0, 3);
}

function buildWeaknesses(
  dimensions: DeckPowerDimension[],
  input: DeckPowerInput,
  exactComboCount: number,
): string[] {
  const dimensionNotes = [...dimensions]
    .sort((left, right) => left.score - right.score)
    .slice(0, 3)
    .filter((dimension) => dimension.score < 68)
    .map((dimension) => weaknessLineForDimension(dimension));

  if (input.strategy.mainStrategy === null || input.winStrategy.primaryPlan === null) {
    dimensionNotes.unshift("The shell still reads a bit mixed, which lowers how cleanly it converts setup into wins.");
  }

  if (input.commander.dependencyScore >= 75 && input.commander.impactScore < 58) {
    dimensionNotes.unshift("The shell leans heavily on the commander without getting enough command-zone payoff back.");
  }

  if (exactComboCount === 0 && input.winConditions.finisherScore < 55) {
    dimensionNotes.push("The deck does not show a very fast or compact fallback kill if the fair plan stalls.");
  }

  return dedupeStrings(dimensionNotes).slice(0, 3);
}

function strengthLineForDimension(dimension: DeckPowerDimension): string {
  switch (dimension.key) {
    case "speed":
      return "Speed is one of the better pillars of the shell.";
    case "consistency":
      return "Consistency is one of the strongest parts of the deck.";
    case "interaction":
      return "The answer package is strong enough to matter in faster games.";
    case "resilience":
      return "Protection and recovery give the shell a real second layer.";
    case "closing":
      return "Closing power is ahead of the rest of the shell.";
    case "mana":
      return "Mana quality is one of the cleaner parts of the list.";
  }
}

function weaknessLineForDimension(dimension: DeckPowerDimension): string {
  switch (dimension.key) {
    case "speed":
      return "Speed is one of the main brakes on the current ceiling.";
    case "consistency":
      return "Consistency is still too soft for a higher power read.";
    case "interaction":
      return "Interaction is the weakest pillar right now.";
    case "resilience":
      return "The shell still folds too easily once key pieces get answered.";
    case "closing":
      return "The deck still needs a cleaner way to actually end games.";
    case "mana":
      return "Mana quality is still dragging the rest of the shell down.";
  }
}

function buildPowerSummary(
  powerScore: number,
  powerTier: DeckPowerTier,
  strengths: string[],
  weaknesses: string[],
): string {
  const strength = strengths[0] ?? "The shell is reasonably balanced.";
  const weakness = weaknesses[0] ?? "No single pillar falls far behind the others.";

  return `This currently reads as ${powerTier} at ${powerScore}/10. ${strength} ${weakness}`;
}

function getPowerTier(score: number): DeckPowerTier {
  if (score < 4.5) {
    return "Casual";
  }

  if (score < 7) {
    return "Focused";
  }

  if (score < 8.6) {
    return "High Power";
  }

  return "cEDH-Adjacent";
}

function getCurveEfficiencyScore(structure: DeckStructureAnalysis): number {
  let score = 74;
  score += clampValue((structure.mana.shares.early - 0.3) * 55, -10, 12);
  score -= clampValue((structure.mana.shares.late - 0.2) * 70, 0, 16);
  score -= clampValue((structure.mana.averageManaValue - 2.9) * 18, 0, 18);

  if (structure.mana.averageManaValue <= 2.4) {
    score += 6;
  } else if (structure.mana.averageManaValue >= 4.2) {
    score -= 8;
  }

  return clampScore(score);
}

function getPlanClarityScore(
  strategy: DeckStrategyAnalysis,
  winStrategy: DeckWinStrategyAnalysis,
): number {
  const hasMainStrategy = strategy.mainStrategy !== null;
  const hasPrimaryPlan = winStrategy.primaryPlan !== null;
  const synergy = strategy.synergy?.synergyScore ?? strategy.perspectives[0]?.synergy.synergyScore ?? 0;

  if (hasMainStrategy && hasPrimaryPlan) {
    return clampScore(60 + synergy * 0.35);
  }

  if (hasMainStrategy || hasPrimaryPlan) {
    return clampScore(44 + synergy * 0.28);
  }

  return clampScore(28 + synergy * 0.18);
}

function getComboSpeedBonus(comboPressure: number): number {
  if (comboPressure <= 0) {
    return 0;
  }

  return Math.min(5.2, comboPressure * 1.25);
}

function getConsistencyBonus(
  consistency: DeckConsistencyAnalysis,
  comboPressure: number,
): number {
  let modifier = 0;

  if (
    comboPressure >= 1.8 &&
    consistency.counts.direct >= consistency.recommendations.directTarget * 0.8
  ) {
    modifier += 2.1;
  }

  if (consistency.counts.repeatable >= consistency.recommendations.repeatableTarget) {
    modifier += 1.5;
  }

  return modifier;
}

function getComboPressure(winConditions: DeckWinConditionAnalysis) {
  const exactCombos = winConditions.combos.exact ?? [];

  if (winConditions.combos.lookupStatus !== "ok" || exactCombos.length === 0) {
    return 0;
  }

  let pressure = 0;

  for (const [index, combo] of exactCombos.slice(0, 5).entries()) {
    const uniqueCards = new Set(combo.cardNames.map((name) => name.toLowerCase())).size;
    const prerequisiteCount = combo.notablePrerequisites?.length ?? 0;
    let linePressure = combo.comboValue;

    if (combo.lineType === "finisher") {
      linePressure += 0.18;
    } else {
      linePressure -= 0.08;
    }

    if (uniqueCards <= 2) {
      linePressure += 0.5;
    } else if (uniqueCards === 3) {
      linePressure -= 0.28;
    } else if (uniqueCards >= 4) {
      linePressure -= 0.48;
    }

    linePressure -= Math.min(0.5, prerequisiteCount * 0.2);

    if (combo.commanderInvolved) {
      linePressure += 0.18;
    }

    linePressure = clampValue(linePressure, 0.1, 3);

    if (index === 0) {
      pressure += linePressure;
      continue;
    }

    pressure += linePressure * (combo.lineType === "finisher" ? 0.3 : 0.18);
  }

  return roundTo(clampValue(pressure, 0, 5), 2);
}

function getInteractionModifier(removalScore: number, spellInteractionScore: number): number {
  if (removalScore >= 65 && spellInteractionScore >= 65) {
    return 2.5;
  }

  if (removalScore < 35 && spellInteractionScore < 35) {
    return -4;
  }

  return 0;
}

function getResilienceModifier(
  protection: DeckProtectionAnalysis,
  recursion: DeckRecursionAnalysis,
): number {
  let modifier = 0;

  if (protection.counts.broad >= protection.recommendations.broadTarget) {
    modifier += 1.5;
  }

  if (recursion.counts.replay >= recursion.recommendations.replayTarget * 0.8) {
    modifier += 1.5;
  }

  return modifier;
}

function getClosingModifier(
  comboPressure: number,
  primaryPlanKey: WinStrategyKey | null,
): number {
  let modifier = 0;

  if (comboPressure > 0) {
    modifier += Math.min(4.5, comboPressure * 1.6);
  }

  if (primaryPlanKey !== null) {
    modifier += WIN_PLAN_CLOSING[primaryPlanKey] * 0.04;
  }

  return modifier;
}

function getManaPenalty(
  structure: DeckStructureAnalysis,
  landBase: DeckLandBaseAnalysis,
): number {
  const landGap = Math.abs(structure.counts.lands - structure.mana.recommendedLands.target);
  let penalty = Math.max(0, landGap - 1) * 2.4;

  if (landBase.counts.colorlessOnly > landBase.recommendations.colorlessOnlyMax) {
    penalty += 3;
  }

  if (landBase.counts.alwaysTapped > landBase.recommendations.alwaysTappedMax) {
    penalty += 3;
  }

  return penalty;
}

function getPowerAdjustment(
  input: DeckPowerInput,
  context: {
    speed: number;
    consistency: number;
    interaction: number;
    resilience: number;
    closing: number;
    mana: number;
    planClarity: number;
    exactComboCount: number;
    comboPressure: number;
    strategySynergy: number;
  },
): number {
  let adjustment = 0;

  if (context.comboPressure > 0) {
    adjustment += Math.min(4, 0.8 + context.comboPressure * 1.1);
  }

  adjustment += (input.commander.impactScore - 50) * 0.015;
  adjustment += (input.commander.ceilingScore - 50) * 0.02;
  adjustment += input.commander.prior.score * 0.08;

  if (input.commander.commanderInvolvedCombos > 0) {
    adjustment += Math.min(2.4, 0.8 + input.commander.commanderInvolvedCombos * 0.6);
  }

  if (input.commander.dependencyScore >= 72 && input.commander.impactScore >= 70) {
    adjustment += 1.4;
  } else if (input.commander.dependencyScore >= 72 && input.commander.impactScore < 55) {
    adjustment -= 2.2;
  }

  if (input.gameChangers.counts.total >= 3) {
    adjustment += 2;
  } else if (input.gameChangers.counts.total >= 1) {
    adjustment += 0.8;
  }

  if (input.strategy.mainStrategy !== null && input.winStrategy.primaryPlan !== null) {
    adjustment += 1;
  } else if (input.strategy.mainStrategy === null && input.winStrategy.primaryPlan === null) {
    adjustment -= 4;
  }

  if (
    context.strategySynergy >= 78 &&
    input.winConditions.finisherScore >= 72 &&
    (context.consistency >= 68 || context.comboPressure >= 2)
  ) {
    adjustment += 1.5;
  }

  if (input.structure.structureScore < 45) {
    adjustment -= 6;
  }

  if (input.ramp.rampScore < 40) {
    adjustment -= 4;
  }

  if (input.draw.drawScore < 40) {
    adjustment -= 4;
  }

  if (context.interaction < 38) {
    adjustment -= 3;
  }

  if (context.exactComboCount === 0 && context.consistency < 60 && context.interaction < 50) {
    adjustment -= 1.2;
  }

  if (context.exactComboCount === 0 && context.resilience >= 80 && context.interaction < 50) {
    adjustment -= 0.8;
  }

  if (context.mana < 42) {
    adjustment -= 3;
  }

  if (context.consistency >= 75 && context.closing >= 75) {
    adjustment += 1.5;
  }

  return adjustment;
}

function formatWinPlanLabel(key: WinStrategyKey): string {
  switch (key) {
    case "infinite_combo":
      return "Infinite Combo";
    case "commander_damage":
      return "Commander Damage";
    case "go_wide_combat":
      return "Go-Wide Combat";
    case "extra_combat_pressure":
      return "Extra Combat Pressure";
    case "drain_burn":
      return "Drain / Burn";
    case "spell_burst":
      return "Spell Burst";
    case "mill_out":
      return "Mill Out";
    case "alternate_win":
      return "Alternate Win";
    case "planeswalker_ultimates":
      return "Planeswalker Ultimates";
    case "big_mana_haymakers":
      return "Big Mana Haymakers";
    case "graveyard_pressure":
      return "Graveyard Pressure";
    case "lock_attrition":
      return "Lock / Attrition";
    case "poison":
      return "Poison";
    case "value_attrition":
      return "Value Attrition";
  }
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function clampScore(value: number): number {
  return roundTo(clampValue(value, 0, 100), 1);
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function mapPowerScore(powerIndex: number): number {
  const baselineScore = 0.85 + powerIndex * 0.083;
  const topEndBonus = Math.max(0, powerIndex - 80) * 0.018;
  return roundTo(clampValue(baselineScore + topEndBonus, 1, 10), 1);
}
