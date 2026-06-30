export type DeckSection =
  | "commander"
  | "mainboard"
  | "sideboard"
  | "maybeboard"
  | "companion";

export interface ParsedDeckEntry {
  lineNumber: number;
  originalLine: string;
  quantity: number;
  name: string;
  section: DeckSection;
}

export interface ParseIssue {
  lineNumber: number;
  line: string;
  message: string;
}

export interface ParseDecklistResult {
  entries: ParsedDeckEntry[];
  errors: ParseIssue[];
  warnings: string[];
  totalCards: number;
  uniqueCards: number;
}

export interface ParseDecklistOptions {
  commanderName?: string;
  additionalCommanderName?: string;
  partnerName?: string;
  backgroundName?: string;
  assumeFirstCardAsCommander?: boolean;
}

export interface ScryfallCardImageUris {
  small?: string;
  normal?: string;
  large?: string;
  png?: string;
  art_crop?: string;
  border_crop?: string;
}

export interface ScryfallCard {
  id: string;
  oracle_id?: string;
  name: string;
  printed_name?: string;
  flavor_name?: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  colors?: string[];
  color_identity: string[];
  keywords: string[];
  layout: string;
  produced_mana?: string[];
  image_uris?: ScryfallCardImageUris;
  card_faces?: Array<{
    name: string;
    printed_name?: string;
    flavor_name?: string;
    mana_cost?: string;
    type_line?: string;
    oracle_text?: string;
    power?: string;
    toughness?: string;
    colors?: string[];
    image_uris?: ScryfallCardImageUris;
  }>;
  legalities?: Record<string, string>;
  prices?: Record<string, string | null>;
  scryfall_uri: string;
}

export interface ResolvedDeckCard {
  quantity: number;
  section: DeckSection;
  requestedName: string;
  originalLine: string;
  lineNumber: number;
  card: ScryfallCard;
}

export interface UnresolvedDeckCard {
  quantity: number;
  section: DeckSection;
  requestedName: string;
  originalLine: string;
  lineNumber: number;
  reason: string;
}

export interface DeckResolutionResult {
  resolvedCards: ResolvedDeckCard[];
  unresolvedCards: UnresolvedDeckCard[];
  resolvedCount: number;
  unresolvedCount: number;
}

export interface DeckResolutionDocument {
  format: "edh";
  parse: ParseDecklistResult;
  result: DeckResolutionResult;
}

export type DeckAnalysisStatus = "good" | "warning" | "risk" | "note";

export interface DeckCompositionCounts {
  lands: number;
  creatures: number;
  artifacts: number;
  enchantments: number;
  instants: number;
  sorceries: number;
  planeswalkers: number;
  battles: number;
  other: number;
  nonlandSpells: number;
}

export interface DeckManaCurveBuckets {
  zeroToOne: number;
  two: number;
  three: number;
  four: number;
  five: number;
  sixPlus: number;
}

export interface DeckStructureFinding {
  code: string;
  title: string;
  status: DeckAnalysisStatus;
  message: string;
}

export interface DeckStructureAnalysis {
  structureScore: number;
  summary: string;
  commanderName: string;
  counts: DeckCompositionCounts;
  mana: {
    averageManaValue: number;
    medianManaValue: number;
    recommendedLands: {
      min: number;
      max: number;
      target: number;
    };
    curve: DeckManaCurveBuckets;
    shares: {
      early: number;
      mid: number;
      late: number;
    };
  };
  findings: DeckStructureFinding[];
}

export type LandBaseTag =
  | "land_slot"
  | "basic_land"
  | "mana_source"
  | "always_tapped"
  | "conditional_tapped"
  | "typed_land"
  | "artifact_land"
  | "fetch_land"
  | "utility_land"
  | "colorless_only"
  | "costly_land";

export interface LandBaseTagHit {
  tag: LandBaseTag;
  weight: number;
  reason: string;
}

export interface LandBaseTaggedCard {
  name: string;
  quantity: number;
  section: DeckSection;
  landValue: number;
  hits: LandBaseTagHit[];
}

