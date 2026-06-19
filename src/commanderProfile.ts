import {
  DeckCommanderProfile,
  DeckResolutionDocument,
  ResolvedDeckCard,
  ScryfallCard,
  StrategyKey,
} from "./types";

interface CommanderProfileRule {
  key: StrategyKey;
  label: string;
  supportReason: string;
  supportTarget: number;
  coreTarget?: number;
  askMatcher: (text: string, commander: ScryfallCard, context: CommanderProfileContext) => boolean;
  supportMatcher: (deckCard: ResolvedDeckCard, context: CommanderProfileContext) => boolean;
  coreMatcher?: (deckCard: ResolvedDeckCard, context: CommanderProfileContext) => boolean;
  missingPieces?: string[];
}

interface CommanderProfileContext {
  deckCards: ResolvedDeckCard[];
  creatureTypes: Map<string, number>;
}

export function analyzeCommanderProfiles(document: DeckResolutionDocument): DeckCommanderProfile[] {
  const deckCards = document.result.resolvedCards.filter(
    (card) => card.section === "commander" || card.section === "mainboard",
  );
  const commanders = deckCards.filter((card) => card.section === "commander");
  const context: CommanderProfileContext = {
    deckCards,
    creatureTypes: getCreatureTypeCounts(deckCards),
  };
  const profiles: DeckCommanderProfile[] = [];

  for (const commander of commanders) {
    const commanderText = getCardText(commander.card);
    const dynamicRules = getDynamicCommanderProfileRules(commanderText, context);

    for (const rule of [...BASE_COMMANDER_PROFILE_RULES, ...dynamicRules]) {
      if (!rule.askMatcher(commanderText, commander.card, context)) {
        continue;
      }

      const supportCards = deckCards.filter(
        (deckCard) => deckCard.section === "mainboard" && rule.supportMatcher(deckCard, context),
      );
      const coreCards = rule.coreMatcher
        ? supportCards.filter((deckCard) => rule.coreMatcher?.(deckCard, context))
        : supportCards;
      const supportCount = sumQuantities(supportCards);
      const coreCount = sumQuantities(coreCards);
      const coreTarget = rule.coreTarget ?? Math.max(2, Math.ceil(rule.supportTarget * 0.45));
      const confidence = scoreProfileConfidence(supportCount, rule.supportTarget, coreCount, coreTarget);

      profiles.push({
        commanderName: commander.card.name,
        key: rule.key,
        label: rule.label,
        supportReason: rule.supportReason,
        supportTarget: rule.supportTarget,
        supportCount,
        coreCount,
        confidence,
        supportCards: supportCards
          .sort((left, right) => right.quantity - left.quantity || left.card.name.localeCompare(right.card.name))
          .slice(0, 10)
          .map((deckCard) => deckCard.card.name),
        missingPieces: getProfileMissingPieces(rule, supportCount, coreCount, coreTarget),
      });
    }
  }

  return dedupeCommanderProfiles(profiles)
    .sort((left, right) => right.confidence - left.confidence || right.supportCount - left.supportCount)
    .slice(0, 8);
}

