import {
  DeckResolutionDocument,
  DeckCommanderProfile,
  DeckStrategyAnalysis,
  DeckStrategyEntry,
  DeckStrategyPerspective,
  DeckStrategySynergy,
  DeckWinConditionAnalysis,
  DeckSection,
  ResolvedDeckCard,
  ScryfallCard,
  StrategyKey,
} from "./types";
import { createEffectiveManaValueContext, sumEffectiveManaValue } from "./effectiveManaValue";
import { analyzeCommanderProfiles } from "./commanderProfile";

const STRATEGY_LABELS: Record<StrategyKey, string> = {
  combo: "Combo",
  spellslinger: "Spellslinger",
  artifacts: "Artifacts",
  enchantress: "Enchantress",
  superfriends: "Superfriends",
  reanimator: "Reanimator",
  lands_matter: "Lands Matter",
  tokens: "Tokens",
  aristocrats: "Aristocrats",
  blink: "Blink",
  face_down: "Face-Down",
  dungeons: "Dungeons / Venture",
  madness: "Madness / Discard",
  ninjutsu: "Ninjutsu",
  curses: "Curses",
  exile_cast: "Cast from Exile",
  food: "Food",
  clues: "Clues / Investigate",
  energy: "Energy",
  sagas: "Sagas",
  monarch: "Monarch",
  theft: "Theft",
  goad: "Goad",
  shrines: "Shrines",
  cycling: "Cycling",
  mutate: "Mutate",
  poison: "Poison / Infect",
  battles: "Battles",
  pillowfort: "Pillowfort",
  copy_clone: "Copy / Clone",
  power_matter: "Power Matters",
  mana_value_matter: "Mana Value Matters",
  x_spells: "X-Spells",
  legends_matter: "Legends Matter",
  toughness_matter: "Toughness Matters",
  pingers: "Pingers / Small Damage",
  counters: "Counters",
  voltron: "Voltron",
  extra_combat: "Extra Combat",
  extra_upkeep: "Extra Upkeeps",
  tap_untap: "Tap / Untap",
  dice_rolls: "Dice Rolls",
  coin_flip: "Coin Flip",
  treasure: "Treasure",
  kindred: "Kindred",
  stax: "Stax / Taxes",
  control: "Control",
  group_hug: "Group Hug",
  group_slug: "Group Slug",
  lifegain: "Lifegain / Drain",
  mill: "Mill",
  aggro: "Aggro",
};

const STRATEGY_TARGETS: Record<StrategyKey, number> = {
  combo: 4.2,
  spellslinger: 8.2,
  artifacts: 7.8,
  enchantress: 7,
  superfriends: 5.4,
  reanimator: 6.8,
  lands_matter: 6.6,
  tokens: 6.4,
  aristocrats: 5.9,
  blink: 5.8,
  face_down: 5.4,
  dungeons: 4.9,
  madness: 5.2,
  ninjutsu: 5.1,
  curses: 4.8,
  exile_cast: 5.6,
  food: 5.1,
  clues: 5,
  energy: 5.2,
  sagas: 5,
  monarch: 4.8,
  theft: 5,
  goad: 4.8,
  shrines: 4.8,
  cycling: 5.1,
  mutate: 5,
  poison: 5.1,
  battles: 4.8,
  pillowfort: 5,
  copy_clone: 5.2,
  power_matter: 5.4,
  mana_value_matter: 5.3,
  x_spells: 5.1,
  legends_matter: 5.6,
  toughness_matter: 5.3,
  pingers: 5,
  counters: 5.9,
  voltron: 5.3,
  extra_combat: 4.7,
  extra_upkeep: 4.6,
  tap_untap: 5.1,
  dice_rolls: 4.2,
  coin_flip: 3.8,
  treasure: 5.1,
  kindred: 5.8,
  stax: 4.8,
  control: 5.8,
  group_hug: 5.2,
  group_slug: 5.1,
  lifegain: 5.6,
  mill: 4.8,
  aggro: 6.4,
};

const COMMANDER_STRATEGY_MULTIPLIER = 1.9;
const SECRET_COMMANDER_STRATEGY_MULTIPLIER = 1.35;
const COUNTER_TYPE_BLACKLIST = new Set([
  "a",
  "an",
  "another",
  "any",
  "each",
  "every",
  "more",
  "less",
  "many",
  "number",
  "same",
  "that",
  "those",
  "these",
  "this",
  "target",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
]);
const STRATEGY_SUPPORT_TARGETS: Record<StrategyKey, { support: number; core: number }> = {
  combo: { support: 6, core: 3 },
  spellslinger: { support: 22, core: 10 },
  artifacts: { support: 20, core: 10 },
  enchantress: { support: 14, core: 7 },
  superfriends: { support: 12, core: 6 },
  reanimator: { support: 15, core: 7 },
  lands_matter: { support: 14, core: 7 },
  tokens: { support: 16, core: 8 },
  aristocrats: { support: 18, core: 9 },
  blink: { support: 14, core: 7 },
  face_down: { support: 14, core: 7 },
  dungeons: { support: 10, core: 5 },
  madness: { support: 13, core: 6 },
  ninjutsu: { support: 13, core: 6 },
  curses: { support: 10, core: 5 },
  exile_cast: { support: 14, core: 7 },
  food: { support: 12, core: 6 },
  clues: { support: 12, core: 6 },
  energy: { support: 13, core: 6 },
  sagas: { support: 12, core: 6 },
  monarch: { support: 9, core: 4 },
  theft: { support: 11, core: 5 },
  goad: { support: 10, core: 5 },
  shrines: { support: 9, core: 5 },
  cycling: { support: 14, core: 7 },
  mutate: { support: 11, core: 5 },
  poison: { support: 12, core: 6 },
  battles: { support: 9, core: 4 },
  pillowfort: { support: 10, core: 5 },
  copy_clone: { support: 12, core: 6 },
  power_matter: { support: 14, core: 7 },
  mana_value_matter: { support: 13, core: 6 },
  x_spells: { support: 10, core: 5 },
  legends_matter: { support: 13, core: 6 },
  toughness_matter: { support: 14, core: 7 },
  pingers: { support: 13, core: 6 },
  counters: { support: 14, core: 7 },
  voltron: { support: 12, core: 6 },
  extra_combat: { support: 10, core: 5 },
  extra_upkeep: { support: 9, core: 4 },
  tap_untap: { support: 12, core: 6 },
  dice_rolls: { support: 8, core: 4 },
  coin_flip: { support: 7, core: 3 },
  treasure: { support: 13, core: 6 },
  kindred: { support: 18, core: 10 },
  stax: { support: 10, core: 5 },
  control: { support: 14, core: 7 },
  group_hug: { support: 12, core: 6 },
  group_slug: { support: 12, core: 6 },
  lifegain: { support: 14, core: 7 },
  mill: { support: 12, core: 6 },
  aggro: { support: 18, core: 9 },
};

interface StrategyHit {
  key: StrategyKey;
  weight: number;
  reason: string;
}

interface StrategySupportCard {
  name: string;
  section: DeckSection;
  quantity: number;
  weight: number;
  reasons: string[];
}

interface StrategyContext {
  deckCards: ResolvedDeckCard[];
  commanderProfiles: DeckCommanderProfile[];
  artifactCount: number;
  enchantmentCount: number;
  instantSorceryCount: number;
  planeswalkerCount: number;
  equipmentAuraCount: number;
  creatureCount: number;
  averageNonlandManaValue: number;
  counterspellCount: number;
  sweeperCount: number;
  staxCount: number;
  superfriendsSupportCount: number;
  groupHugCount: number;
  selfMillCount: number;
  proliferateCount: number;
  dominantCounterType: string | null;
  dominantCounterTypeCount: number;
  dominantCounterTypeRatio: number;
  etbPayoffCount: number;
  faceDownCount: number;
  extraCombatCount: number;
  aggroSignalCount: number;
  groupSlugCount: number;
  lifegainCount: number;
  millCount: number;
  diceRollCount: number;
  coinFlipCount: number;
  xSpellCount: number;
  xSpellPayoffCount: number;
  manaEngineCount: number;
  kindredPayoffCount: number;
  dominantCreatureType: string | null;
  dominantCreatureCount: number;
  dominantCreatureRatio: number;
  kindredEnabled: boolean;
}

interface CommanderBuildAroundProfile {
  key: StrategyKey;
  commander: ResolvedDeckCard;
  label: string;
  supportReason: string;
  minimumSupport: number;
  supportWeight: number;
  matcher: (deckCard: ResolvedDeckCard) => boolean;
}

interface LinkedSynergyProfile {
  key: StrategyKey;
  label: string;
  enablerReason: string;
  materialReason: string;
  minimumEnablers: number;
  minimumMaterial: number;
  enablerWeight: number;
  materialWeight: number;
  bonusScale: number;
  enablerMatcher: (deckCard: ResolvedDeckCard) => boolean;
  materialMatcher: (deckCard: ResolvedDeckCard) => boolean;
}

export function analyzeDeckStrategy(
  document: DeckResolutionDocument,
  winConditions: DeckWinConditionAnalysis,
  options: { secretCommanderName?: string; preferredStrategyKey?: string } = {},
): DeckStrategyAnalysis {
  const context = getStrategyContext(document);
  const totals = createStrategyTotals();
  const keyCards = new Map<StrategyKey, Map<string, number>>();
  const reasons = new Map<StrategyKey, Map<string, number>>();
  const supportBuckets = createStrategySupportBuckets();
  const normalizedSecretCommanderName = options.secretCommanderName
    ? normalizeText(options.secretCommanderName)
    : "";

  for (const deckCard of context.deckCards) {
    const hits = detectStrategyHits(deckCard.card, context);
    const multiplier =
      deckCard.section === "commander"
        ? COMMANDER_STRATEGY_MULTIPLIER
        : isSecretCommanderCard(deckCard, normalizedSecretCommanderName)
          ? SECRET_COMMANDER_STRATEGY_MULTIPLIER
          : 1;

    for (const hit of hits) {
      const weightedAmount = roundTo(hit.weight * multiplier * deckCard.quantity, 2);
      totals[hit.key] += weightedAmount;
      trackKeyCard(keyCards, hit.key, deckCard.card.name, weightedAmount);
      trackReason(reasons, hit.key, hit.reason, weightedAmount);
      trackStrategySupportCard(
        supportBuckets,
        hit.key,
        deckCard,
        weightedAmount,
        hit.reason,
      );
    }
  }

  applyCommanderBuildAroundAdjustments(totals, keyCards, supportBuckets, reasons, context);
  applyLinkedSynergyAdjustments(totals, keyCards, supportBuckets, reasons, context);
  applyCommanderThemeAdjustments(totals, supportBuckets, reasons);
  applyDensityAdjustments(totals, context, reasons);
  applySynergyAdjustments(totals, context, reasons, winConditions);
  applyComboAdjustments(totals, keyCards, reasons, supportBuckets, context, winConditions);

  const rankedStrategies = (Object.keys(STRATEGY_LABELS) as StrategyKey[])
    .map((key) => buildStrategyEntry(key, totals[key], totals, keyCards, reasons, context))
    .sort((left, right) => right.score - left.score || right.rawScore - left.rawScore);

  const strongestStrategy = rankedStrategies[0] ?? null;
  const mainStrategy =
    strongestStrategy && strongestStrategy.score >= 24 ? strongestStrategy : null;
  const mainStrategySeed =
    mainStrategy === null
      ? null
      : {
          ...mainStrategy,
          confidence: computeConfidence(
            mainStrategy,
            rankedStrategies.find((entry) => entry.key !== mainStrategy.key) ?? null,
          ),
        };
  const perspectiveSeeds = dedupeStrategyEntries([
    ...rankedStrategies.slice(0, 6),
    ...(mainStrategySeed === null
      ? []
      : [mainStrategySeed, ...selectPerspectiveSubStrategies(mainStrategySeed, rankedStrategies)]),
  ]);
  const perspectives = perspectiveSeeds
    .map((entry) =>
      buildStrategyPerspective(
        entry,
        rankedStrategies,
        supportBuckets,
        context,
        winConditions,
        normalizedSecretCommanderName,
      ),
    )
    .filter((perspective): perspective is DeckStrategyPerspective => perspective !== null);
  const detectedMainPerspective =
    mainStrategy === null
      ? null
      : perspectives.find((perspective) => perspective.strategy.key === mainStrategy.key) ?? null;
  const preferredPerspective =
    options.preferredStrategyKey === undefined
      ? null
      : perspectives.find((perspective) => perspective.strategy.key === options.preferredStrategyKey) ??
        null;
  const activePerspective = preferredPerspective ?? detectedMainPerspective;
  const activeStrategy = activePerspective?.strategy ?? mainStrategy;
  const subStrategies = activePerspective?.subStrategies ?? [];
  const synergy = activePerspective?.synergy ?? null;

  return {
    summary: summarizeStrategies(activeStrategy, subStrategies),
    detectedMainStrategy: detectedMainPerspective?.strategy ?? mainStrategy,
    mainStrategy: activeStrategy,
    subStrategies,
    topStrategies: rankedStrategies.slice(0, 8),
    synergy,
    perspectives,
    commanderProfiles: context.commanderProfiles,
  };
}

function isSecretCommanderCard(deckCard: ResolvedDeckCard, normalizedSecretCommanderName: string) {
  if (!normalizedSecretCommanderName || deckCard.section !== "mainboard") {
    return false;
  }

  return (
    normalizeText(deckCard.requestedName) === normalizedSecretCommanderName ||
    normalizeText(deckCard.card.name) === normalizedSecretCommanderName
  );
}

function getStrategyContext(document: DeckResolutionDocument): StrategyContext {
  const deckCards = document.result.resolvedCards.filter(
    (card) => card.section === "commander" || card.section === "mainboard",
  );
  const commanderProfiles = analyzeCommanderProfiles(document);
  const creatureCount = sumMatchingCards(deckCards, (card) => hasCardType(card.card, "Creature"));
  const planeswalkerCount = sumMatchingCards(
    deckCards,
    (card) => hasCardType(card.card, "Planeswalker"),
  );
  const nonlandCards = deckCards.filter((card) => !hasCardType(card.card, "Land"));
  const nonlandTotal = nonlandCards.reduce((sum, card) => sum + card.quantity, 0);
  const effectiveManaContext = createEffectiveManaValueContext(deckCards);
  const nonlandManaTotal = sumEffectiveManaValue(nonlandCards, effectiveManaContext);
  const counterProfile = getCounterProfile(deckCards);
  const dominantCreatureType = getDominantCreatureType(deckCards);
  const dominantCreatureRatio =
    dominantCreatureType && creatureCount > 0 ? dominantCreatureType.count / creatureCount : 0;
  const kindredPayoffCount = sumMatchingCards(
    deckCards,
    (card) =>
      getStrategySegments(card.card).some((segment) =>
        hasKindredPayoffText(segment.text, dominantCreatureType?.type ?? null),
      ),
  );
  const kindredEnabled =
    dominantCreatureType !== null &&
    ((dominantCreatureType.count >= 9 &&
      dominantCreatureRatio >= 0.34 &&
      kindredPayoffCount >= 2) ||
      (dominantCreatureType.count >= 12 && dominantCreatureRatio >= 0.4));

  return {
    deckCards,
    commanderProfiles,
    artifactCount: sumMatchingCards(deckCards, (card) => hasCardType(card.card, "Artifact")),
    enchantmentCount: sumMatchingCards(deckCards, (card) =>
      hasCardType(card.card, "Enchantment"),
    ),
    instantSorceryCount: sumMatchingCards(
      deckCards,
      (card) => hasCardType(card.card, "Instant") || hasCardType(card.card, "Sorcery"),
    ),
    planeswalkerCount,
    equipmentAuraCount: sumMatchingCards(
      deckCards,
      (card) =>
        cardHasSubtype(card.card, "Equipment") ||
        cardHasSubtype(card.card, "Aura") ||
        card.card.type_line.includes("Equipment") ||
        card.card.type_line.includes("Aura"),
    ),
    creatureCount,
    averageNonlandManaValue:
      nonlandTotal > 0 ? roundTo(nonlandManaTotal / nonlandTotal, 2) : 0,
    counterspellCount: sumMatchingCards(deckCards, (card) => hasCounterspellCardText(card.card)),
    sweeperCount: sumMatchingCards(deckCards, (card) => hasSweeperCardText(card.card)),
    staxCount: sumMatchingCards(deckCards, (card) => hasStaxCardText(card.card)),
    superfriendsSupportCount: sumMatchingCards(
      deckCards,
      (card) => hasSuperfriendsCardText(card.card),
    ),
    groupHugCount: sumMatchingCards(deckCards, (card) => hasGroupHugCardText(card.card)),
    selfMillCount: sumMatchingCards(deckCards, (card) => hasSelfMillCardText(card.card)),
    proliferateCount: counterProfile.proliferateCount,
    dominantCounterType: counterProfile.dominantType,
    dominantCounterTypeCount: counterProfile.dominantCount,
    dominantCounterTypeRatio: counterProfile.dominantRatio,
    etbPayoffCount: sumMatchingCards(deckCards, (card) => hasEtbPayoffCardText(card.card)),
    faceDownCount: sumMatchingCards(deckCards, (card) => hasFaceDownCardText(card.card)),
    extraCombatCount: sumMatchingCards(deckCards, (card) => hasExtraCombatCardText(card.card)),
    aggroSignalCount: sumMatchingCards(deckCards, (card) => hasAggroCardText(card.card)),
    groupSlugCount: sumMatchingCards(deckCards, (card) => hasGroupSlugCardText(card.card)),
    lifegainCount: sumMatchingCards(deckCards, (card) => hasLifegainCardText(card.card)),
    millCount: sumMatchingCards(deckCards, (card) => hasMillCardText(card.card)),
    diceRollCount: sumMatchingCards(deckCards, (card) => hasDiceRollCardText(card.card)),
    coinFlipCount: sumMatchingCards(deckCards, (card) => hasCoinFlipCardText(card.card)),
    xSpellCount: sumMatchingCards(deckCards, (card) => hasXSpellCardText(card.card)),
    xSpellPayoffCount: sumMatchingCards(deckCards, (card) => hasXSpellPayoffCardText(card.card)),
    manaEngineCount: sumMatchingCards(deckCards, (card) => hasManaEngineCardText(card.card)),
    kindredPayoffCount,
    dominantCreatureType: dominantCreatureType?.type ?? null,
    dominantCreatureCount: dominantCreatureType?.count ?? 0,
    dominantCreatureRatio,
    kindredEnabled,
  };
}