export interface DeckLandBaseAnalysis {
  landBaseScore: number;
  summary: string;
  counts: {
    lands: number;
    reliableUntapped: number;
    alwaysTapped: number;
    conditionalTapped: number;
    typed: number;
    fetch: number;
    utility: number;
    colorlessOnly: number;
    costly: number;
  };
  recommendations: {
    alwaysTappedMax: number;
    conditionalTappedMax: number;
    colorlessOnlyMax: number;
    costlyMax: number;
  };
  findings: DeckStructureFinding[];
  taggedCards: LandBaseTaggedCard[];
}

export type RampTag =
  | "stable_ramp"
  | "burst_ramp"
  | "land_acceleration"
  | "mana_fixing"
  | "cost_reduction";

export interface RampTagHit {
  tag: RampTag;
  weight: number;
  reason: string;
}

export interface RampTaggedCard {
  name: string;
  quantity: number;
  section: DeckSection;
  rampValue: number;
  hits: RampTagHit[];
}

export interface DeckRampAnalysis {
  rampScore: number;
  summary: string;
  counts: {
    core: number;
    stable: number;
    burst: number;
    landAcceleration: number;
    manaFixing: number;
    costReduction: number;
  };
  recommendations: {
    coreTarget: number;
    stableTarget: number;
    fixingTarget: number;
  };
  findings: DeckStructureFinding[];
  taggedCards: RampTaggedCard[];
}

export type DrawTag =
  | "card_draw"
  | "card_selection"
  | "repeatable_advantage";

export interface DrawTagHit {
  tag: DrawTag;
  weight: number;
  reason: string;
}

export interface DrawTaggedCard {
  name: string;
  quantity: number;
  section: DeckSection;
  drawValue: number;
  hits: DrawTagHit[];
}

export interface DeckDrawAnalysis {
  drawScore: number;
  summary: string;
  counts: {
    core: number;
    draw: number;
    selection: number;
    repeatable: number;
  };
  recommendations: {
    coreTarget: number;
    drawTarget: number;
    repeatableTarget: number;
  };
  findings: DeckStructureFinding[];
  taggedCards: DrawTaggedCard[];
}

export type TutorTag =
  | "direct_tutor"
  | "restricted_tutor"
  | "repeatable_tutor"
  | "land_tutor";

export interface TutorTagHit {
  tag: TutorTag;
  weight: number;
  reason: string;
}

export interface TutorTaggedCard {
  name: string;
  quantity: number;
  section: DeckSection;
  consistencyValue: number;
  hits: TutorTagHit[];
}

export interface DeckConsistencyAnalysis {
  consistencyScore: number;
  summary: string;
  counts: {
    core: number;
    direct: number;
    restricted: number;
    repeatable: number;
    land: number;
    selectionSupport: number;
  };
  recommendations: {
    coreTarget: number;
    directTarget: number;
    repeatableTarget: number;
  };
  findings: DeckStructureFinding[];
  taggedCards: TutorTaggedCard[];
}

export interface GameChangerTaggedCard {
  name: string;
  quantity: number;
  section: DeckSection;
  matchedName: string;
}

export interface DeckGameChangerAnalysis {
  summary: string;
  counts: {
    total: number;
    unique: number;
    commander: number;
    mainboard: number;
    companion: number;
  };
  bracket: {
    bracketOneTwoLegal: boolean;
    bracketThreeLegal: boolean;
    bracketThreeCap: number;
  };
  findings: DeckStructureFinding[];
  taggedCards: GameChangerTaggedCard[];
}

export type ProtectionTag =
  | "broad_protection"
  | "targeted_protection"
  | "equipment_protection"
  | "self_bounce"
  | "flicker";

export interface ProtectionTagHit {
  tag: ProtectionTag;
  weight: number;
  reason: string;
}

export interface ProtectionTaggedCard {
  name: string;
  quantity: number;
  section: DeckSection;
  protectionValue: number;
  hits: ProtectionTagHit[];
}

export interface DeckProtectionAnalysis {
  protectionScore: number;
  summary: string;
  counts: {
    core: number;
    broad: number;
    targeted: number;
    equipment: number;
    selfBounce: number;
    flicker: number;
  };
  recommendations: {
    coreTarget: number;
    broadTarget: number;
    targetedTarget: number;
  };
  findings: DeckStructureFinding[];
  taggedCards: ProtectionTaggedCard[];
}

