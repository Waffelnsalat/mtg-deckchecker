import {
  DeckBracketAnalysis,
  DeckBracketModifier,
  DeckBracketName,
  DeckBracketNumber,
  DeckGameChangerAnalysis,
  DeckPowerAnalysis,
  DeckPowerDimensionKey,
  DeckResolutionDocument,
  DeckStructureFinding,
  DeckWinConditionAnalysis,
  ScryfallCard,
} from "./types";

interface DeckBracketInput {
  document: DeckResolutionDocument;
  power: DeckPowerAnalysis;
  gameChangers: DeckGameChangerAnalysis;
  winConditions: DeckWinConditionAnalysis;
  targetBracket?: DeckBracketNumber;
}

const BRACKET_NAMES: Record<DeckBracketNumber, DeckBracketName> = {
  1: "Exhibition",
  2: "Core",
  3: "Upgraded",
  4: "Optimized",
  5: "cEDH",
};

const BRACKET_BANDS: Record<
  Exclude<DeckBracketNumber, 5>,
  { min: number; max: number }
> = {
  1: { min: 1, max: 3.4 },
  2: { min: 3.4, max: 6.8 },
  3: { min: 6.8, max: 8.05 },
  4: { min: 8.05, max: 9.25 },
};

const BRACKET_NEAR_SCORE_MARGIN: Partial<Record<DeckBracketNumber, number>> = {
  3: 0.24,
  4: 0.36,
  5: 0.24,
};

const BRACKET_OVER_SCORE_MARGIN: Partial<Record<DeckBracketNumber, number>> = {
  2: 0.36,
  3: 0.36,
};

const BRACKET_GATE_GAP_BUDGETS: Partial<Record<DeckBracketNumber, number>> = {
  3: 14,
  4: 16,
  5: 12,
};

export function analyzeDeckBracket(input: DeckBracketInput): DeckBracketAnalysis {
  const signals = {
    gameChangers: input.gameChangers.counts.total,
    exactCombos: input.winConditions.combos.exactCount,
    twoCardCombos: getTwoCardComboCount(input.winConditions),
    extraTurns: countMatchingCards(input.document, isExtraTurnCard),
    massLandDenial: countMatchingCards(input.document, isMassLandDenialCard),
  };

  const powerBracketInfo = getPowerBracketRead(input.power, signals, input.targetBracket);
  const rulesFloor = getRulesFloor(input.gameChangers, signals);
  const adjustedByRules = rulesFloor > powerBracketInfo.bracket;
  const recommendedBracket = Math.max(powerBracketInfo.bracket, rulesFloor) as DeckBracketNumber;
  const recommendedModifier = adjustedByRules ? "-" : powerBracketInfo.modifier;
  const recommendedLabel = formatBracketLabel(recommendedBracket, recommendedModifier);
  const recommendedName = BRACKET_NAMES[recommendedBracket];
  const targetComparison = input.targetBracket
    ? buildTargetBracketComparison({
        targetBracket: input.targetBracket,
        recommendedBracket,
        power: input.power,
        powerBracketInfo,
        rulesFloor,
        signals,
        gameChangers: input.gameChangers,
      })
    : null;
  const summary = buildBracketSummary({
    recommendedBracket,
    recommendedModifier,
    power: input.power,
    powerBracketInfo,
    rulesFloor,
    signals,
    gameChangers: input.gameChangers,
    targetComparison,
  });
  const findings = buildBracketFindings({
    recommendedBracket,
    recommendedModifier,
    power: input.power,
    powerBracketInfo,
    rulesFloor,
    adjustedByRules,
    signals,
    gameChangers: input.gameChangers,
    targetComparison,
  });

  return {
    summary,
    recommendedBracket,
    recommendedModifier,
    recommendedLabel,
    recommendedName,
    ...(targetComparison
      ? {
          targetBracket: targetComparison.bracket,
          targetLabel: targetComparison.label,
          targetName: targetComparison.name,
          targetDelta: targetComparison.delta,
          targetAlignment: targetComparison.alignment,
          targetSummary: targetComparison.summary,
        }
      : {}),
    powerBracket: powerBracketInfo.bracket,
    powerModifier: powerBracketInfo.modifier,
    powerLabel: formatBracketLabel(powerBracketInfo.bracket, powerBracketInfo.modifier),
    powerName: BRACKET_NAMES[powerBracketInfo.bracket],
    rulesFloor,
    rulesFloorLabel: `Bracket ${rulesFloor} ${BRACKET_NAMES[rulesFloor]}`,
    adjustedByRules,
    signals,
    findings,
  };
}

