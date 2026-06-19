import { normalizeLookupKey } from "./decklist";
import {
  DeckResolutionDocument,
  DeckValidationIssue,
  DeckValidationResult,
  ResolvedDeckCard,
  ScryfallCard,
} from "./types";

const ALLOWED_SECTIONS = new Set(["commander", "mainboard", "companion"]);
const ANY_NUMBER_OF_CARDS_PATTERN = /a deck can have any number of cards named/i;
const COLOR_ORDER = ["W", "U", "B", "R", "G"] as const;

type CommanderMode = "single" | "partner" | "background" | "doctor_companion" | "multiple";
type CommanderRole = "commander" | "partner" | "background" | "doctor_companion";

interface CommanderRoleCard {
  card: ResolvedDeckCard;
  role: CommanderRole;
}

interface ValidationOptions {
  commanderName?: string;
  additionalCommanderName?: string;
  partnerName?: string;
  backgroundName?: string;
  companionName?: string;
}

export class DeckValidationError extends Error {
  readonly validation: DeckValidationResult;

  constructor(validation: DeckValidationResult) {
    super("Deck validation failed.");
    this.name = "DeckValidationError";
    this.validation = validation;
  }
}

export function validateEdhDeck(
  document: DeckResolutionDocument,
  options: ValidationOptions = {},
): DeckValidationResult {
  const issues: DeckValidationIssue[] = [];

  for (const parseError of document.parse.errors) {
    issues.push({
      code: "parse_error",
      message: parseError.message,
      lineNumber: parseError.lineNumber,
    });
  }

  for (const warning of document.parse.warnings) {
    if (
      warning.startsWith('Commander "') ||
      warning.startsWith('Additional Commander "') ||
      warning.startsWith('Partner "') ||
      warning.startsWith('Background "')
    ) {
      issues.push({
        code: "commander_not_found",
        message: warning,
      });
    }
  }

  for (const entry of document.parse.entries) {
    if (!ALLOWED_SECTIONS.has(entry.section)) {
      issues.push({
        code: "unsupported_section",
        message: `Remove ${entry.section} cards before exporting the EDH deck.`,
        lineNumber: entry.lineNumber,
        cardName: entry.name,
        section: entry.section,
      });
    }
  }

  for (const unresolvedCard of document.result.unresolvedCards) {
    issues.push({
      code: "card_not_found",
      message: `"${unresolvedCard.requestedName}" could not be matched exactly on Scryfall.`,
      lineNumber: unresolvedCard.lineNumber,
      cardName: unresolvedCard.requestedName,
      section: unresolvedCard.section,
    });
  }

  const commanderCards = document.result.resolvedCards.filter((card) => card.section === "commander");
  const mainboardCards = document.result.resolvedCards.filter((card) => card.section === "mainboard");
  const companionCards = document.result.resolvedCards.filter((card) => card.section === "companion");
  const commanderQuantity = sumQuantities(commanderCards);
  const commanderMode = determineCommanderMode(commanderCards, options);
  const expectedCommanderCount = commanderMode === "single" ? 1 : 2;
  const expectedMainboardSize = 100 - expectedCommanderCount;
  const mainboardQuantity = sumQuantities(mainboardCards);
  const mainDeckQuantity = commanderQuantity + mainboardQuantity;

  if (options.partnerName && options.backgroundName) {
    issues.push({
      code: "commander_mode_conflict",
      message: "Choose either a partner or a background, not both.",
    });
  }

  if (
    commanderCards.length !== expectedCommanderCount ||
    commanderQuantity !== expectedCommanderCount ||
    commanderCards.some((card) => card.quantity !== 1)
  ) {
    issues.push({
      code: "commander_count",
      message: getCommanderCountMessage(commanderMode),
    });
  }

  if (mainboardQuantity !== expectedMainboardSize) {
    issues.push({
      code: "mainboard_size",
      message: `The EDH mainboard must contain ${expectedMainboardSize} cards, but this deck has ${mainboardQuantity}.`,
    });
  }

  if (mainDeckQuantity !== 100) {
    issues.push({
      code: "deck_size",
      message: `The commander plus mainboard must contain 100 cards, but this deck has ${mainDeckQuantity}.`,
    });
  }

  validateCompanion(companionCards, options, issues);

  if (commanderCards.length > 0) {
    validateCommanderLegality(commanderCards, commanderMode, options, issues);
    validateColorIdentity(commanderCards, mainboardCards, issues);
  } else if (options.commanderName) {
    issues.push({
      code: "commander_missing",
      message: `The selected commander "${options.commanderName}" is missing from the decklist.`,
    });
  }

  validateSingletonRules([...commanderCards, ...mainboardCards], issues);

  const commanderRoles = assignCommanderRoles(commanderCards, commanderMode, options);

  return {
    isValid: issues.length === 0,
    issues,
    commander: commanderRoles[0]
      ? {
          requestedName: commanderRoles[0].card.requestedName,
          resolvedName: commanderRoles[0].card.card.name,
          lineNumber: commanderRoles[0].card.lineNumber,
          colorIdentity: buildCombinedColorIdentity([commanderRoles[0].card]),
        }
      : undefined,
    commanders: commanderRoles.map((entry) => ({
      requestedName: entry.card.requestedName,
      resolvedName: entry.card.card.name,
      lineNumber: entry.card.lineNumber,
      colorIdentity: entry.card.card.color_identity,
      role: entry.role,
    })),
  };
}