export type RecursionTag =
  | "battlefield_recursion"
  | "hand_recursion"
  | "replay_recursion"
  | "mass_recursion"
  | "library_recursion";

export interface RecursionTagHit {
  tag: RecursionTag;
  weight: number;
  reason: string;
}

export interface RecursionTaggedCard {
  name: string;
  quantity: number;
  section: DeckSection;
  recursionValue: number;
  hits: RecursionTagHit[];
}

export interface DeckRecursionAnalysis {
  recursionScore: number;
  summary: string;
  counts: {
    core: number;
    battlefield: number;
    hand: number;
    replay: number;
    mass: number;
    library: number;
  };
  recommendations: {
    coreTarget: number;
    battlefieldTarget: number;
    replayTarget: number;
  };
  findings: DeckStructureFinding[];
  taggedCards: RecursionTaggedCard[];
}

export type WinConditionTag =
  | "combat_finisher"
  | "direct_finisher"
  | "alternate_finisher"
  | "repeatable_finisher";

export interface WinConditionTagHit {
  tag: WinConditionTag;
  weight: number;
  reason: string;
}

export interface WinConditionTaggedCard {
  name: string;
  quantity: number;
  section: DeckSection;
  finisherValue: number;
  hits: WinConditionTagHit[];
}

export type WinConditionComboLineType = "finisher" | "engine";

export interface WinConditionComboEntry {
  id: string;
  comboValue: number;
  lineType: WinConditionComboLineType;
  cardNames: string[];
  outcomeNames: string[];
  description: string;
  manaNeeded?: string;
  notablePrerequisites: string[];
  bracketTag?: string;
  variantCount: number;
  commanderInvolved: boolean;
}

export interface DeckWinConditionComboLookup {
  source: string;
  lookupStatus: "ok" | "unavailable";
  error?: string;
  exactCount: number;
  finisherCount: number;
  engineCount: number;
  nearMissCount: number;
  exact: WinConditionComboEntry[];
}

export interface DeckWinConditionAnalysis {
  finisherScore: number;
  summary: string;
  counts: {
    core: number;
    combat: number;
    direct: number;
    alternate: number;
    repeatable: number;
    combo: number;
  };
  recommendations: {
    coreTarget: number;
    combatTarget: number;
    directTarget: number;
  };
  findings: DeckStructureFinding[];
  taggedCards: WinConditionTaggedCard[];
  combos: DeckWinConditionComboLookup;
}

export type RemovalTag =
  | "targeted_removal"
  | "mass_removal"
  | "tempo_removal"
  | "hand_attack";

export interface RemovalTagHit {
  tag: RemovalTag;
  weight: number;
  reason: string;
}

export interface RemovalTaggedCard {
  name: string;
  quantity: number;
  section: DeckSection;
  removalValue: number;
  hits: RemovalTagHit[];
}

export interface DeckRemovalAnalysis {
  removalScore: number;
  summary: string;
  counts: {
    core: number;
    targeted: number;
    mass: number;
    tempo: number;
    handAttack: number;
  };
  recommendations: {
    coreTarget: number;
    targetedTarget: number;
    massTarget: number;
    tempoTarget: number;
    handTarget: number;
  };
  findings: DeckStructureFinding[];
  taggedCards: RemovalTaggedCard[];
}

export type SpellInteractionTag =
  | "hard_stack"
  | "soft_stack"
  | "spell_tempo"
  | "broad_stack"
  | "stax_piece"
  | "graveyard_hate";

export interface SpellInteractionTagHit {
  tag: SpellInteractionTag;
  weight: number;
  reason: string;
}

export interface SpellInteractionTaggedCard {
  name: string;
  quantity: number;
  section: DeckSection;
  interactionValue: number;
  hits: SpellInteractionTagHit[];
}