function getPowerBracketRead(
  power: DeckPowerAnalysis,
  signals: DeckBracketAnalysis["signals"],
  targetBracket?: DeckBracketNumber,
): { bracket: DeckBracketNumber; modifier: DeckBracketModifier } {
  const score = power.powerScore;
  const speed = getDimensionScore(power, "speed");
  const consistency = getDimensionScore(power, "consistency");
  const closing = getDimensionScore(power, "closing");
  const interaction = getDimensionScore(power, "interaction");
  const mana = manaQuality(power);
  const clearsCedhProfile =
    speed >= 78 &&
    consistency >= 78 &&
    closing >= 78 &&
    interaction >= 60;
  const cedhGateGap = getGateGap(
    [
      [speed, 78],
      [consistency, 78],
      [closing, 78],
      [interaction, 60],
    ],
  );
  const hasCedhPressureSignal = signals.exactCombos > 0 || signals.gameChangers >= 2;
  const hasOverwhelmingCedhProfile = score >= 9.6 && clearsCedhProfile;
  const hasCedhSignals =
    (score >= 9.1 && clearsCedhProfile && hasCedhPressureSignal) ||
    hasOverwhelmingCedhProfile ||
    (score >= 9.1 - (BRACKET_NEAR_SCORE_MARGIN[5] ?? 0) &&
      cedhGateGap <= (BRACKET_GATE_GAP_BUDGETS[5] ?? 0) &&
      hasCedhPressureSignal);

  if (hasCedhSignals) {
    return {
      bracket: 5,
      modifier: score >= 9.6 ? "" : "-",
    };
  }

  if (score < BRACKET_BANDS[1].max) {
    return {
      bracket: 1,
      modifier: score >= 2.45 ? "+" : "",
    };
  }

  const upgradedSignals =
    (speed >= 60 && consistency >= 56 && mana >= 54) ||
    (speed >= 58 && closing >= 66 && mana >= 54) ||
    (consistency >= 60 && closing >= 64) ||
    (interaction >= 54 && consistency >= 56) ||
    (signals.exactCombos > 0 &&
      (speed >= 54 || consistency >= 56 || closing >= 70));
  const nearUpgradedSignals =
    score >= BRACKET_BANDS[3].min - (BRACKET_NEAR_SCORE_MARGIN[3] ?? 0) &&
    (getBestUpgradedGateGap({ speed, consistency, closing, interaction, mana, signals }) <=
      (BRACKET_GATE_GAP_BUDGETS[3] ?? 0));

  if (score < BRACKET_BANDS[2].max && !nearUpgradedSignals) {
    return {
      bracket: 2,
      modifier: getBandModifier(score, BRACKET_BANDS[2].min, BRACKET_BANDS[2].max),
    };
  }

  if (
    targetBracket === 2 &&
    score < BRACKET_BANDS[2].max + (BRACKET_OVER_SCORE_MARGIN[2] ?? 0) &&
    (upgradedSignals || nearUpgradedSignals) &&
    !hasHardUpgradePressure(signals)
  ) {
    return {
      bracket: 2,
      modifier: "+",
    };
  }

  if (!upgradedSignals && !nearUpgradedSignals) {
    return {
      bracket: 2,
      modifier: "+",
    };
  }

  const optimizedSignals =
    score >= BRACKET_BANDS[4].min &&
    speed >= 74 &&
    consistency >= 66 &&
    closing >= 78 &&
    (interaction >= 46 || signals.exactCombos > 0 || signals.gameChangers > 0);
  const nearOptimizedSignals =
    score >= BRACKET_BANDS[4].min - (BRACKET_NEAR_SCORE_MARGIN[4] ?? 0) &&
    getOptimizedGateGap({ speed, consistency, closing, interaction, signals }) <=
      (BRACKET_GATE_GAP_BUDGETS[4] ?? 0);

  if (score < BRACKET_BANDS[3].max && !nearOptimizedSignals) {
    return {
      bracket: 3,
      modifier: getBandModifier(score, BRACKET_BANDS[3].min, BRACKET_BANDS[3].max),
    };
  }

  if (
    targetBracket === 3 &&
    score < BRACKET_BANDS[3].max + (BRACKET_OVER_SCORE_MARGIN[3] ?? 0) &&
    (optimizedSignals || nearOptimizedSignals) &&
    !hasHardOptimizedPressure(signals)
  ) {
    return {
      bracket: 3,
      modifier: "+",
    };
  }

  if (!optimizedSignals && !nearOptimizedSignals) {
    return {
      bracket: 3,
      modifier: "+",
    };
  }

  return {
    bracket: 4,
    modifier: score < BRACKET_BANDS[4].min
      ? "-"
      : getBandModifier(score, BRACKET_BANDS[4].min, BRACKET_BANDS[4].max),
  };
}

function hasHardUpgradePressure(signals: DeckBracketAnalysis["signals"]) {
  return signals.gameChangers > 0 || hasHardOptimizedPressure(signals);
}

function hasHardOptimizedPressure(signals: DeckBracketAnalysis["signals"]) {
  return signals.twoCardCombos > 0 || signals.extraTurns > 0 || signals.massLandDenial > 0;
}

function getBestUpgradedGateGap(input: {
  speed: number;
  consistency: number;
  closing: number;
  interaction: number;
  mana: number;
  signals: DeckBracketAnalysis["signals"];
}) {
  const gaps = [
    getGateGap([
      [input.speed, 60],
      [input.consistency, 56],
      [input.mana, 54],
    ]),
    getGateGap([
      [input.speed, 58],
      [input.closing, 66],
      [input.mana, 54],
    ]),
    getGateGap([
      [input.consistency, 60],
      [input.closing, 64],
    ]),
    getGateGap([
      [input.interaction, 54],
      [input.consistency, 56],
    ]),
  ];

  if (input.signals.exactCombos > 0) {
    gaps.push(
      Math.min(
        getGateGap([[input.speed, 54]]),
        getGateGap([[input.consistency, 56]]),
        getGateGap([[input.closing, 70]]),
      ),
    );
  }

  return Math.min(...gaps);
}