function validateCommanderLegality(
  commanderCards: ResolvedDeckCard[],
  commanderMode: CommanderMode,
  options: ValidationOptions,
  issues: DeckValidationIssue[],
) {
  if (commanderMode === "single") {
    const commanderCard = commanderCards[0];

    if (commanderCard && !isLegalStandaloneCommander(commanderCard.card)) {
      issues.push({
        code: "illegal_commander",
        message: `"${commanderCard.requestedName}" is not a legal EDH commander.`,
        lineNumber: commanderCard.lineNumber,
        cardName: commanderCard.requestedName,
        section: commanderCard.section,
      });
    }
    return;
  }

  if (commanderCards.length < 2) {
    return;
  }

  if (commanderMode === "partner") {
    if (!isValidPartnerPair(commanderCards)) {
      issues.push({
        code: "invalid_partner_pair",
        message: getPartnerErrorMessage(options.partnerName),
      });
    }
    return;
  }

  if (commanderMode === "background") {
    if (!isValidBackgroundPair(commanderCards)) {
      issues.push({
        code: "invalid_background_pair",
        message: getBackgroundErrorMessage(options.backgroundName),
      });
    }
    return;
  }

  if (commanderMode === "doctor_companion") {
    if (!isValidDoctorCompanionPair(commanderCards)) {
      issues.push({
        code: "invalid_doctor_companion_pair",
        message: getDoctorCompanionErrorMessage(options.additionalCommanderName),
      });
    }
    return;
  }

  issues.push({
    code: "invalid_commander_pair",
    message:
      "Two commander cards were found, but they are not a legal Partner, Background, or Doctor's companion pairing.",
  });
}

function validateCompanion(
  companionCards: ResolvedDeckCard[],
  options: ValidationOptions,
  issues: DeckValidationIssue[],
) {
  if (companionCards.length === 0 && !options.companionName) {
    return;
  }

  if (companionCards.length === 0) {
    issues.push({
      code: "companion_missing",
      message: `The selected companion "${options.companionName}" could not be found for this deck.`,
    });
    return;
  }

  const companionQuantity = sumQuantities(companionCards);

  if (
    companionCards.length !== 1 ||
    companionQuantity !== 1 ||
    companionCards.some((card) => card.quantity !== 1)
  ) {
    issues.push({
      code: "companion_count",
      message: "A companion slot needs exactly one companion card with quantity 1 outside the 100-card deck.",
    });
  }

  const companionCard = companionCards[0];
  if (!isLegalCompanion(companionCard.card)) {
    issues.push({
      code: "illegal_companion",
      message: `"${companionCard.requestedName}" is not a legal companion card.`,
      lineNumber: companionCard.lineNumber || undefined,
      cardName: companionCard.requestedName,
      section: companionCard.section,
    });
  }
}

