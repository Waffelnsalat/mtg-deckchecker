const pageShell = document.querySelector(".page-shell");
const ambientCardBackground = document.querySelector("#ambient-card-background");
const heroMediaCardImages = Array.from(document.querySelectorAll(".hero-media-card img"));
const versionBadge = document.querySelector("#version-badge");
const themeToggle = document.querySelector("#theme-toggle");
const reportButton = document.querySelector("#report-button");
const reportOverlay = document.querySelector("#report-overlay");
const reportCloseButton = document.querySelector("#report-close-button");
const reportCancelButton = document.querySelector("#report-cancel-button");
const reportSubmitButton = document.querySelector("#report-submit-button");
const reportCommentField = document.querySelector("#report-comment");
const reportStatus = document.querySelector("#report-status");
const reportTypeButtons = Array.from(document.querySelectorAll("[data-report-type]"));
const reportWebsiteKindButtons = Array.from(document.querySelectorAll("[data-website-kind]"));
const reportWebsitePanel = document.querySelector("#report-website-panel");
const reportEvaluationPanel = document.querySelector("#report-evaluation-panel");
const reportEvaluationCategoryFields = Array.from(
  document.querySelectorAll("#report-evaluation-panel input[type='checkbox']"),
);
const form = document.querySelector("#deck-form");
const decklistField = document.querySelector("#decklist");
const deckUrlField = document.querySelector("#deck-url");
const commanderNameField = document.querySelector("#commander-name");
const targetBracketField = document.querySelector("#target-bracket");
const targetBracketPrompt = document.querySelector("#target-bracket-prompt");
const targetBracketPromptCancel = document.querySelector("#target-bracket-cancel");
const targetBracketChoiceButtons = Array.from(
  document.querySelectorAll("[data-target-bracket-choice]"),
);
const additionalCommanderEnabledField = document.querySelector("#additional-commander-enabled");
const companionEnabledField = document.querySelector("#companion-enabled");
const secretCommanderEnabledField = document.querySelector("#secret-commander-enabled");
const additionalCommanderFieldWrap = document.querySelector("#additional-commander-field-wrap");
const companionFieldWrap = document.querySelector("#companion-field-wrap");
const secretCommanderFieldWrap = document.querySelector("#secret-commander-field-wrap");
const additionalCommanderNameField = document.querySelector("#additional-commander-name");
const companionNameField = document.querySelector("#companion-name");
const secretCommanderNameField = document.querySelector("#secret-commander-name");
const fileField = document.querySelector("#deck-file");
const fileNameLabel = document.querySelector("#deck-file-name");
const importUrlButton = document.querySelector("#import-url-button");
const submitButton = document.querySelector("#submit-button");
const formStatus = document.querySelector("#form-status");
const loadingOverlay = document.querySelector("#loading-overlay");
const loadingTitle = document.querySelector("#loading-title");
const loadingCopy = document.querySelector("#loading-copy");
const quickReadAdvancedButton = document.querySelector("#quick-read-advanced-button");
const recommendationsBox = document.querySelector("#recommendations-box");
const recommendationsSummary = document.querySelector("#recommendations-summary");
const recommendationsList = document.querySelector("#recommendations-list");
const recommendationsSummaryAdvanced = document.querySelector("#recommendations-summary-advanced");
const recommendationsListAdvanced = document.querySelector("#recommendations-list-advanced");
const cardBreakdownCount = document.querySelector("#card-breakdown-count");
const cardBreakdownSummary = document.querySelector("#card-breakdown-summary");
const cardBreakdownTagStats = document.querySelector("#card-breakdown-tag-stats");
const cardBreakdownBody = document.querySelector("#card-breakdown-body");
const cardBreakdownSearch = document.querySelector("#card-breakdown-search");
const cardBreakdownSectionFilter = document.querySelector("#card-breakdown-section-filter");
const cardBreakdownRoleFilter = document.querySelector("#card-breakdown-role-filter");
const cardBreakdownSort = document.querySelector("#card-breakdown-sort");
const resultEmpty = document.querySelector("#result-empty");
const resultContent = document.querySelector("#result-content");
const successContent = document.querySelector("#success-content");
const advancedAnalysis = document.querySelector("#advanced-analysis");
const advancedTabBar = document.querySelector(".advanced-tab-bar");
const advancedTabButtons = Array.from(document.querySelectorAll("[data-advanced-tab]"));
const advancedTabPanels = Array.from(document.querySelectorAll("[data-analysis-tab-panel]"));
const commanderVisuals = document.querySelector("#commander-visuals");
const issuesBox = document.querySelector("#issues-box");
const issuesTitle = document.querySelector("#issues-title");
const issuesSummary = document.querySelector("#issues-summary");
const issuesList = document.querySelector("#issues-list");
const structureScore = document.querySelector("#structure-score");
const landCount = document.querySelector("#land-count");
const creatureCount = document.querySelector("#creature-count");
const instantCount = document.querySelector("#instant-count");
const sorceryCount = document.querySelector("#sorcery-count");
const artifactCount = document.querySelector("#artifact-count");
const enchantmentCount = document.querySelector("#enchantment-count");
const planeswalkerCount = document.querySelector("#planeswalker-count");
const battleCount = document.querySelector("#battle-count");
const averageCmc = document.querySelector("#average-cmc");
const compositionChart = document.querySelector("#composition-chart");
const resolvedCount = document.querySelector("#resolved-count");
const uniqueCount = document.querySelector("#unique-count");
const totalCount = document.querySelector("#total-count");
const commanderDisplay = document.querySelector("#commander-display");
const companionDisplay = document.querySelector("#companion-display");
const secretCommanderDisplay = document.querySelector("#secret-commander-display");
const analysisStatus = document.querySelector("#analysis-status");
const powerSummary = document.querySelector("#power-summary");
const powerScore = document.querySelector("#power-score");
const powerSynergy = document.querySelector("#power-synergy");
const powerSpeed = document.querySelector("#power-speed");
const powerConsistency = document.querySelector("#power-consistency");
const powerInteraction = document.querySelector("#power-interaction");
const powerResilience = document.querySelector("#power-resilience");
const powerClosing = document.querySelector("#power-closing");
const powerMana = document.querySelector("#power-mana");
const bracketSummary = document.querySelector("#bracket-summary");
const bracketRecommended = document.querySelector("#bracket-recommended");
const bracketTarget = document.querySelector("#bracket-target");
const bracketPowerRead = document.querySelector("#bracket-power-read");
const bracketRulesFloor = document.querySelector("#bracket-rules-floor");
const bracketGameChangers = document.querySelector("#bracket-game-changers");
const bracketTwoCardCombos = document.querySelector("#bracket-two-card-combos");
const bracketExtraTurns = document.querySelector("#bracket-extra-turns");
const bracketLandDenial = document.querySelector("#bracket-land-denial");
const bracketFindingsList = document.querySelector("#bracket-findings-list");
const powerStrengthsList = document.querySelector("#power-strengths-list");
const powerWeaknessesList = document.querySelector("#power-weaknesses-list");
const matchupSummary = document.querySelector("#matchup-summary");
const matchupHighRiskCount = document.querySelector("#matchup-high-risk-count");
const matchupWatchCount = document.querySelector("#matchup-watch-count");
const matchupTopRisk = document.querySelector("#matchup-top-risk");
const matchupResistantCount = document.querySelector("#matchup-resistant-count");
const matchupExposureList = document.querySelector("#matchup-exposure-list");
const matchupResilienceList = document.querySelector("#matchup-resilience-list");
const commanderSummary = document.querySelector("#commander-summary");
const commanderImpactScore = document.querySelector("#commander-impact-score");
const commanderDependencyScore = document.querySelector("#commander-dependency-score");
const commanderCeilingScore = document.querySelector("#commander-ceiling-score");
const commanderComboLines = document.querySelector("#commander-combo-lines");
const commanderPriorScore = document.querySelector("#commander-prior-score");
const commanderKeyRoles = document.querySelector("#commander-key-roles");
const commanderFindingsList = document.querySelector("#commander-findings-list");
const commanderCardsList = document.querySelector("#commander-cards-list");
const commanderCardsPreview = document.querySelector("#commander-cards-preview");
const commanderProfilesList = document.querySelector("#commander-profiles-list");
const strategySummary = document.querySelector("#strategy-summary");
const strategySwitcherWrap = document.querySelector("#strategy-switcher-wrap");
const strategySwitcher = document.querySelector("#strategy-switcher");
const mainStrategyName = document.querySelector("#main-strategy-name");
const subStrategyCount = document.querySelector("#sub-strategy-count");
const strategySynergyScore = document.querySelector("#strategy-synergy-score");
const strategySupportCount = document.querySelector("#strategy-support-count");
const strategyCoreCount = document.querySelector("#strategy-core-count");
const strategyFocusScore = document.querySelector("#strategy-focus-score");
const strategyCommanderFit = document.querySelector("#strategy-commander-fit");
const strategyFinisherFit = document.querySelector("#strategy-finisher-fit");
const strategySynergySummary = document.querySelector("#strategy-synergy-summary");
const strategySynergyFindingsList = document.querySelector("#strategy-synergy-findings-list");
const mainStrategyCardsList = document.querySelector("#main-strategy-cards-list");
const subStrategiesList = document.querySelector("#sub-strategies-list");
const winStrategySummary = document.querySelector("#win-strategy-summary");
const winStrategyPrimary = document.querySelector("#win-strategy-primary");
const winStrategyBackupCount = document.querySelector("#win-strategy-backup-count");
const winStrategyPerspective = document.querySelector("#win-strategy-perspective");
const winStrategyCardsList = document.querySelector("#win-strategy-cards-list");
const winStrategyReasonsList = document.querySelector("#win-strategy-reasons-list");
const winStrategyBackupsList = document.querySelector("#win-strategy-backups-list");
const recommendedLands = document.querySelector("#recommended-lands");
const medianCmc = document.querySelector("#median-cmc");
const landFit = document.querySelector("#land-fit");
const curveProfile = document.querySelector("#curve-profile");
const earlyShare = document.querySelector("#early-share");
const lateShare = document.querySelector("#late-share");
const findingsList = document.querySelector("#findings-list");
const curveBars = document.querySelector("#curve-bars");
const landBaseScore = document.querySelector("#land-base-score");
const landBaseFast = document.querySelector("#land-base-fast");
const landBaseAlwaysTapped = document.querySelector("#land-base-always-tapped");
const landBaseConditional = document.querySelector("#land-base-conditional");
const landBaseFetch = document.querySelector("#land-base-fetch");
const landBaseTyped = document.querySelector("#land-base-typed");
const landBaseUtility = document.querySelector("#land-base-utility");
const landBaseColorless = document.querySelector("#land-base-colorless");
const landBaseCostly = document.querySelector("#land-base-costly");
const landBaseTarget = document.querySelector("#land-base-target");
const landBaseFindingsList = document.querySelector("#land-base-findings-list");
const landBaseCardsList = document.querySelector("#land-base-cards-list");
const landBaseCardsPreview = document.querySelector("#land-base-cards-preview");
const rampScore = document.querySelector("#ramp-score");
const coreRamp = document.querySelector("#core-ramp");
const stableRamp = document.querySelector("#stable-ramp");
const landRamp = document.querySelector("#land-ramp");
const burstRamp = document.querySelector("#burst-ramp");
const fixingRamp = document.querySelector("#fixing-ramp");
const costRamp = document.querySelector("#cost-ramp");
const taggedRampCount = document.querySelector("#tagged-ramp-count");
const rampTarget = document.querySelector("#ramp-target");
const rampFindingsList = document.querySelector("#ramp-findings-list");
const rampCardsList = document.querySelector("#ramp-cards-list");
const rampCardsPreview = document.querySelector("#ramp-cards-preview");
const drawScore = document.querySelector("#draw-score");
const coreDraw = document.querySelector("#core-draw");
const rawDraw = document.querySelector("#raw-draw");
const selectionDraw = document.querySelector("#selection-draw");
const repeatableDraw = document.querySelector("#repeatable-draw");
const taggedDrawCount = document.querySelector("#tagged-draw-count");
const drawTarget = document.querySelector("#draw-target");
const drawFindingsList = document.querySelector("#draw-findings-list");
const drawCardsList = document.querySelector("#draw-cards-list");
const drawCardsPreview = document.querySelector("#draw-cards-preview");
const consistencyScore = document.querySelector("#consistency-score");
const coreConsistency = document.querySelector("#core-consistency");
const directTutors = document.querySelector("#direct-tutors");
const restrictedTutors = document.querySelector("#restricted-tutors");
const repeatableTutors = document.querySelector("#repeatable-tutors");
const landTutors = document.querySelector("#land-tutors");
const selectionSupport = document.querySelector("#selection-support");
const taggedConsistencyCount = document.querySelector("#tagged-consistency-count");
const consistencyTarget = document.querySelector("#consistency-target");
const consistencyFindingsList = document.querySelector("#consistency-findings-list");
const consistencyCardsList = document.querySelector("#consistency-cards-list");
const consistencyCardsPreview = document.querySelector("#consistency-cards-preview");
const gameChangerTotal = document.querySelector("#game-changer-total");
const gameChangerUnique = document.querySelector("#game-changer-unique");
const gameChangerCommander = document.querySelector("#game-changer-commander");
const gameChangerMainboard = document.querySelector("#game-changer-mainboard");
const gameChangerCompanion = document.querySelector("#game-changer-companion");
const gameChangerCardsList = document.querySelector("#game-changer-cards-list");
const gameChangerCardsPreview = document.querySelector("#game-changer-cards-preview");
const protectionScore = document.querySelector("#protection-score");
const coreProtection = document.querySelector("#core-protection");
const broadProtection = document.querySelector("#broad-protection");
const targetedProtection = document.querySelector("#targeted-protection");
const equipmentProtection = document.querySelector("#equipment-protection");
const bounceProtection = document.querySelector("#bounce-protection");
const flickerProtection = document.querySelector("#flicker-protection");
const taggedProtectionCount = document.querySelector("#tagged-protection-count");
const protectionTarget = document.querySelector("#protection-target");
const protectionFindingsList = document.querySelector("#protection-findings-list");
const protectionCardsList = document.querySelector("#protection-cards-list");
const protectionCardsPreview = document.querySelector("#protection-cards-preview");
const recursionScore = document.querySelector("#recursion-score");
const coreRecursion = document.querySelector("#core-recursion");
const battlefieldRecursion = document.querySelector("#battlefield-recursion");
const handRecursion = document.querySelector("#hand-recursion");
const replayRecursion = document.querySelector("#replay-recursion");
const massRecursion = document.querySelector("#mass-recursion");
const libraryRecursion = document.querySelector("#library-recursion");
const taggedRecursionCount = document.querySelector("#tagged-recursion-count");
const recursionTarget = document.querySelector("#recursion-target");
const recursionFindingsList = document.querySelector("#recursion-findings-list");
const recursionCardsList = document.querySelector("#recursion-cards-list");
const recursionCardsPreview = document.querySelector("#recursion-cards-preview");
const finisherScore = document.querySelector("#finisher-score");
const coreFinisher = document.querySelector("#core-finisher");
const combatFinisher = document.querySelector("#combat-finisher");
const directFinisher = document.querySelector("#direct-finisher");
const alternateFinisher = document.querySelector("#alternate-finisher");
const repeatableFinisher = document.querySelector("#repeatable-finisher");
const comboFinisher = document.querySelector("#combo-finisher");
const comboLineCount = document.querySelector("#combo-line-count");
const comboFinisherCount = document.querySelector("#combo-finisher-count");
const comboEngineCount = document.querySelector("#combo-engine-count");
const taggedFinisherCount = document.querySelector("#tagged-finisher-count");
const comboNearMissCount = document.querySelector("#combo-near-miss-count");
const finisherTarget = document.querySelector("#finisher-target");
const finisherFindingsList = document.querySelector("#finisher-findings-list");
const finisherCardsList = document.querySelector("#finisher-cards-list");
const finisherCardsPreview = document.querySelector("#finisher-cards-preview");
const comboLinesList = document.querySelector("#combo-lines-list");
const removalScore = document.querySelector("#removal-score");
const coreRemoval = document.querySelector("#core-removal");
const targetedRemoval = document.querySelector("#targeted-removal");
const massRemoval = document.querySelector("#mass-removal");
const tempoRemoval = document.querySelector("#tempo-removal");
const handAttackRemoval = document.querySelector("#hand-attack-removal");
const taggedRemovalCount = document.querySelector("#tagged-removal-count");
const removalTarget = document.querySelector("#removal-target");
const removalFindingsList = document.querySelector("#removal-findings-list");
const removalCardsList = document.querySelector("#removal-cards-list");
const removalCardsPreview = document.querySelector("#removal-cards-preview");
const spellInteractionScore = document.querySelector("#spell-interaction-score");
const coreSpellInteraction = document.querySelector("#core-spell-interaction");
const hardSpellInteraction = document.querySelector("#hard-spell-interaction");
const softSpellInteraction = document.querySelector("#soft-spell-interaction");
const tempoSpellInteraction = document.querySelector("#tempo-spell-interaction");
const broadSpellInteraction = document.querySelector("#broad-spell-interaction");
const staxSpellInteraction = document.querySelector("#stax-spell-interaction");
const graveyardHateInteraction = document.querySelector("#graveyard-hate-interaction");
const taggedSpellInteractionCount = document.querySelector("#tagged-spell-interaction-count");
const spellInteractionTarget = document.querySelector("#spell-interaction-target");
const spellInteractionFindingsList = document.querySelector("#spell-interaction-findings-list");
const spellInteractionCardsList = document.querySelector("#spell-interaction-cards-list");
const spellInteractionCardsPreview = document.querySelector("#spell-interaction-cards-preview");
const quickReadSummary = document.querySelector("#quick-read-summary");
const scoreRadarChart = document.querySelector("#score-radar-chart");
const quickShellScore = document.querySelector("#quick-shell-score");
const quickLandBaseScore = document.querySelector("#quick-land-base-score");
const quickRampScore = document.querySelector("#quick-ramp-score");
const quickCardFlowScore = document.querySelector("#quick-card-flow-score");
const quickConsistencyScore = document.querySelector("#quick-consistency-score");
const quickInteractionScore = document.querySelector("#quick-interaction-score");
const quickResilienceScore = document.querySelector("#quick-resilience-score");
const quickClosingScore = document.querySelector("#quick-closing-score");
const quickReadStrengthsList = document.querySelector("#quick-read-strengths-list");
const quickReadRisksList = document.querySelector("#quick-read-risks-list");
const collapsibleInsightLists = [
  commanderCardsList,
  mainStrategyCardsList,
  winStrategyCardsList,
  winStrategyBackupsList,
  gameChangerCardsList,
  landBaseCardsList,
  rampCardsList,
  drawCardsList,
  consistencyCardsList,
  protectionCardsList,
  recursionCardsList,
  finisherCardsList,
  comboLinesList,
  removalCardsList,
  spellInteractionCardsList,
].filter(Boolean);