function getOptimizedGateGap(input: {
  speed: number;
  consistency: number;
  closing: number;
  interaction: number;
  signals: DeckBracketAnalysis["signals"];
}) {
  return getGateGap([
    [input.speed, 74],
    [input.consistency, 66],
    [input.closing, 78],
    [
      input.signals.exactCombos > 0 || input.signals.gameChangers > 0
        ? 46
        : input.interaction,
      46,
    ],
  ]);
}

function getGateGap(pairs: Array<[actual: number, target: number]>) {
  const value = pairs.reduce((sum, [actual, target]) => sum + Math.max(0, target - actual), 0);
  return Math.round(value * 100) / 100;
}

function getBandModifier(
  score: number,
  min: number,
  max: number,
): DeckBracketModifier {
  const position = (score - min) / (max - min);

  if (position <= 0.28) {
    return "-";
  }

  if (position >= 0.72) {
    return "+";
  }

  return "";
}

function getRulesFloor(
  gameChangers: DeckGameChangerAnalysis,
  signals: DeckBracketAnalysis["signals"],
): DeckBracketNumber {
  let floor: DeckBracketNumber = 1;

  if (gameChangers.counts.total > 0) {
    floor = 3;
  }

  if (!gameChangers.bracket.bracketThreeLegal) {
    floor = 4;
  }

  if (signals.twoCardCombos > 0) {
    floor = 4;
  }

  if (signals.massLandDenial > 0) {
    floor = 4;
  }

  if (signals.extraTurns >= 2) {
    floor = 4;
  }

  return floor;
}

function buildBracketSummary(input: {
  recommendedBracket: DeckBracketNumber;
  recommendedModifier: DeckBracketModifier;
  power: DeckPowerAnalysis;
  powerBracketInfo: { bracket: DeckBracketNumber; modifier: DeckBracketModifier };
  rulesFloor: DeckBracketNumber;
  signals: DeckBracketAnalysis["signals"];
  gameChangers: DeckGameChangerAnalysis;
  targetComparison: TargetBracketComparison | null;
}) {
  const recommendedLabel = formatBracketLabel(
    input.recommendedBracket,
    input.recommendedModifier,
  );
  const recommendedName = BRACKET_NAMES[input.recommendedBracket];
  const powerLabel = formatBracketLabel(
    input.powerBracketInfo.bracket,
    input.powerBracketInfo.modifier,
  );
  const rulesFloorText = describeRulesFloor(
    input.rulesFloor,
    input.signals,
    input.gameChangers,
  );
  const driversText = describeMainBracketDrivers(input.power, input.signals);
  const notHigherText = describeWhyNotHigher({
    recommendedBracket: input.recommendedBracket,
    power: input.power,
    signals: input.signals,
  });
  const lines = [
    `Final read: ${recommendedLabel} (${recommendedName})`,
    `- Power read: ${powerLabel}`,
    `- Rules floor: ${rulesFloorText}`,
    `- Main drivers: ${driversText}`,
  ];

  if (input.targetComparison) {
    lines.push(`- Target fit: ${input.targetComparison.summary}`);
  } else {
    lines.push(`- Ceiling: ${notHigherText}`);
  }

  return lines.join("\n");
}

