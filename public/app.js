const pageShell = document.querySelector(".page-shell");
const ambientCardBackground = document.querySelector("#ambient-card-background");
const heroMediaCardImages = Array.from(document.querySelectorAll(".hero-media-card img"));
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
const taggedCardPreviewContainers = [
  commanderCardsPreview,
  gameChangerCardsPreview,
  landBaseCardsPreview,
  rampCardsPreview,
  drawCardsPreview,
  consistencyCardsPreview,
  removalCardsPreview,
  spellInteractionCardsPreview,
  protectionCardsPreview,
  recursionCardsPreview,
  finisherCardsPreview,
].filter(Boolean);

let highlightedIssueAnchors = [];
let selectedStrategyPerspectiveKey = null;
let currentAnalysisSnapshot = null;
let currentAnalysisDocument = null;
let analyzeRequestCounter = 0;
let resultsViewMode = "simple";
let advancedTabKey = "identity";
let pendingTargetBracketPromptResolve = null;
let recommendationVisualRenderToken = 0;
const FRONTEND_CONFIG = window.MtgDeckcheckerFrontendConfig ?? {};
const CARD_BREAKDOWN_CONFIG = FRONTEND_CONFIG.cardBreakdown ?? {};
const CARD_BREAKDOWN_MAX_ROLES = CARD_BREAKDOWN_CONFIG.maxRoles ?? 5;
const CARD_BREAKDOWN_ROLE_PRIORITY = CARD_BREAKDOWN_CONFIG.rolePriority ?? [];
const CARD_BREAKDOWN_SYNERGY_LABELS = new Set(CARD_BREAKDOWN_CONFIG.synergyLabels ?? ["Synergy"]);
const CARD_BREAKDOWN_LOW_SIGNAL_LAND_TAGS = new Set(
  CARD_BREAKDOWN_CONFIG.lowSignalLandTags ?? ["Land Base", "Land Slot", "Basic Land", "Mana Source"],
);
const THEME_STORAGE_KEY = FRONTEND_CONFIG.themeStorageKey ?? "mtg-deckchecker-theme";
const TAGGED_CARD_PREVIEW_LIMIT = FRONTEND_CONFIG.taggedCardPreviewLimit ?? 4;
const RECOMMENDATION_TOPICS = FRONTEND_CONFIG.recommendationTopics ?? [];
const SIMPLE_VALUE_DRILLDOWNS = FRONTEND_CONFIG.simpleValueDrilldowns ?? {};
const TAG_LABELS = FRONTEND_CONFIG.tagLabels ?? {};
const AMBIENT_CARD_POOL = [
  {
    name: "Rhystic Study",
    imageUrl: "https://cards.scryfall.io/normal/front/d/6/d6914dba-0d27-4055-ac34-b3ebf5802221.jpg?1600698439",
  },
  {
    name: "Smothering Tithe",
    imageUrl: "https://cards.scryfall.io/normal/front/8/6/861b5889-0183-4bee-afeb-a4b2aa700a8e.jpg?1689996018",
  },
  {
    name: "Birds of Paradise",
    imageUrl: "https://cards.scryfall.io/normal/front/3/d/3d69a3e0-6a2e-475a-964e-0affed1c017d.jpg?1722384747",
  },
  {
    name: "Cyclonic Rift",
    imageUrl: "https://cards.scryfall.io/normal/front/d/f/dfb7c4b9-f2f4-4d4e-baf2-86551c8150fe.jpg?1702429366",
  },
  {
    name: "Swords to Plowshares",
    imageUrl: "https://cards.scryfall.io/normal/front/6/8/68ec2aed-7662-48ae-ab25-04f74ece1e41.jpg?1775940857",
  },
  {
    name: "Demonic Tutor",
    imageUrl: "https://cards.scryfall.io/normal/front/a/2/a24b4cb6-cebb-428b-8654-74347a6a8d63.jpg?1763472867",
  },
  {
    name: "Lightning Greaves",
    imageUrl: "https://cards.scryfall.io/normal/front/0/8/08005be9-fbf4-43e6-a742-b1fb8196c4a5.jpg?1775942055",
  },
  {
    name: "Cultivate",
    imageUrl: "https://cards.scryfall.io/normal/front/f/1/f1cc00f9-ae7b-4f7b-95f2-bc5c00e4bd72.jpg?1775941453",
  },
  {
    name: "Counterspell",
    imageUrl: "https://cards.scryfall.io/normal/front/4/f/4f616706-ec97-4923-bb1e-11a69fbaa1f8.jpg?1751282477",
  },
  {
    name: "Atraxa, Praetors' Voice",
    imageUrl: "https://cards.scryfall.io/normal/front/d/0/d0d33d52-3d28-4635-b985-51e126289259.jpg?1599707796",
  },
  {
    name: "Sol Ring",
    imageUrl: "https://cards.scryfall.io/normal/front/8/7/870ec754-a76c-40ea-9b81-81b3dca1f62c.jpg?1775940518",
  },
  {
    name: "Command Tower",
    imageUrl: "https://cards.scryfall.io/normal/front/c/4/c46a217c-0ed2-4b3c-9a01-ee38d12d76f3.jpg?1775940525",
  },
  {
    name: "Arcane Signet",
    imageUrl: "https://cards.scryfall.io/normal/front/7/8/7811dd72-61b9-4067-ac20-cea153e625d2.jpg?1775940512",
  },
  {
    name: "Fierce Guardianship",
    imageUrl: "https://cards.scryfall.io/normal/front/f/7/f7f3dd95-bd14-4e0f-a388-444f9cf1b0dc.jpg?1767727540",
  },
  {
    name: "Esper Sentinel",
    imageUrl: "https://cards.scryfall.io/normal/front/f/3/f3537373-ef54-4578-9d05-6216420ee349.jpg?1626093502",
  },
  {
    name: "Dockside Extortionist",
    imageUrl: "https://cards.scryfall.io/normal/front/9/e/9e2e3efb-75cb-430f-b9f4-cb58f3aeb91b.jpg?1727093692",
  },
  {
    name: "The One Ring",
    imageUrl: "https://cards.scryfall.io/normal/front/d/5/d5806e68-1054-458e-866d-1f2470f682b2.jpg?1763472900",
  },
  {
    name: "Teferi's Protection",
    imageUrl: "https://cards.scryfall.io/normal/front/4/8/483fa1cb-1e35-44f2-a143-98c0f107f5ca.jpg?1745319936",
  },
  {
    name: "The Ur-Dragon",
    imageUrl: "https://cards.scryfall.io/normal/front/1/0/10d42b35-844f-4a64-9981-c6118d45e826.jpg?1689999317",
  },
  {
    name: "Mystic Remora",
    imageUrl: "https://cards.scryfall.io/normal/front/4/0/40140991-cffa-4b52-9a25-37e9a8aa9ddd.jpg?1675199366",
  },
];
const HERO_CARD_POOL = [...AMBIENT_CARD_POOL];
const AMBIENT_CARD_LAYOUT_PRESETS = {
  light: {
    desktop: {
      gapX: 270,
      gapY: 350,
      startX: -88,
      startY: 106,
      rowOffset: 135,
      edgeX: 135,
      edgeY: 175,
      maxSlots: 34,
      widths: [
        "224px",
        "162px",
        "210px",
        "154px",
        "220px",
        "170px",
        "228px",
        "160px",
        "214px",
        "152px",
        "222px",
        "168px",
        "226px",
        "158px",
        "216px",
        "164px",
        "230px",
        "166px",
        "212px",
        "156px",
      ],
      rotations: [
        "-11deg",
        "7deg",
        "-8deg",
        "10deg",
        "-9deg",
        "6deg",
        "-12deg",
        "8deg",
        "-7deg",
        "9deg",
        "-10deg",
        "7deg",
        "-11deg",
        "6deg",
        "-8deg",
        "9deg",
        "-12deg",
        "7deg",
        "-9deg",
        "8deg",
      ],
    },
    tablet: {
      gapX: 300,
      gapY: 350,
      startX: -78,
      startY: 116,
      rowOffset: 138,
      edgeX: 120,
      edgeY: 165,
      maxSlots: 20,
      widths: [
        "214px",
        "158px",
        "202px",
        "150px",
        "208px",
        "164px",
        "218px",
        "156px",
        "206px",
        "152px",
        "212px",
        "160px",
      ],
      rotations: ["-10deg", "7deg", "-8deg", "9deg", "-9deg", "6deg", "-11deg", "7deg", "-8deg", "9deg", "-10deg", "6deg"],
    },
    mobile: {
      gapX: 292,
      gapY: 336,
      startX: -68,
      startY: 110,
      rowOffset: 118,
      edgeX: 92,
      edgeY: 144,
      maxSlots: 12,
      widths: ["198px", "150px", "186px", "144px", "194px", "152px", "188px"],
      rotations: ["-10deg", "7deg", "-7deg", "8deg", "-9deg", "6deg", "-8deg"],
    },
  },
  dark: {
    desktop: {
      gapX: 315,
      gapY: 355,
      startX: -85,
      startY: 110,
      rowOffset: 155,
      edgeX: 130,
      edgeY: 170,
      maxSlots: 29,
      widths: [
        "250px",
        "172px",
        "226px",
        "160px",
        "240px",
        "186px",
        "254px",
        "168px",
        "218px",
        "156px",
        "236px",
        "178px",
        "230px",
        "164px",
        "246px",
        "184px",
      ],
      rotations: [
        "-12deg",
        "8deg",
        "-8deg",
        "11deg",
        "-10deg",
        "7deg",
        "-13deg",
        "6deg",
        "-7deg",
        "10deg",
        "-9deg",
        "8deg",
        "-11deg",
        "7deg",
        "-12deg",
        "9deg",
      ],
    },
    tablet: {
      gapX: 330,
      gapY: 360,
      startX: -75,
      startY: 120,
      rowOffset: 145,
      edgeX: 115,
      edgeY: 160,
      maxSlots: 18,
      widths: [
        "222px",
        "164px",
        "208px",
        "154px",
        "216px",
        "170px",
        "224px",
        "160px",
        "210px",
        "168px",
      ],
      rotations: [
        "-11deg",
        "8deg",
        "-8deg",
        "10deg",
        "-9deg",
        "7deg",
        "-12deg",
        "6deg",
        "-8deg",
        "9deg",
      ],
    },
    mobile: {
      gapX: 305,
      gapY: 340,
      startX: -68,
      startY: 112,
      rowOffset: 122,
      edgeX: 90,
      edgeY: 140,
      maxSlots: 10,
      widths: ["194px", "148px", "182px", "142px", "190px", "150px"],
      rotations: ["-10deg", "7deg", "-7deg", "9deg", "-9deg", "6deg"],
    },
  },
};
let ambientResizeHandle = 0;
let resolvedCardLookup = new Map();
const recommendationCardVisualCache = new Map();
const recommendationCardVisualPending = new Map();
const cardBreakdownController = window.MtgDeckcheckerCardBreakdown.create({
  elements: {
    count: cardBreakdownCount,
    summary: cardBreakdownSummary,
    body: cardBreakdownBody,
    search: cardBreakdownSearch,
    sectionFilter: cardBreakdownSectionFilter,
    roleFilter: cardBreakdownRoleFilter,
    sort: cardBreakdownSort,
  },
  config: {
    maxRoles: CARD_BREAKDOWN_MAX_ROLES,
    rolePriority: CARD_BREAKDOWN_ROLE_PRIORITY,
    synergyLabels: CARD_BREAKDOWN_SYNERGY_LABELS,
    lowSignalLandTags: CARD_BREAKDOWN_LOW_SIGNAL_LAND_TAGS,
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
    selectedStrategyPerspectiveKey,
    resultsViewMode,
    advancedTabKey,
    theme: getActiveTheme(),
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

fileField.addEventListener("change", async () => {
  const [file] = fileField.files ?? [];

  if (!file) {
    updateFilePickerLabel();
    return;
  }

  updateFilePickerLabel(file.name);
  const text = await file.text();
  applyImportedDecklist(text, {
    importedUrl: "",
    statusMessage: `Loaded ${file.name}. Ready to analyze the deck.`,
  });
});

importUrlButton?.addEventListener("click", async () => {
  await importDeckFromUrl();
});

deckUrlField?.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") {
    return;
  }

  event.preventDefault();
  await importDeckFromUrl();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const sanitizedDecklist = sanitizeDecklistInput(decklistField.value);
  if (sanitizedDecklist !== decklistField.value) {
    decklistField.value = sanitizedDecklist;
    syncDeckHighlight();
  }

  if (!sanitizedDecklist.trim()) {
    formStatus.textContent = "Paste a decklist or load a .txt file first.";
    return;
  }

  const targetBracket = await promptForTargetBracketSelection();
  if (!targetBracket) {
    formStatus.textContent = "Analysis canceled. Choose a target bracket to continue.";
    return;
  }

  targetBracketField.value = String(targetBracket);
  await runDeckAnalysis({ targetBracket });
});