export interface DeckSpellInteractionAnalysis {
  interactionScore: number;
  summary: string;
  counts: {
    core: number;
    hard: number;
    soft: number;
    spellTempo: number;
    broad: number;
    stax?: number;
    graveyardHate?: number;
  };
  recommendations: {
    coreTarget: number;
    hardTarget: number;
    softTarget: number;
  };
  findings: DeckStructureFinding[];
  taggedCards: SpellInteractionTaggedCard[];
}

export type StrategyKey =
  | "combo"
  | "spellslinger"
  | "artifacts"
  | "enchantress"
  | "superfriends"
  | "reanimator"
  | "lands_matter"
  | "tokens"
  | "aristocrats"
  | "blink"
  | "face_down"
  | "dungeons"
  | "madness"
  | "ninjutsu"
  | "curses"
  | "exile_cast"
  | "food"
  | "clues"
  | "energy"
  | "sagas"
  | "monarch"
  | "theft"
  | "donation"
  | "goad"
  | "shrines"
  | "cycling"
  | "mutate"
  | "poison"
  | "battles"
  | "pillowfort"
  | "copy_clone"
  | "power_matter"
  | "mana_value_matter"
  | "x_spells"
  | "legends_matter"
  | "toughness_matter"
  | "pingers"
  | "counters"
  | "voltron"
  | "extra_combat"
  | "extra_upkeep"
  | "tap_untap"
  | "dice_rolls"
  | "coin_flip"
  | "treasure"
  | "kindred"
  | "stax"
  | "control"
  | "group_hug"
  | "group_slug"
  | "lifegain"
  | "mill"
  | "aggro";

export interface DeckStrategyEntry {
  key: StrategyKey;
  label: string;
  score: number;
  rawScore: number;
  confidence: number;
  keyCards: string[];
  reasons: string[];
}

export interface DeckStrategySynergy {
  synergyScore: number;
  summary: string;
  supportCards: number;
  coreCards: number;
  focusScore: number;
  commanderAligned: boolean;
  finisherAligned: boolean;
  recommendations: {
    supportTarget: number;
    coreTarget: number;
  };
  findings: DeckStructureFinding[];
}

export interface DeckStrategyPerspective {
  strategy: DeckStrategyEntry;
  subStrategies: DeckStrategyEntry[];
  synergy: DeckStrategySynergy;
}

export interface DeckStrategyAnalysis {
  summary: string;
  detectedMainStrategy?: DeckStrategyEntry | null;
  mainStrategy: DeckStrategyEntry | null;
  subStrategies: DeckStrategyEntry[];
  topStrategies: DeckStrategyEntry[];
  synergy: DeckStrategySynergy | null;
  perspectives: DeckStrategyPerspective[];
  commanderProfiles?: DeckCommanderProfile[];
}

export type WinStrategyKey =
  | "infinite_combo"
  | "commander_damage"
  | "go_wide_combat"
  | "extra_combat_pressure"
  | "drain_burn"
  | "spell_burst"
  | "mill_out"
  | "alternate_win"
  | "planeswalker_ultimates"
  | "big_mana_haymakers"
  | "graveyard_pressure"
  | "lock_attrition"
  | "poison"
  | "value_attrition";

export interface DeckWinStrategyPlan {
  key: WinStrategyKey;
  label: string;
  summary: string;
  reasons: string[];
  keyCards: string[];
}

export interface DeckWinStrategyPerspective {
  strategyKey: StrategyKey;
  strategyLabel: string;
  primaryPlan: DeckWinStrategyPlan | null;
  backupPlans: DeckWinStrategyPlan[];
}

export interface DeckWinStrategyAnalysis {
  summary: string;
  primaryPlan: DeckWinStrategyPlan | null;
  backupPlans: DeckWinStrategyPlan[];
  perspectives: DeckWinStrategyPerspective[];
}

export type CommanderRoleTag =
  | "mana_engine"
  | "card_engine"
  | "tutor_engine"
  | "interaction_engine"
  | "protection_engine"
  | "recursion_engine"
  | "combo_enabler"
  | "finisher_engine"
  | "token_engine"
  | "cost_reducer";

export interface CommanderRoleHit {
  tag: CommanderRoleTag;
  weight: number;
  reason: string;
}

export interface CommanderTaggedCard {
  name: string;
  section: DeckSection;
  roleValue: number;
  hits: CommanderRoleHit[];
}

