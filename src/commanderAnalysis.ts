import {
  analyzeCommanderInfiniteManaSinks,
  CommanderInfiniteManaSinkAnalysis,
  CommanderInfiniteManaSinkProfile,
  getCommanderInfiniteManaSinkProfile,
} from "./commanderManaSink";
import { analyzeCommanderProfiles } from "./commanderProfile";
import {
  CommanderRoleHit,
  CommanderRoleTag,
  CommanderTaggedCard,
  DeckCommanderAnalysis,
  DeckCommanderProfile,
  DeckResolutionDocument,
  DeckStrategyAnalysis,
  DeckStructureFinding,
  DeckWinConditionAnalysis,
  DeckWinStrategyAnalysis,
  ResolvedDeckCard,
  ScryfallCard,
  StrategyKey,
  WinStrategyKey,
} from "./types";

interface CommanderRoleProfile {
  weight: number;
  reason: string;
}

interface CommanderDeckProfile {
  hasLegendaryCommander: boolean;
  hasCreatureCommander: boolean;
  hasCheapCommander: boolean;
  hasCheapCreatureCommander: boolean;
  hasFreeCommander: boolean;
}

interface CommanderProfile {
  name: string;
  normalizedName: string;
  cmc: number;
  isLegendary: boolean;
  isCreature: boolean;
  isCheapCommander: boolean;
  isCheapCreatureCommander: boolean;
  isFreeCommander: boolean;
}

interface CommanderPrior {
  label: string;
  score: number;
}

const COMMANDER_PRIORS: Record<string, CommanderPrior> = {
  "atraxa, grand unifier": { label: "Atraxa, Grand Unifier", score: 10 },
  "kinnan, bonder prodigy": { label: "Kinnan, Bonder Prodigy", score: 18 },
  "korvold, fae-cursed king": { label: "Korvold, Fae-Cursed King", score: 12 },
  "najeela, the blade-blossom": { label: "Najeela, the Blade-Blossom", score: 16 },
  "prosper, tome-bound": { label: "Prosper, Tome-Bound", score: 11 },
  "sisay, weatherlight captain": { label: "Sisay, Weatherlight Captain", score: 15 },
  "the gitrog monster": { label: "The Gitrog Monster", score: 13 },
  "thrasios, triton hero": { label: "Thrasios, Triton Hero", score: 15 },
  "tymna the weaver": { label: "Tymna the Weaver", score: 10 },
  "urza, lord high artificer": { label: "Urza, Lord High Artificer", score: 16 },
  "yuriko, the tiger's shadow": { label: "Yuriko, the Tiger's Shadow", score: 13 },
};

const ROLE_LABELS: Record<CommanderRoleTag, string> = {
  mana_engine: "Mana Engine",
  card_engine: "Card Engine",
  tutor_engine: "Tutor Engine",
  interaction_engine: "Interaction Engine",
  protection_engine: "Protection Engine",
  recursion_engine: "Recursion Engine",
  combo_enabler: "Combo Enabler",
  finisher_engine: "Finisher Engine",
  token_engine: "Token Engine",
  cost_reducer: "Cost Reducer",
};

const STRATEGY_ROLE_HINTS: Record<StrategyKey, CommanderRoleTag[]> = {
  combo: ["combo_enabler", "mana_engine", "card_engine", "tutor_engine", "cost_reducer"],
  spellslinger: ["card_engine", "combo_enabler", "cost_reducer", "interaction_engine"],
  artifacts: ["mana_engine", "combo_enabler", "card_engine", "cost_reducer", "token_engine"],
  enchantress: ["card_engine", "protection_engine", "finisher_engine"],
  superfriends: ["card_engine", "protection_engine", "interaction_engine", "finisher_engine"],
  reanimator: ["recursion_engine", "card_engine", "finisher_engine"],
  lands_matter: ["mana_engine", "card_engine", "finisher_engine", "token_engine"],
  tokens: ["token_engine", "finisher_engine", "card_engine"],
  aristocrats: ["token_engine", "recursion_engine", "finisher_engine", "card_engine"],
  blink: ["card_engine", "protection_engine", "recursion_engine"],
  face_down: ["card_engine", "cost_reducer", "interaction_engine", "protection_engine"],
  dungeons: ["recursion_engine", "card_engine", "finisher_engine"],
  madness: ["card_engine", "recursion_engine", "finisher_engine"],
  ninjutsu: ["finisher_engine", "card_engine", "protection_engine"],
  curses: ["finisher_engine", "card_engine", "interaction_engine"],
  exile_cast: ["card_engine", "mana_engine", "finisher_engine"],
  food: ["token_engine", "protection_engine", "card_engine", "finisher_engine"],
  clues: ["card_engine", "token_engine", "finisher_engine"],
  energy: ["mana_engine", "token_engine", "finisher_engine", "card_engine"],
  sagas: ["card_engine", "finisher_engine", "recursion_engine"],
  monarch: ["card_engine", "protection_engine", "interaction_engine"],
  theft: ["interaction_engine", "card_engine", "finisher_engine"],
  donation: ["interaction_engine", "card_engine", "finisher_engine", "protection_engine"],
  goad: ["interaction_engine", "protection_engine", "finisher_engine"],
  shrines: ["finisher_engine", "card_engine", "recursion_engine"],
  cycling: ["card_engine", "token_engine", "recursion_engine"],
  mutate: ["finisher_engine", "card_engine", "protection_engine"],
  poison: ["finisher_engine", "interaction_engine", "protection_engine"],
  battles: ["interaction_engine", "card_engine", "finisher_engine"],
  pillowfort: ["protection_engine", "interaction_engine", "card_engine"],
  copy_clone: ["combo_enabler", "card_engine", "finisher_engine"],
  power_matter: ["finisher_engine", "card_engine", "token_engine"],
  mana_value_matter: ["card_engine", "cost_reducer", "finisher_engine"],
  x_spells: ["mana_engine", "cost_reducer", "finisher_engine", "card_engine"],
  legends_matter: ["card_engine", "finisher_engine", "recursion_engine"],
  toughness_matter: ["card_engine", "finisher_engine", "protection_engine"],
  pingers: ["finisher_engine", "interaction_engine", "card_engine"],
  counters: ["finisher_engine", "card_engine", "protection_engine"],
  voltron: ["protection_engine", "finisher_engine", "card_engine"],
  extra_combat: ["finisher_engine", "mana_engine"],
  extra_upkeep: ["card_engine", "finisher_engine", "protection_engine"],
  tap_untap: ["interaction_engine", "token_engine", "card_engine", "protection_engine"],
  dice_rolls: ["finisher_engine", "token_engine", "card_engine", "combo_enabler"],
  coin_flip: ["card_engine", "finisher_engine", "combo_enabler"],
  treasure: ["mana_engine", "token_engine", "card_engine", "combo_enabler"],
  kindred: ["card_engine", "finisher_engine", "mana_engine"],
  stax: ["interaction_engine", "protection_engine", "mana_engine"],
  control: ["interaction_engine", "card_engine", "protection_engine"],
  group_hug: ["mana_engine", "card_engine", "token_engine"],
  group_slug: ["finisher_engine", "card_engine"],
  lifegain: ["finisher_engine", "card_engine", "token_engine"],
  mill: ["card_engine", "interaction_engine", "finisher_engine"],
  aggro: ["finisher_engine", "protection_engine", "mana_engine"],
};