let highlightedIssueAnchors = [];
let currentAnalysisSnapshot = null;
let currentAnalysisDocument = null;
let analyzeRequestCounter = 0;
let resultsViewMode = "simple";
let advancedTabKey = "identity";
let pendingTargetBracketPromptResolve = null;
let recommendationVisualRenderToken = 0;
let metricHelpTooltip = null;
const FRONTEND_CONFIG = window.MtgDeckcheckerFrontendConfig ?? {};
const CARD_BREAKDOWN_CONFIG = FRONTEND_CONFIG.cardBreakdown ?? {};
const CARD_BREAKDOWN_MAX_ROLES = CARD_BREAKDOWN_CONFIG.maxRoles ?? 5;
const CARD_BREAKDOWN_MAX_ROLE_DETAILS = CARD_BREAKDOWN_CONFIG.maxRoleDetails ?? 4;
const CARD_BREAKDOWN_ROLE_PRIORITY = CARD_BREAKDOWN_CONFIG.rolePriority ?? [];
const CARD_BREAKDOWN_SYNERGY_LABELS = new Set(CARD_BREAKDOWN_CONFIG.synergyLabels ?? ["Synergy"]);
const CARD_BREAKDOWN_LOW_SIGNAL_LAND_TAGS = new Set(
  CARD_BREAKDOWN_CONFIG.lowSignalLandTags ?? ["Land Base", "Land Slot", "Basic Land", "Mana Source"],
);
const CARD_BREAKDOWN_HIDDEN_TAG_STATS = new Set(CARD_BREAKDOWN_CONFIG.hiddenTagStats ?? []);
const CARD_BREAKDOWN_TAG_STAT_ALIASES = CARD_BREAKDOWN_CONFIG.tagStatAliases ?? {};
const RECOMMENDATION_TOPICS = FRONTEND_CONFIG.recommendationTopics ?? [];
const SIMPLE_VALUE_DRILLDOWNS = FRONTEND_CONFIG.simpleValueDrilldowns ?? {};
const METRIC_HELP = FRONTEND_CONFIG.metricHelp ?? {};
const TAG_LABELS = FRONTEND_CONFIG.tagLabels ?? {};