function detectStrategyHits(card: ScryfallCard, context: StrategyContext): StrategyHit[] {
  const hits = new Map<StrategyKey, { weight: number; reasons: Set<string> }>();
  const segments = getStrategySegments(card);

  if (hasCardType(card, "Artifact") && !hasCardType(card, "Land")) {
    addStrategyHit(hits, "artifacts", 0.24, "Artifact density supports an artifact shell.");
  }

  if (
    hasCardType(card, "Enchantment") &&
    !hasCardType(card, "Land") &&
    !segments.some((segment) => hasTheftText(segment.text))
  ) {
    addStrategyHit(
      hits,
      "enchantress",
      0.24,
      "Enchantment density supports an enchantress-style shell.",
    );
  }

  if (hasCardType(card, "Planeswalker")) {
    addStrategyHit(
      hits,
      "superfriends",
      0.48,
      "Planeswalker density supports a Superfriends shell.",
    );
  }

  if (hasCardType(card, "Instant") || hasCardType(card, "Sorcery")) {
    addStrategyHit(
      hits,
      "spellslinger",
      0.16,
      "Instants and sorceries naturally reinforce a spellslinger shell.",
    );
  }

  if (
    (card.type_line.includes("Equipment") || card.type_line.includes("Aura")) &&
    !segments.some((segment) => hasTheftText(segment.text))
  ) {
    addStrategyHit(hits, "voltron", 0.34, "Auras and Equipment often support a Voltron plan.");
  }

  if (
    context.kindredEnabled &&
    context.dominantCreatureType &&
    cardHasCreatureType(card, context.dominantCreatureType)
  ) {
    addStrategyHit(
      hits,
      "kindred",
      0.22,
      `${formatCreatureType(context.dominantCreatureType)} concentration supports a kindred shell.`,
    );
  }

  for (const segment of segments) {
    const text = segment.text;
    if (!text) {
      continue;
    }
    if (hasTokenText(text)) {
      addStrategyHit(hits, "tokens", 1.02, "Creates or rewards a real token plan.");
    }

    if (hasTreasureText(text)) {
      addStrategyHit(hits, "treasure", 1.04, "Creates or rewards Treasure production.");
      addStrategyHit(hits, "artifacts", 0.18, "Treasure also reinforces artifact synergies.");
    }

    if (hasAristocratsText(text)) {
      addStrategyHit(
        hits,
        "aristocrats",
        0.98,
        "Sacrifice and death-trigger text points toward Aristocrats.",
      );
    }

    if (hasBlinkText(text)) {
      addStrategyHit(hits, "blink", 1.05, "Exile-and-return wording is a direct blink signal.");
    }

    if (hasEtbPayoffText(text)) {
      addStrategyHit(hits, "blink", 0.38, "ETB payoffs usually pair well with blink effects.");
    }

    if (hasFaceDownText(text, card.keywords)) {
      addStrategyHit(
        hits,
        "face_down",
        getFaceDownStrategyWeight(text, card.keywords),
        "Face-down, morph, manifest, cloak, or disguise text supports a face-down shell.",
      );
    }

    if (hasDungeonText(text, card.keywords)) {
      addStrategyHit(
        hits,
        "dungeons",
        getDungeonStrategyWeight(text, card.keywords),
        "Venture, initiative, or dungeon-completion text supports a dungeon shell.",
      );
      if (hasReanimatorText(text, card.keywords)) {
        addStrategyHit(hits, "reanimator", 0.24, "Dungeon shells often overlap with graveyard value.");
      }
    }

    if (hasMadnessText(text, card.keywords)) {
      addStrategyHit(
        hits,
        "madness",
        getMadnessStrategyWeight(text, card.keywords),
        "Madness, discard outlets, or discard payoffs support a madness shell.",
      );
      if (hasReanimatorText(text, card.keywords)) {
        addStrategyHit(hits, "reanimator", 0.22, "Discard support can also fuel graveyard plans.");
      }
    }

    if (hasNinjutsuText(text, card.keywords, card)) {
      addStrategyHit(
        hits,
        "ninjutsu",
        getNinjutsuStrategyWeight(text, card.keywords, card),
        "Ninjutsu, Ninja, or unblocked-attack text supports a Ninjutsu shell.",
      );
      addStrategyHit(hits, "aggro", 0.18, "Ninjutsu also needs evasive combat pressure.");
    }

    if (hasCurseText(text, card)) {
      addStrategyHit(
        hits,
        "curses",
        getCurseStrategyWeight(text, card),
        "Curse subtype or enchanted-player payoff text supports a Curse shell.",
      );
      addStrategyHit(hits, "enchantress", 0.18, "Curses also count as enchantment density.");
    }

    if (hasExileCastText(text, card.keywords)) {
      addStrategyHit(
        hits,
        "exile_cast",
        getExileCastStrategyWeight(text),
        "Exile access or cast-from-exile payoffs support a cast-from-exile shell.",
      );
      addStrategyHit(hits, "spellslinger", 0.12, "Cast-from-exile engines often overlap with spell velocity.");
    }

    if (hasFoodText(text)) {
      addStrategyHit(
        hits,
        "food",
        getFoodStrategyWeight(text),
        "Food creation or Food payoff text supports a Food shell.",
      );
      addStrategyHit(hits, "artifacts", 0.14, "Food tokens also reinforce artifact synergies.");
      addStrategyHit(hits, "lifegain", 0.1, "Food tokens can support lifegain plans.");
    }

    if (hasClueText(text, card.keywords)) {
      addStrategyHit(
        hits,
        "clues",
        getClueStrategyWeight(text, card.keywords),
        "Clue creation or investigate text supports a Clues shell.",
      );
      addStrategyHit(hits, "artifacts", 0.12, "Clue tokens also reinforce artifact synergies.");
    }

    if (hasEnergyText(text)) {
      addStrategyHit(
        hits,
        "energy",
        getEnergyStrategyWeight(text),
        "Energy counter production or spending supports an Energy shell.",
      );
      addStrategyHit(hits, "counters", 0.14, "Energy is also a counter resource.");
    }

    if (hasSagaText(text, card)) {
      addStrategyHit(
        hits,
        "sagas",
        getSagaStrategyWeight(text, card),
        "Saga subtype or chapter/lore-counter text supports a Saga shell.",
      );
      addStrategyHit(hits, "enchantress", 0.16, "Sagas also count as enchantment density.");
    }

    if (hasMonarchText(text)) {
      addStrategyHit(
        hits,
        "monarch",
        getMonarchStrategyWeight(text),
        "Monarch text supports a political card-advantage shell.",
      );
      addStrategyHit(hits, "control", 0.12, "Monarch decks often need defensive control tools.");
    }

    if (hasTheftText(text)) {
      addStrategyHit(
        hits,
        "theft",
        getTheftStrategyWeight(text),
        "Stealing permanents or opponents' cards supports a Theft shell.",
      );
      addStrategyHit(hits, "control", 0.12, "Theft effects often play as control or attrition.");
    }

    if (hasGoadText(text)) {
      addStrategyHit(
        hits,
        "goad",
        getGoadStrategyWeight(text),
        "Goad or forced-combat text supports a Goad shell.",
      );
      addStrategyHit(hits, "control", 0.1, "Goad redirects pressure as a political control tool.");
    }

    if (hasShrineText(text, card)) {
      addStrategyHit(
        hits,
        "shrines",
        getShrineStrategyWeight(text, card),
        "Shrine subtype or Shrine-scaling text supports a Shrine shell.",
      );
      addStrategyHit(hits, "enchantress", 0.14, "Shrines also count as enchantment density.");
    }

    if (hasCyclingText(text, card.keywords)) {
      addStrategyHit(
        hits,
        "cycling",
        getCyclingStrategyWeight(text, card.keywords),
        "Cycling, cycle triggers, or cycling payoff text supports a Cycling shell.",
      );
      addStrategyHit(hits, "spellslinger", 0.08, "Cycling decks often convert card velocity into spell value.");
    }

    if (hasMutateText(text, card.keywords)) {
      addStrategyHit(
        hits,
        "mutate",
        getMutateStrategyWeight(text, card.keywords),
        "Mutate or merged-creature text supports a Mutate shell.",
      );
      addStrategyHit(hits, "voltron", 0.1, "Mutate often stacks value onto one threat.");
    }

    if (hasPoisonText(text, card.keywords)) {
      addStrategyHit(
        hits,
        "poison",
        getPoisonStrategyWeight(text, card.keywords),
        "Poison, infect, toxic, corrupted, or proliferate poison text supports a poison shell.",
      );
      addStrategyHit(hits, "counters", 0.14, "Poison counters also overlap with counter manipulation.");
    }

    if (hasBattleText(text, card)) {
      addStrategyHit(
        hits,
        "battles",
        getBattleStrategyWeight(text, card),
        "Battle card type or battle-defeat payoff text supports a Battle shell.",
      );
      addStrategyHit(hits, "control", 0.08, "Battle decks often need board-control tools to manage attacks.");
    }

    if (hasPillowfortText(text)) {
      addStrategyHit(
        hits,
        "pillowfort",
        getPillowfortStrategyWeight(text),
        "Attack-tax, damage prevention, or no-attack text supports a Pillowfort shell.",
      );
      addStrategyHit(hits, "control", 0.18, "Pillowfort effects are defensive control tools.");
    }

    if (hasCopyCloneText(text)) {
      addStrategyHit(
        hits,
        "copy_clone",
        getCopyCloneStrategyWeight(text),
        "Copying spells, permanents, tokens, or creatures supports a Copy / Clone shell.",
      );
      addStrategyHit(hits, "combo", 0.08, "Copy engines can also enable combo lines.");
    }

    if (hasPowerMatterText(text, card)) {
      addStrategyHit(
        hits,
        "power_matter",
        getPowerMatterWeight(text, card),
        "Power thresholds or power-scaling text supports a Power Matters shell.",
      );
    }

    if (hasManaValueMatterText(text)) {
      addStrategyHit(
        hits,
        "mana_value_matter",
        getManaValueMatterWeight(text),
        "Mana-value thresholds or cast-size payoffs support a Mana Value Matters shell.",
      );
    }

    if (hasXSpellText(text, card)) {
      addStrategyHit(
        hits,
        "x_spells",
        getXSpellStrategyWeight(text, card),
        "X costs or X-scaling effects support an X-spells shell.",
      );
      addStrategyHit(hits, "spellslinger", 0.1, "X-spells often overlap with spell velocity.");
    }

    if (hasXSpellPayoffText(text)) {
      addStrategyHit(
        hits,
        "x_spells",
        0.98,
        "Payoffs for spending large mana or casting big spells support an X-spells shell.",
      );
    }

    if (hasLegendsMatterText(text, card)) {
      addStrategyHit(
        hits,
        "legends_matter",
        getLegendsMatterWeight(text, card),
        "Legendary-spell or legendary-permanent text supports a Legends Matter shell.",
      );
    }

    if (hasToughnessMatterText(text, card)) {
      addStrategyHit(
        hits,
        "toughness_matter",
        getToughnessMatterWeight(text, card),
        "Defender or toughness-scaling text supports a toughness-matters shell.",
      );
    }

    if (hasSmallDamageText(text)) {
      addStrategyHit(
        hits,
        "pingers",
        getSmallDamageWeight(text),
        "Repeatable or exact 1-damage text supports a pinger shell.",
      );
    }

    if (hasSpellslingerText(text, card.keywords)) {
      addStrategyHit(
        hits,
        "spellslinger",
        0.98,
        "Spell-copy or cast-matters wording supports spellslinger.",
      );
    }

    if (hasArtifactMattersText(text, card.keywords)) {
      addStrategyHit(hits, "artifacts", 0.98, "Artifact-matters wording supports an artifact shell.");
    }

    if (hasEnchantmentMattersText(text, card.keywords)) {
      addStrategyHit(
        hits,
        "enchantress",
        1,
        "Enchantment-matters wording supports an enchantress shell.",
      );
    }

    if (hasReanimatorText(text, card.keywords)) {
      addStrategyHit(
        hits,
        "reanimator",
        1,
        "Graveyard recursion or self-mill points toward Reanimator.",
      );
    }

    if (hasLandMattersText(text, card.keywords)) {
      addStrategyHit(
        hits,
        "lands_matter",
        1,
        "Landfall or extra-land text supports a Lands Matter shell.",
      );
    }

    if (hasCounterText(text, card.keywords)) {
      addStrategyHit(
        hits,
        "counters",
        0.96,
        "Counter manipulation or counter payoff text supports a counters shell.",
      );
    }

    if (hasSuperfriendsText(text)) {
      addStrategyHit(
        hits,
        "superfriends",
        1.04,
        "Planeswalker or loyalty support text points toward Superfriends.",
      );
    }

    if (hasVoltronText(text) && !hasTheftText(text)) {
      addStrategyHit(hits, "voltron", 0.94, "Single-creature buff text points toward Voltron.");
    }

    if (hasExtraCombatText(text)) {
      addStrategyHit(
        hits,
        "extra_combat",
        1.16,
        "Additional combat wording is a direct extra-combat signal.",
      );
      addStrategyHit(hits, "aggro", 0.28, "Extra combat effects also reinforce an aggressive shell.");
    }

    if (hasExtraUpkeepText(text)) {
      addStrategyHit(
        hits,
        "extra_upkeep",
        getExtraUpkeepStrategyWeight(text),
        "Extra-upkeep, upkeep-trigger, or cumulative-upkeep text supports an extra-upkeep shell.",
      );
    }

    if (hasTapUntapText(text)) {
      addStrategyHit(
        hits,
        "tap_untap",
        getTapUntapStrategyWeight(text),
        "Tap, untap, stun, or tapped-creature payoff text supports a tap/untap shell.",
      );
      addStrategyHit(hits, "control", 0.22, "Tap effects can also function as control support.");
    }

    if (hasDiceRollText(text)) {
      addStrategyHit(hits, "dice_rolls", 1.18, "Dice-roll text supports a dice-based shell.");
    }

    if (hasCoinFlipText(text)) {
      addStrategyHit(hits, "coin_flip", 1.14, "Coin-flip text supports a coin-flip shell.");
    }

    if (hasKindredPayoffText(text, context.dominantCreatureType)) {
      addStrategyHit(hits, "kindred", 1.04, "Creature-type payoff text supports a kindred shell.");
    }

    if (hasStaxText(text)) {
      addStrategyHit(hits, "stax", 1.08, "Taxing or lock text points toward a Stax shell.");
      addStrategyHit(hits, "control", 0.34, "Tax effects also support a controlling plan.");
    }

    if (hasControlText(text)) {
      addStrategyHit(hits, "control", 0.88, "Countermagic, sweepers, or stack denial support control.");
    }

    if (hasGroupHugText(text)) {
      addStrategyHit(
        hits,
        "group_hug",
        1.02,
        "Shared cards, mana, lands, or table resources point toward Group Hug.",
      );
    }

    if (hasGroupSlugText(text)) {
      addStrategyHit(
        hits,
        "group_slug",
        1.02,
        "Broad life-loss or damage text supports a group-slug plan.",
      );
    }

    if (hasLifegainText(text, card.keywords)) {
      addStrategyHit(
        hits,
        "lifegain",
        0.96,
        "Life gain and drain patterns support a lifegain shell.",
      );
    }

    if (hasMillText(text, card.keywords)) {
      addStrategyHit(hits, "mill", 1.02, "Mill text points directly toward a mill plan.");
    }

    if (hasAggroText(text, card.keywords)) {
      addStrategyHit(
        hits,
        "aggro",
        0.86,
        "Attack-step pressure and evasion point toward Aggro.",
      );
    }
  }

  return [...hits.entries()].map(([key, value]) => ({
    key,
    weight: roundTo(value.weight, 2),
    reason: [...value.reasons].join(" "),
  }));
}

function applyDensityAdjustments(
  totals: Record<StrategyKey, number>,
  context: StrategyContext,
  reasons: Map<StrategyKey, Map<string, number>>,
) {
  if (context.artifactCount >= 16) {
    addStrategyBonus(
      totals,
      reasons,
      "artifacts",
      context.artifactCount >= 24 ? 2.3 : 1.45,
      `${context.artifactCount} artifact cards make artifacts a real deck pillar.`,
    );
  }

  if (context.enchantmentCount >= 10) {
    addStrategyBonus(
      totals,
      reasons,
      "enchantress",
      context.enchantmentCount >= 16 ? 2 : 1.2,
      `${context.enchantmentCount} enchantments give the deck real enchantment density.`,
    );
  }

  if (context.planeswalkerCount >= 4) {
    addStrategyBonus(
      totals,
      reasons,
      "superfriends",
      context.planeswalkerCount >= 7 ? 2.4 : 1.35,
      `${context.planeswalkerCount} planeswalkers give the deck real Superfriends density.`,
    );
  }

  if (context.instantSorceryCount >= 16) {
    addStrategyBonus(
      totals,
      reasons,
      "spellslinger",
      context.instantSorceryCount >= 24 ? 2.2 : 1.35,
      `${context.instantSorceryCount} instants and sorceries support a spellslinger shell.`,
    );
  }

  if (context.equipmentAuraCount >= 7) {
    addStrategyBonus(
      totals,
      reasons,
      "voltron",
      context.equipmentAuraCount >= 12 ? 1.8 : 0.95,
      `${context.equipmentAuraCount} Auras and Equipment support a Voltron plan.`,
    );
  }

  if (context.extraCombatCount >= 3) {
    addStrategyBonus(
      totals,
      reasons,
      "extra_combat",
      context.extraCombatCount >= 6 ? 2.8 : 1.6,
      `${context.extraCombatCount} extra-combat cards make that lane a real archetype, not just combat support.`,
    );
  }

  if (
    context.creatureCount >= 24 &&
    context.averageNonlandManaValue <= 3.45 &&
    (totals.aggro >= 2.4 || context.aggroSignalCount >= 8)
  ) {
    addStrategyBonus(
      totals,
      reasons,
      "aggro",
      1.15,
      "High creature density and a low curve support an aggressive shell.",
    );
  }

  if (context.counterspellCount + context.sweeperCount >= 7 && totals.control >= 2.2) {
    addStrategyBonus(
      totals,
      reasons,
      "control",
      context.counterspellCount >= 5 ? 1.45 : 0.95,
      `${context.counterspellCount + context.sweeperCount} control pieces give the deck a real controlling backbone.`,
    );
  }

  if (context.staxCount >= 4) {
    addStrategyBonus(
      totals,
      reasons,
      "stax",
      context.staxCount >= 7 ? 1.65 : 1,
      `${context.staxCount} tax or lock pieces make Stax a real deck lane.`,
    );
  }

  if (context.groupHugCount >= 5) {
    addStrategyBonus(
      totals,
      reasons,
      "group_hug",
      context.groupHugCount >= 8 ? 1.6 : 0.95,
      `${context.groupHugCount} shared-resource effects give the deck real Group Hug density.`,
    );
  }

  if (context.selfMillCount >= 6) {
    addStrategyBonus(
      totals,
      reasons,
      "reanimator",
      context.selfMillCount >= 10 ? 1.25 : 0.7,
      `${context.selfMillCount} self-mill cards feed the graveyard plan directly.`,
    );
  }

  if (context.kindredEnabled && context.dominantCreatureType) {
    addStrategyBonus(
      totals,
      reasons,
      "kindred",
      context.dominantCreatureCount >= 14 ? 2.1 : 1.35,
      `${context.dominantCreatureCount} ${formatCreatureType(context.dominantCreatureType)} cards give the deck real kindred density.`,
    );
  }

  if (context.groupSlugCount >= 5) {
    addStrategyBonus(
      totals,
      reasons,
      "group_slug",
      0.9,
      `${context.groupSlugCount} broad damage or life-loss effects support a group-slug shell.`,
    );
  }

  if (context.lifegainCount >= 6) {
    addStrategyBonus(
      totals,
      reasons,
      "lifegain",
      0.95,
      `${context.lifegainCount} lifegain or drain cards give the deck real lifegain density.`,
    );
  }

  if (context.diceRollCount >= 4) {
    addStrategyBonus(
      totals,
      reasons,
      "dice_rolls",
      context.diceRollCount >= 7 ? 1.85 : 1.05,
      `${context.diceRollCount} dice-roll cards give the deck a real dice package.`,
    );
  }

  if (context.coinFlipCount >= 4) {
    addStrategyBonus(
      totals,
      reasons,
      "coin_flip",
      context.coinFlipCount >= 7 ? 1.75 : 1,
      `${context.coinFlipCount} coin-flip cards give the deck a real coin package.`,
    );
  }

  if (context.faceDownCount >= 5) {
    addStrategyBonus(
      totals,
      reasons,
      "face_down",
      context.faceDownCount >= 14 ? 3 : context.faceDownCount >= 9 ? 1.8 : 0.95,
      `${context.faceDownCount} face-down cards give the deck a real morph, manifest, cloak, or disguise package.`,
    );
  }

  if (context.millCount >= 6) {
    addStrategyBonus(
      totals,
      reasons,
      "mill",
      context.millCount >= 10 ? 1.5 : 0.95,
      `${context.millCount} mill cards give the deck a real mill plan.`,
    );
  }

  if (context.xSpellCount >= 4) {
    addStrategyBonus(
      totals,
      reasons,
      "x_spells",
      context.xSpellCount >= 8 ? 2.1 : context.xSpellCount >= 6 ? 1.35 : 0.75,
      `${context.xSpellCount} X-spells give the deck a real scalable-spell package.`,
    );
  }
}

function applySynergyAdjustments(
  totals: Record<StrategyKey, number>,
  context: StrategyContext,
  reasons: Map<StrategyKey, Map<string, number>>,
  winConditions: DeckWinConditionAnalysis,
) {
  if (totals.tokens >= 3.6 && totals.aristocrats >= 3.3) {
    addStrategyBonus(
      totals,
      reasons,
      "aristocrats",
      1,
      "Token production plus sacrifice payoffs points strongly toward Aristocrats.",
    );
    addStrategyBonus(
      totals,
      reasons,
      "tokens",
      1.8,
      "Sacrifice payoffs plus token makers usually create a real go-wide token subtheme.",
    );
  }

  if (totals.treasure >= 3.4) {
    addStrategyBonus(
      totals,
      reasons,
      "artifacts",
      0.55,
      "Heavy Treasure support usually reinforces the artifact plan too.",
    );
  }

  if (context.etbPayoffCount >= 8 && totals.blink >= 2.8) {
    addStrategyBonus(
      totals,
      reasons,
      "blink",
      0.85,
      "High ETB density deepens the blink plan.",
    );
  }

  if (
    context.planeswalkerCount >= 4 &&
    (context.superfriendsSupportCount >= 4 || context.proliferateCount >= 3)
  ) {
    addStrategyBonus(
      totals,
      reasons,
      "superfriends",
      context.proliferateCount >= 4 ? 1.15 : 0.75,
      "Planeswalker density plus loyalty support deepens the Superfriends plan.",
    );
  }

  if (totals.reanimator >= 3.2 && totals.mill >= 2.2) {
    addStrategyBonus(
      totals,
      reasons,
      "reanimator",
      0.75,
      "Self-mill plus recursion is a classic Reanimator pairing.",
    );
  }

  if (context.extraCombatCount >= 2 && (totals.aggro >= 2.4 || winConditions.counts.combat >= 2)) {
    addStrategyBonus(
      totals,
      reasons,
      "extra_combat",
      2.2,
      "Aggressive pressure plus extra combats points toward an extra-combat shell.",
    );
  }

  if (winConditions.counts.combat >= 2 && totals.aggro >= 2.4) {
    addStrategyBonus(
      totals,
      reasons,
      "aggro",
      0.6,
      "Combat-oriented closers reinforce the Aggro plan.",
    );
  }

  if (winConditions.counts.direct >= 2 && totals.group_slug >= 2.4) {
    addStrategyBonus(
      totals,
      reasons,
      "group_slug",
      0.65,
      "Direct-finisher density reinforces a group-slug finish.",
    );
  }

  if (totals.group_slug >= 3 && totals.lifegain >= 2.5) {
    addStrategyBonus(
      totals,
      reasons,
      "lifegain",
      0.45,
      "Drain effects often overlap with lifegain shells.",
    );
  }

  if (totals.group_hug >= 3.2 && (totals.lands_matter >= 2.2 || totals.control >= 2)) {
    addStrategyBonus(
      totals,
      reasons,
      "group_hug",
      0.55,
      "Shared-resource engines plus payoff infrastructure make Group Hug more coherent.",
    );
  }

  if (totals.x_spells >= 2.4 && (context.manaEngineCount >= 6 || totals.lands_matter >= 2.2 || totals.treasure >= 2.4)) {
    addStrategyBonus(
      totals,
      reasons,
      "x_spells",
      context.manaEngineCount >= 9 ? 1.35 : 0.85,
      "Scalable X-spells line up with the deck's mana engines, so those payoffs become more realistic.",
    );
  }

  if (context.xSpellPayoffCount >= 2 && totals.x_spells >= 2.2) {
    addStrategyBonus(
      totals,
      reasons,
      "x_spells",
      0.7,
      `${context.xSpellPayoffCount} payoff cards care about large mana investment or big spells.`,
    );
  }
}

function applyComboAdjustments(
  totals: Record<StrategyKey, number>,
  keyCards: Map<StrategyKey, Map<string, number>>,
  reasons: Map<StrategyKey, Map<string, number>>,
  supportBuckets: Map<StrategyKey, Map<string, StrategySupportCard>>,
  context: StrategyContext,
  winConditions: DeckWinConditionAnalysis,
) {
  if (winConditions.combos.lookupStatus !== "ok") {
    return;
  }

  const deckCardsByName = new Map(
    context.deckCards.map((card) => [normalizeText(card.card.name), card]),
  );

  if (winConditions.combos.exactCount > 0) {
    const exactBonus =
      winConditions.combos.finisherCount * 2.2 +
      winConditions.combos.engineCount * 1.55 +
      Math.min(winConditions.combos.nearMissCount * 0.08, 0.8);
    totals.combo += roundTo(exactBonus, 2);
    trackReason(
      reasons,
      "combo",
      `${winConditions.combos.exactCount} exact infinite combo line${winConditions.combos.exactCount === 1 ? "" : "s"} were found.`,
      exactBonus,
    );

    for (const combo of winConditions.combos.exact) {
      for (const cardName of combo.cardNames) {
        trackKeyCard(keyCards, "combo", cardName, combo.comboValue);
        const deckCard = deckCardsByName.get(normalizeText(cardName));
        if (!deckCard) {
          continue;
        }

        const supportWeight =
          combo.lineType === "finisher"
            ? combo.commanderInvolved && deckCard.section === "commander"
              ? 1.35
              : 1.18
            : combo.commanderInvolved && deckCard.section === "commander"
              ? 1.15
              : 0.96;

        trackStrategySupportCard(
          supportBuckets,
          "combo",
          deckCard,
          supportWeight,
          combo.lineType === "finisher"
            ? "Shows up in an exact infinite combo finisher line."
            : "Shows up in an exact infinite combo engine line.",
        );
      }
    }
  } else if (winConditions.combos.nearMissCount > 0) {
    const nearMissBonus = Math.min(1.2, winConditions.combos.nearMissCount * 0.18);
    totals.combo += nearMissBonus;
    trackReason(
      reasons,
      "combo",
      `${winConditions.combos.nearMissCount} near-miss combo line${winConditions.combos.nearMissCount === 1 ? "" : "s"} suggest combo support is present.`,
      nearMissBonus,
    );
  }
}