const WIN_PLAN_ROLE_HINTS: Record<WinStrategyKey, CommanderRoleTag[]> = {
  infinite_combo: ["combo_enabler", "mana_engine", "card_engine", "tutor_engine", "cost_reducer"],
  commander_damage: ["finisher_engine", "protection_engine", "card_engine"],
  go_wide_combat: ["token_engine", "finisher_engine", "card_engine"],
  extra_combat_pressure: ["finisher_engine", "mana_engine"],
  drain_burn: ["finisher_engine", "card_engine", "recursion_engine"],
  spell_burst: ["combo_enabler", "card_engine", "cost_reducer"],
  mill_out: ["card_engine", "interaction_engine", "finisher_engine"],
  alternate_win: ["combo_enabler", "tutor_engine", "card_engine", "finisher_engine"],
  planeswalker_ultimates: ["card_engine", "protection_engine", "interaction_engine", "finisher_engine"],
  big_mana_haymakers: ["mana_engine", "cost_reducer", "card_engine", "finisher_engine"],
  graveyard_pressure: ["recursion_engine", "card_engine", "finisher_engine"],
  lock_attrition: ["interaction_engine", "card_engine", "protection_engine"],
  poison: ["finisher_engine", "protection_engine", "card_engine"],
  value_attrition: ["card_engine", "recursion_engine", "interaction_engine"],
};

export function analyzeDeckCommander(
  document: DeckResolutionDocument,
  strategy: DeckStrategyAnalysis,
  winStrategy: DeckWinStrategyAnalysis,
  winConditions: DeckWinConditionAnalysis,
): DeckCommanderAnalysis {
  const commanderCards = document.result.resolvedCards.filter((card) => card.section === "commander");
  const commanderThemeProfiles = strategy.commanderProfiles ?? analyzeCommanderProfiles(document);
  const commanderProfiles = getCommanderProfiles(commanderCards);
  const exactCombos =
    winConditions.combos.lookupStatus === "ok" ? winConditions.combos.exact : [];
  const commanderManaSink = analyzeCommanderInfiniteManaSinks(
    commanderCards.map((card) => card.card),
    winConditions.combos,
  );
  const commanderInvolvedCombos = exactCombos.filter((combo) => combo.commanderInvolved).length;
  const commanderNames = commanderCards.map((card) => card.card.name);
  const deckProfile = getCommanderDeckProfile(commanderCards);
  const activeStrategyKey = strategy.mainStrategy?.key ?? null;
  const activePlanKey = winStrategy.primaryPlan?.key ?? null;

  const taggedCommanderMap = new Map<string, CommanderTaggedCard>();

  for (const deckCard of commanderCards) {
    const combosForCard = exactCombos.filter((combo) =>
      combo.cardNames.some((name) => normalizeText(name) === normalizeText(deckCard.card.name)),
    );
    const hits = detectCommanderRoleHits(
      deckCard.card,
      combosForCard,
      getCommanderInfiniteManaSinkProfile(commanderManaSink, deckCard.card.name),
    );

    if (hits.length === 0) {
      continue;
    }

    taggedCommanderMap.set(normalizeText(deckCard.card.name), {
      name: deckCard.card.name,
      section: deckCard.section,
      roleValue: roundTo(totalWeight(hits), 2),
      hits,
    });
  }

  const counts = {
    mana: 0,
    cards: 0,
    tutors: 0,
    interaction: 0,
    protection: 0,
    recursion: 0,
    combo: 0,
    finisher: 0,
    tokens: 0,
    costReduction: 0,
  };

  for (const commander of taggedCommanderMap.values()) {
    for (const hit of commander.hits) {
      const amount = hit.weight;

      switch (hit.tag) {
        case "mana_engine":
          counts.mana += amount;
          break;
        case "card_engine":
          counts.cards += amount;
          break;
        case "tutor_engine":
          counts.tutors += amount;
          break;
        case "interaction_engine":
          counts.interaction += amount;
          break;
        case "protection_engine":
          counts.protection += amount;
          break;
        case "recursion_engine":
          counts.recursion += amount;
          break;
        case "combo_enabler":
          counts.combo += amount;
          break;
        case "finisher_engine":
          counts.finisher += amount;
          break;
        case "token_engine":
          counts.tokens += amount;
          break;
        case "cost_reducer":
          counts.costReduction += amount;
          break;
      }
    }
  }

  const shellSupportCards = document.result.resolvedCards
    .filter((card) => card.section === "mainboard" || card.section === "companion")
    .map((deckCard) => ({
      card: deckCard,
      hits: detectCommanderShellSupportHits(deckCard.card, deckProfile),
    }))
    .filter((entry) => entry.hits.length > 0);

  for (const supportCard of shellSupportCards) {
    for (const hit of supportCard.hits) {
      const amount = hit.weight;

      switch (hit.tag) {
        case "mana_engine":
          counts.mana += amount;
          break;
        case "card_engine":
          counts.cards += amount;
          break;
        case "tutor_engine":
          counts.tutors += amount;
          break;
        case "interaction_engine":
          counts.interaction += amount;
          break;
        case "protection_engine":
          counts.protection += amount;
          break;
        case "recursion_engine":
          counts.recursion += amount;
          break;
        case "combo_enabler":
          counts.combo += amount;
          break;
        case "finisher_engine":
          counts.finisher += amount;
          break;
        case "token_engine":
          counts.tokens += amount;
          break;
        case "cost_reducer":
          counts.costReduction += amount;
          break;
      }
    }

    const attributedProfiles = getCommanderSupportAttribution(
      supportCard.card.card,
      commanderProfiles,
    );

    for (const profile of attributedProfiles) {
      mergeCommanderTaggedHits(
        taggedCommanderMap,
        profile.name,
        "commander",
        supportCard.hits.map((hit) => ({
          ...hit,
          weight: roundTo(hit.weight * getAttributionMultiplier(profile, supportCard.card.card), 2),
          reason: `${supportCard.card.card.name} gets better because ${profile.name} turns it on efficiently. ${hit.reason}`,
        })),
      );
    }
  }

  const roundedCounts = {
    mana: roundTo(counts.mana, 2),
    cards: roundTo(counts.cards, 2),
    tutors: roundTo(counts.tutors, 2),
    interaction: roundTo(counts.interaction, 2),
    protection: roundTo(counts.protection, 2),
    recursion: roundTo(counts.recursion, 2),
    combo: roundTo(counts.combo, 2),
    finisher: roundTo(counts.finisher, 2),
    tokens: roundTo(counts.tokens, 2),
    costReduction: roundTo(counts.costReduction, 2),
  };

  const priorMatches = commanderNames
    .map((name) => COMMANDER_PRIORS[normalizeText(name)])
    .filter((value): value is CommanderPrior => Boolean(value));
  const prior = {
    matched: dedupeStrings(priorMatches.map((entry) => entry.label)),
    score: roundTo(
      clampValue(priorMatches.reduce((sum, entry) => sum + entry.score, 0), 0, 22),
      1,
    ),
  };
  const profileInfluence = getCommanderProfileInfluence(commanderThemeProfiles);

  const impactScore = scoreCommanderImpact(
    roundedCounts,
    commanderInvolvedCombos,
    prior.score,
    profileInfluence.impactBonus,
  );
  const dependencyScore = scoreCommanderDependency(
    roundedCounts,
    strategy,
    activeStrategyKey,
    activePlanKey,
    commanderInvolvedCombos,
    impactScore,
    profileInfluence.dependencyBonus,
  );
  const ceilingScore = scoreCommanderCeiling(
    roundedCounts,
    impactScore,
    dependencyScore,
    commanderInvolvedCombos,
    prior.score,
    activePlanKey,
    profileInfluence.ceilingBonus,
  );
  const keyRoles = getKeyCommanderRoles(roundedCounts);
  const findings = buildCommanderFindings({
    impactScore,
    dependencyScore,
    ceilingScore,
    commanderInvolvedCombos,
    prior,
    keyRoles,
    counts: roundedCounts,
    shellSupportCount: shellSupportCards.length,
    commanderManaSink,
    strategy,
    activeStrategyKey,
    activePlanKey,
    profiles: commanderThemeProfiles,
    profileInfluence,
  });
  const summary = summarizeCommander({
    commanderNames,
    impactScore,
    dependencyScore,
    ceilingScore,
    keyRoles,
    commanderInvolvedCombos,
    activePlanKey,
  });
  const taggedCommanders = [...taggedCommanderMap.values()]
    .sort((left, right) => right.roleValue - left.roleValue || left.name.localeCompare(right.name));

  return {
    summary,
    impactScore,
    dependencyScore,
    ceilingScore,
    commanderInvolvedCombos,
    prior,
    counts: roundedCounts,
    keyRoles,
    profiles: commanderThemeProfiles,
    findings,
    taggedCommanders,
  };
}