if (versionBadge && FRONTEND_CONFIG.appVersion) {
  versionBadge.textContent = `v${FRONTEND_CONFIG.appVersion}`;
  if (FRONTEND_CONFIG.releaseNotesUrl) {
    versionBadge.href = FRONTEND_CONFIG.releaseNotesUrl;
  }
}
let resolvedCardLookup = new Map();
const recommendationCardVisualCache = new Map();
const recommendationCardVisualPending = new Map();
const cardBreakdownController = window.MtgDeckcheckerCardBreakdown.create({
  elements: {
    count: cardBreakdownCount,
    summary: cardBreakdownSummary,
    tagStats: cardBreakdownTagStats,
    body: cardBreakdownBody,
    search: cardBreakdownSearch,
    sectionFilter: cardBreakdownSectionFilter,
    roleFilter: cardBreakdownRoleFilter,
    sort: cardBreakdownSort,
  },
  config: {
    maxRoles: CARD_BREAKDOWN_MAX_ROLES,
    maxRoleDetails: CARD_BREAKDOWN_MAX_ROLE_DETAILS,
    rolePriority: CARD_BREAKDOWN_ROLE_PRIORITY,
    synergyLabels: CARD_BREAKDOWN_SYNERGY_LABELS,
    lowSignalLandTags: CARD_BREAKDOWN_LOW_SIGNAL_LAND_TAGS,
    hiddenTagStats: CARD_BREAKDOWN_HIDDEN_TAG_STATS,
    tagStatAliases: CARD_BREAKDOWN_TAG_STAT_ALIASES,
  },
  helpers: {
    getCardImageUrl,
    normalizeText,
    formatTagLabel,
    formatOneDecimal,
    roundTo,
  },
  getCurrentAnalysis: () => ({
    document: currentAnalysisDocument,
    analysis: currentAnalysisSnapshot,
  }),
});
const recommendationsController = window.MtgDeckcheckerRecommendations.create({
  elements: {
    summary: recommendationsSummary,
    list: recommendationsList,
    summaryAdvanced: recommendationsSummaryAdvanced,
    listAdvanced: recommendationsListAdvanced,
  },
  topics: RECOMMENDATION_TOPICS,
  helpers: {
    buildScryfallSearchUrl,
    getCardVisual: getRecommendationCardVisual,
  },
  getRenderToken: () => recommendationVisualRenderToken,
});
const taggedCardSectionsController = window.MtgDeckcheckerTaggedCardSections.create({
  elements: {
    commander: {
      list: commanderCardsList,
      preview: commanderCardsPreview,
    },
    commanderProfiles: commanderProfilesList,
    gameChanger: {
      list: gameChangerCardsList,
      preview: gameChangerCardsPreview,
    },
    landBase: {
      list: landBaseCardsList,
      preview: landBaseCardsPreview,
    },
    ramp: {
      list: rampCardsList,
      preview: rampCardsPreview,
    },
    draw: {
      list: drawCardsList,
      preview: drawCardsPreview,
    },
    consistency: {
      list: consistencyCardsList,
      preview: consistencyCardsPreview,
    },
    protection: {
      list: protectionCardsList,
      preview: protectionCardsPreview,
    },
    recursion: {
      list: recursionCardsList,
      preview: recursionCardsPreview,
    },
    finisher: {
      list: finisherCardsList,
      preview: finisherCardsPreview,
    },
    comboLines: comboLinesList,
    removal: {
      list: removalCardsList,
      preview: removalCardsPreview,
    },
    spellInteraction: {
      list: spellInteractionCardsList,
      preview: spellInteractionCardsPreview,
    },
  },
  config: {
    tagLabels: TAG_LABELS,
    previewLimit: FRONTEND_CONFIG.taggedCardPreviewLimit ?? 4,
  },
  helpers: {
    findResolvedCardForTaggedName,
    getCardImageUrl,
  },
});
const quickReadController = window.MtgDeckcheckerQuickRead.create({
  elements: {
    summary: quickReadSummary,
    radarChart: scoreRadarChart,
    metrics: {
      shell: quickShellScore,
      landBase: quickLandBaseScore,
      ramp: quickRampScore,
      cardFlow: quickCardFlowScore,
      consistency: quickConsistencyScore,
      interaction: quickInteractionScore,
      resilience: quickResilienceScore,
      closing: quickClosingScore,
    },
    strengthsList: quickReadStrengthsList,
    risksList: quickReadRisksList,
  },
});
const themeMediaController = window.MtgDeckcheckerThemeMedia.create({
  elements: {
    ambientBackground: ambientCardBackground,
    heroImages: heroMediaCardImages,
    toggle: themeToggle,
  },
  config: {
    themeStorageKey: FRONTEND_CONFIG.themeStorageKey,
  },
  helpers: {
    normalizeCardKey: normalizeCardLookupKey,
  },
});
const strategyRendererController = window.MtgDeckcheckerStrategyRenderer.create({
  elements: {
    summary: strategySummary,
    switcherWrap: strategySwitcherWrap,
    switcher: strategySwitcher,
    mainName: mainStrategyName,
    subStrategyCount,
    synergyScore: strategySynergyScore,
    supportCount: strategySupportCount,
    coreCount: strategyCoreCount,
    focusScore: strategyFocusScore,
    commanderFit: strategyCommanderFit,
    finisherFit: strategyFinisherFit,
    synergySummary: strategySynergySummary,
    synergyFindingsList: strategySynergyFindingsList,
    mainCardsList: mainStrategyCardsList,
    subStrategiesList,
    winSummary: winStrategySummary,
    winPrimary: winStrategyPrimary,
    winBackupCount: winStrategyBackupCount,
    winPerspective: winStrategyPerspective,
    winCardsList: winStrategyCardsList,
    winReasonsList: winStrategyReasonsList,
    winBackupsList: winStrategyBackupsList,
  },
  actions: {
    getCurrentAnalysis: () => currentAnalysisSnapshot,
    isSubmitDisabled: () => submitButton.disabled,
    runDeckAnalysis,
  },
});
const deckIdentityController = window.MtgDeckcheckerDeckIdentity.create({
  elements: {
    analysisStatus,
    commanderVisuals,
    commanderDisplay,
    companionDisplay,
    secretCommanderDisplay,
  },
  helpers: {
    getCardImageUrl,
  },
});
const structureOverviewController = window.MtgDeckcheckerStructureOverview.create({
  elements: {
    structureScore,
    landCount,
    creatureCount,
    instantCount,
    sorceryCount,
    artifactCount,
    enchantmentCount,
    planeswalkerCount,
    battleCount,
    averageManaValue: averageCmc,
    compositionChart,
    resolvedCount,
    uniqueCount,
    totalCount,
    recommendedLands,
    medianManaValue: medianCmc,
    landFit,
    curveProfile,
    earlyShare,
    lateShare,
    findingsList,
    curveBars,
  },
});
const metricDetailsController = window.MtgDeckcheckerMetricDetails.create({
  elements: {
    landBase: {
      score: landBaseScore,
      reliableUntapped: landBaseFast,
      alwaysTapped: landBaseAlwaysTapped,
      conditionalTapped: landBaseConditional,
      fetch: landBaseFetch,
      typed: landBaseTyped,
      utility: landBaseUtility,
      colorlessOnly: landBaseColorless,
      costly: landBaseCostly,
      target: landBaseTarget,
    },
    ramp: {
      score: rampScore,
      core: coreRamp,
      stable: stableRamp,
      landAcceleration: landRamp,
      burst: burstRamp,
      manaFixing: fixingRamp,
      costReduction: costRamp,
      taggedCount: taggedRampCount,
      target: rampTarget,
    },
    draw: {
      score: drawScore,
      core: coreDraw,
      raw: rawDraw,
      selection: selectionDraw,
      repeatable: repeatableDraw,
      taggedCount: taggedDrawCount,
      target: drawTarget,
    },
    consistency: {
      score: consistencyScore,
      core: coreConsistency,
      direct: directTutors,
      restricted: restrictedTutors,
      repeatable: repeatableTutors,
      land: landTutors,
      selectionSupport,
      taggedCount: taggedConsistencyCount,
      target: consistencyTarget,
    },
    gameChangers: {
      total: gameChangerTotal,
      unique: gameChangerUnique,
      commander: gameChangerCommander,
      mainboard: gameChangerMainboard,
      companion: gameChangerCompanion,
    },
    protection: {
      score: protectionScore,
      core: coreProtection,
      broad: broadProtection,
      targeted: targetedProtection,
      equipment: equipmentProtection,
      selfBounce: bounceProtection,
      flicker: flickerProtection,
      taggedCount: taggedProtectionCount,
      target: protectionTarget,
    },
    recursion: {
      score: recursionScore,
      core: coreRecursion,
      battlefield: battlefieldRecursion,
      hand: handRecursion,
      replay: replayRecursion,
      mass: massRecursion,
      library: libraryRecursion,
      taggedCount: taggedRecursionCount,
      target: recursionTarget,
    },
    finisher: {
      score: finisherScore,
      core: coreFinisher,
      combat: combatFinisher,
      direct: directFinisher,
      alternate: alternateFinisher,
      repeatable: repeatableFinisher,
      combo: comboFinisher,
      comboLineCount,
      comboFinisherCount,
      comboEngineCount,
      taggedCount: taggedFinisherCount,
      comboNearMissCount,
      target: finisherTarget,
    },
    removal: {
      score: removalScore,
      core: coreRemoval,
      targeted: targetedRemoval,
      mass: massRemoval,
      tempo: tempoRemoval,
      handAttack: handAttackRemoval,
      taggedCount: taggedRemovalCount,
      target: removalTarget,
    },
    spellInteraction: {
      score: spellInteractionScore,
      core: coreSpellInteraction,
      hard: hardSpellInteraction,
      soft: softSpellInteraction,
      tempo: tempoSpellInteraction,
      broad: broadSpellInteraction,
      stax: staxSpellInteraction,
      graveyardHate: graveyardHateInteraction,
      taggedCount: taggedSpellInteractionCount,
      target: spellInteractionTarget,
    },
    findings: {
      landBase: landBaseFindingsList,
      ramp: rampFindingsList,
      draw: drawFindingsList,
      consistency: consistencyFindingsList,
      protection: protectionFindingsList,
      recursion: recursionFindingsList,
      finisher: finisherFindingsList,
      removal: removalFindingsList,
      spellInteraction: spellInteractionFindingsList,
    },
  },
});
const summaryPanelsController = window.MtgDeckcheckerSummaryPanels.create({
  elements: {
    power: {
      summary: powerSummary,
      score: powerScore,
      synergy: powerSynergy,
      dimensions: {
        speed: powerSpeed,
        consistency: powerConsistency,
        interaction: powerInteraction,
        resilience: powerResilience,
        closing: powerClosing,
        mana: powerMana,
      },
      strengthsList: powerStrengthsList,
      weaknessesList: powerWeaknessesList,
    },
    bracket: {
      summary: bracketSummary,
      recommended: bracketRecommended,
      target: bracketTarget,
      powerRead: bracketPowerRead,
      rulesFloor: bracketRulesFloor,
      gameChangers: bracketGameChangers,
      twoCardCombos: bracketTwoCardCombos,
      extraTurns: bracketExtraTurns,
      landDenial: bracketLandDenial,
      findingsList: bracketFindingsList,
    },
    commander: {
      summary: commanderSummary,
      impactScore: commanderImpactScore,
      dependencyScore: commanderDependencyScore,
      ceilingScore: commanderCeilingScore,
      comboLines: commanderComboLines,
      priorScore: commanderPriorScore,
      keyRoles: commanderKeyRoles,
      findingsList: commanderFindingsList,
    },
  },
});
const resultStateController = window.MtgDeckcheckerResultState.create({
  elements: {
    issuesBox,
    issuesList,
    successContent,
    resultContent,
    resultEmpty,
    decklistField,
    formStatus,
    recommendationsSummary,
    recommendationsList,
    recommendationsSummaryAdvanced,
    recommendationsListAdvanced,
    cardBreakdownCount,
    cardBreakdownSummary,
    cardBreakdownTagStats,
    cardBreakdownBody,
    taggedLists: {
      landBaseCardsList,
      rampCardsList,
      drawCardsList,
      consistencyCardsList,
      gameChangerCardsList,
      protectionCardsList,
      recursionCardsList,
      finisherCardsList,
      comboLinesList,
      removalCardsList,
      spellInteractionCardsList,
    },
  },
  controllers: {
    structureOverview: structureOverviewController,
    strategyRenderer: strategyRendererController,
    metricDetails: metricDetailsController,
    summaryPanels: summaryPanelsController,
    quickRead: quickReadController,
    deckIdentity: deckIdentityController,
    taggedCardSections: taggedCardSectionsController,
  },
  actions: {
    clearIssueAnchors: () => {
      highlightedIssueAnchors = [];
    },
    clearResolvedCards: () => {
      resolvedCardLookup = new Map();
    },
    clearAnalysisState: () => {
      currentAnalysisSnapshot = null;
      currentAnalysisDocument = null;
    },
    resetResultsViewMode: () => {
      resultsViewMode = "simple";
    },
    resetAdvancedTab: () => {
      advancedTabKey = "identity";
    },
    syncDeckHighlight,
    syncWorkspaceMode,
    syncResultsView,
  },
});
const reportDialogController = window.MtgDeckcheckerReportDialog.create({
  elements: {
    openButton: reportButton,
    overlay: reportOverlay,
    closeButton: reportCloseButton,
    cancelButton: reportCancelButton,
    submitButton: reportSubmitButton,
    commentField: reportCommentField,
    status: reportStatus,
    typeButtons: reportTypeButtons,
    websiteKindButtons: reportWebsiteKindButtons,
    websitePanel: reportWebsitePanel,
    evaluationPanel: reportEvaluationPanel,
    evaluationCategoryFields: reportEvaluationCategoryFields,
  },
  getContext: () => ({
    decklist: decklistField?.value ?? "",
    deckUrl: deckUrlField?.value.trim() || undefined,
    commanderName: commanderNameField?.value.trim() || undefined,
    additionalCommanderName: additionalCommanderNameField?.value.trim() || undefined,
    companionName: companionNameField?.value.trim() || undefined,
    secretCommanderName: secretCommanderNameField?.value.trim() || undefined,
    targetBracket: targetBracketField?.value || undefined,
    selectedStrategyPerspectiveKey: strategyRendererController.getSelectedPerspectiveKey(),
    resultsViewMode,
    advancedTabKey,
    theme: themeMediaController.getActiveTheme(),
    pageUrl: window.location.href,
    userAgent: window.navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    analysis: currentAnalysisSnapshot,
  }),
});
reportDialogController.initialize();
const leaderFieldsController = window.MtgDeckcheckerDecklistIntake.createLeaderFieldsController({
  fields: {
    commander: commanderNameField,
    additionalCommander: additionalCommanderNameField,
    companion: companionNameField,
    secretCommander: secretCommanderNameField,
  },
  toggles: {
    additionalCommander: additionalCommanderEnabledField,
    companion: companionEnabledField,
    secretCommander: secretCommanderEnabledField,
  },
  wraps: {
    additionalCommander: additionalCommanderFieldWrap,
    companion: companionFieldWrap,
    secretCommander: secretCommanderFieldWrap,
  },
});
const deckInputController = window.MtgDeckcheckerDeckInput.create({
  elements: {
    form,
    decklistField,
    deckUrlField,
    commanderNameField,
    targetBracketField,
    additionalCommanderEnabledField,
    companionEnabledField,
    secretCommanderEnabledField,
    additionalCommanderNameField,
    companionNameField,
    secretCommanderNameField,
    fileField,
    fileNameLabel,
    importUrlButton,
    formStatus,
  },
  actions: {
    applyImportedDecklist,
    buildDeckIntakeStatus,
    clearAutofilledLeaderFields,
    formatFetchError,
    markDeckAsEdited,
    markLeaderFieldAsManual,
    prefillLeaderFieldsFromDecklist,
    promptForTargetBracketSelection,
    runDeckAnalysis,
    sanitizeDecklistInput,
    setLoadingState,
    syncDeckHighlight,
    syncSupplementalLeaderFields,
    waitForNextPaint,
  },
});
deckInputController.initialize();

