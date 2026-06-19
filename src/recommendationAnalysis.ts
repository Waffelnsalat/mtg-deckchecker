import { getCommanderColorProfile } from "./commanderColorProfile";
import {
  EdhrecCommanderCard,
  EdhrecCommanderInsights,
  lookupCommanderEdhrecInsights,
} from "./edhrec";
import {
  RecommanderCardRecommendation,
  RecommanderInsights,
  lookupRecommanderRecommendations,
} from "./recommander";
import {
  getRoleWeight,
  inferAdvancedRoleProfile,
} from "./advancedCardScan";
import { mapWithConcurrency } from "./asyncUtils";
import {
  DeckBracketAnalysis,
  DeckBracketNumber,
  DeckCommanderAnalysis,
  DeckConsistencyAnalysis,
  DeckDrawAnalysis,
  DeckLandBaseAnalysis,
  DeckProtectionAnalysis,
  DeckRampAnalysis,
  DeckRecommendationAnalysis,
  DeckRecommendationCard,
  DeckRecommendationDirection,
  DeckRecommendationTopic,
  DeckRecommendationTopicEntry,
  DeckRecursionAnalysis,
  DeckRemovalAnalysis,
  DeckResolutionDocument,
  DeckSpellInteractionAnalysis,
  DeckStrategyAnalysis,
  DeckWinConditionAnalysis,
  DeckWinStrategyAnalysis,
  ResolvedDeckCard,
  ScryfallCard,
  StrategyKey,
  WinStrategyKey,
} from "./types";

interface AnalyzeDeckRecommendationsInput {
  document: DeckResolutionDocument;
  edhrec?: EdhrecCommanderInsights | null;
  recommander?: RecommanderInsights | null;
  commander: DeckCommanderAnalysis;
  bracket: DeckBracketAnalysis;
  strategy: DeckStrategyAnalysis;
  winStrategy: DeckWinStrategyAnalysis;
  structure: {
    structureScore: number;
    counts: {
      lands: number;
      creatures: number;
    };
    mana: {
      recommendedLands: {
        min: number;
        max: number;
      };
    };
  };
  landBase: DeckLandBaseAnalysis;
  ramp: DeckRampAnalysis;
  draw: DeckDrawAnalysis;
  consistency: DeckConsistencyAnalysis;
  protection: DeckProtectionAnalysis;
  recursion: DeckRecursionAnalysis;
  winConditions: DeckWinConditionAnalysis;
  removal: DeckRemovalAnalysis;
  spellInteraction: DeckSpellInteractionAnalysis;
}

interface RecommendationContext extends AnalyzeDeckRecommendationsInput {
  targetBracket: DeckBracketNumber;
  deckCards: ResolvedDeckCard[];
  mainboardCards: ResolvedDeckCard[];
  mainboardLands: ResolvedDeckCard[];
  efficiency: Record<EfficiencyTopic, TopicEfficiencyProfile>;
  normalizedDeckNames: Set<string>;
  usedSuggestionNames: Set<string>;
  colorProfile: ReturnType<typeof getCommanderColorProfile>;
  edhrec: EdhrecCommanderInsights | null;
  recommander: RecommanderInsights | null;
  recommanderTopicLibraries: Map<DeckRecommendationTopic, RecommendationLibraryEntry[]>;
}

interface RecommendationLibraryEntry {
  name: string;
  idealBracket: DeckBracketNumber;
  reason: string;
  source?: "library" | "recommander";
  oracleId?: string | null;
  recommanderScore?: number;
  recommanderRank?: number;
  priority?: number;
  topicHints?: DeckRecommendationTopic[];
  requiredColors?: string[];
  multicolorOnly?: boolean;
  monoColorOnly?: boolean;
  allowDuplicates?: boolean;
  strategyKeys?: StrategyKey[];
  winPlanKeys?: WinStrategyKey[];
  predicate?: (context: RecommendationContext) => boolean;
}

type EfficiencyTopic = "ramp" | "card_flow" | "consistency" | "interaction";

interface TopicEfficiencyProfile {
  value: number;
  slots: number;
  efficiency: number;
  target: number;
  gap: number;
}

const BASIC_LANDS = ["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"] as const;

const TOPIC_ORDER: Array<{ key: DeckRecommendationTopic; label: string }> = [
  { key: "shell", label: "Shell" },
  { key: "land_base", label: "Land Base" },
  { key: "ramp", label: "Ramp" },
  { key: "card_flow", label: "Card Flow" },
  { key: "consistency", label: "Consistency" },
  { key: "interaction", label: "Interaction" },
  { key: "resilience", label: "Resilience" },
  { key: "closing", label: "Closing" },
];

const TOPIC_FLOORS: Record<DeckRecommendationTopic, Record<DeckBracketNumber, number>> = {
  shell: { 1: 48, 2: 58, 3: 68, 4: 78, 5: 86 },
  land_base: { 1: 46, 2: 57, 3: 67, 4: 78, 5: 86 },
  ramp: { 1: 40, 2: 52, 3: 64, 4: 76, 5: 86 },
  card_flow: { 1: 40, 2: 52, 3: 64, 4: 74, 5: 84 },
  consistency: { 1: 18, 2: 30, 3: 44, 4: 62, 5: 76 },
  interaction: { 1: 28, 2: 42, 3: 56, 4: 70, 5: 82 },
  resilience: { 1: 24, 2: 36, 3: 48, 4: 60, 5: 72 },
  closing: { 1: 38, 2: 52, 3: 64, 4: 76, 5: 86 },
};

const TOPIC_CEILINGS: Record<DeckRecommendationTopic, Record<DeckBracketNumber, number>> = {
  shell: { 1: 70, 2: 78, 3: 86, 4: 94, 5: 100 },
  land_base: { 1: 68, 2: 76, 3: 86, 4: 94, 5: 100 },
  ramp: { 1: 62, 2: 72, 3: 84, 4: 94, 5: 100 },
  card_flow: { 1: 62, 2: 72, 3: 84, 4: 94, 5: 100 },
  consistency: { 1: 34, 2: 48, 3: 66, 4: 84, 5: 100 },
  interaction: { 1: 46, 2: 60, 3: 74, 4: 88, 5: 100 },
  resilience: { 1: 42, 2: 56, 3: 70, 4: 84, 5: 100 },
  closing: { 1: 54, 2: 68, 3: 80, 4: 92, 5: 100 },
};

const EFFICIENCY_TARGETS: Record<EfficiencyTopic, Record<DeckBracketNumber, number>> = {
  ramp: { 1: 0.42, 2: 0.54, 3: 0.68, 4: 0.86, 5: 1.05 },
  card_flow: { 1: 0.4, 2: 0.52, 3: 0.66, 4: 0.82, 5: 0.98 },
  consistency: { 1: 0.28, 2: 0.42, 3: 0.58, 4: 0.78, 5: 0.98 },
  interaction: { 1: 0.4, 2: 0.54, 3: 0.68, 4: 0.84, 5: 1 },
};

const SCRYFALL_NAMED_URL = "https://api.scryfall.com/cards/named";
const RECOMMENDER_CLASSIFICATION_LIMIT = 32;
const RECOMMENDER_CLASSIFICATION_CONCURRENCY = 6;
const MAX_TOPIC_SUGGESTIONS = 2;
const MAX_TOTAL_RECOMMENDATION_CARDS = 3;
const recommendationCardCache = new Map<string, ScryfallCard | null>();

const STAPLE_UP_CANDIDATES: Record<EfficiencyTopic, RecommendationLibraryEntry[]> = {
  ramp: [
    {
      name: "Sol Ring",
      idealBracket: 5,
      priority: 4,
      reason: "it is the baseline legal fast-mana staple; missing it means the deck spends extra slots to reach the same early mana pace.",
    },
    {
      name: "Mana Vault",
      idealBracket: 5,
      priority: 3,
      reason: "it compresses several turns of mana into one card, which is exactly the kind of slot efficiency competitive ramp packages expect.",
    },
    {
      name: "Grim Monolith",
      idealBracket: 5,
      priority: 2,
      reason: "it is a compact fast-mana slot that raises early ceiling without needing a larger ramp package.",
    },
    {
      name: "Chrome Mox",
      idealBracket: 5,
      reason: "it trades a card for immediate acceleration, which matters when the target bracket values speed over raw card count.",
    },
    {
      name: "Mox Diamond",
      idealBracket: 5,
      reason: "it gives zero-mana acceleration and color access from one slot, which is much more compact than fair three-mana ramp.",
    },
    {
      name: "Lotus Petal",
      idealBracket: 5,
      reason: "it adds one explosive mana burst without dedicating the deck to slower permanent ramp.",
    },
    {
      name: "Mox Opal",
      idealBracket: 5,
      predicate: (context) => getArtifactCount(context) >= 14,
      reason: "the artifact count is high enough that this can act as another zero-mana accelerator instead of a slow ramp card.",
    },
    {
      name: "Mox Amber",
      idealBracket: 5,
      predicate: (context) => hasCheapLegendaryCommander(context),
      reason: "a cheap commander makes this a realistic zero-mana accelerator rather than a dead artifact.",
    },
    {
      name: "Dark Ritual",
      idealBracket: 5,
      requiredColors: ["B"],
      reason: "black high-bracket decks often prefer this kind of one-card burst over spending several slots on slower mana development.",
    },
    {
      name: "Culling the Weak",
      idealBracket: 5,
      requiredColors: ["B"],
      predicate: (context) => getCreatureCount(context) >= 14,
      reason: "the creature count gives this enough fodder to become a compact burst-mana upgrade.",
    },
    {
      name: "Cabal Ritual",
      idealBracket: 5,
      requiredColors: ["B"],
      reason: "it gives black combo and spell-heavy shells a higher ceiling from one slot than ordinary ramp pieces.",
    },
    {
      name: "Jeska's Will",
      idealBracket: 5,
      requiredColors: ["R"],
      reason: "it combines burst mana and temporary card access, which is much more slot-efficient than a single-purpose ramp card.",
    },
    {
      name: "Rite of Flame",
      idealBracket: 5,
      requiredColors: ["R"],
      reason: "it gives red high-bracket shells a cheap burst option when speed matters more than permanent mana.",
    },
    {
      name: "Simian Spirit Guide",
      idealBracket: 5,
      requiredColors: ["R"],
      reason: "it turns one card slot into surprise mana without spending a spell slot on the stack.",
    },
    {
      name: "Carpet of Flowers",
      idealBracket: 5,
      requiredColors: ["G"],
      reason: "it is table-dependent, but in blue-heavy high-bracket pods it can outperform several fair ramp cards by itself.",
    },
    {
      name: "Birds of Paradise",
      idealBracket: 4,
      requiredColors: ["G"],
      reason: "it gives one-mana acceleration and color fixing from a single slot, which is cleaner than slower green ramp.",
    },
    {
      name: "Utopia Sprawl",
      idealBracket: 4,
      requiredColors: ["G"],
      reason: "it is one-mana land-based acceleration, so it improves speed without leaning harder into fragile artifacts.",
    },
    {
      name: "Wild Growth",
      idealBracket: 4,
      requiredColors: ["G"],
      reason: "it keeps the ramp package compact by turning one early land into repeated extra mana.",
    },
  ],
  card_flow: [
    {
      name: "Mystic Remora",
      idealBracket: 5,
      requiredColors: ["U"],
      reason: "it is one of the most compact card-flow engines available for faster tables because it can trade one mana for several cards.",
    },
    {
      name: "Rhystic Study",
      idealBracket: 5,
      requiredColors: ["U"],
      reason: "it gives repeatable card pressure from one slot and forces opponents to spend mana awkwardly.",
    },
    {
      name: "The One Ring",
      idealBracket: 5,
      reason: "it condenses protection and repeatable card flow into one very high-impact slot.",
    },
    {
      name: "Necropotence",
      idealBracket: 5,
      requiredColors: ["B"],
      reason: "it turns life total into a large hand from one card, which is much more efficient than stacking several smaller draw spells.",
    },
    {
      name: "Ad Nauseam",
      idealBracket: 5,
      requiredColors: ["B"],
      predicate: (context) => getAverageNonlandManaValue(context) <= 2.65,
      reason: "the curve is low enough that this can function as a one-card refill instead of a normal draw spell.",
    },
    {
      name: "Wheel of Fortune",
      idealBracket: 5,
      requiredColors: ["R"],
      reason: "it gives red a compact full-hand reset that can outperform several smaller impulse-draw cards.",
    },
    {
      name: "Esper Sentinel",
      idealBracket: 4,
      requiredColors: ["W"],
      reason: "it gives white a cheap repeated card-flow tax that scales better than most fair draw options.",
    },
    {
      name: "Sylvan Library",
      idealBracket: 4,
      requiredColors: ["G"],
      reason: "it gives green ongoing selection and optional extra cards from one efficient engine slot.",
    },
  ],
  consistency: [
    {
      name: "Vampiric Tutor",
      idealBracket: 5,
      requiredColors: ["B"],
      reason: "it is one of the most compact ways to turn any draw step into the exact card the deck needs.",
    },
    {
      name: "Demonic Tutor",
      idealBracket: 5,
      requiredColors: ["B"],
      reason: "it gives unrestricted access from a single low-cost slot, which is the benchmark for black consistency.",
    },
    {
      name: "Imperial Seal",
      idealBracket: 5,
      requiredColors: ["B"],
      reason: "it adds another one-mana unrestricted tutor when the target bracket expects maximum consistency density.",
    },
    {
      name: "Mystical Tutor",
      idealBracket: 5,
      requiredColors: ["U"],
      predicate: (context) =>
        getInstantSorceryCount(context) >= 10 ||
        hasRelevantWinPlan(context, ["spell_burst", "infinite_combo", "lock_attrition"]),
      reason: "it finds compact interaction, combo pieces, or payoff spells without dedicating multiple slots to slower search.",
    },
    {
      name: "Enlightened Tutor",
      idealBracket: 5,
      requiredColors: ["W"],
      predicate: (context) => getArtifactCount(context) + getEnchantmentCount(context) >= 8,
      reason: "it turns artifact and enchantment packages into much more compact toolboxes.",
    },
    {
      name: "Worldly Tutor",
      idealBracket: 5,
      requiredColors: ["G"],
      predicate: (context) => getCreatureCount(context) >= 16,
      reason: "it lets creature-based shells find the exact engine or finisher without adding more redundant creatures.",
    },
    {
      name: "Gamble",
      idealBracket: 5,
      requiredColors: ["R"],
      reason: "it gives red one-card access to a key piece, which is rare enough to matter strongly at high brackets.",
    },
    {
      name: "Entomb",
      idealBracket: 5,
      requiredColors: ["B"],
      strategyKeys: ["reanimator"],
      winPlanKeys: ["graveyard_pressure"],
      reason: "graveyard shells use it as a one-mana tutor when the graveyard is effectively part of the hand.",
    },
    {
      name: "Intuition",
      idealBracket: 5,
      requiredColors: ["U"],
      strategyKeys: ["combo", "reanimator", "spellslinger"],
      winPlanKeys: ["infinite_combo", "graveyard_pressure", "spell_burst"],
      reason: "it can compress several redundant lines into one instant-speed search effect.",
    },
  ],
  interaction: [
    {
      name: "Force of Will",
      idealBracket: 5,
      requiredColors: ["U"],
      reason: "it protects key turns without leaving mana open, which is the interaction efficiency high brackets expect.",
    },
    {
      name: "Fierce Guardianship",
      idealBracket: 5,
      requiredColors: ["U"],
      reason: "commander availability can turn it into free protection for the turns that decide games.",
    },
    {
      name: "Force of Negation",
      idealBracket: 5,
      requiredColors: ["U"],
      reason: "it adds another free stack answer instead of forcing the deck to hold up mana every turn.",
    },
    {
      name: "Pact of Negation",
      idealBracket: 5,
      requiredColors: ["U"],
      reason: "it protects a winning turn from one card even when all mana is committed.",
    },
    {
      name: "Flusterstorm",
      idealBracket: 5,
      requiredColors: ["U"],
      reason: "it is a one-mana stack fight card that scales extremely well against fast spell turns.",
    },
    {
      name: "Mental Misstep",
      idealBracket: 5,
      requiredColors: ["U"],
      reason: "it covers many of the cheapest high-impact spells without asking for mana.",
    },
    {
      name: "Deflecting Swat",
      idealBracket: 5,
      requiredColors: ["R"],
      reason: "it protects commander-centric and combo turns for zero mana when the commander is online.",
    },
    {
      name: "Pyroblast",
      idealBracket: 5,
      requiredColors: ["R"],
      reason: "it is one of red's most efficient answers in blue-heavy high-bracket pods.",
    },
    {
      name: "Red Elemental Blast",
      idealBracket: 5,
      requiredColors: ["R"],
      reason: "it gives red another one-mana answer to the blue stack pieces that define many fast pods.",
    },
    {
      name: "Deadly Rollick",
      idealBracket: 5,
      requiredColors: ["B"],
      reason: "it gives black free creature interaction when the commander is online, saving mana for the active game plan.",
    },
    {
      name: "Silence",
      idealBracket: 5,
      requiredColors: ["W"],
      reason: "it protects a decisive turn from an entire table with one cheap slot.",
    },
    {
      name: "Veil of Summer",
      idealBracket: 5,
      requiredColors: ["G"],
      reason: "it is a one-mana protection and card-flow swing against the colors most likely to stop key turns.",
    },
    {
      name: "Swords to Plowshares",
      idealBracket: 4,
      requiredColors: ["W"],
      reason: "it is the clean benchmark for one-mana creature removal.",
    },
    {
      name: "Nature's Claim",
      idealBracket: 4,
      requiredColors: ["G"],
      reason: "it answers key artifacts and enchantments for one mana, which matters more than the life it gives back.",
    },
    {
      name: "Swan Song",
      idealBracket: 4,
      requiredColors: ["U"],
      reason: "it gives blue a one-mana answer to many of the noncreature spells that decide faster games.",
    },
  ],
};