function getCommanderCountMessage(mode: CommanderMode) {
  if (mode === "partner") {
    return "A partner deck needs exactly two partner commanders, each with quantity 1.";
  }

  if (mode === "background") {
    return "A background deck needs exactly one commander and one background, each with quantity 1.";
  }

  if (mode === "doctor_companion") {
    return "A Doctor's companion deck needs exactly one Doctor and one Doctor's companion card, each with quantity 1.";
  }

  if (mode === "multiple") {
    return "Two commander cards were found. Use a legal Partner pair, a commander plus Background pair, or a Doctor plus Doctor's companion pair.";
  }

  return "Exactly one commander card with quantity 1 is required.";
}

function getPartnerErrorMessage(partnerName?: string) {
  if (partnerName) {
    return `The selected partner "${partnerName}" does not form a legal partner pair with the chosen commander.`;
  }

  return "The two commander cards do not form a legal partner pair.";
}

function getBackgroundErrorMessage(backgroundName?: string) {
  if (backgroundName) {
    return `The selected background "${backgroundName}" does not form a legal commander plus Background pair.`;
  }

  return "The two commander cards do not form a legal commander plus Background pair.";
}

function getDoctorCompanionErrorMessage(additionalCommanderName?: string) {
  if (additionalCommanderName) {
    return `The selected additional commander "${additionalCommanderName}" does not form a legal Doctor plus Doctor's companion pair with the chosen commander.`;
  }

  return "The two commander cards do not form a legal Doctor plus Doctor's companion pair.";
}

function validateColorIdentity(
  commanderCards: ResolvedDeckCard[],
  mainboardCards: ResolvedDeckCard[],
  issues: DeckValidationIssue[],
) {
  const commanderIdentity = buildCombinedColorIdentity(commanderCards);
  const allowedColors = new Set(commanderIdentity);

  for (const card of mainboardCards) {
    const illegalColors = (card.card.color_identity ?? []).filter((color) => !allowedColors.has(color));
    if (illegalColors.length === 0) {
      continue;
    }

    issues.push({
      code: "color_identity_mismatch",
      message: `"${card.requestedName}" is outside the commander color identity (${commanderIdentity.join("") || "colorless"}).`,
      lineNumber: card.lineNumber,
      cardName: card.requestedName,
      section: card.section,
    });
  }
}

function validateSingletonRules(cards: ResolvedDeckCard[], issues: DeckValidationIssue[]) {
  const groupedCards = new Map<
    string,
    {
      totalQuantity: number;
      firstCard: ResolvedDeckCard;
    }
  >();

  for (const card of cards) {
    const key = card.card.oracle_id ?? normalizeLookupKey(card.card.name);
    const group = groupedCards.get(key);

    if (!group) {
      groupedCards.set(key, {
        totalQuantity: card.quantity,
        firstCard: card,
      });
      continue;
    }

    group.totalQuantity += card.quantity;
  }

  for (const group of groupedCards.values()) {
    if (group.totalQuantity <= 1 || isSingletonExempt(group.firstCard.card)) {
      continue;
    }

    issues.push({
      code: "duplicate_card",
      message: `"${group.firstCard.card.name}" appears ${group.totalQuantity} times, but EDH allows only one copy.`,
      lineNumber: group.firstCard.lineNumber,
      cardName: group.firstCard.requestedName,
      section: group.firstCard.section,
    });
  }
}

function isSingletonExempt(card: ScryfallCard): boolean {
  if (isBasicLand(card)) {
    return true;
  }

  return ANY_NUMBER_OF_CARDS_PATTERN.test(card.oracle_text ?? "");
}

function isBasicLand(card: ScryfallCard): boolean {
  return getTypeLines(card).some((typeLine) => {
    const normalizedTypeLine = normalizeLookupKey(typeLine);
    return /\bbasic\b/.test(normalizedTypeLine) && /\bland\b/.test(normalizedTypeLine);
  });
}

function isLegalCommander(card: ScryfallCard): boolean {
  if (card.legalities?.commander !== "legal") {
    return false;
  }

  const typeLine = getPrimaryTypeLine(card);
  const oracleText = getOracleText(card);

  if (oracleText.includes("can be your commander")) {
    return true;
  }

  if (!typeLine.includes("legendary")) {
    return false;
  }

  return (
    typeLine.includes("creature") ||
    typeLine.includes("planeswalker") ||
    typeLine.includes("vehicle") ||
    typeLine.includes("spacecraft")
  );
}