function buildStrategyEntry(
  key: StrategyKey,
  rawScore: number,
  totals: Record<StrategyKey, number>,
  keyCards: Map<StrategyKey, Map<string, number>>,
  reasons: Map<StrategyKey, Map<string, number>>,
  context: StrategyContext,
): DeckStrategyEntry {
  const score = normalizeStrategyScore(key, rawScore, totals);

  return {
    key,
    label: resolveStrategyLabel(key, context),
    score,
    rawScore: roundTo(rawScore, 2),
    confidence: 0.5,
    keyCards: getTopLabels(keyCards.get(key), 5),
    reasons: getTopLabels(reasons.get(key), 3),
  };
}

function buildStrategySynergy(
  mainStrategy: DeckStrategyEntry | null,
  subStrategies: DeckStrategyEntry[],
  supportBuckets: Map<StrategyKey, Map<string, StrategySupportCard>>,
  context: StrategyContext,
  winConditions: DeckWinConditionAnalysis,
  normalizedSecretCommanderName: string,
): DeckStrategySynergy | null {
  if (!mainStrategy) {
    return null;
  }

  const recommendation = STRATEGY_SUPPORT_TARGETS[mainStrategy.key];
  const supportCards = [...(supportBuckets.get(mainStrategy.key)?.values() ?? [])];
  const supportCount = supportCards.reduce((sum, card) => sum + card.quantity, 0);
  const coreCount = supportCards.reduce(
    (sum, card) => sum + (card.weight >= 0.9 ? card.quantity : 0),
    0,
  );
  const focusRatio = clamp(
    mainStrategy.rawScore /
      Math.max(
        mainStrategy.rawScore +
          subStrategies.slice(0, 2).reduce((sum, entry) => sum + entry.rawScore, 0),
        0.01,
      ),
    0,
    1,
  );
  const commanderAligned = supportCards.some(
    (card) => card.section === "commander" && card.weight >= 0.6,
  );
  const commanderProfile = getStrategyCommanderProfile(context, mainStrategy.key);
  const secretCommanderAligned = normalizedSecretCommanderName
    ? supportCards.some(
        (card) =>
          card.section === "mainboard" &&
          normalizeText(card.name) === normalizedSecretCommanderName &&
          card.weight >= 0.55,
      )
    : false;
  const finisherAligned = isStrategyAlignedToFinishers(mainStrategy.key, winConditions);
  const effectiveSupportCount = commanderProfile
    ? Math.max(supportCount, commanderProfile.supportCount)
    : supportCount;
  const effectiveCoreCount = commanderProfile
    ? Math.max(coreCount, commanderProfile.coreCount)
    : coreCount;
  const effectiveRecommendation = commanderProfile
    ? {
        support: Math.max(recommendation.support, commanderProfile.supportTarget),
        core: Math.max(
          recommendation.core,
          Math.ceil(Math.max(1, commanderProfile.supportTarget) * 0.45),
        ),
      }
    : recommendation;
  const profileSupportRatio = commanderProfile
    ? commanderProfile.supportCount / Math.max(commanderProfile.supportTarget, 1)
    : 1;
  const profileCoreRatio = commanderProfile
    ? commanderProfile.coreCount / Math.max(Math.ceil(commanderProfile.supportTarget * 0.45), 1)
    : 1;
  const supportRatio = effectiveSupportCount / Math.max(effectiveRecommendation.support, 1);
  const coreRatio = effectiveCoreCount / Math.max(effectiveRecommendation.core, 1);
  const profileAligned = !!commanderProfile && commanderProfile.confidence >= 45;
  let synergyScore =
    18 +
    clamp(supportRatio, 0, 1.35) * 34 +
    clamp(coreRatio, 0, 1.35) * 22 +
    focusRatio * 14 +
    (commanderAligned || secretCommanderAligned || profileAligned ? 7 : 0) +
    (finisherAligned ? 5 : 0);

  if (effectiveSupportCount < effectiveRecommendation.support * 0.6) {
    synergyScore -= 12;
  }

  if (effectiveCoreCount < effectiveRecommendation.core * 0.5) {
    synergyScore -= 10;
  }

  if (commanderProfile) {
    const profilePenalty =
      Math.max(0, 0.7 - profileSupportRatio) * 18 +
      Math.max(0, 0.5 - profileCoreRatio) * 12;
    synergyScore -= profilePenalty;
    if (profileSupportRatio >= 1 && profileCoreRatio >= 0.85) {
      synergyScore += 5;
    }
  }

  if (focusRatio < 0.5) {
    synergyScore -= 8;
  }

  synergyScore = clamp(Math.round(synergyScore), 0, 100);

  const findings = buildStrategySynergyFindings({
    mainStrategy,
    supportCount: effectiveSupportCount,
    coreCount: effectiveCoreCount,
    focusRatio,
    commanderAligned: commanderAligned || secretCommanderAligned || profileAligned,
    finisherAligned,
    recommendation: effectiveRecommendation,
    commanderProfile,
  });

  return {
    synergyScore,
    summary: summarizeStrategySynergy(synergyScore, mainStrategy.label),
    supportCards: effectiveSupportCount,
    coreCards: effectiveCoreCount,
    focusScore: Math.round(focusRatio * 100),
    commanderAligned: commanderAligned || secretCommanderAligned || profileAligned,
    finisherAligned,
    recommendations: {
      supportTarget: effectiveRecommendation.support,
      coreTarget: effectiveRecommendation.core,
    },
    findings,
  };
}

function buildStrategyPerspective(
  baseEntry: DeckStrategyEntry,
  rankedStrategies: DeckStrategyEntry[],
  supportBuckets: Map<StrategyKey, Map<string, StrategySupportCard>>,
  context: StrategyContext,
  winConditions: DeckWinConditionAnalysis,
  normalizedSecretCommanderName: string,
): DeckStrategyPerspective | null {
  if (baseEntry.score < 14) {
    return null;
  }

  const comparison = rankedStrategies.find((entry) => entry.key !== baseEntry.key) ?? null;
  const strategy = {
    ...baseEntry,
    confidence: computeConfidence(baseEntry, comparison),
  };
  const subStrategies = selectPerspectiveSubStrategies(strategy, rankedStrategies);
  const synergy = buildStrategySynergy(
    strategy,
    subStrategies,
    supportBuckets,
    context,
    winConditions,
    normalizedSecretCommanderName,
  );

  if (!synergy) {
    return null;
  }

  return {
    strategy,
    subStrategies,
    synergy,
  };
}

function selectPerspectiveSubStrategies(
  mainStrategy: DeckStrategyEntry,
  rankedStrategies: DeckStrategyEntry[],
) {
  const minimumScore = Math.max(16, mainStrategy.score - 28);
  const minimumRaw = Math.max(0.75, roundTo(mainStrategy.rawScore * 0.18, 2));

  const selected = rankedStrategies
    .filter((entry) => entry.key !== mainStrategy.key)
    .filter(
      (entry) => entry.score >= minimumScore && entry.rawScore >= minimumRaw,
    )
    .map((entry) => ({
      ...entry,
      confidence: computeConfidence(entry, mainStrategy),
    }))
    .slice(0, 3);

  if (mainStrategy.key === "aristocrats") {
    includeRelatedPerspectiveStrategy(selected, rankedStrategies, mainStrategy, "tokens");
  }

  if (mainStrategy.key === "tokens") {
    includeRelatedPerspectiveStrategy(selected, rankedStrategies, mainStrategy, "aristocrats");
  }

  if (mainStrategy.key === "face_down") {
    includeRelatedPerspectiveStrategy(selected, rankedStrategies, mainStrategy, "blink");
    includeRelatedPerspectiveStrategy(selected, rankedStrategies, mainStrategy, "counters");
  }

  if (mainStrategy.key === "superfriends") {
    includeRelatedPerspectiveStrategy(selected, rankedStrategies, mainStrategy, "counters");
  }

  if (mainStrategy.key === "counters") {
    includeRelatedPerspectiveStrategy(selected, rankedStrategies, mainStrategy, "superfriends");
  }

  return selected
    .sort((left, right) => right.score - left.score || right.rawScore - left.rawScore)
    .slice(0, 3);
}

function includeRelatedPerspectiveStrategy(
  selected: DeckStrategyEntry[],
  rankedStrategies: DeckStrategyEntry[],
  mainStrategy: DeckStrategyEntry,
  relatedKey: StrategyKey,
) {
  if (selected.some((entry) => entry.key === relatedKey)) {
    return;
  }

  const relatedEntry = rankedStrategies.find((entry) => entry.key === relatedKey);
  if (!relatedEntry || relatedEntry.score < 14 || relatedEntry.rawScore < 0.9) {
    return;
  }

  if (selected.length >= 3) {
    selected.pop();
  }

  selected.push({
    ...relatedEntry,
    confidence: computeConfidence(relatedEntry, mainStrategy),
  });
}

function dedupeStrategyEntries(entries: DeckStrategyEntry[]) {
  const seen = new Set<StrategyKey>();
  const unique: DeckStrategyEntry[] = [];

  for (const entry of entries) {
    if (seen.has(entry.key)) {
      continue;
    }

    seen.add(entry.key);
    unique.push(entry);
  }

  return unique;
}

function resolveStrategyLabel(key: StrategyKey, context: StrategyContext) {
  if (key === "kindred" && context.kindredEnabled && context.dominantCreatureType) {
    return `${formatCreatureType(context.dominantCreatureType)} Kindred`;
  }

  if (key === "counters" && context.dominantCounterType) {
    return `Counters (${formatCounterType(context.dominantCounterType)})`;
  }

  return STRATEGY_LABELS[key];
}

function normalizeStrategyScore(
  key: StrategyKey,
  rawScore: number,
  totals: Record<StrategyKey, number>,
) {
  let score = (rawScore / STRATEGY_TARGETS[key]) * 100;

  if (key === "aristocrats" && totals.tokens >= 3 && totals.aristocrats >= 3) {
    score += 6;
  }

  if (key === "combo" && rawScore > 0) {
    score += 8;
  }

  if (key === "extra_combat" && totals.aggro >= 2.5) {
    score += totals.extra_combat >= 4 ? 9 : 4;
  }

  if (key === "kindred" && rawScore > 0) {
    score += 4;
  }

  if (key === "superfriends" && rawScore > 0) {
    score += 4;
  }

  if ((key === "toughness_matter" || key === "pingers") && rawScore > 0) {
    score += 4;
  }

  if (
    [
      "dungeons",
      "madness",
      "ninjutsu",
      "curses",
      "exile_cast",
      "food",
      "clues",
      "energy",
      "sagas",
      "monarch",
      "theft",
      "goad",
      "shrines",
      "cycling",
      "mutate",
      "poison",
      "battles",
      "pillowfort",
      "copy_clone",
      "power_matter",
      "mana_value_matter",
      "x_spells",
      "legends_matter",
    ].includes(key) &&
    rawScore > 0
  ) {
    score += 4;
  }

  return clamp(Math.round(score), 0, 100);
}

function summarizeStrategies(
  mainStrategy: DeckStrategyEntry | null,
  subStrategies: DeckStrategyEntry[],
) {
  if (!mainStrategy) {
    return "No single archetype stands out yet. The shell still reads as mixed value rather than a clear Commander theme.";
  }

  if (subStrategies.length === 0) {
    return `${mainStrategy.label} is the clearest archetype in this deck.`;
  }

  if (subStrategies.length === 1) {
    return `${mainStrategy.label} looks like the main plan, with ${subStrategies[0].label} as the clearest side strategy.`;
  }

  if (subStrategies.length === 2) {
    return `${mainStrategy.label} looks like the main plan, with ${subStrategies[0].label} and ${subStrategies[1].label} as the strongest side strategies.`;
  }

  return `${mainStrategy.label} looks like the main plan, with ${subStrategies[0].label}, ${subStrategies[1].label}, and ${subStrategies[2].label} as the strongest side strategies.`;
}

function summarizeStrategySynergy(score: number, label: string) {
  if (score >= 82) {
    return `${label} is strongly supported across the shell.`;
  }

  if (score >= 68) {
    return `${label} has a solid support base with a few thinner links.`;
  }

  if (score >= 48) {
    return `${label} shows up, but the support package is still uneven.`;
  }

  return `${label} is more of a light theme than a fully built plan right now.`;
}

function computeConfidence(entry: DeckStrategyEntry, comparison: DeckStrategyEntry | null) {
  const lead = comparison ? entry.score - comparison.score : entry.score;
  return roundTo(clamp(0.38 + entry.score / 150 + lead / 120, 0.25, 0.95), 2);
}