const SHELL_UP_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Skullclamp",
    idealBracket: 3,
    strategyKeys: ["tokens", "aristocrats"],
    predicate: (context) => getCreatureCount(context) >= 20,
    reason: "it turns the shell's expendable bodies into real card flow and tightens the main plan quickly.",
  },
  {
    name: "Foundry Inspector",
    idealBracket: 3,
    strategyKeys: ["artifacts"],
    reason: "it lowers the mana load on artifact-heavy turns and keeps the shell moving.",
  },
  {
    name: "Enchantress's Presence",
    idealBracket: 3,
    requiredColors: ["G"],
    strategyKeys: ["enchantress"],
    reason: "it gives the enchantment shell the steady payoff engine it usually wants.",
  },
  {
    name: "Victimize",
    idealBracket: 3,
    requiredColors: ["B"],
    strategyKeys: ["reanimator"],
    reason: "it turns one graveyard setup into a meaningful battlefield swing for reanimator shells.",
  },
  {
    name: "Ramunap Excavator",
    idealBracket: 3,
    requiredColors: ["G"],
    strategyKeys: ["lands_matter"],
    reason: "it gives land-centric decks a cleaner way to turn fetches and utility lands into repeated value.",
  },
  {
    name: "Bastion of Remembrance",
    idealBracket: 3,
    requiredColors: ["B"],
    strategyKeys: ["aristocrats", "tokens"],
    reason: "it gives the shell a real on-plan drain payoff without asking for extra board presence first.",
  },
  {
    name: "Ephemerate",
    idealBracket: 3,
    requiredColors: ["W"],
    strategyKeys: ["blink"],
    reason: "it is one of the cleanest ways to turn blink payoffs on from a single cheap slot.",
  },
  {
    name: "Trail of Mystery",
    idealBracket: 3,
    priority: 3,
    requiredColors: ["G"],
    strategyKeys: ["face_down"],
    reason: "it turns every face-down creature into land smoothing and makes the morph turns less clunky.",
  },
  {
    name: "Secret Plans",
    idealBracket: 3,
    priority: 2,
    requiredColors: ["G", "U"],
    strategyKeys: ["face_down"],
    reason: "it rewards the face-down plan with card flow and lets small morph bodies trade more safely.",
  },
  {
    name: "Primordial Mist",
    idealBracket: 3,
    priority: 1,
    requiredColors: ["U"],
    strategyKeys: ["face_down"],
    reason: "it gives face-down shells a repeatable stream of hidden creatures and late-game card access.",
  },
  {
    name: "Hardened Scales",
    idealBracket: 3,
    requiredColors: ["G"],
    strategyKeys: ["counters"],
    reason: "it makes the counter shell's support cards line up faster and more efficiently.",
  },
  {
    name: "Blackblade Reforged",
    idealBracket: 3,
    strategyKeys: ["voltron"],
    reason: "it is a simple way to turn a commander-centric shell into a cleaner combat threat.",
  },
  {
    name: "Curse of Opulence",
    idealBracket: 3,
    requiredColors: ["R"],
    strategyKeys: ["treasure"],
    reason: "it starts the treasure plan early and gives the shell more live mana turns.",
  },
  {
    name: "Herald's Horn",
    idealBracket: 3,
    strategyKeys: ["kindred"],
    reason: "it adds both smoothing and cost relief to creature-type shells without changing their identity.",
  },
  {
    name: "Young Pyromancer",
    idealBracket: 3,
    requiredColors: ["R"],
    strategyKeys: ["spellslinger"],
    reason: "it lets spell-heavy shells turn routine cantrips and interaction into real battlefield pressure.",
  },
  {
    name: "Deepglow Skate",
    idealBracket: 4,
    requiredColors: ["U"],
    strategyKeys: ["superfriends"],
    reason: "it compresses multiple planeswalker turns into one payoff turn and raises the shell's ceiling quickly.",
  },
  {
    name: "Howling Mine",
    idealBracket: 2,
    strategyKeys: ["group_hug"],
    reason: "it gives the group-hug shell an immediately visible support piece that matches its plan.",
  },
  {
    name: "Authority of the Consuls",
    idealBracket: 3,
    requiredColors: ["W"],
    strategyKeys: ["tap_untap", "control"],
    reason: "it keeps opposing creatures entering tapped, which supplies reliable material for tap-matters commanders while also slowing combat pressure.",
  },
  {
    name: "Verity Circle",
    idealBracket: 3,
    requiredColors: ["U"],
    strategyKeys: ["tap_untap"],
    reason: "it rewards the deck for tapping opposing creatures and turns tap effects into repeatable card flow.",
  },
  {
    name: "Icy Manipulator",
    idealBracket: 2,
    strategyKeys: ["tap_untap"],
    reason: "it is a fair repeatable tap source for commanders that care about creatures becoming tapped.",
  },
  {
    name: "Paradox Haze",
    idealBracket: 3,
    requiredColors: ["U"],
    strategyKeys: ["extra_upkeep"],
    reason: "it doubles the upkeep step for commanders and engines that are explicitly paid off during upkeep.",
  },
  {
    name: "Court of Grace",
    idealBracket: 3,
    requiredColors: ["W"],
    strategyKeys: ["extra_upkeep", "monarch", "tokens"],
    reason: "it creates a steady upkeep payoff and gives extra-upkeep decks a visible reason to care about that repeated step.",
  },
  {
    name: "Etali, Primal Storm",
    idealBracket: 3,
    requiredColors: ["R"],
    strategyKeys: ["theft", "exile_cast"],
    reason: "it turns opponent-library access into a real payoff for theft and cast-opponents-cards shells.",
  },
  {
    name: "Suture Priest",
    idealBracket: 2,
    requiredColors: ["W"],
    strategyKeys: ["lifegain", "group_slug"],
    reason: "it connects creature-heavy tables to both life-gain triggers and opponent life-loss pressure.",
  },
  {
    name: "Syr Konrad, the Grim",
    idealBracket: 3,
    requiredColors: ["B"],
    strategyKeys: ["mill", "group_slug", "reanimator"],
    reason: "it rewards self-mill, creature deaths, and graveyard movement with a clear table-wide damage engine.",
  },
  {
    name: "Lightning Greaves",
    idealBracket: 3,
    predicate: (context) => readNumber(context.commander.dependencyScore) >= 58,
    reason: "it keeps a commander-centric shell online and buys the command zone the extra turn it often needs.",
  },
  {
    name: "Trail of Mystery",
    idealBracket: 3,
    priority: 3,
    requiredColors: ["G"],
    strategyKeys: ["face_down"],
    reason: "it is especially clean for face-down commanders because every morph or disguise creature also fixes land drops instead of only being a hidden body.",
  },
  {
    name: "Secret Plans",
    idealBracket: 3,
    priority: 2,
    requiredColors: ["G", "U"],
    strategyKeys: ["face_down"],
    reason: "it is on-plan card flow for face-down shells: the deck gets paid when creatures turn face up and the extra toughness helps morph bodies survive combat.",
  },
  {
    name: "Primordial Mist",
    idealBracket: 3,
    priority: 1,
    requiredColors: ["U"],
    strategyKeys: ["face_down"],
    reason: "it gives face-down commanders a repeatable source of hidden creatures, so the commander keeps seeing the specific material it asks for.",
  },
  {
    name: "Mastery of the Unseen",
    idealBracket: 3,
    requiredColors: ["W"],
    strategyKeys: ["face_down"],
    reason: "it turns spare mana into more face-down creatures and gives the shell a stabilizing life buffer while it sets up.",
  },
  {
    name: "Jasmine Boreal of the Seven",
    idealBracket: 3,
    priority: 3,
    requiredColors: ["G", "W"],
    strategyKeys: ["power_matter"],
    reason: "it specifically rewards simple low-stat bodies, which is exactly what many power-matters commanders ask the deck to fill with.",
  },
  {
    name: "Grizzly Bears",
    idealBracket: 1,
    requiredColors: ["G"],
    strategyKeys: ["power_matter"],
    reason: "it is not generically powerful, but it is correct filler when the commander explicitly pays off base 2/2 creatures.",
  },
  {
    name: "Overwhelming Stampede",
    idealBracket: 3,
    priority: 1,
    requiredColors: ["G"],
    strategyKeys: ["power_matter"],
    winPlanKeys: ["go_wide_combat"],
    reason: "it converts a board of power-scaling creatures into a real finish instead of only building stats without ending the game.",
  },
  {
    name: "Heroes' Podium",
    idealBracket: 3,
    priority: 3,
    strategyKeys: ["legends_matter"],
    reason: "it rewards legendary density directly and turns a legends shell from scattered good cards into a board that scales together.",
  },
  {
    name: "Relic of Legends",
    idealBracket: 3,
    priority: 2,
    strategyKeys: ["legends_matter"],
    reason: "it uses the legendary creatures the deck already wants as mana sources, so the ramp slot reinforces the commander theme.",
  },
  {
    name: "Jodah, the Unifier",
    idealBracket: 4,
    strategyKeys: ["legends_matter"],
    multicolorOnly: true,
    reason: "it is a high-ceiling legends payoff that turns each legendary spell into more board presence and pressure.",
  },
  {
    name: "Ghalta, Primal Hunger",
    idealBracket: 3,
    requiredColors: ["G"],
    strategyKeys: ["mana_value_matter", "power_matter"],
    reason: "it gives high-mana-value and high-power shells a payoff that is much easier to cast once the deck is already building large bodies.",
  },
  {
    name: "Greater Good",
    idealBracket: 4,
    requiredColors: ["G"],
    strategyKeys: ["power_matter", "mana_value_matter"],
    reason: "it turns the large creatures these shells already want into major card flow instead of asking for unrelated draw engines.",
  },
  {
    name: "Torment of Hailfire",
    idealBracket: 4,
    requiredColors: ["B"],
    strategyKeys: ["x_spells"],
    reason: "it gives X-spell decks a scalable mana sink that converts big mana directly into a realistic endgame.",
  },
  {
    name: "Finale of Devastation",
    idealBracket: 4,
    requiredColors: ["G"],
    strategyKeys: ["x_spells", "power_matter"],
    reason: "it is both a scalable tutor and a late-game finisher, so it rewards the same big-mana setup the X-spell shell already wants.",
  },
  {
    name: "Blue Sun's Zenith",
    idealBracket: 3,
    requiredColors: ["U"],
    strategyKeys: ["x_spells"],
    reason: "it converts excess mana into cards and can become a real mana-sink payoff in slower X-spell shells.",
  },
  {
    name: "Comet Storm",
    idealBracket: 3,
    requiredColors: ["R"],
    strategyKeys: ["x_spells"],
    reason: "it gives the deck scalable instant-speed damage that can remove boards early or close games once the mana engine is online.",
  },
];

const SHELL_DOWN_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Idol of Oblivion",
    idealBracket: 2,
    strategyKeys: ["tokens"],
    reason: "it keeps the shell on theme without pushing the deck as hard as a sharper engine piece would.",
  },
  {
    name: "Jhoira's Familiar",
    idealBracket: 2,
    strategyKeys: ["artifacts"],
    reason: "it still supports artifact turns, but at a fairer pace for lower-bracket tables.",
  },
  {
    name: "Teleportation Circle",
    idealBracket: 2,
    requiredColors: ["W"],
    strategyKeys: ["blink"],
    reason: "it keeps the blink plan intact while slowing the shell down to a more casual cadence.",
  },
  {
    name: "Intangible Virtue",
    idealBracket: 2,
    requiredColors: ["W"],
    strategyKeys: ["tokens"],
    reason: "it rewards the token plan without pushing the shell into faster snowball turns.",
  },
  {
    name: "Sword of the Animist",
    idealBracket: 2,
    strategyKeys: ["voltron"],
    reason: "it still supports a commander-focused game, but does it through a slower, fairer combat line.",
  },
  {
    name: "Vanquisher's Banner",
    idealBracket: 2,
    strategyKeys: ["kindred"],
    reason: "it keeps the tribal plan supported while asking for more board development first.",
  },
  {
    name: "Howling Mine",
    idealBracket: 2,
    strategyKeys: ["group_hug"],
    reason: "it preserves the group-hug identity while avoiding a sharper engine slot.",
  },
  {
    name: "Swiftfoot Boots",
    idealBracket: 2,
    predicate: (context) => readNumber(context.commander.dependencyScore) >= 58,
    reason: "it still protects the commander, but it does so at a more modest rate than premium protection options.",
  },
];

const RAMP_UP_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Wayfarer's Bauble",
    idealBracket: 2,
    reason: "it is one of the cleanest fair ramp pieces for decks that are light on true land acceleration.",
  },
  {
    name: "Mind Stone",
    idealBracket: 2,
    reason: "it ramps early and cashes in for a card later, which keeps the slot live in slower games.",
  },
  {
    name: "Rampant Growth",
    idealBracket: 2,
    requiredColors: ["G"],
    reason: "it turns an early turn into a guaranteed land drop and smooths colors without asking much from the rest of the shell.",
  },
  {
    name: "Arcane Signet",
    idealBracket: 3,
    reason: "it is one of the most reliable two-mana rocks for fixing and early development in EDH.",
  },
  {
    name: "Fellwar Stone",
    idealBracket: 3,
    multicolorOnly: true,
    reason: "it usually fixes multiple colors in Commander and helps the deck deploy its key spells on time.",
  },
  {
    name: "Nature's Lore",
    idealBracket: 3,
    requiredColors: ["G"],
    reason: "it is a cheap land-based accelerator that fixes colors while dodging most artifact hate.",
  },
  {
    name: "Cultivate",
    idealBracket: 2,
    requiredColors: ["G"],
    reason: "it stabilizes land drops across two turns and is still a solid bridge spell for fair green decks.",
  },
  {
    name: "Three Visits",
    idealBracket: 4,
    requiredColors: ["G"],
    reason: "it improves early development without tying the deck to fragile mana rocks.",
  },
];

const RAMP_DOWN_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Wayfarer's Bauble",
    idealBracket: 1,
    reason: "it keeps the ramp count up while lowering the deck's overall speed ceiling.",
  },
  {
    name: "Mind Stone",
    idealBracket: 2,
    reason: "it is a fairer ramp piece that still does something useful when drawn late.",
  },
  {
    name: "Commander's Sphere",
    idealBracket: 2,
    multicolorOnly: true,
    reason: "it keeps fixing and ramp intact, but at a slower pace that better fits more relaxed pods.",
  },
  {
    name: "Cultivate",
    idealBracket: 2,
    requiredColors: ["G"],
    reason: "it keeps green ramp intact while stepping down from sharper acceleration.",
  },
  {
    name: "Kodama's Reach",
    idealBracket: 2,
    requiredColors: ["G"],
    reason: "it is a slower bridge spell that still keeps land drops and colors working.",
  },
  {
    name: "Solemn Simulacrum",
    idealBracket: 2,
    reason: "it gives the deck a slower, fairer ramp body instead of another explosive slot.",
  },
];

const CARD_FLOW_UP_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Mask of Memory",
    idealBracket: 2,
    predicate: (context) => getCreatureCount(context) >= 18,
    reason: "it converts routine combat into steady card flow and fits a wide range of creature decks.",
  },
  {
    name: "Night's Whisper",
    idealBracket: 2,
    requiredColors: ["B"],
    reason: "it is a clean two-mana refill that helps black decks keep spells flowing without much setup.",
  },
  {
    name: "Sign in Blood",
    idealBracket: 2,
    requiredColors: ["B"],
    reason: "it is another efficient low-curve draw spell that helps black shells keep pace on resources.",
  },
  {
    name: "Wrenn's Resolve",
    idealBracket: 2,
    requiredColors: ["R"],
    reason: "it is an efficient source of impulse draw that red decks can convert into real velocity quickly.",
  },
  {
    name: "Reckless Impulse",
    idealBracket: 2,
    requiredColors: ["R"],
    reason: "it pushes extra cards into hand-adjacent access early enough to matter in most fair shells.",
  },
  {
    name: "Harmonize",
    idealBracket: 2,
    requiredColors: ["G"],
    reason: "it is a straightforward refill for green decks that are short on raw draw.",
  },
  {
    name: "Fact or Fiction",
    idealBracket: 3,
    requiredColors: ["U"],
    reason: "it digs deep at instant speed and usually finds enough material to keep blue shells moving.",
  },
  {
    name: "Skullclamp",
    idealBracket: 3,
    predicate: (context) => getCreatureCount(context) >= 22,
    reason: "it is one of the better repeatable card-flow tools when the shell produces enough small or expendable bodies.",
  },
];

const CARD_FLOW_DOWN_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Tome of Legends",
    idealBracket: 2,
    predicate: (context) => readNumber(context.commander.dependencyScore) >= 50,
    reason: "it keeps card flow functional while staying fairer than the sharpest refill engines.",
  },
  {
    name: "Think Twice",
    idealBracket: 1,
    requiredColors: ["U"],
    reason: "it is a slower value spell that still keeps the deck moving without tightening it too hard.",
  },
  {
    name: "Read the Bones",
    idealBracket: 2,
    requiredColors: ["B"],
    reason: "it keeps the card-flow floor healthy while stepping away from more explosive draw pieces.",
  },
  {
    name: "Harmonize",
    idealBracket: 2,
    requiredColors: ["G"],
    reason: "it is a fair refill spell that does not compress games the way sharper engines can.",
  },
  {
    name: "Painful Truths",
    idealBracket: 2,
    multicolorOnly: true,
    reason: "it still pays the deck back in cards, but at a fair rate for mid-bracket tables.",
  },
];

const CONSISTENCY_UP_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Solve the Equation",
    idealBracket: 3,
    requiredColors: ["U"],
    strategyKeys: ["spellslinger", "control", "combo"],
    winPlanKeys: ["spell_burst", "infinite_combo", "lock_attrition"],
    predicate: (context) => getInstantSorceryCount(context) >= 14,
    reason: "it is a fair tutor upgrade for spell-heavy blue shells that want more consistency without jumping straight to the sharpest options.",
  },
  {
    name: "Mystical Tutor",
    idealBracket: 4,
    requiredColors: ["U"],
    strategyKeys: ["spellslinger", "control", "combo"],
    winPlanKeys: ["spell_burst", "infinite_combo", "lock_attrition", "alternate_win"],
    predicate: (context) =>
      getInstantSorceryCount(context) >= 12 ||
      hasRelevantWinPlan(context, ["spell_burst", "infinite_combo", "lock_attrition"]),
    reason: "it is one of the cleaner ways to tighten blue combo, control, and spell-focused shells.",
  },
  {
    name: "Worldly Tutor",
    idealBracket: 4,
    requiredColors: ["G"],
    strategyKeys: ["kindred", "reanimator", "blink", "tokens", "aggro"],
    winPlanKeys: ["go_wide_combat", "graveyard_pressure", "big_mana_haymakers"],
    predicate: (context) => getCreatureCount(context) >= 20,
    reason: "it sharpens creature-based game plans by turning any draw step into the best creature for the spot.",
  },
  {
    name: "Enlightened Tutor",
    idealBracket: 4,
    requiredColors: ["W"],
    strategyKeys: ["artifacts", "enchantress", "superfriends", "stax", "voltron"],
    predicate: (context) => getArtifactCount(context) + getEnchantmentCount(context) >= 10,
    reason: "it tightens artifact and enchantment packages while still being flexible enough for broader white shells.",
  },
  {
    name: "Gamble",
    idealBracket: 4,
    requiredColors: ["R"],
    strategyKeys: ["combo", "spellslinger", "treasure", "artifacts", "extra_combat"],
    winPlanKeys: ["infinite_combo", "spell_burst", "extra_combat_pressure", "drain_burn"],
    predicate: (context) =>
      getInstantSorceryCount(context) >= 10 ||
      hasRelevantStrategy(context, ["combo", "treasure", "artifacts", "extra_combat"]),
    reason: "it is one of red's better ways to trade a single card for access to a key effect or combo piece.",
  },
  {
    name: "Demonic Tutor",
    idealBracket: 5,
    requiredColors: ["B"],
    strategyKeys: ["combo", "control", "spellslinger", "reanimator", "stax"],
    winPlanKeys: ["infinite_combo", "spell_burst", "graveyard_pressure", "lock_attrition", "alternate_win"],
    reason: "it is a direct efficiency upgrade when the deck is trying to play at optimized or competitive speed.",
  },
];