decklistField.addEventListener("blur", () => {
  prefillLeaderFieldsFromDecklist(decklistField.value);
  const intakeStatus = buildDeckIntakeStatus(decklistField.value);
  if (intakeStatus) {
    formStatus.textContent = intakeStatus;
  }
});

decklistField.addEventListener("input", () => {
  clearAutofilledLeaderFields();
  markDeckAsEdited();
  syncDeckHighlight();
});

commanderNameField.addEventListener("input", () => {
  markLeaderFieldAsManual(commanderNameField);
  markDeckAsEdited();
});

additionalCommanderNameField.addEventListener("input", () => {
  markLeaderFieldAsManual(additionalCommanderNameField);
  markDeckAsEdited();
});

companionNameField.addEventListener("input", () => {
  markLeaderFieldAsManual(companionNameField);
  markDeckAsEdited();
});

secretCommanderNameField.addEventListener("input", () => {
  markLeaderFieldAsManual(secretCommanderNameField);
  markDeckAsEdited();
});

additionalCommanderEnabledField.addEventListener("change", () => {
  syncSupplementalLeaderFields();
  prefillLeaderFieldsFromDecklist(decklistField.value);
  markDeckAsEdited();
});

companionEnabledField.addEventListener("change", () => {
  syncSupplementalLeaderFields();
  prefillLeaderFieldsFromDecklist(decklistField.value);
  markDeckAsEdited();
});

secretCommanderEnabledField.addEventListener("change", () => {
  syncSupplementalLeaderFields();
  markDeckAsEdited();
});

themeToggle?.addEventListener("click", () => {
  const nextTheme = getActiveTheme() === "dark" ? "light" : "dark";
  window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  applyTheme(nextTheme);
});

quickReadAdvancedButton?.addEventListener("click", () => {
  setResultsViewMode("advanced");
});

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