function getStrategySegments(card: ScryfallCard) {
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

function addStrategyHit(
  hits: Map<StrategyKey, { weight: number; reasons: Set<string> }>,
  key: StrategyKey,
  weight: number,
  reason: string,
) {
  const existing = hits.get(key);

  if (!existing) {
    hits.set(key, {
      weight,
      reasons: new Set([reason]),
    });
    return;
  }

  existing.weight = Math.min(existing.weight + weight, 1.9);
  existing.reasons.add(reason);
}

function hasTokenText(text: string) {
  return (
    /\bcreate\b[^.]{0,180}\bcreature tokens?\b/.test(text) ||
    /\bcreate\b[^.]{0,180}\btokens?\b/.test(text) ||
    /\btokens? would be created\b[^.]{0,220}\b(?:twice that many|that many plus|additional)\b/.test(text) ||
    /\bcreate\b[^.]{0,140}\b(?:twice that many|that many plus|additional)\b[^.]{0,100}\btokens?\b/.test(text) ||
    /\btoken copy\b/.test(text) ||
    /\bpopulate\b/.test(text) ||
    /\bcreature tokens? you control\b/.test(text) ||
    /\bfor each token\b/.test(text) ||
    /\btokens? you control\b[^.]{0,80}\bget\b/.test(text)
  );
}

function hasTreasureText(text: string) {
  return /\btreasure token\b/.test(text) || /\bcreate\b[^.]{0,120}\btreasure\b/.test(text);
}

function hasAristocratsText(text: string) {
  return (
    /\bsacrifice(?: another)? (?:artifact|creature|permanent)\b/.test(text) ||
    /\bwhenever\b[^.]{0,140}\bdies\b/.test(text) ||
    /\bwhenever you sacrifice\b/.test(text) ||
    /\bdies\b[^.]{0,120}\beach opponent\b/.test(text) ||
    /\bcreature dying causes a triggered ability\b[^.]{0,180}\btriggers? an additional time\b/.test(text) ||
    /\bcreature dying\b[^.]{0,160}\btriggered ability\b[^.]{0,160}\badditional time\b/.test(text)
  );
}

function hasBlinkText(text: string) {
  return (
    /\bexile\b[^.]{0,180}\breturn\b[^.]{0,180}\b(?:to the battlefield|under its owner's control|under your control)\b/.test(
      text,
    ) ||
    /\bphases out\b/.test(text)
  );
}

function hasFaceDownText(text: string, keywords: string[] = []) {
  return (
    /\bface-down\b|\bface down\b|\bface-up\b|\bface up\b|\bturned face up\b|\bturn [^.]{0,80} face up\b/.test(
      text,
    ) ||
    /\b(?:morph|megamorph|manifest|manifest dread|cloak|disguise)\b/.test(text) ||
    keywords.some((keyword) =>
      ["Morph", "Megamorph", "Manifest", "Manifest Dread", "Cloak", "Disguise"].includes(
        keyword,
      ),
    )
  );
}

function getFaceDownStrategyWeight(text: string, keywords: string[] = []) {
  let weight = 0.92;

  if (/\bwhenever\b[^.]{0,160}\bface-down\b|\bwhenever\b[^.]{0,160}\bturned face up\b/.test(text)) {
    weight += 0.26;
  }

  if (/\bcosts?\b[^.]{0,80}\bless to cast\b[^.]{0,120}\bface-down\b|\bface-down\b[^.]{0,120}\bcosts?\b[^.]{0,80}\bless to cast\b/.test(text)) {
    weight += 0.22;
  }

  if (/\bmanifest\b|\bcloak\b/.test(text)) {
    weight += 0.1;
  }

  if (keywords.some((keyword) => ["Morph", "Megamorph", "Disguise"].includes(keyword))) {
    weight += 0.08;
  }

  return Math.min(1.35, weight);
}

function hasDungeonText(text: string, keywords: string[] = []) {
  return (
    /\bventure into the dungeon\b/.test(text) ||
    /\bcompleted? a dungeon\b/.test(text) ||
    /\bdungeon card\b/.test(text) ||
    /\btake the initiative\b/.test(text) ||
    /\bwhenever\b[^.]{0,140}\b(?:venture|complete a dungeon|completed a dungeon)\b/.test(text) ||
    keywords.some((keyword) => ["Venture into the dungeon", "Take the initiative"].includes(keyword))
  );
}

function getDungeonStrategyWeight(text: string, keywords: string[] = []) {
  let weight = 0.9;

  if (/\bwhenever\b[^.]{0,140}\b(?:venture|completed? a dungeon)\b/.test(text)) {
    weight += 0.24;
  }

  if (/\bcompleted? a dungeon\b/.test(text)) {
    weight += 0.2;
  }

  if (keywords.some((keyword) => ["Venture into the dungeon", "Take the initiative"].includes(keyword))) {
    weight += 0.1;
  }

  return Math.min(1.32, weight);
}

function hasMadnessText(text: string, keywords: string[] = []) {
  return (
    /\bmadness\b/.test(text) ||
    /\bwhenever you discard\b/.test(text) ||
    /\bdiscard a card\b[^.]{0,100}\b(?:draw|create|deals?|return|cast|add)\b/.test(text) ||
    /\bdiscard your hand\b/.test(text) ||
    keywords.includes("Madness")
  );
}

function getMadnessStrategyWeight(text: string, keywords: string[] = []) {
  let weight = 0.78;

  if (/\bmadness\b/.test(text) || keywords.includes("Madness")) {
    weight += 0.32;
  }

  if (/\bwhenever you discard\b/.test(text)) {
    weight += 0.28;
  }

  return Math.min(1.32, weight);
}

function hasNinjutsuText(text: string, keywords: string[] = [], card?: ScryfallCard) {
  return (
    /\bninjutsu\b/.test(text) ||
    /\bcommander ninjutsu\b/.test(text) ||
    /\bunblocked attacking creature\b/.test(text) ||
    /\bcreatures? you control can't be blocked\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bdeals combat damage to a player\b/.test(text) && cardHasCreatureType(card, "ninja") ||
    cardHasCreatureType(card, "ninja") ||
    keywords.includes("Ninjutsu") ||
    keywords.includes("Commander ninjutsu")
  );
}

function getNinjutsuStrategyWeight(text: string, keywords: string[] = [], card?: ScryfallCard) {
  let weight = 0.72;

  if (/\bninjutsu\b|\bcommander ninjutsu\b/.test(text) || keywords.includes("Ninjutsu")) {
    weight += 0.36;
  }

  if (cardHasCreatureType(card, "ninja")) {
    weight += 0.16;
  }

  if (/\bunblocked attacking creature\b|\bcan't be blocked\b/.test(text)) {
    weight += 0.16;
  }

  return Math.min(1.32, weight);
}

function hasCurseText(text: string, card?: ScryfallCard) {
  return (
    cardHasSubtype(card, "Curse") ||
    /\bcurse spells? you cast\b/.test(text) ||
    /\bcurses? you control\b/.test(text) ||
    /\battached to (?:a|an|that) player\b/.test(text) ||
    /\benchanted player\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bcurse\b/.test(text)
  );
}

function getCurseStrategyWeight(text: string, card?: ScryfallCard) {
  let weight = 0.82;

  if (cardHasSubtype(card, "Curse")) {
    weight += 0.28;
  }

  if (/\bcurses? you control\b|\bcurse spells? you cast\b|\bwhenever\b[^.]{0,120}\bcurse\b/.test(text)) {
    weight += 0.28;
  }

  return Math.min(1.34, weight);
}

function hasExileCastText(text: string, keywords: string[] = []) {
  return (
    /\bcast\b[^.]{0,140}\bfrom exile\b/.test(text) ||
    /\bplay\b[^.]{0,140}\bfrom exile\b/.test(text) ||
    /\bplay(?:ed)? (?:a|one or more)? ?cards? from exile\b/.test(text) ||
    /\bwhenever you (?:cast|play)\b[^.]{0,120}\bfrom exile\b/.test(text) ||
    /\bexile the top\b[^.]{0,140}\b(?:you may play|you may cast|until|this turn)\b/.test(text) ||
    /\bimpulse draw\b/.test(text) ||
    keywords.some((keyword) => ["Cascade", "Discover", "Plot", "Foretell", "Adventure"].includes(keyword))
  );
}

function getExileCastStrategyWeight(text: string) {
  let weight = 0.84;

  if (/\bwhenever you (?:cast|play)\b[^.]{0,120}\bfrom exile\b/.test(text)) {
    weight += 0.34;
  }

  if (/\bexile the top\b[^.]{0,140}\b(?:you may play|you may cast|until|this turn)\b/.test(text)) {
    weight += 0.18;
  }

  return Math.min(1.36, weight);
}

function hasFoodText(text: string) {
  return (
    /\bfood tokens?\b/.test(text) ||
    /\bcreate\b[^.]{0,120}\bfood\b/.test(text) ||
    /\bfoods? you control\b/.test(text) ||
    /\bsacrifice\b[^.]{0,80}\bfood\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bfood\b/.test(text)
  );
}

function getFoodStrategyWeight(text: string) {
  let weight = 0.82;

  if (/\bcreate\b[^.]{0,120}\bfood\b/.test(text)) {
    weight += 0.2;
  }

  if (/\bfoods? you control\b|\bwhenever\b[^.]{0,120}\bfood\b|\bsacrifice\b[^.]{0,80}\bfood\b/.test(text)) {
    weight += 0.26;
  }

  return Math.min(1.34, weight);
}

function hasClueText(text: string, keywords: string[] = []) {
  return (
    /\binvestigate\b/.test(text) ||
    /\bclue tokens?\b/.test(text) ||
    /\bcreate\b[^.]{0,120}\bclue\b/.test(text) ||
    /\bclues? you control\b/.test(text) ||
    /\bsacrifice\b[^.]{0,80}\bclue\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bclue\b/.test(text) ||
    keywords.includes("Investigate")
  );
}

function getClueStrategyWeight(text: string, keywords: string[] = []) {
  let weight = 0.82;

  if (/\binvestigate\b/.test(text) || keywords.includes("Investigate")) {
    weight += 0.22;
  }

  if (/\bclues? you control\b|\bwhenever\b[^.]{0,120}\bclue\b|\bsacrifice\b[^.]{0,80}\bclue\b/.test(text)) {
    weight += 0.24;
  }

  return Math.min(1.34, weight);
}

function hasEnergyText(text: string) {
  return (
    /\benergy counters?\b/.test(text) ||
    /\bpay (?:one|two|three|four|five|six|\d+|\{e\})\b[^.]{0,80}\benergy\b/.test(text) ||
    /\bget (?:one|two|three|four|five|six|\d+|\{e\})\b[^.]{0,80}\benergy\b/.test(text) ||
    /\{e\}/.test(text)
  );
}

function getEnergyStrategyWeight(text: string) {
  let weight = 0.82;

  if (/\benergy counters?\b/.test(text) || /\{e\}/.test(text)) {
    weight += 0.18;
  }

  if (/\bpay\b[^.]{0,80}\benergy\b|\bwhenever\b[^.]{0,120}\benergy\b/.test(text)) {
    weight += 0.26;
  }

  return Math.min(1.34, weight);
}

function hasSagaText(text: string, card?: ScryfallCard) {
  return (
    cardHasSubtype(card, "Saga") ||
    /\bsaga spells? you cast\b/.test(text) ||
    /\bsagas? you control\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bsagas?\b/.test(text) ||
    /\blore counters?\b/.test(text) ||
    /\bchapter abilities?\b/.test(text) ||
    /\bfinal chapter ability\b/.test(text)
  );
}

function getSagaStrategyWeight(text: string, card?: ScryfallCard) {
  let weight = 0.82;

  if (cardHasSubtype(card, "Saga")) {
    weight += 0.28;
  }

  if (/\bsagas? you control\b|\bchapter abilities?\b|\blore counters?\b/.test(text)) {
    weight += 0.26;
  }

  return Math.min(1.34, weight);
}

function hasMonarchText(text: string) {
  return /\bmonarch\b|\bbecome the monarch\b|\bthe monarch\b/.test(text);
}

function getMonarchStrategyWeight(text: string) {
  let weight = 0.84;

  if (/\byou become the monarch\b|\bbecome the monarch\b/.test(text)) {
    weight += 0.24;
  }

  if (/\bif you're the monarch\b|\bthe monarch\b[^.]{0,120}\b(?:draw|loses|damage|create)\b/.test(text)) {
    weight += 0.22;
  }

  return Math.min(1.32, weight);
}

function hasTheftText(text: string) {
  return (
    /\bgain control of target\b/.test(text) ||
    /\bgain control of (?:that|it|enchanted|target) (?:creature|permanent|artifact|planeswalker|spell)\b/.test(text) ||
    /\byou control enchanted (?:creature|permanent|artifact|planeswalker)\b/.test(text) ||
    /\bcontrol of target\b[^.]{0,120}\bfor as long as\b/.test(text) ||
    /\btop card of (?:their|that player's|an opponent's) library\b[^.]{0,120}\b(?:play|cast)\b/.test(text) ||
    /\b(?:play|cast)\b[^.]{0,120}\btop card of (?:their|that player's|an opponent's) library\b/.test(text) ||
    /\byou control but don't own\b/.test(text) ||
    /\bopponents?'? cards?\b[^.]{0,160}\b(?:cast|play|exile|put)\b/.test(text) ||
    /\bfrom (?:an|your) opponents?'? (?:library|graveyard|hand|exile)\b/.test(text)
  );
}

function getTheftStrategyWeight(text: string) {
  let weight = 0.82;

  if (/\bgain control of target\b|\bgain control of (?:that|it|enchanted|target)\b/.test(text)) {
    weight += 0.26;
  }

  if (/\byou control but don't own\b|\bopponents?'? cards?\b/.test(text)) {
    weight += 0.2;
  }

  return Math.min(1.34, weight);
}

function hasGoadText(text: string) {
  return (
    /\bgoad\b/.test(text) ||
    /\bgoaded\b/.test(text) ||
    /\battacks each combat if able\b/.test(text) ||
    /\battacks a player other than you if able\b/.test(text) ||
    /\bcreatures? your opponents control attack\b/.test(text) ||
    /\bcan't attack you\b[^.]{0,120}\battacks\b/.test(text)
  );
}

function getGoadStrategyWeight(text: string) {
  let weight = 0.84;

  if (/\bgoad\b|\bgoaded\b/.test(text)) {
    weight += 0.24;
  }

  if (/\battacks a player other than you if able\b|\bcreatures? your opponents control attack\b/.test(text)) {
    weight += 0.22;
  }

  return Math.min(1.32, weight);
}

function hasShrineText(text: string, card?: ScryfallCard) {
  return (
    cardHasSubtype(card, "Shrine") ||
    /\bshrines? you control\b/.test(text) ||
    /\bfor each shrine\b/.test(text) ||
    /\bshrine enchantment\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bshrine\b/.test(text)
  );
}

function getShrineStrategyWeight(text: string, card?: ScryfallCard) {
  let weight = 0.82;

  if (cardHasSubtype(card, "Shrine")) {
    weight += 0.3;
  }

  if (/\bshrines? you control\b|\bfor each shrine\b|\bwhenever\b[^.]{0,120}\bshrine\b/.test(text)) {
    weight += 0.26;
  }

  return Math.min(1.36, weight);
}

function hasCyclingText(text: string, keywords: string[] = []) {
  return (
    /\bcycling\b/.test(text) ||
    /\bcycle (?:a|another|one or more)? ?cards?\b/.test(text) ||
    /\bwhenever you cycle\b/.test(text) ||
    /\bcycling abilities?\b/.test(text) ||
    keywords.includes("Cycling")
  );
}

function getCyclingStrategyWeight(text: string, keywords: string[] = []) {
  let weight = 0.78;

  if (/\bcycling\b/.test(text) || keywords.includes("Cycling")) {
    weight += 0.26;
  }

  if (/\bwhenever you cycle\b|\bcycling abilities?\b/.test(text)) {
    weight += 0.3;
  }

  return Math.min(1.34, weight);
}

function hasMutateText(text: string, keywords: string[] = []) {
  return (
    /\bmutate\b/.test(text) ||
    /\bmutates?\b/.test(text) ||
    /\bmerged creatures?\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bmutates?\b/.test(text) ||
    keywords.includes("Mutate")
  );
}

function getMutateStrategyWeight(text: string, keywords: string[] = []) {
  let weight = 0.8;

  if (/\bmutate\b/.test(text) || keywords.includes("Mutate")) {
    weight += 0.28;
  }

  if (/\bwhenever\b[^.]{0,120}\bmutates?\b|\bmerged creatures?\b/.test(text)) {
    weight += 0.26;
  }

  return Math.min(1.34, weight);
}

function hasPoisonText(text: string, keywords: string[] = []) {
  return (
    /\bpoison counters?\b/.test(text) ||
    /\bgets? (?:one|two|three|\d+) poison counters?\b/.test(text) ||
    /\bcorrupted\b/.test(text) ||
    /\binfect\b/.test(text) ||
    /\btoxic\b/.test(text) ||
    /\bproliferate\b[^.]{0,120}\bpoison\b/.test(text) ||
    keywords.some((keyword) => ["Infect", "Toxic", "Proliferate"].includes(keyword))
  );
}

function getPoisonStrategyWeight(text: string, keywords: string[] = []) {
  let weight = 0.8;

  if (/\binfect\b|\btoxic\b/.test(text) || keywords.some((keyword) => ["Infect", "Toxic"].includes(keyword))) {
    weight += 0.28;
  }

  if (/\bpoison counters?\b|\bcorrupted\b/.test(text)) {
    weight += 0.24;
  }

  if (/\bproliferate\b/.test(text) || keywords.includes("Proliferate")) {
    weight += 0.12;
  }

  return Math.min(1.36, weight);
}

function hasBattleText(text: string, card?: ScryfallCard) {
  return (
    hasCardType(card, "Battle") ||
    /\bbattle spells? you cast\b/.test(text) ||
    /\bbattles? you control\b/.test(text) ||
    /\bdefense counters?\b/.test(text) ||
    /\bwhenever\b[^.]{0,140}\bbattles?\b/.test(text) ||
    /\bdefeated? a battle\b/.test(text)
  );
}

function getBattleStrategyWeight(text: string, card?: ScryfallCard) {
  let weight = 0.78;

  if (hasCardType(card, "Battle")) {
    weight += 0.32;
  }

  if (/\bbattles? you control\b|\bdefeated? a battle\b|\bdefense counters?\b/.test(text)) {
    weight += 0.28;
  }

  return Math.min(1.34, weight);
}

function hasPillowfortText(text: string) {
  return (
    /\bcreatures? can't attack you\b/.test(text) ||
    /\bcan't attack you or planeswalkers? you control\b/.test(text) ||
    /\bcan't attack unless\b[^.]{0,80}\bpays?\b/.test(text) ||
    /\bmay attack only\b/.test(text) ||
    /\bcan attack only\b/.test(text) ||
    /\bcreatures? can't attack you unless\b/.test(text) ||
    /\bprevent all (?:combat )?damage\b[^.]{0,120}\b(?:dealt to you|that would be dealt to you|dealt by creatures)\b/.test(
      text,
    ) ||
    /\bwhenever\b[^.]{0,120}\battacks you\b[^.]{0,120}\b(?:pay|sacrifice|lose|damage)\b/.test(text) ||
    /\battacking you costs\b/.test(text)
  );
}

function getPillowfortStrategyWeight(text: string) {
  let weight = 0.84;

  if (
    /\bcan't attack unless\b|\bcreatures? can't attack you unless\b|\battacking you costs\b|\bmay attack only\b|\bcan attack only\b/.test(
      text,
    )
  ) {
    weight += 0.26;
  }

  if (/\bprevent all (?:combat )?damage\b/.test(text)) {
    weight += 0.18;
  }

  return Math.min(1.34, weight);
}

function hasCopyCloneText(text: string) {
  return (
    /\bcopy target\b/.test(text) ||
    /\bcopy (?:that|the|a) (?:spell|permanent|creature|artifact|enchantment|instant|sorcery|ability)\b/.test(text) ||
    /\btoken that's? a copy\b/.test(text) ||
    /\bcreate\b[^.]{0,120}\btoken\b[^.]{0,120}\bcopy\b/.test(text) ||
    /\benters the battlefield as a copy\b/.test(text) ||
    /\bbecomes? a copy\b/.test(text) ||
    /\bcopy of (?:another|target|that|a)\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bcopy\b[^.]{0,120}\bspell\b/.test(text)
  );
}

function getCopyCloneStrategyWeight(text: string) {
  let weight = 0.82;

  if (/\bcopy target\b|\bcopy (?:that|the|a) (?:spell|permanent|creature|artifact|enchantment|instant|sorcery|ability)\b/.test(text)) {
    weight += 0.24;
  }

  if (/\btoken that's? a copy\b|\benters the battlefield as a copy\b|\bbecomes? a copy\b/.test(text)) {
    weight += 0.24;
  }

  return Math.min(1.34, weight);
}

function hasPowerMatterText(text: string, card?: ScryfallCard) {
  return (
    /\bpower (?:2|3|4|5|6|7|8|9|10) or (?:less|greater)\b/.test(text) ||
    /\bbase power and toughness\b/.test(text) ||
    /\btotal power\b/.test(text) ||
    /\bgreatest power\b/.test(text) ||
    /\bcreatures? you control with power\b/.test(text) ||
    /\bwhenever\b[^.]{0,160}\bpower\b[^.]{0,120}\b(?:draw|create|deal|deals|gain|put|gets?)\b/.test(text) ||
    (card !== undefined && hasCardType(card, "Creature") && /\bferocious\b/.test(text))
  );
}

function getPowerMatterWeight(text: string, card?: ScryfallCard) {
  if (/\bbase power and toughness\b|\btotal power\b|\bgreatest power\b/.test(text)) {
    return 1.12;
  }

  if (/\bpower (?:2|3) or less\b|\bpower (?:4|5|6|7|8|9|10) or greater\b/.test(text)) {
    return 1.04;
  }

  if (
    card &&
    hasCardType(card, "Creature") &&
    (isCreatureWithMaxPower(card, 2) || isCreatureWithMinPower(card, 4))
  ) {
    return 0.48;
  }

  return 0.84;
}

function hasManaValueMatterText(text: string) {
  return (
    /\bmana value (?:\d+|x)\b/.test(text) ||
    /\bwith mana value\b/.test(text) ||
    /\bgreatest mana value\b/.test(text) ||
    /\bspells? with (?:mana value|value)\b/.test(text) ||
    /\bpermanents? with (?:mana value|value)\b/.test(text)
  );
}

function getManaValueMatterWeight(text: string) {
  if (/\bwhenever\b[^.]{0,160}\bmana value\b|\bgreatest mana value\b/.test(text)) {
    return 1.1;
  }

  if (/\bmana value (?:\d+|x) or (?:less|greater)\b/.test(text)) {
    return 1;
  }

  return 0.82;
}

function hasXSpellText(text: string, card?: ScryfallCard) {
  return hasXInManaCost(card) || hasScalableXEffectText(text);
}

function hasXSpellPayoffText(text: string) {
  return (
    /\bwhere x is\b/.test(text) ||
    /\bif x is (?:\d+|ten|five|six|seven|eight|nine) or (?:more|greater)\b/.test(text) ||
    /\bspent to cast\b[^.]{0,120}\b(?:x|mana)\b/.test(text) ||
    /\bwhenever\b[^.]{0,160}\bcast\b[^.]{0,160}\b(?:mana value|x)\b/.test(text)
  );
}

function getXSpellStrategyWeight(text: string, card?: ScryfallCard) {
  if (hasXInManaCost(card) && (hasXDamageText(text) || hasXLifeLossText(text))) {
    return 1.18;
  }

  if (hasXInManaCost(card) && (hasXDrawText(text) || hasXTutorText(text))) {
    return 1.08;
  }

  if (hasXTokenText(text) || hasXCounterOrPumpText(text)) {
    return 0.96;
  }

  if (hasXInManaCost(card)) {
    return 0.72;
  }

  return 0.58;
}

function hasLegendsMatterText(text: string, card?: ScryfallCard) {
  return (
    /\blegendary spells? you cast\b/.test(text) ||
    /\blegendary (?:creatures?|permanents?|cards?) you control\b/.test(text) ||
    /\bwhenever\b[^.]{0,160}\blegendary\b[^.]{0,120}\b(?:enters?|dies|attacks|cast|draw|create)\b/.test(text) ||
    /\bfor each legendary\b/.test(text) ||
    (card !== undefined &&
      isLegendaryCard(card) &&
      /\bhistoric spells? you cast\b|\bwhenever you cast\b[^.]{0,120}\bhistoric spell\b/.test(text))
  );
}

function getLegendsMatterWeight(text: string, card?: ScryfallCard) {
  if (/\blegendary spells? you cast\b|\bwhenever\b[^.]{0,160}\blegendary\b/.test(text)) {
    return 1.08;
  }

  if (card && isLegendaryCard(card)) {
    return 0.36;
  }

  return 0.86;
}

function hasXInManaCost(card?: ScryfallCard) {
  if (!card) {
    return false;
  }

  const costs = [card.mana_cost, ...(card.card_faces?.map((face) => face.mana_cost) ?? [])];
  return costs.some((cost) => /\{x\}/i.test(cost ?? ""));
}

function hasScalableXEffectText(text: string) {
  return (
    hasXDamageText(text) ||
    hasXLifeLossText(text) ||
    hasXDrawText(text) ||
    hasXTokenText(text) ||
    hasXTutorText(text) ||
    hasXRemovalText(text) ||
    hasXMillText(text) ||
    hasXCounterOrPumpText(text) ||
    /\bwhere x is\b/.test(text)
  );
}

function hasXDamageText(text: string) {
  return /\bdeals? (?:\w+\s+times\s+)?x damage\b|\bdeals? damage equal to x\b/.test(text);
}

function hasXLifeLossText(text: string) {
  return /\b(?:each opponent|target opponent|target player|each player)\b[^.]{0,120}\bloses? x life\b/.test(text);
}

function hasXDrawText(text: string) {
  return /\bdraw x cards?\b|\bdraw cards? equal to x\b|\btarget player draws x cards?\b/.test(text);
}

function hasXTokenText(text: string) {
  return (
    /\bcreate x\b[^.]{0,140}\btokens?\b/.test(text) ||
    /\bcreate\b[^.]{0,140}\bx\b[^.]{0,100}\btokens?\b/.test(text) ||
    /\bcreate\b[^.]{0,120}\btokens?\b[^.]{0,80}\bwhere x is\b/.test(text)
  );
}

function hasXTutorText(text: string) {
  return (
    /\bsearch(?:es)?\b[^.]{0,220}\byour library\b[^.]{0,220}\b(?:mana value|value|cost) x or less\b/.test(text) ||
    /\bsearch(?:es)?\b[^.]{0,220}\byour library\b[^.]{0,220}\bwith mana value x\b/.test(text) ||
    /\breveal\b[^.]{0,160}\btop x cards?\b[^.]{0,220}\bput\b[^.]{0,120}\b(?:into your hand|onto the battlefield)\b/.test(text)
  );
}

function hasXRemovalText(text: string) {
  return (
    /\b(?:destroy|exile)\b[^.]{0,180}\b(?:mana value|value|cost) x or less\b/.test(text) ||
    /\ball creatures get -x\/-x\b/.test(text) ||
    /\btarget creature gets -x\/-x\b/.test(text) ||
    /\breturn\b[^.]{0,160}\bwith mana value x or less\b[^.]{0,120}\bto (?:its|their) owners?'? hands?\b/.test(text)
  );
}

function hasXMillText(text: string) {
  return (
    /\bmills? x cards?\b/.test(text) ||
    /\btarget player mills x cards?\b/.test(text) ||
    /\bput the top x cards? of\b[^.]{0,120}\binto (?:their|his or her|your) graveyard\b/.test(text)
  );
}

function hasXCounterOrPumpText(text: string) {
  return (
    /\b\+x\/\+x\b/.test(text) ||
    /\b-x\/-x\b/.test(text) ||
    /\bx \+\d+\/\+\d+ counters?\b/.test(text) ||
    /\bput x \+\d+\/\+\d+ counters?\b/.test(text) ||
    /\bdistribute x \+\d+\/\+\d+ counters?\b/.test(text) ||
    /\bbase power and toughness x\/x\b/.test(text)
  );
}

function hasToughnessMatterText(text: string, card?: ScryfallCard) {
  return (
    /\bassigns? combat damage equal to (?:its|their) toughness\b/.test(text) ||
    /\btoughness rather than (?:its|their) power\b/.test(text) ||
    /\btotal toughness\b/.test(text) ||
    /\btoughness among creatures\b/.test(text) ||
    /\bcreatures? you control with defender\b/.test(text) ||
    /\bdefender creatures? you control\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bdefender\b/.test(text) ||
    /\bdefender\b/.test(text) && hasHighToughnessCreatureStats(card)
  );
}

function getToughnessMatterWeight(text: string, card?: ScryfallCard) {
  let weight = 0.78;

  if (/\bassigns? combat damage equal to (?:its|their) toughness\b|\btoughness rather than (?:its|their) power\b/.test(text)) {
    weight += 0.42;
  }

  if (/\bwhenever\b[^.]{0,120}\bdefender\b|\bcreatures? you control with defender\b/.test(text)) {
    weight += 0.24;
  }

  if (hasHighToughnessCreatureStats(card)) {
    weight += 0.12;
  }

  return Math.min(1.35, weight);
}

function hasSmallDamageText(text: string) {
  return (
    /\bdeals exactly 1 damage\b/.test(text) ||
    /\bdeals 1 damage to (?:any target|each opponent|each player|target opponent|target player|target creature|target creature or planeswalker|target creature, planeswalker, or player|that player|that permanent)\b/.test(
      text,
    ) ||
    /\bwhenever\b[^.]{0,120}\bdeals 1 damage\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bdeals damage\b[^.]{0,80}\bit deals 1 damage\b/.test(text)
  );
}

function getSmallDamageWeight(text: string) {
  let weight = 0.86;

  if (/\bdeals exactly 1 damage\b/.test(text)) {
    weight += 0.3;
  }

  if (/\bwhenever\b|\b: .*deals 1 damage\b/.test(text)) {
    weight += 0.16;
  }

  if (/\beach opponent\b|\beach player\b/.test(text)) {
    weight += 0.1;
  }

  return Math.min(1.32, weight);
}

function hasEtbPayoffText(text: string) {
  return (
    /\b(?:when|whenever)\b[^.]{0,140}\benters the battlefield\b/.test(text) ||
    /\bwhenever another\b[^.]{0,120}\benters the battlefield\b/.test(text)
  );
}

function hasSpellslingerText(text: string, keywords: string[]) {
  return (
    /\binstant or sorcery\b/.test(text) ||
    /\bnoncreature spell\b/.test(text) ||
    /\bcopy target spell\b/.test(text) ||
    /\bcopy\b[^.]{0,80}\binstant\b/.test(text) ||
    /\bmagecraft\b/.test(text) ||
    /\bwhenever you cast\b[^.]{0,140}\bspell\b/.test(text) ||
    /\bwhenever you cast\b[^.]{0,140}\binstant\b/.test(text) ||
    /\bwhenever you cast\b[^.]{0,140}\bsorcery\b/.test(text) ||
    keywords.includes("Prowess")
  );
}

function hasArtifactMattersText(text: string, keywords: string[]) {
  return (
    /\bartifact spell\b/.test(text) ||
    /\bartifacts you control\b/.test(text) ||
    /\bfor each artifact\b/.test(text) ||
    /\bartifact creature\b/.test(text) ||
    /\bmetalcraft\b/.test(text) ||
    keywords.includes("Improvise") ||
    keywords.includes("Affinity")
  );
}

function hasEnchantmentMattersText(text: string, keywords: string[]) {
  return (
    /\benchantment spell\b/.test(text) ||
    /\benchantments you control\b/.test(text) ||
    /\baura you control\b/.test(text) ||
    /\benchanted creature\b/.test(text) ||
    /\bconstellation\b/.test(text) ||
    keywords.includes("Constellation")
  );
}

function hasReanimatorText(text: string, keywords: string[]) {
  return (
    /\breturn\b[^.]{0,140}\b(?:creature|permanent) card\b[^.]{0,140}\bfrom your graveyard\b[^.]{0,140}\b(?:to the battlefield|to your hand)\b/.test(
      text,
    ) ||
    /\bput\b[^.]{0,140}\b(?:creature|permanent) card\b[^.]{0,140}\bfrom (?:your|a) graveyard\b[^.]{0,140}\bonto the battlefield\b/.test(
      text,
    ) ||
    /\bcast\b[^.]{0,140}\bfrom your graveyard\b/.test(text) ||
    /\byou may play lands\b[^.]{0,140}\bfrom your graveyard\b/.test(text) ||
    hasSelfMillText(text) ||
    /\bsurveil\b/.test(text) ||
    /\bdiscard\b/.test(text) ||
    keywords.includes("Flashback") ||
    keywords.includes("Unearth") ||
    keywords.includes("Escape")
  );
}

function hasLandMattersText(text: string, keywords: string[]) {
  return (
    /\blandfall\b/.test(text) ||
    /\bplay an additional land\b/.test(text) ||
    /\bwhenever a land enters the battlefield\b/.test(text) ||
    /\bsearch your library for\b[^.]{0,80}\bland\b/.test(text) ||
    /\bput\b[^.]{0,120}\bland\b[^.]{0,120}\bonto the battlefield\b/.test(text) ||
    /\bfrom your graveyard\b[^.]{0,120}\bland\b/.test(text) ||
    keywords.includes("Landfall")
  );
}

function hasLandMattersCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasLandMattersText(segment.text, card.keywords));
}