const CONSISTENCY_DOWN_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Impulse",
    idealBracket: 2,
    requiredColors: ["U"],
    reason: "it still smooths draws and helps find the right spell, but it does so without tutor-level compression.",
  },
  {
    name: "Read the Bones",
    idealBracket: 2,
    requiredColors: ["B"],
    reason: "it keeps selection support in the deck while stepping away from sharper tutoring.",
  },
  {
    name: "Faithless Looting",
    idealBracket: 2,
    requiredColors: ["R"],
    reason: "it smooths hands and graveyard setup without carrying the same precision as a premium tutor.",
  },
  {
    name: "Commune with Spirits",
    idealBracket: 1,
    requiredColors: ["G"],
    reason: "it is a fair selection spell that supports enchantment and land-heavy shells without over-tightening them.",
  },
  {
    name: "Open the Armory",
    idealBracket: 2,
    requiredColors: ["W"],
    strategyKeys: ["voltron"],
    reason: "it is a narrower, fairer tutor option when the deck still wants some targeted consistency.",
  },
  {
    name: "Diabolic Tutor",
    idealBracket: 2,
    requiredColors: ["B"],
    reason: "it remains a tutor, but at a pace that better fits lower-power pods.",
  },
  {
    name: "Solve the Equation",
    idealBracket: 3,
    requiredColors: ["U"],
    strategyKeys: ["spellslinger", "control", "combo"],
    winPlanKeys: ["spell_burst", "infinite_combo", "lock_attrition"],
    predicate: (context) => getInstantSorceryCount(context) >= 14,
    reason: "it keeps spell access intact while landing a step fairer than the sharpest blue tutor options.",
  },
];

const INTERACTION_UP_REMOVAL_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Abrade",
    idealBracket: 2,
    requiredColors: ["R"],
    reason: "it covers small creatures and key artifacts from one cheap slot.",
  },
  {
    name: "Generous Gift",
    idealBracket: 3,
    requiredColors: ["W"],
    reason: "it answers nearly any permanent, which patches a lot of removal gaps from one card slot.",
  },
  {
    name: "Go for the Throat",
    idealBracket: 3,
    requiredColors: ["B"],
    reason: "it is a cheap clean answer that helps black decks interact without spending too much mana.",
  },
  {
    name: "Feed the Swarm",
    idealBracket: 3,
    requiredColors: ["B"],
    reason: "it patches black's enchantment weakness while still being fine against creatures.",
  },
  {
    name: "Beast Within",
    idealBracket: 3,
    requiredColors: ["G"],
    reason: "it gives green a universal answer and keeps the deck from folding to odd permanent types.",
  },
  {
    name: "Chaos Warp",
    idealBracket: 3,
    requiredColors: ["R"],
    reason: "it is one of red's cleanest ways to answer any permanent type from a single slot.",
  },
  {
    name: "Swords to Plowshares",
    idealBracket: 4,
    requiredColors: ["W"],
    reason: "it is among the most efficient creature answers available for white decks.",
  },
  {
    name: "Rapid Hybridization",
    idealBracket: 4,
    requiredColors: ["U"],
    reason: "it turns blue interaction into a genuinely efficient removal spell rather than pure stack play.",
  },
  {
    name: "Reality Shift",
    idealBracket: 4,
    requiredColors: ["U"],
    reason: "it is one of blue's cleaner exile effects for creature-based problems.",
  },
];

const INTERACTION_UP_STACK_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Negate",
    idealBracket: 2,
    requiredColors: ["U"],
    reason: "it is a simple efficient way to keep sweepers, combo pieces, and key engines off the stack.",
  },
  {
    name: "Arcane Denial",
    idealBracket: 2,
    requiredColors: ["U"],
    reason: "it is an easy blue interaction upgrade when the deck needs more stack answers but wants to stay fair.",
  },
  {
    name: "Counterspell",
    idealBracket: 3,
    requiredColors: ["U"],
    reason: "it is still one of the cleanest two-mana answers for decks that need harder stack control.",
  },
  {
    name: "Swan Song",
    idealBracket: 4,
    requiredColors: ["U"],
    reason: "it is a strong one-mana stack answer for faster tables where efficiency matters more.",
  },
  {
    name: "An Offer You Can't Refuse",
    idealBracket: 5,
    requiredColors: ["U"],
    reason: "it is a highly efficient stack piece when the deck is trying to play at optimized speed.",
  },
];

const INTERACTION_DOWN_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Arcane Denial",
    idealBracket: 2,
    requiredColors: ["U"],
    reason: "it keeps the shell interactive on the stack, but in a way that is easier for lower brackets to absorb.",
  },
  {
    name: "Negate",
    idealBracket: 2,
    requiredColors: ["U"],
    reason: "it still protects the deck from major noncreature spells without preserving the sharpest stack profile.",
  },
  {
    name: "Generous Gift",
    idealBracket: 2,
    requiredColors: ["W"],
    reason: "it remains broad removal, but at a fair pace and rate for more relaxed tables.",
  },
  {
    name: "Beast Within",
    idealBracket: 2,
    requiredColors: ["G"],
    reason: "it keeps a wide answer range while backing off from the cleanest premium interaction.",
  },
  {
    name: "Chaos Warp",
    idealBracket: 2,
    requiredColors: ["R"],
    reason: "it remains flexible interaction without preserving the same consistency as the sharpest removal suites.",
  },
  {
    name: "Return to Dust",
    idealBracket: 2,
    requiredColors: ["W"],
    reason: "it is still meaningful interaction, but at a much fairer table speed.",
  },
  {
    name: "Krosan Grip",
    idealBracket: 2,
    requiredColors: ["G"],
    reason: "it keeps the deck able to answer problem permanents without overloading the shell with premium answers.",
  },
];

const RESILIENCE_UP_PROTECTION_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Swiftfoot Boots",
    idealBracket: 2,
    reason: "it is one of the easiest universal protection upgrades when the deck wants its main engine to survive a full turn cycle.",
  },
  {
    name: "Tamiyo's Safekeeping",
    idealBracket: 2,
    requiredColors: ["G"],
    reason: "it is a cheap, low-friction protection piece that covers most spot interaction.",
  },
  {
    name: "Lightning Greaves",
    idealBracket: 3,
    reason: "it protects key creatures immediately and doubles as a haste enabler for commander-centric plans.",
  },
  {
    name: "Heroic Intervention",
    idealBracket: 4,
    requiredColors: ["G"],
    reason: "it protects a full board from sweepers and targeted interaction in a single slot.",
  },
  {
    name: "Flawless Maneuver",
    idealBracket: 5,
    requiredColors: ["W"],
    reason: "it is a strong protection upgrade for commander-focused white decks once the target bracket expects sharper interaction fights.",
  },
];

const RESILIENCE_UP_RECURSION_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Regrowth",
    idealBracket: 2,
    requiredColors: ["G"],
    reason: "it is a clean way to turn one key loss back into a live spell slot.",
  },
  {
    name: "Sevinne's Reclamation",
    idealBracket: 3,
    requiredColors: ["W"],
    reason: "it recovers key cheap permanents and keeps value engines online after interaction.",
  },
  {
    name: "Victimize",
    idealBracket: 3,
    requiredColors: ["B"],
    reason: "it turns graveyard setup into real recovery and battlefield presence from one slot.",
  },
  {
    name: "Eternal Witness",
    idealBracket: 3,
    requiredColors: ["G"],
    reason: "it is one of the cleaner recursion pieces for value shells that expect real attrition.",
  },
  {
    name: "Sun Titan",
    idealBracket: 4,
    requiredColors: ["W"],
    reason: "it turns routine attacks into repeated recovery for many key value pieces.",
  },
];

const RESILIENCE_DOWN_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Swiftfoot Boots",
    idealBracket: 2,
    reason: "it still protects the shell, but it does so in a fairer way than the sharper resilience options.",
  },
  {
    name: "Tamiyo's Safekeeping",
    idealBracket: 2,
    requiredColors: ["G"],
    reason: "it keeps one key permanent safe without preserving a heavier protection suite.",
  },
  {
    name: "Regrowth",
    idealBracket: 2,
    requiredColors: ["G"],
    reason: "it gives the deck a fair recovery spell instead of a more forceful resilience engine.",
  },
  {
    name: "Sevinne's Reclamation",
    idealBracket: 2,
    requiredColors: ["W"],
    reason: "it preserves recursion utility while stepping down to a more casual power band.",
  },
  {
    name: "Phyrexian Reclamation",
    idealBracket: 2,
    requiredColors: ["B"],
    reason: "it keeps creatures coming back, but at a measured pace that better fits lower brackets.",
  },
];

const CLOSING_UP_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Overwhelming Stampede",
    idealBracket: 3,
    requiredColors: ["G"],
    winPlanKeys: ["go_wide_combat", "extra_combat_pressure"],
    reason: "it gives creature-heavy shells a clean way to turn a developed board into an actual finish.",
  },
  {
    name: "Shared Animosity",
    idealBracket: 3,
    requiredColors: ["R"],
    strategyKeys: ["tokens", "kindred", "aggro"],
    reason: "it lets wide combat shells close games much faster once the board is established.",
  },
  {
    name: "Blackblade Reforged",
    idealBracket: 3,
    winPlanKeys: ["commander_damage"],
    reason: "it gives commander-damage shells a much cleaner way to translate board presence into lethal pressure.",
  },
  {
    name: "Exsanguinate",
    idealBracket: 3,
    requiredColors: ["B"],
    winPlanKeys: ["drain_burn", "big_mana_haymakers"],
    reason: "it gives big-mana and drain shells a reliable closer that scales with the game.",
  },
  {
    name: "Aetherflux Reservoir",
    idealBracket: 4,
    winPlanKeys: ["spell_burst", "infinite_combo"],
    strategyKeys: ["artifacts", "spellslinger"],
    reason: "it gives spell-heavy shells a real payoff that can close once they chain enough spells together.",
  },
  {
    name: "Approach of the Second Sun",
    idealBracket: 3,
    requiredColors: ["W"],
    winPlanKeys: ["alternate_win"],
    strategyKeys: ["control"],
    reason: "it gives slower shells a real top-end finish without needing a battlefield to stick.",
  },
  {
    name: "Deepglow Skate",
    idealBracket: 4,
    requiredColors: ["U"],
    winPlanKeys: ["planeswalker_ultimates"],
    strategyKeys: ["superfriends"],
    reason: "it lets planeswalker shells cash in their setup for real closing pressure much faster.",
  },
  {
    name: "Living Death",
    idealBracket: 4,
    requiredColors: ["B"],
    winPlanKeys: ["graveyard_pressure"],
    strategyKeys: ["reanimator"],
    reason: "it gives graveyard shells one of the cleaner board-swing finishes available to them.",
  },
  {
    name: "Maddening Cacophony",
    idealBracket: 3,
    requiredColors: ["U"],
    winPlanKeys: ["mill_out"],
    strategyKeys: ["mill"],
    reason: "it gives mill shells a dedicated closer instead of relying only on incidental pressure.",
  },
  {
    name: "Triumph of the Hordes",
    idealBracket: 4,
    requiredColors: ["G"],
    winPlanKeys: ["poison", "go_wide_combat"],
    strategyKeys: ["aggro", "tokens"],
    reason: "it lets creature shells convert one established attack step into a real closing turn.",
  },
  {
    name: "Thassa's Oracle",
    idealBracket: 5,
    requiredColors: ["U"],
    winPlanKeys: ["infinite_combo"],
    reason: "it is one of the cleanest compact finishes when the target bracket expects true combo closing power.",
  },
  {
    name: "Crackle with Power",
    idealBracket: 4,
    requiredColors: ["R"],
    winPlanKeys: ["spell_burst", "big_mana_haymakers"],
    reason: "it gives big-mana red shells a direct closer that ends the game instead of only generating value.",
  },
];

const CLOSING_DOWN_CANDIDATES: RecommendationLibraryEntry[] = [
  {
    name: "Beastmaster Ascension",
    idealBracket: 2,
    requiredColors: ["G"],
    strategyKeys: ["tokens", "aggro"],
    winPlanKeys: ["go_wide_combat"],
    reason: "it still rewards wide boards, but at a fairer pace than sharper combat kills.",
  },
  {
    name: "Thunderfoot Baloth",
    idealBracket: 2,
    requiredColors: ["G"],
    winPlanKeys: ["commander_damage", "go_wide_combat"],
    reason: "it keeps combat closing on the table without the same speed as premium finishers.",
  },
  {
    name: "Blackblade Reforged",
    idealBracket: 2,
    winPlanKeys: ["commander_damage"],
    reason: "it preserves a commander-damage finish while keeping the deck on a slower, more readable clock.",
  },
  {
    name: "Approach of the Second Sun",
    idealBracket: 2,
    requiredColors: ["W"],
    winPlanKeys: ["alternate_win"],
    strategyKeys: ["control"],
    reason: "it gives slower decks a fairer way to close than compact combo lines.",
  },
  {
    name: "Syr Konrad, the Grim",
    idealBracket: 2,
    requiredColors: ["B"],
    winPlanKeys: ["graveyard_pressure", "drain_burn"],
    reason: "it keeps graveyard and attrition shells threatening, but at a lower compression level.",
  },
  {
    name: "Maddening Cacophony",
    idealBracket: 2,
    requiredColors: ["U"],
    winPlanKeys: ["mill_out"],
    reason: "it still points the deck toward milling wins without relying on the sharpest closing line.",
  },
  {
    name: "Crackle with Power",
    idealBracket: 3,
    requiredColors: ["R"],
    winPlanKeys: ["spell_burst", "big_mana_haymakers"],
    reason: "it keeps a big finish available, but asks for a slower, more telegraphed setup first.",
  },
];

export async function analyzeDeckRecommendations(
  input: AnalyzeDeckRecommendationsInput,
): Promise<DeckRecommendationAnalysis> {
  const targetBracket = input.bracket.targetBracket ?? input.bracket.recommendedBracket;
  const [edhrec, recommander] = await Promise.all([
    input.edhrec === undefined
      ? lookupCommanderEdhrecInsights(input.document, targetBracket)
      : Promise.resolve(input.edhrec),
    input.recommander === undefined
      ? lookupRecommanderRecommendations(input.document)
      : Promise.resolve(input.recommander),
  ]);
  const context = createContext(input, edhrec, recommander, targetBracket);
  context.recommanderTopicLibraries = await buildRecommanderTopicLibraries(context);
  const topics = limitRecommendationCards(context, [
    buildShellTopic(context),
    buildLandBaseTopic(context),
    buildRampTopic(context),
    buildCardFlowTopic(context),
    buildConsistencyTopic(context),
    buildInteractionTopic(context),
    buildResilienceTopic(context),
    buildClosingTopic(context),
  ]);

  return {
    summary: summarizeRecommendations(context, topics),
    topics,
  };
}

function createContext(
  input: AnalyzeDeckRecommendationsInput,
  edhrec: EdhrecCommanderInsights | null,
  recommander: RecommanderInsights | null,
  targetBracket: DeckBracketNumber,
): RecommendationContext {
  const deckCards = input.document.result.resolvedCards.filter(
    (card) => card.section === "commander" || card.section === "mainboard",
  );
  const mainboardCards = deckCards.filter((card) => card.section === "mainboard");
  const mainboardLands = mainboardCards.filter((card) => hasCardType(card.card, "Land"));

  return {
    ...input,
    edhrec,
    recommander,
    targetBracket,
    deckCards,
    mainboardCards,
    mainboardLands,
    colorProfile: getCommanderColorProfile(deckCards),
    efficiency: createEfficiencyProfiles(input, targetBracket),
    recommanderTopicLibraries: new Map<DeckRecommendationTopic, RecommendationLibraryEntry[]>(),
    normalizedDeckNames: new Set(
      input.document.result.resolvedCards.map((card) => normalizeText(card.card.name)),
    ),
    usedSuggestionNames: new Set<string>(),
  };
}

function createEfficiencyProfiles(
  input: AnalyzeDeckRecommendationsInput,
  targetBracket: DeckBracketNumber,
): Record<EfficiencyTopic, TopicEfficiencyProfile> {
  const rampValue =
    readNumber(input.ramp.counts.core) ||
    readNumber(input.ramp.counts.stable) +
      readNumber(input.ramp.counts.landAcceleration) +
      readNumber(input.ramp.counts.costReduction) * 0.75;
  const drawValue =
    readNumber(input.draw.counts.core) ||
    readNumber(input.draw.counts.draw) +
      readNumber(input.draw.counts.repeatable) * 0.7 +
      readNumber(input.draw.counts.selection) * 0.25;
  const consistencyValue =
    readNumber(input.consistency.counts.core) ||
    readNumber(input.consistency.counts.direct) * 1.15 +
      readNumber(input.consistency.counts.restricted) * 0.75 +
      readNumber(input.consistency.counts.repeatable) * 0.95 +
      readNumber(input.consistency.counts.selectionSupport) * 0.25;
  const interactionValue =
    (readNumber(input.removal.counts.core) ||
      readNumber(input.removal.counts.targeted) +
        readNumber(input.removal.counts.mass) * 0.85 +
        readNumber(input.removal.counts.tempo) * 0.45 +
        readNumber(input.removal.counts.handAttack) * 0.4) +
    (readNumber(input.spellInteraction.counts.core) ||
      readNumber(input.spellInteraction.counts.hard) +
        readNumber(input.spellInteraction.counts.soft) * 0.55 +
        readNumber(input.spellInteraction.counts.spellTempo) * 0.4 +
        readNumber(input.spellInteraction.counts.broad) * 0.5);

  return {
    ramp: createEfficiencyProfile(
      "ramp",
      rampValue + readNumber(input.ramp.counts.burst) * 0.35,
      countTaggedSlots(input.ramp.taggedCards ?? []),
      targetBracket,
    ),
    card_flow: createEfficiencyProfile(
      "card_flow",
      drawValue,
      countTaggedSlots(input.draw.taggedCards ?? []),
      targetBracket,
    ),
    consistency: createEfficiencyProfile(
      "consistency",
      consistencyValue,
      countTaggedSlots(input.consistency.taggedCards ?? []),
      targetBracket,
    ),
    interaction: createEfficiencyProfile(
      "interaction",
      interactionValue,
      countUniqueTaggedSlots(
        input.removal.taggedCards ?? [],
        input.spellInteraction.taggedCards ?? [],
      ),
      targetBracket,
    ),
  };
}