function buildBracketFindings(input: {
  recommendedBracket: DeckBracketNumber;
  recommendedModifier: DeckBracketModifier;
  power: DeckPowerAnalysis;
  powerBracketInfo: { bracket: DeckBracketNumber; modifier: DeckBracketModifier };
  rulesFloor: DeckBracketNumber;
  adjustedByRules: boolean;
  signals: DeckBracketAnalysis["signals"];
  gameChangers: DeckGameChangerAnalysis;
  targetComparison: TargetBracketComparison | null;
}) {
  const findings: DeckStructureFinding[] = [];

  findings.push({
    code: "bracket_read",
    title: `Recommended bracket: ${formatBracketLabel(input.recommendedBracket, input.recommendedModifier)}`,
    status: getBracketReadFindingStatus(input),
    message: `Power profile reads as ${formatBracketLabel(input.powerBracketInfo.bracket, input.powerBracketInfo.modifier)}. Rules floor is Bracket ${input.rulesFloor}. Final recommendation is ${formatBracketLabel(input.recommendedBracket, input.recommendedModifier)} (${BRACKET_NAMES[input.recommendedBracket]}).`,
  });

  if (input.targetComparison) {
    findings.push({
      code: "bracket_target_fit",
      title: input.targetComparison.findingTitle,
      status: input.targetComparison.findingStatus,
      message: input.targetComparison.findingMessage,
    });
  }

  if (input.adjustedByRules) {
    findings.push({
      code: "bracket_rules_floor",
      title: isTargetAligned(input)
        ? "Bracket barometers support the target bracket"
        : "Bracket floor was raised by barometers",
      status: getTargetAwareFindingStatus(input, "warning"),
      message: `The raw power read looked closer to ${formatBracketLabel(input.powerBracketInfo.bracket, input.powerBracketInfo.modifier)}, but the rules floor is ${describeRulesFloor(input.rulesFloor, input.signals, input.gameChangers)}.`,
    });
  }

  findings.push({
    code: "bracket_not_higher",
    title:
      input.recommendedBracket < 5
        ? `Why this is not Bracket ${((input.recommendedBracket + 1) as DeckBracketNumber)}`
        : "Why this is already Bracket 5",
    status: input.recommendedBracket >= 4 ? "note" : "good",
    message: describeWhyNotHigher({
      recommendedBracket: input.recommendedBracket,
      power: input.power,
      signals: input.signals,
    }),
  });

  if (input.signals.gameChangers > 0) {
    findings.push({
      code: "bracket_game_changers",
      title: isTargetAligned(input)
        ? "Game Changers support the bracket read"
        : "Game Changers affect the bracket floor",
      status: getTargetAwareFindingStatus(
        input,
        input.gameChangers.bracket.bracketThreeLegal ? "note" : "risk",
      ),
      message: input.gameChangers.bracket.bracketThreeLegal
        ? `${input.signals.gameChangers} Game Changer${input.signals.gameChangers === 1 ? "" : "s"} rule the deck out of Bracket 1-2 under the current Commander rules.`
        : `${input.signals.gameChangers} Game Changers exceed the current Bracket 3 cap of ${input.gameChangers.bracket.bracketThreeCap}, so the deck cannot sit below Bracket 4.`,
    });
  }

  if (input.signals.twoCardCombos > 0) {
    findings.push({
      code: "bracket_two_card_combo",
      title: isTargetAligned(input)
        ? "Exact two-card infinite combos support the bracket read"
        : "Exact two-card infinite combos are present",
      status: getTargetAwareFindingStatus(input, "warning"),
      message: `${input.signals.twoCardCombos} exact two-card infinite combo line${input.signals.twoCardCombos === 1 ? "" : "s"} were found. That is treated as an Optimized-level barometer in this bracket read.`,
    });
  }

  if (input.signals.extraTurns > 0) {
    findings.push({
      code: "bracket_extra_turns",
      title: isTargetAligned(input)
        ? "Extra turn cards support the bracket read"
        : "Extra turn cards are present",
      status: getTargetAwareFindingStatus(
        input,
        input.signals.extraTurns >= 2 ? "warning" : "note",
      ),
      message:
        input.signals.extraTurns >= 2
          ? `${input.signals.extraTurns} extra-turn cards were found, which pushes the deck toward higher-bracket expectations.`
          : "At least one extra-turn card was found. It does not hard-lock the bracket by itself, but it does push the read upward.",
    });
  }

  if (input.signals.massLandDenial > 0) {
    findings.push({
      code: "bracket_mass_land_denial",
      title: isTargetAligned(input)
        ? "Mass land denial supports the bracket read"
        : "Mass land denial is present",
      status: getTargetAwareFindingStatus(input, "warning"),
      message: `${input.signals.massLandDenial} mass land denial card${input.signals.massLandDenial === 1 ? "" : "s"} were found, which pushes the deck into higher-bracket expectations.`,
    });
  }

  return findings.slice(0, 6);
}

function getBracketReadFindingStatus(input: {
  recommendedBracket: DeckBracketNumber;
  targetComparison: TargetBracketComparison | null;
}): DeckStructureFinding["status"] {
  if (isTargetAligned(input)) {
    return "good";
  }

  return input.recommendedBracket >= 4 ? "warning" : "note";
}

function getTargetAwareFindingStatus(
  input: {
    recommendedBracket: DeckBracketNumber;
    targetComparison: TargetBracketComparison | null;
  },
  fallbackStatus: DeckStructureFinding["status"],
): DeckStructureFinding["status"] {
  return isTargetAligned(input) ? "note" : fallbackStatus;
}

function isTargetAligned(input: {
  recommendedBracket: DeckBracketNumber;
  targetComparison: TargetBracketComparison | null;
}) {
  return (
    input.targetComparison !== null &&
    input.recommendedBracket === input.targetComparison.bracket &&
    input.targetComparison.alignment === "aligned"
  );
}

function describeRulesFloor(
  rulesFloor: DeckBracketNumber,
  signals: DeckBracketAnalysis["signals"],
  gameChangers: DeckGameChangerAnalysis,
) {
  if (rulesFloor <= 1) {
    return "Bracket 1 because no hard bracket barometer is present";
  }

  const reasons: string[] = [];

  if (gameChangers.counts.total > 0) {
    reasons.push(
      gameChangers.bracket.bracketThreeLegal
        ? `${formatCount(gameChangers.counts.total, "Game Changer")} remove Brackets 1-2`
        : `${formatCount(gameChangers.counts.total, "Game Changer")} exceed the Bracket 3 cap`,
    );
  }

  if (signals.twoCardCombos > 0) {
    reasons.push(`${formatCount(signals.twoCardCombos, "exact two-card combo")} set an Optimized floor`);
  }

  if (signals.massLandDenial > 0) {
    reasons.push(`${formatCount(signals.massLandDenial, "mass land denial card")} set an Optimized floor`);
  }

  if (signals.extraTurns >= 2) {
    reasons.push(`${formatCount(signals.extraTurns, "extra-turn card")} set an Optimized floor`);
  }

  return `Bracket ${rulesFloor} because ${formatList(reasons)}`;
}