function hasCounterText(text: string, keywords: string[]) {
  return (
    /\b\+1\/\+1 counter\b/.test(text) ||
    /\bproliferate\b/.test(text) ||
    /\bput a counter on\b/.test(text) ||
    /\bput\b[^.]{0,80}\b[a-z0-9+/'-]+\s+counters?\b/.test(text) ||
    /\bcounters? on\b/.test(text) ||
    /\bremove\b[^.]{0,80}\bcounters?\b/.test(text) ||
    /\bmove\b[^.]{0,80}\bcounters?\b/.test(text) ||
    /\bdouble the number of\b[^.]{0,80}\bcounters?\b/.test(text) ||
    /\bcounters? would be (?:put|placed)\b[^.]{0,220}\b(?:that many plus|additional|twice that many)\b/.test(text) ||
    /\bchoose a kind of counter\b/.test(text) ||
    keywords.includes("Proliferate")
  );
}

function hasDiceRollText(text: string) {
  return (
    /\broll(?:s|ed|ing)?\b[^.]{0,120}\b(?:die|dice|d\d+)\b/.test(text) ||
    /\bwhenever you roll\b/.test(text) ||
    /\bif you would roll\b/.test(text) ||
    /\bd20\b|\bd12\b|\bd10\b|\bd8\b|\bd6\b|\bd4\b/.test(text)
  );
}

function hasCoinFlipText(text: string) {
  return (
    /\bflip(?:s|ped|ping)?\b[^.]{0,90}\bcoins?\b/.test(text) ||
    /\bcoin flips?\b|\bwin(?:s|ning)? a flip\b|\blose(?:s|ing)? a flip\b/.test(text) ||
    /\bif you would flip\b/.test(text)
  );
}

function hasSuperfriendsText(text: string) {
  return (
    /\bplaneswalker\b/.test(text) ||
    /\bloyalty abilities?\b/.test(text) ||
    /\bactivate loyalty abilities\b/.test(text) ||
    /\bfor each planeswalker\b/.test(text)
  );
}

function hasVoltronText(text: string) {
  return (
    /\bequipped creature\b/.test(text) ||
    /\benchanted creature\b/.test(text) ||
    /\battach\b[^.]{0,80}\bto target creature you control\b/.test(text) ||
    /\btarget creature you control\b[^.]{0,160}\bgets \+\d+\/\+\d+\b/.test(text) ||
    /\btarget creature gets \+\d+\/\+\d+\b/.test(text) ||
    /\bcommander creatures? you control\b/.test(text)
  );
}

function hasExtraCombatText(text: string) {
  return (
    /\badditional combat phase\b/.test(text) ||
    /\bafter this phase\b[^.]{0,120}\badditional combat phase\b/.test(text) ||
    /\buntap all\b[^.]{0,120}\bafter this phase\b[^.]{0,120}\badditional combat phase\b/.test(
      text,
    ) ||
    /\bif it's the first combat phase of the turn\b/.test(text)
  );
}

function hasExtraUpkeepText(text: string) {
  return (
    /\badditional upkeep steps?\b/.test(text) ||
    /\bextra upkeep steps?\b/.test(text) ||
    /\bbeginning of (?:your|each|that player's|each player's) upkeep\b/.test(text) ||
    /\bat the beginning of (?:your|each|that player's|each player's) upkeep\b/.test(text) ||
    /\bcumulative upkeep\b/.test(text)
  );
}

function getExtraUpkeepStrategyWeight(text: string) {
  let weight = 0.82;

  if (/\badditional upkeep steps?\b|\bextra upkeep steps?\b/.test(text)) {
    weight += 0.48;
  }

  if (/\bat the beginning of (?:your|each|that player's|each player's) upkeep\b/.test(text)) {
    weight += 0.2;
  }

  if (/\bcumulative upkeep\b/.test(text)) {
    weight += 0.14;
  }

  return Math.min(1.42, weight);
}

function hasTapUntapText(text: string) {
  return (
    /\btap target\b/.test(text) ||
    /\btap up to\b/.test(text) ||
    /\btap an untapped\b/.test(text) ||
    /\btap another untapped\b/.test(text) ||
    /\btapped creature(?:s)? your opponents control\b/.test(text) ||
    /\bwhenever\b[^.]{0,160}\btap\b[^.]{0,160}\b(?:creature|permanent|artifact|opponent)\b/.test(text) ||
    /\buntap target\b/.test(text) ||
    /\buntap (?:another |all |each |up to )?[^.]{0,80}\b(?:creature|permanent|artifact|land)\b/.test(text) ||
    /\bstun counters?\b/.test(text)
  );
}

function getTapUntapStrategyWeight(text: string) {
  let weight = 0.82;

  if (/\bwhenever\b[^.]{0,160}\btap\b|\btapped creature(?:s)? your opponents control\b/.test(text)) {
    weight += 0.32;
  }

  if (/\bstun counters?\b/.test(text)) {
    weight += 0.16;
  }

  if (/\buntap\b/.test(text) && /\btap\b/.test(text)) {
    weight += 0.1;
  }

  return Math.min(1.34, weight);
}

function hasKindredPayoffText(text: string, dominantType: string | null) {
  if (/\bchoose a creature type\b/.test(text) || /\bcreature type\b/.test(text)) {
    return true;
  }

  if (!dominantType) {
    return false;
  }

  const type = escapeRegex(dominantType);
  return new RegExp(
    `\\b(?:other|another|each|all)?\\s*${type}s?\\b[^.]{0,50}\\b(?:you control|creatures|spells|cards|permanents)\\b`,
  ).test(text);
}

function hasStaxText(text: string) {
  return (
    /\bspells your opponents cast cost\b/.test(text) ||
    /\bplayers can't cast more than\b/.test(text) ||
    /\bopponents can't search libraries\b/.test(text) ||
    /\bcan't search libraries\b/.test(text) ||
    (/\benter the battlefield tapped\b/.test(text) && /\bopponents\b/.test(text)) ||
    /\bskip (?:their|your) untap step\b/.test(text) ||
    /\bcan't be activated\b/.test(text) ||
    /\bcan't attack or block\b/.test(text) ||
    /\bunless they pay\b/.test(text) ||
    /\bnoncreature spells cost\b/.test(text) ||
    /\bactivated abilities of\b[^.]{0,80}\bcan't be activated\b/.test(text)
  );
}

function hasControlText(text: string) {
  return (
    hasCounterspellText(text) ||
    hasSweeperText(text) ||
    /\bexile target spell\b/.test(text) ||
    /\breturn target spell\b/.test(text) ||
    /\bcounter target activated or triggered ability\b/.test(text) ||
    /\bend the turn\b/.test(text)
  );
}

function hasGroupHugText(text: string) {
  return (
    /\beach player draws\b/.test(text) ||
    /\beach player may draw\b/.test(text) ||
    /\bat the beginning of each player's draw step\b/.test(text) ||
    /\bwhenever an opponent draws a card\b[^.]{0,120}\byou draw a card\b/.test(text) ||
    /\bwhenever you draw a card\b[^.]{0,120}\beach opponent may draw a card\b/.test(text) ||
    /\beach player may search\b[^.]{0,120}\bland\b/.test(text) ||
    /\beach player may put a land card\b/.test(text) ||
    /\beach player may play an additional land\b/.test(text) ||
    /\bwhenever a player taps a land for mana\b/.test(text) ||
    /\beach land is every basic land type\b/.test(text) ||
    /\beach player adds\b/.test(text)
  );
}

function hasGroupSlugText(text: string) {
  return (
    /\beach opponent loses\b/.test(text) ||
    /\beach player loses\b/.test(text) ||
    /\bdeals \d+ damage to each opponent\b/.test(text) ||
    /\bdeals \d+ damage to each player\b/.test(text) ||
    /\bif (?:a|an|one or more) players? lost \d+ or more life\b/.test(text) ||
    /\bif (?:an opponent|each opponent) lost life\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bplayers? lose life\b/.test(text) ||
    /\bat the beginning of each\b[^.]{0,120}\bloses\b[^.]{0,40}\blife\b/.test(text) ||
    /\bwhenever an opponent\b[^.]{0,120}\bloses life\b/.test(text)
  );
}

function hasLifegainText(text: string, keywords: string[]) {
  return (
    /\byou gain \d+ life\b/.test(text) ||
    /\bwhenever you gain life\b/.test(text) ||
    /\beach opponent loses\b[^.]{0,80}\byou gain\b/.test(text) ||
    /\bextort\b/.test(text) ||
    /\bwhenever another creature enters the battlefield\b[^.]{0,120}\byou gain\b/.test(text) ||
    keywords.includes("Lifelink")
  );
}

function hasMillText(text: string, keywords: string[]) {
  return (
    hasOpponentMillText(text) ||
    /\bwhenever one or more cards are put into\b[^.]{0,120}\bfrom a library\b/.test(text) ||
    keywords.includes("Mill")
  );
}

function hasAggroText(text: string, keywords: string[]) {
  return (
    /\bwhenever\b[^.]{0,120}\battacks\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bdeals combat damage to a player\b/.test(text) ||
    /\bcan't be blocked\b/.test(text) ||
    /\bat the beginning of combat\b/.test(text) ||
    /\battacking creatures?\b/.test(text) ||
    /\bwhenever one or more creatures you control attack\b/.test(text) ||
    keywords.includes("Double strike") ||
    keywords.includes("Trample") ||
    keywords.includes("Menace") ||
    keywords.includes("Haste")
  );
}

function hasCounterspellText(text: string) {
  return (
    /\bcounter target spell\b/.test(text) ||
    /\bcounter up to\b[^.]{0,40}\btarget spells?\b/.test(text) ||
    /\bcounter target activated or triggered ability\b/.test(text) ||
    /\bexile target spell\b/.test(text) ||
    /\breturn target spell\b[^.]{0,80}\bto its owner's hand\b/.test(text)
  );
}

function hasSweeperText(text: string) {
  return (
    /\bdestroy all\b/.test(text) ||
    /\bexile all\b/.test(text) ||
    /\beach creature gets -\d+\/-\d+\b/.test(text) ||
    /\beach opponent sacrifices\b/.test(text) ||
    /\beach player sacrifices\b/.test(text) ||
    /\bdeals \d+ damage to each creature\b/.test(text) ||
    /\bdeals \d+ damage to each nonland permanent\b/.test(text)
  );
}

function hasCounterspellCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasCounterspellText(segment.text));
}

function hasSweeperCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasSweeperText(segment.text));
}

function hasStaxCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasStaxText(segment.text));
}

function hasEtbPayoffCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasEtbPayoffText(segment.text));
}

function hasFaceDownCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasFaceDownText(segment.text, card.keywords));
}

function hasExtraCombatCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasExtraCombatText(segment.text));
}

function hasAggroCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasAggroText(segment.text, card.keywords));
}

function hasGroupSlugCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasGroupSlugText(segment.text));
}

function hasSuperfriendsCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasSuperfriendsText(segment.text));
}

function hasGroupHugCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasGroupHugText(segment.text));
}

function hasLifegainCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasLifegainText(segment.text, card.keywords));
}

function hasMillCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasMillText(segment.text, card.keywords));
}

function hasDiceRollCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasDiceRollText(segment.text));
}

function hasCoinFlipCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasCoinFlipText(segment.text));
}

function hasXSpellCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasXSpellText(segment.text, card));
}

function hasXSpellPayoffCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasXSpellPayoffText(segment.text));
}

function hasManaEngineCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) =>
    hasTreasureText(segment.text) ||
    hasLandMattersText(segment.text, card.keywords) ||
    /\badd\b[^.]{0,80}\b(?:mana|{[wubrgc]})\b/.test(segment.text) ||
    /\buntap\b[^.]{0,80}\b(?:lands?|permanents?|artifacts?)\b/.test(segment.text) ||
    /\bspells? you cast\b[^.]{0,80}\bcosts?\b[^.]{0,60}\bless\b/.test(segment.text),
  );
}

function hasSelfMillCardText(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasSelfMillText(segment.text));
}

function applyLinkedSynergyAdjustments(
  totals: Record<StrategyKey, number>,
  keyCards: Map<StrategyKey, Map<string, number>>,
  supportBuckets: Map<StrategyKey, Map<string, StrategySupportCard>>,
  reasons: Map<StrategyKey, Map<string, number>>,
  context: StrategyContext,
) {
  for (const profile of getLinkedSynergyProfiles(context)) {
    const enablers = context.deckCards.filter(profile.enablerMatcher);
    const material = context.deckCards.filter(
      (deckCard) =>
        profile.materialMatcher(deckCard) &&
        !enablers.some((enabler) => isSameDeckCard(enabler, deckCard)),
    );
    const enablerCount = enablers.reduce((sum, deckCard) => sum + deckCard.quantity, 0);
    const materialCount = material.reduce((sum, deckCard) => sum + deckCard.quantity, 0);

    if (enablerCount < profile.minimumEnablers || materialCount < profile.minimumMaterial) {
      continue;
    }

    const enablerRatio = Math.min(1.6, enablerCount / profile.minimumEnablers);
    const materialRatio = Math.min(1.8, materialCount / profile.minimumMaterial);
    const bonus = roundTo(
      Math.min(4.2, 0.75 + enablerRatio * profile.bonusScale + materialRatio * 0.85),
      2,
    );

    addStrategyBonus(
      totals,
      reasons,
      profile.key,
      bonus,
      `${enablerCount} ${profile.label} enabler${enablerCount === 1 ? "" : "s"} connect with ${materialCount} matching material card${materialCount === 1 ? "" : "s"}, so those cards are worth more together than separately.`,
    );

    for (const deckCard of enablers) {
      const amount = roundTo(profile.enablerWeight * deckCard.quantity, 2);
      trackKeyCard(keyCards, profile.key, deckCard.card.name, amount);
      trackStrategySupportCard(
        supportBuckets,
        profile.key,
        deckCard,
        amount,
        profile.enablerReason,
      );
    }

    for (const deckCard of material) {
      const amount = roundTo(profile.materialWeight * deckCard.quantity, 2);
      trackKeyCard(keyCards, profile.key, deckCard.card.name, amount);
      trackStrategySupportCard(
        supportBuckets,
        profile.key,
        deckCard,
        amount,
        profile.materialReason,
      );
    }
  }
}

function getLinkedSynergyProfiles(context: StrategyContext): LinkedSynergyProfile[] {
  const profiles: LinkedSynergyProfile[] = [
    {
      key: "x_spells",
      label: "X-spell / mana-sink",
      enablerReason: "This card supplies mana or cost reduction that makes scalable X-spells realistic.",
      materialReason: "This card is a scalable X payoff that becomes stronger when the deck can produce extra mana.",
      minimumEnablers: 4,
      minimumMaterial: 4,
      enablerWeight: 0.5,
      materialWeight: 0.86,
      bonusScale: 0.82,
      enablerMatcher: (deckCard: ResolvedDeckCard) => hasManaEngineCardText(deckCard.card),
      materialMatcher: (deckCard: ResolvedDeckCard) => hasXSpellCardText(deckCard.card),
    },
    {
      key: "toughness_matter",
      label: "toughness/defender",
      enablerReason: "This card changes defender or toughness text into a real payoff.",
      materialReason: "This card becomes stronger because the deck contains defender/toughness enablers.",
      minimumEnablers: 1,
      minimumMaterial: 4,
      enablerWeight: 1.18,
      materialWeight: 0.58,
      bonusScale: 1.2,
      enablerMatcher: (deckCard: ResolvedDeckCard) => isToughnessMatterEnabler(deckCard.card),
      materialMatcher: (deckCard: ResolvedDeckCard) => isToughnessMatterMaterial(deckCard.card),
    },
    {
      key: "blink",
      label: "blink/ETB",
      enablerReason: "This card can repeatedly reuse enters-the-battlefield effects.",
      materialReason: "This card has enters-the-battlefield value that becomes stronger with blink effects.",
      minimumEnablers: 2,
      minimumMaterial: 5,
      enablerWeight: 0.9,
      materialWeight: 0.42,
      bonusScale: 0.85,
      enablerMatcher: (deckCard: ResolvedDeckCard) => cardMatchesStrategyText(deckCard.card, hasBlinkText),
      materialMatcher: (deckCard: ResolvedDeckCard) => cardMatchesStrategyText(deckCard.card, hasEtbPayoffText),
    },
    {
      key: "aristocrats",
      label: "sacrifice/death",
      enablerReason: "This card turns sacrifices or deaths into cards, damage, mana, or other value.",
      materialReason: "This card supplies expendable bodies or death material for the sacrifice plan.",
      minimumEnablers: 2,
      minimumMaterial: 5,
      enablerWeight: 0.9,
      materialWeight: 0.42,
      bonusScale: 0.9,
      enablerMatcher: (deckCard: ResolvedDeckCard) => isAristocratsEnabler(deckCard.card),
      materialMatcher: (deckCard: ResolvedDeckCard) => isAristocratsMaterial(deckCard.card),
    },
    {
      key: "pingers",
      label: "small-damage",
      enablerReason: "This card rewards exact or repeatable small-damage events.",
      materialReason: "This card supplies the small-damage events that trigger the payoff.",
      minimumEnablers: 1,
      minimumMaterial: 3,
      enablerWeight: 1.05,
      materialWeight: 0.56,
      bonusScale: 1.05,
      enablerMatcher: (deckCard: ResolvedDeckCard) => isSmallDamagePayoff(deckCard.card),
      materialMatcher: (deckCard: ResolvedDeckCard) => isSmallDamageMaterial(deckCard.card),
    },
    {
      key: "counters",
      label: "counter",
      enablerReason: "This card increases, doubles, moves, or proliferates counters.",
      materialReason: "This card supplies counters or counter payoffs for the counter engine.",
      minimumEnablers: 2,
      minimumMaterial: 5,
      enablerWeight: 0.86,
      materialWeight: 0.42,
      bonusScale: 0.75,
      enablerMatcher: (deckCard: ResolvedDeckCard) => isCounterAmplifier(deckCard.card),
      materialMatcher: (deckCard: ResolvedDeckCard) => isCounterMaterial(deckCard.card),
    },
  ];

  return profiles.filter((profile) => {
    if (profile.key === "kindred" && !context.kindredEnabled) {
      return false;
    }

    return true;
  });
}

function isSameDeckCard(left: ResolvedDeckCard, right: ResolvedDeckCard) {
  return left.section === right.section && normalizeText(left.card.name) === normalizeText(right.card.name);
}

function cardMatchesStrategyText(card: ScryfallCard, matcher: (text: string) => boolean) {
  return getStrategySegments(card).some((segment) => matcher(segment.text));
}

function isToughnessMatterEnabler(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) =>
    /\bassigns? combat damage equal to (?:its|their) toughness\b/.test(segment.text) ||
    /\btoughness rather than (?:its|their) power\b/.test(segment.text) ||
    /\bcreatures? you control with defender\b[^.]{0,160}\b(?:can attack|assign|deal|damage|draw|create|gain|gets?)\b/.test(segment.text) ||
    /\bdefender creatures? you control\b[^.]{0,160}\b(?:can attack|assign|deal|damage|draw|create|gain|gets?)\b/.test(segment.text) ||
    /\b(?:total toughness|toughness among creatures)\b/.test(segment.text),
  );
}

function isToughnessMatterMaterial(card: ScryfallCard) {
  return (
    hasCardType(card, "Creature") &&
    (
      card.keywords.includes("Defender") ||
      getStrategySegments(card).some((segment) => /\bdefender\b/.test(segment.text)) ||
      hasHighToughnessCreatureStats(card) ||
      hasToughnessMatterText(getStrategySegments(card).map((segment) => segment.text).join(" "), card)
    )
  );
}

function isAristocratsEnabler(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) =>
    /\bsacrifice (?:another |a |an |one or more |any number of)?(?:creature|artifact|token|permanent)s?\b[^.]{0,160}\b(?:draw|create|add|deal|deals|gain|loses?|return|put)\b/.test(segment.text) ||
    /\bwhenever\b[^.]{0,180}\b(?:creature|artifact|token|permanent)s? (?:you control )?(?:dies|is put into a graveyard|is sacrificed)\b[^.]{0,180}\b(?:draw|create|add|deal|deals|gain|loses?|return|put)\b/.test(segment.text) ||
    hasAristocratsText(segment.text),
  );
}

function isAristocratsMaterial(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) =>
    hasTokenText(segment.text) ||
    /\bwhen\b[^.]{0,120}\bdies\b/.test(segment.text) ||
    /\bwhenever\b[^.]{0,120}\bdies\b/.test(segment.text) ||
    /\breturn\b[^.]{0,120}\bfrom your graveyard\b[^.]{0,120}\bto the battlefield\b/.test(segment.text) ||
    /\b(?:escape|unearth|embalm|eternalize|disturb)\b/.test(segment.text),
  );
}