quickReadAdvancedButton?.addEventListener("click", () => {
  setResultsViewMode("advanced");
});

initializeMetricHelp();
initializeSimpleValueDrilldowns();
initializeCardBreakdownControls();

targetBracketChoiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const chosenBracket = Number(button.dataset.targetBracketChoice);
    if (!Number.isInteger(chosenBracket) || chosenBracket < 1 || chosenBracket > 5) {
      return;
    }

    targetBracketField.value = String(chosenBracket);
    syncTargetBracketPromptSelection();
    resolveTargetBracketPrompt(chosenBracket);
  });
});

targetBracketPromptCancel?.addEventListener("click", () => {
  resolveTargetBracketPrompt(null);
});

targetBracketPrompt?.addEventListener("click", (event) => {
  if (event.target === targetBracketPrompt) {
    resolveTargetBracketPrompt(null);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && pendingTargetBracketPromptResolve) {
    resolveTargetBracketPrompt(null);
  }
});

advancedTabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setAdvancedTabMode(button.dataset.advancedTab, { scrollToSection: true });
  });
});

function setLoadingState(isLoading, options = {}) {
  const {
    buttonLabel = "Analyzing Deck...",
    importButtonLabel = "Import URL",
    title = "Analyzing Deck",
    copy = "Resolving cards, validating the shell, and refreshing the deck read.",
  } = options;

  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? buttonLabel : "Analyze Deck";
  if (importUrlButton) {
    importUrlButton.disabled = isLoading;
    importUrlButton.textContent = isLoading ? importButtonLabel : "Import URL";
  }

  if (!loadingOverlay || !loadingTitle || !loadingCopy) {
    return;
  }

  if (isLoading) {
    loadingTitle.textContent = title;
    loadingCopy.textContent = copy;
    loadingOverlay.classList.remove("hidden");
    loadingOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("loading-active");
    return;
  }

  loadingOverlay.classList.add("hidden");
  loadingOverlay.setAttribute("aria-hidden", "true");
  document.body.classList.remove("loading-active");
}

function waitForNextPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

function setTargetBracketPromptState(isOpen) {
  if (!targetBracketPrompt) {
    return;
  }

  targetBracketPrompt.classList.toggle("hidden", !isOpen);
  targetBracketPrompt.setAttribute("aria-hidden", String(!isOpen));
  document.body.classList.toggle("modal-active", isOpen);

  if (!isOpen) {
    return;
  }

  syncTargetBracketPromptSelection();
  const currentButton =
    targetBracketChoiceButtons.find(
      (button) => button.dataset.targetBracketChoice === targetBracketField?.value,
    ) ?? targetBracketChoiceButtons[0];
  currentButton?.focus();
}

function syncTargetBracketPromptSelection() {
  const selectedValue = targetBracketField?.value ?? "";
  targetBracketChoiceButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.targetBracketChoice === selectedValue);
  });
}

function promptForTargetBracketSelection() {
  if (!targetBracketPrompt || !targetBracketChoiceButtons.length) {
    const fallbackValue = Number(targetBracketField?.value);
    return Promise.resolve(
      Number.isInteger(fallbackValue) && fallbackValue >= 1 && fallbackValue <= 5
        ? fallbackValue
        : null,
    );
  }

  if (pendingTargetBracketPromptResolve) {
    resolveTargetBracketPrompt(null);
  }

  setTargetBracketPromptState(true);
  return new Promise((resolve) => {
    pendingTargetBracketPromptResolve = resolve;
  });
}

function resolveTargetBracketPrompt(value) {
  if (!pendingTargetBracketPromptResolve) {
    setTargetBracketPromptState(false);
    return;
  }

  const resolve = pendingTargetBracketPromptResolve;
  pendingTargetBracketPromptResolve = null;
  setTargetBracketPromptState(false);
  resolve(value);
}

function setResultsViewMode(mode) {
  resultsViewMode = mode === "advanced" ? "advanced" : "simple";
  syncResultsView();
}

function initializeSimpleValueDrilldowns() {
  Object.entries(SIMPLE_VALUE_DRILLDOWNS).forEach(([valueId, drilldown]) => {
    const valueElement = document.querySelector(`#${CSS.escape(valueId)}`);
    const cardElement = valueElement?.closest(".future-stat, .stat-card");

    if (!cardElement) {
      return;
    }

    cardElement.classList.add("drilldown-card");
    cardElement.setAttribute("role", "button");
    cardElement.tabIndex = 0;
    cardElement.setAttribute(
      "aria-label",
      `Open advanced details for ${getDrilldownCardLabel(cardElement)}.`,
    );

    cardElement.addEventListener("mousedown", (event) => {
      // Mouse focus can leave Chrome with a stale painted layer after the drilldown scroll.
      // Keyboard focus is still kept for Enter/Space navigation.
      event.preventDefault();
    });

    cardElement.addEventListener("click", (event) => {
      openAdvancedDrilldown(drilldown);
      if (event.detail > 0) {
        resetDrilldownCardPaint(cardElement);
      }
    });

    cardElement.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      openAdvancedDrilldown(drilldown);
    });
  });
}

function initializeMetricHelp() {
  Object.entries(METRIC_HELP).forEach(([valueId, helpText]) => {
    const valueElement = document.querySelector(`#${CSS.escape(valueId)}`);
    const cardElement = valueElement?.closest(".future-stat, .stat-card");

    if (!cardElement || !helpText) {
      return;
    }

    const tooltipId = `${valueId}-metric-help`;
    cardElement.querySelector(".metric-help-popover")?.remove();
    cardElement.classList.add("metric-help-card");
    cardElement.dataset.metricHelp = helpText;
    cardElement.dataset.metricHelpId = tooltipId;
    cardElement.setAttribute("aria-describedby", tooltipId);

    if (cardElement.dataset.metricHelpBound === "true") {
      return;
    }

    cardElement.dataset.metricHelpBound = "true";
    cardElement.addEventListener("mouseenter", () => showMetricHelp(cardElement));
    cardElement.addEventListener("focusin", () => showMetricHelp(cardElement));
    cardElement.addEventListener("mouseleave", hideMetricHelp);
    cardElement.addEventListener("focusout", hideMetricHelp);
  });
}

function getMetricHelpTooltip() {
  if (metricHelpTooltip) {
    return metricHelpTooltip;
  }

  metricHelpTooltip = document.createElement("div");
  metricHelpTooltip.className = "metric-help-popover";
  metricHelpTooltip.setAttribute("role", "tooltip");
  metricHelpTooltip.hidden = true;
  document.body.append(metricHelpTooltip);
  return metricHelpTooltip;
}

function showMetricHelp(cardElement) {
  const helpText = cardElement.dataset.metricHelp;
  if (!helpText) {
    return;
  }

  const tooltip = getMetricHelpTooltip();
  tooltip.id = cardElement.dataset.metricHelpId ?? "metric-help-popover";
  tooltip.textContent = helpText;
  tooltip.hidden = false;
  tooltip.classList.add("is-visible");

  window.requestAnimationFrame(() => positionMetricHelpTooltip(cardElement, tooltip));
}

function positionMetricHelpTooltip(cardElement, tooltip) {
  const cardRect = cardElement.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const gap = 8;
  const viewportPadding = 12;
  const viewportWidth = document.documentElement.clientWidth;
  const preferredLeft = cardRect.left + cardRect.width / 2 - tooltipRect.width / 2;
  const left = Math.max(
    viewportPadding,
    Math.min(preferredLeft, viewportWidth - tooltipRect.width - viewportPadding),
  );
  const top =
    cardRect.top > tooltipRect.height + gap + viewportPadding
      ? cardRect.top - tooltipRect.height - gap
      : cardRect.bottom + gap;

  tooltip.style.left = `${Math.round(left + window.scrollX)}px`;
  tooltip.style.top = `${Math.round(top + window.scrollY)}px`;
}

function hideMetricHelp() {
  if (!metricHelpTooltip) {
    return;
  }

  metricHelpTooltip.hidden = true;
  metricHelpTooltip.classList.remove("is-visible");
}

function resetDrilldownCardPaint(cardElement) {
  cardElement.blur();
  cardElement.classList.add("drilldown-card-repaint");

  window.requestAnimationFrame(() => {
    // Force a layout read before removing the repaint class so the card content is redrawn.
    void cardElement.offsetHeight;
    window.requestAnimationFrame(() => {
      cardElement.classList.remove("drilldown-card-repaint");
    });
  });
}

function initializeCardBreakdownControls() {
  cardBreakdownController.initializeControls();
}

function rerenderCardBreakdown() {
  cardBreakdownController.rerender();
}

function getDrilldownCardLabel(cardElement) {
  return cardElement.querySelector(".stat-label, span")?.textContent?.trim() ?? "this value";
}

function openAdvancedDrilldown(drilldown) {
  if (!successContent || successContent.classList.contains("hidden")) {
    return;
  }

  resultsViewMode = "advanced";
  advancedTabKey = drilldown.tab;
  syncResultsView();
  scrollToAdvancedDetail(drilldown.target, { smooth: false });
}

function setAdvancedTabMode(tabKey, options = {}) {
  advancedTabKey = advancedTabPanels.some(
    (panel) => panel.dataset.analysisTabPanel === tabKey,
  )
    ? tabKey
    : advancedTabPanels[0]?.dataset.analysisTabPanel ?? "identity";
  syncAdvancedTabView();

  if (options.scrollToSection) {
    scrollToAdvancedSectionStart();
  }
}