function describeMainBracketDrivers(
  power: DeckPowerAnalysis,
  signals: DeckBracketAnalysis["signals"],
) {
  const drivers: string[] = [];

  if (signals.twoCardCombos > 0) {
    drivers.push(formatCount(signals.twoCardCombos, "exact two-card combo"));
  }

  if (signals.gameChangers > 0) {
    drivers.push(formatCount(signals.gameChangers, "Game Changer"));
  }

  if (signals.massLandDenial > 0) {
    drivers.push(formatCount(signals.massLandDenial, "mass land denial card"));
  }

  if (signals.extraTurns > 0) {
    drivers.push(formatCount(signals.extraTurns, "extra-turn card"));
  }

  const dimensionDrivers = [...power.dimensions]
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((dimension) => `${dimension.label} ${Math.round(dimension.score)}`);

  drivers.push(...dimensionDrivers);

  return drivers.slice(0, 4).join(", ");
}

function describeWhyNotHigher(input: {
  recommendedBracket: DeckBracketNumber;
  power: DeckPowerAnalysis;
  signals: DeckBracketAnalysis["signals"];
}) {
  if (input.recommendedBracket >= 5) {
    return "It is already Bracket 5 because the cEDH gate is met by power score, speed, consistency, closing power, interaction, and fast win pressure or an overwhelming power profile.";
  }

  const nextBracket = (input.recommendedBracket + 1) as DeckBracketNumber;
  const missing =
    nextBracket === 5
      ? getMissingCedhGateReasons(input.power, input.signals)
      : nextBracket === 4
        ? getMissingOptimizedGateReasons(input.power, input.signals)
        : nextBracket === 3
          ? getMissingUpgradedGateReasons(input.power, input.signals)
          : getMissingCoreGateReasons(input.power);

  return `Not Bracket ${nextBracket} because ${formatList(missing)}.`;
}

function getMissingCoreGateReasons(power: DeckPowerAnalysis) {
  if (power.powerScore < BRACKET_BANDS[1].max) {
    return [`power score ${formatScore(power.powerScore)} is below ${BRACKET_BANDS[1].max}`];
  }

  return ["the deck already clears the Core power band"];
}

function getMissingUpgradedGateReasons(
  power: DeckPowerAnalysis,
  signals: DeckBracketAnalysis["signals"],
) {
  const speed = getDimensionScore(power, "speed");
  const consistency = getDimensionScore(power, "consistency");
  const closing = getDimensionScore(power, "closing");
  const interaction = getDimensionScore(power, "interaction");
  const mana = manaQuality(power);
  const reasons: string[] = [];

  if (speed < 60 && consistency < 60) {
    reasons.push(`speed ${Math.round(speed)} and consistency ${Math.round(consistency)} are below upgraded pacing`);
  }

  if (closing < 64) {
    reasons.push(`closing power ${Math.round(closing)} is below upgraded pressure`);
  }

  if (mana < 54) {
    reasons.push(`mana quality ${Math.round(mana)} is below the upgraded gate`);
  }

  if (interaction < 54 && signals.exactCombos === 0) {
    reasons.push("it lacks either strong interaction or fast combo pressure");
  }

  return reasons.length > 0 ? reasons : ["the upgraded gate is barely missed by the combined profile"];
}

function getMissingOptimizedGateReasons(
  power: DeckPowerAnalysis,
  signals: DeckBracketAnalysis["signals"],
) {
  const reasons: string[] = [];
  const speed = getDimensionScore(power, "speed");
  const consistency = getDimensionScore(power, "consistency");
  const interaction = getDimensionScore(power, "interaction");
  const closing = getDimensionScore(power, "closing");

  if (power.powerScore < BRACKET_BANDS[4].min) {
    reasons.push(`power score ${formatScore(power.powerScore)} is below ${BRACKET_BANDS[4].min}`);
  }

  if (speed < 74) {
    reasons.push(`speed ${Math.round(speed)} is below 74`);
  }

  if (consistency < 66) {
    reasons.push(`consistency ${Math.round(consistency)} is below 66`);
  }

  if (closing < 78) {
    reasons.push(`closing power ${Math.round(closing)} is below 78`);
  }

  if (interaction < 46 && signals.exactCombos === 0 && signals.gameChangers === 0) {
    reasons.push("interaction/combo pressure is below the optimized gate");
  }

  return reasons.length > 0 ? reasons : ["the optimized gate is met only by rules floor, not by the full power profile"];
}