function isSmallDamagePayoff(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) =>
    /\bsource you control deals exactly 1 damage\b/.test(segment.text) ||
    /\bwhenever\b[^.]{0,160}\bdeals exactly 1 damage\b/.test(segment.text) ||
    /\bwhenever\b[^.]{0,160}\bdeals 1 damage\b[^.]{0,180}\b(?:deals?|draw|create|exile|put)\b/.test(segment.text),
  );
}

function isSmallDamageMaterial(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) =>
    /\bdeals 1 damage to\b/.test(segment.text) ||
    /\bdeals exactly 1 damage\b/.test(segment.text) ||
    /\bwhenever\b[^.]{0,120}\bdeals damage\b[^.]{0,120}\bdeals 1 damage\b/.test(segment.text) ||
    hasSmallDamageText(segment.text),
  );
}

function isCounterAmplifier(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) =>
    /\bproliferate\b/.test(segment.text) ||
    /\bdouble the number of\b[^.]{0,120}\bcounters?\b/.test(segment.text) ||
    /\bcounters? would be (?:put|placed)\b[^.]{0,220}\b(?:that many plus|additional|twice that many)\b/.test(segment.text) ||
    /\bmove (?:a|any number of) counters?\b/.test(segment.text),
  );
}

function isCounterMaterial(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasCounterText(segment.text, card.keywords));
}

function applyCommanderBuildAroundAdjustments(
  totals: Record<StrategyKey, number>,
  keyCards: Map<StrategyKey, Map<string, number>>,
  supportBuckets: Map<StrategyKey, Map<string, StrategySupportCard>>,
  reasons: Map<StrategyKey, Map<string, number>>,
  context: StrategyContext,
) {
  const profiles = getCommanderBuildAroundProfiles(context);

  for (const profile of profiles) {
    const supportCards = context.deckCards.filter(
      (deckCard) => deckCard.section === "mainboard" && profile.matcher(deckCard),
    );
    const supportCount = supportCards.reduce((sum, deckCard) => sum + deckCard.quantity, 0);

    if (supportCount < profile.minimumSupport) {
      continue;
    }

    const supportRatio = Math.min(1.7, supportCount / profile.minimumSupport);
    const bonus = roundTo(Math.min(4.4, 1.15 + supportRatio * 1.25), 2);
    const reason = `${profile.commander.card.name} asks for ${profile.label}, and ${supportCount} cards in the 99 directly supply that material.`;

    addStrategyBonus(totals, reasons, profile.key, bonus, reason);
    trackKeyCard(keyCards, profile.key, profile.commander.card.name, 2.2);
    trackStrategySupportCard(
      supportBuckets,
      profile.key,
      profile.commander,
      2.2,
      `Commander build-around text asks for ${profile.label}.`,
    );

    for (const deckCard of supportCards) {
      const amount = roundTo(profile.supportWeight * deckCard.quantity, 2);
      trackKeyCard(keyCards, profile.key, deckCard.card.name, amount);
      trackStrategySupportCard(
        supportBuckets,
        profile.key,
        deckCard,
        amount,
        profile.supportReason,
      );
    }
  }
}

function getCommanderBuildAroundProfiles(context: StrategyContext): CommanderBuildAroundProfile[] {
  const profiles: CommanderBuildAroundProfile[] = [];
  const commanders = context.deckCards.filter((deckCard) => deckCard.section === "commander");
  const creatureTypeCounts = getCreatureTypeCounts(context.deckCards);

  for (const commander of commanders) {
    const text = getStrategySegments(commander.card)
      .map((segment) => segment.text)
      .join(" ");

    profiles.push(...getCommanderRequestedMaterialProfiles(commander, text));

    if (commanderAsksForDeathTriggers(text)) {
      profiles.push({
        key: "aristocrats",
        commander,
        label: "death-trigger and sacrifice cards",
        supportReason: "Death triggers, sacrifice outlets, token fodder, or recursive creatures follow the commander's death-trigger text.",
        minimumSupport: 5,
        supportWeight: 0.78,
        matcher: (deckCard) => isAristocratsEnabler(deckCard.card) || isAristocratsMaterial(deckCard.card),
      });
    }

    if (commanderAsksForTokens(text)) {
      profiles.push({
        key: "tokens",
        commander,
        label: "token production and token payoff cards",
        supportReason: "Token creation or token payoff text follows the commander ask.",
        minimumSupport: 6,
        supportWeight: 0.72,
        matcher: (deckCard) => isTokenSupport(deckCard.card),
      });
    }

    if (commanderAsksForExtraUpkeep(text)) {
      profiles.push({
        key: "extra_upkeep",
        commander,
        label: "upkeep triggers and upkeep-scaling cards",
        supportReason: "Upkeep triggers, extra-upkeep payoffs, or cumulative-upkeep cards follow the commander ask.",
        minimumSupport: 4,
        supportWeight: 0.88,
        matcher: (deckCard) => isExtraUpkeepSupport(deckCard.card),
      });
    }

    if (commanderAsksForTapUntap(text)) {
      profiles.push({
        key: "tap_untap",
        commander,
        label: "tap, untap, stun, and tapped-creature payoff cards",
        supportReason: "Tap, untap, stun, or tapped-creature payoff text follows the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.8,
        matcher: (deckCard) => isTapUntapSupport(deckCard.card),
      });
    }

    if (commanderAsksForBlink(text)) {
      profiles.push({
        key: "blink",
        commander,
        label: "blink effects and enters-the-battlefield cards",
        supportReason: "Blink effects or enters-the-battlefield value follows the commander ask.",
        minimumSupport: 6,
        supportWeight: 0.74,
        matcher: (deckCard) => isBlinkSupport(deckCard.card),
      });
    }

    if (commanderAsksForFaceDown(text)) {
      profiles.push({
        key: "face_down",
        commander,
        label: "face-down, morph, manifest, cloak, and disguise cards",
        supportReason: "Face-down, morph, manifest, cloak, disguise, or turn-face-up text follows the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.84,
        matcher: (deckCard) => isFaceDownSupport(deckCard.card),
      });
    }

    if (hasToughnessCommanderAsk(text)) {
      profiles.push({
        key: "toughness_matter",
        commander,
        label: "defenders or toughness-scaling creatures",
        supportReason: "Defender, high-toughness, or toughness-combat text follows the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.82,
        matcher: (deckCard) => isToughnessMatterSupport(deckCard.card),
      });
    }

    if (commanderAsksForCounters(text)) {
      profiles.push({
        key: "counters",
        commander,
        label: "counter production, counter payoff, and proliferate cards",
        supportReason: "Counter production, counter payoff, or proliferate text follows the commander ask.",
        minimumSupport: 6,
        supportWeight: 0.72,
        matcher: (deckCard) => isCounterSupport(deckCard.card),
      });
    }

    if (commanderAsksForDungeons(text)) {
      profiles.push({
        key: "dungeons",
        commander,
        label: "venture and dungeon-completion cards",
        supportReason: "Venture, initiative, or dungeon-completion text follows the commander ask.",
        minimumSupport: 4,
        supportWeight: 0.84,
        matcher: (deckCard) => isDungeonSupport(deckCard.card),
      });
    }

    if (commanderAsksForMadness(text)) {
      profiles.push({
        key: "madness",
        commander,
        label: "madness and discard cards",
        supportReason: "Madness cards, discard outlets, or discard payoffs follow the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.78,
        matcher: (deckCard) => isMadnessSupport(deckCard.card),
      });
    }

    if (commanderAsksForNinjutsu(text)) {
      profiles.push({
        key: "ninjutsu",
        commander,
        label: "Ninjas and evasive attackers",
        supportReason: "Ninja, Ninjutsu, or evasive combat text follows the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.76,
        matcher: (deckCard) => isNinjutsuSupport(deckCard.card),
      });
    }

    if (commanderAsksForCurses(text)) {
      profiles.push({
        key: "curses",
        commander,
        label: "Curse enchantments",
        supportReason: "Curse subtype or enchanted-player text follows the commander ask.",
        minimumSupport: 4,
        supportWeight: 0.84,
        matcher: (deckCard) => isCurseSupport(deckCard.card),
      });
    }

    if (commanderAsksForExileCast(text)) {
      profiles.push({
        key: "exile_cast",
        commander,
        label: "cast-from-exile cards",
        supportReason: "Exile access or cast-from-exile payoff text follows the commander ask.",
        minimumSupport: 6,
        supportWeight: 0.76,
        matcher: (deckCard) => isExileCastSupport(deckCard.card),
      });
    }

    if (commanderAsksForTreasure(text)) {
      profiles.push({
        key: "treasure",
        commander,
        label: "Treasure creation and Treasure payoff cards",
        supportReason: "Treasure production or Treasure payoff text follows the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.8,
        matcher: (deckCard) => isTreasureSupport(deckCard.card),
      });
    }

    if (commanderAsksForFood(text)) {
      profiles.push({
        key: "food",
        commander,
        label: "Food cards",
        supportReason: "Food creation or Food payoff text follows the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.78,
        matcher: (deckCard) => isFoodSupport(deckCard.card),
      });
    }

    if (commanderAsksForClues(text)) {
      profiles.push({
        key: "clues",
        commander,
        label: "Clue and investigate cards",
        supportReason: "Clue creation, investigate, or Clue payoff text follows the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.78,
        matcher: (deckCard) => isClueSupport(deckCard.card),
      });
    }

    if (commanderAsksForEnergy(text)) {
      profiles.push({
        key: "energy",
        commander,
        label: "Energy cards",
        supportReason: "Energy production or energy-spending text follows the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.8,
        matcher: (deckCard) => isEnergySupport(deckCard.card),
      });
    }

    if (commanderAsksForSagas(text)) {
      profiles.push({
        key: "sagas",
        commander,
        label: "Saga cards",
        supportReason: "Saga subtype, chapter, or lore-counter text follows the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.78,
        matcher: (deckCard) => isSagaSupport(deckCard.card),
      });
    }

    if (commanderAsksForDice(text)) {
      profiles.push({
        key: "dice_rolls",
        commander,
        label: "dice-roll cards",
        supportReason: "Dice-roll text follows the commander ask.",
        minimumSupport: 3,
        supportWeight: 0.9,
        matcher: (deckCard) => isDiceRollSupport(deckCard.card),
      });
    }

    if (commanderAsksForCoinFlip(text)) {
      profiles.push({
        key: "coin_flip",
        commander,
        label: "coin-flip cards",
        supportReason: "Coin-flip text follows the commander ask.",
        minimumSupport: 3,
        supportWeight: 0.9,
        matcher: (deckCard) => isCoinFlipSupport(deckCard.card),
      });
    }

    if (commanderAsksForMonarch(text)) {
      profiles.push({
        key: "monarch",
        commander,
        label: "Monarch cards",
        supportReason: "Monarch enablers or monarch payoff text follows the commander ask.",
        minimumSupport: 4,
        supportWeight: 0.78,
        matcher: (deckCard) => isMonarchSupport(deckCard.card),
      });
    }

    if (commanderAsksForTheft(text)) {
      profiles.push({
        key: "theft",
        commander,
        label: "Theft cards",
        supportReason: "Steal effects or opponent-card access follows the commander ask.",
        minimumSupport: 4,
        supportWeight: 0.8,
        matcher: (deckCard) => isTheftSupport(deckCard.card),
      });
    }

    if (commanderAsksForGoad(text)) {
      profiles.push({
        key: "goad",
        commander,
        label: "Goad and forced-combat cards",
        supportReason: "Goad or forced-combat text follows the commander ask.",
        minimumSupport: 4,
        supportWeight: 0.8,
        matcher: (deckCard) => isGoadSupport(deckCard.card),
      });
    }

    if (commanderAsksForShrines(text)) {
      profiles.push({
        key: "shrines",
        commander,
        label: "Shrine cards",
        supportReason: "Shrine subtype or Shrine-scaling text follows the commander ask.",
        minimumSupport: 4,
        supportWeight: 0.84,
        matcher: (deckCard) => isShrineSupport(deckCard.card),
      });
    }

    if (commanderAsksForCycling(text)) {
      profiles.push({
        key: "cycling",
        commander,
        label: "cycling cards",
        supportReason: "Cycling cards or cycling payoff text follows the commander ask.",
        minimumSupport: 6,
        supportWeight: 0.72,
        matcher: (deckCard) => isCyclingSupport(deckCard.card),
      });
    }

    if (commanderAsksForMutate(text)) {
      profiles.push({
        key: "mutate",
        commander,
        label: "mutate cards",
        supportReason: "Mutate cards or merged-creature payoff text follows the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.78,
        matcher: (deckCard) => isMutateSupport(deckCard.card),
      });
    }

    if (commanderAsksForPoison(text)) {
      profiles.push({
        key: "poison",
        commander,
        label: "poison cards",
        supportReason: "Infect, toxic, poison counter, or corrupted text follows the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.78,
        matcher: (deckCard) => isPoisonSupport(deckCard.card),
      });
    }

    if (commanderAsksForBattles(text)) {
      profiles.push({
        key: "battles",
        commander,
        label: "Battle cards",
        supportReason: "Battle card type or battle-defeat payoff text follows the commander ask.",
        minimumSupport: 4,
        supportWeight: 0.8,
        matcher: (deckCard) => isBattleSupport(deckCard.card),
      });
    }

    if (commanderAsksForPillowfort(text)) {
      profiles.push({
        key: "pillowfort",
        commander,
        label: "Pillowfort protection cards",
        supportReason: "Attack-tax, no-attack, or damage-prevention text follows the commander ask.",
        minimumSupport: 4,
        supportWeight: 0.8,
        matcher: (deckCard) => isPillowfortSupport(deckCard.card),
      });
    }

    if (commanderAsksForCopyClone(text)) {
      profiles.push({
        key: "copy_clone",
        commander,
        label: "copy and clone cards",
        supportReason: "Copy, clone, or token-copy text follows the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.78,
        matcher: (deckCard) => isCopyCloneSupport(deckCard.card),
      });
    }

    const powerMatterProfile = getCommanderPowerMatterProfile(commander, text);
    if (powerMatterProfile) {
      profiles.push(powerMatterProfile);
    }

    const manaValueProfile = getCommanderManaValueMatterProfile(commander, text);
    if (manaValueProfile) {
      profiles.push(manaValueProfile);
    }

    if (commanderAsksForLegends(text)) {
      profiles.push({
        key: "legends_matter",
        commander,
        label: "legendary cards",
        supportReason: "Legendary permanents or legendary-spell payoffs follow the commander ask.",
        minimumSupport: 6,
        supportWeight: 0.62,
        matcher: (deckCard) => isLegendarySupport(deckCard.card),
      });
    }

    if (commanderAsksForStax(text)) {
      profiles.push({
        key: "stax",
        commander,
        label: "tax, restriction, and lock pieces",
        supportReason: "Tax, restriction, or lock text follows the commander ask.",
        minimumSupport: 4,
        supportWeight: 0.82,
        matcher: (deckCard) => isStaxSupport(deckCard.card),
      });
    }

    if (commanderAsksForGroupHug(text)) {
      profiles.push({
        key: "group_hug",
        commander,
        label: "symmetrical draw, mana, and table-resource cards",
        supportReason: "Group-resource text follows the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.72,
        matcher: (deckCard) => isGroupHugSupport(deckCard.card),
      });
    }

    if (commanderAsksForGroupSlug(text)) {
      profiles.push({
        key: "group_slug",
        commander,
        label: "broad life-loss and damage cards",
        supportReason: "Broad life-loss or damage text follows the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.72,
        matcher: (deckCard) => isGroupSlugSupport(deckCard.card),
      });
    }

    if (commanderAsksForLifegain(text)) {
      profiles.push({
        key: "lifegain",
        commander,
        label: "life-gain and life-drain cards",
        supportReason: "Life-gain, lifelink, or drain text follows the commander ask.",
        minimumSupport: 6,
        supportWeight: 0.72,
        matcher: (deckCard) => isLifegainSupport(deckCard.card),
      });
    }

    if (commanderAsksForMill(text)) {
      profiles.push({
        key: "mill",
        commander,
        label: "mill and library-pressure cards",
        supportReason: "Mill or library-pressure text follows the commander ask.",
        minimumSupport: 5,
        supportWeight: 0.76,
        matcher: (deckCard) => isMillSupport(deckCard.card),
      });
    }

    if (hasSmallDamageCommanderAsk(text)) {
      profiles.push({
        key: "pingers",
        commander,
        label: "repeatable small-damage sources",
        supportReason: "Exact 1-damage or repeatable ping text follows the commander ask.",
        minimumSupport: 4,
        supportWeight: 0.9,
        matcher: (deckCard) => isSmallDamageSupport(deckCard.card),
      });
    }

    for (const type of extractCommanderRequestedCreatureTypes(text, creatureTypeCounts)) {
      profiles.push({
        key: "kindred",
        commander,
        label: `${formatCreatureType(type)} cards`,
        supportReason: `${formatCreatureType(type)} creature or payoff text follows the commander ask.`,
        minimumSupport: 7,
        supportWeight: 0.48,
        matcher: (deckCard) =>
          cardHasCreatureType(deckCard.card, type) ||
          getStrategySegments(deckCard.card).some((segment) => hasKindredPayoffText(segment.text, type)),
      });
    }
  }

  return profiles;
}

function getCommanderRequestedMaterialProfiles(
  commander: ResolvedDeckCard,
  text: string,
): CommanderBuildAroundProfile[] {
  const profiles: CommanderBuildAroundProfile[] = [];

  const addProfile = (
    key: StrategyKey,
    label: string,
    matcher: (deckCard: ResolvedDeckCard) => boolean,
    options: { minimumSupport?: number; supportWeight?: number; supportReason?: string } = {},
  ) => {
    profiles.push({
      key,
      commander,
      label,
      supportReason:
        options.supportReason ?? `${label} card type support follows the commander ask.`,
      minimumSupport: options.minimumSupport ?? 6,
      supportWeight: options.supportWeight ?? 0.58,
      matcher,
    });
  };

  if (commanderAsksForArtifacts(text)) {
    addProfile("artifacts", "artifact cards", (deckCard) => hasCardType(deckCard.card, "Artifact"), {
      minimumSupport: 7,
      supportWeight: 0.56,
      supportReason: "Artifact card density follows the commander's artifact-matters text.",
    });
  }

  if (commanderAsksForVehicles(text)) {
    addProfile("artifacts", "Vehicle cards", (deckCard) => cardHasSubtype(deckCard.card, "Vehicle"), {
      minimumSupport: 4,
      supportWeight: 0.78,
      supportReason: "Vehicle cards follow the commander's Vehicle-specific text.",
    });
  }

  if (commanderAsksForEnchantments(text)) {
    addProfile(
      "enchantress",
      "enchantment cards",
      (deckCard) => hasCardType(deckCard.card, "Enchantment"),
      {
        minimumSupport: 7,
        supportWeight: 0.6,
        supportReason: "Enchantment card density follows the commander's enchantment-matters text.",
      },
    );
  }

  if (commanderAsksForAuras(text)) {
    addProfile("voltron", "Aura cards", (deckCard) => cardHasSubtype(deckCard.card, "Aura"), {
      minimumSupport: 4,
      supportWeight: 0.74,
      supportReason: "Aura cards follow the commander's Aura or enchanted-creature text.",
    });
  }

  if (commanderAsksForEquipment(text)) {
    addProfile(
      "voltron",
      "Equipment cards",
      (deckCard) => cardHasSubtype(deckCard.card, "Equipment"),
      {
        minimumSupport: 4,
        supportWeight: 0.74,
        supportReason: "Equipment cards follow the commander's Equipment or equipped-creature text.",
      },
    );
  }

  if (commanderAsksForInstantsAndSorceries(text)) {
    addProfile(
      "spellslinger",
      "instant and sorcery cards",
      (deckCard) => hasCardType(deckCard.card, "Instant") || hasCardType(deckCard.card, "Sorcery"),
      {
        minimumSupport: 8,
        supportWeight: 0.5,
        supportReason: "Instant and sorcery density follows the commander's spell-matters text.",
      },
    );
  }

  if (commanderAsksForNoncreatureSpells(text)) {
    addProfile(
      "spellslinger",
      "noncreature spells",
      (deckCard) => !hasCardType(deckCard.card, "Creature") && !hasCardType(deckCard.card, "Land"),
      {
        minimumSupport: 11,
        supportWeight: 0.38,
        supportReason: "Noncreature spell density follows the commander's noncreature-spell text.",
      },
    );
  }

  if (commanderAsksForPlaneswalkers(text)) {
    addProfile(
      "superfriends",
      "planeswalker cards",
      (deckCard) => hasCardType(deckCard.card, "Planeswalker"),
      {
        minimumSupport: 4,
        supportWeight: 0.82,
        supportReason: "Planeswalker cards follow the commander's planeswalker-matters text.",
      },
    );
  }

  if (commanderAsksForLandfallOrLands(text)) {
    addProfile(
      "lands_matter",
      "landfall and land-engine cards",
      (deckCard) => hasCardType(deckCard.card, "Land") || hasLandMattersCardText(deckCard.card),
      {
        minimumSupport: 33,
        supportWeight: 0.18,
        supportReason: "Land count and land-engine cards follow the commander's land-matters text.",
      },
    );
  }

  if (commanderAsksForSagas(text)) {
    addProfile("enchantress", "Saga cards", (deckCard) => cardHasSubtype(deckCard.card, "Saga"), {
      minimumSupport: 4,
      supportWeight: 0.78,
      supportReason: "Saga cards follow the commander's Saga-specific text.",
    });
  }

  if (commanderAsksForRooms(text)) {
    addProfile("enchantress", "Room cards", (deckCard) => cardHasSubtype(deckCard.card, "Room"), {
      minimumSupport: 4,
      supportWeight: 0.78,
      supportReason: "Room cards follow the commander's Room-specific text.",
    });
  }

  if (commanderAsksForHistoric(text)) {
    addProfile(
      "artifacts",
      "historic cards",
      (deckCard) =>
        hasCardType(deckCard.card, "Artifact") ||
        cardHasSubtype(deckCard.card, "Saga") ||
        isLegendaryCard(deckCard.card),
      {
        minimumSupport: 12,
        supportWeight: 0.34,
        supportReason: "Artifacts, Sagas, and legendary cards follow the commander's historic text.",
      },
    );
  }

  if (commanderAsksForLowPowerCreatures(text)) {
    addProfile(
      hasLowPowerRecursionCommanderAsk(text) ? "reanimator" : "power_matter",
      "low-power creature cards",
      (deckCard) => isCreatureWithMaxPower(deckCard.card, 2),
      {
        minimumSupport: 7,
        supportWeight: 0.52,
        supportReason: hasLowPowerRecursionCommanderAsk(text)
          ? "Low-power creatures follow the commander's power-restricted recursion text."
          : "Low-power creatures follow the commander's power-restricted build-around text.",
      },
    );
  }

  return dedupeCommanderBuildAroundProfiles(profiles);
}