function detectCommanderRoleHits(
  card: ScryfallCard,
  exactCombosForCard: Array<{ lineType: "finisher" | "engine" }>,
  infiniteManaSink: CommanderInfiniteManaSinkProfile | null,
) {
  const hits = new Map<CommanderRoleTag, { weight: number; reasons: Set<string> }>();

  for (const segment of getCommanderSegments(card)) {
    if (!segment.text) {
      continue;
    }

    const mana = getManaProfile(segment.text, segment.typeLine);
    const cards = getCardProfile(segment.text);
    const tutors = getTutorProfile(segment.text);
    const interaction = getInteractionProfile(segment.text);
    const protection = getProtectionProfile(segment.text);
    const recursion = getRecursionProfile(segment.text);
    const finisher = getFinisherProfile(segment.text, segment.typeLine);
    const tokens = getTokenProfile(segment.text);
    const costReduction = getCostReductionProfile(segment.text);
    const combo = getComboProfile(segment.text);

    if (mana) {
      addHit(hits, "mana_engine", mana.weight, mana.reason);
    }

    if (cards) {
      addHit(hits, "card_engine", cards.weight, cards.reason);
    }

    if (tutors) {
      addHit(hits, "tutor_engine", tutors.weight, tutors.reason);
    }

    if (interaction) {
      addHit(hits, "interaction_engine", interaction.weight, interaction.reason);
    }

    if (protection) {
      addHit(hits, "protection_engine", protection.weight, protection.reason);
    }

    if (recursion) {
      addHit(hits, "recursion_engine", recursion.weight, recursion.reason);
    }

    if (finisher) {
      addHit(hits, "finisher_engine", finisher.weight, finisher.reason);
    }

    if (tokens) {
      addHit(hits, "token_engine", tokens.weight, tokens.reason);
    }

    if (costReduction) {
      addHit(hits, "cost_reducer", costReduction.weight, costReduction.reason);
    }

    if (combo) {
      addHit(hits, "combo_enabler", combo.weight, combo.reason);
    }
  }

  if (exactCombosForCard.length > 0) {
    const comboWeight = 1.15 + Math.min(1.25, exactCombosForCard.length * 0.35);
    const finisherCombos = exactCombosForCard.filter((combo) => combo.lineType === "finisher").length;
    addHit(
      hits,
      "combo_enabler",
      roundTo(comboWeight, 2),
      `${exactCombosForCard.length} exact combo line${exactCombosForCard.length === 1 ? "" : "s"} involve this commander.`,
    );

    if (finisherCombos > 0) {
      addHit(
        hits,
        "finisher_engine",
        roundTo(0.6 + Math.min(0.6, finisherCombos * 0.22), 2),
        `${finisherCombos} of those combo line${finisherCombos === 1 ? "" : "s"} immediately finish the game.`,
      );
    }
  }

  if (infiniteManaSink !== null) {
    addHit(
      hits,
      "combo_enabler",
      roundTo(
        0.7 +
          Math.min(0.9, infiniteManaSink.exactManaComboCount * 0.18) +
          Math.min(0.4, infiniteManaSink.convertedEngineCount * 0.08),
        2,
      ),
      `${card.name} converts infinite mana combo lines into live payoffs. ${infiniteManaSink.reason}.`,
    );

    if (infiniteManaSink.kinds.includes("direct_finisher")) {
      addHit(
        hits,
        "finisher_engine",
        roundTo(0.95 + Math.min(0.75, infiniteManaSink.convertedEngineCount * 0.2), 2),
        `${card.name} can spend infinite mana on direct lethal pressure.`,
      );
    }

    if (infiniteManaSink.kinds.includes("board_finisher")) {
      addHit(
        hits,
        "finisher_engine",
        roundTo(0.65 + Math.min(0.5, infiniteManaSink.convertedEngineCount * 0.15), 2),
        `${card.name} can spend infinite mana on scalable board pressure.`,
      );
      addHit(
        hits,
        "token_engine",
        roundTo(0.45 + Math.min(0.35, infiniteManaSink.convertedEngineCount * 0.1), 2),
        `${card.name} can turn infinite mana into creature presence or board growth.`,
      );
    }

    if (infiniteManaSink.kinds.includes("cards")) {
      addHit(
        hits,
        "card_engine",
        roundTo(0.7 + Math.min(0.5, infiniteManaSink.convertedEngineCount * 0.12), 2),
        `${card.name} can spend infinite mana on card access.`,
      );
    }

    if (infiniteManaSink.kinds.includes("tutor")) {
      addHit(
        hits,
        "tutor_engine",
        roundTo(0.65 + Math.min(0.45, infiniteManaSink.convertedEngineCount * 0.12), 2),
        `${card.name} can spend infinite mana on tutoring effects.`,
      );
    }

    if (infiniteManaSink.kinds.includes("recursion")) {
      addHit(
        hits,
        "recursion_engine",
        roundTo(0.55 + Math.min(0.35, infiniteManaSink.convertedEngineCount * 0.1), 2),
        `${card.name} can spend infinite mana on recursion loops.`,
      );
    }
  }

  return [...hits.entries()].map(([tag, value]) => ({
    tag,
    weight: roundTo(value.weight, 2),
    reason: [...value.reasons].join(" "),
  }));
}