function createEfficiencyProfile(
  topic: EfficiencyTopic,
  value: number,
  slots: number,
  targetBracket: DeckBracketNumber,
): TopicEfficiencyProfile {
  const roundedValue = roundTo(Math.max(0, value), 2);
  const roundedSlots = roundTo(Math.max(0, slots), 2);
  const efficiency = roundedSlots > 0 ? roundTo(roundedValue / roundedSlots, 2) : 0;
  const target = EFFICIENCY_TARGETS[topic][targetBracket];

  return {
    value: roundedValue,
    slots: roundedSlots,
    efficiency,
    target,
    gap: roundedSlots > 0 ? roundTo(Math.max(0, target - efficiency), 2) : 0,
  };
}

function countTaggedSlots(cards: Array<{ quantity?: number }>) {
  return cards.reduce((sum, card) => sum + getTaggedQuantity(card), 0);
}

function countUniqueTaggedSlots(...cardLists: Array<Array<{ name: string; quantity?: number }>>) {
  const quantities = new Map<string, number>();

  for (const cards of cardLists) {
    for (const card of cards) {
      const key = normalizeText(card.name);
      quantities.set(key, Math.max(quantities.get(key) ?? 0, getTaggedQuantity(card)));
    }
  }

  return [...quantities.values()].reduce((sum, quantity) => sum + quantity, 0);
}

function getTaggedQuantity(card: { quantity?: number }) {
  const quantity = readNumber(card.quantity);
  return quantity > 0 ? quantity : 1;
}

function buildShellTopic(context: RecommendationContext): DeckRecommendationTopicEntry {
  const score = getShellScore(context);
  const strategy = context.strategy.mainStrategy;
  const synergy = readNumber(context.strategy.synergy?.synergyScore);
  const profileGap = getCommanderProfileSupportGap(context);
  const supportGap = Math.max(
    0,
    readNumber(context.strategy.synergy?.recommendations.supportTarget) -
      readNumber(context.strategy.synergy?.supportCards),
  );

  const needsUpgrade =
    context.bracket.targetAlignment !== "above" &&
    (!strategy ||
      profileGap >= 2 ||
      supportGap >= 2 ||
      (score < getTopicFloor("shell", context.targetBracket) && supportGap > 0.5));

  if (needsUpgrade) {
    const limit = getDesiredSuggestionCount(
      profileGap,
      supportGap,
      getScoreDeltaWeight(score, getTopicFloor("shell", context.targetBracket)),
      strategy ? 0 : 1.25,
    );
    const profileLibrary = getCommanderProfileUpgradeLibrary(context);
    const contextFitLibrary = getRecommanderTopicLibrary(context, "shell");
    const fallbackContextFitLibrary = getRecommanderCandidateLibrary(context, limit);
    const fallbackLibrary =
      contextFitLibrary.length > 0
        ? [...contextFitLibrary, ...SHELL_UP_CANDIDATES]
        : fallbackContextFitLibrary.length > 0
          ? [...fallbackContextFitLibrary, ...SHELL_UP_CANDIDATES]
          : SHELL_UP_CANDIDATES;
    const cards = profileLibrary.length > 0
      ? chooseCandidatesFromLibraries(profileLibrary, fallbackLibrary, context, limit)
      : contextFitLibrary.length > 0
        ? chooseCandidatesFromLibraries(contextFitLibrary, SHELL_UP_CANDIDATES, context, limit)
        : fallbackContextFitLibrary.length > 0
          ? chooseCandidatesFromLibraries(fallbackContextFitLibrary, SHELL_UP_CANDIDATES, context, limit)
          : chooseCandidates(SHELL_UP_CANDIDATES, context, { limit });
    const primaryProfile = getPrimaryCommanderProfileGap(context);
    const summary = primaryProfile
      ? `${primaryProfile.commanderName} asks for ${primaryProfile.label}, but the deck only shows ${primaryProfile.supportCount}/${primaryProfile.supportTarget} support cards.`
      : !strategy
      ? `The shell still needs a clearer main plan if it wants to land near ${getTargetLabel(context)}.`
      : `${strategy.label} is the clearest plan, but it still wants a little more dedicated glue than it has right now.`;
    return createTopicEntry("shell", summary, createCards("shell", cards, "up", context));
  }

  const needsDowngrade =
    context.bracket.targetAlignment === "above" &&
    score > getTopicCeiling("shell", context.targetBracket) &&
    !!strategy;

  if (needsDowngrade) {
    const cards = chooseCandidates(SHELL_DOWN_CANDIDATES, context, {
      limit: getDesiredSuggestionCount(
        getScoreDeltaWeight(score, getTopicCeiling("shell", context.targetBracket)),
        synergy >= 75 ? 1 : 0,
      ),
    });
    const summary = `${strategy?.label ?? "The shell"} is already denser than ${getTargetLabel(context)} usually asks for. A fairer support piece is the cleaner direction here.`;
    return createTopicEntry("shell", summary, createCards("shell", cards, "down", context));
  }

  return createTopicEntry(
    "shell",
    synergy > 0
      ? `The core plan is already readable enough for ${getTargetLabel(context)}.`
      : "No specific shell card stands out as a clean suggestion right now.",
    [],
  );
}

function buildLandBaseTopic(context: RecommendationContext): DeckRecommendationTopicEntry {
  const currentLands = readNumber(context.structure.counts.lands);
  const minLands = readNumber(context.structure.mana.recommendedLands.min);
  const maxLands = readNumber(context.structure.mana.recommendedLands.max);
  const alwaysTappedGap = Math.max(
    0,
    readNumber(context.landBase.counts.alwaysTapped) -
      readNumber(context.landBase.recommendations.alwaysTappedMax),
  );
  const colorlessGap = Math.max(
    0,
    readNumber(context.landBase.counts.colorlessOnly) -
      readNumber(context.landBase.recommendations.colorlessOnlyMax),
  );
  const costlyGap = Math.max(
    0,
    readNumber(context.landBase.counts.costly) -
      readNumber(context.landBase.recommendations.costlyMax),
  );
  const score = readNumber(context.landBase.landBaseScore);

  const needsUpgrade =
    context.bracket.targetAlignment !== "above" &&
    (currentLands < minLands ||
      alwaysTappedGap > 0 ||
      colorlessGap > 0 ||
      costlyGap > 0 ||
      score < getTopicFloor("land_base", context.targetBracket));

  if (needsUpgrade) {
    const cards = chooseLandBaseUpgradeCandidates(
      context,
      currentLands < minLands ? "count" : "quality",
      getDesiredSuggestionCount(
        Math.max(0, minLands - currentLands),
        countPositiveGaps(alwaysTappedGap, colorlessGap, costlyGap),
        getScoreDeltaWeight(score, getTopicFloor("land_base", context.targetBracket)),
      ),
    );
    const summary =
      currentLands < minLands
        ? `${currentLands} lands is light for a shell that wants roughly ${minLands}-${maxLands} lands.`
        : buildLandBaseIssueSummary(alwaysTappedGap, colorlessGap, costlyGap);
    return createTopicEntry("land_base", summary, createCards("land_base", cards, "up", context));
  }

  const needsDowngrade =
    context.bracket.targetAlignment === "above" &&
    score > getTopicCeiling("land_base", context.targetBracket);

  if (needsDowngrade) {
    const cards = chooseLandBaseDowngradeCandidates(
      context,
      getDesiredSuggestionCount(
        getScoreDeltaWeight(score, getTopicCeiling("land_base", context.targetBracket)),
        countPositiveGaps(alwaysTappedGap, colorlessGap, costlyGap),
      ),
    );
    return createTopicEntry(
      "land_base",
      `The mana base is cleaner and faster than ${getTargetLabel(context)} normally needs. A slower fixer can help keep the bracket in line.`,
      createCards("land_base", cards, "down", context),
    );
  }

  return createTopicEntry(
    "land_base",
    `The land count and fixing are already close to what ${getTargetLabel(context)} expects.`,
    [],
  );
}

function buildRampTopic(context: RecommendationContext): DeckRecommendationTopicEntry {
  const coreGap = Math.max(
    0,
    readNumber(context.ramp.recommendations.coreTarget) - readNumber(context.ramp.counts.core),
  );
  const stableGap = Math.max(
    0,
    readNumber(context.ramp.recommendations.stableTarget) - readNumber(context.ramp.counts.stable),
  );
  const score = readNumber(context.ramp.rampScore);
  const burst = readNumber(context.ramp.counts.burst);
  const compactnessGap = getEfficiencyUpgradeGap(context, "ramp");

  const rawNeedsUpgrade =
    coreGap >= 0.75 ||
    stableGap >= 0.75 ||
    (score < getTopicFloor("ramp", context.targetBracket) &&
      readNumber(context.ramp.counts.core) <
        readNumber(context.ramp.recommendations.coreTarget) + 1 &&
      readNumber(context.ramp.counts.stable) <
        readNumber(context.ramp.recommendations.stableTarget) + 1);
  const needsCompactUpgrade = compactnessGap > 0;
  const needsUpgrade =
    context.bracket.targetAlignment !== "above" && (rawNeedsUpgrade || needsCompactUpgrade);

  if (needsUpgrade) {
    const limit = getDesiredSuggestionCount(
      coreGap,
      stableGap,
      compactnessGap,
      getScoreDeltaWeight(score, getTopicFloor("ramp", context.targetBracket)),
    );
    const cards = chooseUpgradeCandidates("ramp", RAMP_UP_CANDIDATES, context, limit);
    const summary = rawNeedsUpgrade
      ? `The ramp package is short of the live target (${formatOneDecimal(
          readNumber(context.ramp.recommendations.coreTarget),
        )} core / ${formatOneDecimal(readNumber(context.ramp.recommendations.stableTarget))} stable).`
      : buildEfficiencySummary(context, "ramp");
    return createTopicEntry("ramp", summary, createCards("ramp", cards, "up", context));
  }

  const needsDowngrade =
    context.bracket.targetAlignment === "above" &&
    (score > getTopicCeiling("ramp", context.targetBracket) || burst >= 3);

  if (needsDowngrade) {
    const cards = chooseCandidates(RAMP_DOWN_CANDIDATES, context, {
      limit: getDesiredSuggestionCount(
        getScoreDeltaWeight(score, getTopicCeiling("ramp", context.targetBracket)),
        burst >= 3 ? 1 : 0,
      ),
    });
    return createTopicEntry(
      "ramp",
      `The ramp shell is developing faster than ${getTargetLabel(context)} usually needs. A fairer ramp slot is the cleanest way to step that back.`,
      createCards("ramp", cards, "down", context),
    );
  }

  return createTopicEntry(
    "ramp",
    `Ramp already looks close to the pace ${getTargetLabel(context)} wants.`,
    [],
  );
}

function buildCardFlowTopic(context: RecommendationContext): DeckRecommendationTopicEntry {
  const drawGap = Math.max(
    0,
    readNumber(context.draw.recommendations.drawTarget) - readNumber(context.draw.counts.draw),
  );
  const repeatableGap = Math.max(
    0,
    readNumber(context.draw.recommendations.repeatableTarget) -
      readNumber(context.draw.counts.repeatable),
  );
  const score = readNumber(context.draw.drawScore);
  const compactnessGap = getEfficiencyUpgradeGap(context, "card_flow");

  const rawNeedsUpgrade =
    drawGap >= 0.75 ||
    repeatableGap >= 0.5 ||
    score < getTopicFloor("card_flow", context.targetBracket);
  const needsCompactUpgrade = compactnessGap > 0;
  const needsUpgrade =
    context.bracket.targetAlignment !== "above" && (rawNeedsUpgrade || needsCompactUpgrade);

  if (needsUpgrade) {
    const limit = getDesiredSuggestionCount(
      drawGap,
      repeatableGap,
      compactnessGap,
      getScoreDeltaWeight(score, getTopicFloor("card_flow", context.targetBracket)),
    );
    const cards = chooseUpgradeCandidates("card_flow", CARD_FLOW_UP_CANDIDATES, context, limit);
    const summary =
      needsCompactUpgrade && !rawNeedsUpgrade
        ? buildEfficiencySummary(context, "card_flow")
        : repeatableGap > drawGap
          ? "The deck still leans heavily on one-shot draws and would like another steady card-flow piece."
          : "The shell is still light on clean card flow for the pace it is trying to play.";
    return createTopicEntry("card_flow", summary, createCards("card_flow", cards, "up", context));
  }

  const needsDowngrade =
    context.bracket.targetAlignment === "above" &&
    score > getTopicCeiling("card_flow", context.targetBracket);

  if (needsDowngrade) {
    const cards = chooseCandidates(CARD_FLOW_DOWN_CANDIDATES, context, {
      limit: getDesiredSuggestionCount(
        getScoreDeltaWeight(score, getTopicCeiling("card_flow", context.targetBracket)),
      ),
    });
    return createTopicEntry(
      "card_flow",
      `Card flow is already dense for ${getTargetLabel(context)}. A fairer draw piece can keep the deck moving without making every game more scripted.`,
      createCards("card_flow", cards, "down", context),
    );
  }

  return createTopicEntry(
    "card_flow",
    `Card flow is already in a workable range for ${getTargetLabel(context)}.`,
    [],
  );
}

function buildConsistencyTopic(context: RecommendationContext): DeckRecommendationTopicEntry {
  const score = readNumber(context.consistency.consistencyScore);
  const directCount = readNumber(context.consistency.counts.direct);
  const restrictedCount = readNumber(context.consistency.counts.restricted);
  const repeatableCount = readNumber(context.consistency.counts.repeatable);
  const directGap = Math.max(
    0,
    readNumber(context.consistency.recommendations.directTarget) - directCount,
  );
  const repeatableGap = Math.max(
    0,
    readNumber(context.consistency.recommendations.repeatableTarget) - repeatableCount,
  );
  const compactnessGap = getEfficiencyUpgradeGap(context, "consistency");

  const rawNeedsUpgrade =
    directGap >= 0.5 ||
    repeatableGap >= 0.5 ||
    score < getTopicFloor("consistency", context.targetBracket);
  const needsCompactUpgrade = compactnessGap > 0;
  const needsUpgrade =
    context.bracket.targetAlignment !== "above" &&
    context.targetBracket >= 3 &&
    (rawNeedsUpgrade || needsCompactUpgrade);

  if (needsUpgrade) {
    const limit = getDesiredSuggestionCount(
      directGap,
      repeatableGap,
      compactnessGap,
      getScoreDeltaWeight(score, getTopicFloor("consistency", context.targetBracket)),
    );
    const cards = chooseUpgradeCandidates(
      "consistency",
      CONSISTENCY_UP_CANDIDATES,
      context,
      limit,
    );
    return createTopicEntry(
      "consistency",
      needsCompactUpgrade && !rawNeedsUpgrade
        ? buildEfficiencySummary(context, "consistency")
        : "The deck still leans more on natural draws than its chosen bracket usually wants.",
      createCards("consistency", cards, "up", context),
    );
  }

  const hasTutorPressure =
    directCount > 0 ||
    restrictedCount > 0 ||
    repeatableCount > 0;
  const needsDowngrade =
    context.bracket.targetAlignment === "above" &&
    hasTutorPressure &&
    (score > getTopicCeiling("consistency", context.targetBracket) ||
      (context.targetBracket <= 2 && (directCount > 0 || restrictedCount > 0)));

  if (needsDowngrade) {
    const cards = chooseCandidates(CONSISTENCY_DOWN_CANDIDATES, context, {
      limit: getDesiredSuggestionCount(
        getScoreDeltaWeight(score, getTopicCeiling("consistency", context.targetBracket)),
        context.targetBracket <= 2 && hasTutorPressure
          ? directCount + restrictedCount * 0.75 + repeatableCount
          : 0,
      ),
    });
    return createTopicEntry(
      "consistency",
      `Tutor density is stronger than ${getTargetLabel(context)} usually needs. A fairer consistency piece is the cleaner adjustment.`,
      createCards("consistency", cards, "down", context),
    );
  }

  return createTopicEntry(
    "consistency",
    context.targetBracket >= 3
      ? `Consistency already reads close to the chosen target.`
      : `The chosen bracket does not need heavy tutor pressure, and the current shell is already close enough.`,
    [],
  );
}