function determineCommanderMode(
  commanderCards: ResolvedDeckCard[],
  options: ValidationOptions,
): CommanderMode {
  if (options.backgroundName) {
    return "background";
  }

  if (options.partnerName) {
    return "partner";
  }

  if (options.additionalCommanderName) {
    if (isValidBackgroundPair(commanderCards)) {
      return "background";
    }

    if (isValidDoctorCompanionPair(commanderCards)) {
      return "doctor_companion";
    }

    if (isValidPartnerPair(commanderCards)) {
      return "partner";
    }

    return "multiple";
  }

  if (commanderCards.length === 2) {
    if (isValidBackgroundPair(commanderCards)) {
      return "background";
    }

    if (isValidDoctorCompanionPair(commanderCards)) {
      return "doctor_companion";
    }

    if (isValidPartnerPair(commanderCards)) {
      return "partner";
    }

    return "multiple";
  }

  return "single";
}

function assignCommanderRoles(
  commanderCards: ResolvedDeckCard[],
  commanderMode: CommanderMode,
  options: ValidationOptions,
): CommanderRoleCard[] {
  if (commanderCards.length === 0) {
    return [];
  }

  if (commanderMode === "single" || commanderCards.length === 1) {
    return [{ card: commanderCards[0], role: "commander" }];
  }

  const normalizedPartnerName = normalizeSelectedName(options.partnerName);
  const normalizedBackgroundName = normalizeSelectedName(options.backgroundName);
  const normalizedCommanderName = normalizeSelectedName(options.commanderName);
  const doctorCard = commanderCards.find((card) => isDoctorCommanderCard(card.card));

  if (commanderMode === "background") {
    const backgroundCard =
      commanderCards.find((card) => normalizeLookupKey(card.requestedName) === normalizedBackgroundName) ??
      commanderCards.find((card) => isBackgroundCard(card.card));

    return commanderCards.map((card) => ({
      card,
      role: card === backgroundCard ? "background" : "commander",
    }));
  }

  if (commanderMode === "partner") {
    const commanderCard =
      commanderCards.find((card) => normalizeLookupKey(card.requestedName) === normalizedCommanderName) ??
      commanderCards[0];
    const partnerCard =
      commanderCards.find((card) => normalizeLookupKey(card.requestedName) === normalizedPartnerName) ??
      commanderCards.find((card) => card !== commanderCard) ??
      commanderCards[1];

    return commanderCards.map((card) => ({
      card,
      role: card === partnerCard ? "partner" : "commander",
    }));
  }

  if (commanderMode === "doctor_companion") {
    const leadCommander =
      commanderCards.find((card) => normalizeLookupKey(card.requestedName) === normalizedCommanderName) ??
      doctorCard ??
      commanderCards[0];

    return commanderCards.map((card) => ({
      card,
      role: card === leadCommander ? "commander" : "doctor_companion",
    }));
  }

  const backgroundCard = commanderCards.find((card) => isBackgroundCard(card.card));

  return commanderCards.map((card, index) => ({
    card,
    role: card === backgroundCard ? "background" : index === 0 ? "commander" : "partner",
  }));
}

function isLegalStandaloneCommander(card: ScryfallCard): boolean {
  return isLegalCommander(card) && !isBackgroundCard(card);
}

function isLegalCompanion(card: ScryfallCard): boolean {
  if (card.legalities?.commander !== "legal") {
    return false;
  }

  if ((card.keywords ?? []).some((keyword) => keyword.toLowerCase() === "companion")) {
    return true;
  }

  return /\bcompanion\s+[—-]/i.test(card.oracle_text ?? "");
}

function isBackgroundCard(card: ScryfallCard): boolean {
  return card.type_line.toLowerCase().includes("background");
}

function hasChooseABackground(card: ScryfallCard): boolean {
  return getOracleText(card).includes("choose a background");
}

function isValidBackgroundPair(commanderCards: ResolvedDeckCard[]): boolean {
  if (commanderCards.length !== 2 || commanderCards.some((card) => card.quantity !== 1)) {
    return false;
  }

  const backgroundCard = commanderCards.find((card) => isBackgroundCard(card.card));
  const commanderCard = commanderCards.find((card) => card !== backgroundCard);

  if (!backgroundCard || !commanderCard) {
    return false;
  }

  return (
    backgroundCard.card.legalities?.commander === "legal" &&
    isLegalStandaloneCommander(commanderCard.card) &&
    hasChooseABackground(commanderCard.card)
  );
}