function scrollToAdvancedSectionStart() {
  if (!advancedAnalysis || advancedAnalysis.classList.contains("hidden")) {
    return;
  }

  const scrollToStage = (behavior = "smooth") => {
    const activePanel = advancedTabPanels.find(
      (panel) => panel.dataset.analysisTabPanel === advancedTabKey,
    );
    const scrollTarget = activePanel?.querySelector(".dashboard-section") ?? advancedTabBar;

    if (!scrollTarget) {
      return;
    }

    const scrollRoot = document.scrollingElement ?? document.documentElement;
    const scrollTop = window.scrollY || scrollRoot.scrollTop || document.body.scrollTop || 0;
    const targetTop = scrollTarget.getBoundingClientRect().top + scrollTop;
    const stickyOffset = (advancedTabBar?.getBoundingClientRect().height ?? 0) + 28;
    const nextScrollTop = Math.max(0, targetTop - stickyOffset);

    window.scrollTo({
      top: nextScrollTop,
      behavior,
    });

    if (scrollRoot.scrollTo) {
      scrollRoot.scrollTo({
        top: nextScrollTop,
        behavior,
      });
    } else {
      scrollRoot.scrollTop = nextScrollTop;
    }
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      scrollToStage("smooth");
      window.setTimeout(() => {
        scrollToStage("auto");
      }, 180);
    });
  });
}

function scrollToAdvancedDetail(targetSelector, options = {}) {
  if (!advancedAnalysis || advancedAnalysis.classList.contains("hidden")) {
    return;
  }

  const behavior = options.smooth === false ? "auto" : "smooth";
  const scrollToTarget = (scrollBehavior = behavior, shouldFlash = false) => {
    const targetElement = targetSelector ? document.querySelector(targetSelector) : null;
    const activePanel = advancedTabPanels.find(
      (panel) => panel.dataset.analysisTabPanel === advancedTabKey,
    );
    const fallbackTarget = activePanel?.querySelector(".dashboard-section") ?? advancedTabBar;
    const scrollTarget =
      targetElement?.closest(".note-box, .future-stat, .stat-card, .dashboard-section") ??
      targetElement ??
      fallbackTarget;

    if (!scrollTarget) {
      return;
    }

    scrollWithAdvancedOffset(scrollTarget, scrollBehavior);
    if (shouldFlash) {
      flashDrilldownTarget(scrollTarget);
    }
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      scrollToTarget(behavior);
      window.setTimeout(() => {
        scrollToTarget("auto", true);
      }, 80);
      window.setTimeout(() => {
        scrollToTarget("auto");
      }, 240);
    });
  });
}

function scrollWithAdvancedOffset(scrollTarget, behavior = "smooth") {
  const scrollRoot = document.scrollingElement ?? document.documentElement;
  const scrollTop = window.scrollY || scrollRoot.scrollTop || document.body.scrollTop || 0;
  const targetTop = scrollTarget.getBoundingClientRect().top + scrollTop;
  const stickyOffset = (advancedTabBar?.getBoundingClientRect().height ?? 0) + 28;
  const nextScrollTop = Math.max(0, targetTop - stickyOffset);

  window.scrollTo({
    top: nextScrollTop,
    behavior,
  });

  if (scrollRoot.scrollTo) {
    scrollRoot.scrollTo({
      top: nextScrollTop,
      behavior,
    });
  } else {
    scrollRoot.scrollTop = nextScrollTop;
  }
}

function flashDrilldownTarget(targetElement) {
  if (!targetElement || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  targetElement.classList.remove("drilldown-focus-pulse");
  void targetElement.offsetWidth;
  targetElement.classList.add("drilldown-focus-pulse");
  window.setTimeout(() => {
    targetElement.classList.remove("drilldown-focus-pulse");
  }, 950);
}

function syncResultsView() {
  const hasAnalysis = successContent && !successContent.classList.contains("hidden");
  const showAdvanced = hasAnalysis && resultsViewMode === "advanced";

  advancedAnalysis?.classList.toggle("hidden", !showAdvanced);
  recommendationsBox?.classList.add("hidden");
  quickReadAdvancedButton?.classList.toggle("hidden", !hasAnalysis || showAdvanced);
  syncAdvancedTabView();
}

function syncAdvancedTabView() {
  if (!advancedTabButtons.length || !advancedTabPanels.length) {
    return;
  }

  if (!advancedTabPanels.some((panel) => panel.dataset.analysisTabPanel === advancedTabKey)) {
    advancedTabKey = advancedTabPanels[0]?.dataset.analysisTabPanel ?? "identity";
  }

  advancedTabButtons.forEach((button) => {
    const isActive = button.dataset.advancedTab === advancedTabKey;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });

  advancedTabPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.analysisTabPanel === advancedTabKey);
  });
}

function buildAnalyzePayload(preferredStrategyKey = null, targetBracketOverride = null) {
  const sanitizedDecklist = sanitizeDecklistInput(decklistField.value);
  if (sanitizedDecklist !== decklistField.value) {
    decklistField.value = sanitizedDecklist;
    syncDeckHighlight();
  }

  const decklist = sanitizedDecklist.trim();
  if (!decklist) {
    return {
      error: "Paste a decklist or load a .txt file first.",
      payload: null,
    };
  }

  const targetBracket = Number(targetBracketOverride ?? targetBracketField?.value);
  if (!Number.isInteger(targetBracket) || targetBracket < 1 || targetBracket > 5) {
    return {
      error: "Choose the target bracket to continue.",
      payload: null,
    };
  }

  const deckSummary = window.MtgDeckcheckerDecklistIntake.inspectSections(decklist);
  const guessedLeaders = window.MtgDeckcheckerDecklistIntake.getLeaderPackageFromSummary(deckSummary);

  return {
    error: null,
    payload: {
      decklist,
      targetBracket,
      commanderName: commanderNameField.value.trim() || guessedLeaders.commander || undefined,
      additionalCommanderName: additionalCommanderEnabledField.checked
        ? additionalCommanderNameField.value.trim() || guessedLeaders.secondary || undefined
        : undefined,
      companionName: companionEnabledField.checked
        ? companionNameField.value.trim() || deckSummary.companion || undefined
        : undefined,
      secretCommanderName: secretCommanderEnabledField.checked
        ? secretCommanderNameField.value.trim() || undefined
        : undefined,
      preferredStrategyKey: preferredStrategyKey || undefined,
    },
  };
}

async function runDeckAnalysis(options = {}) {
  const {
    preferredStrategyKey = null,
    targetBracket = null,
    preserveCurrentView = false,
    statusMessage = "Resolving cards from Scryfall and scoring the deck fundamentals...",
    successMessage = "Deck analyzed successfully.",
    loadingTitleText,
    loadingCopyText,
  } = options;
  const payloadResult = buildAnalyzePayload(preferredStrategyKey, targetBracket);

  if (!payloadResult.payload) {
    formStatus.textContent = payloadResult.error;
    return false;
  }

  const payload = payloadResult.payload;

  if (!preserveCurrentView) {
    prepareForNewScan({ preserveSelectedStrategy: Boolean(preferredStrategyKey) });
  }

  const isStrategyRecalculation = Boolean(preferredStrategyKey && preserveCurrentView);
  const resolvedLoadingTitle =
    loadingTitleText ?? (isStrategyRecalculation ? "Recalculating Strategy" : "Analyzing Deck");
  const resolvedLoadingCopy =
    loadingCopyText ??
    (isStrategyRecalculation
      ? "Refreshing the power, bracket, and plan read for the selected main strategy."
      : "Resolving cards, validating the shell, and scoring the deck across every live ranking layer.");

  setLoadingState(true, {
    buttonLabel: isStrategyRecalculation ? "Recalculating..." : "Analyzing Deck...",
    importButtonLabel: "Import URL",
    title: resolvedLoadingTitle,
    copy: resolvedLoadingCopy,
  });
  formStatus.textContent = statusMessage;
  const requestId = ++analyzeRequestCounter;
  await waitForNextPaint();

  try {
    const response = await fetch("/api/edh/decklists/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (requestId !== analyzeRequestCounter) {
      return false;
    }

    if (!response.ok) {
      if (result.validation?.issues) {
        renderValidationIssues(result.validation.issues);
        throw new Error("Fix the listed deck issues before ranking.");
      }

      throw new Error(result.details || result.error || "Analysis failed.");
    }

    renderAnalyzedDeck(result);
    formStatus.textContent = successMessage;
    return true;
  } catch (error) {
    if (requestId !== analyzeRequestCounter) {
      return false;
    }

    formStatus.textContent = formatFetchError(error, "Analysis failed.");
    return false;
  } finally {
    if (requestId === analyzeRequestCounter) {
      setLoadingState(false);
    }
  }
}

function formatFetchError(error, fallbackMessage) {
  if (
    error instanceof TypeError &&
    /failed to fetch|fetch failed|networkerror/i.test(error.message)
  ) {
    return "The website cannot reach the local API server. Start it with `npm run dev` or `npm start`, then open http://localhost:3000 instead of opening the HTML file directly.";
  }

  return error instanceof Error ? error.message : fallbackMessage;
}