function getMissingCedhGateReasons(
  power: DeckPowerAnalysis,
  signals: DeckBracketAnalysis["signals"],
) {
  const reasons: string[] = [];
  const speed = getDimensionScore(power, "speed");
  const consistency = getDimensionScore(power, "consistency");
  const interaction = getDimensionScore(power, "interaction");
  const closing = getDimensionScore(power, "closing");

  if (power.powerScore < 9.1) {
    reasons.push(`power score ${formatScore(power.powerScore)} is below 9.1`);
  }

  if (speed < 78) {
    reasons.push(`speed ${Math.round(speed)} is below 78`);
  }

  if (consistency < 78) {
    reasons.push(`consistency ${Math.round(consistency)} is below 78`);
  }

  if (closing < 78) {
    reasons.push(`closing power ${Math.round(closing)} is below 78`);
  }

  if (interaction < 60) {
    reasons.push(`interaction ${Math.round(interaction)} is below 60`);
  }

  if (signals.exactCombos === 0 && signals.gameChangers < 2) {
    reasons.push("it lacks the fast combo or Game Changer pressure expected at cEDH");
  }

  return reasons.length > 0 ? reasons : ["the cEDH gate is missed by the combined profile"];
}

function formatCount(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function formatList(items: string[]) {
  if (items.length <= 1) {
    return items[0] ?? "no clear blocker is present";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function formatScore(score: number) {
  return score.toFixed(1);
}

interface TargetBracketComparison {
  bracket: DeckBracketNumber;
  label: string;
  name: DeckBracketName;
  delta: number;
  alignment: "below" | "aligned" | "above";
  summary: string;
  findingTitle: string;
  findingStatus: DeckStructureFinding["status"];
  findingMessage: string;
}

function buildTargetBracketComparison(input: {
  targetBracket: DeckBracketNumber;
  recommendedBracket: DeckBracketNumber;
  power: DeckPowerAnalysis;
  powerBracketInfo: { bracket: DeckBracketNumber; modifier: DeckBracketModifier };
  rulesFloor: DeckBracketNumber;
  signals: DeckBracketAnalysis["signals"];
  gameChangers: DeckGameChangerAnalysis;
}): TargetBracketComparison {
  const label = formatBracketLabel(input.targetBracket, "");
  const currentLabel = formatBracketLabel(
    input.recommendedBracket,
    input.rulesFloor > input.powerBracketInfo.bracket ? "-" : input.powerBracketInfo.modifier,
  );
  const name = BRACKET_NAMES[input.targetBracket];
  const delta = input.recommendedBracket - input.targetBracket;
  const targetMismatchReason = describeTargetMismatch(input, label);

  if (delta === 0) {
    return {
      bracket: input.targetBracket,
      label,
      name,
      delta,
      alignment: "aligned",
      summary: `It lines up with ${label} (${name}).`,
      findingTitle: "Deck lines up with the target bracket",
      findingStatus: "good",
      findingMessage: `The selected target is ${label} (${name}), and the current bracket read lands there.`,
    };
  }

  if (delta > 0) {
    const blockedByRules = input.rulesFloor > input.targetBracket;

    return {
      bracket: input.targetBracket,
      label,
      name,
      delta,
      alignment: "above",
      summary: `Not ${label} (${name}) because ${targetMismatchReason}`,
      findingTitle: blockedByRules
        ? "Bracket rules push the deck above target"
        : "Deck reads above the target bracket",
      findingStatus: blockedByRules || delta >= 2 ? "warning" : "note",
      findingMessage: `The selected target is ${label} (${name}), but the current read is ${currentLabel}. ${capitalizeFirst(targetMismatchReason)} Either accept the higher bracket or use lower-pressure swaps in the parts named above.`,
    };
  }

  return {
    bracket: input.targetBracket,
    label,
    name,
    delta,
    alignment: "below",
    summary: `Not ${label} (${name}) yet because ${targetMismatchReason}`,
    findingTitle: "Deck reads below the target bracket",
    findingStatus: "note",
    findingMessage: `The selected target is ${label} (${name}), but the current read is ${currentLabel}. ${capitalizeFirst(targetMismatchReason)} Recommendations can focus on those gaps before adding unrelated upgrades.`,
  };
}

function describeTargetMismatch(
  input: {
    targetBracket: DeckBracketNumber;
    recommendedBracket: DeckBracketNumber;
    power: DeckPowerAnalysis;
    powerBracketInfo: { bracket: DeckBracketNumber; modifier: DeckBracketModifier };
    rulesFloor: DeckBracketNumber;
    signals: DeckBracketAnalysis["signals"];
    gameChangers: DeckGameChangerAnalysis;
  },
  targetLabel: string,
) {
  if (input.recommendedBracket > input.targetBracket) {
    if (input.rulesFloor > input.targetBracket) {
      return `to fit ${targetLabel}, the rules floor would need to drop to ${targetLabel} or lower. ${describeRulesFloor(input.rulesFloor, input.signals, input.gameChangers)}`;
    }

    if (input.powerBracketInfo.bracket > input.targetBracket) {
      return describeAboveTargetPowerRequirements(input.targetBracket, input.power, input.signals);
    }

    return `the final bracket read sits above ${targetLabel} after combining power profile and bracket rules`;
  }

  return formatList(getMissingTargetBracketReasons(input.targetBracket, input.power, input.signals));
}

function describeAboveTargetPowerRequirements(
  targetBracket: DeckBracketNumber,
  power: DeckPowerAnalysis,
  signals: DeckBracketAnalysis["signals"],
) {
  const blockers = getAboveTargetPowerBlockers(targetBracket, power, signals);
  return `to fit ${formatBracketLabel(targetBracket, "")}, ${formatList(blockers)}`;
}

function getAboveTargetPowerBlockers(
  targetBracket: DeckBracketNumber,
  power: DeckPowerAnalysis,
  signals: DeckBracketAnalysis["signals"],
) {
  switch (targetBracket) {
    case 1:
      return getBracketOneFitBlockers(power, signals);
    case 2:
      return getBracketTwoFitBlockers(power, signals);
    case 3:
      return getBracketThreeFitBlockers(power, signals);
    case 4:
      return getBracketFourFitBlockers(power, signals);
    case 5:
      return ["it is already at the highest bracket"];
  }
}

function getBracketOneFitBlockers(
  power: DeckPowerAnalysis,
  signals: DeckBracketAnalysis["signals"],
) {
  const blockers: string[] = [];

  if (power.powerScore >= BRACKET_BANDS[1].max) {
    blockers.push(`power score would need to be below ${BRACKET_BANDS[1].max}`);
  }

  if (signals.gameChangers > 0) {
    blockers.push("Game Changers would need to be removed");
  }

  if (signals.twoCardCombos > 0) {
    blockers.push("exact two-card combo lines would need to be removed");
  }

  return blockers.length > 0 ? blockers : ["the deck would need a much lower-power profile"];
}

function getBracketTwoFitBlockers(
  power: DeckPowerAnalysis,
  signals: DeckBracketAnalysis["signals"],
) {
  const speed = getDimensionScore(power, "speed");
  const consistency = getDimensionScore(power, "consistency");
  const closing = getDimensionScore(power, "closing");
  const interaction = getDimensionScore(power, "interaction");
  const mana = manaQuality(power);
  const blockers: string[] = [];

  if (power.powerScore >= BRACKET_BANDS[3].min) {
    blockers.push(`power score would need to stay below ${BRACKET_BANDS[3].min}`);
  }

  if (speed >= 60 && consistency >= 56 && mana >= 54) {
    blockers.push(`speed, consistency, or mana quality would need to fall below 60 / 56 / 54; currently ${Math.round(speed)} / ${Math.round(consistency)} / ${Math.round(mana)}`);
  }

  if (speed >= 58 && closing >= 66 && mana >= 54) {
    blockers.push(`speed, closing power, or mana quality would need to fall below 58 / 66 / 54; currently ${Math.round(speed)} / ${Math.round(closing)} / ${Math.round(mana)}`);
  }

  if (consistency >= 60 && closing >= 64) {
    blockers.push(`consistency or closing power would need to fall below 60 / 64; currently ${Math.round(consistency)} / ${Math.round(closing)}`);
  }

  if (interaction >= 54 && consistency >= 56) {
    blockers.push(`interaction or consistency would need to fall below 54 / 56; currently ${Math.round(interaction)} / ${Math.round(consistency)}`);
  }

  if (signals.exactCombos > 0 && (speed >= 54 || consistency >= 56 || closing >= 70)) {
    blockers.push("exact combo pressure would need to be removed or slowed below the upgraded gate");
  }

  return blockers.length > 0 ? blockers.slice(0, 3) : ["the deck would need to stop clearing the upgraded bracket gates"];
}

function getBracketThreeFitBlockers(
  power: DeckPowerAnalysis,
  signals: DeckBracketAnalysis["signals"],
) {
  const blockers: string[] = [];
  const speed = getDimensionScore(power, "speed");
  const consistency = getDimensionScore(power, "consistency");
  const closing = getDimensionScore(power, "closing");
  const interaction = getDimensionScore(power, "interaction");

  if (power.powerScore >= BRACKET_BANDS[4].min) {
    blockers.push(`power score would need to stay below ${BRACKET_BANDS[4].min}`);
  }

  if (speed >= 74) {
    blockers.push(`speed would need to be below 74; currently ${Math.round(speed)}`);
  }

  if (consistency >= 66) {
    blockers.push(`consistency would need to be below 66; currently ${Math.round(consistency)}`);
  }

  if (closing >= 78) {
    blockers.push(`closing power would need to be below 78; currently ${Math.round(closing)}`);
  }

  if (interaction >= 46 || signals.exactCombos > 0 || signals.gameChangers > 0) {
    blockers.push("interaction, combo, or Game Changer pressure would need to stop clearing the optimized gate");
  }

  return blockers.length > 0 ? blockers.slice(0, 4) : ["the deck would need to stop clearing the optimized bracket gate"];
}

function getBracketFourFitBlockers(
  power: DeckPowerAnalysis,
  signals: DeckBracketAnalysis["signals"],
) {
  const blockers: string[] = [];
  const speed = getDimensionScore(power, "speed");
  const consistency = getDimensionScore(power, "consistency");
  const interaction = getDimensionScore(power, "interaction");
  const closing = getDimensionScore(power, "closing");

  if (power.powerScore >= 9.1) {
    blockers.push("power score would need to stay below 9.1");
  }

  if (speed >= 78) {
    blockers.push(`speed would need to be below 78; currently ${Math.round(speed)}`);
  }

  if (consistency >= 78) {
    blockers.push(`consistency would need to be below 78; currently ${Math.round(consistency)}`);
  }

  if (closing >= 78) {
    blockers.push(`closing power would need to be below 78; currently ${Math.round(closing)}`);
  }

  if (interaction >= 60) {
    blockers.push(`interaction would need to be below 60; currently ${Math.round(interaction)}`);
  }

  if (signals.exactCombos > 0 || signals.gameChangers >= 2) {
    blockers.push("fast combo or multiple Game Changer pressure would need to be reduced");
  }

  return blockers.length > 0 ? blockers.slice(0, 4) : ["the deck would need to stop clearing the cEDH bracket gate"];
}

function getMissingTargetBracketReasons(
  targetBracket: DeckBracketNumber,
  power: DeckPowerAnalysis,
  signals: DeckBracketAnalysis["signals"],
) {
  if (targetBracket >= 5) {
    return getMissingCedhGateReasons(power, signals);
  }

  if (targetBracket >= 4) {
    return getMissingOptimizedGateReasons(power, signals);
  }

  if (targetBracket >= 3) {
    return getMissingUpgradedGateReasons(power, signals);
  }

  return getMissingCoreGateReasons(power);
}

function capitalizeFirst(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function getTwoCardComboCount(winConditions: DeckWinConditionAnalysis) {
  if (winConditions.combos.lookupStatus !== "ok") {
    return 0;
  }

  return winConditions.combos.exact.filter((combo) => {
    const uniqueCards = new Set(combo.cardNames.map((name) => normalizeText(name)));
    return uniqueCards.size <= 2 && isBracketFloorCombo(combo);
  }).length;
}

function isBracketFloorCombo(combo: DeckWinConditionAnalysis["combos"]["exact"][number]) {
  if (combo.lineType === "finisher") {
    return true;
  }

  if (isSoftLockOnlyCombo(combo)) {
    return false;
  }

  return combo.outcomeNames.some((name) =>
    /\binfinite\b[\s\S]{0,80}\b(?:mana|tokens?|draw|cards?|damage|life|mill|turns?|combat|storm)\b|\btreasure tokens?\b|\bstorm count\b/i.test(
      name,
    ),
  );
}

function isSoftLockOnlyCombo(combo: DeckWinConditionAnalysis["combos"]["exact"][number]) {
  const text = [...combo.outcomeNames, combo.description].join(" ").toLowerCase();
  const hasLockText = /\block\b|\bskip(?:s)? their untap steps?\b|\bskip(?:s)? (?:his|her|their|your) next untap step\b/.test(
    text,
  );
  const hasClosingOrResourceText =
    /\bwin the game\b|\blose the game\b|\bdamage\b|\blife\b|\bpoison\b|\bmill\b|\bcombat\b|\bextra turns?\b|\binfinite\b[\s\S]{0,80}\b(?:mana|tokens?|draw|cards?|damage|life|mill|turns?|combat|storm)\b/.test(
      text,
    );

  return hasLockText && !hasClosingOrResourceText;
}

function countMatchingCards(
  document: DeckResolutionDocument,
  matcher: (card: ScryfallCard) => boolean,
) {
  return document.result.resolvedCards.filter(
    (card) =>
      (card.section === "commander" ||
        card.section === "mainboard" ||
        card.section === "companion") &&
      matcher(card.card),
  ).length;
}

function isExtraTurnCard(card: ScryfallCard) {
  return getCardSegments(card).some((segment) =>
    /\b(?:take|takes) (?:an|one|two|three|x|that many) extra turns?\b/.test(segment),
  );
}

function isMassLandDenialCard(card: ScryfallCard) {
  return getCardSegments(card).some(
    (segment) =>
      /\bdestroy all (?:nonbasic )?lands\b/.test(segment) ||
      /\bexile all lands\b/.test(segment) ||
      /\breturn all lands to (?:their owners'|owners'|their owner's) hands\b/.test(segment) ||
      /\beach player sacrifices all lands\b/.test(segment) ||
      /\bplayers can't play lands\b/.test(segment) ||
      /\blands don't untap during their controllers' untap steps\b/.test(segment),
  );
}

function getCardSegments(card: ScryfallCard) {
  if (!card.card_faces?.length) {
    return [normalizeText(card.oracle_text ?? "")];
  }

  return card.card_faces.map((face) => normalizeText(face.oracle_text ?? ""));
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function getDimensionScore(power: DeckPowerAnalysis, key: DeckPowerDimensionKey) {
  return power.dimensions.find((dimension) => dimension.key === key)?.score ?? 0;
}

function manaQuality(power: DeckPowerAnalysis) {
  return getDimensionScore(power, "mana");
}

function formatBracketLabel(bracket: DeckBracketNumber, modifier: DeckBracketModifier) {
  return `Bracket ${bracket}${modifier}`;
}