function scoreCommanderImpact(
  counts: DeckCommanderAnalysis["counts"],
  commanderInvolvedCombos: number,
  priorScore: number,
  profileImpactBonus = 0,
) {
  let score =
    20 +
    counts.mana * 11 +
    counts.cards * 11 +
    counts.tutors * 9 +
    counts.interaction * 7 +
    counts.protection * 5.5 +
    counts.recursion * 6 +
    counts.combo * 10 +
    counts.finisher * 9 +
    counts.tokens * 4 +
    counts.costReduction * 8 +
    commanderInvolvedCombos * 3.5 +
    priorScore * 0.45 +
    profileImpactBonus;

  if (counts.mana + counts.cards + counts.combo + counts.finisher >= 6.5) {
    score += 6;
  }

  return clampScore(score);
}

function scoreCommanderDependency(
  counts: DeckCommanderAnalysis["counts"],
  strategy: DeckStrategyAnalysis,
  activeStrategyKey: StrategyKey | null,
  activePlanKey: WinStrategyKey | null,
  commanderInvolvedCombos: number,
  impactScore: number,
  profileDependencyBonus = 0,
) {
  const synergy = strategy.synergy ?? strategy.perspectives[0]?.synergy ?? null;
  const alignedRoleWeight =
    getAlignedRoleWeight(counts, activeStrategyKey) * 0.55 +
    getPlanAlignedRoleWeight(counts, activePlanKey) * 0.45;

  let score =
    14 +
    impactScore * 0.24 +
    alignedRoleWeight * 9 +
    commanderInvolvedCombos * 10 +
    (synergy?.commanderAligned ? 18 : 0) +
    profileDependencyBonus;

  if (activePlanKey === "commander_damage") {
    score += 12;
  } else if (activePlanKey === "infinite_combo" && counts.combo > 0) {
    score += 8;
  }

  if (counts.mana + counts.cards + counts.combo + counts.costReduction >= 5.5) {
    score += 5;
  }

  return clampScore(score);
}

function scoreCommanderCeiling(
  counts: DeckCommanderAnalysis["counts"],
  impactScore: number,
  dependencyScore: number,
  commanderInvolvedCombos: number,
  priorScore: number,
  activePlanKey: WinStrategyKey | null,
  profileCeilingBonus = 0,
) {
  let score =
    18 +
    impactScore * 0.36 +
    dependencyScore * 0.14 +
    counts.combo * 11 +
    counts.mana * 7 +
    counts.cards * 6 +
    counts.tutors * 7 +
    counts.finisher * 8 +
    counts.costReduction * 6 +
    commanderInvolvedCombos * 8 +
    priorScore * 0.65 +
    profileCeilingBonus;

  if (activePlanKey === "infinite_combo") {
    score += 5;
  } else if (activePlanKey === "big_mana_haymakers") {
    score += 2.5;
  }

  return clampScore(score);
}

function summarizeCommander(input: {
  commanderNames: string[];
  impactScore: number;
  dependencyScore: number;
  ceilingScore: number;
  keyRoles: string[];
  commanderInvolvedCombos: number;
  activePlanKey: WinStrategyKey | null;
}) {
  const subject =
    input.commanderNames.length > 1
      ? "The command zone package"
      : `${input.commanderNames[0] ?? "The commander"}`;
  const roleText =
    input.keyRoles.length > 0
      ? `It mainly acts as ${joinRoleLabels(input.keyRoles.slice(0, 3)).toLowerCase()}.`
      : "It reads more like a color-identity anchor than a major engine.";
  const comboText =
    input.commanderInvolvedCombos > 0
      ? ` ${input.commanderInvolvedCombos} exact combo line${input.commanderInvolvedCombos === 1 ? "" : "s"} involve it directly.`
      : "";
  const planText =
    input.activePlanKey === "commander_damage"
      ? " The main closing plan also points back to the command zone."
      : "";

  return `${subject} has ${getScoreWord(input.impactScore)} impact, ${getScoreWord(input.dependencyScore)} dependency, and ${getScoreWord(input.ceilingScore)} ceiling. ${roleText}${comboText}${planText}`;
}

function buildCommanderFindings(input: {
  impactScore: number;
  dependencyScore: number;
  ceilingScore: number;
  commanderInvolvedCombos: number;
  prior: { matched: string[]; score: number };
  keyRoles: string[];
  counts: DeckCommanderAnalysis["counts"];
  shellSupportCount: number;
  commanderManaSink: CommanderInfiniteManaSinkAnalysis;
  strategy: DeckStrategyAnalysis;
  activeStrategyKey: StrategyKey | null;
  activePlanKey: WinStrategyKey | null;
  profiles: DeckCommanderProfile[];
  profileInfluence: CommanderProfileInfluence;
}) {
  const findings: DeckStructureFinding[] = [];
  const primaryProfile = input.profiles[0] ?? null;

  if (input.impactScore >= 75) {
    findings.push({
      code: "commander_impact_high",
      title: "Commander impact is high",
      status: "good",
      message: "The command zone supplies enough mana, cards, combo support, or finishing pressure to materially raise the deck's ceiling.",
    });
  } else if (input.impactScore >= 52) {
    findings.push({
      code: "commander_impact_mid",
      title: "Commander impact is meaningful",
      status: "note",
      message: "The commander meaningfully improves the deck's best turns, even if the 99 can still function without it.",
    });
  } else {
    findings.push({
      code: "commander_impact_light",
      title: "Commander impact is light",
      status: "warning",
      message: "The command zone is not supplying much engine value yet, so most of the power still has to come from the 99.",
    });
  }

  if (input.dependencyScore >= 72) {
    findings.push({
      code: "commander_dependency_high",
      title: "Deck is heavily commander-centric",
      status: "note",
      message: "The shell looks built around having its commander online, so commander tax and repeated removal will matter a lot.",
    });
  } else if (input.dependencyScore <= 38) {
    findings.push({
      code: "commander_dependency_low",
      title: "Deck is not overly tied to the command zone",
      status: "good",
      message: "The shell can still function without leaning too hard on the commander, which lowers one source of fragility.",
    });
  }

  if (input.ceilingScore >= 82) {
    findings.push({
      code: "commander_ceiling_high",
      title: "Commander ceiling is high",
      status: "good",
      message: "If the commander sticks, the deck's strongest turns get noticeably stronger than the shell alone would suggest.",
    });
  } else if (input.ceilingScore <= 46) {
    findings.push({
      code: "commander_ceiling_fair",
      title: "Commander ceiling is fairly modest",
      status: "note",
      message: "The commander helps, but it does not look like a major force-multiplier for the deck's best turns.",
    });
  }

  if (input.commanderInvolvedCombos > 0) {
    findings.push({
      code: "commander_combo_present",
      title: "Commander is part of real combo lines",
      status: "good",
      message: `${input.commanderInvolvedCombos} exact infinite combo line${input.commanderInvolvedCombos === 1 ? "" : "s"} involve the command zone directly.`,
    });
  }

  if (primaryProfile && primaryProfile.confidence >= 72) {
    findings.push({
      code: "commander_profile_supported",
      title: "Commander profile is supported",
      status: "good",
      message: `${primaryProfile.commanderName} reads as ${primaryProfile.label}; ${primaryProfile.supportCount} cards in the 99 support that ask against a rough target of ${primaryProfile.supportTarget}.`,
    });
  } else if (primaryProfile && primaryProfile.confidence < 52) {
    findings.push({
      code: "commander_profile_thin",
      title: "Commander profile needs more support",
      status: "warning",
      message: `${primaryProfile.commanderName} appears to ask for ${primaryProfile.label}, but only ${primaryProfile.supportCount} cards currently support that package.`,
    });
  }

  if (input.profileInfluence.impactBonus >= 12 && input.profileInfluence.primaryProfile) {
    const profile = input.profileInfluence.primaryProfile;
    findings.push({
      code: "commander_profile_influence_bonus",
      title: "Commander multiplies a supported package",
      status: "good",
      message: `${profile.supportCount} support cards and ${profile.coreCount} core pieces mean ${profile.commanderName} can turn the ${profile.label} package into much stronger peak turns than the shell alone.`,
    });
  }

  if (input.commanderManaSink.directFinisherCount > 0) {
    findings.push({
      code: "commander_infinite_mana_finisher",
      title: "Commander converts infinite mana into a kill",
      status: "good",
      message: `${input.commanderManaSink.commanders[0]?.name ?? "The commander"} can spend infinite mana on direct closing pressure, which makes engine combo lines much more threatening.`,
    });
  } else if (input.commanderManaSink.convertedEngineCount > 0) {
    findings.push({
      code: "commander_infinite_mana_sink",
      title: "Commander converts infinite mana into value",
      status: "good",
      message: `${input.commanderManaSink.commanders[0]?.name ?? "The commander"} can spend infinite mana on cards, tutoring, recursion, or scalable board pressure, so those combo lines are less likely to fizzle.`,
    });
  }

  if (input.shellSupportCount >= 4) {
    findings.push({
      code: "commander_shell_support_dense",
      title: "The 99 leans on the command zone",
      status: "good",
      message: `${input.shellSupportCount} non-commander cards look materially better when a commander is on the battlefield, which raises both dependency and ceiling.`,
    });
  } else if (input.shellSupportCount >= 2) {
    findings.push({
      code: "commander_shell_support_present",
      title: "Some cards are commander-enabled",
      status: "note",
      message: `${input.shellSupportCount} cards in the 99 appear to lean on having a commander online, so the command zone matters more than the textbox alone suggests.`,
    });
  }

  if (input.prior.matched.length > 0) {
    findings.push({
      code: "commander_prior_matched",
      title: "Known high-leverage commander matched",
      status: "note",
      message: `${joinRoleLabels(input.prior.matched)} carries a small commander prior because it is a historically strong engine in EDH. That prior is intentionally light and does not override the shell.`,
    });
  }

  if (input.keyRoles.length > 0 && input.activeStrategyKey) {
    findings.push({
      code: "commander_roles_aligned",
      title: "Commander roles line up with the shell",
      status: input.strategy.synergy?.commanderAligned ? "good" : "note",
      message: `${joinRoleLabels(input.keyRoles.slice(0, 3))} are the clearest command-zone roles right now, which lines up ${input.strategy.synergy?.commanderAligned ? "well" : "partly"} with the deck's current main plan.`,
    });
  }

  return findings.slice(0, 5);
}