function renderWeakMatchups(weaknesses) {
  if (!matchupSummary || !matchupExposureList) {
    return;
  }

  const exposures = weaknesses?.exposures ?? [];
  const highRisks = exposures.filter((entry) => entry.severity === "high");
  const watchRisks = exposures.filter((entry) => entry.severity !== "high");
  const resistantTo = weaknesses?.resistantTo ?? [];

  matchupSummary.textContent =
    weaknesses?.summary ?? "Matchup weaknesses appear here after analysis.";
  if (matchupHighRiskCount) {
    matchupHighRiskCount.textContent = String(highRisks.length);
  }
  if (matchupWatchCount) {
    matchupWatchCount.textContent = String(watchRisks.length);
  }
  if (matchupTopRisk) {
    matchupTopRisk.textContent = exposures[0]?.label ?? "-";
  }
  if (matchupResistantCount) {
    matchupResistantCount.textContent = String(resistantTo.length);
  }

  matchupExposureList.replaceChildren(
    ...(exposures.length > 0
      ? exposures.map(createMatchupExposureCard)
      : [createMatchupEmptyCard()]),
  );

  if (matchupResilienceList) {
    matchupResilienceList.replaceChildren(
      ...(resistantTo.length > 0
        ? resistantTo.map(createSimpleTextItem)
        : [createSimpleTextItem("No clear resistant angle stands out yet.")]),
    );
  }
}

function createMatchupExposureCard(exposure) {
  const article = document.createElement("article");
  article.className = `matchup-exposure-card matchup-exposure-${exposure.severity}`;

  const header = document.createElement("div");
  header.className = "matchup-exposure-header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "matchup-exposure-title-wrap";

  const title = document.createElement("strong");
  title.className = "matchup-exposure-title";
  title.textContent = exposure.label;

  const against = document.createElement("p");
  against.className = "matchup-exposure-against";
  against.textContent = `Weak against: ${(exposure.weakAgainst ?? []).join(", ")}`;

  titleWrap.append(title, against);

  const badge = document.createElement("span");
  badge.className = `matchup-exposure-badge matchup-exposure-badge-${exposure.severity}`;
  badge.textContent = `${Math.round(exposure.vulnerabilityScore)}%`;

  header.append(titleWrap, badge);

  const meter = document.createElement("div");
  meter.className = "matchup-exposure-meter";
  meter.style.setProperty(
    "--matchup-risk",
    String(Math.max(0, Math.min(1, Number(exposure.vulnerabilityScore) / 100))),
  );
  const meterFill = document.createElement("span");
  meter.append(meterFill);

  const summary = document.createElement("p");
  summary.className = "matchup-exposure-summary";
  summary.textContent = exposure.summary;

  const detailGrid = document.createElement("div");
  detailGrid.className = "matchup-detail-grid";
  detailGrid.append(
    createMatchupDetailList("Why", exposure.evidence),
    createMatchupDetailList("Gaps", exposure.answerGaps),
    createMatchupDetailList("Counterplay", exposure.resistantFactors),
  );

  article.append(header, meter, summary, detailGrid);
  return article;
}

function createMatchupDetailList(label, values = []) {
  const wrap = document.createElement("div");
  wrap.className = "matchup-detail-block";

  const heading = document.createElement("span");
  heading.className = "meta-label";
  heading.textContent = label;

  const list = document.createElement("ul");
  list.className = "note-list";
  const entries = values.length > 0 ? values : ["No major signal."];
  list.replaceChildren(...entries.map(createSimpleTextItem));

  wrap.append(heading, list);
  return wrap;
}

function createMatchupEmptyCard() {
  const article = document.createElement("article");
  article.className = "matchup-exposure-card matchup-exposure-low";

  const title = document.createElement("strong");
  title.className = "matchup-exposure-title";
  title.textContent = "No Dominant Weak Matchup";

  const summary = document.createElement("p");
  summary.className = "matchup-exposure-summary";
  summary.textContent =
    "The current tags do not point to a single archetype or hate package that clearly attacks the deck's main plan.";

  article.append(title, summary);
  return article;
}

function createSimpleTextItem(text) {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
}

function renderAnalyzedDeck(result) {
  const { document, analysis, validation, sources } = result;
  const recommendations = analysis.recommendations;
  const strategy = analysis.strategy;
  const winStrategy = analysis.winStrategy;
  const structure = analysis.structure;
  const sourceIssues = getSourceIssues(sources);
  const hasValidationIssues = validation && validation.isValid === false;
  syncResolvedCardLookup(document.result.resolvedCards);
  currentAnalysisSnapshot = analysis;
  currentAnalysisDocument = document;
  structureOverviewController.render(document, structure);
  deckIdentityController.render({
    deckDocument: document,
    analysis,
    fallbackCommanderName: commanderNameField.value.trim(),
    fallbackCompanionName: companionNameField.value.trim(),
    fallbackSecretCommanderName: secretCommanderNameField.value.trim(),
    validation,
    sources,
  });
  summaryPanelsController.render(analysis);
  renderWeakMatchups(analysis.weaknesses);
  metricDetailsController.render(analysis);
  strategyRendererController.render(strategy, winStrategy);
  quickReadController.render(analysis);
  recommendationVisualRenderToken += 1;
  const recommendationRenderToken = recommendationVisualRenderToken;
  renderRecommendations(recommendations, recommendationRenderToken);
  taggedCardSectionsController.render(analysis);
  renderCardBreakdown(document, analysis);

  resultStateController.showAnalysisResults();

  if (hasValidationIssues || sourceIssues.length > 0) {
    const validationIssues = validation?.issues ?? [];
    renderValidationIssues([...validationIssues, ...sourceIssues], {
      preserveAnalysis: true,
      title: "Analysis Limited",
      summary: buildAnalysisLimitedSummary(validationIssues.length, sourceIssues.length),
    });
    formStatus.textContent = hasValidationIssues
      ? "Deck analyzed with validation and source warnings."
      : "Deck analyzed with source warnings.";
  } else {
    highlightedIssueAnchors = [];
    syncDeckHighlight();
  }

  triggerResultReveal();
}