const BASE_COMMANDER_PROFILE_RULES: CommanderProfileRule[] = [
  {
    key: "face_down",
    label: "Face-Down Package",
    supportReason: "Morph, manifest, cloak, disguise, and turn-face-up cards are the material this commander asks for.",
    supportTarget: 14,
    coreTarget: 7,
    askMatcher: (text) => /\bface-down\b|\bface up\b|\bturned face up\b|\bmorph\b|\bmanifest\b|\bcloak\b|\bdisguise\b/.test(text),
    supportMatcher: (deckCard) => hasFaceDownText(getCardText(deckCard.card), deckCard.card),
  },
  {
    key: "pingers",
    label: "Small-Damage Package",
    supportReason: "Repeatable one-damage effects and ping payoffs are the material this commander asks for.",
    supportTarget: 12,
    coreTarget: 6,
    askMatcher: (text) => /\bdeals exactly 1 damage\b|\bdeals 1 damage\b[^.]{0,120}\bdeals? \d+ damage\b/.test(text),
    supportMatcher: (deckCard) => /\bdeals? (?:exactly )?1 damage\b|\bpinger\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "toughness_matter",
    label: "Toughness / Defender Package",
    supportReason: "High-toughness creatures, defenders, and toughness-combat payoffs are the material this commander asks for.",
    supportTarget: 14,
    coreTarget: 7,
    askMatcher: (text) =>
      /\bassigns? combat damage equal to (?:its|their) toughness\b|\btoughness rather than (?:its|their) power\b|\bdefender creatures? you control\b|\bcreatures? you control with defender\b/.test(text),
    supportMatcher: (deckCard) =>
      hasSubtype(deckCard.card, "Wall") ||
      /\bdefender\b|\btoughness rather than\b|\bassigns? combat damage equal to (?:its|their) toughness\b/.test(getCardText(deckCard.card)) ||
      hasHighToughness(deckCard.card),
  },
  {
    key: "tokens",
    label: "Token Package",
    supportReason: "Token makers, token payoffs, and populate-style effects are the material this commander asks for.",
    supportTarget: 16,
    coreTarget: 8,
    askMatcher: (text) => /\btokens? you control\b|\bcreature tokens? you control\b|\bpopulate\b|\bwhenever\b[^.]{0,120}\btokens?\b/.test(text),
    supportMatcher: (deckCard) => /\bcreate\b[^.]{0,120}\btokens?\b|\btokens? you control\b|\bpopulate\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "aristocrats",
    label: "Death / Sacrifice Package",
    supportReason: "Sacrifice outlets, death triggers, token fodder, and recursive creatures are the material this commander asks for.",
    supportTarget: 17,
    coreTarget: 8,
    askMatcher: (text) => /\bwhenever\b[^.]{0,120}\b(?:creatures?|another creature)\b[^.]{0,80}\b(?:dies|die|is put into a graveyard)\b|\bsacrifice another creature\b/.test(text),
    supportMatcher: (deckCard) => /\bsacrifice (?:a|another|one or more) creatures?\b|\bwhenever\b[^.]{0,120}\bcreatures?\b[^.]{0,80}\b(?:dies|die|is put into a graveyard)\b|\breturn\b[^.]{0,120}\bfrom your graveyard\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "blink",
    label: "Blink / ETB Package",
    supportReason: "Flicker effects and enters-the-battlefield payoffs are the material this commander asks for.",
    supportTarget: 14,
    coreTarget: 7,
    askMatcher: (text) => /\bexile\b[^.]{0,140}\b(?:you control|owner's control)\b[^.]{0,180}\breturn\b|\benters the battlefield\b[^.]{0,160}\btriggers? an additional time\b/.test(text),
    supportMatcher: (deckCard) => /\bexile\b[^.]{0,140}\b(?:you control|owner's control)\b[^.]{0,180}\breturn\b|\benters the battlefield\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "lands_matter",
    label: "Lands Package",
    supportReason: "Landfall, extra land drops, land recursion, and land utility are the material this commander asks for.",
    supportTarget: 34,
    coreTarget: 8,
    askMatcher: (text) => /\blandfall\b|\blands? you control\b|\bplay an additional land\b|\bplay lands? from\b|\bwhenever\b[^.]{0,120}\blands?\b[^.]{0,120}\benters? the battlefield\b/.test(text),
    supportMatcher: (deckCard) => hasCardType(deckCard.card, "Land") || /\blandfall\b|\bplay an additional land\b|\bplay lands? from\b|\breturn\b[^.]{0,120}\bland\b[^.]{0,120}\bgraveyard\b/.test(getCardText(deckCard.card)),
    coreMatcher: (deckCard) => !hasCardType(deckCard.card, "Land"),
  },
  {
    key: "spellslinger",
    label: "Instant / Sorcery Package",
    supportReason: "Instants, sorceries, spell-copy effects, and cast triggers are the material this commander asks for.",
    supportTarget: 22,
    coreTarget: 10,
    askMatcher: (text) => /\binstant or sorcery spells? you cast\b|\bwhenever you cast\b[^.]{0,120}\b(?:instant|sorcery)\b|\bmagecraft\b|\bcopy\b[^.]{0,100}\binstant or sorcery\b/.test(text),
    supportMatcher: (deckCard) => hasCardType(deckCard.card, "Instant") || hasCardType(deckCard.card, "Sorcery") || /\bmagecraft\b|\bcopy\b[^.]{0,100}\binstant or sorcery\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "artifacts",
    label: "Artifact Package",
    supportReason: "Artifacts, artifact payoffs, and artifact cost reducers are the material this commander asks for.",
    supportTarget: 20,
    coreTarget: 10,
    askMatcher: (text) => /\bartifact spells? you cast\b|\bartifacts? you control\b|\bfor each artifact\b|\bwhenever\b[^.]{0,120}\bartifacts?\b/.test(text),
    supportMatcher: (deckCard) => hasCardType(deckCard.card, "Artifact") || /\bartifacts? you control\b|\bartifact spells? you cast\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "enchantress",
    label: "Enchantment Package",
    supportReason: "Enchantments, Auras, Sagas, Rooms, and enchantment payoffs are the material this commander asks for.",
    supportTarget: 16,
    coreTarget: 8,
    askMatcher: (text) => /\benchantment spells? you cast\b|\benchantments? you control\b|\bconstellation\b|\bauras? you control\b|\bsagas? you control\b|\brooms? you control\b/.test(text),
    supportMatcher: (deckCard) => hasCardType(deckCard.card, "Enchantment") || /\bconstellation\b|\benchantment spells? you cast\b|\benchantments? you control\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "superfriends",
    label: "Planeswalker Package",
    supportReason: "Planeswalkers, proliferate, loyalty support, and planeswalker protection are the material this commander asks for.",
    supportTarget: 12,
    coreTarget: 6,
    askMatcher: (text) => /\bplaneswalker spells? you cast\b|\bplaneswalkers? you control\b|\bloyalty abilities?\b|\bfor each planeswalker\b/.test(text),
    supportMatcher: (deckCard) => hasCardType(deckCard.card, "Planeswalker") || /\bproliferate\b|\bloyalty abilities?\b|\bplaneswalkers? you control\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "counters",
    label: "Counters Package",
    supportReason: "Counter production, counter payoffs, and proliferate are the material this commander asks for.",
    supportTarget: 14,
    coreTarget: 7,
    askMatcher: (text) => /\bcounters? on\b|\bput\b[^.]{0,100}\bcounters?\b|\bremove\b[^.]{0,100}\bcounters?\b|\bproliferate\b|\bchoose a kind of counter\b/.test(text),
    supportMatcher: (deckCard) => /\bcounters?\b|\bproliferate\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "extra_upkeep",
    label: "Extra-Upkeep Package",
    supportReason: "Upkeep triggers, upkeep payoffs, and cumulative-upkeep cards are the material this commander asks for.",
    supportTarget: 9,
    coreTarget: 4,
    askMatcher: (text) => /\badditional upkeep\b|\bextra upkeep\b|\bbeginning of (?:your|each) upkeep\b/.test(text),
    supportMatcher: (deckCard) => /\bbeginning of (?:your|each|that player's) upkeep\b|\badditional upkeep\b|\bcumulative upkeep\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "tap_untap",
    label: "Tap / Untap Package",
    supportReason: "Tap effects, untap effects, stun counters, and tapped-creature payoffs are the material this commander asks for.",
    supportTarget: 12,
    coreTarget: 6,
    askMatcher: (text) => /\bwhenever\b[^.]{0,140}\bbecomes tapped\b|\btap target\b|\buntap\b|\bstun counters?\b|\btapped creatures? your opponents control\b/.test(text),
    supportMatcher: (deckCard) => /\btap target\b|\buntap\b|\bstun counters?\b|\bbecomes tapped\b|\btapped creatures? your opponents control\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "exile_cast",
    label: "Cast-from-Exile Package",
    supportReason: "Impulse draw, exile casting, and cast-from-exile payoffs are the material this commander asks for.",
    supportTarget: 14,
    coreTarget: 7,
    askMatcher: (text) => /\bwhenever you (?:cast|play)\b[^.]{0,120}\bfrom exile\b|\bcast\b[^.]{0,100}\bfrom exile\b|\bplay\b[^.]{0,100}\bfrom exile\b/.test(text),
    supportMatcher: (deckCard) => /\bexile the top\b[^.]{0,180}\b(?:play|cast)\b|\bfrom exile\b|\bplay those cards\b|\bcast those cards\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "theft",
    label: "Theft Package",
    supportReason: "Steal effects and opponent-card access are the material this commander asks for.",
    supportTarget: 11,
    coreTarget: 5,
    askMatcher: (text) => /\bgain control of\b|\byou control but don't own\b|\bopponents?'? cards?\b|\bfrom (?:an|your) opponents?'? (?:library|graveyard|hand|exile)\b/.test(text),
    supportMatcher: (deckCard) => /\bgain control of\b|\byou control but don't own\b|\bfrom (?:an|your) opponents?'? (?:library|graveyard|hand|exile)\b|\bopponents?'? cards?\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "group_slug",
    label: "Group-Slug Package",
    supportReason: "Broad damage, life-loss, and punishment effects are the material this commander asks for.",
    supportTarget: 12,
    coreTarget: 6,
    askMatcher: (text) => /\beach opponent loses\b|\bdeals? \d+ damage to each opponent\b|\bwhenever an opponent\b[^.]{0,120}\bloses life\b/.test(text),
    supportMatcher: (deckCard) => /\beach opponent loses\b|\bdeals? \d+ damage to each opponent\b|\bwhenever an opponent\b[^.]{0,120}\bloses life\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "lifegain",
    label: "Lifegain Package",
    supportReason: "Lifegain, lifelink, and life-payoff cards are the material this commander asks for.",
    supportTarget: 14,
    coreTarget: 7,
    askMatcher: (text) => /\bwhenever you gain life\b|\blife total\b|\blifelink\b|\bgain that much life\b/.test(text),
    supportMatcher: (deckCard) => /\bgain (?:\d+|x|that much)? ?life\b|\blifelink\b|\bwhenever you gain life\b|\blife total\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "mill",
    label: "Mill Package",
    supportReason: "Mill, self-mill, graveyard fill, and library-pressure cards are the material this commander asks for.",
    supportTarget: 12,
    coreTarget: 6,
    askMatcher: (text) => /\bmill\b|\bput\b[^.]{0,120}\bfrom (?:the top of )?(?:your|target player's|each player's) library\b[^.]{0,120}\bgraveyard\b/.test(text),
    supportMatcher: (deckCard) => /\bmill\b|\bput\b[^.]{0,120}\bfrom (?:the top of )?(?:your|target player's|each player's) library\b[^.]{0,120}\bgraveyard\b/.test(getCardText(deckCard.card)),
  },
  {
    key: "voltron",
    label: "Voltron Package",
    supportReason: "Auras, Equipment, protection, evasion, and commander-damage support are the material this commander asks for.",
    supportTarget: 12,
    coreTarget: 6,
    askMatcher: (text, commander) => /\bequipped creature\b|\benchanted creature\b|\bauras? you control\b|\bequipment you control\b|\bdeals combat damage to a player\b/.test(text) && hasCardType(commander, "Creature"),
    supportMatcher: (deckCard) => hasSubtype(deckCard.card, "Equipment") || hasSubtype(deckCard.card, "Aura") || /\bgets \+\d\/\+\d\b|\bdouble strike\b|\bhexproof\b|\bindestructible\b|\bcan't be blocked\b/.test(getCardText(deckCard.card)),
  },
];

function getDynamicCommanderProfileRules(
  commanderText: string,
  context: CommanderProfileContext,
): CommanderProfileRule[] {
  const rules: CommanderProfileRule[] = [];
  const requestedCreatureTypes = extractRequestedCreatureTypes(commanderText, context.creatureTypes);

  for (const type of requestedCreatureTypes) {
    rules.push({
      key: "kindred",
      label: `${formatType(type)} Package`,
      supportReason: `${formatType(type)} creatures and ${formatType(type)} payoffs are the material this commander asks for.`,
      supportTarget: 18,
      coreTarget: 10,
      askMatcher: () => true,
      supportMatcher: (deckCard) =>
        hasCreatureType(deckCard.card, type) ||
        new RegExp(`\\b${escapeRegex(type)}s?\\b`).test(getCardText(deckCard.card)),
      coreMatcher: (deckCard) => hasCreatureType(deckCard.card, type),
    });
  }

  const lowPower = extractNumber(commanderText, /\bpower (\d+) or less\b/);
  if (lowPower !== null) {
    rules.push({
      key: "power_matter",
      label: `Power ${lowPower} or Less Package`,
      supportReason: `Low-power creatures and low-power payoffs are the material this commander asks for.`,
      supportTarget: 14,
      coreTarget: 7,
      askMatcher: () => true,
      supportMatcher: (deckCard) => creaturePower(deckCard.card) !== null && (creaturePower(deckCard.card) ?? 99) <= lowPower,
    });
  }

  const highPower = extractNumber(commanderText, /\bpower (\d+) or greater\b/);
  if (highPower !== null || /\bgreatest power\b|\btotal power\b|\bferocious\b/.test(commanderText)) {
    const threshold = highPower ?? 4;
    rules.push({
      key: "power_matter",
      label: `High-Power Creature Package`,
      supportReason: "High-power creatures and power-scaling payoffs are the material this commander asks for.",
      supportTarget: 14,
      coreTarget: 7,
      askMatcher: () => true,
      supportMatcher: (deckCard) =>
        (creaturePower(deckCard.card) !== null && (creaturePower(deckCard.card) ?? 0) >= threshold) ||
        /\bgreatest power\b|\btotal power\b|\bpower among\b/.test(getCardText(deckCard.card)),
    });
  }

  const lowManaValue = extractNumber(commanderText, /\bmana value (\d+) or less\b/);
  const highManaValue = extractNumber(commanderText, /\bmana value (\d+) or greater\b/);
  if (lowManaValue !== null || highManaValue !== null || /\bgreatest mana value\b/.test(commanderText)) {
    const threshold = lowManaValue ?? highManaValue ?? 5;
    const lowProfile = lowManaValue !== null;
    rules.push({
      key: "mana_value_matter",
      label: lowProfile ? `Mana Value ${threshold} or Less Package` : "High-Mana-Value Package",
      supportReason: lowProfile
        ? "Cheap spells that satisfy the commander's mana-value restriction are the material this commander asks for."
        : "Large spells and mana-value payoffs are the material this commander asks for.",
      supportTarget: lowProfile ? 18 : 12,
      coreTarget: lowProfile ? 10 : 6,
      askMatcher: () => true,
      supportMatcher: (deckCard) =>
        !hasCardType(deckCard.card, "Land") &&
        (lowProfile ? deckCard.card.cmc <= threshold : deckCard.card.cmc >= threshold),
    });
  }

  return rules;
}

function getProfileMissingPieces(
  rule: CommanderProfileRule,
  supportCount: number,
  coreCount: number,
  coreTarget: number,
) {
  const missing = [...(rule.missingPieces ?? [])];
  if (supportCount < rule.supportTarget) {
    missing.unshift(`More ${rule.label.toLowerCase()} support`);
  }
  if (coreCount < coreTarget) {
    missing.unshift("More true core pieces");
  }
  return [...new Set(missing)].slice(0, 3);
}

function scoreProfileConfidence(
  supportCount: number,
  supportTarget: number,
  coreCount: number,
  coreTarget: number,
) {
  const supportRatio = Math.min(1.2, supportCount / Math.max(1, supportTarget));
  const coreRatio = Math.min(1.2, coreCount / Math.max(1, coreTarget));
  return roundTo(Math.min(100, 18 + supportRatio * 58 + coreRatio * 24), 0);
}

function dedupeCommanderProfiles(profiles: DeckCommanderProfile[]) {
  const bestByKey = new Map<string, DeckCommanderProfile>();
  for (const profile of profiles) {
    const key = `${normalizeText(profile.commanderName)}:${profile.key}:${normalizeText(profile.label)}`;
    const existing = bestByKey.get(key);
    if (!existing || profile.confidence > existing.confidence) {
      bestByKey.set(key, profile);
    }
  }
  return [...bestByKey.values()];
}

function getCardText(card: ScryfallCard) {
  if (card.card_faces?.length) {
    return normalizeText(
      card.card_faces
        .map((face) => `${face.type_line ?? ""} ${face.oracle_text ?? ""}`)
        .join(" "),
    );
  }
  return normalizeText(`${card.type_line} ${card.oracle_text ?? ""} ${card.keywords.join(" ")}`);
}

function getCreatureTypeCounts(deckCards: ResolvedDeckCard[]) {
  const counts = new Map<string, number>();
  for (const deckCard of deckCards) {
    if (!hasCardType(deckCard.card, "Creature")) {
      continue;
    }
    for (const type of getCreatureTypes(deckCard.card)) {
      counts.set(type, (counts.get(type) ?? 0) + deckCard.quantity);
    }
  }
  return counts;
}

function getCreatureTypes(card: ScryfallCard) {
  const typeLine = card.card_faces?.find((face) => face.type_line?.includes("Creature"))?.type_line ?? card.type_line;
  const [, subtypeText = ""] = typeLine.split(/\s+[—-]\s+/);
  return subtypeText
    .split(/\s+/)
    .map((type) => normalizeText(type))
    .filter((type) => type && !["token", "legendary", "artifact", "enchantment"].includes(type));
}

function extractRequestedCreatureTypes(text: string, creatureTypes: Map<string, number>) {
  const requested: string[] = [];
  for (const [type, count] of creatureTypes) {
    if (count < 5 || type.length < 3) {
      continue;
    }
    const pattern = new RegExp(`\\b${escapeRegex(type)}s?\\b[^.]{0,120}\\b(?:you control|spell|spells|card|cards|attack|attacks|deals|enters|dies|draw|create|costs?|have|gain)\\b|\\b(?:whenever|if|as)\\b[^.]{0,100}\\b${escapeRegex(type)}s?\\b`);
    if (pattern.test(text)) {
      requested.push(type);
    }
  }
  return requested.slice(0, 2);
}

function hasCardType(card: ScryfallCard, type: string) {
  return card.type_line.includes(type) || !!card.card_faces?.some((face) => face.type_line?.includes(type));
}

function hasSubtype(card: ScryfallCard, subtype: string) {
  const pattern = new RegExp(`(?:^|\\s|—)${escapeRegex(subtype)}(?:\\s|$)`, "i");
  return pattern.test(card.type_line) || !!card.card_faces?.some((face) => pattern.test(face.type_line ?? ""));
}

function hasCreatureType(card: ScryfallCard, type: string) {
  return getCreatureTypes(card).includes(type);
}

function hasFaceDownText(text: string, card: ScryfallCard) {
  return (
    /\bface-down\b|\bface up\b|\bturned face up\b|\bmorph\b|\bmegamorph\b|\bmanifest\b|\bcloak\b|\bdisguise\b/.test(text) ||
    card.keywords.some((keyword) => ["Morph", "Megamorph", "Manifest", "Cloak", "Disguise"].includes(keyword))
  );
}

function hasHighToughness(card: ScryfallCard) {
  const toughness = Number.parseInt(card.toughness ?? "", 10);
  const power = Number.parseInt(card.power ?? "", 10);
  return Number.isFinite(toughness) && toughness >= 4 && (!Number.isFinite(power) || toughness >= power + 2);
}

function creaturePower(card: ScryfallCard) {
  if (!hasCardType(card, "Creature")) {
    return null;
  }
  const value = Number.parseInt(card.power ?? "", 10);
  return Number.isFinite(value) ? value : null;
}

function sumQuantities(cards: ResolvedDeckCard[]) {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}

function extractNumber(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  if (!match?.[1]) {
    return null;
  }
  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

function formatType(type: string) {
  return type.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[−–—]/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