interface CommanderProfileInfluence {
  impactBonus: number;
  dependencyBonus: number;
  ceilingBonus: number;
  primaryProfile: DeckCommanderProfile | null;
}

function getCommanderProfileInfluence(profiles: DeckCommanderProfile[]): CommanderProfileInfluence {
  const primaryProfile = profiles[0] ?? null;

  if (!primaryProfile || primaryProfile.confidence < 45 || primaryProfile.supportCount < 3) {
    return {
      impactBonus: 0,
      dependencyBonus: 0,
      ceilingBonus: 0,
      primaryProfile,
    };
  }

  const supportRatio = primaryProfile.supportCount / Math.max(primaryProfile.supportTarget, 1);
  const coreTarget = Math.max(Math.ceil(primaryProfile.supportTarget * 0.45), 1);
  const coreRatio = primaryProfile.coreCount / coreTarget;
  const confidenceRatio = primaryProfile.confidence / 100;
  const densitySignal = clampValue(
    supportRatio * 0.52 +
      coreRatio * 0.26 +
      confidenceRatio * 0.22,
    0,
    1.35,
  );
  const supportDepth = Math.min(7, primaryProfile.supportCount * 0.24);
  const coreDepth = Math.min(7, primaryProfile.coreCount * 0.34);
  const overbuiltBonus = Math.min(6, Math.max(0, primaryProfile.supportCount - primaryProfile.supportTarget) * 0.35);

  return {
    impactBonus: roundTo(Math.min(42, densitySignal * 20 + supportDepth + coreDepth + overbuiltBonus), 1),
    dependencyBonus: roundTo(Math.min(22, densitySignal * 11 + supportDepth * 0.6 + coreDepth * 0.6), 1),
    ceilingBonus: roundTo(Math.min(38, densitySignal * 19 + supportDepth + coreDepth + overbuiltBonus), 1),
    primaryProfile,
  };
}

function getKeyCommanderRoles(counts: DeckCommanderAnalysis["counts"]) {
  const rankedCounts: Array<[keyof DeckCommanderAnalysis["counts"], number]> = [
    ["mana", counts.mana],
    ["cards", counts.cards],
    ["tutors", counts.tutors],
    ["interaction", counts.interaction],
    ["protection", counts.protection],
    ["recursion", counts.recursion],
    ["combo", counts.combo],
    ["finisher", counts.finisher],
    ["tokens", counts.tokens],
    ["costReduction", counts.costReduction],
  ];

  return rankedCounts
    .filter(([, value]) => value >= 0.55)
    .sort((left, right) => Number(right[1]) - Number(left[1]))
    .slice(0, 4)
    .map(([key]) => formatCountKey(key));
}

function getAlignedRoleWeight(
  counts: DeckCommanderAnalysis["counts"],
  activeStrategyKey: StrategyKey | null,
) {
  if (!activeStrategyKey) {
    return 0;
  }

  const roles = STRATEGY_ROLE_HINTS[activeStrategyKey] ?? [];
  return roles.reduce((sum, role) => sum + getRoleCount(counts, role), 0);
}

function getPlanAlignedRoleWeight(
  counts: DeckCommanderAnalysis["counts"],
  activePlanKey: WinStrategyKey | null,
) {
  if (!activePlanKey) {
    return 0;
  }

  const roles = WIN_PLAN_ROLE_HINTS[activePlanKey] ?? [];
  return roles.reduce((sum, role) => sum + getRoleCount(counts, role), 0);
}

function getRoleCount(counts: DeckCommanderAnalysis["counts"], role: CommanderRoleTag) {
  switch (role) {
    case "mana_engine":
      return counts.mana;
    case "card_engine":
      return counts.cards;
    case "tutor_engine":
      return counts.tutors;
    case "interaction_engine":
      return counts.interaction;
    case "protection_engine":
      return counts.protection;
    case "recursion_engine":
      return counts.recursion;
    case "combo_enabler":
      return counts.combo;
    case "finisher_engine":
      return counts.finisher;
    case "token_engine":
      return counts.tokens;
    case "cost_reducer":
      return counts.costReduction;
  }
}

function getCommanderSegments(card: ScryfallCard) {
  if (!card.card_faces?.length) {
    return [
      {
        typeLine: card.type_line,
        text: normalizeText(card.oracle_text ?? ""),
      },
    ];
  }

  return card.card_faces.map((face) => ({
    typeLine: face.type_line ?? "",
    text: normalizeText(face.oracle_text ?? ""),
  }));
}