function getCommanderPowerMatterProfile(
  commander: ResolvedDeckCard,
  text: string,
): CommanderBuildAroundProfile | null {
  const lowThreshold = extractNumberFromText(text, /\bpower (\d+) or less\b/);
  const highThreshold = extractNumberFromText(text, /\bpower (\d+) or greater\b/);

  if (/\bbase power and toughness 2\/2\b/.test(text)) {
    return {
      key: "power_matter",
      commander,
      label: "2/2 creature cards",
      supportReason: "2/2 bodies follow the commander's base-power-and-toughness text.",
      minimumSupport: 6,
      supportWeight: 0.56,
      matcher: (deckCard) => isCreatureWithExactStats(deckCard.card, 2, 2),
    };
  }

  if (lowThreshold !== null && !hasLowPowerRecursionCommanderAsk(text)) {
    return {
      key: "power_matter",
      commander,
      label: `creatures with power ${lowThreshold} or less`,
      supportReason: `Low-power creatures follow the commander's power-${lowThreshold}-or-less text.`,
      minimumSupport: 7,
      supportWeight: 0.52,
      matcher: (deckCard) => isCreatureWithMaxPower(deckCard.card, lowThreshold),
    };
  }

  if (highThreshold !== null || /\bferocious\b|\btotal power\b|\bgreatest power\b/.test(text)) {
    const minimumPower = highThreshold ?? 4;
    return {
      key: "power_matter",
      commander,
      label: `high-power creature cards`,
      supportReason: "High-power creatures follow the commander's power-scaling text.",
      minimumSupport: 6,
      supportWeight: 0.58,
      matcher: (deckCard) => isCreatureWithMinPower(deckCard.card, minimumPower) || isPowerMatterSupport(deckCard.card),
    };
  }

  if (commanderAsksForPowerMatter(text)) {
    return {
      key: "power_matter",
      commander,
      label: "power-scaling cards",
      supportReason: "Power-scaling creatures and payoffs follow the commander ask.",
      minimumSupport: 5,
      supportWeight: 0.64,
      matcher: (deckCard) => isPowerMatterSupport(deckCard.card),
    };
  }

  return null;
}

function getCommanderManaValueMatterProfile(
  commander: ResolvedDeckCard,
  text: string,
): CommanderBuildAroundProfile | null {
  if (!commanderAsksForManaValue(text)) {
    return null;
  }

  const lowThreshold = extractNumberFromText(text, /\bmana value (\d+) or less\b/);
  const highThreshold = extractNumberFromText(text, /\bmana value (\d+) or greater\b/);

  if (lowThreshold !== null) {
    return {
      key: "mana_value_matter",
      commander,
      label: `spells with mana value ${lowThreshold} or less`,
      supportReason: `Cheap spells follow the commander's mana-value-${lowThreshold}-or-less text.`,
      minimumSupport: 8,
      supportWeight: 0.45,
      matcher: (deckCard) =>
        !hasCardType(deckCard.card, "Land") &&
        (deckCard.card.cmc <= lowThreshold || isManaValueMatterSupport(deckCard.card)),
    };
  }

  if (highThreshold !== null || /\bgreatest mana value\b/.test(text)) {
    const minimumValue = highThreshold ?? 5;
    return {
      key: "mana_value_matter",
      commander,
      label: `spells with high mana value`,
      supportReason: "High-mana-value spells follow the commander's mana-value scaling text.",
      minimumSupport: 6,
      supportWeight: 0.58,
      matcher: (deckCard) =>
        !hasCardType(deckCard.card, "Land") &&
        (deckCard.card.cmc >= minimumValue || isManaValueMatterSupport(deckCard.card)),
    };
  }

  return {
    key: "mana_value_matter",
    commander,
    label: "mana-value-matters cards",
    supportReason: "Mana-value threshold cards follow the commander ask.",
    minimumSupport: 5,
    supportWeight: 0.64,
    matcher: (deckCard) => isManaValueMatterSupport(deckCard.card),
  };
}

function hasToughnessCommanderAsk(text: string) {
  return (
    /\bassigns? combat damage equal to (?:its|their) toughness\b/.test(text) ||
    /\btoughness rather than (?:its|their) power\b/.test(text) ||
    /\bcreatures? you control with defender\b/.test(text) ||
    /\bdefender creatures? you control\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bdefender\b[^.]{0,120}\b(?:draw|create|put|gain|gets?)\b/.test(text)
  );
}

function commanderAsksForTokens(text: string) {
  return (
    /\bcreature tokens? you control\b/.test(text) ||
    /\btokens? you control\b[^.]{0,160}\b(?:get|gets|have|gain|draw|deal|create|add|sacrifice|populate)\b/.test(text) ||
    /\bwhenever\b[^.]{0,160}\btokens?\b[^.]{0,160}\b(?:enters?|dies|is created|attack|deal|deals|draw|create|add)\b/.test(text) ||
    /\bpopulate\b/.test(text) ||
    /\bfor each (?:creature )?token\b/.test(text)
  );
}

function commanderAsksForExtraUpkeep(text: string) {
  return hasExtraUpkeepText(text);
}

function commanderAsksForTapUntap(text: string) {
  return hasTapUntapText(text);
}

function commanderAsksForBlink(text: string) {
  return (
    /\bexile\b[^.]{0,140}\b(?:you control|owner's control)\b[^.]{0,180}\breturn\b/.test(text) ||
    /\breturn\b[^.]{0,140}\bto the battlefield under (?:your|its owner's) control\b/.test(text) ||
    /\bflicker\b/.test(text) ||
    /\benters-the-battlefield\b/.test(text) ||
    /\b(?:when|whenever)\b[^.]{0,120}\benters the battlefield\b[^.]{0,160}\btriggers? an additional time\b/.test(text)
  );
}

function commanderAsksForFaceDown(text: string) {
  return (
    /\bface-down\b/.test(text) ||
    /\bface up\b/.test(text) ||
    /\bturned face up\b/.test(text) ||
    /\bturn\b[^.]{0,80}\bface up\b/.test(text) ||
    /\bmorph\b|\bmegamorph\b|\bmanifest\b|\bcloak\b|\bdisguise\b/.test(text)
  );
}

function hasSmallDamageCommanderAsk(text: string) {
  return (
    /\bsource you control deals exactly 1 damage\b/.test(text) ||
    /\bdeals exactly 1 damage\b[^.]{0,120}\bdeals? \d+ damage\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bdeals 1 damage\b[^.]{0,160}\bdeals? \d+ damage\b/.test(text)
  );
}

function commanderAsksForCounters(text: string) {
  return (
    /\bcounters? on\b/.test(text) ||
    /\bput\b[^.]{0,100}\bcounters?\b/.test(text) ||
    /\bremove\b[^.]{0,100}\bcounters?\b/.test(text) ||
    /\bmove\b[^.]{0,100}\bcounters?\b/.test(text) ||
    /\bproliferate\b/.test(text) ||
    /\bchoose a kind of counter\b/.test(text) ||
    /\bdouble the number of\b[^.]{0,100}\bcounters?\b/.test(text)
  );
}

function commanderAsksForDeathTriggers(text: string) {
  return (
    /\bcreature dying causes a triggered ability\b[^.]{0,180}\btriggers? an additional time\b/.test(text) ||
    /\bcreature dying\b[^.]{0,160}\btriggered ability\b[^.]{0,160}\badditional time\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bcreatures? (?:you control )?die\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bcreatures? (?:you control )?(?:dies|is put into a graveyard)\b/.test(text)
  );
}

function commanderAsksForArtifacts(text: string) {
  return (
    /\bartifact spells? you cast\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bartifacts?\b[^.]{0,120}\b(?:enters?|dies|is put|cast|sacrifice|tap|becomes?)\b/.test(text) ||
    /\bartifacts? you control\b/.test(text) ||
    /\bfor each artifact\b/.test(text)
  );
}

function commanderAsksForVehicles(text: string) {
  return (
    /\bvehicle spells? you cast\b/.test(text) ||
    /\bvehicles? you control\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bvehicles?\b/.test(text) ||
    /\bcrew\b[^.]{0,120}\b(?:vehicle|vehicles)\b/.test(text)
  );
}

function commanderAsksForEnchantments(text: string) {
  return (
    /\benchantment spells? you cast\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\benchantments?\b[^.]{0,120}\b(?:enters?|dies|is put|cast|sacrifice)\b/.test(text) ||
    /\benchantments? you control\b/.test(text) ||
    /\bfor each enchantment\b/.test(text) ||
    /\bconstellation\b/.test(text)
  );
}

function commanderAsksForAuras(text: string) {
  return (
    /\baura spells? you cast\b/.test(text) ||
    /\bauras? you control\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bauras?\b/.test(text) ||
    /\benchanted creatures? you control\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bbecomes? enchanted\b/.test(text)
  );
}

function commanderAsksForEquipment(text: string) {
  return (
    /\bequipment spells? you cast\b/.test(text) ||
    /\bequipment you control\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bequipment\b/.test(text) ||
    /\bequipped creatures? you control\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\bbecomes? equipped\b/.test(text)
  );
}

function commanderAsksForInstantsAndSorceries(text: string) {
  return (
    /\binstant or sorcery spells? you cast\b/.test(text) ||
    /\bwhenever you cast\b[^.]{0,120}\b(?:instant|sorcery)\b/.test(text) ||
    /\bcopy\b[^.]{0,100}\binstant or sorcery\b/.test(text) ||
    /\bmagecraft\b/.test(text)
  );
}

function commanderAsksForNoncreatureSpells(text: string) {
  return (
    /\bnoncreature spells? you cast\b/.test(text) ||
    /\bwhenever you cast\b[^.]{0,120}\bnoncreature spell\b/.test(text) ||
    /\bnoncreature, nonland\b/.test(text)
  );
}

function commanderAsksForPlaneswalkers(text: string) {
  return (
    /\bplaneswalker spells? you cast\b/.test(text) ||
    /\bplaneswalkers? you control\b/.test(text) ||
    /\bloyalty abilities?\b/.test(text) ||
    /\bfor each planeswalker\b/.test(text)
  );
}

function commanderAsksForLandfallOrLands(text: string) {
  return (
    /\blandfall\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\blands?\b[^.]{0,120}\benters? the battlefield\b/.test(text) ||
    /\blands? you control\b/.test(text) ||
    /\bplay an additional land\b/.test(text) ||
    /\bplay lands? from\b/.test(text)
  );
}

function commanderAsksForSagas(text: string) {
  return /\bsaga spells? you cast\b|\bsagas? you control\b|\bwhenever\b[^.]{0,120}\bsagas?\b/.test(text);
}

function commanderAsksForRooms(text: string) {
  return /\broom spells? you cast\b|\brooms? you control\b|\bunlock\b[^.]{0,120}\brooms?\b|\bwhenever\b[^.]{0,120}\brooms?\b/.test(
    text,
  );
}

function commanderAsksForHistoric(text: string) {
  return /\bhistoric spells? you cast\b|\bwhenever you cast\b[^.]{0,120}\bhistoric spell\b|\bhistoric permanent\b/.test(
    text,
  );
}

function commanderAsksForLowPowerCreatures(text: string) {
  return (
    /\bcreature card with power 2 or less\b/.test(text) ||
    /\bcreature cards? with power (?:less than|3 or less|2 or less)\b/.test(text) ||
    /\bcreatures? with power 2 or less\b/.test(text)
  );
}

function hasLowPowerRecursionCommanderAsk(text: string) {
  return commanderAsksForLowPowerCreatures(text) && /\breturn\b[^.]{0,120}\bfrom your graveyard\b/.test(text);
}

function commanderAsksForPowerMatter(text: string) {
  return (
    /\bpower (?:2|3|4|5|6|7|8|9|10) or (?:less|greater)\b/.test(text) ||
    /\bbase power and toughness\b/.test(text) ||
    /\btotal power\b/.test(text) ||
    /\bgreatest power\b/.test(text) ||
    /\bcreatures? you control with power\b/.test(text) ||
    /\bferocious\b/.test(text)
  );
}

function commanderAsksForManaValue(text: string) {
  return (
    /\bmana value (?:\d+|x)\b/.test(text) ||
    /\bwith mana value\b/.test(text) ||
    /\bgreatest mana value\b/.test(text) ||
    /\bspells? with (?:mana value|value)\b/.test(text)
  );
}

function commanderAsksForLegends(text: string) {
  return (
    /\blegendary spells? you cast\b/.test(text) ||
    /\blegendary (?:creatures?|permanents?|cards?) you control\b/.test(text) ||
    /\bwhenever\b[^.]{0,160}\blegendary\b/.test(text) ||
    /\bfor each legendary\b/.test(text)
  );
}

function commanderAsksForDungeons(text: string) {
  return /\bventure into the dungeon\b|\bcompleted? a dungeon\b|\bdungeon card\b|\btake the initiative\b/.test(
    text,
  );
}

function commanderAsksForMadness(text: string) {
  return /\bmadness\b|\bwhenever you discard\b|\bdiscard a card\b[^.]{0,120}\b(?:draw|create|cast|deals?)\b/.test(
    text,
  );
}

function commanderAsksForNinjutsu(text: string) {
  return /\bninjutsu\b|\bcommander ninjutsu\b|\bunblocked attacking creature\b|\bninja(?:s)? you control\b/.test(
    text,
  );
}

function commanderAsksForCurses(text: string) {
  return /\bcurse spells? you cast\b|\bcurses? you control\b|\bwhenever\b[^.]{0,120}\bcurse\b|\benchanted player\b/.test(
    text,
  );
}

function commanderAsksForExileCast(text: string) {
  return /\bwhenever you (?:cast|play)\b[^.]{0,120}\bfrom exile\b|\bcast\b[^.]{0,100}\bfrom exile\b|\bplay\b[^.]{0,100}\bfrom exile\b/.test(
    text,
  );
}

function commanderAsksForFood(text: string) {
  return /\bfood tokens?\b|\bfoods? you control\b|\bcreate\b[^.]{0,120}\bfood\b|\bwhenever\b[^.]{0,120}\bfood\b/.test(
    text,
  );
}

function commanderAsksForClues(text: string) {
  return /\binvestigate\b|\bclue tokens?\b|\bclues? you control\b|\bwhenever\b[^.]{0,120}\bclue\b/.test(
    text,
  );
}

function commanderAsksForEnergy(text: string) {
  return /\benergy counters?\b|\bpay\b[^.]{0,80}\benergy\b|\bget\b[^.]{0,80}\benergy\b|\{e\}/.test(
    text,
  );
}

function commanderAsksForTreasure(text: string) {
  return /\btreasure tokens?\b|\btreasures? you control\b|\bcreate\b[^.]{0,120}\btreasure\b|\bwhenever\b[^.]{0,160}\btreasure\b/.test(
    text,
  );
}

function commanderAsksForDice(text: string) {
  return /\broll(?:s|ed|ing)?\b[^.]{0,120}\b(?:die|dice|d\d+)\b|\bwhenever you roll\b|\bif you would roll\b|\bd20\b|\bd12\b|\bd10\b|\bd8\b|\bd6\b|\bd4\b/.test(
    text,
  );
}

function commanderAsksForCoinFlip(text: string) {
  return /\bflip(?:s|ped|ping)?\b[^.]{0,90}\bcoins?\b|\bcoin flips?\b|\bwhenever you flip\b|\bif you would flip\b|\bwin(?:s|ning)? a flip\b/.test(
    text,
  );
}

function commanderAsksForMonarch(text: string) {
  return /\bmonarch\b|\bbecome the monarch\b|\bthe monarch\b/.test(text);
}

function commanderAsksForTheft(text: string) {
  return /\bgain control of\b|\byou control but don't own\b|\bopponents?'? cards?\b|\btop card of (?:their|that player's|an opponent's) library\b|\bfrom (?:an|your) opponents?'? (?:library|graveyard|hand|exile)\b/.test(
    text,
  );
}

function commanderAsksForGoad(text: string) {
  return /\bgoad\b|\bgoaded\b|\battacks a player other than you if able\b|\bcreatures? your opponents control attack\b/.test(
    text,
  );
}

function commanderAsksForShrines(text: string) {
  return /\bshrines? you control\b|\bfor each shrine\b|\bshrine enchantment\b|\bwhenever\b[^.]{0,120}\bshrine\b/.test(
    text,
  );
}

function commanderAsksForCycling(text: string) {
  return /\bcycling\b|\bwhenever you cycle\b|\bcycle (?:a|another|one or more)? ?cards?\b/.test(text);
}

function commanderAsksForMutate(text: string) {
  return /\bmutate\b|\bmutates?\b|\bmerged creatures?\b|\bwhenever\b[^.]{0,120}\bmutates?\b/.test(text);
}

function commanderAsksForPoison(text: string) {
  return /\bpoison counters?\b|\bcorrupted\b|\binfect\b|\btoxic\b/.test(text);
}

function commanderAsksForBattles(text: string) {
  return /\bbattle spells? you cast\b|\bbattles? you control\b|\bdefense counters?\b|\bdefeated? a battle\b|\bwhenever\b[^.]{0,140}\bbattles?\b/.test(
    text,
  );
}

function commanderAsksForPillowfort(text: string) {
  return /\bcreatures? can't attack you\b|\bcan't attack unless\b|\bmay attack only\b|\bcan attack only\b|\battacking you costs\b|\bprevent all (?:combat )?damage\b/.test(
    text,
  );
}

function commanderAsksForCopyClone(text: string) {
  return /\bcopy target\b|\bcopy (?:that|the|a) (?:spell|permanent|creature|artifact|enchantment|instant|sorcery|ability)\b|\btoken that's? a copy\b|\benters the battlefield as a copy\b|\bbecomes? a copy\b/.test(
    text,
  );
}

function commanderAsksForStax(text: string) {
  return hasStaxText(text);
}

function commanderAsksForGroupHug(text: string) {
  return hasGroupHugText(text);
}

function commanderAsksForGroupSlug(text: string) {
  return hasGroupSlugText(text);
}

function commanderAsksForLifegain(text: string) {
  return hasLifegainText(text, []);
}

function commanderAsksForMill(text: string) {
  return hasMillText(text, []) || hasSelfMillText(text);
}

