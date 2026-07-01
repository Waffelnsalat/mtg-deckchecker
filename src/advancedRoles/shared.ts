import { ScryfallCard } from "../types";

export function getCardOracleText(card: ScryfallCard) {
  return normalizeText(
    [card.oracle_text ?? "", ...(card.card_faces?.map((face) => face.oracle_text ?? "") ?? [])]
      .filter(Boolean)
      .join(". "),
  );
}

export function hasCardType(card: ScryfallCard, typeName: string) {
  if (card.type_line.includes(typeName)) {
    return true;
  }

  return card.card_faces?.some((face) => face.type_line?.includes(typeName)) ?? false;
}

export function normalizeText(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeKeyword(keyword: string) {
  return keyword
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasDiceText(text: string) {
  return (
    /\broll(?:s|ed|ing)?\b[\s\S]{0,100}\b(?:die|dice|d\d+)\b/.test(text) ||
    /\bwhenever you roll\b/.test(text) ||
    /\bif you would roll\b/.test(text) ||
    /\bd20\b|\bd12\b|\bd10\b|\bd8\b|\bd6\b|\bd4\b/.test(text)
  );
}

export function hasCoinFlipText(text: string) {
  return (
    /\bflip(?:s|ped|ping)?\b[\s\S]{0,80}\bcoins?\b/.test(text) ||
    /\bcoin flips?\b|\bwin(?:s|ning)? a flip\b|\blose(?:s|ing)? a flip\b/.test(text) ||
    /\bif you would flip\b/.test(text)
  );
}

export function hasReplacementText(text: string) {
  return (
    /\bif\b[\s\S]{0,180}\bwould\b[\s\S]{0,180}\binstead\b/.test(text) ||
    /\breplacement effect\b/.test(text) ||
    /\bas though\b/.test(text) ||
    /\btriggered ability\b[\s\S]{0,120}\btriggers? an additional time\b/.test(text) ||
    /\bignore (?:the|one of those)\b[\s\S]{0,80}\b(?:rolls?|flips?)\b/.test(text)
  );
}

export function hasDoublerOrMultiplierText(text: string) {
  return (
    /\bif\b[\s\S]{0,180}\bwould\b[\s\S]{0,180}\b(?:twice|double|additional)\b[\s\S]{0,140}\binstead\b/.test(text) ||
    /\btriggers? an additional time\b/.test(text) ||
    /\btriggered ability\b[\s\S]{0,160}\btriggers?[^.]{0,80}\badditional time\b/.test(text) ||
    /\b(?:double|doubles?)\b[^.]{0,160}\b(?:counters?|tokens?|mana|power|toughness|damage|life|life total)\b/.test(text) ||
    /\btwice (?:that many|the number|as much)\b/.test(text) ||
    /\badditional (?:time|counter|token|mana|combat phase|copy)\b/.test(text)
  );
}

export function hasTopLibraryFilteringText(text: string) {
  return (
    /\blook at the top (?:x|\d+|one|two|three|four|five|six|seven|a|an) cards? of your library\b[\s\S]{0,180}\bput (?:them|those cards|the rest|any number of them|that card|it)\b[\s\S]{0,120}\b(?:back|on top|on the bottom|into your graveyard)\b/.test(
      text,
    ) ||
    /\bexile any number of cards from your hand face down\b[\s\S]{0,220}\bput that many cards from the top of your library into your hand\b[\s\S]{0,220}\bput (?:them|the exiled cards) on top of your library in any order\b/.test(
      text,
    ) ||
    /\brearrange\b[\s\S]{0,120}\btop (?:x|\d+|one|two|three|four|five|six|seven|a|an) cards? of your library\b/.test(
      text,
    )
  );
}

export function hasLandAnimationText(text: string) {
  return (
    /\ball lands are \d+\/\d+ creatures\b/.test(text) ||
    /\btarget land becomes a \d+\/\d+ creature\b/.test(text) ||
    /\btarget land becomes a \d+\/\d+ creature that'?s still a land\b/.test(text)
  );
}

export function hasSelfReplacingTopDrawText(text: string) {
  return /\bdraw a card\b[^.]{0,120}\bput [^.]{0,100}\bon top of (?:its|your) owner'?s library\b/.test(
    text,
  );
}

export function hasSelfContainedGraveyardCastText(text: string) {
  return (
    /\byou may cast this card from your graveyard\b/.test(text) ||
    (/\bflashback\b/.test(text) &&
      !/\btarget\b[^.]{0,120}\bcard in your graveyard\b[^.]{0,180}\bgains flashback\b/.test(
        text,
      ) &&
      !/\bcards? in your graveyard\b[^.]{0,180}\b(?:has|have|gains?) flashback\b/.test(text))
  );
}

export function hasFaceDownPurposeText(text: string, keywords: string[] = []) {
  return (
    /\bface-down\b|\bface down\b|\bface-up\b|\bface up\b|\bturned face up\b|\bturn\b[\s\S]{0,80}\bface (?:up|down)\b/.test(text) ||
    /\bturned\b[\s\S]{0,80}\bface up\b/.test(text) ||
    /\b(?:morph|megamorph|manifest|manifest dread|cloak|disguise|cloak it|cloak that card)\b/.test(text) ||
    keywords.some((keyword) =>
      ["Morph", "Megamorph", "Manifest", "Manifest Dread", "Cloak", "Disguise"].includes(keyword),
    )
  );
}

export function hasFlashEnablerText(text: string) {
  return (
    /\byou may cast\b[^.]{0,180}\bas though (?:they|it|those cards?|that card) had flash\b/.test(text) ||
    /\byou may cast spells as though they had flash\b/.test(text) ||
    /\byou may cast\b[^.]{0,80}\bspells?\b[^.]{0,120}\bas though (?:they|it) had flash\b/.test(text) ||
    /\byou may cast\b[^.]{0,180}\bany time you could cast an instant\b/.test(text) ||
    /\b(?:creature|artifact|enchantment|nonland|permanent|historic|legendary|sorcery|planeswalker) spells? you cast have flash\b/.test(text) ||
    /\byou may play\b[^.]{0,180}\bas though (?:they|it|those cards?|that card) had flash\b/.test(text)
  );
}

export function isPermanentCard(card: ScryfallCard) {
  return hasCardType(card, "Artifact") ||
    isCreatureCard(card) ||
    hasCardType(card, "Enchantment") ||
    hasCardType(card, "Planeswalker") ||
    hasCardType(card, "Battle") ||
    hasCardType(card, "Land");
}

export function isCreatureCard(card: ScryfallCard) {
  return hasCardType(card, "Creature") ||
    card.type_line.startsWith("Summon ") ||
    (card.card_faces?.some((face) => face.type_line?.startsWith("Summon ")) ?? false);
}

export function isRepeatableText(text: string, permanent: boolean) {
  if (!permanent) {
    return false;
  }

  return (
    /\{[^}]+\}:/.test(text) ||
    /\bwhenever\b/.test(text) ||
    /\bat the beginning of\b/.test(text) ||
    /\bduring each of your turns\b/.test(text) ||
    /\bequipped creature\b/.test(text) ||
    /\benchanted\b/.test(text) ||
    /\byou may play\b[^.]{0,100}\btop card\b/.test(text) ||
    /\byou may cast\b[^.]{0,100}\btop card\b/.test(text)
  );
}

export function hasCombatKeyword(card: ScryfallCard) {
  const keywords = new Set((card.keywords ?? []).map((keyword) => keyword.toLowerCase()));
  return [
    "flying",
    "first strike",
    "double strike",
    "menace",
    "deathtouch",
    "trample",
    "haste",
    "vigilance",
    "lifelink",
    "reach",
    "banding",
    "skulk",
    "shadow",
    "unblockable",
    "toxic",
    "infect",
  ].some((keyword) => keywords.has(keyword));
}

export function getCacheKey(card: ScryfallCard) {
  return [
    card.id,
    card.name,
    card.oracle_text ?? "",
    card.type_line,
    ...(card.keywords ?? []),
    ...(card.card_faces?.flatMap((face) => [face.name ?? "", face.type_line ?? "", face.oracle_text ?? ""]) ?? []),
  ].join("|");
}

export function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