function getCommanderDeckProfile(commanderCards: ResolvedDeckCard[]): CommanderDeckProfile {
  const lowestCommanderCmc = commanderCards.reduce(
    (lowest, card) => Math.min(lowest, card.card.cmc),
    Number.POSITIVE_INFINITY,
  );

  return {
    hasLegendaryCommander: commanderCards.some((card) => card.card.type_line.includes("Legendary")),
    hasCreatureCommander: commanderCards.some((card) => card.card.type_line.includes("Creature")),
    hasCheapCommander: lowestCommanderCmc <= 2,
    hasCheapCreatureCommander: commanderCards.some(
      (card) => card.card.type_line.includes("Creature") && card.card.cmc <= 2,
    ),
    hasFreeCommander: commanderCards.some((card) => card.card.cmc === 0),
  };
}

function getCommanderProfiles(commanderCards: ResolvedDeckCard[]): CommanderProfile[] {
  return commanderCards.map((deckCard) => ({
    name: deckCard.card.name,
    normalizedName: normalizeText(deckCard.card.name),
    cmc: deckCard.card.cmc,
    isLegendary: deckCard.card.type_line.includes("Legendary"),
    isCreature: deckCard.card.type_line.includes("Creature"),
    isCheapCommander: deckCard.card.cmc <= 2,
    isCheapCreatureCommander:
      deckCard.card.type_line.includes("Creature") && deckCard.card.cmc <= 2,
    isFreeCommander: deckCard.card.cmc === 0,
  }));
}