function buildInteractionTopic(context: RecommendationContext): DeckRecommendationTopicEntry {
  const removalScore = readNumber(context.removal.removalScore);
  const stackScore = readNumber(context.spellInteraction.interactionScore);
  const combinedScore = average(removalScore, stackScore);
  const targetedGap = Math.max(
    0,
    readNumber(context.removal.recommendations.targetedTarget) -
      readNumber(context.removal.counts.targeted),
  );
  const hardGap = Math.max(
    0,
    readNumber(context.spellInteraction.recommendations.hardTarget) -
      readNumber(context.spellInteraction.counts.hard),
  );
  const compactnessGap = getEfficiencyUpgradeGap(context, "interaction");

  const rawNeedsUpgrade =
    targetedGap >= 0.75 ||
    (context.colorProfile.hasBlue && hardGap >= 0.5) ||
    combinedScore < getTopicFloor("interaction", context.targetBracket);
  const needsCompactUpgrade = compactnessGap > 0;
  const needsUpgrade =
    context.bracket.targetAlignment !== "above" && (rawNeedsUpgrade || needsCompactUpgrade);

  if (needsUpgrade) {
    const preferStack = context.colorProfile.hasBlue && stackScore + 5 < removalScore;
    const limit = getDesiredSuggestionCount(
      targetedGap,
      context.colorProfile.hasBlue ? hardGap : 0,
      compactnessGap,
      getScoreDeltaWeight(combinedScore, getTopicFloor("interaction", context.targetBracket)),
    );
    const contextFitLibrary = getRecommanderTopicLibrary(context, "interaction");
    const upgradeLibrary = getUpgradeLibrary("interaction", context);
    const cards = contextFitLibrary.length > 0
      ? chooseCandidatesFromLibraries(
          contextFitLibrary,
          [
            ...upgradeLibrary,
            ...(preferStack ? INTERACTION_UP_STACK_CANDIDATES : INTERACTION_UP_REMOVAL_CANDIDATES),
            ...(preferStack ? INTERACTION_UP_REMOVAL_CANDIDATES : INTERACTION_UP_STACK_CANDIDATES),
          ],
          context,
          limit,
        )
      : upgradeLibrary.length > 0
      ? chooseCandidatesFromLibraries(
          upgradeLibrary,
          INTERACTION_UP_REMOVAL_CANDIDATES,
          context,
          limit,
        )
      : preferStack
        ? chooseCandidatesFromLibraries(
            INTERACTION_UP_STACK_CANDIDATES,
            INTERACTION_UP_REMOVAL_CANDIDATES,
            context,
            limit,
          )
        : chooseCandidatesFromLibraries(
            INTERACTION_UP_REMOVAL_CANDIDATES,
            INTERACTION_UP_STACK_CANDIDATES,
            context,
            limit,
          );
    const summary =
      needsCompactUpgrade && !rawNeedsUpgrade
        ? buildEfficiencySummary(context, "interaction")
        : preferStack
          ? "The shell would like one more clean stack answer for the turns that matter most."
          : "The shell could answer opposing battlefield pieces more reliably with another efficient interaction slot.";
    return createTopicEntry("interaction", summary, createCards("interaction", cards, "up", context));
  }

  const needsDowngrade =
    context.bracket.targetAlignment === "above" &&
    combinedScore > getTopicCeiling("interaction", context.targetBracket);

  if (needsDowngrade) {
    const cards = chooseCandidates(INTERACTION_DOWN_CANDIDATES, context, {
      limit: getDesiredSuggestionCount(
        getScoreDeltaWeight(combinedScore, getTopicCeiling("interaction", context.targetBracket)),
      ),
    });
    return createTopicEntry(
      "interaction",
      `The answer suite is already strong enough to matter at faster tables. A fairer interaction slot would pull the deck closer to ${getTargetLabel(context)}.`,
      createCards("interaction", cards, "down", context),
    );
  }

  return createTopicEntry(
    "interaction",
    `Interaction already sits near the level ${getTargetLabel(context)} expects.`,
    [],
  );
}

function buildResilienceTopic(context: RecommendationContext): DeckRecommendationTopicEntry {
  const protectionScore = readNumber(context.protection.protectionScore);
  const recursionScore = readNumber(context.recursion.recursionScore);
  const combinedScore = average(protectionScore, recursionScore);
  const commanderDependency = readNumber(context.commander.dependencyScore);
  const protectionGap = Math.max(
    0,
    readNumber(context.protection.recommendations?.coreTarget) -
      readNumber(context.protection.counts?.core),
  );
  const recursionGap = Math.max(
    0,
    readNumber(context.recursion.recommendations?.coreTarget) -
      readNumber(context.recursion.counts?.core),
  );

  const needsUpgrade =
    context.bracket.targetAlignment !== "above" &&
    (protectionGap >= 0.5 ||
      recursionGap >= 0.5 ||
      combinedScore < getTopicFloor("resilience", context.targetBracket) ||
      (commanderDependency >= 60 && protectionScore < getTopicFloor("resilience", context.targetBracket) + 10));

  if (needsUpgrade) {
    const preferProtection = commanderDependency >= 60 || protectionScore <= recursionScore;
    const limit = getDesiredSuggestionCount(
      protectionGap,
      recursionGap,
      getScoreDeltaWeight(combinedScore, getTopicFloor("resilience", context.targetBracket)),
      commanderDependency >= 60 ? 0.75 : 0,
    );
    const contextFitLibrary = getRecommanderTopicLibrary(context, "resilience");
    const cards = contextFitLibrary.length > 0
      ? chooseCandidatesFromLibraries(
          contextFitLibrary,
          [
            ...(preferProtection ? RESILIENCE_UP_PROTECTION_CANDIDATES : RESILIENCE_UP_RECURSION_CANDIDATES),
            ...(preferProtection ? RESILIENCE_UP_RECURSION_CANDIDATES : RESILIENCE_UP_PROTECTION_CANDIDATES),
          ],
          context,
          limit,
        )
      : preferProtection
      ? chooseCandidatesFromLibraries(
          RESILIENCE_UP_PROTECTION_CANDIDATES,
          RESILIENCE_UP_RECURSION_CANDIDATES,
          context,
          limit,
        )
      : chooseCandidatesFromLibraries(
          RESILIENCE_UP_RECURSION_CANDIDATES,
          RESILIENCE_UP_PROTECTION_CANDIDATES,
          context,
          limit,
        );
    const summary = preferProtection
      ? "The main engine matters enough that one cleaner protection slot would noticeably improve the shell."
      : "The shell would like one more way to recover a key piece after trading resources.";
    return createTopicEntry("resilience", summary, createCards("resilience", cards, "up", context));
  }

  const needsDowngrade =
    context.bracket.targetAlignment === "above" &&
    combinedScore > getTopicCeiling("resilience", context.targetBracket);

  if (needsDowngrade) {
    const cards = chooseCandidates(RESILIENCE_DOWN_CANDIDATES, context, {
      limit: getDesiredSuggestionCount(
        getScoreDeltaWeight(combinedScore, getTopicCeiling("resilience", context.targetBracket)),
      ),
    });
    return createTopicEntry(
      "resilience",
      `The shell is already very good at protecting or rebuilding key pieces. A fairer resilience slot would better fit ${getTargetLabel(context)}.`,
      createCards("resilience", cards, "down", context),
    );
  }

  return createTopicEntry(
    "resilience",
    `Protection and recovery are already in a workable range for ${getTargetLabel(context)}.`,
    [],
  );
}

function buildClosingTopic(context: RecommendationContext): DeckRecommendationTopicEntry {
  const score = readNumber(context.winConditions.finisherScore);
  const coreGap = Math.max(
    0,
    readNumber(context.winConditions.recommendations?.coreTarget) -
      readNumber(context.winConditions.counts?.core),
  );
  const exactCombos = readNumber(context.winConditions.combos.exactCount);
  const needsUpgrade =
    context.bracket.targetAlignment !== "above" &&
    (!context.winStrategy.primaryPlan ||
      coreGap >= 0.75 ||
      score < getTopicFloor("closing", context.targetBracket));

  if (needsUpgrade) {
    const limit = getDesiredSuggestionCount(
      coreGap,
      getScoreDeltaWeight(score, getTopicFloor("closing", context.targetBracket)),
      context.winStrategy.primaryPlan ? 0 : 1,
    );
    const contextFitLibrary = getRecommanderTopicLibrary(context, "closing");
    const cards = contextFitLibrary.length > 0
      ? chooseCandidatesFromLibraries(
          contextFitLibrary,
          CLOSING_UP_CANDIDATES,
          context,
          limit,
        )
      : chooseClosingCandidates(context, "up", limit);
    const summary = !context.winStrategy.primaryPlan
      ? `The deck still needs a cleaner win line if it wants to reach ${getTargetLabel(context)} consistently.`
      : `${context.winStrategy.primaryPlan.label} is the current finish, but it still wants a more reliable closer.`;
    return createTopicEntry("closing", summary, createCards("closing", cards, "up", context));
  }

  const needsDowngrade =
    context.bracket.targetAlignment === "above" &&
    (score > getTopicCeiling("closing", context.targetBracket) ||
      (context.targetBracket <= 3 && exactCombos > 0));

  if (needsDowngrade) {
    const cards = chooseClosingCandidates(
      context,
      "down",
      getDesiredSuggestionCount(
        getScoreDeltaWeight(score, getTopicCeiling("closing", context.targetBracket)),
        context.targetBracket <= 3 && exactCombos > 0 ? 1 : 0,
      ),
    );
    const summary =
      exactCombos > 0 && context.targetBracket <= 3
        ? `Fast combo closing is a big reason this shell reads above ${getTargetLabel(context)}. A slower finisher is the cleaner direction.`
        : `Closing power is stronger than the chosen bracket usually needs. A slower finisher would keep the deck closer to its target.`;
    return createTopicEntry("closing", summary, createCards("closing", cards, "down", context));
  }

  return createTopicEntry(
    "closing",
    `The deck's finishers already look close to the pace ${getTargetLabel(context)} wants.`,
    [],
  );
}

function chooseLandBaseUpgradeCandidates(
  context: RecommendationContext,
  mode: "count" | "quality",
  limit: number,
): RecommendationLibraryEntry[] {
  const candidates: RecommendationLibraryEntry[] = [];
  const contextFitLibrary = getRecommanderTopicLibrary(context, "land_base");

  if (mode === "count") {
    if (context.colorProfile.colorCount >= 2 && !hasDeckCard(context, "Command Tower")) {
      candidates.push({
        name: "Command Tower",
        idealBracket: 3,
        reason: "it raises the land count and gives multicolor decks the cleanest untapped fixer available.",
      });
    }

    if (
      context.colorProfile.colorCount >= 2 &&
      !hasDeckCard(context, "Exotic Orchard") &&
      context.targetBracket >= 2
    ) {
      candidates.push({
        name: "Exotic Orchard",
        idealBracket: 2,
        reason: "it adds to the land count while still fixing multiple colors untapped in most pods.",
      });
    }

    if (
      context.colorProfile.colorCount >= 2 &&
      !hasDeckCard(context, "Path of Ancestry") &&
      (getCreatureCount(context) >= 24 || context.strategy.mainStrategy?.key === "kindred")
    ) {
      candidates.push({
        name: "Path of Ancestry",
        idealBracket: 2,
        reason: "it adds another land slot while still helping creature-heavy shells line up their colors.",
      });
    }

    candidates.push({
      name: chooseBasicLand(context),
      idealBracket: 1,
      allowDuplicates: true,
      reason: "another land slot raises the deck's land-drop floor and makes the overall shell more stable.",
    });

    return contextFitLibrary.length > 0
      ? chooseCandidatesFromLibraries(contextFitLibrary, candidates, context, limit)
      : choosePreparedCandidates(context, candidates, limit);
  }

  if (context.colorProfile.colorCount >= 2 && !hasDeckCard(context, "Command Tower")) {
    candidates.push({
      name: "Command Tower",
      idealBracket: 3,
      reason: "it is the cleanest untapped fixer for a multicolor Commander deck.",
    });
  }

  if (
    context.colorProfile.colorCount >= 2 &&
    !hasDeckCard(context, "Exotic Orchard") &&
    context.targetBracket >= 2
  ) {
    candidates.push({
      name: "Exotic Orchard",
      idealBracket: 2,
      reason: "it usually fixes multiple colors untapped in real Commander pods.",
    });
  }

  if (
    context.colorProfile.colorCount >= 2 &&
    !hasDeckCard(context, "Path of Ancestry") &&
    (getCreatureCount(context) >= 24 || context.strategy.mainStrategy?.key === "kindred")
  ) {
    candidates.push({
      name: "Path of Ancestry",
      idealBracket: 2,
      reason: "it gives multicolor creature shells a slower fixer that still keeps colors lined up well.",
    });
  }

  candidates.push({
    name: chooseBasicLand(context),
    idealBracket: 1,
    allowDuplicates: true,
    reason: "a basic land is often the cleanest way to reduce strain from slow or colorless land slots.",
  });

  return contextFitLibrary.length > 0
    ? chooseCandidatesFromLibraries(contextFitLibrary, candidates, context, limit)
    : choosePreparedCandidates(context, candidates, limit);
}

function chooseLandBaseDowngradeCandidates(
  context: RecommendationContext,
  limit: number,
): RecommendationLibraryEntry[] {
  const candidates: RecommendationLibraryEntry[] = [];

  if (context.colorProfile.colorCount >= 2 && !hasDeckCard(context, "Evolving Wilds")) {
    candidates.push({
      name: "Evolving Wilds",
      idealBracket: 1,
      reason: "it keeps fixing functional while giving up some of the mana base's current speed.",
    });
  }

  if (context.colorProfile.colorCount >= 2 && !hasDeckCard(context, "Terramorphic Expanse")) {
    candidates.push({
      name: "Terramorphic Expanse",
      idealBracket: 1,
      reason: "it still fixes colors, but at a more casual pace for lower-bracket tables.",
    });
  }

  if (!hasDeckCard(context, "Myriad Landscape")) {
    candidates.push({
      name: "Myriad Landscape",
      idealBracket: 2,
      reason: "it is a fairer land slot that still supports color development over time.",
    });
  }

  candidates.push({
    name: chooseBasicLand(context),
    idealBracket: 1,
    allowDuplicates: true,
    reason: "a basic land is the cleanest way to step away from a highly tuned mana base.",
  });

  return choosePreparedCandidates(context, candidates, limit);
}

function chooseClosingCandidates(
  context: RecommendationContext,
  direction: DeckRecommendationDirection,
  limit: number,
) {
  const library =
    direction === "up" ? CLOSING_UP_CANDIDATES : CLOSING_DOWN_CANDIDATES;
  const targetedLibrary = library.filter((entry) =>
    matchesStrategyOrPlan(entry, context.strategy.mainStrategy?.key, context.winStrategy.primaryPlan?.key),
  );

  return chooseCandidatesFromLibraries(
    targetedLibrary,
    library,
    context,
    limit,
  );
}

function getRecommanderCandidateLibrary(
  context: RecommendationContext,
  limit: number,
): RecommendationLibraryEntry[] {
  if (!context.recommander || context.bracket.targetAlignment === "above" || limit <= 0) {
    return [];
  }

  const maxRank = getMaxRecommanderRankForTarget(context.targetBracket);
  return context.recommander.cards
    .filter((card) => card.rank <= maxRank)
    .filter((card) => !hasDeckCard(context, card.name))
    .filter((card) => !context.usedSuggestionNames.has(card.normalizedName))
    .filter((card) => !isBasicLandName(card.name))
    .slice(0, Math.max(limit * 2, limit))
    .map((card) => createRecommanderLibraryEntry(card, context));
}

async function buildRecommanderTopicLibraries(
  context: RecommendationContext,
): Promise<Map<DeckRecommendationTopic, RecommendationLibraryEntry[]>> {
  const libraries = new Map<DeckRecommendationTopic, RecommendationLibraryEntry[]>();

  if (!context.recommander || context.bracket.targetAlignment === "above") {
    return libraries;
  }

  const maxRank = getMaxRecommanderRankForTarget(context.targetBracket);
  const candidates = context.recommander.cards
    .filter((card) => card.rank <= maxRank)
    .filter((card) => !hasDeckCard(context, card.name))
    .filter((card) => !context.usedSuggestionNames.has(card.normalizedName))
    .filter((card) => !isBasicLandName(card.name))
    .slice(0, RECOMMENDER_CLASSIFICATION_LIMIT);

  const classified = await mapWithConcurrency(
    candidates,
    RECOMMENDER_CLASSIFICATION_CONCURRENCY,
    async (candidate) => {
      const scryfallCard = await fetchRecommendationCard(candidate.name);
      const topics = scryfallCard ? classifyRecommendationCard(scryfallCard) : new Set<DeckRecommendationTopic>(["shell"]);

      if (topics.size === 0) {
        topics.add("shell");
      }

      return {
        candidate,
        entry: createRecommanderLibraryEntry(candidate, context, [...topics], scryfallCard),
        topics,
      };
    },
  );

  for (const item of classified) {
    for (const topic of item.topics) {
      const entries = libraries.get(topic) ?? [];
      entries.push(item.entry);
      libraries.set(topic, entries);
    }
  }

  for (const [topic, entries] of libraries) {
    libraries.set(
      topic,
      entries.sort(
        (left, right) =>
          (left.recommanderRank ?? Number.POSITIVE_INFINITY) -
            (right.recommanderRank ?? Number.POSITIVE_INFINITY) ||
          (right.recommanderScore ?? 0) - (left.recommanderScore ?? 0),
      ),
    );
  }

  return libraries;
}

function createRecommanderLibraryEntry(
  card: RecommanderCardRecommendation,
  context: RecommendationContext,
  topicHints: DeckRecommendationTopic[] = [],
  scryfallCard: ScryfallCard | null = null,
): RecommendationLibraryEntry {
  const strategyKeys = scryfallCard ? [...classifyRecommendationStrategyKeys(scryfallCard)] : [];

  return {
    name: card.name,
    idealBracket: context.targetBracket,
    source: "recommander",
    oracleId: card.oracleId,
    recommanderScore: card.score,
    recommanderRank: card.rank,
    priority: Math.max(1, 6 - Math.ceil(card.rank / 4)),
    topicHints,
    strategyKeys: strategyKeys.length > 0 ? strategyKeys : undefined,
    requiredColors: scryfallCard?.color_identity?.length ? scryfallCard.color_identity : undefined,
    reason: buildRecommanderCandidateReason(card, topicHints),
  };
}

function buildRecommanderCandidateReason(
  card: RecommanderCardRecommendation,
  topicHints: DeckRecommendationTopic[],
) {
  const topicLabels = topicHints
    .filter((topic) => topic !== "shell")
    .map((topic) => TOPIC_ORDER.find((entry) => entry.key === topic)?.label ?? topic)
    .slice(0, 2);

  if (topicLabels.length > 0) {
    return `the context model ranks it #${card.rank} for this exact commander and current card package, and its rules text reads as ${topicLabels.join(" / ")} support rather than a generic staple.`;
  }

  return `the context model ranks it #${card.rank} for this exact commander and current card package, so it looks like a card that belongs with this shell rather than a generic staple.`;
}