decklistField.addEventListener("scroll", () => {
  syncDeckHighlight();
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

  const deckSummary = inspectDecklistSections(decklist);
  const guessedLeaders = getLeaderPackageFromSummary(deckSummary);

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

async function importDeckFromUrl() {
  const deckUrl = deckUrlField?.value.trim() ?? "";

  if (!deckUrl) {
    formStatus.textContent = "Paste a Moxfield or Archidekt deck URL first.";
    return false;
  }

  setLoadingState(true, {
    buttonLabel: "Analyze Deck",
    importButtonLabel: "Importing...",
    title: "Importing Deck URL",
    copy: "Fetching the public deck and converting it into the deck text format used by the analyzer.",
  });
  formStatus.textContent = "Importing deck URL...";
  await waitForNextPaint();

  try {
    const response = await fetch("/api/edh/decklists/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: deckUrl }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.details || result.error || "Deck URL import failed.");
    }

    if (fileField) {
      fileField.value = "";
    }
    updateFilePickerLabel();
    applyImportedDecklist(result.decklist, {
      importedUrl: result.canonicalUrl || deckUrl,
      statusMessage: `Imported "${result.title}" from ${result.sourceLabel}. Ready to analyze the deck.`,
    });
    return true;
  } catch (error) {
    formStatus.textContent = formatFetchError(error, "Deck URL import failed.");
    return false;
  } finally {
    setLoadingState(false);
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

function renderAnalyzedDeck(result) {
  const { document, analysis } = result;
  const commander = analysis.commander;
  const power = analysis.power;
  const bracket = analysis.bracket;
  const recommendations = analysis.recommendations;
  const strategy = analysis.strategy;
  const winStrategy = analysis.winStrategy;
  const structure = analysis.structure;
  const landBase = analysis.landBase;
  const ramp = analysis.ramp;
  const draw = analysis.draw;
  const consistency = analysis.consistency;
  const gameChangers = analysis.gameChangers;
  const protection = analysis.protection;
  const recursion = analysis.recursion;
  const winConditions = analysis.winConditions;
  const removal = analysis.removal;
  const spellInteraction = analysis.spellInteraction;
  const commanderCards = document.result.resolvedCards.filter((item) => item.section === "commander");
  const companionCard = document.result.resolvedCards.find((item) => item.section === "companion");
  syncResolvedCardLookup(document.result.resolvedCards);
  currentAnalysisSnapshot = analysis;
  currentAnalysisDocument = document;
  ensureSelectedStrategyPerspective(strategy);

  structureScore.textContent = String(structure.structureScore);
  landCount.textContent = String(structure.counts.lands);
  creatureCount.textContent = String(structure.counts.creatures);
  averageCmc.textContent = structure.mana.averageManaValue.toFixed(2);
  resolvedCount.textContent = String(document.result.resolvedCount);
  uniqueCount.textContent = String(document.parse.uniqueCards);
  const deckSize = document.result.resolvedCards
    .filter((item) => item.section === "commander" || item.section === "mainboard")
    .reduce((sum, item) => sum + item.quantity, 0);
  totalCount.textContent = String(deckSize);
  instantCount.textContent = String(structure.counts.instants);
  sorceryCount.textContent = String(structure.counts.sorceries);
  artifactCount.textContent = String(structure.counts.artifacts);
  enchantmentCount.textContent = String(structure.counts.enchantments);
  planeswalkerCount.textContent = String(structure.counts.planeswalkers);
  battleCount.textContent = String(structure.counts.battles);
  commanderDisplay.textContent =
    commanderCards.map((item) => item.card.name).join(" + ") ||
    commanderNameField.value.trim() ||
    "Commander not detected";
  renderCommanderVisuals(commanderCards);
  companionDisplay.textContent = companionCard?.card.name || companionNameField.value.trim() || "-";
  secretCommanderDisplay.textContent = secretCommanderNameField.value.trim() || "-";
  renderAnalysisStatus({
    commander,
    power,
    bracket,
    strategy,
    winStrategy,
    structure,
    ramp,
    draw,
    consistency,
    removal,
    spellInteraction,
    protection,
    recursion,
    winConditions,
    gameChangers,
  });
  powerSummary.textContent = power.summary;
  powerScore.textContent = `${power.powerScore.toFixed(1)} / 10`;
  powerSynergy.textContent = String(strategy.synergy?.synergyScore ?? 0);
  bracketSummary.textContent = bracket.summary;
  bracketRecommended.textContent = bracket.recommendedLabel;
  bracketTarget.textContent = bracket.targetLabel
    ? `${bracket.targetLabel} | ${bracket.targetName}`
    : "Not set";
  bracketPowerRead.textContent = `${bracket.powerLabel} | ${bracket.powerName}`;
  bracketRulesFloor.textContent = bracket.rulesFloorLabel;
  bracketGameChangers.textContent = String(bracket.signals.gameChangers);
  bracketTwoCardCombos.textContent = String(bracket.signals.twoCardCombos);
  bracketExtraTurns.textContent = String(bracket.signals.extraTurns);
  bracketLandDenial.textContent = String(bracket.signals.massLandDenial);
  commanderSummary.textContent = commander.summary;
  commanderImpactScore.textContent = String(Math.round(commander.impactScore));
  commanderDependencyScore.textContent = String(Math.round(commander.dependencyScore));
  commanderCeilingScore.textContent = String(Math.round(commander.ceilingScore));
  commanderComboLines.textContent = String(commander.commanderInvolvedCombos);
  commanderPriorScore.textContent = String(commander.prior.score);
  commanderKeyRoles.textContent =
    commander.keyRoles.length > 0 ? commander.keyRoles.join(" | ") : "Low";
  powerSpeed.textContent = formatWholeScore(getPowerDimensionScore(power, "speed"));
  powerConsistency.textContent = formatWholeScore(getPowerDimensionScore(power, "consistency"));
  powerInteraction.textContent = formatWholeScore(getPowerDimensionScore(power, "interaction"));
  powerResilience.textContent = formatWholeScore(getPowerDimensionScore(power, "resilience"));
  powerClosing.textContent = formatWholeScore(getPowerDimensionScore(power, "closing"));
  powerMana.textContent = formatWholeScore(getPowerDimensionScore(power, "mana"));
  recommendedLands.textContent = `${structure.mana.recommendedLands.min}-${structure.mana.recommendedLands.max}`;
  medianCmc.textContent = structure.mana.medianManaValue.toFixed(2);
  landFit.textContent = formatFindingLabel(structure.findings[0]);
  curveProfile.textContent = formatFindingLabel(structure.findings[2]);
  earlyShare.textContent = formatPercent(structure.mana.shares.early);
  lateShare.textContent = formatPercent(structure.mana.shares.late);
  landBaseScore.textContent = String(landBase.landBaseScore);
  landBaseFast.textContent = String(landBase.counts.reliableUntapped);
  landBaseAlwaysTapped.textContent = String(landBase.counts.alwaysTapped);
  landBaseConditional.textContent = String(landBase.counts.conditionalTapped);
  landBaseFetch.textContent = String(landBase.counts.fetch);
  landBaseTyped.textContent = String(landBase.counts.typed);
  landBaseUtility.textContent = String(landBase.counts.utility);
  landBaseColorless.textContent = String(landBase.counts.colorlessOnly);
  landBaseCostly.textContent = String(landBase.counts.costly);
  landBaseTarget.textContent =
    `${landBase.recommendations.alwaysTappedMax} / ${landBase.recommendations.colorlessOnlyMax}`;
  rampScore.textContent = String(ramp.rampScore);
  coreRamp.textContent = formatDecimal(ramp.counts.core);
  stableRamp.textContent = formatDecimal(ramp.counts.stable);
  landRamp.textContent = formatDecimal(ramp.counts.landAcceleration);
  burstRamp.textContent = formatDecimal(ramp.counts.burst);
  fixingRamp.textContent = formatDecimal(ramp.counts.manaFixing);
  costRamp.textContent = formatDecimal(ramp.counts.costReduction);
  taggedRampCount.textContent = String(
    ramp.taggedCards.reduce((total, card) => total + card.quantity, 0),
  );
  rampTarget.textContent = `${ramp.recommendations.coreTarget} / ${ramp.recommendations.stableTarget}`;
  drawScore.textContent = String(draw.drawScore);
  coreDraw.textContent = formatDecimal(draw.counts.core);
  rawDraw.textContent = formatDecimal(draw.counts.draw);
  selectionDraw.textContent = formatDecimal(draw.counts.selection);
  repeatableDraw.textContent = formatDecimal(draw.counts.repeatable);
  taggedDrawCount.textContent = String(
    draw.taggedCards.reduce((total, card) => total + card.quantity, 0),
  );
  drawTarget.textContent = `${draw.recommendations.drawTarget} / ${draw.recommendations.repeatableTarget}`;
  consistencyScore.textContent = String(consistency.consistencyScore);
  coreConsistency.textContent = formatDecimal(consistency.counts.core);
  directTutors.textContent = formatDecimal(consistency.counts.direct);
  restrictedTutors.textContent = formatDecimal(consistency.counts.restricted);
  repeatableTutors.textContent = formatDecimal(consistency.counts.repeatable);
  landTutors.textContent = formatDecimal(consistency.counts.land);
  selectionSupport.textContent = formatDecimal(consistency.counts.selectionSupport);
  taggedConsistencyCount.textContent = String(
    consistency.taggedCards.reduce((total, card) => total + card.quantity, 0),
  );
  consistencyTarget.textContent = `${formatDecimal(consistency.recommendations.coreTarget)} / ${formatDecimal(consistency.recommendations.directTarget)} / ${formatDecimal(consistency.recommendations.repeatableTarget)}`;
  gameChangerTotal.textContent = String(gameChangers.counts.total);
  gameChangerUnique.textContent = String(gameChangers.counts.unique);
  gameChangerCommander.textContent = String(gameChangers.counts.commander);
  gameChangerMainboard.textContent = String(gameChangers.counts.mainboard);
  gameChangerCompanion.textContent = String(gameChangers.counts.companion);
  protectionScore.textContent = String(protection.protectionScore);
  coreProtection.textContent = formatDecimal(protection.counts.core);
  broadProtection.textContent = formatDecimal(protection.counts.broad);
  targetedProtection.textContent = formatDecimal(protection.counts.targeted);
  equipmentProtection.textContent = formatDecimal(protection.counts.equipment);
  bounceProtection.textContent = formatDecimal(protection.counts.selfBounce);
  flickerProtection.textContent = formatDecimal(protection.counts.flicker);
  taggedProtectionCount.textContent = String(
    protection.taggedCards.reduce((total, card) => total + card.quantity, 0),
  );
  protectionTarget.textContent = `${protection.recommendations.coreTarget} / ${protection.recommendations.broadTarget}`;
  recursionScore.textContent = String(recursion.recursionScore);
  coreRecursion.textContent = formatDecimal(recursion.counts.core);
  battlefieldRecursion.textContent = formatDecimal(recursion.counts.battlefield);
  handRecursion.textContent = formatDecimal(recursion.counts.hand);
  replayRecursion.textContent = formatDecimal(recursion.counts.replay);
  massRecursion.textContent = formatDecimal(recursion.counts.mass);
  libraryRecursion.textContent = formatDecimal(recursion.counts.library);
  taggedRecursionCount.textContent = String(
    recursion.taggedCards.reduce((total, card) => total + card.quantity, 0),
  );
  recursionTarget.textContent = `${recursion.recommendations.coreTarget} / ${recursion.recommendations.battlefieldTarget} / ${recursion.recommendations.replayTarget}`;
  finisherScore.textContent = String(winConditions.finisherScore);
  coreFinisher.textContent = formatDecimal(winConditions.counts.core);
  combatFinisher.textContent = formatDecimal(winConditions.counts.combat);
  directFinisher.textContent = formatDecimal(winConditions.counts.direct);
  alternateFinisher.textContent = formatDecimal(winConditions.counts.alternate);
  repeatableFinisher.textContent = formatDecimal(winConditions.counts.repeatable);
  comboFinisher.textContent = formatDecimal(winConditions.counts.combo);
  comboLineCount.textContent = String(winConditions.combos.exactCount);
  comboFinisherCount.textContent = String(winConditions.combos.finisherCount);
  comboEngineCount.textContent = String(winConditions.combos.engineCount);
  taggedFinisherCount.textContent = String(
    winConditions.taggedCards.reduce((total, card) => total + card.quantity, 0),
  );
  comboNearMissCount.textContent = String(winConditions.combos.nearMissCount);
  finisherTarget.textContent = `${winConditions.recommendations.coreTarget} / ${winConditions.recommendations.combatTarget} / ${winConditions.recommendations.directTarget}`;
  removalScore.textContent = String(removal.removalScore);
  coreRemoval.textContent = formatDecimal(removal.counts.core);
  targetedRemoval.textContent = formatDecimal(removal.counts.targeted);
  massRemoval.textContent = formatDecimal(removal.counts.mass);
  tempoRemoval.textContent = formatDecimal(removal.counts.tempo);
  handAttackRemoval.textContent = formatDecimal(removal.counts.handAttack);
  taggedRemovalCount.textContent = String(
    removal.taggedCards.reduce((total, card) => total + card.quantity, 0),
  );
  removalTarget.textContent = `${removal.recommendations.targetedTarget} / ${removal.recommendations.massTarget} / ${removal.recommendations.tempoTarget}`;
  spellInteractionScore.textContent = String(spellInteraction.interactionScore);
  coreSpellInteraction.textContent = formatDecimal(spellInteraction.counts.core);
  hardSpellInteraction.textContent = formatDecimal(spellInteraction.counts.hard);
  softSpellInteraction.textContent = formatDecimal(spellInteraction.counts.soft);
  tempoSpellInteraction.textContent = formatDecimal(spellInteraction.counts.spellTempo);
  broadSpellInteraction.textContent = formatDecimal(spellInteraction.counts.broad);
  staxSpellInteraction.textContent = formatDecimal(spellInteraction.counts.stax ?? 0);
  graveyardHateInteraction.textContent = formatDecimal(spellInteraction.counts.graveyardHate ?? 0);
  taggedSpellInteractionCount.textContent = String(
    spellInteraction.taggedCards.reduce((total, card) => total + card.quantity, 0),
  );
  spellInteractionTarget.textContent = `${spellInteraction.recommendations.hardTarget} / ${spellInteraction.recommendations.softTarget}`;
  applyScoreTone(powerScore, power.powerIndex);
  applyScoreTone(powerSynergy, strategy.synergy?.synergyScore ?? 0);
  applyScoreTone(commanderImpactScore, commander.impactScore);
  applyScoreTone(commanderDependencyScore, commander.dependencyScore);
  applyScoreTone(commanderCeilingScore, commander.ceilingScore);
  applyScoreTone(powerSpeed, getPowerDimensionScore(power, "speed"));
  applyScoreTone(powerConsistency, getPowerDimensionScore(power, "consistency"));
  applyScoreTone(powerInteraction, getPowerDimensionScore(power, "interaction"));
  applyScoreTone(powerResilience, getPowerDimensionScore(power, "resilience"));
  applyScoreTone(powerClosing, getPowerDimensionScore(power, "closing"));
  applyScoreTone(powerMana, getPowerDimensionScore(power, "mana"));
  applyScoreTone(structureScore, structure.structureScore);
  applyScoreTone(landBaseScore, landBase.landBaseScore);
  applyScoreTone(rampScore, ramp.rampScore);
  applyScoreTone(drawScore, draw.drawScore);
  applyScoreTone(consistencyScore, consistency.consistencyScore);
  applyScoreTone(removalScore, removal.removalScore);
  applyScoreTone(spellInteractionScore, spellInteraction.interactionScore);
  applyScoreTone(protectionScore, protection.protectionScore);
  applyScoreTone(recursionScore, recursion.recursionScore);
  applyScoreTone(finisherScore, winConditions.finisherScore);

  renderFindings(structure.findings);
  renderFindings(commander.findings, commanderFindingsList);
  renderStrategy(strategy);
  renderWinStrategy(strategy, winStrategy);
  renderQuickRead(analysis);
  recommendationVisualRenderToken += 1;
  const recommendationRenderToken = recommendationVisualRenderToken;
  renderRecommendations(recommendations, recommendationRenderToken);
  renderSimpleList(
    powerStrengthsList,
    power.strengths,
    "No single pillar clearly stands above the rest of the shell yet.",
  );
  renderSimpleList(
    powerWeaknessesList,
    power.weaknesses,
    "No major brake stands out yet.",
  );
  renderFindings(bracket.findings, bracketFindingsList);
  renderCommanderCards(commander.taggedCommanders);
  renderCommanderProfiles(commander.profiles);
  renderFindings(landBase.findings, landBaseFindingsList);
  renderFindings(ramp.findings, rampFindingsList);
  renderFindings(draw.findings, drawFindingsList);
  renderFindings(consistency.findings, consistencyFindingsList);
  renderFindings(protection.findings, protectionFindingsList);
  renderFindings(recursion.findings, recursionFindingsList);
  renderFindings(winConditions.findings, finisherFindingsList);
  renderFindings(removal.findings, removalFindingsList);
  renderFindings(spellInteraction.findings, spellInteractionFindingsList);
  renderRampCards(ramp.taggedCards);
  renderLandBaseCards(landBase.taggedCards);
  renderDrawCards(draw.taggedCards);
  renderConsistencyCards(consistency.taggedCards);
  renderGameChangerCards(gameChangers.taggedCards);
  renderProtectionCards(protection.taggedCards);
  renderRecursionCards(recursion.taggedCards);
  renderFinisherCards(winConditions.taggedCards);
  renderComboLines(winConditions.combos);
  renderRemovalCards(removal.taggedCards);
  renderSpellInteractionCards(spellInteraction.taggedCards);
  renderCardBreakdown(document, analysis);
  renderManaCurve(structure.mana.curve);

  highlightedIssueAnchors = [];
  syncDeckHighlight();
  issuesBox.classList.add("hidden");
  successContent.classList.remove("hidden");
  resultEmpty.classList.add("hidden");
  resultContent.classList.remove("hidden");
  syncWorkspaceMode(false);
  syncResultsView();
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

function renderValidationIssues(issues) {
  successContent.classList.add("hidden");
  resultEmpty.classList.add("hidden");
  resultContent.classList.remove("hidden");
  issuesBox.classList.remove("hidden");
  syncWorkspaceMode(false);
  syncResultsView();
  highlightedIssueAnchors = issues
    .map((issue) => createIssueAnchor(issue))
    .filter(Boolean);
  syncDeckHighlight();
  issuesList.replaceChildren(
    ...issues.map((issue) => createListItem(formatIssue(issue))),
  );
}

function renderCommanderVisuals(commanderCards) {
  if (!commanderVisuals) {
    return;
  }

  const visuals = commanderCards
    .map((deckCard) => createCommanderVisual(deckCard.card))
    .filter(Boolean);

  commanderVisuals.replaceChildren(...visuals);
  commanderVisuals.classList.toggle("hidden", visuals.length === 0);
}

function createCommanderVisual(card) {
  const imageUrl = getCardImageUrl(card);
  if (!imageUrl) {
    return null;
  }

  const figure = document.createElement("figure");
  figure.className = "commander-visual";

  const link = document.createElement("a");
  link.className = "commander-visual-link";
  link.href = card.scryfall_uri;
  link.target = "_blank";
  link.rel = "noreferrer noopener";
  link.title = `Open ${card.name} on Scryfall`;

  const image = document.createElement("img");
  image.className = "commander-visual-image";
  image.src = imageUrl;
  image.alt = `${card.name} card image`;
  image.loading = "lazy";
  image.decoding = "async";
  link.append(image);

  const caption = document.createElement("figcaption");
  caption.className = "commander-visual-caption";
  caption.textContent = card.name;

  figure.append(link, caption);
  return figure;
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

  const ambientCard = AMBIENT_CARD_POOL.find((card) => normalizeCardLookupKey(card.name) === key);
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

function renderTaggedCardPreviewStrip(previewElement, taggedCards, options = {}) {
  if (!previewElement) {
    return;
  }

  const previews = taggedCards
    .map((taggedCard, index) => buildTaggedCardPreviewData(taggedCard, index, options))
    .filter(Boolean)
    .sort((left, right) => {
      return (
        right.priority - left.priority ||
        right.quantity - left.quantity ||
        left.index - right.index
      );
    })
    .slice(0, TAGGED_CARD_PREVIEW_LIMIT)
    .map((preview) => createTaggedCardPreview(preview));

  previewElement.replaceChildren(...previews);
  previewElement.classList.toggle("hidden", previews.length === 0);
}

function buildTaggedCardPreviewData(taggedCard, index, options) {
  const lookupName = options.getLookupName?.(taggedCard) ?? taggedCard.name;
  const resolvedCard =
    findResolvedCardForTaggedName(lookupName) ?? findResolvedCardForTaggedName(taggedCard.name);
  const imageUrl = resolvedCard ? getCardImageUrl(resolvedCard.card) : null;

  if (!resolvedCard || !imageUrl) {
    return null;
  }

  return {
    index,
    imageUrl,
    priority: getTaggedCardPriority(taggedCard),
    quantity: Math.max(1, Number(taggedCard.quantity) || 1),
    taggedCard,
    resolvedCard,
  };
}

function getTaggedCardPriority(taggedCard) {
  const directValue = [
    "roleValue",
    "landValue",
    "rampValue",
    "drawValue",
    "consistencyValue",
    "protectionValue",
    "recursionValue",
    "finisherValue",
    "removalValue",
    "interactionValue",
  ]
    .map((key) => taggedCard[key])
    .find((value) => typeof value === "number");

  if (typeof directValue === "number") {
    return directValue;
  }

  if (Array.isArray(taggedCard.hits)) {
    return taggedCard.hits.reduce((sum, hit) => sum + (Number(hit.weight) || 0), 0);
  }

  return 0;
}

function createTaggedCardPreview(preview) {
  const {
    imageUrl,
    quantity,
    resolvedCard: { card },
  } = preview;

  const figure = document.createElement("figure");
  figure.className = "tagged-card-preview";

  const link = document.createElement("a");
  link.className = "tagged-card-preview-link";
  link.href = card.scryfall_uri;
  link.target = "_blank";
  link.rel = "noreferrer noopener";
  link.title = `Open ${card.name} on Scryfall`;

  const image = document.createElement("img");
  image.className = "tagged-card-preview-image";
  image.src = imageUrl;
  image.alt = `${card.name} card image`;
  image.loading = "lazy";
  image.decoding = "async";
  link.append(image);

  if (quantity > 1) {
    const badge = document.createElement("span");
    badge.className = "tagged-card-preview-badge";
    badge.textContent = `${quantity}x`;
    link.append(badge);
  }

  const caption = document.createElement("figcaption");
  caption.className = "tagged-card-preview-caption";
  caption.textContent = card.name;

  figure.append(link, caption);
  return figure;
}

function clearTaggedCardPreviews() {
  taggedCardPreviewContainers.forEach((previewElement) => {
    previewElement.replaceChildren();
    previewElement.classList.add("hidden");
  });
}

function renderQuickRead(analysis) {
  const metrics = buildQuickReadMetrics(analysis);
  const metricByKey = new Map(metrics.map((metric) => [metric.key, metric]));
  const sortedMetrics = [...metrics].sort(
    (left, right) => right.score - left.score || left.label.localeCompare(right.label),
  );
  const strongestMetrics = sortedMetrics.slice(0, 3);
  const weakestMetrics = [...sortedMetrics].reverse().slice(0, 3);

  updateQuickReadMetric(quickShellScore, metricByKey.get("shell"));
  updateQuickReadMetric(quickLandBaseScore, metricByKey.get("landBase"));
  updateQuickReadMetric(quickRampScore, metricByKey.get("ramp"));
  updateQuickReadMetric(quickCardFlowScore, metricByKey.get("cardFlow"));
  updateQuickReadMetric(quickConsistencyScore, metricByKey.get("consistency"));
  updateQuickReadMetric(quickInteractionScore, metricByKey.get("interaction"));
  updateQuickReadMetric(quickResilienceScore, metricByKey.get("resilience"));
  updateQuickReadMetric(quickClosingScore, metricByKey.get("closing"));
  renderScoreRadarChart(metrics);

  quickReadSummary.textContent = buildQuickReadSummary(analysis, strongestMetrics[0], weakestMetrics[0]);
  renderSimpleList(
    quickReadStrengthsList,
    strongestMetrics.map((metric) => `${metric.label} (${metric.score}): ${metric.note}`),
    "No single pillar clearly leads the shell yet.",
  );
  renderSimpleList(
    quickReadRisksList,
    weakestMetrics.map((metric) => `${metric.label} (${metric.score}): ${metric.note}`),
    "No major weak point stands out yet.",
  );
}

function renderScoreRadarChart(metrics) {
  if (!scoreRadarChart) {
    return;
  }

  const normalizedMetrics = metrics.map((metric) => ({
    ...metric,
    score: Math.max(0, Math.min(100, Math.round(metric.score))),
  }));

  if (normalizedMetrics.length < 3) {
    scoreRadarChart.replaceChildren();
    return;
  }

  const svgNamespace = "http://www.w3.org/2000/svg";
  const size = 460;
  const center = size / 2;
  const maxRadius = 118;
  const labelRadius = 158;
  const angleStep = (Math.PI * 2) / normalizedMetrics.length;
  const startAngle = -Math.PI / 2;
  const createSvgElement = (tagName, attributes = {}) => {
    const element = document.createElementNS(svgNamespace, tagName);
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, String(value));
    });
    return element;
  };
  const getPoint = (index, radius) => {
    const angle = startAngle + index * angleStep;
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
    };
  };
  const formatPoints = (points) =>
    points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const labelAnchor = (x) => {
    if (x > center + 12) {
      return "start";
    }

    if (x < center - 12) {
      return "end";
    }

    return "middle";
  };
  const labelBaseline = (y) => {
    if (y > center + 12) {
      return "hanging";
    }

    if (y < center - 12) {
      return "auto";
    }

    return "middle";
  };

  const svg = createSvgElement("svg", {
    class: "score-radar-svg",
    viewBox: `0 0 ${size} ${size}`,
    role: "img",
    "aria-labelledby": "score-radar-title score-radar-desc",
  });

  const title = createSvgElement("title", { id: "score-radar-title" });
  title.textContent = "Deck score web";
  const description = createSvgElement("desc", { id: "score-radar-desc" });
  description.textContent =
    "A radar chart showing shell, land base, ramp, card flow, consistency, interaction, resilience, and closing scores.";
  svg.append(title, description);

  const gridGroup = createSvgElement("g", { class: "score-radar-grid" });
  [25, 50, 75, 100].forEach((level) => {
    const radius = (level / 100) * maxRadius;
    const points = normalizedMetrics.map((_, index) => getPoint(index, radius));
    gridGroup.append(
      createSvgElement("polygon", {
        class: `score-radar-grid-ring score-radar-grid-ring-${level}`,
        points: formatPoints(points),
      }),
    );
  });

  normalizedMetrics.forEach((_, index) => {
    const outerPoint = getPoint(index, maxRadius);
    gridGroup.append(
      createSvgElement("line", {
        class: "score-radar-axis",
        x1: center,
        y1: center,
        x2: outerPoint.x.toFixed(1),
        y2: outerPoint.y.toFixed(1),
      }),
    );
  });
  svg.append(gridGroup);

  const dataPoints = normalizedMetrics.map((metric, index) =>
    getPoint(index, (metric.score / 100) * maxRadius),
  );
  const dataGroup = createSvgElement("g", { class: "score-radar-data" });
  dataGroup.append(
    createSvgElement("polygon", {
      class: "score-radar-area",
      points: formatPoints(dataPoints),
    }),
    createSvgElement("polyline", {
      class: "score-radar-outline",
      points: formatPoints([...dataPoints, dataPoints[0]]),
    }),
  );

  normalizedMetrics.forEach((metric, index) => {
    const point = dataPoints[index];
    const dot = createSvgElement("circle", {
      class: `score-radar-dot score-radar-dot-${getScoreTone(metric.score)}`,
      cx: point.x.toFixed(1),
      cy: point.y.toFixed(1),
      r: 4.6,
    });
    dataGroup.append(dot);
  });
  svg.append(dataGroup);

  const labelGroup = createSvgElement("g", { class: "score-radar-labels" });
  normalizedMetrics.forEach((metric, index) => {
    const point = getPoint(index, labelRadius);
    const text = createSvgElement("text", {
      class: `score-radar-label score-radar-label-${getScoreTone(metric.score)}`,
      x: point.x.toFixed(1),
      y: point.y.toFixed(1),
      "text-anchor": labelAnchor(point.x),
      "dominant-baseline": labelBaseline(point.y),
    });
    const label = createSvgElement("tspan", { class: "score-radar-label-name", x: point.x.toFixed(1) });
    label.textContent = metric.label;
    const value = createSvgElement("tspan", {
      class: "score-radar-label-score",
      x: point.x.toFixed(1),
      dy: "1.2em",
    });
    value.textContent = String(metric.score);
    text.append(label, value);
    labelGroup.append(text);
  });
  svg.append(labelGroup);

  const legend = document.createElement("div");
  legend.className = "score-radar-legend";
  normalizedMetrics.forEach((metric) => {
    const item = document.createElement("article");
    item.className = `score-radar-legend-item score-radar-legend-${getScoreTone(metric.score)}`;

    const label = document.createElement("span");
    label.textContent = metric.label;

    const value = document.createElement("strong");
    value.textContent = String(metric.score);

    item.append(label, value);
    legend.append(item);
  });

  const visual = document.createElement("div");
  visual.className = "score-radar-visual";
  visual.append(svg);

  scoreRadarChart.replaceChildren(visual, legend);
}

function renderRecommendations(recommendations, renderToken = recommendationVisualRenderToken) {
  recommendationsController.render(recommendations, renderToken);
}

function buildQuickReadMetrics(analysis) {
  return [
    {
      key: "shell",
      label: "Shell",
      score: Math.round(analysis.structure.structureScore),
      note: firstSentence(analysis.structure.summary),
    },
    {
      key: "landBase",
      label: "Land Base",
      score: Math.round(analysis.landBase.landBaseScore),
      note: firstSentence(analysis.landBase.summary),
    },
    {
      key: "ramp",
      label: "Ramp",
      score: Math.round(analysis.ramp.rampScore),
      note: firstSentence(analysis.ramp.summary),
    },
    {
      key: "cardFlow",
      label: "Card Flow",
      score: Math.round(analysis.draw.drawScore),
      note: firstSentence(analysis.draw.summary),
    },
    {
      key: "consistency",
      label: "Consistency",
      score: Math.round(analysis.consistency.consistencyScore),
      note: firstSentence(analysis.consistency.summary),
    },
    {
      key: "interaction",
      label: "Interaction",
      score: averageScores(
        analysis.removal.removalScore,
        analysis.spellInteraction.interactionScore,
      ),
      note: buildPairedQuickReadNote(
        "Removal",
        analysis.removal.removalScore,
        "Spell interaction",
        analysis.spellInteraction.interactionScore,
      ),
    },
    {
      key: "resilience",
      label: "Resilience",
      score: averageScores(
        analysis.protection.protectionScore,
        analysis.recursion.recursionScore,
      ),
      note: buildPairedQuickReadNote(
        "Protection",
        analysis.protection.protectionScore,
        "Recursion",
        analysis.recursion.recursionScore,
      ),
    },
    {
      key: "closing",
      label: "Closing",
      score: Math.round(analysis.winConditions.finisherScore),
      note: firstSentence(analysis.winConditions.summary),
    },
  ];
}

function buildQuickReadSummary(analysis, strongestMetric, weakestMetric) {
  const strategyLabel = analysis.strategy.mainStrategy?.label ?? "Mixed shell";
  const winPlanLabel = analysis.winStrategy.primaryPlan?.label ?? "No clear finish yet";
  const strongestLabel = strongestMetric?.label?.toLowerCase() ?? "none";
  const weakestLabel = weakestMetric?.label?.toLowerCase() ?? "none";

  return `${analysis.bracket.recommendedLabel} ${analysis.bracket.recommendedName}. ${strategyLabel} is the clearest plan, ${winPlanLabel.toLowerCase()} is the main finish, ${strongestLabel} is the strongest pillar, and ${weakestLabel} needs the most work.`;
}

function buildPairedQuickReadNote(leftLabel, leftScore, rightLabel, rightScore) {
  if (Math.abs(leftScore - rightScore) <= 8) {
    return `${leftLabel} and ${rightLabel.toLowerCase()} are carrying similar weight right now.`;
  }

  const strongerLabel = leftScore > rightScore ? leftLabel : rightLabel;
  const weakerLabel = leftScore > rightScore ? rightLabel.toLowerCase() : leftLabel.toLowerCase();
  return `${strongerLabel} is doing more of the work than ${weakerLabel} right now.`;
}

function updateQuickReadMetric(element, metric) {
  if (!element || !metric) {
    return;
  }

  element.textContent = String(metric.score);
  applyScoreTone(element, metric.score);
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

function renderTaggedCardSection({
  listElement,
  previewElement,
  taggedCards,
  emptyMessage,
  formatItem,
  getLookupName,
}) {
  renderTaggedCardPreviewStrip(previewElement, taggedCards, { getLookupName });

  const items =
    taggedCards.length > 0
      ? taggedCards.map((taggedCard) => formatItem(taggedCard))
      : [createListItem(emptyMessage)];

  listElement.replaceChildren(...items);
}

function applyScoreTone(element, score) {
  applyToneToCard(element, getScoreTone(score));
}

function getScoreTone(score) {
  if (score >= 70) {
    return "good";
  }

  if (score >= 40) {
    return "watch";
  }

  return "risk";
}

function applyToneToCard(element, tone) {
  const card = element.closest(".future-stat, .stat-card");

  if (!card) {
    return;
  }

  card.classList.remove(
    "score-card",
    "score-card-good",
    "score-card-healthy",
    "score-card-watch",
    "score-card-risk",
  );

  if (!tone) {
    return;
  }

  card.classList.add("score-card", `score-card-${tone}`);
}

function formatIssue(issue) {
  if (issue.lineNumber) {
    return `Line ${issue.lineNumber}: ${issue.message}`;
  }

  return issue.message;
}

function resetResultState() {
  highlightedIssueAnchors = [];
  resolvedCardLookup = new Map();
  syncDeckHighlight();
  issuesBox.classList.add("hidden");
  successContent.classList.add("hidden");
  resultContent.classList.add("hidden");
  resultEmpty.classList.remove("hidden");
  issuesList.replaceChildren();
  findingsList.replaceChildren();
  strategySwitcher.replaceChildren();
  strategySwitcherWrap.classList.add("hidden");
  mainStrategyCardsList.replaceChildren();
  strategySynergyFindingsList.replaceChildren();
  subStrategiesList.replaceChildren();
  winStrategyCardsList.replaceChildren();
  winStrategyReasonsList.replaceChildren();
  winStrategyBackupsList.replaceChildren();
  landBaseFindingsList.replaceChildren();
  landBaseCardsList.replaceChildren();
  rampFindingsList.replaceChildren();
  rampCardsList.replaceChildren();
  drawFindingsList.replaceChildren();
  drawCardsList.replaceChildren();
  consistencyFindingsList.replaceChildren();
  consistencyCardsList.replaceChildren();
  gameChangerCardsList.replaceChildren();
  powerStrengthsList.replaceChildren();
  powerWeaknessesList.replaceChildren();
  bracketFindingsList.replaceChildren();
  protectionFindingsList.replaceChildren();
  protectionCardsList.replaceChildren();
  recursionFindingsList.replaceChildren();
  recursionCardsList.replaceChildren();
  finisherFindingsList.replaceChildren();
  finisherCardsList.replaceChildren();
  comboLinesList.replaceChildren();
  removalFindingsList.replaceChildren();
  removalCardsList.replaceChildren();
  spellInteractionFindingsList.replaceChildren();
  spellInteractionCardsList.replaceChildren();
  quickReadStrengthsList.replaceChildren();
  quickReadRisksList.replaceChildren();
  scoreRadarChart?.replaceChildren();
  quickReadSummary.textContent = "The simplest deck read appears here after analysis.";
  recommendationsList.replaceChildren();
  recommendationsSummary.textContent = "Bracket-directed card suggestions appear here after analysis.";
  recommendationsListAdvanced?.replaceChildren();
  cardBreakdownBody?.replaceChildren();
  if (cardBreakdownCount) {
    cardBreakdownCount.textContent = "0 cards";
  }
  if (cardBreakdownSummary) {
    cardBreakdownSummary.textContent = "Card-level role detection appears here after analysis.";
  }
  if (recommendationsSummaryAdvanced) {
    recommendationsSummaryAdvanced.textContent =
      "Bracket-directed card suggestions appear here after analysis.";
  }
  commanderVisuals?.replaceChildren();
  commanderVisuals?.classList.add("hidden");
  clearTaggedCardPreviews();
  [
    quickShellScore,
    quickLandBaseScore,
    quickRampScore,
    quickCardFlowScore,
    quickConsistencyScore,
    quickInteractionScore,
    quickResilienceScore,
    quickClosingScore,
  ].forEach((element) => {
    if (element) {
      element.textContent = "0";
      applyToneToCard(element, null);
    }
  });
  curveBars.replaceChildren();
  selectedStrategyPerspectiveKey = null;
  currentAnalysisSnapshot = null;
  currentAnalysisDocument = null;
  resultsViewMode = "simple";
  advancedTabKey = "identity";
  syncWorkspaceMode(true);
  syncResultsView();
}

function markDeckAsEdited() {
  successContent.classList.add("hidden");
  commanderVisuals?.replaceChildren();
  commanderVisuals?.classList.add("hidden");
  scoreRadarChart?.replaceChildren();
  resolvedCardLookup = new Map();
  clearTaggedCardPreviews();
  selectedStrategyPerspectiveKey = null;
  currentAnalysisSnapshot = null;
  currentAnalysisDocument = null;
  resultsViewMode = "simple";
  advancedTabKey = "identity";

  if (!issuesBox.classList.contains("hidden") && issuesList.childElementCount > 0) {
    resultEmpty.classList.add("hidden");
    resultContent.classList.remove("hidden");
    syncWorkspaceMode(false);
  } else {
    resultContent.classList.add("hidden");
    resultEmpty.classList.remove("hidden");
    syncWorkspaceMode(true);
  }

  if (decklistField.value.trim()) {
    formStatus.textContent = "Decklist changed. Run the analysis again to refresh the ranking data.";
  }

  syncResultsView();
}

function prepareForNewScan(options = {}) {
  const { preserveSelectedStrategy = false, preserveResultsView = false } = options;

  successContent.classList.add("hidden");
  issuesBox.classList.add("hidden");
  resultContent.classList.add("hidden");
  resultEmpty.classList.remove("hidden");
  commanderVisuals?.replaceChildren();
  commanderVisuals?.classList.add("hidden");
  resolvedCardLookup = new Map();
  clearTaggedCardPreviews();
  if (!preserveSelectedStrategy) {
    selectedStrategyPerspectiveKey = null;
  }
  currentAnalysisSnapshot = null;
  currentAnalysisDocument = null;
  if (!preserveResultsView) {
    resultsViewMode = "simple";
  }
  advancedTabKey = "identity";
  syncWorkspaceMode(true);
  syncResultsView();
}

function syncWorkspaceMode(showIntakeOnly) {
  pageShell?.classList.toggle("intake-mode", showIntakeOnly);
}

function renderAmbientCardBackground() {
  if (!ambientCardBackground) {
    return;
  }

  const slots = buildAmbientCardSlots();
  const elements = slots.map((slot, index) =>
    createAmbientCard(AMBIENT_CARD_POOL[index % AMBIENT_CARD_POOL.length], slot, index),
  );
  ambientCardBackground.replaceChildren(...elements);
}

function buildAmbientCardSlots() {
  const preset = getAmbientCardLayoutPreset();
  const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
  const viewportHeight = Math.max(window.innerHeight || 0, document.documentElement.clientHeight || 0);
  const slots = [];
  let slotIndex = 0;

  for (
    let rowIndex = 0, top = preset.startY;
    top <= viewportHeight + preset.edgeY && slots.length < preset.maxSlots;
    rowIndex += 1, top += preset.gapY
  ) {
    const rowOffset = rowIndex % 2 === 0 ? 0 : preset.rowOffset;

    for (
      let left = preset.startX + rowOffset;
      left <= viewportWidth + preset.edgeX && slots.length < preset.maxSlots;
      left += preset.gapX
    ) {
      slots.push({
        left: `${left}px`,
        top: `${top}px`,
        width: preset.widths[slotIndex % preset.widths.length],
        rotation: preset.rotations[slotIndex % preset.rotations.length],
        scale: "1",
      });
      slotIndex += 1;
    }
  }

  return slots;
}

function getAmbientCardLayoutPreset() {
  const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement.clientWidth || 0);
  const themePresets =
    getActiveTheme() === "dark" ? AMBIENT_CARD_LAYOUT_PRESETS.dark : AMBIENT_CARD_LAYOUT_PRESETS.light;

  if (viewportWidth <= 640) {
    return themePresets.mobile;
  }

  if (viewportWidth <= 960) {
    return themePresets.tablet;
  }

  return themePresets.desktop;
}

function renderHeroMediaCards() {
  if (!heroMediaCardImages.length) {
    return;
  }

  const cards = shuffleArray(HERO_CARD_POOL).slice(0, heroMediaCardImages.length);
  heroMediaCardImages.forEach((image, index) => {
    const card = cards[index];
    if (!card) {
      return;
    }

    image.src = card.imageUrl;
    image.alt = "";
    image.title = card.name;
    image.loading = "eager";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
  });
}

function createAmbientCard(card, slot, index) {
  const figure = document.createElement("figure");
  figure.className = `ambient-card ambient-card-slot-${index + 1}`;
  figure.style.left = slot.left;
  figure.style.top = slot.top;
  figure.style.width = slot.width;
  figure.style.setProperty("--ambient-rotation", slot.rotation);
  figure.style.setProperty("--ambient-scale", slot.scale);
  figure.style.setProperty("--ambient-slot", String(index));

  const image = document.createElement("img");
  image.src = card.imageUrl;
  image.alt = "";
  image.loading = "eager";
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.title = card.name;

  figure.append(image);
  return figure;
}

function shuffleArray(values) {
  const clone = [...values];

  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }

  return clone;
}

window.addEventListener("resize", () => {
  if (!ambientCardBackground) {
    return;
  }

  window.clearTimeout(ambientResizeHandle);
  ambientResizeHandle = window.setTimeout(() => {
    renderAmbientCardBackground();
  }, 140);
});

function prefillCommanderFromDecklist(decklistText, options = {}) {
  const summary = inspectDecklistSections(decklistText);
  const leaderGuess = getLeaderPackageFromSummary(summary);

  if (!commanderNameField.value.trim() && leaderGuess.commander) {
    setAutofilledLeaderField(commanderNameField, leaderGuess.commander);
  }

  if (options.allowAdditionalCommanderAutoEnable && summary.commanderCards.length > 1) {
    additionalCommanderEnabledField.checked = true;
  }

  if (
    additionalCommanderEnabledField.checked &&
    !additionalCommanderNameField.value.trim() &&
    leaderGuess.secondary
  ) {
    setAutofilledLeaderField(additionalCommanderNameField, leaderGuess.secondary);
  }

  if (options.allowCompanionAutoEnable && summary.companion) {
    companionEnabledField.checked = true;
  }

  if (companionEnabledField.checked && !companionNameField.value.trim() && summary.companion) {
    setAutofilledLeaderField(companionNameField, summary.companion);
  }

  syncSupplementalLeaderFields();
}

function prefillLeaderFieldsFromDecklist(decklistText, options = {}) {
  prefillCommanderFromDecklist(decklistText, options);
}

function buildDeckIntakeStatus(decklistText) {
  if (!decklistText.trim()) {
    return "";
  }

  const summary = inspectDecklistSections(decklistText);
  if (summary.commanderCards.length > 0) {
    const commanderText = summary.commanderCards.slice(0, 2).join(" + ");
    return `Commander detected: ${commanderText}. Choose a target bracket and analyze when ready.`;
  }

  if (summary.fallbackCards.length > 0) {
    return `No commander section found. The first card will be used as the commander guess: ${summary.fallbackCards[0]}.`;
  }

  return "Decklist text found, but no card lines were detected yet.";
}

function getLeaderPackageFromSummary(summary) {
  if (summary.commanderCards.length > 0) {
    return {
      commander: summary.commanderCards[0] ?? "",
      secondary: summary.commanderCards[1] ?? "",
    };
  }

  return {
    commander: summary.fallbackCards[0] ?? "",
    secondary: summary.fallbackCards[1] ?? "",
  };
}

function inspectDecklistSections(decklistText) {
  const lines = decklistText.split(/\r?\n/);
  let currentSection = "mainboard";
  const explicitCommanderCards = [];
  const fallbackCards = [];
  const companionCards = [];

  for (const rawLine of lines) {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) {
      if (currentSection === "commander" || currentSection === "companion") {
        currentSection = "mainboard";
      }
      continue;
    }

    const sectionHeader = normalizeSectionHeader(trimmedLine);
    if (sectionHeader) {
      currentSection = sectionHeader;
      continue;
    }

    if (isStandaloneBracketSectionLine(trimmedLine)) {
      currentSection = "mainboard";
      continue;
    }

    if (trimmedLine.startsWith("#") || trimmedLine.startsWith("//")) {
      continue;
    }

    const prefixedLine = extractSectionPrefix(trimmedLine);
    const cleanedName = cleanupDeckEntryName(prefixedLine.line);

    if (!cleanedName) {
      continue;
    }

    if (prefixedLine.section === "companion" || currentSection === "companion") {
      companionCards.push(cleanedName);
      continue;
    }

    if (prefixedLine.section === "commander" || currentSection === "commander") {
      explicitCommanderCards.push(cleanedName);
      continue;
    }

    fallbackCards.push(cleanedName);
  }

  return {
    commanderCards: explicitCommanderCards,
    fallbackCards,
    companion: companionCards[0] ?? "",
  };
}