function detectCommanderShellSupportHits(card: ScryfallCard, profile: CommanderDeckProfile) {
  const hits: CommanderRoleHit[] = [];

  for (const segment of getCommanderSegments(card)) {
    if (!segment.text) {
      continue;
    }

    if (
      /\bif you control a commander\b/.test(segment.text) ||
      /\bas long as you control a commander\b/.test(segment.text) ||
      /\bfor each time you've cast your commander from the command zone\b/.test(segment.text) ||
      /\bcommander creatures? you own have\b/.test(segment.text) ||
      /\bcommanders? you control\b/.test(segment.text) ||
      /\btarget commander\b/.test(segment.text)
    ) {
      const interaction = getInteractionProfile(segment.text);
      const protection = getProtectionProfile(segment.text);
      const mana = getManaProfile(segment.text, segment.typeLine);
      const cards = getCardProfile(segment.text);
      const tutors = getTutorProfile(segment.text);
      const finisher = getFinisherProfile(segment.text, segment.typeLine);
      const costReduction = getCostReductionProfile(segment.text);

      if (interaction) {
        hits.push({
          tag: "interaction_engine",
          weight: roundTo(interaction.weight * 0.9, 2),
          reason: "This card explicitly gets better once you control a commander.",
        });
      }

      if (protection) {
        hits.push({
          tag: "protection_engine",
          weight: roundTo(protection.weight * 0.85, 2),
          reason: "This card explicitly gets better once you control a commander.",
        });
      }

      if (mana) {
        hits.push({
          tag: "mana_engine",
          weight: roundTo(mana.weight * 0.8, 2),
          reason: "This card explicitly gets better once you control a commander.",
        });
      }

      if (cards) {
        hits.push({
          tag: "card_engine",
          weight: roundTo(cards.weight * 0.8, 2),
          reason: "This card explicitly gets better once you control a commander.",
        });
      }

      if (tutors) {
        hits.push({
          tag: "tutor_engine",
          weight: roundTo(tutors.weight * 0.8, 2),
          reason: "This card explicitly gets better once you control a commander.",
        });
      }

      if (finisher) {
        hits.push({
          tag: "finisher_engine",
          weight: roundTo(finisher.weight * 0.8, 2),
          reason: "This card explicitly gets better once you control a commander.",
        });
      }

      if (costReduction) {
        hits.push({
          tag: "cost_reducer",
          weight: roundTo(costReduction.weight * 0.8, 2),
          reason: "This card explicitly gets better once you control a commander.",
        });
      }
    }

    if (
      profile.hasLegendaryCommander &&
      /\blegendary (?:creature|permanent|creatures and planeswalkers) you control\b/.test(segment.text)
    ) {
      if (/\badd \{/.test(segment.text)) {
        hits.push({
          tag: "mana_engine",
          weight: 0.92,
          reason: "A commander reliably turns on this legendary-matters mana card.",
        });
      } else {
        hits.push({
          tag: "combo_enabler",
          weight: 0.62,
          reason: "A commander reliably turns on this legendary-matters effect.",
        });
      }
    }

    if (
      profile.hasCheapCreatureCommander &&
      /\btap an untapped creature you control\b/.test(segment.text) &&
      /\badd \{/.test(segment.text)
    ) {
      hits.push({
        tag: "mana_engine",
        weight: profile.hasFreeCommander ? 0.92 : 0.74,
        reason: "A cheap creature commander makes this tap-for-mana support card much easier to turn on.",
      });
    }

    if (
      profile.hasCheapCreatureCommander &&
      /\bequipped creature has\b[^.]{0,120}\{t\}:\s*add \{/.test(segment.text)
    ) {
      hits.push({
        tag: "mana_engine",
        weight: profile.hasFreeCommander ? 0.9 : 0.72,
        reason: "A cheap creature commander makes this equipment-based mana card much easier to use.",
      });
    }

    if (
      profile.hasCheapCreatureCommander &&
      /\bsacrifice a creature\b/.test(segment.text) &&
      /\badd \{/.test(segment.text)
    ) {
      hits.push({
        tag: "mana_engine",
        weight: profile.hasFreeCommander ? 0.98 : 0.78,
        reason: "A cheap creature commander provides a reliable sacrifice body for this mana card.",
      });
      hits.push({
        tag: "combo_enabler",
        weight: 0.5,
        reason: "Turning a command-zone creature into mana raises combo conversion.",
      });
    }

    if (
      profile.hasCheapCreatureCommander &&
      /\bsacrifice a creature\b/.test(segment.text) &&
      /\bsearch your library\b/.test(segment.text)
    ) {
      hits.push({
        tag: "tutor_engine",
        weight: profile.hasFreeCommander ? 0.94 : 0.74,
        reason: "A cheap creature commander makes this sacrifice tutor much easier to enable.",
      });
      hits.push({
        tag: "combo_enabler",
        weight: 0.48,
        reason: "A command-zone sacrifice body makes this tutor more combo-relevant.",
      });
    }
  }

  return dedupeCommanderShellHits(hits);
}

function getCommanderSupportAttribution(
  card: ScryfallCard,
  commanderProfiles: CommanderProfile[],
) {
  if (commanderProfiles.length === 0) {
    return [];
  }

  const segments = getCommanderSegments(card);
  const lowestCmc = Math.min(...commanderProfiles.map((profile) => profile.cmc));

  for (const segment of segments) {
    if (!segment.text) {
      continue;
    }

    if (
      /\btap an untapped creature you control\b/.test(segment.text) ||
      /\bequipped creature has\b[^.]{0,120}\{t\}:\s*add \{/.test(segment.text) ||
      /\bsacrifice a creature\b/.test(segment.text)
    ) {
      const creatureProfiles = commanderProfiles
        .filter((profile) => profile.isCreature)
        .sort((left, right) => left.cmc - right.cmc);
      return creatureProfiles.length > 0 ? [creatureProfiles[0]] : [];
    }

    if (
      /\blegendary (?:creature|permanent|creatures and planeswalkers) you control\b/.test(segment.text)
    ) {
      const legendaryProfiles = commanderProfiles
        .filter((profile) => profile.isLegendary)
        .sort((left, right) => left.cmc - right.cmc);
      return legendaryProfiles.length > 0 ? [legendaryProfiles[0]] : [];
    }

    if (
      /\bif you control a commander\b/.test(segment.text) ||
      /\bas long as you control a commander\b/.test(segment.text)
    ) {
      const sortedProfiles = [...commanderProfiles].sort((left, right) => left.cmc - right.cmc);
      return sortedProfiles.length > 0 ? [sortedProfiles[0]] : [];
    }

    if (
      /\btarget commander\b/.test(segment.text) ||
      /\bcommanders? you control\b/.test(segment.text) ||
      /\bcommanders? you own\b/.test(segment.text)
    ) {
      return commanderProfiles;
    }
  }

  return commanderProfiles.filter((profile) => profile.cmc === lowestCmc).slice(0, 1);
}

function getAttributionMultiplier(profile: CommanderProfile, card: ScryfallCard) {
  const text = getCommanderSegments(card)
    .map((segment) => segment.text)
    .join(" ");

  if (
    /\btap an untapped creature you control\b/.test(text) ||
    /\bequipped creature has\b[^.]{0,120}\{t\}:\s*add \{/.test(text) ||
    /\bsacrifice a creature\b/.test(text)
  ) {
    return profile.isFreeCommander ? 1.1 : profile.isCheapCreatureCommander ? 1 : 0.8;
  }

  if (/\bif you control a commander\b/.test(text) || /\bas long as you control a commander\b/.test(text)) {
    return profile.isFreeCommander ? 1.1 : profile.isCheapCommander ? 1 : 0.85;
  }

  if (/\blegendary (?:creature|permanent|creatures and planeswalkers) you control\b/.test(text)) {
    return profile.isFreeCommander ? 1.08 : profile.isCheapCommander ? 1 : 0.88;
  }

  return 1;
}

function getManaProfile(text: string, typeLine: string): CommanderRoleProfile | null {
  if (
    /\{[^}]+\}\s*:\s*add \{/.test(text) ||
    /\btap an untapped\b[^.]{0,120}:\s*add \{/.test(text) ||
    /\b(?:artifacts|creatures|lands) you control have\b[^.]{0,120}\badd \{/.test(text)
  ) {
    return { weight: 1.3, reason: "Provides repeatable mana from the command zone." };
  }

  if (
    /\bwhenever you tap\b[^.]{0,120}\bfor mana\b[^.]{0,120}\badd\b/.test(text) ||
    /\bwhenever you cast\b[^.]{0,120}\badd \{/.test(text) ||
    /\bwhenever another\b[^.]{0,120}\benters the battlefield\b[^.]{0,120}\bcreate a treasure\b/.test(text)
  ) {
    return { weight: 1.1, reason: "Turns normal play patterns into extra mana." };
  }

  if (
    /\bcreate (?:a|one|two|three|x)? ?(?:treasure|gold|powerstone) tokens?\b/.test(text) ||
    /\binvestigate\b/.test(text) ||
    /\bcreate a tapped treasure token\b/.test(text)
  ) {
    return { weight: 0.82, reason: "Creates mana-producing tokens or delayed mana value." };
  }

  if (/\buntap target (?:artifact|land|permanent)\b/.test(text) || /\buntap all artifacts\b/.test(text)) {
    return { weight: 0.76, reason: "Untap text can function as a mana engine with the right permanents." };
  }

  if (typeLine.includes("Land") && /\badd one mana of any color\b/.test(text)) {
    return { weight: 0.72, reason: "Command-zone fixing improves mana access every game." };
  }

  return null;
}

function getCardProfile(text: string): CommanderRoleProfile | null {
  if (/\bdraw (?:a|one|two|three|x|that many) cards?\b/.test(text) || /\bdraw a card\b/.test(text)) {
    if (!/\bif you would draw\b/.test(text)) {
      return { weight: /\bwhenever\b|\bat the beginning of\b|\{[^}]+\}\s*:\s*draw\b/.test(text) ? 1.28 : 1.08, reason: "Turns the command zone into repeatable card flow." };
    }
  }

  if (
    /\bexile the top card of your library\b[^.]{0,160}\byou may play\b/.test(text) ||
    /\byou may look at the top card of your library\b[^.]{0,160}\byou may cast\b/.test(text) ||
    /\byou may look at the top card of your library\b[^.]{0,160}\byou may play\b/.test(text) ||
    /\byou may cast\b[^.]{0,120}\bfrom your graveyard\b/.test(text) ||
    /\byou may play lands\b[^.]{0,120}\bfrom your graveyard\b/.test(text)
  ) {
    return { weight: 1.02, reason: "Provides repeatable card access from the command zone." };
  }

  if (/\binvestigate\b|\bcreate a clue token\b/.test(text)) {
    return { weight: 0.76, reason: "Creates delayed card advantage from the command zone." };
  }

  return null;
}

function getTutorProfile(text: string): CommanderRoleProfile | null {
  if (/\bsearch your library\b/.test(text)) {
    return {
      weight: /\bput (?:that|it) into your hand\b|\bonto the battlefield\b/.test(text) ? 1.18 : 0.94,
      reason: "Searches the library from the command zone.",
    };
  }

  if (/\breveal cards from the top of your library until\b/.test(text)) {
    return { weight: 0.82, reason: "Digs for specific card types from the command zone." };
  }

  return null;
}

function getInteractionProfile(text: string): CommanderRoleProfile | null {
  if (
    /\bcounter target spell\b/.test(text) ||
    /\bdestroy target\b/.test(text) ||
    /\bexile target\b/.test(text) ||
    /\breturn target (?:spell|nonland permanent|creature|artifact|enchantment)\b/.test(text) ||
    /\btarget opponent sacrifices\b/.test(text) ||
    /\bfight target\b/.test(text)
  ) {
    return {
      weight: /\bwhenever\b|\{[^}]+\}\s*:/.test(text) ? 1.08 : 0.9,
      reason: "Provides interactive pressure from the command zone.",
    };
  }

  return null;
}

function getProtectionProfile(text: string): CommanderRoleProfile | null {
  if (
    /\bhexproof\b/.test(text) ||
    /\bindestructible\b/.test(text) ||
    /\bward\b/.test(text) ||
    /\bprotection from\b/.test(text) ||
    /\bphase(?:s)? out\b/.test(text) ||
    /\bcan't be the target\b/.test(text) ||
    /\bregenerate\b/.test(text)
  ) {
    return { weight: 0.96, reason: "Protects itself or the shell from the command zone." };
  }

  if (
    /\breturn target\b[^.]{0,100}\byou control\b[^.]{0,60}\bto its owner's hand\b/.test(text) ||
    /\bexile target\b[^.]{0,100}\byou control\b[^.]{0,120}\breturn it\b/.test(text)
  ) {
    return { weight: 0.78, reason: "Can shield key permanents by bouncing or blinking them." };
  }

  return null;
}

function getRecursionProfile(text: string): CommanderRoleProfile | null {
  if (
    /\breturn target\b[^.]{0,120}\bfrom your graveyard to\b/.test(text) ||
    /\breturn\b[^.]{0,120}\bfrom your graveyard to your hand\b/.test(text) ||
    /\byou may cast\b[^.]{0,120}\bfrom your graveyard\b/.test(text) ||
    /\byou may play lands\b[^.]{0,120}\bfrom your graveyard\b/.test(text) ||
    /\bwhen(?:ever)?\b[^.]{0,120}\bdies\b[^.]{0,140}\breturn\b/.test(text)
  ) {
    return { weight: 1.02, reason: "Lets the deck recover resources from the graveyard out of the command zone." };
  }

  return null;
}

function getFinisherProfile(text: string, typeLine: string): CommanderRoleProfile | null {
  if (
    /\byou win the game\b/.test(text) ||
    /\beach opponent loses\b[^.]{0,120}\blife\b/.test(text) ||
    /\bdeals?\b[^.]{0,80}\bdamage to each opponent\b/.test(text) ||
    /\badditional combat phase\b/.test(text) ||
    /\bcreatures you control get\b[^.]{0,160}(?:trample|double strike|unblockable|can't be blocked|infect)\b/.test(text)
  ) {
    return { weight: 1.14, reason: "Directly points toward a closing role from the command zone." };
  }

  if (
    /\bgets \+\d+\/\+\d+\b/.test(text) ||
    /\bdouble strike\b/.test(text) ||
    /\bcan't be blocked\b/.test(text) ||
    /\bdeals combat damage to a player\b/.test(text)
  ) {
    return { weight: typeLine.includes("Creature") ? 0.74 : 0.62, reason: "Supports commander-centric combat kills." };
  }

  return null;
}

function getTokenProfile(text: string): CommanderRoleProfile | null {
  if (/\bcreate\b[^.]{0,120}\btoken\b/.test(text)) {
    return { weight: /\bwhenever\b|\bat the beginning of\b/.test(text) ? 1.02 : 0.8, reason: "Generates board presence from the command zone." };
  }

  return null;
}

function getCostReductionProfile(text: string): CommanderRoleProfile | null {
  if (
    /\bspells? you cast cost\b[^.]{0,80}\bless to cast\b/.test(text) ||
    /\bartifact spells you cast cost\b[^.]{0,80}\bless to cast\b/.test(text) ||
    /\bactivate(?:d)? abilities\b[^.]{0,80}\bcost\b[^.]{0,80}\bless to activate\b/.test(text) ||
    /\bwithout paying (?:its|their) mana cost\b/.test(text)
  ) {
    return { weight: 1.04, reason: "Compresses mana requirements from the command zone." };
  }

  return null;
}

function getComboProfile(text: string): CommanderRoleProfile | null {
  if (
    /\bcopy\b[^.]{0,180}\b(?:spell|ability)\b/.test(text) ||
    /\bcopy (?:that|the|next|target)\b[^.]{0,140}\b(?:spell|ability)\b/.test(text)
  ) {
    const xMultiplier =
      /\bwith x in (?:its|their) mana cost\b|\bwith x in (?:its|their) activation cost\b|\bwhere x\b/.test(text)
        ? 1.2
        : 1;

    return {
      weight: roundTo(1.12 * xMultiplier, 2),
      reason: "Copies scalable spells or abilities from the command zone, multiplying the deck's best payoff turns.",
    };
  }

  if (
    /\bwhenever you cast\b[^.]{0,160}\bwith x in (?:its|their) mana cost\b/.test(text) ||
    /\bactivate\b[^.]{0,160}\bwith x in (?:its|their) activation cost\b/.test(text)
  ) {
    return {
      weight: 0.92,
      reason: "Directly rewards scalable X-spell or X-ability turns from the command zone.",
    };
  }

  return null;
}

function addHit(
  hits: Map<CommanderRoleTag, { weight: number; reasons: Set<string> }>,
  tag: CommanderRoleTag,
  weight: number,
  reason: string,
) {
  const existing = hits.get(tag);

  if (!existing) {
    hits.set(tag, {
      weight,
      reasons: new Set([reason]),
    });
    return;
  }

  existing.weight = Math.max(existing.weight, weight);
  existing.reasons.add(reason);
}

function dedupeCommanderShellHits(hits: CommanderRoleHit[]) {
  const deduped = new Map<CommanderRoleTag, CommanderRoleHit>();

  for (const hit of hits) {
    const existing = deduped.get(hit.tag);
    if (!existing || hit.weight > existing.weight) {
      deduped.set(hit.tag, hit);
    }
  }

  return [...deduped.values()];
}

function mergeCommanderTaggedHits(
  store: Map<string, CommanderTaggedCard>,
  commanderName: string,
  section: "commander" | "mainboard" | "sideboard" | "maybeboard" | "companion",
  hits: CommanderRoleHit[],
) {
  const key = normalizeText(commanderName);
  const existing = store.get(key);

  if (!existing) {
    store.set(key, {
      name: commanderName,
      section,
      roleValue: roundTo(totalWeight(hits), 2),
      hits: mergeCommanderRoleHits(hits),
    });
    return;
  }

  existing.hits = mergeCommanderRoleHits([...existing.hits, ...hits]);
  existing.roleValue = roundTo(totalWeight(existing.hits), 2);
}

function mergeCommanderRoleHits(hits: CommanderRoleHit[]) {
  const merged = new Map<CommanderRoleTag, { weight: number; reasons: Set<string> }>();

  for (const hit of hits) {
    const existing = merged.get(hit.tag);

    if (!existing) {
      merged.set(hit.tag, {
        weight: hit.weight,
        reasons: new Set([hit.reason]),
      });
      continue;
    }

    existing.weight += hit.weight;
    existing.reasons.add(hit.reason);
  }

  return [...merged.entries()].map(([tag, value]) => ({
    tag,
    weight: roundTo(value.weight, 2),
    reason: [...value.reasons].join(" "),
  }));
}

function totalWeight(hits: Array<{ weight: number }>) {
  return hits.reduce((sum, hit) => sum + hit.weight, 0);
}

function formatCountKey(key: keyof DeckCommanderAnalysis["counts"]) {
  switch (key) {
    case "mana":
      return ROLE_LABELS.mana_engine;
    case "cards":
      return ROLE_LABELS.card_engine;
    case "tutors":
      return ROLE_LABELS.tutor_engine;
    case "interaction":
      return ROLE_LABELS.interaction_engine;
    case "protection":
      return ROLE_LABELS.protection_engine;
    case "recursion":
      return ROLE_LABELS.recursion_engine;
    case "combo":
      return ROLE_LABELS.combo_enabler;
    case "finisher":
      return ROLE_LABELS.finisher_engine;
    case "tokens":
      return ROLE_LABELS.token_engine;
    case "costReduction":
      return ROLE_LABELS.cost_reducer;
  }
}

function joinRoleLabels(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function getScoreWord(score: number) {
  if (score >= 76) {
    return "high";
  }

  if (score >= 56) {
    return "meaningful";
  }

  if (score >= 38) {
    return "light";
  }

  return "low";
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function clampScore(value: number) {
  return roundTo(clampValue(value, 0, 100), 1);
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