async function fetchRecommendationCard(name: string): Promise<ScryfallCard | null> {
  const cacheKey = normalizeText(name);
  if (!cacheKey) {
    return null;
  }

  if (recommendationCardCache.has(cacheKey)) {
    return recommendationCardCache.get(cacheKey) ?? null;
  }

  try {
    const response = await fetch(`${SCRYFALL_NAMED_URL}?exact=${encodeURIComponent(name)}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "mtg-deckchecker/0.1",
      },
      signal: AbortSignal.timeout(4_000),
    });

    if (!response.ok) {
      recommendationCardCache.set(cacheKey, null);
      return null;
    }

    const card = (await response.json()) as ScryfallCard;
    recommendationCardCache.set(cacheKey, card);
    return card;
  } catch {
    recommendationCardCache.set(cacheKey, null);
    return null;
  }
}

function classifyRecommendationCard(card: ScryfallCard) {
  const topics = new Set<DeckRecommendationTopic>();
  const profile = inferAdvancedRoleProfile(card);

  if (hasCardType(card, "Land")) {
    topics.add("land_base");
  }

  if (hasAnyRole(profile, ["ramp", "stable_ramp", "land_acceleration", "burst_ramp", "cost_reduction", "mana_fixing"])) {
    topics.add("ramp");
  }

  if (hasAnyRole(profile, ["draw", "direct_draw", "repeatable_draw", "repeatable_advantage", "selection"])) {
    topics.add("card_flow");
  }

  if (hasAnyRole(profile, ["tutor", "direct_tutor", "restricted_tutor", "repeatable_tutor", "land_tutor"])) {
    topics.add("consistency");
  }

  if (
    hasAnyRole(profile, [
      "removal",
      "targeted_removal",
      "mass_removal",
      "tempo_removal",
      "hand_attack",
      "stack",
      "hard_stack",
      "soft_stack",
      "spell_tempo",
      "broad_stack",
      "hate_piece",
      "graveyard_hate",
    ])
  ) {
    topics.add("interaction");
  }

  if (
    hasAnyRole(profile, [
      "protection",
      "broad_protection",
      "targeted_protection",
      "equipment_protection",
      "self_bounce",
      "flicker",
      "rescue_protection",
      "recursion",
      "battlefield_recursion",
      "hand_recursion",
      "replay_recursion",
      "mass_recursion",
      "library_recursion",
    ])
  ) {
    topics.add("resilience");
  }

  if (
    hasAnyRole(profile, [
      "finisher",
      "combat_finisher",
      "direct_finisher",
      "alternate_finisher",
      "repeatable_finisher",
    ])
  ) {
    topics.add("closing");
  }

  if (topics.size === 0 || hasAnyRole(profile, getShellRoleNames())) {
    topics.add("shell");
  }

  return topics;
}

function classifyRecommendationStrategyKeys(card: ScryfallCard) {
  const keys = new Set<StrategyKey>();
  const profile = inferAdvancedRoleProfile(card);
  const text = getRecommendationCardText(card);

  if (hasCardType(card, "Planeswalker")) {
    keys.add("superfriends");
  }

  if (hasAnyRole(profile, ["token_support"])) {
    keys.add("tokens");
  }

  if (hasAnyRole(profile, ["sacrifice_support"])) {
    keys.add("aristocrats");
  }

  if (hasAnyRole(profile, ["counter_support"])) {
    keys.add("counters");
  }

  if (hasAnyRole(profile, ["kindred_support"])) {
    keys.add("kindred");
  }

  if (hasAnyRole(profile, ["artifact_support", "cost_reduction"]) && /artifact/.test(text)) {
    keys.add("artifacts");
  }

  if (hasAnyRole(profile, ["enchantment_support"]) || /\benchantment\b|\baura\b|\bsaga\b|\broom\b/.test(text)) {
    keys.add("enchantress");
  }

  if (hasAnyRole(profile, ["face_down_support"]) || /\bface-down\b|\bface up\b|\bmorph\b|\bmanifest\b|\bcloak\b|\bdisguise\b/.test(text)) {
    keys.add("face_down");
  }

  if (hasAnyRole(profile, ["dice_support"])) {
    keys.add("dice_rolls");
  }

  if (hasAnyRole(profile, ["coin_support", "coin_flip_support"])) {
    keys.add("coin_flip");
  }

  if (hasAnyRole(profile, ["theft_support"]) || /\bgain control of\b|\byou control but don't own\b/.test(text)) {
    keys.add("theft");
  }

  if (hasAnyRole(profile, ["combat_support"]) && /\bequipment\b|\baura\b|\bequipped\b|\benchanted\b/.test(text)) {
    keys.add("voltron");
  }

  if (hasAnyRole(profile, ["lifegain_support"]) || /\bwhenever you gain life\b|\blifelink\b/.test(text)) {
    keys.add("lifegain");
  }

  if (hasAnyRole(profile, ["mill_support"]) || /\bmill\b/.test(text)) {
    keys.add("mill");
  }

  if (hasAnyRole(profile, ["copy_support"]) || /\bcopy\b|\btoken that's a copy\b/.test(text)) {
    keys.add("copy_clone");
  }

  if (hasAnyRole(profile, ["land_synergy"]) || /\blandfall\b|\bplay an additional land\b|\bplay lands? from\b/.test(text)) {
    keys.add("lands_matter");
  }

  if (hasAnyRole(profile, ["flash_enabler"]) || /\bflash\b|\bas though (?:it|they) had flash\b/.test(text)) {
    keys.add("control");
  }

  if (hasAnyRole(profile, ["board_buff"]) || /\bcreatures? you control get\b|\bcreatures? you control have\b/.test(text)) {
    keys.add("aggro");
  }

  if (hasAnyRole(profile, ["replacement_engine", "multiplier_support"]) || /\badditional time\b|\btwice\b|\bdouble\b/.test(text)) {
    keys.add("counters");
  }

  if (/\bbeginning of (?:your|each|that player's) upkeep\b|\badditional upkeep\b|\bcumulative upkeep\b/.test(text)) {
    keys.add("extra_upkeep");
  }

  if (/\btap target\b|\buntap\b|\bstun counters?\b|\bbecomes tapped\b|\btapped creatures? your opponents control\b/.test(text)) {
    keys.add("tap_untap");
  }

  if (/\btreasure\b/.test(text)) {
    keys.add("treasure");
  }

  if (/\bfood\b/.test(text)) {
    keys.add("food");
  }

  if (/\bclue\b|\binvestigate\b/.test(text)) {
    keys.add("clues");
  }

  if (/\benergy counters?\b|\{e\}/.test(text)) {
    keys.add("energy");
  }

  if (/\bmonarch\b/.test(text)) {
    keys.add("monarch");
  }

  if (/\bgoad\b|\bgoaded\b/.test(text)) {
    keys.add("goad");
  }

  if (/\bshrine\b/.test(text)) {
    keys.add("shrines");
  }

  if (/\bcycling\b/.test(text)) {
    keys.add("cycling");
  }

  if (/\bmutate\b|\bmutates?\b/.test(text)) {
    keys.add("mutate");
  }

  if (/\bpoison counters?\b|\binfect\b|\btoxic\b|\bcorrupted\b/.test(text)) {
    keys.add("poison");
  }

  if (/\bbattle\b|\bdefense counters?\b/.test(text)) {
    keys.add("battles");
  }

  if (/\bcan't attack you\b|\bcan't attack unless\b|\bprevent all (?:combat )?damage\b/.test(text)) {
    keys.add("pillowfort");
  }

  if (/\bstax\b|\bcan't cast\b|\bcan't activate\b|\bspells cost\b|\benter the battlefield tapped\b/.test(text)) {
    keys.add("stax");
  }

  if (/\beach opponent loses\b|\bdeals? \d+ damage to each opponent\b/.test(text)) {
    keys.add("group_slug");
  }

  return keys;
}

function hasAnyRole(profile: ReturnType<typeof inferAdvancedRoleProfile>, roles: string[]) {
  return roles.some((role) => getRoleWeight(profile, role) > 0);
}

function getShellRoleNames() {
  return [
    "token_support",
    "combat_support",
    "kindred_support",
    "counter_support",
    "sacrifice_support",
    "lifegain_support",
    "artifact_support",
    "enchantment_support",
    "face_down_support",
    "dice_support",
    "coin_flip_support",
    "replacement_engine",
    "theft",
    "cheat",
    "flash_enabler",
    "board_buff",
  ];
}

function getRecommanderTopicLibrary(
  context: RecommendationContext,
  topic: DeckRecommendationTopic,
) {
  return context.recommanderTopicLibraries.get(topic) ?? [];
}

function getCommanderProfileUpgradeLibrary(context: RecommendationContext) {
  const profileGaps = getCommanderProfileGaps(context);
  if (profileGaps.length === 0) {
    return [];
  }

  const profileKeys = new Set(profileGaps.map((profile) => profile.key));
  const library = new Map<string, RecommendationLibraryEntry>();
  const addCandidate = (candidate: RecommendationLibraryEntry, priorityBoost = 0) => {
    if (!candidate.strategyKeys?.some((key) => profileKeys.has(key))) {
      return;
    }

    const normalizedName = normalizeText(candidate.name);
    const gapPriority = getCandidateProfileGapPriority(candidate, profileGaps);
    const existing = library.get(normalizedName);
    const boosted = {
      ...candidate,
      priority: (candidate.priority ?? 0) + priorityBoost + gapPriority,
      reason: buildCommanderProfileCandidateReason(candidate, profileGaps) ?? candidate.reason,
    };

    if (!existing || (boosted.priority ?? 0) > (existing.priority ?? 0)) {
      library.set(normalizedName, boosted);
    }
  };

  for (const candidates of context.recommanderTopicLibraries.values()) {
    for (const candidate of candidates) {
      addCandidate(candidate, candidate.source === "recommander" ? 2 : 0);
    }
  }

  for (const candidate of SHELL_UP_CANDIDATES) {
    addCandidate(candidate, 1);
  }

  return [...library.values()];
}

function getCandidateProfileGapPriority(
  candidate: RecommendationLibraryEntry,
  profiles: NonNullable<RecommendationContext["commander"]["profiles"]>,
) {
  const matchedProfiles = profiles.filter((profile) => candidate.strategyKeys?.includes(profile.key));
  if (matchedProfiles.length === 0) {
    return 0;
  }

  const biggestGap = Math.max(
    ...matchedProfiles.map((profile) =>
      Math.max(0, readNumber(profile.supportTarget) - readNumber(profile.supportCount)),
    ),
  );
  return Math.min(5, biggestGap / 2);
}

function buildCommanderProfileCandidateReason(
  candidate: RecommendationLibraryEntry,
  profiles: NonNullable<RecommendationContext["commander"]["profiles"]>,
) {
  const profile = profiles.find((entry) => candidate.strategyKeys?.includes(entry.key));
  if (!profile) {
    return null;
  }

  return `${candidate.reason} It directly supports ${profile.commanderName}'s ${profile.label}: the profile is only at ${profile.supportCount}/${profile.supportTarget} support cards.`;
}

function getMatchingCommanderProfileForCandidate(
  context: RecommendationContext,
  candidate: RecommendationLibraryEntry,
) {
  return getCommanderProfileGaps(context).find((profile) =>
    candidate.strategyKeys?.includes(profile.key),
  ) ?? null;
}

function getMaxRecommanderRankForTarget(targetBracket: DeckBracketNumber) {
  switch (targetBracket) {
    case 1:
      return 4;
    case 2:
      return 8;
    case 3:
      return 14;
    case 4:
      return 22;
    case 5:
      return 32;
  }
}

function chooseUpgradeCandidates(
  topic: EfficiencyTopic,
  fallbackLibrary: RecommendationLibraryEntry[],
  context: RecommendationContext,
  limit: number,
) {
  const upgradeLibrary = getUpgradeLibrary(topic, context);
  const contextFitLibrary = getRecommanderTopicLibrary(context, topic);

  if (contextFitLibrary.length > 0) {
    return chooseCandidatesFromLibraries(
      contextFitLibrary,
      [...upgradeLibrary, ...fallbackLibrary],
      context,
      limit,
    );
  }

  if (upgradeLibrary.length === 0) {
    return chooseCandidates(fallbackLibrary, context, { limit });
  }

  return chooseCandidatesFromLibraries(upgradeLibrary, fallbackLibrary, context, limit);
}

function getUpgradeLibrary(topic: EfficiencyTopic, context: RecommendationContext) {
  if (context.targetBracket < 4) {
    return [];
  }

  return STAPLE_UP_CANDIDATES[topic].filter(
    (candidate) =>
      candidate.idealBracket <= context.targetBracket && isCandidateLegal(candidate, context),
  );
}

function chooseCandidatesFromLibraries(
  preferredLibrary: RecommendationLibraryEntry[],
  fallbackLibrary: RecommendationLibraryEntry[],
  context: RecommendationContext,
  limit: number,
) {
  const prepared: RecommendationLibraryEntry[] = [];
  const excludedNames = new Set<string>();

  const preferred = chooseCandidates(preferredLibrary, context, {
    limit,
    reserve: false,
    excludeNames: excludedNames,
  });
  for (const candidate of preferred) {
    prepared.push(candidate);
    excludedNames.add(normalizeText(candidate.name));
  }

  if (prepared.length < limit) {
    const fallback = chooseCandidates(fallbackLibrary, context, {
      limit: limit - prepared.length,
      reserve: false,
      excludeNames: excludedNames,
    });
    for (const candidate of fallback) {
      prepared.push(candidate);
      excludedNames.add(normalizeText(candidate.name));
    }
  }

  reserveCandidates(context, prepared);
  return prepared;
}

function choosePreparedCandidates(
  context: RecommendationContext,
  candidates: RecommendationLibraryEntry[],
  limit: number,
) {
  const prepared: RecommendationLibraryEntry[] = [];

  for (const candidate of candidates) {
    const normalizedName = normalizeText(candidate.name);
    if (context.usedSuggestionNames.has(normalizedName)) {
      continue;
    }

    if (!isCandidateLegal(candidate, context)) {
      continue;
    }

    prepared.push(candidate);
    if (prepared.length >= limit) {
      break;
    }
  }

  reserveCandidates(context, prepared);
  return prepared;
}

function chooseCandidates(
  library: RecommendationLibraryEntry[],
  context: RecommendationContext,
  options: {
    limit?: number;
    reserve?: boolean;
    excludeNames?: Set<string>;
  } = {},
) {
  const limit = Math.max(0, options.limit ?? 1);
  const candidates = rankCandidates(library, context, options.excludeNames)
    .slice(0, limit)
    .map((entry) => entry.candidate);

  if (options.reserve !== false) {
    reserveCandidates(context, candidates);
  }

  return candidates;
}

function rankCandidates(
  library: RecommendationLibraryEntry[],
  context: RecommendationContext,
  excludeNames: Set<string> = new Set<string>(),
) {
  return library
    .map((candidate, index) => ({
      candidate,
      index,
      edhrecMatch: getEdhrecCandidateMatch(candidate, context),
      recommanderMatch: getRecommanderCandidateMatch(candidate, context),
      fitScore: getCandidateFitScore(candidate, context),
      commanderSpecificScore: getCommanderSpecificSuggestionScore(candidate, context),
    }))
    .filter((entry) => {
      const normalizedName = normalizeText(entry.candidate.name);
      if (context.usedSuggestionNames.has(normalizedName) || excludeNames.has(normalizedName)) {
        return false;
      }

      return isCandidateLegal(entry.candidate, context);
    })
    .sort((left, right) => {
      if (left.commanderSpecificScore !== right.commanderSpecificScore) {
        return right.commanderSpecificScore - left.commanderSpecificScore;
      }

      const leftDelta = Math.abs(left.candidate.idealBracket - context.targetBracket);
      const rightDelta = Math.abs(right.candidate.idealBracket - context.targetBracket);

      if (leftDelta !== rightDelta) {
        return leftDelta - rightDelta;
      }

      if (left.fitScore !== right.fitScore) {
        return right.fitScore - left.fitScore;
      }

      const leftCandidatePriority = left.candidate.priority ?? 0;
      const rightCandidatePriority = right.candidate.priority ?? 0;

      if (leftCandidatePriority !== rightCandidatePriority) {
        return rightCandidatePriority - leftCandidatePriority;
      }

      const leftContextRank = left.recommanderMatch?.rank ?? Number.POSITIVE_INFINITY;
      const rightContextRank = right.recommanderMatch?.rank ?? Number.POSITIVE_INFINITY;

      if (leftContextRank !== rightContextRank) {
        return leftContextRank - rightContextRank;
      }

      const leftListed = left.edhrecMatch ? 1 : 0;
      const rightListed = right.edhrecMatch ? 1 : 0;

      if (leftListed !== rightListed) {
        return rightListed - leftListed;
      }

      const leftPriority = left.edhrecMatch?.priority ?? 0;
      const rightPriority = right.edhrecMatch?.priority ?? 0;

      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }

      const leftSynergy = left.edhrecMatch?.synergy ?? Number.NEGATIVE_INFINITY;
      const rightSynergy = right.edhrecMatch?.synergy ?? Number.NEGATIVE_INFINITY;

      if (leftSynergy !== rightSynergy) {
        return rightSynergy - leftSynergy;
      }

      const leftSpecificity =
        (left.candidate.requiredColors?.length ?? 0) +
        (left.candidate.strategyKeys?.length ?? 0) +
        (left.candidate.winPlanKeys?.length ?? 0);
      const rightSpecificity =
        (right.candidate.requiredColors?.length ?? 0) +
        (right.candidate.strategyKeys?.length ?? 0) +
        (right.candidate.winPlanKeys?.length ?? 0);

      return rightSpecificity - leftSpecificity || left.index - right.index;
    });
}

function reserveCandidates(
  context: RecommendationContext,
  candidates: RecommendationLibraryEntry[],
) {
  for (const candidate of candidates) {
    context.usedSuggestionNames.add(normalizeText(candidate.name));
  }
}

function getDesiredSuggestionCount(...severitySignals: number[]) {
  const severity = severitySignals.reduce((sum, value) => sum + Math.max(0, value), 0);

  if (severity >= 4) {
    return MAX_TOPIC_SUGGESTIONS;
  }

  if (severity >= 1.5) {
    return MAX_TOPIC_SUGGESTIONS;
  }

  return 1;
}

function getScoreDeltaWeight(score: number, target: number) {
  return Math.max(0, Math.abs(target - score)) / 12;
}

function countPositiveGaps(...values: number[]) {
  return values.filter((value) => value > 0).length;
}

function createCards(
  topicKey: DeckRecommendationTopic,
  candidates: RecommendationLibraryEntry[],
  direction: DeckRecommendationDirection,
  context: RecommendationContext,
) {
  return candidates.map((candidate) => createCard(topicKey, candidate, direction, context));
}

function isCandidateLegal(candidate: RecommendationLibraryEntry, context: RecommendationContext) {
  if (!candidate.allowDuplicates && hasDeckCard(context, candidate.name)) {
    return false;
  }

  if (candidate.multicolorOnly && context.colorProfile.colorCount < 2) {
    return false;
  }

  if (candidate.monoColorOnly && !context.colorProfile.isMonoColor) {
    return false;
  }

  if (
    candidate.requiredColors &&
    !candidate.requiredColors.every((color) => context.colorProfile.colors.includes(color))
  ) {
    return false;
  }

  if (
    candidate.source !== "recommander" &&
    candidate.strategyKeys?.length &&
    !candidate.strategyKeys.some((key) => getStrategyKeys(context).has(key))
  ) {
    return false;
  }

  if (
    candidate.winPlanKeys?.length &&
    !candidate.winPlanKeys.some((key) => getWinPlanKeys(context).has(key))
  ) {
    return false;
  }

  if (candidate.predicate && !candidate.predicate(context)) {
    return false;
  }

  return true;
}

function matchesStrategyOrPlan(
  candidate: RecommendationLibraryEntry,
  strategyKey?: StrategyKey | null,
  winPlanKey?: WinStrategyKey | null,
) {
  if (candidate.winPlanKeys?.includes(winPlanKey ?? "value_attrition")) {
    return true;
  }

  if (candidate.strategyKeys?.includes(strategyKey ?? "aggro")) {
    return true;
  }

  return false;
}

function hasDeckCard(context: RecommendationContext, name: string) {
  return context.normalizedDeckNames.has(normalizeText(name));
}

function chooseBasicLand(context: RecommendationContext) {
  const basicCounts = new Map<string, number>();

  for (const card of context.mainboardLands) {
    if (!isBasicLandName(card.card.name)) {
      continue;
    }

    basicCounts.set(card.card.name, (basicCounts.get(card.card.name) ?? 0) + card.quantity);
  }

  const mostPlayedBasic = [...basicCounts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
  )[0]?.[0];

  if (mostPlayedBasic) {
    return mostPlayedBasic;
  }

  if (context.colorProfile.hasWhite) {
    return "Plains";
  }

  if (context.colorProfile.hasBlue) {
    return "Island";
  }

  if (context.colorProfile.hasBlack) {
    return "Swamp";
  }

  if (context.colorProfile.hasRed) {
    return "Mountain";
  }

  if (context.colorProfile.hasGreen) {
    return "Forest";
  }

  return "Wastes";
}

function buildLandBaseIssueSummary(alwaysTappedGap: number, colorlessGap: number, costlyGap: number) {
  if (colorlessGap >= alwaysTappedGap && colorlessGap >= costlyGap && colorlessGap > 0) {
    return "The mana base is carrying too many color-straining lands right now.";
  }

  if (alwaysTappedGap >= costlyGap && alwaysTappedGap > 0) {
    return "Too many lands are slowing the early turns by entering tapped.";
  }

  if (costlyGap > 0) {
    return "Some land slots are asking too much life or setup from the deck.";
  }

  return "A cleaner land slot would make the mana base line up better with the rest of the shell.";
}

function summarizeRecommendations(
  context: RecommendationContext,
  topics: DeckRecommendationTopicEntry[],
) {
  const cardCount = topics.reduce((sum, topic) => sum + topic.cards.length, 0);
  const targetLabel = getTargetLabel(context);

  if (cardCount === 0) {
    if (context.bracket.targetAlignment === "above") {
      return `No single swap clearly brings the deck back toward ${targetLabel}. This likely needs a few package-level changes instead.`;
    }

    return `No obvious single-card suggestion stands out right now. The current shell is already close to ${targetLabel}.`;
  }

  if (context.bracket.targetAlignment === "above") {
    return `These are lower-pressure replacements aimed at bringing the deck back toward ${targetLabel}.`;
  }

  if (context.bracket.targetAlignment === "below") {
    return `These upgrades focus on the weakest parts of the deck and move it toward ${targetLabel}.`;
  }

  return `These topic suggestions clean up the weakest current pillars while keeping the shell close to ${targetLabel}.`;
}

function createTopicEntry(
  key: DeckRecommendationTopic,
  summary: string,
  cards: DeckRecommendationCard[],
): DeckRecommendationTopicEntry {
  return {
    key,
    label: TOPIC_ORDER.find((topic) => topic.key === key)?.label ?? "Suggestion",
    summary,
    cards,
  };
}

function limitRecommendationCards(
  context: RecommendationContext,
  topics: DeckRecommendationTopicEntry[],
) {
  let remaining = MAX_TOTAL_RECOMMENDATION_CARDS;
  const allocations = new Map<DeckRecommendationTopic, number>();
  const prioritizedTopics = topics
    .map((topic, index) => ({
      topic,
      index,
      urgency: getRecommendationTopicUrgency(context, topic.key),
    }))
    .filter((entry) => entry.topic.cards.length > 0)
    .sort(
      (left, right) =>
        right.urgency - left.urgency ||
        right.topic.cards.length - left.topic.cards.length ||
        left.index - right.index,
    );

  for (const entry of prioritizedTopics) {
    if (remaining <= 0) {
      break;
    }

    const count = Math.min(entry.topic.cards.length, remaining);
    allocations.set(entry.topic.key, count);
    remaining -= count;
  }

  return topics.map((topic) => {
    const allowedCount = allocations.get(topic.key) ?? 0;
    if (allowedCount >= topic.cards.length) {
      return topic;
    }

    return {
      ...topic,
      cards: topic.cards.slice(0, allowedCount),
    };
  });
}

function getRecommendationTopicUrgency(
  context: RecommendationContext,
  topicKey: DeckRecommendationTopic,
) {
  const scoreDelta = getRecommendationTopicScoreDelta(context, topicKey);
  const targetGap = getRecommendationTopicTargetGap(context, topicKey);
  const efficiencyGap = isEfficiencyTopic(topicKey)
    ? context.efficiency[topicKey].gap * 20
    : 0;
  return roundTo(scoreDelta + targetGap + efficiencyGap, 2);
}

function getRecommendationTopicScoreDelta(
  context: RecommendationContext,
  topicKey: DeckRecommendationTopic,
) {
  const score = getRecommendationTopicScore(context, topicKey);
  if (context.bracket.targetAlignment === "above") {
    return getScoreDeltaWeight(score, getTopicCeiling(topicKey, context.targetBracket));
  }

  return getScoreDeltaWeight(score, getTopicFloor(topicKey, context.targetBracket));
}

function getRecommendationTopicScore(
  context: RecommendationContext,
  topicKey: DeckRecommendationTopic,
) {
  switch (topicKey) {
    case "shell":
      return readFiniteNumberOrDefault(
        context.strategy.synergy?.synergyScore,
        getTopicFloor("shell", context.targetBracket),
      );
    case "land_base":
      return readNumber(context.landBase.landBaseScore);
    case "ramp":
      return readNumber(context.ramp.rampScore);
    case "card_flow":
      return readNumber(context.draw.drawScore);
    case "consistency":
      return readNumber(context.consistency.consistencyScore);
    case "interaction":
      return average(
        readNumber(context.removal.removalScore),
        readNumber(context.spellInteraction.interactionScore),
      );
    case "resilience":
      return average(
        readNumber(context.protection.protectionScore),
        readNumber(context.commander.dependencyScore),
      );
    case "closing":
      return readNumber(context.winConditions.finisherScore);
  }
}

function readFiniteNumberOrDefault(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getRecommendationTopicTargetGap(
  context: RecommendationContext,
  topicKey: DeckRecommendationTopic,
) {
  switch (topicKey) {
    case "shell":
      return Math.max(
        0,
        readNumber(context.strategy.synergy?.recommendations.supportTarget) -
          readNumber(context.strategy.synergy?.supportCards),
      ) / 4;
    case "land_base":
      return Math.max(
        0,
        readNumber(context.structure.mana.recommendedLands.min) -
          readNumber(context.structure.counts.lands),
        readNumber(context.landBase.counts.alwaysTapped) -
          readNumber(context.landBase.recommendations.alwaysTappedMax),
        readNumber(context.landBase.counts.colorlessOnly) -
          readNumber(context.landBase.recommendations.colorlessOnlyMax),
        readNumber(context.landBase.counts.costly) -
          readNumber(context.landBase.recommendations.costlyMax),
      );
    case "ramp":
      return Math.max(
        0,
        readNumber(context.ramp.recommendations.coreTarget) - readNumber(context.ramp.counts.core),
        readNumber(context.ramp.recommendations.stableTarget) -
          readNumber(context.ramp.counts.stable),
      ) / 2;
    case "card_flow":
      return Math.max(
        0,
        readNumber(context.draw.recommendations.drawTarget) - readNumber(context.draw.counts.draw),
        readNumber(context.draw.recommendations.repeatableTarget) -
          readNumber(context.draw.counts.repeatable),
      ) / 2;
    case "consistency":
      return Math.max(
        0,
        readNumber(context.consistency.recommendations.directTarget) -
          readNumber(context.consistency.counts.direct),
        readNumber(context.consistency.recommendations.repeatableTarget) -
          readNumber(context.consistency.counts.repeatable),
      );
    case "interaction":
      return Math.max(
        0,
        readNumber(context.removal.recommendations.targetedTarget) -
          readNumber(context.removal.counts.targeted),
        readNumber(context.spellInteraction.recommendations.hardTarget) -
          readNumber(context.spellInteraction.counts.hard),
      ) / 2;
    case "resilience":
      return Math.max(
        0,
        readNumber(context.protection.recommendations?.coreTarget) -
          readNumber(context.protection.counts?.core),
        readNumber(context.recursion.recommendations?.coreTarget) -
          readNumber(context.recursion.counts?.core),
      ) / 2;
    case "closing":
      return Math.max(
        0,
        readNumber(context.winConditions.recommendations?.coreTarget) -
          readNumber(context.winConditions.counts?.core),
      ) / 2;
  }
}

function createCard(
  topicKey: DeckRecommendationTopic,
  candidate: RecommendationLibraryEntry,
  direction: DeckRecommendationDirection,
  context: RecommendationContext,
): DeckRecommendationCard {
  const recommanderMatch = getRecommanderCandidateMatch(candidate, context);
  const recommanderRank = candidate.recommanderRank ?? recommanderMatch?.rank;
  const recommanderScore = candidate.recommanderScore ?? recommanderMatch?.score;
  const source = candidate.source === "recommander" ? "recommander" : "library";

  return {
    key: `${topicKey}-${direction}-${normalizeText(candidate.name)}`,
    name: candidate.name,
    reason: buildRecommendationReason(topicKey, candidate, direction, context),
    direction,
    source,
    sourceLabel: buildRecommendationSourceLabel(candidate, recommanderMatch),
    oracleId: candidate.oracleId ?? recommanderMatch?.oracleId ?? null,
    recommanderRank,
    recommanderScore,
  };
}

function buildRecommendationSourceLabel(
  candidate: RecommendationLibraryEntry,
  recommanderMatch: RecommanderCardRecommendation | null,
) {
  const rank = candidate.recommanderRank ?? recommanderMatch?.rank;
  const score = candidate.recommanderScore ?? recommanderMatch?.score;

  if (!rank || !score) {
    return candidate.source === "recommander" ? "Recommander" : undefined;
  }

  const scoreLabel = `${Math.round(score * 100)}%`;
  return candidate.source === "recommander"
    ? `Recommander #${rank} · ${scoreLabel}`
    : `Recommander fit #${rank} · ${scoreLabel}`;
}

function buildRecommendationReason(
  topicKey: DeckRecommendationTopic,
  candidate: RecommendationLibraryEntry,
  direction: DeckRecommendationDirection,
  context: RecommendationContext,
) {
  const lead = buildRecommendationLead(topicKey, candidate, direction, context);
  const body = capitalizeFirst(polishRecommendationText(candidate.reason));
  const recommanderNote = buildRecommanderRecommendationNote(candidate, direction, context);
  const edhrecNote = buildEdhrecRecommendationNote(candidate, direction, context);
  return [lead, body, recommanderNote, edhrecNote].filter(Boolean).join(" ");
}

function polishRecommendationText(text: string) {
  const replacements: Array<[RegExp, string]> = [
    [
      /\bit compresses several turns of mana into one card\b/gi,
      "it turns one card into a much faster mana start",
    ],
    [
      /\bit can compress several redundant lines into one instant-speed search effect\b/gi,
      "it can replace several redundant cards with one instant-speed search effect",
    ],
    [
      /\bit compresses multiple planeswalker turns into one payoff turn\b/gi,
      "it turns multiple planeswalker activations into one payoff turn",
    ],
    [
      /\bwithout tutor-level compression\b/gi,
      "without becoming a full tutor",
    ],
    [
      /\bat a lower compression level\b/gi,
      "at a slower, less explosive pace",
    ],
    [
      /\bdoes not compress games\b/gi,
      "does not speed games up",
    ],
    [/\bslot-efficient\b/gi, "efficient"],
    [/\bslot efficiency\b/gi, "efficiency"],
    [/\bmuch more compact than\b/gi, "more efficient than"],
    [/\bcompact\b/gi, "efficient"],
    [/\bfrom one slot\b/gi, "from one card"],
    [/\bone cheap slot\b/gi, "one cheap card"],
    [/\bone high-impact slot\b/gi, "one high-impact card"],
    [/\bone efficient engine slot\b/gi, "one efficient engine card"],
    [/\bengine slot\b/gi, "engine card"],
    [/\bramp slot\b/gi, "ramp card"],
    [/\bdraw slot\b/gi, "draw card"],
    [/\bprotection slot\b/gi, "protection card"],
    [/\bresilience slot\b/gi, "resilience card"],
    [/\binteraction slot\b/gi, "interaction card"],
    [/\bone slot\b/gi, "one card"],
    [/\bover-tightening\b/gi, "over-tuning"],
    [/\bsharper\b/gi, "stronger"],
    [/\bsharpest\b/gi, "strongest"],
    [/\btightens\b/gi, "focuses"],
    [/\btighten\b/gi, "focus"],
    [/\btightening\b/gi, "making"],
  ];

  return replacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
}

function buildRecommendationLead(
  topicKey: DeckRecommendationTopic,
  candidate: RecommendationLibraryEntry,
  direction: DeckRecommendationDirection,
  context: RecommendationContext,
) {
  if (direction === "up" && isEfficiencyTopic(topicKey)) {
    const profile = context.efficiency[topicKey];
    if (context.targetBracket >= 4 && profile.gap >= 0.14 && profile.slots > 0) {
      return `${getEfficiencyTopicLabel(topicKey)} is spread across ${formatOneDecimal(
        profile.slots,
      )} cards for ${formatOneDecimal(
        profile.value,
      )} measured value (${formatOneDecimal(
        profile.efficiency,
      )} per card). ${getTargetLabel(context)} wants about ${formatOneDecimal(
        profile.target,
      )} per card, so one stronger card helps more than another medium piece.`;
    }
  }

  switch (topicKey) {
    case "shell": {
      const matchingProfile = getMatchingCommanderProfileForCandidate(context, candidate);
      const strategyLabel = context.strategy.mainStrategy?.label ?? "current shell";
      const supportCards = readNumber(context.strategy.synergy?.supportCards);
      const supportTarget = readNumber(context.strategy.synergy?.recommendations.supportTarget);
      if (direction === "down") {
        return `${strategyLabel} already has ${supportCards} measured support cards and is pushing above ${getTargetLabel(context)} on shell density.`;
      }

      if (matchingProfile) {
        return `${matchingProfile.commanderName} is asking for ${matchingProfile.label}, currently at ${matchingProfile.supportCount}/${matchingProfile.supportTarget} support cards.`;
      }

      if (!context.strategy.mainStrategy) {
        return `The list still needs a clearer measured shell if it wants to land near ${getTargetLabel(context)}.`;
      }

      return `${strategyLabel} currently has ${supportCards} measured support cards against a target of about ${formatOneDecimal(supportTarget)}.`;
    }
    case "land_base": {
      const currentLands = readNumber(context.structure.counts.lands);
      const minLands = readNumber(context.structure.mana.recommendedLands.min);
      const maxLands = readNumber(context.structure.mana.recommendedLands.max);
      const alwaysTapped = readNumber(context.landBase.counts.alwaysTapped);
      const alwaysTappedMax = readNumber(context.landBase.recommendations.alwaysTappedMax);
      const colorless = readNumber(context.landBase.counts.colorlessOnly);
      const colorlessMax = readNumber(context.landBase.recommendations.colorlessOnlyMax);
      const costly = readNumber(context.landBase.counts.costly);
      const costlyMax = readNumber(context.landBase.recommendations.costlyMax);

      if (direction === "down") {
        return `The mana base is already cleaner than ${getTargetLabel(context)} needs, so this slot can afford a slower fixer.`;
      }

      if (currentLands < minLands) {
        return `The deck is at ${currentLands} lands while the current curve wants roughly ${minLands}-${maxLands}.`;
      }

      if (alwaysTapped > alwaysTappedMax) {
        return `The mana base is carrying ${alwaysTapped} always-tapped lands against a target max of ${alwaysTappedMax}.`;
      }

      if (colorless > colorlessMax) {
        return `The mana base is carrying ${colorless} color-straining lands against a target max of ${colorlessMax}.`;
      }

      if (costly > costlyMax) {
        return `The mana base is asking for too much life or setup with ${costly} costly lands against a target max of ${costlyMax}.`;
      }

      return `The land base still needs a cleaner slot to line up with ${getTargetLabel(context)}.`;
    }
    case "ramp": {
      const core = readNumber(context.ramp.counts.core);
      const stable = readNumber(context.ramp.counts.stable);
      const burst = readNumber(context.ramp.counts.burst);
      const coreTarget = readNumber(context.ramp.recommendations.coreTarget);
      const stableTarget = readNumber(context.ramp.recommendations.stableTarget);
      if (direction === "down") {
        return `Ramp is already at ${formatOneDecimal(core)} core / ${formatOneDecimal(stable)} stable with ${formatOneDecimal(burst)} burst pieces, which is more acceleration than ${getTargetLabel(context)} usually needs.`;
      }

      return `Ramp is currently at ${formatOneDecimal(core)} core / ${formatOneDecimal(stable)} stable against targets of ${formatOneDecimal(coreTarget)} / ${formatOneDecimal(stableTarget)}.`;
    }
    case "card_flow": {
      const draw = readNumber(context.draw.counts.draw);
      const repeatable = readNumber(context.draw.counts.repeatable);
      const drawTarget = readNumber(context.draw.recommendations.drawTarget);
      const repeatableTarget = readNumber(context.draw.recommendations.repeatableTarget);
      if (direction === "down") {
        return `Card flow is already at ${formatOneDecimal(draw)} total / ${formatOneDecimal(repeatable)} repeatable, which is denser than ${getTargetLabel(context)} usually asks for.`;
      }

      return `Card flow is sitting at ${formatOneDecimal(draw)} total / ${formatOneDecimal(repeatable)} repeatable against targets of ${formatOneDecimal(drawTarget)} / ${formatOneDecimal(repeatableTarget)}.`;
    }
    case "consistency": {
      const direct = readNumber(context.consistency.counts.direct);
      const restricted = readNumber(context.consistency.counts.restricted);
      const repeatable = readNumber(context.consistency.counts.repeatable);
      const directTarget = readNumber(context.consistency.recommendations.directTarget);
      const repeatableTarget = readNumber(context.consistency.recommendations.repeatableTarget);
      if (direction === "down") {
        const tutorPressure = [
          direct > 0 ? `${formatOneDecimal(direct)} direct` : "",
          restricted > 0 ? `${formatOneDecimal(restricted)} restricted` : "",
          repeatable > 0 ? `${formatOneDecimal(repeatable)} repeatable` : "",
        ].filter(Boolean);
        if (tutorPressure.length > 0) {
          return `Consistency is already showing ${tutorPressure.join(" / ")} tutor pressure, which is stronger than ${getTargetLabel(context)} wants.`;
        }

        return `Consistency is above ${getTargetLabel(context)} mostly from smoothing and card access, so this is a softer replacement rather than a tutor downgrade.`;
      }

      return `Consistency is at ${formatOneDecimal(direct)} direct tutors / ${formatOneDecimal(repeatable)} repeatable pieces against targets of ${formatOneDecimal(directTarget)} / ${formatOneDecimal(repeatableTarget)}.`;
    }
    case "interaction": {
      const targeted = readNumber(context.removal.counts.targeted);
      const targetedTarget = readNumber(context.removal.recommendations.targetedTarget);
      const hard = readNumber(context.spellInteraction.counts.hard);
      const hardTarget = readNumber(context.spellInteraction.recommendations.hardTarget);
      if (direction === "down") {
        return `The answer suite is already above ${getTargetLabel(context)} on both battlefield and stack coverage.`;
      }

      return `Interaction is currently at ${formatOneDecimal(targeted)} targeted answers and ${formatOneDecimal(hard)} hard stack answers against targets of ${formatOneDecimal(targetedTarget)} and ${formatOneDecimal(hardTarget)}.`;
    }
    case "resilience": {
      const protection = readNumber(context.protection.counts?.core);
      const protectionTarget = readNumber(context.protection.recommendations?.coreTarget);
      const recursion = readNumber(context.recursion.counts?.core);
      const recursionTarget = readNumber(context.recursion.recommendations?.coreTarget);
      const dependency = readNumber(context.commander.dependencyScore);
      if (direction === "down") {
        return `Protection and recovery are already stronger than ${getTargetLabel(context)} really needs.`;
      }

      if (dependency >= 60) {
        return `Commander dependency is ${formatOneDecimal(dependency)}, so protection matters more than it would in a generic shell.`;
      }

      return `Resilience is sitting at ${formatOneDecimal(protection)} protection pieces and ${formatOneDecimal(recursion)} recursion pieces against targets of ${formatOneDecimal(protectionTarget)} and ${formatOneDecimal(recursionTarget)}.`;
    }
    case "closing": {
      const primaryPlan = context.winStrategy.primaryPlan?.label;
      const core = readNumber(context.winConditions.counts?.core);
      const coreTarget = readNumber(context.winConditions.recommendations?.coreTarget);
      if (direction === "down") {
        return `Closing power is already above ${getTargetLabel(context)}, so this is a cleaner place to take a little pressure off the finish.`;
      }

      if (!primaryPlan) {
        return `The deck still does not have a clearly measured main win line.`;
      }

      return `${primaryPlan} is the current finish, but the list is only showing ${formatOneDecimal(core)} core closing pieces against a target of about ${formatOneDecimal(coreTarget)}.`;
    }
    default:
      return "";
  }
}

function isEfficiencyTopic(topic: DeckRecommendationTopic): topic is EfficiencyTopic {
  return (
    topic === "ramp" ||
    topic === "card_flow" ||
    topic === "consistency" ||
    topic === "interaction"
  );
}

function buildEdhrecRecommendationNote(
  candidate: RecommendationLibraryEntry,
  direction: DeckRecommendationDirection,
  context: RecommendationContext,
) {
  const match = getEdhrecCandidateMatch(candidate, context);

  if (!match) {
    return "";
  }

  const location =
    match.pageLabel === "All"
      ? "the commander page"
      : `the ${match.pageLabel} commander page`;

  if (direction === "down" && context.bracket.targetAlignment === "above") {
    return `EDHREC also lists it on ${location}, so it still fits the commander while stepping the deck down a notch.`;
  }

  if (match.priority >= 3 && match.synergy > 0) {
    return `EDHREC also shows it at +${formatOneDecimal(match.synergy * 100)}% synergy on ${location}.`;
  }

  return `EDHREC also lists it on ${location}, which makes it a cleaner commander-specific fit than a generic add.`;
}

function buildRecommanderRecommendationNote(
  candidate: RecommendationLibraryEntry,
  direction: DeckRecommendationDirection,
  context: RecommendationContext,
) {
  if (direction === "down") {
    return "";
  }

  const match = getRecommanderCandidateMatch(candidate, context);
  if (!match) {
    return "";
  }

  if (candidate.source === "recommander") {
    return `This is a deck-context suggestion from Recommander, not just a commander-page staple.`;
  }

  return `Recommander also ranks it #${match.rank} for this exact card package, which is useful confirmation that it fits the 99.`;
}

function getEdhrecCandidateMatch(
  candidate: RecommendationLibraryEntry,
  context: RecommendationContext,
) {
  const card = context.edhrec?.cardsByName.get(normalizeText(candidate.name));

  if (!card) {
    return null;
  }

  return {
    card,
    pageLabel: context.edhrec?.pageLabel ?? "All",
    priority: getEdhrecPriority(card),
    synergy: card.synergy ?? Number.NEGATIVE_INFINITY,
  };
}

function getRecommanderCandidateMatch(
  candidate: RecommendationLibraryEntry,
  context: RecommendationContext,
) {
  return context.recommander?.cardsByName.get(normalizeText(candidate.name)) ?? null;
}

function getEdhrecPriority(card: EdhrecCommanderCard) {
  if (card.listTags.includes("highsynergycards")) {
    return 3;
  }

  if (card.listTags.includes("topcards")) {
    return 2;
  }

  return 1;
}

function getShellScore(context: RecommendationContext) {
  return average(
    readNumber(context.structure.structureScore),
    readNumber(context.strategy.synergy?.synergyScore || context.structure.structureScore),
  );
}

function getTopicFloor(topic: DeckRecommendationTopic, bracket: DeckBracketNumber) {
  return TOPIC_FLOORS[topic][bracket];
}

function getTopicCeiling(topic: DeckRecommendationTopic, bracket: DeckBracketNumber) {
  return TOPIC_CEILINGS[topic][bracket];
}

function getEfficiencyUpgradeGap(context: RecommendationContext, topic: EfficiencyTopic) {
  const profile = context.efficiency[topic];

  if (context.targetBracket < 4 || profile.slots <= 0 || getUpgradeLibrary(topic, context).length === 0) {
    return 0;
  }

  return profile.gap >= 0.14 ? profile.gap * 2.4 : 0;
}

function buildEfficiencySummary(context: RecommendationContext, topic: EfficiencyTopic) {
  const profile = context.efficiency[topic];
  const label = getEfficiencyTopicLabel(topic);

  return `${label} is spread across ${formatOneDecimal(
    profile.slots,
  )} cards for ${formatOneDecimal(profile.value)} measured value (${formatOneDecimal(
    profile.efficiency,
  )} per card). ${getTargetLabel(
    context,
  )} wants about ${formatOneDecimal(profile.target)} per card, so one stronger card helps more than another medium piece.`;
}

function getEfficiencyTopicLabel(topic: EfficiencyTopic) {
  switch (topic) {
    case "ramp":
      return "Ramp";
    case "card_flow":
      return "Card flow";
    case "consistency":
      return "Consistency";
    case "interaction":
      return "Interaction";
  }
}

function getTargetLabel(context: RecommendationContext) {
  return context.bracket.targetLabel
    ? `${context.bracket.targetLabel} (${context.bracket.targetName})`
    : context.bracket.recommendedLabel;
}

function getStrategyKeys(context: RecommendationContext) {
  const keys = new Set<StrategyKey>();
  if (context.strategy.mainStrategy?.key) {
    keys.add(context.strategy.mainStrategy.key);
  }
  for (const entry of context.strategy.subStrategies ?? []) {
    keys.add(entry.key);
  }
  for (const profile of context.commander.profiles ?? []) {
    if (profile.confidence >= 25 || profile.supportCount > 0) {
      keys.add(profile.key);
    }
  }
  return keys;
}

function getWinPlanKeys(context: RecommendationContext) {
  const keys = new Set<WinStrategyKey>();
  if (context.winStrategy.primaryPlan?.key) {
    keys.add(context.winStrategy.primaryPlan.key);
  }
  for (const plan of context.winStrategy.backupPlans ?? []) {
    keys.add(plan.key);
  }
  return keys;
}

function hasRelevantStrategy(context: RecommendationContext, keys: StrategyKey[]) {
  const strategyKeys = getStrategyKeys(context);
  return keys.some((key) => strategyKeys.has(key));
}

function hasRelevantWinPlan(context: RecommendationContext, keys: WinStrategyKey[]) {
  const winPlanKeys = getWinPlanKeys(context);
  return keys.some((key) => winPlanKeys.has(key));
}

function getCandidateFitScore(
  candidate: RecommendationLibraryEntry,
  context: RecommendationContext,
) {
  let score = 0;
  const recommanderMatch = getRecommanderCandidateMatch(candidate, context);
  const mainStrategyKey = context.strategy.mainStrategy?.key ?? null;
  const primaryPlanKey = context.winStrategy.primaryPlan?.key ?? null;

  if (mainStrategyKey && candidate.strategyKeys?.includes(mainStrategyKey)) {
    score = Math.max(score, isCommanderSpecificStrategy(mainStrategyKey) ? 4.6 : 3.4);
  }

  const commanderProfileKeys = getCommanderProfileKeys(context);
  if (candidate.strategyKeys?.some((key) => commanderProfileKeys.has(key))) {
    score = Math.max(score, 4.9);
  }

  if (primaryPlanKey && candidate.winPlanKeys?.includes(primaryPlanKey)) {
    score = Math.max(score, 3.2);
  }

  if (candidate.strategyKeys?.some((key) => (context.strategy.subStrategies ?? []).some((entry) => entry.key === key))) {
    score = Math.max(score, 2);
  }

  if (candidate.winPlanKeys?.some((key) => (context.winStrategy.backupPlans ?? []).some((plan) => plan.key === key))) {
    score = Math.max(score, 2);
  }

  if (candidate.strategyKeys?.some((key) => (context.strategy.topStrategies ?? []).some((entry) => entry.key === key))) {
    score = Math.max(score, 1);
  }

  if (recommanderMatch) {
    score += getRecommanderFitBonus(recommanderMatch);
  }

  const edhrecMatch = getEdhrecCandidateMatch(candidate, context);
  if (edhrecMatch) {
    score += getEdhrecFitBonus(edhrecMatch);
  }

  score += getCommanderThemeFitBonus(candidate, context);
  score -= getCommanderThemeDilutionPenalty(candidate, context);

  return roundTo(score, 2);
}

function getCommanderSpecificSuggestionScore(
  candidate: RecommendationLibraryEntry,
  context: RecommendationContext,
) {
  let score = 0;
  const recommanderMatch = getRecommanderCandidateMatch(candidate, context);
  const edhrecMatch = getEdhrecCandidateMatch(candidate, context);

  if (candidate.source === "recommander") {
    score += 2;
  }

  const profileKeys = getCommanderProfileKeys(context);
  if (candidate.strategyKeys?.some((key) => profileKeys.has(key))) {
    score += 2.4;
  }

  if (recommanderMatch) {
    score += getRecommanderFitBonus(recommanderMatch);
  }

  if (edhrecMatch) {
    score += getEdhrecFitBonus(edhrecMatch);
  }

  return roundTo(score, 2);
}

function getEdhrecFitBonus(match: ReturnType<typeof getEdhrecCandidateMatch>) {
  if (!match) {
    return 0;
  }

  const synergyBonus = match.synergy > 0 ? Math.min(2.5, match.synergy * 5) : 0;
  return roundTo(match.priority + synergyBonus, 2);
}

function isCommanderSpecificStrategy(key: StrategyKey) {
  return [
    "face_down",
    "power_matter",
    "mana_value_matter",
    "x_spells",
    "legends_matter",
    "toughness_matter",
    "pingers",
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
    "extra_upkeep",
    "tap_untap",
  ].includes(key);
}

function getCommanderThemeFitBonus(
  candidate: RecommendationLibraryEntry,
  context: RecommendationContext,
) {
  const mainStrategyKey = context.strategy.mainStrategy?.key;
  const profileKeys = getCommanderProfileKeys(context);
  if (candidate.strategyKeys?.some((key) => profileKeys.has(key))) {
    return 1.8;
  }

  if (!mainStrategyKey || !isCommanderSpecificStrategy(mainStrategyKey)) {
    return 0;
  }

  if (candidate.strategyKeys?.includes(mainStrategyKey)) {
    return 1.2;
  }

  if (candidate.source === "recommander") {
    return 0.8;
  }

  if (candidate.winPlanKeys?.includes(context.winStrategy.primaryPlan?.key ?? "value_attrition")) {
    return 0.35;
  }

  return 0;
}

function getCommanderThemeDilutionPenalty(
  candidate: RecommendationLibraryEntry,
  context: RecommendationContext,
) {
  const mainStrategyKey = context.strategy.mainStrategy?.key;
  const profileKeys = getCommanderProfileKeys(context);
  if (candidate.strategyKeys?.some((key) => profileKeys.has(key))) {
    return 0;
  }

  if (!mainStrategyKey || !isCommanderSpecificStrategy(mainStrategyKey)) {
    return 0;
  }

  if (candidate.strategyKeys?.includes(mainStrategyKey) || candidate.source === "recommander") {
    return 0;
  }

  if (!candidate.strategyKeys?.length && !candidate.winPlanKeys?.length) {
    return context.bracket.targetAlignment === "below" ? 0.8 : 0.45;
  }

  return 0.25;
}

function getCommanderProfileKeys(context: RecommendationContext) {
  return new Set(
    (context.commander.profiles ?? [])
      .filter((profile) => profile.confidence >= 35 || profile.supportCount > 0)
      .map((profile) => profile.key),
  );
}

function getCommanderProfileSupportGap(context: RecommendationContext) {
  return Math.max(
    0,
    ...getCommanderProfileGaps(context).map((profile) =>
      Math.max(0, readNumber(profile.supportTarget) - readNumber(profile.supportCount)),
    ),
  );
}

function getPrimaryCommanderProfileGap(context: RecommendationContext) {
  return getCommanderProfileGaps(context)[0] ?? null;
}

function getCommanderProfileGaps(context: RecommendationContext) {
  return [...(context.commander.profiles ?? [])]
    .filter((profile) => readNumber(profile.supportCount) < readNumber(profile.supportTarget))
    .sort((left, right) => {
      const leftGap = readNumber(left.supportTarget) - readNumber(left.supportCount);
      const rightGap = readNumber(right.supportTarget) - readNumber(right.supportCount);
      return rightGap - leftGap || right.confidence - left.confidence;
    });
}

function getRecommanderFitBonus(match: RecommanderCardRecommendation) {
  if (match.rank <= 3) {
    return 4.5;
  }

  if (match.rank <= 8) {
    return 3.5;
  }

  if (match.rank <= 16) {
    return 2.5;
  }

  if (match.rank <= 32) {
    return 1.5;
  }

  return match.score >= 0.78 ? 1 : 0.5;
}

function getCreatureCount(context: RecommendationContext) {
  return readNumber(context.structure.counts.creatures);
}

function getCardTypeCount(context: RecommendationContext, type: string) {
  return context.mainboardCards.reduce(
    (sum, card) => sum + (hasCardType(card.card, type) ? readNumber(card.quantity) : 0),
    0,
  );
}

function getInstantSorceryCount(context: RecommendationContext) {
  return getCardTypeCount(context, "Instant") + getCardTypeCount(context, "Sorcery");
}

function getArtifactCount(context: RecommendationContext) {
  return getCardTypeCount(context, "Artifact");
}

function getEnchantmentCount(context: RecommendationContext) {
  return getCardTypeCount(context, "Enchantment");
}

function hasCheapLegendaryCommander(context: RecommendationContext) {
  return context.deckCards.some(
    (card) =>
      card.section === "commander" &&
      card.card.type_line.includes("Legendary") &&
      readNumber(card.card.cmc) <= 2,
  );
}

function getAverageNonlandManaValue(context: RecommendationContext) {
  const nonlandCards = context.mainboardCards.filter((card) => !hasCardType(card.card, "Land"));
  const quantity = nonlandCards.reduce((sum, card) => sum + readNumber(card.quantity), 0);

  if (quantity <= 0) {
    return 0;
  }

  const totalManaValue = nonlandCards.reduce(
    (sum, card) => sum + readNumber(card.card.cmc) * readNumber(card.quantity),
    0,
  );

  return totalManaValue / quantity;
}

function isBasicLandName(name: string) {
  return BASIC_LANDS.includes(name as (typeof BASIC_LANDS)[number]);
}

function hasCardType(card: ResolvedDeckCard["card"], type: string) {
  return card.type_line.includes(type);
}

function getRecommendationCardText(card: ScryfallCard) {
  if (card.card_faces?.length) {
    return card.card_faces
      .map((face) => face.oracle_text ?? "")
      .join(" ")
      .toLowerCase();
  }

  return `${card.oracle_text ?? ""} ${card.keywords?.join(" ") ?? ""}`.toLowerCase();
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .trim()
    .toLowerCase();
}

function formatOneDecimal(value: number) {
  return value.toFixed(1).replace(/\.0$/, "");
}

function capitalizeFirst(value: string) {
  return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function average(...values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) {
    return 0;
  }

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