export interface DeckCommanderProfile {
  commanderName: string;
  key: StrategyKey;
  label: string;
  supportReason: string;
  supportTarget: number;
  supportCount: number;
  coreCount: number;
  confidence: number;
  supportCards: string[];
  missingPieces: string[];
}

export interface DeckCommanderAnalysis {
  summary: string;
  impactScore: number;
  dependencyScore: number;
  ceilingScore: number;
  commanderInvolvedCombos: number;
  prior: {
    matched: string[];
    score: number;
  };
  counts: {
    mana: number;
    cards: number;
    tutors: number;
    interaction: number;
    protection: number;
    recursion: number;
    combo: number;
    finisher: number;
    tokens: number;
    costReduction: number;
  };
  keyRoles: string[];
  profiles: DeckCommanderProfile[];
  findings: DeckStructureFinding[];
  taggedCommanders: CommanderTaggedCard[];
}

export type SynergyIoDomain =
  | "graveyard"
  | "sacrifice"
  | "spells"
  | "tokens"
  | "counters"
  | "lifegain"
  | "kindred"
  | "artifacts"
  | "enchantments"
  | "discard"
  | "combat"
  | "timing"
  | "resources"
  | "protection";

export type SynergyIoKind = "input" | "output" | "payoff" | "friction";

export interface SynergyIoAtom {
  domain: SynergyIoDomain;
  kind: SynergyIoKind;
  tag: string;
  weight: number;
  reason: string;
}

export interface SynergyIoTaggedCard {
  name: string;
  quantity: number;
  section: DeckSection;
  synergyValue: number;
  atoms: SynergyIoAtom[];
}

export interface SynergyIoPackage {
  domain: SynergyIoDomain;
  label: string;
  score: number;
  inputs: number;
  outputs: number;
  payoffs: number;
  frictions: number;
  inputTags: string[];
  outputTags: string[];
  payoffTags: string[];
  frictionTags: string[];
  keyCards: string[];
  gaps: string[];
}

export interface CommanderSynergyIoMatch {
  domain: SynergyIoDomain;
  label: string;
  score: number;
  commanderInputs: number;
  commanderOutputs: number;
  commanderPayoffs: number;
  supportInputs: number;
  supportOutputs: number;
  supportPayoffs: number;
  keyCommanders: string[];
  keySupportCards: string[];
  gaps: string[];
}

export interface CommanderSynergyIoAnalysis {
  score: number;
  summary: string;
  matches: CommanderSynergyIoMatch[];
  gaps: string[];
}

export interface DeckSynergyIoAnalysis {
  summary: string;
  packages: SynergyIoPackage[];
  commanderSynergy: CommanderSynergyIoAnalysis;
  taggedCards: SynergyIoTaggedCard[];
}

export type DeckPowerTier =
  | "Casual"
  | "Focused"
  | "High Power"
  | "cEDH-Adjacent";

export type DeckPowerDimensionKey =
  | "speed"
  | "consistency"
  | "interaction"
  | "resilience"
  | "closing"
  | "mana";

export interface DeckPowerDimension {
  key: DeckPowerDimensionKey;
  label: string;
  score: number;
  summary: string;
}

export interface DeckPowerAnalysis {
  powerScore: number;
  powerIndex: number;
  powerTier: DeckPowerTier;
  summary: string;
  dimensions: DeckPowerDimension[];
  strengths: string[];
  weaknesses: string[];
  findings: DeckStructureFinding[];
}

export type DeckBracketNumber = 1 | 2 | 3 | 4 | 5;

export type DeckBracketModifier = "-" | "" | "+";

export type DeckBracketName =
  | "Exhibition"
  | "Core"
  | "Upgraded"
  | "Optimized"
  | "cEDH";