function normalizeSectionHeader(line) {
  const normalized = normalizeHeaderLabel(line);

  if (
    [
      "commander",
      "commanders",
      "partner",
      "partners",
      "background",
      "backgrounds",
      "doctor's companion",
      "doctors companion",
    ].includes(normalized)
  ) {
    return "commander";
  }

  if (["deck", "main", "mainboard"].includes(normalized)) {
    return "mainboard";
  }

  if (normalized === "companion") {
    return "companion";
  }

  if (["sideboard", "side"].includes(normalized)) {
    return "sideboard";
  }

  if (["maybeboard", "maybe"].includes(normalized)) {
    return "maybeboard";
  }

  return null;
}

function normalizeHeaderLabel(line) {
  return line
    .replace(/^(\/\/+|#+)\s*/, "")
    .replace(/^\[(.+)\]$/, "$1")
    .toLowerCase()
    .replace(/\(\d+\)/g, "")
    .replace(/[:\-]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

function sanitizeDecklistInput(decklistText) {
  const sanitizedLines = decklistText
    .split(/\r?\n/)
    .filter((line) => !isRemovableDeckSectionLine(line));

  return sanitizedLines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}

function isRemovableDeckSectionLine(line) {
  if (isStandaloneBracketSectionLine(line.trim())) {
    return true;
  }

  const normalized = normalizeHeaderLabel(line.trim());

  if (!normalized) {
    return false;
  }

  return new Set([
    "commander",
    "commanders",
    "partner",
    "partners",
    "background",
    "backgrounds",
    "doctor's companion",
    "doctors companion",
    "deck",
    "main",
    "mainboard",
    "creature",
    "creatures",
    "artifact",
    "artifacts",
    "enchantment",
    "enchantments",
    "instant",
    "instants",
    "sorcery",
    "sorceries",
    "land",
    "lands",
    "planeswalker",
    "planeswalkers",
    "battle",
    "battles",
    "spell",
    "spells",
    "sideboard",
    "side",
    "maybeboard",
    "maybe",
  ]).has(normalized);
}

function isStandaloneBracketSectionLine(line) {
  const cleanedLine = line
    .replace(/^(\/\/+|#+)\s*/, "")
    .trim();

  return /^\[[^[\]]+\]\s*(?:\(\d+\))?$/u.test(cleanedLine);
}

function extractSectionPrefix(line) {
  const match = line.match(/^(?<prefix>[A-Za-z]+):\s*(?<rest>.+)$/);
  if (!match?.groups) {
    return { section: null, line };
  }

  const prefixMap = {
    cmdr: "commander",
    cmndr: "commander",
    commander: "commander",
    partner: "commander",
    partners: "commander",
    background: "commander",
    backgrounds: "commander",
    "doctor's companion": "commander",
    "doctors companion": "commander",
    companion: "companion",
    deck: "mainboard",
    main: "mainboard",
    mainboard: "mainboard",
    mb: "mainboard",
    sb: "sideboard",
    sideboard: "sideboard",
    maybe: "maybeboard",
    maybeboard: "maybeboard",
  };

  return {
    section: prefixMap[match.groups.prefix.toLowerCase()] ?? null,
    line: match.groups.rest.trim(),
  };
}

function cleanupDeckEntryName(line) {
  const quantityMatch = line.match(/^(?<quantity>\d+)\s*x?\s+(?<card>.+)$/i);
  let workingLine = quantityMatch?.groups?.card?.trim() ?? line.trim();

  return workingLine
    .replace(/^\[[^[\]]+\]\s*/, "")
    .replace(/\s+\*[^*]+\*\s*$/, "")
    .replace(/\s+\[[A-Za-z0-9]{2,6}\]\s*$/, "")
    .replace(/\s+\([A-Za-z0-9]{2,6}\)(?:\s+[A-Za-z0-9-]+)?\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function syncSupplementalLeaderFields() {
  additionalCommanderFieldWrap.classList.toggle("hidden", !additionalCommanderEnabledField.checked);
  companionFieldWrap.classList.toggle("hidden", !companionEnabledField.checked);
  secretCommanderFieldWrap.classList.toggle("hidden", !secretCommanderEnabledField.checked);

  if (!additionalCommanderEnabledField.checked) {
    resetLeaderField(additionalCommanderNameField);
  }

  if (!companionEnabledField.checked) {
    resetLeaderField(companionNameField);
  }

  if (!secretCommanderEnabledField.checked) {
    resetLeaderField(secretCommanderNameField);
  }
}

function setAutofilledLeaderField(field, value) {
  field.value = value;
  field.dataset.autofilled = "true";
}

function markLeaderFieldAsManual(field) {
  if (field.value.trim()) {
    field.dataset.autofilled = "false";
    return;
  }

  delete field.dataset.autofilled;
}

function resetLeaderField(field) {
  field.value = "";
  delete field.dataset.autofilled;
}

function clearAutofilledLeaderFields() {
  [
    commanderNameField,
    additionalCommanderNameField,
    companionNameField,
    secretCommanderNameField,
  ].forEach((field) => {
    if (field.dataset.autofilled === "true") {
      resetLeaderField(field);
    }
  });
}

syncSupplementalLeaderFields();
updateFilePickerLabel();
initializeInsightDisclosures();
renderHeroMediaCards();
renderAmbientCardBackground();
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

function updateFilePickerLabel(fileName = "") {
  if (!fileNameLabel) {
    return;
  }

  fileNameLabel.textContent = fileName || "No file selected";
}

function getStoredTheme() {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedTheme === "dark" || storedTheme === "light" ? storedTheme : null;
}

function getPreferredTheme() {
  const storedTheme = getStoredTheme();
  if (storedTheme) {
    return storedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getActiveTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  if (!themeToggle) {
    if (ambientCardBackground?.childElementCount) {
      renderAmbientCardBackground();
    }
    return;
  }

  const nextModeLabel = theme === "dark" ? "Light mode" : "Dark mode";
  themeToggle.textContent = nextModeLabel;
  themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  themeToggle.setAttribute("aria-label", `Switch to ${theme === "dark" ? "light" : "dark"} mode`);

  if (ambientCardBackground?.childElementCount) {
    renderAmbientCardBackground();
  }
}

function syncSystemThemePreference(event) {
  if (getStoredTheme() !== null) {
    return;
  }

  applyTheme(event.matches ? "dark" : "light");
}

const themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
applyTheme(getPreferredTheme());
themeMediaQuery.addEventListener?.("change", syncSystemThemePreference);

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

function renderFindings(findings, container = findingsList) {
  const cards = findings.map((finding) => {
    const article = document.createElement("article");
    article.className = `finding-card finding-${finding.status}`;

    const header = document.createElement("div");
    header.className = "finding-header";

    const title = document.createElement("strong");
    title.textContent = finding.title;

    const badge = document.createElement("span");
    badge.className = `finding-badge finding-badge-${finding.status}`;
    badge.textContent = finding.status;

    header.append(title, badge);

    const body = document.createElement("p");
    body.textContent = finding.message;

    article.append(header, body);
    return article;
  });

  container.replaceChildren(...cards);
}

function ensureSelectedStrategyPerspective(strategy) {
  if (
    !selectedStrategyPerspectiveKey ||
    !strategy.perspectives?.some((perspective) => perspective.strategy.key === selectedStrategyPerspectiveKey)
  ) {
    selectedStrategyPerspectiveKey =
      strategy.mainStrategy?.key ?? strategy.perspectives?.[0]?.strategy.key ?? null;
  }
}

function getActiveStrategyPerspective(strategy) {
  ensureSelectedStrategyPerspective(strategy);

  return (
    strategy.perspectives?.find(
      (perspective) => perspective.strategy.key === selectedStrategyPerspectiveKey,
    ) ?? null
  );
}

function renderWinStrategy(strategy, winStrategy) {
  const activePerspective = getActiveStrategyPerspective(strategy);
  const activeWinPerspective =
    winStrategy.perspectives?.find(
      (perspective) => perspective.strategyKey === activePerspective?.strategy.key,
    ) ?? null;
  const primaryPlan = activeWinPerspective?.primaryPlan ?? winStrategy.primaryPlan;
  const backupPlans = activeWinPerspective?.backupPlans ?? winStrategy.backupPlans ?? [];
  const perspectiveLabel =
    activeWinPerspective?.strategyLabel ??
    activePerspective?.strategy.label ??
    strategy.mainStrategy?.label ??
    "-";

  winStrategyPrimary.textContent = primaryPlan?.label ?? "No clear closing plan";
  winStrategyBackupCount.textContent = String(backupPlans.length);
  winStrategyPerspective.textContent = perspectiveLabel;
  winStrategySummary.textContent =
    buildWinStrategySummary(winStrategy, primaryPlan, backupPlans, perspectiveLabel);

  const reasonItems =
    primaryPlan?.reasons?.length
      ? primaryPlan.reasons.map((reason) => createListItem(reason))
      : [createListItem("No singular closing plan stands out yet. The shell still looks mixed or setup-heavy.")];
  const keyCardItems =
    primaryPlan?.keyCards?.length
      ? primaryPlan.keyCards.map((card) => createListItem(card))
      : [createListItem("No key closing cards were isolated for this perspective yet.")];
  const backupItems =
    backupPlans.length > 0
      ? backupPlans.map((plan) => createListItem(`${plan.label} | ${plan.summary}`))
      : [createListItem("No strong backup win plans were detected.")];

  winStrategyReasonsList.replaceChildren(...reasonItems);
  winStrategyCardsList.replaceChildren(...keyCardItems);
  winStrategyBackupsList.replaceChildren(...backupItems);
}

function renderStrategy(strategy) {
  const perspectives = strategy.perspectives ?? [];
  const activePerspective = getActiveStrategyPerspective(strategy);
  const activeStrategy = activePerspective?.strategy ?? strategy.mainStrategy;
  const activeSubStrategies = activePerspective?.subStrategies ?? strategy.subStrategies;
  const activeSynergy = activePerspective?.synergy ?? strategy.synergy;
  const detectedMainStrategy = getDetectedMainStrategy(strategy);
  const reviewingAlternateMain =
    !!activeStrategy &&
    !!detectedMainStrategy &&
    activeStrategy.key !== detectedMainStrategy.key;

  strategySummary.textContent = buildStrategySummary(
    strategy,
    activeStrategy,
    detectedMainStrategy,
    reviewingAlternateMain,
  );
  mainStrategyName.textContent = activeStrategy?.label ?? "Mixed Shell";
  subStrategyCount.textContent = String(activeSubStrategies.length);
  strategySynergyScore.textContent = String(activeSynergy?.synergyScore ?? 0);
  strategySupportCount.textContent = String(activeSynergy?.supportCards ?? 0);
  strategyCoreCount.textContent = String(activeSynergy?.coreCards ?? 0);
  strategyFocusScore.textContent = `${activeSynergy?.focusScore ?? 0}%`;
  strategyCommanderFit.textContent = activeSynergy
    ? activeSynergy.commanderAligned
      ? "Aligned"
      : "Light"
    : "-";
  strategyFinisherFit.textContent = activeSynergy
    ? activeSynergy.finisherAligned
      ? "Aligned"
      : "Mixed"
    : "-";
  strategySynergySummary.textContent =
    activeSynergy?.summary ?? "Strategy support is checked after the main archetype is detected.";

  renderStrategySwitcher(strategy, activePerspective);
  applyScoreTone(strategySynergyScore, activeSynergy?.synergyScore ?? 0);

  const synergyFindings =
    activeSynergy?.findings?.length
      ? activeSynergy.findings
      : [
          {
            title: "No main strategy yet",
            status: "note",
            message: "Synergy needs a clearer main strategy before the shell can be judged against it.",
          },
        ];
  const mainCards =
    activeStrategy?.keyCards?.length
      ? activeStrategy.keyCards.map((card) => createListItem(card))
      : [createListItem("No clear support cards were isolated for the main strategy yet.")];

  const subItems =
    activeSubStrategies.length > 0
      ? activeSubStrategies.map((entry) =>
          createListItem(
            `${entry.label}${
              entry.keyCards.length > 0 ? ` | ${entry.keyCards.join(", ")}` : ""
            }`,
          ),
        )
      : [createListItem("No strong secondary strategy was detected.")];

  mainStrategyCardsList.replaceChildren(...mainCards);
  subStrategiesList.replaceChildren(...subItems);
  renderFindings(synergyFindings, strategySynergyFindingsList);
}

function renderStrategySwitcher(strategy, activePerspective) {
  const perspectives = strategy.perspectives ?? [];
  const detectedMainStrategy = getDetectedMainStrategy(strategy);
  if (perspectives.length <= 1) {
    strategySwitcher.replaceChildren();
    strategySwitcherWrap.classList.add("hidden");
    return;
  }

  const buttons = perspectives.map((perspective) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "strategy-chip";

    if (perspective.strategy.key === activePerspective?.strategy.key) {
      button.classList.add("strategy-chip-active");
    }

    if (perspective.strategy.key === detectedMainStrategy?.key) {
      button.classList.add("strategy-chip-detected");
    }

    const label = document.createElement("span");
    label.textContent = perspective.strategy.label;
    button.append(label);

    if (perspective.strategy.key === detectedMainStrategy?.key) {
      const badge = document.createElement("span");
      badge.className = "strategy-chip-badge";
      badge.textContent = "Detected";
      button.append(badge);
    }

    button.addEventListener("click", async () => {
      if (submitButton.disabled || selectedStrategyPerspectiveKey === perspective.strategy.key) {
        return;
      }

      const previousKey = selectedStrategyPerspectiveKey;
      selectedStrategyPerspectiveKey = perspective.strategy.key;
      const success = await runDeckAnalysis({
        preferredStrategyKey: perspective.strategy.key,
        preserveCurrentView: true,
        statusMessage: `Re-scoring the deck as ${perspective.strategy.label}...`,
        successMessage: `Deck re-scored as ${perspective.strategy.label}.`,
        loadingTitleText: "Recalculating Strategy",
        loadingCopyText: `Re-scoring the deck with ${perspective.strategy.label} as the main plan.`,
      });

      if (!success) {
        selectedStrategyPerspectiveKey = previousKey;
        renderStrategy(strategy);
        if (currentAnalysisSnapshot?.winStrategy) {
          renderWinStrategy(strategy, currentAnalysisSnapshot.winStrategy);
        }
      }
    });

    return button;
  });

  strategySwitcher.replaceChildren(...buttons);
  strategySwitcherWrap.classList.remove("hidden");
}

function renderCardBreakdown(deckDocument, analysis) {
  cardBreakdownController.render(deckDocument, analysis);
}

function buildWinStrategySummary(winStrategy, primaryPlan, backupPlans, perspectiveLabel) {
  if (!primaryPlan) {
    return winStrategy.summary;
  }

  if (backupPlans.length === 0) {
    return `${perspectiveLabel} currently looks like it mainly closes through ${primaryPlan.label.toLowerCase()}.`;
  }

  if (backupPlans.length === 1) {
    return `${perspectiveLabel} currently looks like it mainly closes through ${primaryPlan.label.toLowerCase()}, with ${backupPlans[0].label.toLowerCase()} as the clearest backup plan.`;
  }

  return `${perspectiveLabel} currently looks like it mainly closes through ${primaryPlan.label.toLowerCase()}, with ${backupPlans[0].label.toLowerCase()} and ${backupPlans[1].label.toLowerCase()} as backup plans.`;
}

function getDetectedMainStrategy(strategy) {
  return strategy.detectedMainStrategy ?? strategy.mainStrategy;
}

function renderAnalysisStatus(input) {
  if (!analysisStatus) {
    return;
  }

  const statusCards = [
    {
      label: "Bracket",
      value: input.bracket.recommendedLabel,
      note: input.bracket.targetLabel
        ? `Target: ${input.bracket.targetLabel}`
        : input.bracket.recommendedName,
    },
    {
      label: "Power",
      value: `${input.power.powerScore.toFixed(1)} / 10`,
      note: input.power.powerTier,
    },
    {
      label: "Strategy",
      value: input.strategy.mainStrategy?.label ?? "Unclear",
      note: input.strategy.subStrategies.length > 0
        ? `Side plan: ${input.strategy.subStrategies[0].label}`
        : "No strong side plan detected",
    },
    {
      label: "Win Plan",
      value: input.winStrategy.primaryPlan?.label ?? "Unclear",
      note: input.winStrategy.backupPlans.length > 0
        ? `Backup: ${input.winStrategy.backupPlans[0].label}`
        : input.winConditions.summary,
    },
  ];

  analysisStatus.replaceChildren(...statusCards.map(createAnalysisStatusCard));
}

function createAnalysisStatusCard(card) {
  const article = document.createElement("article");
  article.className = "analysis-status-card";

  const label = document.createElement("span");
  label.textContent = card.label;

  const value = document.createElement("strong");
  value.textContent = card.value;

  const note = document.createElement("p");
  note.textContent = card.note;

  article.append(label, value, note);
  return article;
}

function getPowerDimensionScore(power, key) {
  return power.dimensions.find((dimension) => dimension.key === key)?.score ?? 0;
}

function buildStrategySummary(strategy, activeStrategy, detectedMainStrategy, reviewingAlternateMain) {
  if (!activeStrategy) {
    return strategy.summary;
  }

  if (!reviewingAlternateMain || !detectedMainStrategy) {
    return strategy.summary;
  }

  return `Viewing ${activeStrategy.label} as the main plan. Detected main strategy remains ${detectedMainStrategy.label}.`;
}

function renderManaCurve(curve) {
  const buckets = [
    { label: "0-1", count: curve.zeroToOne },
    { label: "2", count: curve.two },
    { label: "3", count: curve.three },
    { label: "4", count: curve.four },
    { label: "5", count: curve.five },
    { label: "6+", count: curve.sixPlus },
  ];
  const maxCount = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const bars = buckets.map((bucket) => {
    const item = document.createElement("article");
    item.className = "curve-item";

    const value = document.createElement("span");
    value.className = "curve-value";
    value.textContent = String(bucket.count);

    const bar = document.createElement("div");
    bar.className = "curve-bar";
    bar.style.height = `${Math.max(16, Math.round((bucket.count / maxCount) * 120))}px`;

    const label = document.createElement("span");
    label.className = "curve-label";
    label.textContent = bucket.label;

    item.append(value, bar, label);
    return item;
  });

  curveBars.replaceChildren(...bars);
}

function averageScores(...scores) {
  if (scores.length === 0) {
    return 0;
  }

  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function firstSentence(text) {
  const trimmedText = text?.trim();
  if (!trimmedText) {
    return "";
  }

  const sentenceMatch = trimmedText.match(/^.*?[.!?](?:\s|$)/);
  return sentenceMatch ? sentenceMatch[0].trim() : trimmedText;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatDecimal(value) {
  return value.toFixed(2).replace(/\.00$/, "");
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

function formatWholeScore(value) {
  return String(Math.round(value));
}

function formatTutorTag(tag) {
  switch (tag) {
    case "direct_tutor":
      return "direct";
    case "restricted_tutor":
      return "restricted";
    case "repeatable_tutor":
      return "repeatable";
    case "land_tutor":
      return "land";
    default:
      return tag;
  }
}

function formatFindingLabel(finding) {
  if (!finding) {
    return "-";
  }

  return `${capitalize(finding.status)}: ${finding.title}`;
}

function capitalize(value) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function renderRampCards(taggedCards) {
  renderTaggedCardSection({
    listElement: rampCardsList,
    previewElement: rampCardsPreview,
    taggedCards,
    emptyMessage: "No ramp cards were detected from the wording rules.",
    formatItem: (card) => {
      const labels = card.hits.map((hit) => formatRampTag(hit.tag)).join(", ");
      return createListItem(`${card.quantity}x ${card.name} [${labels}]`);
    },
  });
}

function renderLandBaseCards(taggedCards) {
  renderTaggedCardSection({
    listElement: landBaseCardsList,
    previewElement: landBaseCardsPreview,
    taggedCards,
    emptyMessage: "No special land traits were detected from the wording rules.",
    formatItem: (card) => {
      const labels = card.hits.map((hit) => formatLandBaseTag(hit.tag)).join(", ");
      return createListItem(`${card.quantity}x ${card.name} [${labels}]`);
    },
  });
}

function renderCommanderCards(taggedCards) {
  renderTaggedCardSection({
    listElement: commanderCardsList,
    previewElement: commanderCardsPreview,
    taggedCards,
    emptyMessage: "No major command-zone engine roles were detected from the wording rules.",
    formatItem: (card) => {
      const labels = card.hits.map((hit) => formatCommanderRoleTag(hit.tag)).join(", ");
      return createListItem(`${card.name} [${labels}]`);
    },
  });
}

function renderCommanderProfiles(profiles = []) {
  if (!commanderProfilesList) {
    return;
  }

  commanderProfilesList.replaceChildren();

  if (!profiles.length) {
    const empty = document.createElement("p");
    empty.className = "muted-inline";
    empty.textContent = "No specific commander build-around profile was detected yet.";
    commanderProfilesList.append(empty);
    return;
  }

  profiles.slice(0, 4).forEach((profile) => {
    const card = document.createElement("article");
    card.className = "commander-profile-card";

    const header = document.createElement("div");
    header.className = "commander-profile-header";

    const titleWrap = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = profile.label;
    const commander = document.createElement("span");
    commander.textContent = profile.commanderName;
    titleWrap.append(title, commander);

    const confidence = document.createElement("span");
    confidence.className = `profile-confidence ${getProfileConfidenceClass(profile.confidence)}`;
    confidence.textContent = `${Math.round(profile.confidence)}%`;

    header.append(titleWrap, confidence);

    const meter = document.createElement("div");
    meter.className = "profile-meter";
    const fill = document.createElement("span");
    fill.style.width = `${Math.max(4, Math.min(100, profile.confidence))}%`;
    meter.append(fill);

    const body = document.createElement("p");
    body.textContent = `${profile.supportCount}/${profile.supportTarget} support cards, ${profile.coreCount} core pieces. ${profile.supportReason}`;

    const chips = document.createElement("div");
    chips.className = "profile-chip-row";
    (profile.supportCards ?? []).slice(0, 5).forEach((name) => {
      const chip = document.createElement("span");
      chip.className = "role-chip";
      chip.textContent = name;
      chips.append(chip);
    });

    if (profile.missingPieces?.length) {
      const missing = document.createElement("div");
      missing.className = "profile-missing";
      missing.textContent = `Needs: ${profile.missingPieces.join(", ")}`;
      card.append(header, meter, body, chips, missing);
    } else {
      card.append(header, meter, body, chips);
    }

    commanderProfilesList.append(card);
  });
}

function getProfileConfidenceClass(value) {
  if (value >= 72) {
    return "profile-confidence-good";
  }
  if (value >= 52) {
    return "profile-confidence-note";
  }
  return "profile-confidence-warning";
}

function renderDrawCards(taggedCards) {
  renderTaggedCardSection({
    listElement: drawCardsList,
    previewElement: drawCardsPreview,
    taggedCards,
    emptyMessage: "No card-flow cards were detected from the wording rules.",
    formatItem: (card) => {
      const labels = card.hits.map((hit) => formatDrawTag(hit.tag)).join(", ");
      return createListItem(`${card.quantity}x ${card.name} [${labels}]`);
    },
  });
}

function renderConsistencyCards(taggedCards) {
  renderTaggedCardSection({
    listElement: consistencyCardsList,
    previewElement: consistencyCardsPreview,
    taggedCards,
    emptyMessage: "No tutors were detected from the wording rules.",
    formatItem: (card) => {
      const labels = card.hits.map((hit) => formatTutorTag(hit.tag)).join(", ");
      return createListItem(`${card.quantity}x ${card.name} [${labels}]`);
    },
  });
}

function renderGameChangerCards(taggedCards) {
  renderTaggedCardSection({
    listElement: gameChangerCardsList,
    previewElement: gameChangerCardsPreview,
    taggedCards,
    emptyMessage:
      "No official Game Changers were found in the commander, mainboard, or companion slot.",
    getLookupName: (card) => card.matchedName,
    formatItem: (card) => {
      const displayName =
        card.name === card.matchedName ? card.name : `${card.matchedName} (${card.name})`;
      return createListItem(`${card.quantity}x ${displayName} [${formatDeckSection(card.section)}]`);
    },
  });
}

function renderSimpleList(listElement, values, emptyMessage) {
  const items =
    values.length > 0
      ? values.map((value) => createListItem(value))
      : [createListItem(emptyMessage)];

  listElement.replaceChildren(...items);
}

function renderRemovalCards(taggedCards) {
  renderTaggedCardSection({
    listElement: removalCardsList,
    previewElement: removalCardsPreview,
    taggedCards,
    emptyMessage: "No removal cards were detected from the wording rules.",
    formatItem: (card) => {
      const labels = card.hits.map((hit) => formatRemovalTag(hit.tag)).join(", ");
      return createListItem(`${card.quantity}x ${card.name} [${labels}]`);
    },
  });
}

function renderProtectionCards(taggedCards) {
  renderTaggedCardSection({
    listElement: protectionCardsList,
    previewElement: protectionCardsPreview,
    taggedCards,
    emptyMessage: "No protection cards were detected from the wording rules.",
    formatItem: (card) => {
      const labels = card.hits.map((hit) => formatProtectionTag(hit.tag)).join(", ");
      return createListItem(`${card.quantity}x ${card.name} [${labels}]`);
    },
  });
}

function renderRecursionCards(taggedCards) {
  renderTaggedCardSection({
    listElement: recursionCardsList,
    previewElement: recursionCardsPreview,
    taggedCards,
    emptyMessage: "No recursion cards were detected from the wording rules.",
    formatItem: (card) => {
      const labels = card.hits.map((hit) => formatRecursionTag(hit.tag)).join(", ");
      return createListItem(`${card.quantity}x ${card.name} [${labels}]`);
    },
  });
}

function renderFinisherCards(taggedCards) {
  renderTaggedCardSection({
    listElement: finisherCardsList,
    previewElement: finisherCardsPreview,
    taggedCards,
    emptyMessage: "No finishers were detected from the wording rules.",
    formatItem: (card) => {
      const labels = card.hits.map((hit) => formatFinisherTag(hit.tag)).join(", ");
      return createListItem(`${card.quantity}x ${card.name} [${labels}]`);
    },
  });
}

function renderComboLines(comboLookup) {
  if (comboLookup.lookupStatus !== "ok") {
    comboLinesList.replaceChildren(
      createListItem(
        comboLookup.error
          ? `Commander Spellbook combo lookup was unavailable for this scan. (${comboLookup.error})`
          : "Commander Spellbook combo lookup was unavailable for this scan.",
      ),
    );
    return;
  }

  if (comboLookup.exact.length === 0) {
    comboLinesList.replaceChildren(
      createListItem("No exact infinite combo lines were found."),
    );
    return;
  }

  const items = comboLookup.exact.map((combo) => {
    const typeLabel = combo.lineType === "finisher" ? "finisher" : "engine";
    const outcomeLabel =
      combo.outcomeNames.length > 0 ? ` -> ${combo.outcomeNames.join("; ")}` : "";
    return createListItem(
      `[${typeLabel}] ${combo.cardNames.join(" + ")}${outcomeLabel}`,
    );
  });

  comboLinesList.replaceChildren(...items);
}

function renderSpellInteractionCards(taggedCards) {
  renderTaggedCardSection({
    listElement: spellInteractionCardsList,
    previewElement: spellInteractionCardsPreview,
    taggedCards,
    emptyMessage: "No spell-interaction cards were detected from the wording rules.",
    formatItem: (card) => {
      const labels = card.hits.map((hit) => formatSpellInteractionTag(hit.tag)).join(", ");
      return createListItem(`${card.quantity}x ${card.name} [${labels}]`);
    },
  });
}

function formatRampTag(tag) {
  return TAG_LABELS.ramp?.[tag] ?? tag;
}

function formatLandBaseTag(tag) {
  return TAG_LABELS.landBase?.[tag] ?? tag;
}

function formatDrawTag(tag) {
  return TAG_LABELS.draw?.[tag] ?? tag;
}

function formatProtectionTag(tag) {
  return TAG_LABELS.protection?.[tag] ?? tag;
}

function formatRecursionTag(tag) {
  return TAG_LABELS.recursion?.[tag] ?? tag;
}

function formatFinisherTag(tag) {
  return TAG_LABELS.finisher?.[tag] ?? tag;
}

function formatRemovalTag(tag) {
  return TAG_LABELS.removal?.[tag] ?? tag;
}

function formatSpellInteractionTag(tag) {
  return TAG_LABELS.spellInteraction?.[tag] ?? tag;
}

function formatCommanderRoleTag(tag) {
  return TAG_LABELS.commanderRole?.[tag] ?? tag;
}

function formatDeckSection(section) {
  return TAG_LABELS.deckSection?.[section] ?? section;
}