function dedupeCommanderBuildAroundProfiles(profiles: CommanderBuildAroundProfile[]) {
  const seen = new Set<string>();
  const deduped: CommanderBuildAroundProfile[] = [];

  for (const profile of profiles) {
    const key = `${profile.key}:${profile.label}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(profile);
  }

  return deduped;
}

function isToughnessMatterSupport(card: ScryfallCard) {
  return (
    hasHighToughnessCreatureStats(card) ||
    getStrategySegments(card).some((segment) => hasToughnessMatterText(segment.text, card))
  );
}

function isTokenSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasTokenText(segment.text));
}

function isExtraUpkeepSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasExtraUpkeepText(segment.text));
}

function isTapUntapSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasTapUntapText(segment.text));
}

function isBlinkSupport(card: ScryfallCard) {
  return getStrategySegments(card).some(
    (segment) => hasBlinkText(segment.text) || hasEtbPayoffText(segment.text),
  );
}

function isFaceDownSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasFaceDownText(segment.text, card.keywords));
}

function isCounterSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasCounterText(segment.text, card.keywords));
}

function isDungeonSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasDungeonText(segment.text, card.keywords));
}

function isMadnessSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasMadnessText(segment.text, card.keywords));
}

function isNinjutsuSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) =>
    hasNinjutsuText(segment.text, card.keywords, card),
  );
}

function isCurseSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasCurseText(segment.text, card));
}

function isExileCastSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasExileCastText(segment.text, card.keywords));
}

function isFoodSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasFoodText(segment.text));
}

function isClueSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasClueText(segment.text, card.keywords));
}

function isEnergySupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasEnergyText(segment.text));
}

function isTreasureSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasTreasureText(segment.text));
}

function isDiceRollSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasDiceRollText(segment.text));
}

function isCoinFlipSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasCoinFlipText(segment.text));
}

function isSagaSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasSagaText(segment.text, card));
}

function isMonarchSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasMonarchText(segment.text));
}

function isTheftSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasTheftText(segment.text));
}

function isGoadSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasGoadText(segment.text));
}

function isShrineSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasShrineText(segment.text, card));
}

function isCyclingSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasCyclingText(segment.text, card.keywords));
}

function isMutateSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasMutateText(segment.text, card.keywords));
}

function isPoisonSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasPoisonText(segment.text, card.keywords));
}

function isBattleSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasBattleText(segment.text, card));
}

function isPillowfortSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasPillowfortText(segment.text));
}

function isCopyCloneSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasCopyCloneText(segment.text));
}

function isStaxSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasStaxText(segment.text));
}

function isGroupHugSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasGroupHugText(segment.text));
}

function isGroupSlugSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasGroupSlugText(segment.text));
}

function isLifegainSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasLifegainText(segment.text, card.keywords));
}

function isMillSupport(card: ScryfallCard) {
  return getStrategySegments(card).some(
    (segment) => hasMillText(segment.text, card.keywords) || hasSelfMillText(segment.text),
  );
}

function isPowerMatterSupport(card: ScryfallCard) {
  return (
    isCreatureWithMinPower(card, 4) ||
    getStrategySegments(card).some((segment) => hasPowerMatterText(segment.text, card))
  );
}

function isManaValueMatterSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasManaValueMatterText(segment.text));
}

function isLegendarySupport(card: ScryfallCard) {
  return isLegendaryCard(card) || getStrategySegments(card).some((segment) => hasLegendsMatterText(segment.text, card));
}

function isSmallDamageSupport(card: ScryfallCard) {
  return getStrategySegments(card).some((segment) => hasSmallDamageText(segment.text));
}

function extractCommanderRequestedCreatureTypes(
  text: string,
  creatureTypeCounts: Map<string, number>,
) {
  const requestedTypes = new Set<string>();

  for (const [type, count] of creatureTypeCounts) {
    if (count < 5 || type.length < 3) {
      continue;
    }

    const escapedType = escapeRegex(type);
    const typePattern = new RegExp(
      `\\b(?:another |a |an |one or more |each |other )?${escapedType}s?\\b[^.]{0,90}\\b(?:you control|spell|spells|card|cards|creature|creatures|attack|attacks|deal|deals|enter|enters|dies|draw|create|costs?)\\b|\\b(?:whenever|if|as)\\b[^.]{0,80}\\b${escapedType}s?\\b`,
    );

    if (typePattern.test(text)) {
      requestedTypes.add(type);
    }
  }

  return [...requestedTypes].slice(0, 2);
}

function applyCommanderThemeAdjustments(
  totals: Record<StrategyKey, number>,
  supportBuckets: Map<StrategyKey, Map<string, StrategySupportCard>>,
  reasons: Map<StrategyKey, Map<string, number>>,
) {
  for (const key of Object.keys(STRATEGY_LABELS) as StrategyKey[]) {
    const bucket = supportBuckets.get(key);
    if (!bucket) {
      continue;
    }

    const supportCards = [...bucket.values()];
    const commanderSupport = supportCards.filter((card) => card.section === "commander");
    if (commanderSupport.length === 0) {
      continue;
    }

    const commanderWeight = commanderSupport.reduce((sum, card) => sum + card.weight, 0);
    const mainboardSupportCards = supportCards.filter((card) => card.section === "mainboard");
    const mainboardSupportCount = mainboardSupportCards.reduce(
      (sum, card) => sum + card.quantity,
      0,
    );
    const mainboardSupportWeight = mainboardSupportCards.reduce(
      (sum, card) => sum + card.weight,
      0,
    );
    const minimumSupport = getCommanderThemeSupportMinimum(key);

    if (commanderWeight < 1.45 || mainboardSupportCount < minimumSupport) {
      continue;
    }

    const supportRatio = Math.min(1.6, mainboardSupportCount / Math.max(minimumSupport, 1));
    const weightRatio = Math.min(1.4, mainboardSupportWeight / Math.max(minimumSupport * 0.55, 1));
    const bonus = roundTo(Math.min(3.2, 0.75 + commanderWeight * 0.34 + supportRatio * 0.72 + weightRatio * 0.42), 2);
    const commanderNames = commanderSupport.map((card) => card.name).join(" + ");

    addStrategyBonus(
      totals,
      reasons,
      key,
      bonus,
      `${commanderNames} explicitly points toward ${STRATEGY_LABELS[key]}, and ${mainboardSupportCount} cards in the 99 reinforce that command-zone theme.`,
    );
  }
}

function getCommanderThemeSupportMinimum(key: StrategyKey) {
  switch (key) {
    case "combo":
    case "dice_rolls":
    case "coin_flip":
    case "extra_combat":
    case "extra_upkeep":
      return 3;
    case "face_down":
    case "dungeons":
    case "madness":
    case "ninjutsu":
    case "curses":
    case "exile_cast":
    case "food":
    case "clues":
    case "energy":
    case "sagas":
    case "monarch":
    case "theft":
    case "goad":
    case "shrines":
    case "cycling":
    case "mutate":
    case "poison":
    case "battles":
    case "pillowfort":
    case "copy_clone":
    case "power_matter":
    case "mana_value_matter":
    case "x_spells":
    case "legends_matter":
    case "toughness_matter":
    case "pingers":
    case "voltron":
    case "stax":
    case "mill":
    case "tap_untap":
      return 4;
    case "superfriends":
    case "group_hug":
    case "group_slug":
    case "lifegain":
    case "treasure":
      return 5;
    case "kindred":
    case "spellslinger":
    case "artifacts":
    case "aggro":
      return 8;
    default:
      return 6;
  }
}

function addStrategyBonus(
  totals: Record<StrategyKey, number>,
  reasons: Map<StrategyKey, Map<string, number>>,
  key: StrategyKey,
  amount: number,
  reason: string,
) {
  totals[key] += roundTo(amount, 2);
  trackReason(reasons, key, reason, amount);
}

function trackKeyCard(
  keyCards: Map<StrategyKey, Map<string, number>>,
  key: StrategyKey,
  label: string,
  amount: number,
) {
  const bucket = getOrCreateBucket(keyCards, key);
  bucket.set(label, roundTo((bucket.get(label) ?? 0) + amount, 2));
}

function trackReason(
  reasons: Map<StrategyKey, Map<string, number>>,
  key: StrategyKey,
  label: string,
  amount: number,
) {
  const bucket = getOrCreateBucket(reasons, key);
  bucket.set(label, roundTo((bucket.get(label) ?? 0) + amount, 2));
}

function getOrCreateBucket(
  store: Map<StrategyKey, Map<string, number>>,
  key: StrategyKey,
) {
  const existing = store.get(key);

  if (existing) {
    return existing;
  }

  const created = new Map<string, number>();
  store.set(key, created);
  return created;
}

function getTopLabels(bucket: Map<string, number> | undefined, count: number) {
  if (!bucket) {
    return [];
  }

  return [...bucket.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, count)
    .map(([label]) => label);
}

function createStrategyTotals() {
  return {
    combo: 0,
    spellslinger: 0,
    artifacts: 0,
    enchantress: 0,
    superfriends: 0,
    reanimator: 0,
    lands_matter: 0,
    tokens: 0,
    aristocrats: 0,
    blink: 0,
    face_down: 0,
    dungeons: 0,
    madness: 0,
    ninjutsu: 0,
    curses: 0,
    exile_cast: 0,
    food: 0,
    clues: 0,
    energy: 0,
    sagas: 0,
    monarch: 0,
    theft: 0,
    goad: 0,
    shrines: 0,
    cycling: 0,
    mutate: 0,
    poison: 0,
    battles: 0,
    pillowfort: 0,
    copy_clone: 0,
    power_matter: 0,
    mana_value_matter: 0,
    x_spells: 0,
    legends_matter: 0,
    toughness_matter: 0,
    pingers: 0,
    counters: 0,
    voltron: 0,
    extra_combat: 0,
    extra_upkeep: 0,
    tap_untap: 0,
    dice_rolls: 0,
    coin_flip: 0,
    treasure: 0,
    kindred: 0,
    stax: 0,
    control: 0,
    group_hug: 0,
    group_slug: 0,
    lifegain: 0,
    mill: 0,
    aggro: 0,
  } satisfies Record<StrategyKey, number>;
}

function createStrategySupportBuckets() {
  return new Map<StrategyKey, Map<string, StrategySupportCard>>();
}

function trackStrategySupportCard(
  supportBuckets: Map<StrategyKey, Map<string, StrategySupportCard>>,
  key: StrategyKey,
  deckCard: ResolvedDeckCard,
  amount: number,
  reason: string,
) {
  let bucket = supportBuckets.get(key);
  if (!bucket) {
    bucket = new Map<string, StrategySupportCard>();
    supportBuckets.set(key, bucket);
  }

  const lookupKey = `${deckCard.section}:${normalizeText(deckCard.card.name)}`;
  const existing = bucket.get(lookupKey);

  if (!existing) {
    bucket.set(lookupKey, {
      name: deckCard.card.name,
      section: deckCard.section,
      quantity: deckCard.quantity,
      weight: roundTo(amount, 2),
      reasons: [reason],
    });
    return;
  }

  existing.weight = roundTo(existing.weight + amount, 2);
  if (!existing.reasons.includes(reason)) {
    existing.reasons.push(reason);
  }
}

function buildStrategySynergyFindings(input: {
  mainStrategy: DeckStrategyEntry;
  supportCount: number;
  coreCount: number;
  focusRatio: number;
  commanderAligned: boolean;
  finisherAligned: boolean;
  recommendation: { support: number; core: number };
  commanderProfile?: DeckCommanderProfile | null;
}) {
  const findings = [];

  if (
    input.commanderProfile &&
    input.commanderProfile.supportCount < input.commanderProfile.supportTarget
  ) {
    findings.push({
      code: "strategy_commander_profile_gap",
      title: "Commander package is underbuilt",
      status:
        input.commanderProfile.supportCount < input.commanderProfile.supportTarget * 0.6
          ? ("risk" as const)
          : ("warning" as const),
      message: `${input.commanderProfile.commanderName} asks for ${input.commanderProfile.label}, but only ${input.commanderProfile.supportCount}/${input.commanderProfile.supportTarget} support cards are present.`,
    });
  } else if (input.commanderProfile) {
    findings.push({
      code: "strategy_commander_profile_good",
      title: "Commander package is supported",
      status: "good" as const,
      message: `${input.commanderProfile.commanderName}'s ${input.commanderProfile.label} is backed by ${input.commanderProfile.supportCount}/${input.commanderProfile.supportTarget} support cards.`,
    });
  }

  if (input.supportCount < input.recommendation.support * 0.6) {
    findings.push({
      code: "strategy_support_low",
      title: "Support density is thin",
      status: "risk" as const,
      message: `${input.supportCount} cards currently support ${input.mainStrategy.label}, which is well below the rough target of ${input.recommendation.support}.`,
    });
  } else if (input.supportCount < input.recommendation.support) {
    findings.push({
      code: "strategy_support_light",
      title: "Support package is a little light",
      status: "warning" as const,
      message: `${input.supportCount} cards support ${input.mainStrategy.label}. The shell is on theme, but it still wants a few more dedicated support slots.`,
    });
  } else {
    findings.push({
      code: "strategy_support_good",
      title: "Support density looks healthy",
      status: "good" as const,
      message: `${input.supportCount} cards support ${input.mainStrategy.label}, which is enough for the plan to show up consistently.`,
    });
  }

  if (input.coreCount < input.recommendation.core * 0.5) {
    findings.push({
      code: "strategy_core_low",
      title: "Too few core pieces",
      status: "warning" as const,
      message: `Only ${input.coreCount} cards read as true core pieces for ${input.mainStrategy.label}. The theme is present, but many of the payoffs are still light or generic.`,
    });
  } else if (input.coreCount >= input.recommendation.core) {
    findings.push({
      code: "strategy_core_good",
      title: "Core pieces are in place",
      status: "good" as const,
      message: `${input.coreCount} cards act as real core pieces for ${input.mainStrategy.label}, so the shell is not relying only on generic good-stuff support.`,
    });
  }

  if (!input.commanderAligned) {
    findings.push({
      code: "strategy_commander_light",
      title: "Commander is only a light fit",
      status: "note" as const,
      message: `The commander does not strongly reinforce ${input.mainStrategy.label} on its own, so the deck is leaning more on the 99 for identity.`,
    });
  } else {
    findings.push({
      code: "strategy_commander_fit",
      title: "Commander fits the main plan",
      status: "good" as const,
      message: `The commander actively supports ${input.mainStrategy.label}, which helps the deck express the plan more reliably.`,
    });
  }

  if (input.focusRatio < 0.5) {
    findings.push({
      code: "strategy_focus_split",
      title: "Theme focus is split",
      status: "warning" as const,
      message: `A lot of card slots are being pulled toward side themes, so ${input.mainStrategy.label} may feel less cohesive in actual games.`,
    });
  } else if (input.focusRatio >= 0.66) {
    findings.push({
      code: "strategy_focus_good",
      title: "Theme focus is clean",
      status: "good" as const,
      message: `${input.mainStrategy.label} is clearly ahead of the side themes, so the shell reads as focused rather than scattered.`,
    });
  }

  if (!input.finisherAligned) {
    findings.push({
      code: "strategy_finishers_misaligned",
      title: "Finishers are not fully aligned yet",
      status: "note" as const,
      message: `The current win conditions do not line up cleanly with ${input.mainStrategy.label}, so the deck may still close games in a different way than it sets up.`,
    });
  }

  return findings;
}

function getStrategyCommanderProfile(context: StrategyContext, key: StrategyKey) {
  return context.commanderProfiles
    .filter((profile) => profile.key === key)
    .sort(
      (left, right) =>
        right.confidence - left.confidence ||
        right.supportCount / Math.max(right.supportTarget, 1) -
          left.supportCount / Math.max(left.supportTarget, 1),
    )[0] ?? null;
}

function isStrategyAlignedToFinishers(
  key: StrategyKey,
  winConditions: DeckWinConditionAnalysis,
) {
  if (key === "combo") {
    return winConditions.combos.exactCount > 0 || winConditions.counts.combo >= 0.8;
  }

  if (
    [
      "extra_combat",
      "aggro",
      "voltron",
      "kindred",
      "tokens",
      "face_down",
      "ninjutsu",
      "toughness_matter",
    ].includes(key)
  ) {
    return winConditions.counts.combat >= 1.4 || winConditions.counts.repeatable >= 1;
  }

  if (
    [
      "aristocrats",
      "group_slug",
      "lifegain",
      "treasure",
      "pingers",
      "curses",
      "food",
      "goad",
      "poison",
    ].includes(key)
  ) {
    return winConditions.counts.direct >= 1 || winConditions.counts.repeatable >= 1.1;
  }

  if (
    [
      "dungeons",
      "madness",
      "exile_cast",
      "clues",
      "energy",
      "sagas",
      "monarch",
      "theft",
      "shrines",
      "cycling",
      "mutate",
      "battles",
      "pillowfort",
      "copy_clone",
      "power_matter",
      "mana_value_matter",
      "legends_matter",
    ].includes(key)
  ) {
    return (
      winConditions.counts.repeatable >= 1 ||
      winConditions.counts.core >= 1 ||
      winConditions.counts.combat >= 1
    );
  }

  if (key === "superfriends") {
    return winConditions.counts.repeatable >= 1 || winConditions.counts.direct >= 0.8;
  }

  if (key === "group_hug") {
    return winConditions.counts.core >= 1.2 || winConditions.counts.alternate >= 1;
  }

  if (key === "mill") {
    return (
      winConditions.counts.alternate >= 1 ||
      winConditions.counts.direct >= 1 ||
      winConditions.combos.exactCount > 0
    );
  }

  return winConditions.counts.core >= 1.8 || winConditions.combos.exactCount > 0;
}

function getCounterProfile(cards: ResolvedDeckCard[]) {
  const typeCounts = new Map<string, number>();
  let proliferateCount = 0;

  for (const card of cards) {
    for (const segment of getStrategySegments(card.card)) {
      if (!segment.text) {
        continue;
      }

      if (/\bproliferate\b/.test(segment.text) || card.card.keywords.includes("Proliferate")) {
        proliferateCount += card.quantity;
      }

      for (const counterType of extractCounterTypes(segment.text)) {
        typeCounts.set(counterType, (typeCounts.get(counterType) ?? 0) + card.quantity);
      }
    }
  }

  const totalTypedCounterSignals = [...typeCounts.values()].reduce((sum, count) => sum + count, 0);
  const [dominantType, dominantCount = 0] =
    [...typeCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] ??
    [];
  const dominantRatio =
    dominantType && totalTypedCounterSignals > 0 ? dominantCount / totalTypedCounterSignals : 0;

  if (dominantType && (dominantCount >= 3 || dominantRatio >= 0.55)) {
    return {
      dominantType,
      dominantCount,
      dominantRatio: roundTo(dominantRatio, 2),
      proliferateCount,
    };
  }

  if (proliferateCount >= 4) {
    return {
      dominantType: "proliferate",
      dominantCount: proliferateCount,
      dominantRatio: 1,
      proliferateCount,
    };
  }

  return {
    dominantType: null,
    dominantCount: 0,
    dominantRatio: 0,
    proliferateCount,
  };
}

function getDominantCreatureType(cards: ResolvedDeckCard[]) {
  const typeCounts = getCreatureTypeCounts(cards);
  let creatureTotal = 0;

  for (const card of cards) {
    if (!hasCardType(card.card, "Creature")) {
      continue;
    }

    const types = getCreatureTypes(card.card);
    if (types.length === 0) {
      continue;
    }

    creatureTotal += card.quantity;
    for (const type of types) {
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + card.quantity);
    }
  }

  if (creatureTotal === 0 || typeCounts.size === 0) {
    return null;
  }

  const [type, count] =
    [...typeCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0] ??
    [];

  if (!type || !count) {
    return null;
  }

  return { type, count };
}

function getCreatureTypeCounts(cards: ResolvedDeckCard[]) {
  const typeCounts = new Map<string, number>();

  for (const card of cards) {
    if (!hasCardType(card.card, "Creature")) {
      continue;
    }

    for (const type of getCreatureTypes(card.card)) {
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + card.quantity);
    }
  }

  return typeCounts;
}

function getCreatureTypes(card: ScryfallCard) {
  const typeSet = new Set<string>();

  for (const typeLine of getTypeLines(card)) {
    if (!typeLine.includes("Creature")) {
      continue;
    }

    const [, subtypes = ""] = typeLine.split(/(?:\s+—\s+|\s+-\s+)/);
    if (!subtypes) {
      continue;
    }

    for (const type of subtypes.split(/\s+/)) {
      const normalized = type.toLowerCase().trim();
      if (!normalized) {
        continue;
      }
      typeSet.add(normalized);
    }
  }

  return [...typeSet];
}

function getTypeLines(card: ScryfallCard) {
  const typeLines = [card.type_line];
  for (const face of card.card_faces ?? []) {
    if (face.type_line) {
      typeLines.push(face.type_line);
    }
  }
  return typeLines;
}

function cardHasCreatureType(card: ScryfallCard | undefined, type: string) {
  if (!card) {
    return false;
  }

  return getCreatureTypes(card).includes(type.toLowerCase());
}

function cardHasSubtype(card: ScryfallCard | undefined, subtype: string) {
  if (!card) {
    return false;
  }

  const normalizedSubtype = subtype.toLowerCase();
  return getTypeLines(card).some((typeLine) => typeLine.toLowerCase().includes(normalizedSubtype));
}

function isLegendaryCard(card: ScryfallCard) {
  return getTypeLines(card).some((typeLine) => /\blegendary\b/i.test(typeLine));
}

function isCreatureWithMaxPower(card: ScryfallCard, maxPower: number) {
  if (!hasCardType(card, "Creature")) {
    return false;
  }

  const statLines = [
    { power: card.power },
    ...(card.card_faces ?? []).map((face) => ({ power: face.power })),
  ];

  return statLines.some(({ power }) => {
    const numericPower = parsePowerToughnessValue(power);
    return numericPower !== null && numericPower <= maxPower;
  });
}

function isCreatureWithMinPower(card: ScryfallCard, minPower: number) {
  if (!hasCardType(card, "Creature")) {
    return false;
  }

  const statLines = [
    { power: card.power },
    ...(card.card_faces ?? []).map((face) => ({ power: face.power })),
  ];

  return statLines.some(({ power }) => {
    const numericPower = parsePowerToughnessValue(power);
    return numericPower !== null && numericPower >= minPower;
  });
}

function isCreatureWithExactStats(card: ScryfallCard, power: number, toughness: number) {
  if (!hasCardType(card, "Creature")) {
    return false;
  }

  const statLines = [
    { power: card.power, toughness: card.toughness },
    ...(card.card_faces ?? []).map((face) => ({ power: face.power, toughness: face.toughness })),
  ];

  return statLines.some((stats) => {
    const numericPower = parsePowerToughnessValue(stats.power);
    const numericToughness = parsePowerToughnessValue(stats.toughness);
    return numericPower === power && numericToughness === toughness;
  });
}

function hasHighToughnessCreatureStats(card?: ScryfallCard) {
  if (!card || !hasCardType(card, "Creature")) {
    return false;
  }

  const statLines = [
    { power: card.power, toughness: card.toughness },
    ...(card.card_faces ?? []).map((face) => ({ power: face.power, toughness: face.toughness })),
  ];

  return statLines.some(({ power, toughness }) => {
    const numericPower = parsePowerToughnessValue(power);
    const numericToughness = parsePowerToughnessValue(toughness);

    return numericToughness !== null && numericToughness >= 4 && numericToughness >= (numericPower ?? 0) + 2;
  });
}

function parsePowerToughnessValue(value?: string) {
  if (!value || !/^-?\d+$/.test(value)) {
    return null;
  }

  return Number(value);
}

function extractNumberFromText(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  if (!match?.[1]) {
    return null;
  }

  return Number(match[1]);
}

function sumMatchingCards(
  cards: ResolvedDeckCard[],
  matcher: (card: ResolvedDeckCard) => boolean,
) {
  return cards.reduce((sum, card) => sum + (matcher(card) ? card.quantity : 0), 0);
}

function hasCardType(card: ScryfallCard | undefined, typeName: string) {
  if (!card) {
    return false;
  }

  if (card.type_line.includes(typeName)) {
    return true;
  }

  return card.card_faces?.some((face) => face.type_line?.includes(typeName)) ?? false;
}

function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasSelfMillText(text: string) {
  return (
    /\bsurveil\b/.test(text) ||
    /\bdiscard\b/.test(text) ||
    /\bput the top\b[^.]{0,120}\bof your library\b[^.]{0,120}\binto your graveyard\b/.test(text) ||
    /\bfrom your library\b[^.]{0,120}\binto your graveyard\b/.test(text) ||
    (/\bmill(?:s)?\b/.test(text) && !hasOpponentMillText(text))
  );
}

function hasOpponentMillText(text: string) {
  return (
    /\b(?:target player|target opponent|each player|each opponent|an opponent|opponents?)\b[^.]{0,140}\bmills?\b/.test(
      text,
    ) ||
    /\b(?:that player|that opponent)\b[^.]{0,80}\bmills?\b/.test(text) ||
    /\bput the top\b[^.]{0,140}\bof target player's library\b[^.]{0,140}\binto\b[^.]{0,80}\bgraveyard\b/.test(
      text,
    ) ||
    /\bput the top\b[^.]{0,140}\bof each opponent's library\b[^.]{0,140}\binto\b[^.]{0,80}\bgraveyard\b/.test(
      text,
    ) ||
    /\bfrom each opponent's library\b/.test(text) ||
    /\bfrom target player's library\b/.test(text) ||
    /\binto an opponent's graveyard from their library\b/.test(text) ||
    /\binto target player's graveyard from their library\b/.test(text)
  );
}

function extractCounterTypes(text: string) {
  const counterTypes = new Set<string>();
  const matches = text.matchAll(/\b([a-z0-9+/,'-]+(?: [a-z0-9+/,'-]+)?) counters?\b/g);

  for (const match of matches) {
    const counterType = normalizeCounterType(match[1] ?? "");
    if (counterType) {
      counterTypes.add(counterType);
    }
  }

  return [...counterTypes];
}

function normalizeCounterType(value: string) {
  const normalized = value.trim().toLowerCase().replace(/^(a|an)\s+/, "");

  if (!normalized || COUNTER_TYPE_BLACKLIST.has(normalized)) {
    return null;
  }

  return normalized;
}

function formatCreatureType(type: string) {
  return type
    .split("-")
    .map((part) => toTitleCase(part))
    .join("-");
}

function formatCounterType(type: string) {
  if (type === "+1/+1" || type === "-1/-1") {
    return type;
  }

  return type
    .split(/\s+/)
    .map((part) => toTitleCase(part))
    .join(" ");
}

function toTitleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