export interface DeckBracketAnalysis {
  summary: string;
  recommendedBracket: DeckBracketNumber;
  recommendedModifier: DeckBracketModifier;
  recommendedLabel: string;
  recommendedName: DeckBracketName;
  targetBracket?: DeckBracketNumber;
  targetLabel?: string;
  targetName?: DeckBracketName;
  targetDelta?: number;
  targetAlignment?: "below" | "aligned" | "above";
  targetSummary?: string;
  powerBracket: DeckBracketNumber;
  powerModifier: DeckBracketModifier;
  powerLabel: string;
  powerName: DeckBracketName;
  rulesFloor: DeckBracketNumber;
  rulesFloorLabel: string;
  adjustedByRules: boolean;
  signals: {
    gameChangers: number;
    exactCombos: number;
    twoCardCombos: number;
    extraTurns: number;
    massLandDenial: number;
  };
  findings: DeckStructureFinding[];
}

export type DeckRecommendationTopic =
  | "shell"
  | "land_base"
  | "ramp"
  | "card_flow"
  | "consistency"
  | "interaction"
  | "resilience"
  | "closing";

export type DeckRecommendationDirection = "up" | "down";

export interface DeckRecommendationCard {
  key: string;
  name: string;
  reason: string;
  direction: DeckRecommendationDirection;
  source?: "library" | "recommander";
  sourceLabel?: string;
  oracleId?: string | null;
  recommanderRank?: number;
  recommanderScore?: number;
}

export interface DeckRecommendationTopicEntry {
  key: DeckRecommendationTopic;
  label: string;
  summary: string;
  cards: DeckRecommendationCard[];
}

export interface DeckRecommendationAnalysis {
  summary: string;
  topics: DeckRecommendationTopicEntry[];
}

export type DeckAnalysisSourceKey =
  | "scryfall"
  | "edhrec"
  | "commanderSpellbook"
  | "recommander";

export type DeckAnalysisSourceStatus = "ok" | "partial" | "failed";

export interface DeckAnalysisSourceState {
  key: DeckAnalysisSourceKey;
  label: string;
  status: DeckAnalysisSourceStatus;
  used: boolean;
  summary: string;
  detail?: string;
  url?: string;
  affects: string[];
}

export type DeckAnalysisSources = Record<DeckAnalysisSourceKey, DeckAnalysisSourceState>;

export interface DeckAnalysisDocument {
  document: DeckResolutionDocument;
  validation?: DeckValidationResult;
  sources: DeckAnalysisSources;
  analysis: {
    commander: DeckCommanderAnalysis;
    power: DeckPowerAnalysis;
    bracket: DeckBracketAnalysis;
    recommendations: DeckRecommendationAnalysis;
    strategy: DeckStrategyAnalysis;
    winStrategy: DeckWinStrategyAnalysis;
    structure: DeckStructureAnalysis;
    landBase: DeckLandBaseAnalysis;
    ramp: DeckRampAnalysis;
    draw: DeckDrawAnalysis;
    consistency: DeckConsistencyAnalysis;
    gameChangers: DeckGameChangerAnalysis;
    protection: DeckProtectionAnalysis;
    recursion: DeckRecursionAnalysis;
    winConditions: DeckWinConditionAnalysis;
    removal: DeckRemovalAnalysis;
    spellInteraction: DeckSpellInteractionAnalysis;
    synergyIo?: DeckSynergyIoAnalysis;
    advancedRoles?: {
      taggedCards: Array<{
        name: string;
        quantity: number;
        section: DeckSection;
        roleValue: number;
        effectiveManaValue?: number;
        hits: Array<{
          tag: string;
          weight: number;
          reason: string;
        }>;
      }>;
    };
  };
}

export interface DeckValidationIssue {
  code: string;
  message: string;
  lineNumber?: number;
  cardName?: string;
  section?: DeckSection;
}

export interface DeckValidationResult {
  isValid: boolean;
  issues: DeckValidationIssue[];
  commander?: {
    requestedName: string;
    resolvedName: string;
    lineNumber: number;
    colorIdentity: string[];
  };
  commanders?: Array<{
    requestedName: string;
    resolvedName: string;
    lineNumber: number;
    colorIdentity: string[];
    role: "commander" | "partner" | "background" | "doctor_companion";
  }>;
}

export interface DeckExportDocument extends DeckResolutionDocument {
  source: {
    createdBy: "cli" | "web";
    inputLabel?: string;
    fileName: string;
    outputPath: string;
    exportedAt: string;
  };
}