function triggerResultReveal() {
  if (!resultContent || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  resultContent
    .querySelectorAll(".stat-card, .future-stat")
    .forEach((element, index) => element.style.setProperty("--reveal-index", String(index + 1)));
  resultContent.classList.remove("is-revealing");
  void resultContent.offsetWidth;
  resultContent.classList.add("is-revealing");
}

function applyImportedDecklist(decklistText, options = {}) {
  const {
    importedUrl = deckUrlField?.value ?? "",
    statusMessage = "Deck imported. Ready to analyze the deck.",
  } = options;

  resetResultState();
  decklistField.value = decklistText;
  if (deckUrlField) {
    deckUrlField.value = importedUrl;
  }
  resetLeaderField(commanderNameField);
  additionalCommanderEnabledField.checked = false;
  resetLeaderField(additionalCommanderNameField);
  companionEnabledField.checked = false;
  secretCommanderEnabledField.checked = false;
  resetLeaderField(companionNameField);
  resetLeaderField(secretCommanderNameField);
  prefillLeaderFieldsFromDecklist(decklistText, {
    allowAdditionalCommanderAutoEnable: true,
    allowCompanionAutoEnable: true,
  });
  syncDeckHighlight();
  formStatus.textContent = statusMessage;
}

function renderValidationIssues(issues, options = {}) {
  const {
    preserveAnalysis = false,
    title = "Validation Issues",
    summary = "Fix the listed deck issues before ranking.",
  } = options;

  if (!preserveAnalysis) {
    resultStateController.showValidationIssues();
  } else {
    issuesBox.classList.remove("hidden");
  }

  if (issuesTitle) {
    issuesTitle.textContent = title;
  }

  if (issuesSummary) {
    issuesSummary.textContent = summary;
  }

  highlightedIssueAnchors = issues
    .map((issue) => createIssueAnchor(issue))
    .filter(Boolean);
  syncDeckHighlight();
  issuesList.replaceChildren(
    ...issues.map((issue) => createListItem(formatIssue(issue))),
  );
}

function getSourceIssues(sources) {
  return Object.values(sources ?? {})
    .filter((source) => source && source.status !== "ok")
    .map((source) => ({
      code: `source_${source.key}`,
      message: `${source.label}: ${source.summary}`,
    }));
}

function buildAnalysisLimitedSummary(validationIssueCount, sourceIssueCount) {
  const parts = [];

  if (validationIssueCount > 0) {
    parts.push(formatIssueCount(validationIssueCount));
  }

  if (sourceIssueCount > 0) {
    parts.push(`${sourceIssueCount} source warning${sourceIssueCount === 1 ? "" : "s"}`);
  }

  return `${parts.join(" and ")}. The results below were still calculated, but affected sections may be less accurate.`;
}

function formatIssueCount(count) {
  return `${count} validation issue${count === 1 ? "" : "s"}`;
}

function getCardImageUrl(card) {
  return (
    card.image_uris?.normal ??
    card.image_uris?.large ??
    card.image_uris?.png ??
    card.image_uris?.small ??
    card.card_faces?.find((face) => face.image_uris?.normal)?.image_uris?.normal ??
    card.card_faces?.find((face) => face.image_uris?.large)?.image_uris?.large ??
    card.card_faces?.find((face) => face.image_uris?.png)?.image_uris?.png ??
    card.card_faces?.find((face) => face.image_uris?.small)?.image_uris?.small ??
    null
  );
}

function getCardPreviewUrl(card) {
  return (
    card.image_uris?.small ??
    card.image_uris?.normal ??
    card.image_uris?.large ??
    card.image_uris?.png ??
    card.card_faces?.find((face) => face.image_uris?.small)?.image_uris?.small ??
    card.card_faces?.find((face) => face.image_uris?.normal)?.image_uris?.normal ??
    card.card_faces?.find((face) => face.image_uris?.large)?.image_uris?.large ??
    card.card_faces?.find((face) => face.image_uris?.png)?.image_uris?.png ??
    null
  );
}

function buildScryfallSearchUrl(name) {
  return `https://scryfall.com/search?q=%21%22${encodeURIComponent(name)}%22`;
}

async function getRecommendationCardVisual(name) {
  const key = normalizeCardLookupKey(name);
  if (!key) {
    return null;
  }

  if (recommendationCardVisualCache.has(key)) {
    return recommendationCardVisualCache.get(key);
  }

  if (recommendationCardVisualPending.has(key)) {
    return recommendationCardVisualPending.get(key);
  }

  const resolvedCard = findResolvedCardForTaggedName(name);
  if (resolvedCard) {
    const resolvedVisual = {
      name: resolvedCard.card.name,
      imageUrl: getCardPreviewUrl(resolvedCard.card),
      scryfallUrl: resolvedCard.card.scryfall_uri,
    };
    recommendationCardVisualCache.set(key, resolvedVisual);
    return resolvedVisual;
  }

  const ambientCard = themeMediaController.getCardByName(name);
  if (ambientCard) {
    const ambientVisual = {
      name: ambientCard.name,
      imageUrl: ambientCard.imageUrl,
      scryfallUrl: buildScryfallSearchUrl(ambientCard.name),
    };
    recommendationCardVisualCache.set(key, ambientVisual);
    return ambientVisual;
  }

  const pending = fetchRecommendationCardVisual(name)
    .then((visual) => {
      recommendationCardVisualCache.set(key, visual);
      recommendationCardVisualPending.delete(key);
      return visual;
    })
    .catch(() => {
      recommendationCardVisualPending.delete(key);
      return null;
    });

  recommendationCardVisualPending.set(key, pending);
  return pending;
}

async function fetchRecommendationCardVisual(name) {
  const attempts = ["exact", "fuzzy"];

  for (const mode of attempts) {
    const response = await fetch(
      `https://api.scryfall.com/cards/named?${mode}=${encodeURIComponent(name)}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      if (response.status === 404) {
        continue;
      }

      throw new Error(`Scryfall request failed with status ${response.status}`);
    }

    const card = await response.json();
    const imageUrl = getCardPreviewUrl(card);
    if (!imageUrl) {
      continue;
    }

    return {
      name: card.name ?? name,
      imageUrl,
      scryfallUrl: card.scryfall_uri ?? buildScryfallSearchUrl(card.name ?? name),
    };
  }

  return null;
}

function syncResolvedCardLookup(resolvedCards) {
  resolvedCardLookup = new Map();

  resolvedCards.forEach((deckCard) => {
    addResolvedCardLookupAlias(deckCard.card.name, deckCard);
    addResolvedCardLookupAlias(deckCard.requestedName, deckCard);
    addResolvedCardLookupAlias(deckCard.card.printed_name, deckCard);
    addResolvedCardLookupAlias(deckCard.card.flavor_name, deckCard);

    deckCard.card.card_faces?.forEach((face) => {
      addResolvedCardLookupAlias(face.name, deckCard);
      addResolvedCardLookupAlias(face.printed_name, deckCard);
      addResolvedCardLookupAlias(face.flavor_name, deckCard);
    });
  });
}

function addResolvedCardLookupAlias(value, deckCard) {
  const key = normalizeCardLookupKey(value);
  if (!key || resolvedCardLookup.has(key)) {
    return;
  }

  resolvedCardLookup.set(key, deckCard);
}

function normalizeCardLookupKey(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findResolvedCardForTaggedName(name) {
  const key = normalizeCardLookupKey(name);
  if (!key) {
    return null;
  }

  return resolvedCardLookup.get(key) ?? null;
}

function renderRecommendations(recommendations, renderToken = recommendationVisualRenderToken) {
  recommendationsController.render(recommendations, renderToken);
}

function initializeInsightDisclosures() {
  collapsibleInsightLists.forEach((listElement) => {
    if (!listElement || listElement.closest(".insight-disclosure")) {
      return;
    }

    const block = listElement.closest(".tagged-card-block");
    if (!block) {
      return;
    }

    const label = block.querySelector(".meta-label")?.textContent?.trim() ?? "Details";
    const details = document.createElement("details");
    details.className = "insight-disclosure";

    const summary = document.createElement("summary");
    summary.className = "insight-disclosure-summary";
    summary.textContent = `Show ${label.toLowerCase()}`;

    const body = document.createElement("div");
    body.className = "insight-disclosure-body";

    listElement.remove();
    body.append(listElement);
    details.append(summary, body);
    block.append(details);
  });
}

function createListItem(text) {
  const item = document.createElement("li");
  item.textContent = text;
  return item;
}

function formatIssue(issue) {
  if (issue.lineNumber) {
    return `Line ${issue.lineNumber}: ${issue.message}`;
  }

  return issue.message;
}

function resetResultState() {
  resultStateController.resetResultState();
}

function markDeckAsEdited() {
  resultStateController.markDeckAsEdited();
}

function prepareForNewScan(options = {}) {
  resultStateController.prepareForNewScan(options);
}

function syncWorkspaceMode(showIntakeOnly) {
  pageShell?.classList.toggle("intake-mode", showIntakeOnly);
}

function prefillCommanderFromDecklist(decklistText, options = {}) {
  leaderFieldsController.prefillFromDecklist(decklistText, options);
}

function prefillLeaderFieldsFromDecklist(decklistText, options = {}) {
  prefillCommanderFromDecklist(decklistText, options);
}

function buildDeckIntakeStatus(decklistText) {
  return window.MtgDeckcheckerDecklistIntake.buildDeckIntakeStatus(decklistText);
}

function sanitizeDecklistInput(decklistText) {
  return window.MtgDeckcheckerDecklistIntake.sanitizeDecklistInput(decklistText);
}

function syncSupplementalLeaderFields() {
  leaderFieldsController.syncSupplementalFields();
}

function markLeaderFieldAsManual(field) {
  leaderFieldsController.markFieldAsManual(field);
}

function resetLeaderField(field) {
  leaderFieldsController.resetField(field);
}

function clearAutofilledLeaderFields() {
  leaderFieldsController.clearAutofilledFields();
}

syncSupplementalLeaderFields();
deckInputController.updateFilePickerLabel();
initializeInsightDisclosures();
themeMediaController.initialize();
syncResultsView();

function syncDeckHighlight() {
  const lines = decklistField.value.split(/\r?\n/);
  const safeLines = lines.length ? lines : [""];
  const markedLineIndexes = findMarkedLineIndexes(safeLines);
  const styles = window.getComputedStyle(decklistField);
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
  const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
  const fontSize = Number.parseFloat(styles.fontSize) || 15;
  const rowInset = Math.max(2, Math.round((lineHeight - Math.min(lineHeight - 4, fontSize + 6)) / 2));
  const highlightHeight = Math.max(12, lineHeight - rowInset * 2);

  if (!markedLineIndexes.size) {
    clearDeckHighlight();
    return;
  }

  const backgroundImage = [];
  const backgroundSize = [];
  const backgroundPosition = [];
  const backgroundRepeat = [];
  const backgroundAttachment = [];

  for (const index of markedLineIndexes) {
    backgroundImage.push("linear-gradient(rgba(214, 93, 73, 0.18), rgba(214, 93, 73, 0.18))");
    backgroundSize.push(`calc(100% - ${paddingLeft * 2}px) ${highlightHeight}px`);
    backgroundPosition.push(`${paddingLeft}px ${paddingTop + index * lineHeight + rowInset}px`);
    backgroundRepeat.push("no-repeat");
    backgroundAttachment.push("local");
  }

  decklistField.style.backgroundImage = backgroundImage.join(", ");
  decklistField.style.backgroundSize = backgroundSize.join(", ");
  decklistField.style.backgroundPosition = backgroundPosition.join(", ");
  decklistField.style.backgroundRepeat = backgroundRepeat.join(", ");
  decklistField.style.backgroundAttachment = backgroundAttachment.join(", ");
}

function clearDeckHighlight() {
  decklistField.style.backgroundImage = "";
  decklistField.style.backgroundSize = "";
  decklistField.style.backgroundPosition = "";
  decklistField.style.backgroundRepeat = "";
  decklistField.style.backgroundAttachment = "";
}

function createIssueAnchor(issue) {
  if (!Number.isInteger(issue.lineNumber) || issue.lineNumber < 1) {
    return null;
  }

  const lines = decklistField.value.split(/\r?\n/);
  const lineText = lines[issue.lineNumber - 1];

  if (typeof lineText !== "string" || lineText.length === 0) {
    return null;
  }

  return {
    lineNumber: issue.lineNumber,
    lineText,
  };
}

function findMarkedLineIndexes(lines) {
  const markedLineIndexes = new Set();
  const usedLineIndexes = new Set();

  for (const anchor of highlightedIssueAnchors) {
    const matchingIndex = findBestMatchingLineIndex(lines, anchor, usedLineIndexes);
    if (matchingIndex === -1) {
      continue;
    }

    markedLineIndexes.add(matchingIndex);
    usedLineIndexes.add(matchingIndex);
  }

  return markedLineIndexes;
}

function findBestMatchingLineIndex(lines, anchor, usedLineIndexes) {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  const preferredIndex = anchor.lineNumber - 1;

  for (let index = 0; index < lines.length; index += 1) {
    if (usedLineIndexes.has(index) || lines[index] !== anchor.lineText) {
      continue;
    }

    const distance = Math.abs(index - preferredIndex);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function renderCardBreakdown(deckDocument, analysis) {
  cardBreakdownController.render(deckDocument, analysis);
}

function formatOneDecimal(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "0";
  }
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function roundTo(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }

  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .trim()
    .toLowerCase();
}

function formatTagLabel(value = "") {
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