function isValidDoctorCompanionPair(commanderCards: ResolvedDeckCard[]): boolean {
  if (commanderCards.length !== 2 || commanderCards.some((card) => card.quantity !== 1)) {
    return false;
  }

  const doctorCard = commanderCards.find((card) => isDoctorCommanderCard(card.card));
  const companionCard = commanderCards.find((card) => card !== doctorCard);

  if (!doctorCard || !companionCard) {
    return false;
  }

  return (
    isLegalStandaloneCommander(doctorCard.card) &&
    isLegalStandaloneCommander(companionCard.card) &&
    hasDoctorsCompanion(companionCard.card)
  );
}

function isValidPartnerPair(commanderCards: ResolvedDeckCard[]): boolean {
  if (commanderCards.length !== 2 || commanderCards.some((card) => card.quantity !== 1)) {
    return false;
  }

  if (commanderCards.some((card) => !isLegalStandaloneCommander(card.card))) {
    return false;
  }

  const [left, right] = commanderCards.map((card) => getPartnerProfile(card.card));
  const leftName = normalizeLookupKey(commanderCards[0].card.name);
  const rightName = normalizeLookupKey(commanderCards[1].card.name);

  if (left.kind === "partner" && right.kind === "partner") {
    return true;
  }

  if (left.kind === "friends_forever" && right.kind === "friends_forever") {
    return true;
  }

  return (
    left.kind === "partner_with" &&
    right.kind === "partner_with" &&
    left.partnerWithName === rightName &&
    right.partnerWithName === leftName
  );
}

function getPartnerProfile(card: ScryfallCard):
  | { kind: "none" }
  | { kind: "partner" }
  | { kind: "friends_forever" }
  | { kind: "partner_with"; partnerWithName: string } {
  const keywords = new Set((card.keywords ?? []).map((keyword) => keyword.toLowerCase()));
  const oracleText = getOracleText(card);
  const partnerWithMatch = oracleText.match(/partner with ([^.]+)/i);

  if (partnerWithMatch) {
    return {
      kind: "partner_with",
      partnerWithName: normalizeLookupKey(partnerWithMatch[1].trim()),
    };
  }

  if (keywords.has("partner") || /^\s*partner\s*$/im.test(card.oracle_text ?? "")) {
    return { kind: "partner" };
  }

  if (keywords.has("friends forever") || oracleText.includes("friends forever")) {
    return { kind: "friends_forever" };
  }

  return { kind: "none" };
}

function hasDoctorsCompanion(card: ScryfallCard) {
  const keywords = new Set((card.keywords ?? []).map((keyword) => keyword.toLowerCase()));
  return (
    keywords.has("doctor's companion") ||
    keywords.has("doctor’s companion") ||
    /\bdoctor['’]s companion\b/.test(getOracleText(card))
  );
}

function isDoctorCommanderCard(card: ScryfallCard) {
  return /\bdoctor\b/.test(getPrimaryTypeLine(card));
}

function buildCombinedColorIdentity(commanderCards: ResolvedDeckCard[]) {
  const colors = new Set<string>();

  for (const card of commanderCards) {
    for (const color of card.card.color_identity ?? []) {
      colors.add(color);
    }
  }

  return [...colors].sort(
    (left, right) => COLOR_ORDER.indexOf(left as (typeof COLOR_ORDER)[number]) - COLOR_ORDER.indexOf(right as (typeof COLOR_ORDER)[number]),
  );
}

function getOracleText(card: ScryfallCard) {
  return [card.oracle_text, ...(card.card_faces ?? []).map((face) => face.oracle_text)]
    .filter((text): text is string => Boolean(text))
    .join("\n")
    .toLowerCase();
}

function getPrimaryTypeLine(card: ScryfallCard) {
  return (card.card_faces?.[0]?.type_line ?? card.type_line).toLowerCase();
}

function getTypeLines(card: ScryfallCard) {
  return [card.type_line, ...(card.card_faces ?? []).map((face) => face.type_line)]
    .filter((typeLine): typeLine is string => Boolean(typeLine));
}

function normalizeSelectedName(name?: string) {
  return name ? normalizeLookupKey(name) : null;
}

function sumQuantities(cards: ResolvedDeckCard[]): number {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}
