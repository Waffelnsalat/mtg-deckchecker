import {
  applyEffectQualityDiscount,
  estimateEffectActivationManaCost,
  estimateEffectDrawbackPenalty,
} from "./activationCost";
import { DeckResolutionDocument, DeckSection, ScryfallCard } from "./types";

export interface CardRoleProfile {
  roles: Set<string>;
  weights: Map<string, number>;
  reasons: Map<string, Set<string>>;
}

export interface AdvancedRoleTaggedCard {
  name: string;
  quantity: number;
  section: DeckSection;
  roleValue: number;
  hits: Array<{
    tag: string;
    weight: number;
    reason: string;
  }>;
}

export interface DeckAdvancedRoleAnalysis {
  taggedCards: AdvancedRoleTaggedCard[];
}

const advancedRoleCache = new Map<string, CardRoleProfile | null>();

export function createCardRoleProfile(): CardRoleProfile {
  return {
    roles: new Set<string>(),
    weights: new Map<string, number>(),
    reasons: new Map<string, Set<string>>(),
  };
}

export function mergeCardRoleProfile(
  target: CardRoleProfile,
  source: CardRoleProfile,
  multiplier = 1,
) {
  for (const role of source.roles) {
    target.roles.add(role);
    const sourceWeight = source.weights.get(role) ?? 0;
    target.weights.set(role, roundTo((target.weights.get(role) ?? 0) + sourceWeight * multiplier, 2));
    const sourceReasons = source.reasons.get(role);
    if (!sourceReasons?.size) {
      continue;
    }

    const targetReasons = target.reasons.get(role) ?? new Set<string>();
    sourceReasons.forEach((reason) => targetReasons.add(reason));
    target.reasons.set(role, targetReasons);
  }
}

export function inferAdvancedRoleProfile(card: ScryfallCard) {
  const cacheKey = getCacheKey(card);
  const cached = advancedRoleCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const text = getCardOracleText(card);
  const profile = createCardRoleProfile();
  const permanent = isPermanentCard(card);
  const land = hasCardType(card, "Land");
  const equipment = hasCardType(card, "Equipment");

  detectAdvancedDrawRoles(profile, text, permanent);
  detectAdvancedRampRoles(profile, text, permanent, land);
  detectAdvancedTutorRoles(profile, text, permanent);
  detectAdvancedRemovalRoles(profile, text);
  detectAdvancedStackRoles(profile, text);
  detectAdvancedProtectionRoles(profile, text, permanent, equipment);
  detectAdvancedRecursionRoles(profile, text, permanent);
  detectAdvancedFinisherRoles(profile, text, permanent, card.keywords ?? []);
  detectAdvancedPurposeRoles(profile, text, card);
  detectAdvancedScalableSpellRoles(profile, text, card);
  applyEffectQualityDiscountToProfile(profile, text);

  const result = profile.roles.size > 0 ? profile : null;
  advancedRoleCache.set(cacheKey, result);
  return result;
}

export function getRoleWeight(profile: CardRoleProfile | null | undefined, role: string) {
  return profile?.weights.get(role) ?? 0;
}

export function getRoleReason(profile: CardRoleProfile | null | undefined, role: string) {
  return [...(profile?.reasons.get(role) ?? [])].join(" ");
}

export function analyzeDeckAdvancedRoles(document: DeckResolutionDocument): DeckAdvancedRoleAnalysis {
  const taggedCards = document.result.resolvedCards
    .map((entry): AdvancedRoleTaggedCard | null => {
      const profile = inferAdvancedRoleProfile(entry.card);
      if (!profile) {
        return null;
      }

      const hits = [...profile.roles]
        .map((role) => ({
          tag: role,
          weight: profile.weights.get(role) ?? 0,
          reason: getRoleReason(profile, role),
        }))
        .filter((hit) => hit.weight > 0)
        .sort((left, right) => right.weight - left.weight || left.tag.localeCompare(right.tag));

      if (hits.length === 0) {
        return null;
      }

      return {
        name: entry.card.name,
        quantity: entry.quantity,
        section: entry.section,
        roleValue: roundTo(Math.max(...hits.map((hit) => hit.weight)), 2),
        hits,
      };
    })
    .filter((card): card is AdvancedRoleTaggedCard => card !== null);

  return { taggedCards };
}

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

function addRole(profile: CardRoleProfile, role: string, weight: number, reason: string) {
  profile.roles.add(role);
  profile.weights.set(role, roundTo(Math.max(profile.weights.get(role) ?? 0, weight), 2));
  const reasons = profile.reasons.get(role) ?? new Set<string>();
  reasons.add(reason);
  profile.reasons.set(role, reasons);
}

function applyEffectQualityDiscountToProfile(profile: CardRoleProfile, text: string) {
  if (estimateEffectActivationManaCost(text) <= 0 && estimateEffectDrawbackPenalty(text) <= 0) {
    return;
  }

  for (const [role, weight] of profile.weights) {
    profile.weights.set(role, roundTo(applyEffectQualityDiscount(weight, text), 2));
    const reasons = profile.reasons.get(role) ?? new Set<string>();
    reasons.add("Mana costs or drawbacks attached to the effect lower its practical value.");
    profile.reasons.set(role, reasons);
  }
}

function detectAdvancedDrawRoles(profile: CardRoleProfile, text: string, permanent: boolean) {
  const repeatable = isRepeatableText(text, permanent);
  const opponentOnlyDraw =
    /\b(?:target opponent|defending player|that player|its controller) may draw\b/.test(text) &&
    !/\byou (?:may )?draw\b|\beach player (?:may )?draws?\b|\ban opponent chooses one\b[\s\S]{0,120}\byou draw\b/.test(
      text,
    );
  const delayedNextTurnDraw =
    /\bdraw (?:a card|one|two|three|four|five|six|seven|eight|nine|ten|\d+ cards?)\b[^.]{0,100}\bat the beginning of the next turn'?s upkeep\b/.test(
      text,
    );
  const oneShotDrawTrigger =
    /\bwhen\b[^.]{0,120}\b(?:enters(?: the battlefield)?|dies|leaves the battlefield)\b[^.]{0,160}\bdraw(?:s)?\b/.test(
      text,
    );
  const hasImpulseAccess =
    /\bexile the top\b.{0,180}\byou may (?:play|cast)\b/.test(text) ||
    /\blook at the top\b.{0,120}\byou may (?:play|cast)\b/.test(text);
  const hasRevealCastAccess =
    /\breveal the top card of your library\b.{0,180}\byou may (?:play|cast)\b/.test(text) ||
    /\breveal\b.{0,60}\btop card of your library\b.{0,180}\byou may cast that card\b/.test(text);
  const hasTopdeckAccess =
    /\bplay with the top card of your library revealed\b/.test(text) ||
    /\byou may look at the top card of your library\b/.test(text) ||
    /\byou may (?:play|cast)\b[^.]{0,100}\btop card of your library\b/.test(text);
  const hasGraveyardAccess =
    !hasSelfContainedGraveyardCastText(text) &&
    (/\byou may (?:play|cast)\b[^.]{0,120}\bfrom your graveyard\b/.test(text) ||
      /\bduring each of your turns, you may play\b[^.]{0,120}\bfrom your graveyard\b/.test(text) ||
      /\byou may play\b[^.]{0,120}\bcards? exiled with\b/.test(text));
  const hasExileCastAccess =
    /\byou may cast\b[^.]{0,220}\b(?:card|one of them|that card|it)\b[^.]{0,140}\bwithout paying (?:its|their) mana cost\b/.test(text) ||
    /\byou may cast\b[^.]{0,220}\bspells? from among\b[^.]{0,180}\bexiled this way\b/.test(text) ||
    /\bexile\b[^.]{0,200}\b(?:instant or sorcery card|card)\b[^.]{0,200}\byou may cast that card\b/.test(text) ||
    /\bcards? exiled with\b[^.]{0,160}\byou may cast\b/.test(text);
  const hasLibraryDigSelection =
    /\b(?:look at|reveal|mill)\b[\s\S]{0,180}\bput\b[\s\S]{0,160}\b(?:from among them|from among those cards|from among the revealed cards|from among the cards revealed this way|from among the milled cards|from among the cards milled this way|from among cards milled this way)\b[\s\S]{0,160}\b(?:into your hand|onto the battlefield)\b/.test(text) ||
    /\bput\b[\s\S]{0,160}\b(?:from among them|from among those cards|from among the revealed cards|from among the cards revealed this way|from among the milled cards|from among the cards milled this way|from among cards milled this way)\b[\s\S]{0,160}\b(?:into your hand|onto the battlefield)\b/.test(text) ||
    /\breveal cards? from the top of your library until\b[\s\S]{0,220}\bput (?:that card|it|one of them|those cards)\b[\s\S]{0,120}\b(?:into your hand|onto the battlefield)\b/.test(text) ||
    /\bexile cards? from the top of your library until\b[\s\S]{0,260}\bput (?:that card|it|one of them|those cards?|those [a-z]+ cards?|the exiled cards?)\b[\s\S]{0,160}\b(?:into your hand|onto the battlefield)\b/.test(text) ||
    /\blook at the top (?:x|\d+|[a-z]+) cards? of your library\b[\s\S]{0,180}\bput one of those cards on top of your library\b/.test(text);
  const hasTopLibraryFiltering = hasTopLibraryFilteringText(text);
  const hasSelfReplacingTopDraw = hasSelfReplacingTopDrawText(text);

  if (hasImpulseAccess || hasRevealCastAccess) {
    addRole(profile, "draw", 1, "Advanced scan recognized repeatable or delayed impulse card flow.");
    addRole(profile, "direct_draw", 0.72, "Advanced scan recognized impulse access as practical card flow.");
    addRole(profile, "selection", 0.78, "Advanced scan recognized extra card access outside the hand.");
    if (repeatable) {
      addRole(profile, "repeatable_draw", 0.88, "Advanced scan recognized recurring impulse card advantage.");
      addRole(profile, "repeatable_advantage", 0.86, "Advanced scan recognized a repeatable card-flow engine.");
    }
  } else {
    if (
      (
        /\bdraw (?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x)\b/.test(text) ||
        /\b(?:you|each player) draws? up to (?:one|two|three|four|five|six|seven|eight|nine|ten|\d+) cards?\b/.test(text)
      ) &&
      !opponentOnlyDraw &&
      !/\bif you would draw\b/.test(text) &&
      !/\bwhenever (?:you|a player|an opponent|one or more players) draw\b/.test(text) &&
      !hasSelfReplacingTopDraw
    ) {
      addRole(profile, "draw", 0.92, "Advanced scan recognized direct card draw.");
      addRole(profile, "direct_draw", 0.76, "Advanced scan recognized direct card draw.");
      if (repeatable && !delayedNextTurnDraw && !oneShotDrawTrigger) {
        addRole(profile, "repeatable_draw", 0.64, "Advanced scan recognized recurring draw text.");
      }
    }

    if (/\binvestigate\b|\bcreate (?:a|one|two|three|x|\d+) clue token/.test(text)) {
      addRole(profile, "draw", 0.72, "Advanced scan recognized Clue-based delayed card draw.");
      addRole(profile, "selection", 0.42, "Advanced scan recognized Clue-based card access.");
      if (repeatable) {
        addRole(profile, "repeatable_draw", 0.44, "Advanced scan recognized recurring Clue generation.");
        addRole(profile, "repeatable_advantage", 0.42, "Advanced scan recognized a recurring Clue engine.");
      }
    }

    if (/\bdraw\b[^.]{0,80}\bdiscard\b|\bdiscard\b[^.]{0,80}\bdraw\b/.test(text)) {
      addRole(profile, "selection", 0.62, "Advanced scan recognized looting-style card selection.");
      if (repeatable && !oneShotDrawTrigger) {
        addRole(profile, "repeatable_advantage", 0.36, "Advanced scan recognized recurring looting as a small engine.");
      }
    }

    if (/\bdraw cards? (?:and lose life )?equal to\b/.test(text)) {
      addRole(profile, "draw", 0.84, "Advanced scan recognized scalable card draw.");
      addRole(profile, "direct_draw", 0.78, "Advanced scan recognized scalable card draw.");
    }
  }

  if (hasTopdeckAccess || hasGraveyardAccess || hasExileCastAccess) {
    addRole(profile, "selection", 0.7, "Advanced scan recognized ongoing access to extra cards.");
    if (repeatable || hasExileCastAccess) {
      addRole(profile, "repeatable_draw", 0.72, "Advanced scan recognized a lasting card-access engine.");
      addRole(profile, "repeatable_advantage", 0.76, "Advanced scan recognized a repeatable value engine.");
    }
  }

  if (hasLibraryDigSelection) {
    addRole(profile, "draw", 0.58, "Advanced scan recognized library dig as card access.");
    addRole(profile, "selection", 0.74, "Advanced scan recognized library dig selection.");
    if (repeatable) {
      addRole(profile, "repeatable_advantage", 0.52, "Advanced scan recognized repeatable library dig selection.");
    }
  }

  if (hasTopLibraryFiltering) {
    addRole(
      profile,
      "selection",
      permanent ? 0.62 : 0.54,
      "Advanced scan recognized top-of-library filtering.",
    );
  }
}

function detectAdvancedRampRoles(
  profile: CardRoleProfile,
  text: string,
  permanent: boolean,
  land: boolean,
) {
  const anyColor = /\badd\b[^.]{0,40}\bone mana of any color\b/.test(text);
  const chosenColor = /\badd\b[^.]{0,40}\bone mana of the chosen color\b/.test(text);
  const multicolor = /\badd\b[^.]{0,40}\{[wubrg]\}\s*or\s*\{[wubrg]\}/.test(text);
  const sacrificeMana = /\bsacrifice\b[^.]{0,80}\badd\b[^.]{0,40}\{[wubrgc]/.test(text);
  const handExileMana =
    /\bexile\b[^.]{0,120}\bfrom your hand\b[^.]{0,80}\badd\b[^.]{0,40}\{[wubrgc]/.test(text) ||
    /\bexile\b[^.]{0,80}\bthis card from your hand\b[^.]{0,80}\badd\b/.test(text);
  const reusableMana =
    permanent &&
    /\{[^}]+\}:\s*add\b/.test(text) &&
    !sacrificeMana &&
    !handExileMana;
  const landSearchToBattlefield =
    /\bsearch(?:es)?\b[^.]{0,220}\b(?:your|their|his or her) library\b[^.]{0,220}\bfor\b[^.]{0,160}\bland cards?\b[^.]{0,120}\bonto the battlefield\b/.test(text) ||
    /\bsearch(?:es)?\b[^.]{0,220}\byour library\b[^.]{0,220}\bfor\b[^.]{0,160}\b(?:forest|plains|island|swamp|mountain)\b[^.]{0,120}\bonto the battlefield\b/.test(text);
  const unrestrictedLandSearchToBattlefield =
    landSearchToBattlefield &&
    /\bfor\b[^.]{0,180}\b(?:any number of\b[^.]{0,120})?land cards?\b/.test(text) &&
    !/\bbasic land cards?\b/.test(text);
  const landSearchToHand =
    /\bsearch(?:es)?\b[^.]{0,220}\byour library\b[^.]{0,220}\bfor\b[^.]{0,160}\bland card\b[^.]{0,120}\binto your hand\b/.test(text) ||
    /\bsearch(?:es)?\b[^.]{0,220}\byour library\b[^.]{0,220}\bfor\b[^.]{0,160}\b(?:forest|plains|island|swamp|mountain)\b[^.]{0,120}\binto your hand\b/.test(text);
  const extraLandPlays =
    /\byou may play\b[^.]{0,60}\ban additional land\b/.test(text) ||
    /\byou can play\b[^.]{0,60}\ban additional land\b/.test(text) ||
    /\byou may play any number of lands\b/.test(text);
  const handLandAcceleration =
    /\bput\b[^.]{0,120}\ba land card from your hand\b[^.]{0,80}\bonto the battlefield\b/.test(text) ||
    /\bput any number of land cards\b[^.]{0,160}\bonto the battlefield\b/.test(text);
  const landCopyMana =
    /\benter as a copy of any land\b/.test(text) ||
    /\bbecomes a copy of target\b[^.]{0,120}\bland\b/.test(text);
  const costReduction =
    /\bspells? you cast\b[^.]{0,80}\bcosts?\b[^.]{0,40}\bless to cast\b/.test(text) ||
    /\b(?:artifact|creature|instant|sorcery|enchantment|legendary|historic|dragon|face-down creature)\s+spells? you cast\b[^.]{0,80}\bcosts?\b[^.]{0,40}\bless to cast\b/.test(text) ||
    /\b[a-z-]+(?: [a-z-]+){0,4} spells? you cast\b[^.]{0,100}\bcosts?\b[^.]{0,50}\bless to cast\b/.test(text) ||
    /\b(?:activated )?abilities\b[^.]{0,80}\bcost \{[^}]+\} less to activate\b/.test(text) ||
    /\byou may pay\b[^.]{0,80}\brather than pay (?:the )?mana cost\b/.test(text);
  const handCheatMana =
    /\bput\b[^.]{0,140}\b(?:artifact|creature|enchantment|permanent) card from your hand\b[^.]{0,100}\bonto the battlefield\b/.test(text) ||
    /\bput\b[^.]{0,140}\b(?:a|an|target|that|the)?\s*(?:artifact|creature|enchantment|permanent|nonland permanent) card\b[^.]{0,180}\bfrom (?:your hand|among them|among those cards|the top .*? of your library)\b[^.]{0,120}\bonto the battlefield\b/.test(text) ||
    /\byou may put\b[^.]{0,180}\b(?:artifact|creature|enchantment|permanent|nonland permanent) card\b[^.]{0,180}\bonto the battlefield\b/.test(text) ||
    /\breveal cards? from the top of your library until\b[\s\S]{0,220}\bput those cards onto the battlefield\b/.test(text);
  const untapManaEngine =
    /\buntap all (?:nonland permanents|artifacts|lands) you control\b/.test(text) ||
    /\buntap all permanents you control during each other player'?s untap step\b/.test(text) ||
    /\bduring each other player's untap step\b[^.]{0,160}\buntap\b/.test(text);
  const manaToken =
    /\bcreate\b[^.]{0,80}\b(?:treasure|lotus|gold)\b[^.]{0,80}\btoken/.test(text) ||
    /\bcreate\b[^.]{0,80}\btoken\b[^.]{0,120}\badd one mana\b/.test(text);
  const burstMana =
    /\badd\b[^.]{0,40}\{[wubrgc]/.test(text) &&
    (!permanent || sacrificeMana || handExileMana || /\buntil end of turn\b/.test(text));

  if (reusableMana && !land) {
    addRole(profile, "ramp", 0.82, "Advanced scan recognized a reusable mana source.");
    addRole(profile, "stable_ramp", 0.82, "Advanced scan recognized stable mana acceleration.");
  }

  if (landSearchToBattlefield) {
    addRole(profile, "ramp", 0.9, "Advanced scan recognized land ramp to the battlefield.");
    addRole(profile, "land_acceleration", 0.9, "Advanced scan recognized land acceleration.");
    if (unrestrictedLandSearchToBattlefield) {
      addRole(profile, "mana_fixing", 0.72, "Advanced scan recognized unrestricted land search as fixing.");
    }
  }

  if (landSearchToHand || extraLandPlays || handLandAcceleration) {
    addRole(profile, "ramp", 0.68, "Advanced scan recognized slower land-based acceleration.");
    addRole(profile, "land_acceleration", 0.68, "Advanced scan recognized slower land acceleration.");
  }

  if (landCopyMana) {
    addRole(profile, "ramp", 0.54, "Advanced scan recognized land-copy mana utility.");
    addRole(profile, "mana_fixing", 0.48, "Advanced scan recognized land-copy fixing utility.");
  }

  if (/\bif you tap a land you control for mana\b[^.]{0,120}\bit produces \{[wubrg]\} instead\b/.test(text)) {
    addRole(profile, "ramp", 0.28, "Advanced scan recognized land mana conversion.");
    addRole(profile, "mana_fixing", 0.5, "Advanced scan recognized land mana conversion.");
  }

  if (burstMana || handExileMana || manaToken) {
    addRole(profile, "ramp", 0.72, "Advanced scan recognized temporary mana acceleration.");
    addRole(profile, "burst_ramp", handExileMana ? 0.82 : 0.74, "Advanced scan recognized burst mana.");
  }

  if (costReduction || handCheatMana) {
    addRole(profile, "ramp", 0.62, "Advanced scan recognized mana-equivalent cost reduction.");
    addRole(
      profile,
      "cost_reduction",
      handCheatMana ? 0.64 : 0.72,
      handCheatMana
        ? "Advanced scan recognized cheating cards from hand as mana-equivalent acceleration."
        : "Advanced scan recognized cost reduction.",
    );
  }

  if (untapManaEngine) {
    const allLandUntap = /\buntap all lands you control\b/.test(text);
    addRole(
      profile,
      "ramp",
      allLandUntap ? 0.82 : 0.58,
      "Advanced scan recognized repeatable untap-based mana advantage.",
    );
    addRole(
      profile,
      "stable_ramp",
      allLandUntap ? 0.78 : 0.54,
      "Advanced scan recognized repeatable untap-based mana advantage.",
    );
  }

  if ((anyColor || chosenColor || multicolor || manaToken) && !land && (reusableMana || landSearchToBattlefield || landSearchToHand || manaToken)) {
    addRole(profile, "mana_fixing", 0.72, "Advanced scan recognized flexible color access.");
  }
}

function detectAdvancedTutorRoles(profile: CardRoleProfile, text: string, permanent: boolean) {
  const librarySearch =
    /\bsearch(?:es)?\b[^.]{0,220}\b(?:your|their|his or her) library\b/.test(text);
  const libraryDig =
    /\b(?:look at|reveal|mill)\b[\s\S]{0,180}\bput\b[\s\S]{0,160}\b(?:from among them|from among those cards|from among the revealed cards|from among the cards revealed this way|from among the milled cards|from among the cards milled this way|from among cards milled this way)\b[\s\S]{0,160}\b(?:into your hand|onto the battlefield)\b/.test(text) ||
    /\bput\b[\s\S]{0,160}\b(?:from among them|from among those cards|from among the revealed cards|from among the cards revealed this way|from among the milled cards|from among the cards milled this way|from among cards milled this way)\b[\s\S]{0,160}\b(?:into your hand|onto the battlefield)\b/.test(text) ||
    /\breveal cards? from the top of your library until\b[\s\S]{0,220}\bput (?:that card|it|one of them)\b[\s\S]{0,120}\b(?:into your hand|onto the battlefield)\b/.test(text) ||
    /\bexile cards? from the top of your library until\b[\s\S]{0,260}\bput (?:that card|it|one of them|those cards?|those [a-z]+ cards?|the exiled cards?)\b[\s\S]{0,160}\b(?:into your hand|onto the battlefield)\b/.test(text);
  const symmetricTopdeckTutor =
    /\bchoose\b[^.]{0,80}\btarget players?\b[\s\S]{0,180}\beach of them searches (?:their|his or her) library for a card\b[\s\S]{0,180}\bputs? that card on top\b/.test(
      text,
    );

  if (!librarySearch && !libraryDig && !symmetricTopdeckTutor) {
    return;
  }

  const repeatable =
    permanent &&
    (/\{[^}]+\}:\s*search(?:es)?\b[^.]{0,180}\byour library\b/.test(text) ||
      /\b(?:whenever|at the beginning of|during each of your turns|whenever .* attacks)\b[^.]{0,220}\bsearch(?:es)?\b[^.]{0,180}\byour library\b/.test(text));
  const landTutor =
    /\bfor\b[^.]{0,160}\bland cards?\b/.test(text) ||
    /\bfor\b[^.]{0,160}\b(?:forest|plains|island|swamp|mountain|desert|gate|cave|locus)\b/.test(text);
  const restrictedTutor =
    /\bfor\b[^.]{0,170}\b(?:artifact|creature|enchantment|instant|sorcery|planeswalker|battle|equipment|aura|permanent|legendary|historic|dragon|wizard|elf|goblin|vampire|zombie|sliver)\s+card\b/.test(text) ||
    /\bfor\b[^.]{0,220}\b(?:artifact|creature|enchantment|instant|sorcery|planeswalker|battle|equipment|aura|permanent|legendary|historic|dragon|wizard|elf|goblin|vampire|zombie|sliver)\b[^.]{0,120}\bcards?\b/.test(text) ||
    /\bfor\b[^.]{0,170}\bcard with\b/.test(text) ||
    /\bfor\b[^.]{0,170}\bcard named\b/.test(text);
  const librarySearchToBattlefield =
    librarySearch &&
    restrictedTutor &&
    /\bsearch(?:es)?\b[\s\S]{0,300}\blibrary\b[\s\S]{0,300}\bfor\b[\s\S]{0,300}\bputs? (?:it|them|that card|those cards?|the cards?)\b[\s\S]{0,120}\bonto the battlefield\b/.test(text);

  if (symmetricTopdeckTutor) {
    addRole(profile, "tutor", 0.62, "Advanced scan recognized a symmetric top-of-library tutor.");
    addRole(profile, "direct_tutor", 0.6, "Advanced scan recognized a symmetric top-of-library tutor.");
  } else if (libraryDig) {
    addRole(profile, "tutor", 0.56, "Advanced scan recognized library dig as restricted card access.");
    addRole(profile, "restricted_tutor", 0.58, "Advanced scan recognized library dig as restricted card access.");
  } else if (restrictedTutor) {
    addRole(profile, "tutor", 0.86, "Advanced scan recognized a restricted tutor.");
    addRole(profile, "restricted_tutor", 0.84, "Advanced scan recognized a restricted tutor.");
  } else if (landTutor) {
    addRole(profile, "tutor", 0.72, "Advanced scan recognized a land tutor.");
    addRole(profile, "land_tutor", 0.76, "Advanced scan recognized a land tutor.");
  } else {
    addRole(profile, "tutor", 1, "Advanced scan recognized a broad tutor.");
    addRole(profile, "direct_tutor", 1, "Advanced scan recognized a broad tutor.");
  }

  if (librarySearchToBattlefield) {
    addRole(profile, "cheat_into_play", 0.72, "Advanced scan recognized searched nonland cards entering the battlefield.");
    addRole(profile, "cost_reduction", 0.52, "Advanced scan recognized searched cards entering the battlefield as mana-equivalent setup.");
  }

  if (repeatable) {
    addRole(profile, "repeatable_tutor", 0.82, "Advanced scan recognized repeatable access to searched cards.");
  }
}

function detectAdvancedRemovalRoles(profile: CardRoleProfile, text: string) {
  const exchangeControl =
    /\bexchange control of\b[^.]{0,220}\b(?:target|two|creature|artifact|enchantment|permanent|spell)\b/.test(text);
  const targetedLandRemoval =
    /\bdestroy target (?:nonbasic |basic |non[- ]?(?:plains|island|swamp|mountain|forest) )?(?:land|plains|island|swamp|mountain|forest)\b/.test(text) ||
    /\bput target land on top of its owner'?s library\b/.test(text) ||
    /\benchanted land\b[^.]{0,160}\bdestroy it\b/.test(text) ||
    /\benchanted land'?s controller\b[^.]{0,160}\bdestroy that land unless that player pays\b/.test(text);
  const targetedWallRemoval = /\bdestroy target wall\b/.test(text);
  const targetedKindredRemoval = /\bdestroy target (?:djinn|efreet)\b/.test(text);
  const targetedAuraRemoval = /\bdestroy target aura attached to\b/.test(text);
  const shrinkingAura = /\benchanted creature\b[^.]{0,120}\bgets? -(?:x|\d+)\/-(?:y|\d+)\b/.test(text);
  const powerResetRemoval =
    /\btarget (?:(?:attacking )?creature(?: other than this creature)?|creature with flying)\b[^.]{0,120}\bhas base power (?:and toughness )?0(?:\/\d+)?\b/.test(text);
  const combatTriggeredRemoval =
    /\bwhenever this creature blocks or becomes blocked\b[^.]{0,180}\bdestroy that creature\b/.test(text) ||
    /\bwhenever enchanted creature blocks or becomes blocked\b[^.]{0,180}\bdestroy the other creature\b/.test(text);
  const phaseOutRemoval = /\btarget creature phases out until\b[^.]{0,120}\bleaves the battlefield\b/.test(text);
  const lockdownAura =
    /\benchanted creature doesn't untap during its controller'?s untap step\b/.test(text) ||
    /\bwhen this aura enters\b[^.]{0,120}\btap enchanted creature\b/.test(text);
  const massLandDenial =
    /\bdestroy all (?:nonbasic )?(?:lands|plains|islands|swamps|mountains|forests)\b/.test(text) ||
    /\bfor each land\b[^.]{0,80}\bdestroy that land unless any player pays\b/.test(text) ||
    /\bexile all lands\b/.test(text) ||
    /\breturn all lands to (?:their owners'|owners'|their owner's) hands\b/.test(text) ||
    /\beach player sacrifices all lands\b/.test(text) ||
    /\bplayers can't play lands\b/.test(text) ||
    /\blands don't untap during their controllers' untap steps\b/.test(text) ||
    /\b(?:plains|islands|swamps|mountains|forests)\b[^.]{0,120}\bdon't untap during their controllers'? untap steps\b/.test(text);
  const chosenRemoval =
    /\b(?:choose|chooses)\b[^.]{0,160}\b(?:creature|artifact|enchantment|planeswalker|battle|permanent)\b/.test(text) &&
    /\b(?:destroy|exile)\b[^.]{0,80}\b(?:the chosen|those|them|it)\b/.test(text);
  const leastPowerRemoval = /\bdestroy the creature with the least power\b/.test(text);
  const auraNeutralization =
    /\benchant (?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b/.test(text) &&
    (
      /\benchanted (?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b[^.]{0,180}\bloses all abilities\b/.test(text) ||
      /\benchanted (?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b[^.]{0,180}\bis (?:a|an)\b[^.]{0,120}\b(?:land|forest|treasure|insect|frog|elk|coward)\b/.test(text) ||
      /\benchanted (?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b[^.]{0,180}\bcan't attack or block\b/.test(text)
    );
  const edictRemoval =
    /\b(?:target (?:player|opponent)|each opponent|each player|each other player|for each opponent)\b[^.]{0,180}\bsacrifices?\b[^.]{0,120}\b(?:creatures?|artifacts?|enchantments?|planeswalkers?|battles?|permanents?|tokens?)\b/.test(
      text,
    ) &&
    !/\byou sacrifice\b/.test(text);
  const delayedAuraEdict =
    /\bwhen enchanted creature leaves the battlefield\b[^.]{0,140}\bits controller sacrifices a creature\b/.test(text);
  const targetedRemoval =
    /\b(?:destroy|exile)\b[^.]{0,120}\btarget\b[^.]{0,140}\b(?:creature|artifact|enchantment|planeswalker|battle|permanent|nonland permanent)\b/.test(text) ||
    /\btap target creature\b[\s\S]{0,140}\bexile that creature\b/.test(text) ||
    /\bturn target creature face down\b/.test(text) ||
    /\btarget permanent\b[^.]{0,120}\bshuffles? (?:it|itself) into (?:their|its) owner's library\b/.test(text) ||
    /\bthe owner of target permanent\b[^.]{0,120}\bshuffles? it into (?:their|its) library\b/.test(text) ||
    edictRemoval ||
    delayedAuraEdict ||
    auraNeutralization ||
    targetedLandRemoval ||
    targetedWallRemoval ||
    targetedKindredRemoval ||
    targetedAuraRemoval ||
    shrinkingAura ||
    powerResetRemoval ||
    combatTriggeredRemoval ||
    phaseOutRemoval ||
    leastPowerRemoval ||
    /\bdestroy each permanent chosen this way\b/.test(text);
  const targetedDamageRemoval =
    /\bdeals? (?:x|\d+|that much) damage to any (?:other )?target\b/.test(text) ||
    /\bdeals? (?:x|\d+|that much) damage to target\b[^.]{0,140}\b(?:creature|artifact|enchantment|planeswalker|battle|permanent)\b/.test(text) ||
    /\bdeals? (?:x|\d+|that much) damage to each of up to\b/.test(text) ||
    /\bdeals? (?:\w+\s+times\s+)?x damage to each of up to x targets?\b/.test(text) ||
    /\bdeals? damage equal to (?:its|that creature'?s|their) power to any target\b/.test(text) ||
    /\bdeals? damage to target\b[^.]{0,100}\b(?:creature|artifact|enchantment|planeswalker|battle|permanent)\b[^.]{0,120}\bequal to\b/.test(text) ||
    /\bdeals? damage (?:equal to [^.]{0,100}|to target [^.]{0,80} equal to [^.]{0,100})\b(?:target |to target )?(?:attacking or blocking )?(?:creature|artifact|enchantment|planeswalker|battle|permanent)\b/.test(text) ||
    /\bdeals? damage equal to [^.]{0,100}\bto target\b[^.]{0,100}\b(?:creature|artifact|enchantment|planeswalker|battle|permanent)\b/.test(text) ||
    /\bdeals? (?:x|\d+|that much) damage divided as you choose among any number of targets?(?!\s+creatures?\b)\b/.test(text) ||
    /\bdistribute\b[^.]{0,80}-\d+\/-\d+ counters? among\b[^.]{0,120}target creatures?\b/.test(text) ||
    /\bchoose any target\b[\s\S]{0,180}\bdeals? (?:x|\d+|that much) damage to each of them\b/.test(text);
  const massRemoval =
    /\b(?:destroy|exile|return) all\b[^.]{0,120}\b(?:creatures|artifacts|enchantments|permanents|nonland permanents)\b/.test(text) ||
    /\bdestroy all (?:goblins|walls|elves|zombies|skeletons|soldiers|knights|dragons|beasts|merfolk|wizards|clerics|shamans|goblins)\b/.test(text) ||
    /\bexile each permanent\b/.test(text) ||
    /\bdestroy each nonland permanent\b[^.]{0,120}\bmana value (?:x|\d+) or less\b/.test(text) ||
    /\beach nontoken permanent\b[^.]{0,120}\bis sacrificed by its controller\b/.test(text) ||
    /\bfor each attacking creature\b[^.]{0,160}\bputs? it on (?:their|its) choice of the top or bottom of (?:their|its) library\b/.test(text) ||
    /\beach creature deals damage to itself equal to its power\b/.test(text) ||
    /\ball creatures get -(?:x|\d+)\/-(?:x|\d+)\b/.test(text) ||
    /\bnonartifact creatures get -\d+\/-\d+\b/.test(text) ||
    /\bnonwhite creatures get -\d+\/-\d+\b/.test(text) ||
    /\bcreatures your opponents control get -(?:x|\d+)\/-(?:x|\d+)\b/.test(text) ||
    /\bcreatures your opponents control have base power and toughness 0\/1\b/.test(text) ||
    /\bdestroy all auras\b/.test(text) ||
    /\bdeals? \d+ damage to each non(?:white|blue|black|red|green) creature\b/.test(text) ||
    /\bdeals? \d+ damage to each (?:white|blue|black|red|green)(?: and\/or (?:white|blue|black|red|green))? creature\b/.test(text) ||
    /\b(?:deals? (?:x|\d+) damage|deals? damage equal to [^.]{0,80}) to each (?:attacking )?creature\b/.test(text) ||
    massLandDenial;
  const tempoRemoval =
    /\breturn\b[^.]{0,40}\btarget\b[^.]{0,140}\b(?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b[^.]{0,140}\bto (?:(?:its|their) owner's|their owners') hands?\b/.test(text) ||
    /\breturn target creature you control and target creature you don'?t control to their owners'? hands\b/.test(text) ||
    /\breturn\b[^.]{0,80}\b(?:one|two|three|four|five|six|\d+|up to \d+|up to [a-z]+)\s+target\b[^.]{0,140}\b(?:creatures?|artifacts?|enchantments?|planeswalkers?|permanents?|nonland permanents?)\b[^.]{0,120}\bto (?:their|its) owners'? hands?\b/.test(text) ||
    (/\b(?:put|puts)\b[^.]{0,40}\btarget\b[^.]{0,140}\b(?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent|land)\b[^.]{0,120}\blibrary\b/.test(text) &&
      !/\bgraveyard\b/.test(text)) ||
    /\btap (?:up to )?(?:(?:one|two|three|four|five|six|\d+)\s+)?target\b[^.]{0,120}\b(?:creatures?|artifacts?|enchantments?|planeswalkers?|permanents?|nonland permanents?|lands?)\b/.test(text) ||
    phaseOutRemoval ||
    /\btarget spell, nonland permanent, or card in a graveyard\b[^.]{0,160}\btop or bottom of (?:their|its) library\b/.test(text);
  const temporaryTheft =
    exchangeControl ||
    /\bgain control of\b[^.]{0,120}\b(?:target|enchanted)\b[^.]{0,120}\b(?:creature|artifact|enchantment|planeswalker|permanent)\b[^.]{0,160}\buntil end of turn\b/.test(
      text,
    ) ||
    /\bgain control of that artifact until\b/.test(
      text,
    );
  const permanentTheft =
    (
      /\bgain control of\b[^.]{0,120}\b(?:target|enchanted)\b[^.]{0,120}\b(?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent|land)\b/.test(text) ||
      /\bgains control of the creature\b/.test(text) ||
      /\byou control enchanted (?:creature|artifact|permanent|land)\b/.test(text)
    ) &&
    !/\buntil end of turn\b/.test(text);
  const handAttack =
    /\btarget (?:player|opponent)\b[^.]{0,140}\bdiscards?\b/.test(text) ||
    /\btarget player reveals a card at random from their hand\b[\s\S]{0,220}\bdiscards? it unless\b/.test(text) ||
    /\beach player may discard\b[\s\S]{0,160}\bdeals damage to each player\b/.test(text) ||
    /\beach opponent discards?\b/.test(text) ||
    /\bexile\b[^.]{0,140}\bfrom (?:target|that) (?:player|opponent)'s hand\b/.test(text) ||
    /\blook at that player'?s hand\b[\s\S]{0,180}\bchoose a card from it\b[\s\S]{0,140}\b(?:discards? that card|player discards that card)\b/.test(text) ||
    /\btarget player chooses\b[^.]{0,80}\bcards? from their hand\b[^.]{0,120}\bputs? them on top of their library\b/.test(text);

  const selfProtectionFlicker =
    /\breturn\b[^.]{0,160}\bto the battlefield\b/.test(text) ||
    (/\btarget\b[^.]{0,140}\b(?:creature|artifact|enchantment|planeswalker|permanent)\b[^.]{0,140}\byou control\b/.test(text) &&
      !/\bdeals? damage\b/.test(text));

  if ((targetedRemoval || chosenRemoval || targetedDamageRemoval) && !selfProtectionFlicker) {
    addRole(profile, "removal", 0.82, "Advanced scan recognized battlefield removal.");
    addRole(
      profile,
      "targeted_removal",
      chosenRemoval
        ? 0.94
        : edictRemoval || delayedAuraEdict
          ? 0.78
          : auraNeutralization || phaseOutRemoval
            ? 0.72
            : targetedDamageRemoval
              ? 0.68
              : 0.82,
      "Advanced scan recognized targeted or chosen removal.",
    );
  }

  if (targetedLandRemoval) {
    addRole(profile, "land_denial", 0.72, "Advanced scan recognized targeted land destruction.");
    addRole(profile, "targeted_land_removal", 0.74, "Advanced scan recognized targeted land destruction.");
  }

  if (massLandDenial) {
    addRole(profile, "land_denial", 0.94, "Advanced scan recognized mass land denial.");
    addRole(profile, "mass_land_denial", 1, "Advanced scan recognized mass land denial.");
    addRole(profile, "hate_piece", 0.76, "Advanced scan recognized land denial as a table-shaping hate piece.");
  }

  if (massRemoval) {
    addRole(profile, "removal", 0.96, "Advanced scan recognized a sweeper effect.");
    addRole(profile, "mass_removal", 1.02, "Advanced scan recognized a sweeper effect.");
  }

  if (tempoRemoval || lockdownAura || temporaryTheft || permanentTheft) {
    addRole(profile, "removal", 0.58, "Advanced scan recognized tempo-based battlefield interaction.");
    addRole(
      profile,
      "tempo_removal",
      permanentTheft ? 0.72 : lockdownAura ? 0.76 : temporaryTheft ? 0.58 : 0.68,
      "Advanced scan recognized bounce, theft, or tuck interaction.",
    );
  }

  if (/\breturn each\b[^.]{0,120}\bcreature\b[^.]{0,180}\bto (?:its|their) owner'?s hand\b/.test(text)) {
    addRole(profile, "removal", 0.72, "Advanced scan recognized mass bounce as battlefield interaction.");
    addRole(profile, "tempo_removal", 0.78, "Advanced scan recognized mass bounce as tempo interaction.");
  }

  if (handAttack) {
    addRole(profile, "removal", 0.44, "Advanced scan recognized hand pressure as resource interaction.");
    addRole(profile, "hand_attack", 0.62, "Advanced scan recognized hand attack.");
  }
}

function detectAdvancedStackRoles(profile: CardRoleProfile, text: string) {
  const hardCounter =
    /\bcounter (?:up to one )?target\b[^.]{0,60}\bspell\b/.test(text) &&
    !/\bunless\b/.test(text);
  const triggeredHardCounter =
    /\bwhenever a player casts\b[^.]{0,80}\b(?:spell|enchantment spell|instant spell|sorcery spell)\b[^.]{0,40}\bcounter it\b/.test(text) &&
    !/\bunless\b/.test(text);
  const softCounter =
    /\bcounter (?:up to one )?target\b[^.]{0,60}\bspell\b[^.]{0,120}\bunless\b/.test(text) ||
    /\bcounter target spell if\b/.test(text) ||
    /\bwhenever a player casts\b[^.]{0,80}\b(?:spell|enchantment spell|instant spell|sorcery spell)\b[^.]{0,80}\bcounter it unless\b/.test(text);
  const spellTempo =
    /\breturn target spell\b[^.]{0,120}\bto (?:its|their) owner's hand\b/.test(text) ||
    /\bcopy target instant or sorcery spell\b[^.]{0,160}\breturn it to (?:its|their) owner'?s hand\b/.test(text) ||
    /\btarget spell, nonland permanent, or card in a graveyard\b[^.]{0,160}\btop or bottom of (?:their|its) library\b/.test(text) ||
    /\b(?:put|puts) target spell\b[^.]{0,120}\blibrary\b/.test(text) ||
    /\bchoose target spell\b[^.]{0,120}\blibrary\b/.test(text);
  const broadStack =
    /\bcounter target spell or ability\b/.test(text) ||
    /\bexile target spell or ability\b/.test(text) ||
    /\bexile any number of target spells?\b/.test(text) ||
    /\bcounter target activated ability\b/.test(text) ||
    /\bcounter target activated or triggered ability\b/.test(text) ||
    /\bcounter all abilities\b/.test(text) ||
    /\bexile all other spells\b/.test(text) ||
    /\bexchange control of\b[^.]{0,180}\bspell\b/.test(text) ||
    /\bchange the target of target spell\b/.test(text) ||
    /\bchange (?:that|target) spell'?s target\b/.test(text) ||
    /\bspells you control can'?t be countered\b/.test(text);
  const castRestriction =
    /\b(?:target player|target opponent|each opponent|your opponents)\b[^.]{0,160}\bcan'?t cast\b[^.]{0,120}\b(?:spells|noncreature spells|instant spells|sorcery spells)\b/.test(
      text,
    ) ||
    /\bcan'?t cast noncreature spells\b/.test(text) ||
    /\bspells with the chosen names can'?t be cast\b/.test(text) ||
    /\bcreature spells can'?t be cast\b/.test(text);

  if (hardCounter || triggeredHardCounter) {
    addRole(profile, "stack", 0.9, "Advanced scan recognized a hard counterspell.");
    addRole(profile, "hard_stack", triggeredHardCounter ? 0.82 : 0.92, "Advanced scan recognized a hard counterspell.");
  }

  if (softCounter) {
    addRole(profile, "stack", 0.66, "Advanced scan recognized conditional spell interaction.");
    addRole(profile, "soft_stack", 0.74, "Advanced scan recognized conditional spell interaction.");
  }

  if (spellTempo) {
    addRole(profile, "stack", 0.72, "Advanced scan recognized tempo interaction with a spell.");
    addRole(profile, "spell_tempo", 0.78, "Advanced scan recognized tempo interaction with a spell.");
  }

  if (broadStack) {
    addRole(profile, "stack", 0.82, "Advanced scan recognized broad stack coverage.");
    addRole(profile, "broad_stack", 0.86, "Advanced scan recognized broad stack coverage.");
  }

  if (castRestriction) {
    addRole(profile, "stack", 0.6, "Advanced scan recognized a spell-lock or casting restriction.");
    addRole(profile, "soft_stack", 0.68, "Advanced scan recognized a spell-lock or casting restriction.");
    if (/\bcreature spells can'?t be cast\b|\bspells with the chosen names can'?t be cast\b/.test(text)) {
      addRole(profile, "hate_piece", 0.58, "Advanced scan recognized a spell lock as a hate piece.");
      addRole(profile, "stax_piece", 0.62, "Advanced scan recognized a spell lock.");
    }
  }
}

function detectAdvancedProtectionRoles(
  profile: CardRoleProfile,
  text: string,
  permanent: boolean,
  equipment: boolean,
) {
  const repeatable = isRepeatableText(text, permanent);
  const broadProtection =
    /\b(?:permanents|creatures) you control\b[^.]{0,120}\bgain\b[^.]{0,120}\b(?:hexproof|indestructible|ward|protection from)\b/.test(text) ||
    /\byour permanents have\b[^.]{0,120}\b(?:hexproof|ward)\b/.test(text) ||
    /\bphase out\b[^.]{0,80}\beach\b[^.]{0,80}\b(?:creature|permanent) you control\b/.test(text) ||
    /\btarget opponent skips? (?:their|his or her) next combat phase\b/.test(text) ||
    /\ball damage that would be dealt to you\b[^.]{0,120}\bis dealt to\b/.test(text) ||
    /\bprevent all (?:combat )?damage\b[^.]{0,180}\b(?:this turn|that would be dealt this turn|that would be dealt to you|dealt by creatures)\b/.test(text) ||
    /\bcreatures deal no combat damage\b/.test(text) ||
    /\bthe next time\b[^.]{0,100}\bsource of your choice would deal damage to you\b[^.]{0,80}\bprevent that damage\b/.test(text) ||
    /\bprevent the next (?:x|\d+|one|two|three|four|five|six|seven|eight|nine|ten) damage that would be dealt to you\b/.test(text);
  const playerProtection =
    /\byou (?:gain|have) protection from everything\b/.test(text) ||
    /\byou (?:gain|have) hexproof\b/.test(text) ||
    /\bdamage that would reduce your life total to less than 1 reduces it to 1 instead\b/.test(text);
  const regenerationProtection =
    /\bregenerate (?:this creature|enchanted creature|target creature|that creature)\b/.test(text);
  const targetedProtection =
    /\btarget\b[^.]{0,120}\b(?:creature|artifact|enchantment|planeswalker|permanent)\b[^.]{0,120}\b(?:gains?|gain)\b[^.]{0,120}\b(?:hexproof|indestructible|ward|protection from)\b/.test(text) ||
    /\btarget\b[^.]{0,120}\b(?:creature|artifact|enchantment|planeswalker|permanent)\b[^.]{0,80}\byou control\b[^.]{0,80}\bphases out\b/.test(text) ||
    /\benchanted creature can'?t be the target of spells\b/.test(text) ||
    /\bprevent all damage that would be dealt to enchanted creature\b[^.]{0,120}\bby sources? of\b/.test(text) ||
    /\bif a spell or ability that targets that creature would cause a source to deal damage to that creature\b[^.]{0,120}\bprevent that damage\b/.test(text) ||
    /\bregenerate target\b/.test(text) ||
    regenerationProtection ||
    /\bthe next time target land would be destroyed this turn\b/.test(text) ||
    /\bprevent the next (?:x|\d+|one|two|three|four|five|six|seven|eight|nine|ten) damage that would be dealt to (?:any target|target (?:creature|permanent|artifact|enchantment|planeswalker|player)|that (?:permanent|creature|player))\b/.test(text) ||
    /\bthe next time\b[^.]{0,100}\bsource of your choice would deal damage to target creature\b[^.]{0,120}\bdeals that damage to you instead\b/.test(text);
  const redirectedDamageProtection =
    /\bgains?\b[^.]{0,120}\bthe next (?:x|\d+|one|two|three|four|five|six|seven|eight|nine|ten) damage that would be dealt to target\b[^.]{0,180}\bis dealt to (?:this|that) creature instead\b/.test(text);
  const selfBounce =
    /\breturn target\b[^.]{0,120}\b(?:creature|artifact|enchantment|planeswalker|permanent|land)\b[^.]{0,120}\byou control\b[^.]{0,120}\bto (?:its|their) owner's hand\b/.test(text) ||
    /\breturn target permanent you both own and control to your hand\b/.test(text);
  const flicker =
    /\bexile\b[^.]{0,120}\btarget\b[^.]{0,120}\b(?:creature|artifact|enchantment|planeswalker|permanent)\b[^.]{0,120}\byou control\b[^.]{0,160}\breturn\b[^.]{0,120}\bto the battlefield\b/.test(text) ||
    /\bexile (?:each|all)\b[^.]{0,120}\b(?:creature|permanent)s?\b[^.]{0,120}\byou control\b[\s\S]{0,220}\breturn those cards\b[\s\S]{0,160}\bto the battlefield\b/.test(text);
  const equipmentProtection =
    equipment &&
    (/\bequipped creature\b[^.]{0,120}\b(?:has|gains)\b[^.]{0,120}\b(?:hexproof|shroud|ward|protection from)\b/.test(text) ||
      /\bequipped creature\b[^.]{0,120}\bphases out\b/.test(text));
  const selfProtection =
    /\b(?:this creature|this artifact|this enchantment|this permanent|this planeswalker)\b[^.]{0,120}\b(?:has|gains)\b[^.]{0,120}\b(?:hexproof|shroud|ward|indestructible|protection from)\b/.test(text) ||
    /\b(?:hexproof|shroud|ward \d+|ward—|ward \{|indestructible)\b/.test(text) ||
    /\bcannot be the target of spells or effects\b/.test(text) ||
    (/\bprotection from [a-z]+\b/.test(text) && !/\b(?:enchanted|target) creature\b/.test(text));

  if (broadProtection) {
    addRole(profile, "protection", repeatable ? 0.96 : 0.88, "Advanced scan recognized broad board protection.");
    addRole(profile, "broad_protection", repeatable ? 1 : 0.9, "Advanced scan recognized broad board protection.");
  }

  if (playerProtection) {
    addRole(profile, "protection", 0.66, "Advanced scan recognized player protection.");
    addRole(profile, "broad_protection", 0.68, "Advanced scan recognized player protection.");
    if (/\blife total\b/.test(text)) {
      addRole(profile, "life_total_protection", 0.44, "Advanced scan recognized life-total protection.");
    }
  }

  if (targetedProtection || redirectedDamageProtection) {
    addRole(profile, "protection", repeatable ? 0.9 : 0.82, "Advanced scan recognized single-target protection.");
    addRole(
      profile,
      "targeted_protection",
      regenerationProtection ? 0.72 : repeatable ? 0.94 : 0.84,
      regenerationProtection
        ? "Advanced scan recognized regeneration as protection."
        : "Advanced scan recognized single-target protection.",
    );
    if (regenerationProtection) {
      addRole(profile, "regeneration_protection", 0.72, "Advanced scan recognized regeneration as protection.");
    }
  }

  if (equipmentProtection) {
    addRole(profile, "protection", 0.84, "Advanced scan recognized equipment-based protection.");
    addRole(profile, "equipment_protection", 0.9, "Advanced scan recognized equipment-based protection.");
  }

  if (selfProtection) {
    addRole(profile, "self_protection", 0.36, "Advanced scan recognized built-in self-protection.");
  }

  if (selfBounce) {
    addRole(profile, "protection", 0.58, "Advanced scan recognized self-bounce protection.");
    addRole(profile, "self_bounce", 0.66, "Advanced scan recognized self-bounce protection.");
    addRole(profile, "rescue_protection", 0.48, "Advanced scan recognized rescue-style protection.");
  }

  if (flicker) {
    addRole(profile, "protection", 0.68, "Advanced scan recognized flicker protection.");
    addRole(profile, "flicker", 0.76, "Advanced scan recognized flicker protection.");
    addRole(profile, "rescue_protection", 0.6, "Advanced scan recognized rescue-style protection.");
  }
}

function detectAdvancedRecursionRoles(profile: CardRoleProfile, text: string, permanent: boolean) {
  const repeatable = isRepeatableText(text, permanent);
  const battlefield =
    /\breturn\b[^.]{0,140}\b(?:target|up to .*?)\b[^.]{0,140}\bfrom your graveyard\b[^.]{0,120}\bto the battlefield\b/.test(text) ||
    /\breturn\b[^.]{0,140}\b(?:artifact|creature|enchantment|planeswalker|permanent) card\b[^.]{0,140}\bfrom your graveyard\b[^.]{0,120}\bto the battlefield\b/.test(text) ||
    /\b(?:target|up to .*?)\b[^.]{0,140}\bcreature cards? in your graveyard\b[^.]{0,180}\breturn (?:it|them|those cards?) to the battlefield\b/.test(text) ||
    /\btarget creature cards? in your graveyard\b[\s\S]{0,180}\breturn them to the battlefield\b/.test(text) ||
    /\breturn a card exiled with this enchantment to the battlefield\b/.test(text) ||
    /\breturn enchanted creature card to the battlefield\b/.test(text);
  const hand =
    /\breturn\b[^.]{0,140}\b(?:target|up to .*?)\b[^.]{0,140}\bfrom your graveyard\b[^.]{0,120}\bto your hand\b/.test(text) ||
    /\breturn\b[^.]{0,140}\b(?:artifact|creature|enchantment|planeswalker|instant|sorcery|permanent) card\b[^.]{0,140}\bfrom your graveyard\b[^.]{0,120}\bto your hand\b/.test(text) ||
    /\bchooses? a card in your graveyard\b[\s\S]{0,220}\bput the last chosen card into your hand\b/.test(text);
  const replay =
    !hasSelfContainedGraveyardCastText(text) &&
    (/\byou may (?:cast|play)\b[^.]{0,120}\bfrom your graveyard\b/.test(text) ||
      /\b(?:each|every|instant|sorcery|nonland|creature|artifact|enchantment|permanent)[^.]{0,140}\bcards? in your graveyard\b[^.]{0,180}\bgains? flashback\b/.test(text) ||
      /\beach\b[^.]{0,80}\bnonland card\b[^.]{0,100}\bhas escape\b/.test(text));
  const mass =
    /\breturn all\b[^.]{0,160}\bfrom your graveyard\b/.test(text) ||
    /\breturn each\b[^.]{0,160}\bfrom your graveyard\b/.test(text) ||
    /\breturn\b[^.]{0,120}\bany number of\b[^.]{0,160}\bfrom your graveyard\b/.test(text) ||
    /\bput all creature cards from all graveyards onto the battlefield under your control\b/.test(text);
  const library =
    /\bshuffle your graveyard into your library\b/.test(text) ||
    /\bshuffle\b[^.]{0,120}\bfrom your graveyard\b[^.]{0,120}\binto your library\b/.test(text) ||
    /\bput\b[^.]{0,120}\bfrom your graveyard\b[^.]{0,120}\bon top of your library\b/.test(text) ||
    /\bput the top card of your graveyard on the bottom of your library\b/.test(text) ||
    /\bput any number of target\b[^.]{0,160}\bfrom target player's graveyard on top of their library\b/.test(text);

  if (battlefield) {
    addRole(profile, "recursion", 0.9, "Advanced scan recognized battlefield recursion.");
    addRole(profile, "battlefield_recursion", repeatable ? 0.96 : 0.88, "Advanced scan recognized battlefield recursion.");
  }

  if (hand) {
    addRole(profile, "recursion", 0.72, "Advanced scan recognized hand recursion.");
    addRole(profile, "hand_recursion", repeatable ? 0.76 : 0.7, "Advanced scan recognized hand recursion.");
  }

  if (replay) {
    addRole(profile, "recursion", 0.86, "Advanced scan recognized graveyard replay.");
    addRole(profile, "replay_recursion", repeatable ? 0.92 : 0.84, "Advanced scan recognized graveyard replay.");
  }

  if (mass) {
    addRole(profile, "recursion", 0.92, "Advanced scan recognized mass recursion.");
    addRole(profile, "mass_recursion", 0.96, "Advanced scan recognized mass recursion.");
  }

  if (library) {
    addRole(profile, "recursion", 0.42, "Advanced scan recognized library recycling.");
    addRole(profile, "library_recursion", 0.46, "Advanced scan recognized library recycling.");
  }
}

function detectAdvancedFinisherRoles(
  profile: CardRoleProfile,
  text: string,
  permanent: boolean,
  keywords: string[],
) {
  const repeatable = isRepeatableText(text, permanent);
  const explicitWin =
    /\byou win the game\b/.test(text) ||
    /\btarget player loses the game\b/.test(text) ||
    /\beach opponent loses the game\b/.test(text);
  const tableDamage =
    /\beach opponent loses\b/.test(text) ||
    /\btarget opponent loses life equal to\b/.test(text) ||
    /\bdeals? \d+ damage to each opponent\b/.test(text) ||
    /\beach opponent loses x life\b/.test(text) ||
    /\bwhenever\b[^.]{0,140}\beach opponent loses\b/.test(text) ||
    /\bwhenever\b[^.]{0,160}\bcreature an opponent controls dies\b[^.]{0,160}\bthat player loses \d+ life\b/.test(text);
  const extraCombat =
    /\badditional combat phases?\b/.test(text) ||
    /\bafter this phase, there (?:is|are) (?:an?|one|two|three|\d+) additional combat phases?\b/.test(
      text,
    );
  const overrun =
    /\bcreatures you control get \+\d+\/\+\d+\b[^.]{0,120}\b(?:trample|double strike|unblockable)\b/.test(text) ||
    /\bcreatures you control gain trample\b[^.]{0,120}\bget (?:\+\d+\/\+\d+|\+x\/\+x)\b/.test(text) ||
    /\bcreatures you control\b[^.]{0,120}\bhave base power and toughness x\/x\b/.test(text) ||
    /\bcreatures target player controls get \+\d+\/\+\d+\b[\s\S]{0,140}\buntap them\b/.test(text);
  const poison =
    /\bpoison counter\b/.test(text) ||
    /\btoxic \d+\b/.test(text) ||
    keywords.includes("Infect");
  const attackTableDamage =
    /\bwhenever\b[^.]{0,120}\battacks\b[^.]{0,160}\beach opponent loses\b/.test(text) ||
    /\bwhenever\b[^.]{0,120}\battacks\b[^.]{0,160}\bdeals? \d+ damage to each opponent\b/.test(text);
  const attackTargetedDamage =
    /\bwhenever\b[^.]{0,120}\battacks\b[^.]{0,200}\bdeals? (?:x|\d+|that much) damage to (?:any (?:other )?target|target (?:player|opponent)|each opponent)\b/.test(
      text,
    ) ||
    /\bwhenever this permanent enters or attacks\b[^.]{0,200}\bdeals? (?:x|\d+|that much) damage to (?:any (?:other )?target|target (?:player|opponent)|each opponent)\b/.test(
      text,
    );
  const damageReflection =
    /\bwhenever\b[^.]{0,160}\bis dealt damage\b[^.]{0,200}\bdeals? that much damage to (?:any (?:other )?target|target (?:player|opponent)|each opponent)\b/.test(
      text,
    );
  const scalableTargetDamage =
    /\bdeals? (?:x|that much) damage to (?:any (?:other )?target|target (?:player|opponent))\b/.test(text) ||
    /\bdeals? damage equal to (?:its|that creature'?s|their|that spell'?s) (?:power|mana value) to (?:any target|target opponent|each opponent)\b/.test(text) ||
    /\bdeals? (?:\w+\s+times\s+)?x damage to each of up to x targets?\b/.test(text) ||
    /\bdeals? (?:x|that much) damage divided as you choose among any number of targets?(?!\s+creatures?\b)\b/.test(text) ||
    /\bchoose any target\b[\s\S]{0,180}\bdeals? (?:x|that much) damage to each of them\b/.test(text);

  if (explicitWin) {
    addRole(profile, "finisher", 1.02, "Advanced scan recognized an explicit win condition.");
    addRole(profile, "alternate_finisher", repeatable ? 1.06 : 1.02, "Advanced scan recognized an explicit win condition.");
    if (repeatable) {
      addRole(profile, "repeatable_finisher", 0.88, "Advanced scan recognized a repeatable alternate-win engine.");
    }
  }

  if (tableDamage || attackTableDamage) {
    addRole(profile, "finisher", 0.88, "Advanced scan recognized a direct life-total finisher.");
    addRole(profile, "direct_finisher", attackTableDamage ? 0.84 : 0.9, "Advanced scan recognized a direct life-total finisher.");
    if (repeatable || attackTableDamage) {
      addRole(profile, "repeatable_finisher", 0.82, "Advanced scan recognized repeatable closing pressure.");
    }
  }

  if (attackTargetedDamage || damageReflection) {
    addRole(profile, "finisher", 0.74, "Advanced scan recognized repeatable combat-linked damage pressure.");
    addRole(
      profile,
      "direct_finisher",
      damageReflection ? 0.8 : 0.76,
      "Advanced scan recognized repeatable combat-linked damage pressure.",
    );
    addRole(
      profile,
      "repeatable_finisher",
      damageReflection ? 0.78 : 0.72,
      "Advanced scan recognized repeatable combat-linked damage pressure.",
    );
  }

  if (scalableTargetDamage) {
    addRole(profile, "finisher", /\bx\b/.test(text) ? 0.72 : 0.56, "Advanced scan recognized scalable direct damage as closing pressure.");
    addRole(profile, "direct_finisher", /\bx\b/.test(text) ? 0.72 : 0.56, "Advanced scan recognized scalable direct damage as closing pressure.");
  }

  if (extraCombat || overrun) {
    addRole(profile, "finisher", 0.82, "Advanced scan recognized combat-closing text.");
    addRole(profile, "combat_finisher", extraCombat ? 0.94 : 0.84, "Advanced scan recognized combat-closing text.");
    if (repeatable || extraCombat && permanent) {
      addRole(profile, "repeatable_finisher", 0.72, "Advanced scan recognized repeatable combat-closing pressure.");
    }
  }

  if (poison) {
    addRole(profile, "finisher", 0.8, "Advanced scan recognized a poison-based finishing route.");
    addRole(profile, "alternate_finisher", 0.86, "Advanced scan recognized a poison-based finishing route.");
  }
}

function detectAdvancedPurposeRoles(
  profile: CardRoleProfile,
  text: string,
  card: ScryfallCard,
) {
  const permanent = isPermanentCard(card);
  const keywords = new Set((card.keywords ?? []).map(normalizeKeyword));
  const diceText = hasDiceText(text);
  const coinText = hasCoinFlipText(text);
  const replacementText = hasReplacementText(text);
  const faceDownText = hasFaceDownPurposeText(text, card.keywords ?? []);
  const flashEnablerText = hasFlashEnablerText(text);
  const libraryAccessKeyword = hasAnyKeyword(keywords, ["cascade", "discover"]);
  const delayedCastKeyword = hasAnyKeyword(keywords, ["plot", "foretell", "suspend", "adventure"]);
  const graveyardCastKeyword = hasAnyKeyword(keywords, ["flashback", "jump start", "escape", "disturb"]);
  const graveyardBodyKeyword = hasAnyKeyword(keywords, ["unearth", "embalm", "eternalize"]);
  const selectionKeyword =
    hasAnyKeyword(keywords, ["cycling", "basic landcycling", "typecycling", "scry", "surveil", "connive", "explore", "learn", "clash"]) ||
    [...keywords].some((keyword) => keyword.endsWith("cycling"));
  const tokenKeyword = hasAnyKeyword(keywords, ["amass", "incubate", "living weapon", "for mirrodin"]);
  const combatKeywordSupport = hasAnyKeyword(keywords, ["backup", "exalted", "bloodrush", "dash", "ninjutsu", "mutate", "monstrosity", "adapt", "level up"]);
  const dungeonKeyword = hasAnyKeyword(keywords, ["venture into the dungeon", "take the initiative"]);
  const land = hasCardType(card, "Land");
  const normalizedTypeLine = normalizeText(card.type_line);

  if (land) {
    addRole(profile, "land_base", 0.2, "Advanced scan recognized a land slot.");
    addRole(profile, "land_slot", 0.2, "Advanced scan recognized a land slot.");
    if (/\bbasic land\b/.test(normalizedTypeLine)) {
      addRole(profile, "basic_land", 0.28, "Advanced scan recognized a basic land.");
    }
    if (/\{t\}: add\b|\badd \{[wubrgc]\}\b|\badd\b[^.]{0,40}\{[wubrg]\}\s*or\s*\{[wubrg]\}/.test(text)) {
      addRole(profile, "mana_source", 0.3, "Advanced scan recognized land mana production.");
    }
    if (/\b(?:plains|island|swamp|mountain|forest)\b/.test(normalizedTypeLine) && !/\bbasic land\b/.test(normalizedTypeLine)) {
      addRole(profile, "typed_land", 0.46, "Advanced scan recognized basic land types on a nonbasic land.");
    }
  }

  if (
    /\btarget spell or permanent becomes\b[^.]{0,40}\b(?:white|blue|black|red|green)\b/.test(text) ||
    /\btarget permanent becomes the colors? or colors? of your choice\b/.test(text) ||
    /\bone or more target creatures become (?:white|blue|black|red|green)\b/.test(text) ||
    /\benchanted creature becomes the colors? or colors? of your choice\b/.test(text) ||
    /\btarget permanent you control becomes the color of your choice\b/.test(text) ||
    /\b(?:black|red|white|blue|green)(?: and\/or (?:black|red|white|blue|green))? permanents and spells are colorless sources of damage\b/.test(text)
  ) {
    addRole(profile, "color_change", 0.3, "Advanced scan recognized color-changing utility.");
  }

  if (/\bchange the text of target spell or permanent\b/.test(text)) {
    addRole(profile, "text_change", 0.34, "Advanced scan recognized text-changing utility.");
  }

  if (/\bremove this card from your deck before playing if you're not playing for ante\b/.test(text)) {
    addRole(profile, "ante_card", 0.18, "Advanced scan recognized an ante-only card.");
  }

  if (
    /\bas long as enchanted artifact isn't a creature\b[^.]{0,120}\bit's an artifact creature\b/.test(text) ||
    /\bthis artifact becomes\b[^.]{0,80}\bartifact creature\b/.test(text) ||
    /\ball lands are 1\/1 creatures\b/.test(text) ||
    /\ball (?:forests|swamps)\b[^.]{0,120}\bare 1\/1\b[^.]{0,80}\bcreatures\b/.test(text)
  ) {
    addRole(profile, "animation_effect", 0.44, "Advanced scan recognized a permanent-animation effect.");
    addRole(profile, "combat_support", 0.34, "Advanced scan recognized permanent animation as combat material.");
  }

  if (/\benchanted land is (?:the chosen type|(?:a |an )?(?:plains|island|swamp|mountain|forest))\b/.test(text)) {
    addRole(profile, "land_type_change", 0.4, "Advanced scan recognized land type-changing utility.");
    addRole(profile, "land_denial", 0.34, "Advanced scan recognized land type changes as possible mana disruption.");
  }

  if (/\btarget land becomes the basic land type of your choice\b/.test(text)) {
    addRole(profile, "land_type_change", 0.42, "Advanced scan recognized land type-changing utility.");
    addRole(profile, "land_denial", 0.32, "Advanced scan recognized land type changes as possible mana disruption.");
  }

  if (
    /\bwhenever a player taps a snow land for mana\b[^.]{0,180}\badds? one mana\b/.test(text) ||
    /\bthat land doesn't untap during its controller'?s next untap step\b/.test(text)
  ) {
    addRole(profile, "snow_support", 0.5, "Advanced scan recognized snow-land mana support.");
    addRole(profile, "land_synergy", 0.44, "Advanced scan recognized snow-land utility.");
    addRole(profile, "ramp", 0.34, "Advanced scan recognized snow-land mana multiplication.");
    addRole(profile, "mana_denial", 0.3, "Advanced scan recognized delayed snow-land untap pressure.");
  }

  if (
    /\beach player may play an additional land\b/.test(text) ||
    /\bwhenever a land is tapped for mana\b[^.]{0,120}\breturn it to its owner'?s hand\b/.test(text)
  ) {
    addRole(profile, "land_synergy", 0.58, "Advanced scan recognized extra land-play and land-bounce utility.");
    addRole(profile, "land_acceleration", 0.42, "Advanced scan recognized additional land plays.");
    addRole(profile, "mana_denial", 0.44, "Advanced scan recognized land-bounce mana pressure.");
    addRole(profile, "stax_piece", 0.4, "Advanced scan recognized symmetrical land-bounce pressure.");
  }

  if (
    /\ball lands are no longer snow\b/.test(text) ||
    /\btarget snow land is no longer snow\b/.test(text) ||
    /\btarget nonsnow basic land becomes snow\b/.test(text)
  ) {
    addRole(profile, "snow_support", 0.36, "Advanced scan recognized snow-land status manipulation.");
    addRole(profile, "land_synergy", 0.32, "Advanced scan recognized snow-land utility.");
    if (/\bno longer snow\b/.test(text)) {
      addRole(profile, "hate_piece", 0.24, "Advanced scan recognized snow-land hate.");
    }
  }

  if (
    /\byou may tap or untap target artifact, creature, or land\b/.test(text) ||
    /\buntap target (?:nonattacking |attacking |blocking |tapped |untapped )?(?:artifact|creature|land|permanent)\b/.test(text) ||
    /\btarget player untaps all basic lands they control\b/.test(text) ||
    /\btap (?:x|one|two|three|four|five|six|\d+) target lands?\b/.test(text)
  ) {
    addRole(profile, "tap_untap", 0.48, "Advanced scan recognized tap-or-untap utility.");
    addRole(profile, "tempo_support", 0.44, "Advanced scan recognized tap-or-untap tempo utility.");
    if (/\b(?:lands?|artifact, creature, or land)\b/.test(text)) {
      addRole(profile, "ramp", 0.28, "Advanced scan recognized untapping lands as possible mana utility.");
    }
  }

  if (/\bplayers play a magic subgame\b/.test(text)) {
    addRole(profile, "subgame", 0.36, "Advanced scan recognized subgame text.");
    addRole(profile, "alternate_play", 0.3, "Advanced scan recognized alternate-gameplay text.");
    addRole(profile, "life_pressure", 0.22, "Advanced scan recognized subgame life-loss pressure.");
  }

  if (
    /\bsource of your choice would deal damage to you\b[^.]{0,180}\bdeals that much damage to that source'?s controller\b/.test(text) ||
    /\bsource of your choice would deal damage this turn\b[^.]{0,180}\bthat damage is dealt to that source'?s controller instead\b/.test(text) ||
    /\ball damage that would be dealt\b[^.]{0,180}\bby target sorcery spell\b[^.]{0,120}\bis dealt to that spell'?s controller instead\b/.test(text) ||
    /\bdeals damage to that player equal to half the damage dealt by one of those sorcery spells\b/.test(text) ||
    /\bwhenever enchanted creature is dealt damage\b[^.]{0,140}\bdeals? that much damage to that creature'?s controller\b/.test(text) ||
    /\bthe next time a source of your choice would deal damage to you\b[^.]{0,180}\bthat damage is dealt to target creature\b/.test(text)
  ) {
    addRole(profile, "damage_reflection", 0.5, "Advanced scan recognized damage-reflection text.");
    addRole(profile, "damage_engine", 0.36, "Advanced scan recognized reflected damage pressure.");
  }

  if (/\b(?:islandwalk|swampwalk|plainswalk|mountainwalk|forestwalk|desertwalk|landwalk)\b/.test(text)) {
    addRole(profile, "landwalk_support", 0.38, "Advanced scan recognized landwalk or landwalk-granting text.");
    addRole(profile, "combat_support", 0.28, "Advanced scan recognized landwalk as combat evasion.");
  }

  if (/\bprevent all damage deserts would deal\b/.test(text)) {
    addRole(profile, "desert_hate", 0.26, "Advanced scan recognized Desert-specific prevention text.");
    addRole(profile, "self_protection", 0.18, "Advanced scan recognized narrow self-protection.");
  }

  if (/\bthe next time target land would be destroyed this turn\b/.test(text)) {
    addRole(profile, "land_protection", 0.46, "Advanced scan recognized land-protection text.");
  }

  if (
    /\btarget creature defending player controls can block any number of creatures\b/.test(text) ||
    /\bremove target creature defending player controls from combat\b/.test(text) ||
    /\ball creatures able to block enchanted creature do so\b/.test(text) ||
    /\bcreatures with flying can block only creatures with flying\b/.test(text) ||
    /\bcreatures without flying have reach\b/.test(text)
  ) {
    addRole(profile, "combat_support", 0.48, "Advanced scan recognized a combat-manipulation effect.");
    addRole(profile, "tempo_support", 0.36, "Advanced scan recognized combat manipulation as tempo utility.");
  }

  if (
    /\blook at target (?:player|opponent)'?s hand\b|\bplayers play with their hands revealed\b/.test(text) ||
    /\btarget player reveals their hand\b/.test(text) ||
    /\btarget player reveals a card at random from their hand\b/.test(text)
  ) {
    addRole(profile, "hand_info", 0.28, "Advanced scan recognized hand-information utility.");
  }

  if (
    /\blook at the top (?:three|five|\d+) cards of target player'?s library\b/.test(text) ||
    /\btarget player looks at the top (?:three|five|\d+) cards of their library\b/.test(text) ||
    /\btarget player chooses a card name\b[^.]{0,140}\breveals? the top card of their library\b/.test(text)
  ) {
    addRole(profile, "selection", 0.36, "Advanced scan recognized top-of-library ordering utility.");
    addRole(profile, "topdeck_control", 0.34, "Advanced scan recognized top-of-library ordering utility.");
  }

  if (/\bplayers play with the top card of their libraries revealed\b/.test(text)) {
    addRole(profile, "topdeck_info", 0.3, "Advanced scan recognized top-of-library information.");
    addRole(profile, "selection", 0.22, "Advanced scan recognized revealed-library information as planning utility.");
  }

  if (/\bput any number of target\b[^.]{0,160}\bfrom target player's graveyard on top of their library\b/.test(text)) {
    addRole(profile, "topdeck_control", 0.42, "Advanced scan recognized graveyard-to-library ordering utility.");
  }

  if (/\bput up to\b[^.]{0,80}\btarget cards? from an opponent'?s graveyard on top of their library\b/.test(text)) {
    addRole(profile, "topdeck_control", 0.42, "Advanced scan recognized graveyard-to-library ordering utility.");
    addRole(profile, "graveyard_hate", 0.34, "Advanced scan recognized opposing graveyard disruption.");
  }

  if (/\byou control that player\b/.test(text)) {
    addRole(profile, "player_control", 0.46, "Advanced scan recognized player-control utility.");
    addRole(profile, "theft_support", 0.34, "Advanced scan recognized control of another player's choices.");
  }

  if (/\byou have no maximum hand size\b|\bmaximum hand size is (?:four|three|two|one|\d+)\b/.test(text)) {
    addRole(profile, "hand_size", 0.34, "Advanced scan recognized maximum-hand-size utility.");
  }

  if (/\bchosen player's maximum hand size is (?:four|three|two|one|\d+)\b/.test(text)) {
    addRole(profile, "hand_denial", 0.46, "Advanced scan recognized opponent hand-size pressure.");
    addRole(profile, "hate_piece", 0.38, "Advanced scan recognized hand-size pressure as a hate piece.");
  }

  if (/\btarget player chooses\b[^.]{0,80}\bcards? from their hand\b[^.]{0,120}\bputs? them on top of their library\b/.test(text)) {
    addRole(profile, "hand_denial", 0.48, "Advanced scan recognized hand-to-library denial.");
    addRole(profile, "topdeck_control", 0.42, "Advanced scan recognized hand-to-library denial.");
  }

  if (/\bdiscard it, but you may put it on top of your library instead of into your graveyard\b/.test(text)) {
    addRole(profile, "discard_protection", 0.38, "Advanced scan recognized discard replacement utility.");
    addRole(profile, "protection", 0.26, "Advanced scan recognized discard replacement as a resilience tool.");
  }

  if (
    /\battach target aura attached to a creature or land to another permanent of that type\b/.test(text) ||
    /\battach target aura attached to a creature to another creature\b/.test(text)
  ) {
    addRole(profile, "aura_support", 0.36, "Advanced scan recognized Aura attachment utility.");
    addRole(profile, "attachment_support", 0.32, "Advanced scan recognized attachment-moving utility.");
  }

  if (diceText) {
    addRole(profile, "dice_support", permanent ? 0.66 : 0.52, "Advanced scan recognized dice-roll support.");
  }

  if (coinText) {
    addRole(profile, "coin_support", permanent ? 0.66 : 0.52, "Advanced scan recognized coin-flip support.");
  }

  if (replacementText) {
    addRole(profile, "replacement_engine", permanent ? 0.62 : 0.5, "Advanced scan recognized a replacement or multiplier effect.");
  }

  if (hasDoublerOrMultiplierText(text)) {
    addRole(profile, "replacement_engine", permanent ? 0.72 : 0.56, "Advanced scan recognized a doubler or multiplier effect.");
    addRole(profile, "multiplier_support", permanent ? 0.72 : 0.56, "Advanced scan recognized a doubler or multiplier effect.");
  }

  if (flashEnablerText) {
    addRole(profile, "replacement_engine", permanent ? 0.64 : 0.52, "Advanced scan recognized flash or timing-rule support.");
    addRole(profile, "tempo_support", permanent ? 0.58 : 0.48, "Advanced scan recognized flash or timing-rule support.");
  }

  if (libraryAccessKeyword || /\bdiscover (?:x|\d+)\b|\bcascade\b/.test(text)) {
    addRole(profile, "draw", permanent ? 0.7 : 0.62, "Advanced scan recognized cascade/discover as library access.");
    addRole(profile, "selection", permanent ? 0.72 : 0.64, "Advanced scan recognized cascade/discover as library access.");
    addRole(profile, "cost_reduction", permanent ? 0.5 : 0.44, "Advanced scan recognized free-cast library access.");
    if (permanent && isRepeatableText(text, permanent)) {
      addRole(profile, "repeatable_advantage", 0.76, "Advanced scan recognized repeatable library access.");
    }
  }

  if (delayedCastKeyword) {
    addRole(profile, "selection", permanent ? 0.5 : 0.42, "Advanced scan recognized delayed-cast setup.");
    addRole(profile, "cost_reduction", permanent ? 0.42 : 0.36, "Advanced scan recognized alternate timing or setup cost.");
  }

  if (/\beach player may put a permanent card from their hand onto the battlefield\b/.test(text)) {
    addRole(profile, "cheat_into_play", 0.54, "Advanced scan recognized permanent cheat-into-play text.");
    addRole(profile, "cost_reduction", 0.42, "Advanced scan recognized putting permanents from hand onto the battlefield as mana-equivalent setup.");
  }

  if (graveyardCastKeyword || graveyardBodyKeyword) {
    addRole(
      profile,
      "graveyard_support",
      graveyardBodyKeyword ? 0.58 : 0.48,
      "Advanced scan recognized self-contained graveyard reuse.",
    );
  }

  if (selectionKeyword || /\bscry \d+\b|\bsurveil \d+\b|\bconnive\b|\bexplores?\b|\blearn\b/.test(text)) {
    addRole(profile, "selection", permanent ? 0.5 : 0.42, "Advanced scan recognized card selection or filtering.");
  }

  if (dungeonKeyword || /\b(?:take|takes) the initiative\b|\bventure into the dungeon\b|\bcomplete a dungeon\b/.test(text)) {
    addRole(profile, "dungeon_support", permanent ? 0.58 : 0.48, "Advanced scan recognized dungeon or initiative support.");
    addRole(profile, "repeatable_advantage", permanent ? 0.42 : 0.34, "Advanced scan recognized dungeon progress as incremental value.");
  }

  if (faceDownText) {
    addRole(
      profile,
      "face_down_support",
      permanent ? 0.68 : 0.54,
      "Advanced scan recognized face-down, morph, manifest, cloak, or disguise support.",
    );
  }

  if (
    /\bcreates?\b[^.]{0,140}\btokens?\b|\bpopulate\b|\btokens you control\b/.test(text) ||
    tokenKeyword ||
    /\bput\b[^.]{0,140}\b(?:creature|artifact creature|egg artifact creature)\s+token\b[^.]{0,120}\bonto the battlefield\b/.test(text) ||
    /\btokens? would be created\b[\s\S]{0,180}\b(?:twice that many|that many plus|additional)\b/.test(text) ||
    /\bcreate\b[\s\S]{0,120}\b(?:twice that many|that many plus|additional)\b[\s\S]{0,80}\btokens?\b/.test(text)
  ) {
    if (!/\b(?:target opponent|an opponent|its controller|that player) creates?\b/.test(text)) {
      addRole(profile, "token_support", permanent ? 0.68 : 0.58, "Advanced scan recognized token support.");
    }
  }

  const opponentOrCompensationLifegain =
    /\b(?:target opponent|its controller|that player|that spell'?s controller) gains?\b[^.]{0,40}\blife\b/.test(text) &&
    !/\byou gain\b[^.]{0,40}\blife\b/.test(text);
  if (
    (/\bgain(?:s)?\b[^.]{0,40}\blife\b|\bwhenever you gain life\b|\blifelink\b/.test(text)) &&
    !opponentOrCompensationLifegain
  ) {
    addRole(profile, "lifegain", permanent ? 0.58 : 0.46, "Advanced scan recognized lifegain support.");
  }

  if (/\b(?:take|takes) (?:an|one|two|three|x|that many) extra turns?\b/.test(text)) {
    addRole(profile, "extra_turn", 0.86, "Advanced scan recognized extra-turn text.");
    addRole(profile, "finisher", 0.58, "Advanced scan recognized extra turns as closing pressure.");
  }

  if (
    /\btarget player activates a mana ability of each land they control\b/.test(text) ||
    /\btap all lands target player controls\b/.test(text) ||
    /\btap (?:x|one|two|three|four|five|six|\d+) target lands?\b/.test(text) ||
    /\btarget player\b[^.]{0,120}\bloses all unspent mana\b/.test(text) ||
    /\bdestroy that land unless (?:that|any) player pays\b/.test(text) ||
    /\blands tapped for mana produce mana of the chosen color instead\b/.test(text) ||
    /\bwhen this enchantment enters, tap all (?:plains|islands|swamps|mountains|forests)\b/.test(text) ||
    /\b(?:plains|islands|swamps|mountains|forests)\b[^.]{0,120}\bdon't untap during their controllers'? untap steps\b/.test(text)
  ) {
    addRole(profile, "mana_denial", 0.72, "Advanced scan recognized mana-denial text.");
    addRole(profile, "land_denial", 0.52, "Advanced scan recognized land-based mana denial.");
    addRole(profile, "hate_piece", 0.52, "Advanced scan recognized mana denial as a hate piece.");
  }

  if (/\blands with the chosen names can'?t be played\b/.test(text)) {
    addRole(profile, "land_denial", 0.36, "Advanced scan recognized a named-land play restriction.");
    addRole(profile, "hate_piece", 0.42, "Advanced scan recognized a named-card restriction as a hate piece.");
    addRole(profile, "stax_piece", 0.38, "Advanced scan recognized a named-card play restriction.");
  }

  if (
    /\bwhenever a player casts\b[^.]{0,80}\b(?:spell|enchantment spell)\b[^.]{0,80}\bcounter it\b/.test(text) ||
    /\blegendary creatures don'?t untap during their controllers'? untap steps\b/.test(text) ||
    /\bcreatures without flying don't untap during their controllers'? untap steps\b/.test(text) ||
    /\bcreatures of the chosen type don't untap during their controllers'? untap steps\b/.test(text) ||
    /\b(?:plains|islands|swamps|mountains|forests)\b[^.]{0,120}\bdon't untap during their controllers'? untap steps\b/.test(text)
  ) {
    addRole(profile, "hate_piece", 0.58, "Advanced scan recognized a spell or untap lock as a hate piece.");
    addRole(profile, "stax_piece", 0.62, "Advanced scan recognized a spell or untap lock.");
  }

  if (/\bwhenever an artifact becomes tapped\b[^.]{0,220}\bdeals? \d+ damage to that artifact's controller\b/.test(text)) {
    addRole(profile, "artifact_hate", 0.52, "Advanced scan recognized artifact-punisher text.");
    addRole(profile, "hate_piece", 0.44, "Advanced scan recognized artifact pressure as a hate piece.");
  }

  if (
    /\bat the beginning of (?:each player's upkeep|the upkeep of enchanted [^.]{0,80} controller)\b[^.]{0,180}\bdeals? (?:\d+ damage|damage to that player equal to|damage [^.]{0,80} equal to) (?:to )?(?:that player|enchanted .* controller|enchanted .*'s controller)?\b/.test(text) ||
    /\bat the beginning of (?:each opponent'?s upkeep|each player'?s end step)\b[^.]{0,220}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bwhenever an opponent casts a creature spell\b[^.]{0,160}\bdeals? \d+ damage to that player unless they pay\b/.test(text) ||
    /\bat the beginning of your upkeep\b[^.]{0,80}\bfor each player\b[^.]{0,120}\bdeals? \d+ damage to that player unless they pay\b/.test(text) ||
    /\bat the beginning of the upkeep of enchanted creature'?s controller\b[\s\S]{0,220}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bwhenever enchanted creature becomes tapped\b[^.]{0,120}\bdeals? \d+ damage to that creature'?s controller\b/.test(text) ||
    /\btarget player chooses a card name\b[\s\S]{0,220}\bdeals? \d+ damage to them\b/.test(text) ||
    /\bwhenever enchanted creature deals damage to you\b[^.]{0,160}\bdeals? that much damage to that creature'?s controller\b/.test(text) ||
    /\bwhenever an opponent draws a card\b[^.]{0,140}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bwhenever a player taps a land for mana\b[^.]{0,160}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bwhenever an artifact becomes tapped\b[^.]{0,220}\bdeals? \d+ damage to that artifact's controller\b/.test(text) ||
    /\bwhenever enchanted (?:land|artifact) becomes tapped\b[^.]{0,160}\bdeals? \d+ damage to that (?:land|artifact)'?s controller\b/.test(text) ||
    /\bwhenever a land enters\b[^.]{0,160}\bdeals? \d+ damage to that land'?s controller\b/.test(text) ||
    /\bwhenever a land is put into a graveyard\b[^.]{0,180}\bdeals? \d+ damage to that land'?s controller\b/.test(text) ||
    /\beach player may discard\b[\s\S]{0,160}\bdeals damage to each player\b/.test(text) ||
    /\b(?:deals? (?:x|\d+) damage|deals? damage equal to [^.]{0,80}) to each creature\b[^.]{0,80}\band each player\b/.test(text)
  ) {
    addRole(profile, "group_slug", 0.62, "Advanced scan recognized repeatable table damage.");
    addRole(profile, "damage_engine", 0.56, "Advanced scan recognized repeatable damage pressure.");
  }

  if (
    /\bdeals damage to target player equal to the number of cards in that player'?s hand\b/.test(text) ||
    /\bdeals damage to that player equal to the number of white cards in their hand\b/.test(text) ||
    /\bdeals damage to each opponent equal to the number of islands that player controls\b/.test(text)
  ) {
    addRole(profile, "direct_finisher", 0.54, "Advanced scan recognized scalable direct player damage.");
    addRole(profile, "finisher", 0.42, "Advanced scan recognized scalable player damage as closing pressure.");
  }

  if (/\bexchange life totals with (?:target|that) player\b/.test(text)) {
    addRole(profile, "lifegain", 0.34, "Advanced scan recognized life-total exchange utility.");
    addRole(profile, "life_pressure", 0.3, "Advanced scan recognized life-total exchange pressure.");
  }

  if (
    /\battacks?\b|\bcombat damage\b|\bcreatures you control get\b|\battacking creatures\b|\bcan't be blocked\b|\bgoad\b/.test(
      text,
    ) ||
    /\bcreatures? (?:can't|can not) block\b/.test(text) ||
    /\b(?:all |other |face-down |attacking |blocking |tapped |untapped )?(?:creatures?|creature tokens?|zombies|skeletons|elves|goblins|dragons|vampires|soldiers|warriors|slivers|eldrazi|angels|humans|wizards|rogues|knights|merfolk|pirates|cats|beasts|tokens)(?: you control)?\b[^.]{0,160}\b(?:get|gets) (?:\+\d+\/\+\d+|\+\d+\/\+0|\+0\/\+\d+|\+x\/\+x)\b/.test(text) ||
    /\b(?:creatures?|employees|dogs|tokens)(?: and (?:creatures?|employees|dogs|tokens))? you control\b[^.]{0,160}\b(?:get|gets) (?:\+x\/\+\d+|\+x\/\+0|\+\d+\/\+\d+|\+\d+\/\+0|\+0\/\+\d+|\+x\/\+x)\b/.test(text) ||
    /\bother (?:zombies|skeletons|elves|goblins|dragons|vampires|soldiers|warriors|slivers|eldrazi|angels|humans|wizards|rogues|knights|merfolk|pirates|cats|beasts)\b[^.]{0,140}\byou control get \+\d+\/\+\d+\b/.test(text) ||
    /\ball (?:zombies|skeletons|elves|goblins|dragons|vampires|soldiers|warriors|slivers|eldrazi|angels|humans|wizards|rogues|knights|merfolk|pirates|cats|beasts)\b[^.]{0,120}\bgain\b/.test(text) ||
    /\b(?:all |other |face-down |attacking |blocking |tapped |untapped )?(?:creatures?|creature tokens?|sliver creatures|knight creatures|zombies|skeletons|elves|goblins|dragons|vampires|soldiers|warriors|slivers|eldrazi|angels|humans|wizards|rogues|knights|merfolk|pirates|cats|beasts)(?: you control)?\b[^.]{0,160}\b(?:gain|gains|have|has)\b[^.]{0,120}\b(?:flying|haste|double strike|first strike|menace|trample|lifelink|vigilance|deathtouch|indestructible|ward)\b/.test(text) ||
    /\bcreatures you control gain haste\b/.test(text) ||
    /\bcreatures your opponents control\b[^.]{0,120}\bcan'?t block\b/.test(text) ||
    /\ball creatures lose flying\b/.test(text) ||
    /\btap all (?:non(?:blue|white|black|red|green)|blue|white|black|red|green)? ?creatures\b/.test(text) ||
    /\btarget creature doesn't untap during its controller'?s next untap step\b/.test(text) ||
    /\btarget creature blocks this turn if able\b/.test(text) ||
    /\btarget creature defending player controls can block any number of creatures\b/.test(text) ||
    /\bcreatures without flying don't untap during their controllers'? untap steps\b/.test(text) ||
    /\bcreatures of the chosen type don't untap during their controllers'? untap steps\b/.test(text) ||
    /\ball creatures able to block enchanted creature do so\b/.test(text) ||
    /\btarget creature attacks target opponent this turn if able\b/.test(text) ||
    /\b(?:target creature|creature you control|equipped creature|enchanted creature)\b[^.]{0,140}\bgets? (?:\+\d+\/\+\d+|\+x\/\+x)\b/.test(text) ||
    /\bit gets? \+\d+\/\+\d+ until end of turn\b/.test(text) ||
    /\b(?:target creature|creature you control|equipped creature|enchanted creature)\b[^.]{0,140}\bgets? \+\d+\/-\d+\b/.test(text) ||
    /\benchanted creature\b[^.]{0,140}\bgets? -(?:x|\d+)\/-(?:y|\d+)\b/.test(text) ||
    combatKeywordSupport ||
    /\bgets? (?:\+\d+\/\+\d+|\+x\/\+x) for each\b/.test(text) ||
    /\bpower and toughness (?:are )?each equal to\b/.test(text) ||
    /\bhas power and toughness equal to\b/.test(text) ||
    /\bswitch (?:target creature'?s|the) power and toughness\b/.test(text) ||
    /\bdistribute x \+\d+\/\+\d+ counters?\b/.test(text) ||
    /\bhave base power and toughness x\/x\b/.test(text) ||
    /\bequipped creature\b[^.]{0,120}\b(?:gets|has|gains)\b[^.]{0,120}(?:\+\d+\/\+\d+|\+\d+\/\+0|\b(?:trample|double strike|first strike|menace|flying|lifelink)\b)/.test(text) ||
    /\btarget creature gains\b[^.]{0,120}\b(?:haste|first strike|double strike|trample|menace|flying)\b/.test(text)
  ) {
    addRole(profile, "combat_support", permanent ? 0.64 : 0.52, "Advanced scan recognized combat support.");
  }

  if (isCreatureCard(card) && hasCombatKeyword(card)) {
    addRole(profile, "combat_threat", 0.44, "Advanced scan recognized a combat-relevant body.");
  }

  if (isCreatureCard(card) && !hasCardType(card, "Land")) {
    addRole(profile, "combat_body", 0.12, "Advanced scan recognized a creature body.");
  }

  if (
    /\bplayers can't search libraries\b|\bopponents can't search libraries\b|\byour opponents can'?t search\b|\bcan'?t cast\b|\bskip\b|\bspells cost\b[^.]{0,80}\bmore\b|\btarget enchantment\b[^.]{0,160}\bdamage\b|\bgain control of target artifact\b/.test(
      text,
    ) ||
    /\beach nontoken permanent\b[^.]{0,120}\bis sacrificed by its controller\b/.test(text) ||
    /\b(?:blue creatures|creatures with power \d+ or greater|creatures of the chosen type) don't untap during (?:their|their controllers'?) untap steps\b/.test(text) ||
    /\bspells you control can'?t be countered\b/.test(text) ||
    /\btarget player puts all the cards from their graveyard on the bottom of their library\b/.test(text)
  ) {
    addRole(profile, "hate_piece", 0.72, "Advanced scan recognized a hate or tax piece.");
  }

  if (/\btarget player loses all poison counters\b/.test(text)) {
    addRole(profile, "poison_hate", 0.34, "Advanced scan recognized poison-counter removal.");
    addRole(profile, "hate_piece", 0.24, "Advanced scan recognized poison-counter removal as narrow hate.");
  }

  if (
    /\bsacrifice\b|\bwhenever\b[^.]{0,120}\bdies\b|\bwhen\b[^.]{0,120}\bdies\b/.test(text) ||
    /\b(?:creature|artifact|permanent)s? dying causes a triggered ability\b[^.]{0,180}\btriggers? an additional time\b/.test(text) ||
    /\b(?:creature|artifact|permanent)s? dying\b[^.]{0,160}\btriggered ability\b[^.]{0,160}\badditional time\b/.test(text)
  ) {
    addRole(profile, "sacrifice_support", 0.58, "Advanced scan recognized sacrifice or death-trigger support.");
  }

  if (
    /\b\+\d+\/\+\d+ counters?\b|\bcounters? on\b|\bproliferate\b|\bmove (?:a|any number of) counters?\b/.test(text) ||
    /\bdistribute\b[^.]{0,120}[+-]\d+\/[+-]\d+ counters? among\b/.test(text) ||
    hasAnyKeyword(keywords, ["proliferate", "support", "backup", "adapt", "monstrosity", "level up"]) ||
    /\bcounters? would be (?:put|placed)\b[\s\S]{0,180}\b(?:that many plus|additional|twice that many)\b/.test(text)
  ) {
    addRole(profile, "counter_support", 0.58, "Advanced scan recognized counter support.");
  }

  if (/\benergy counters?\b|\bpay \{e\}/.test(text)) {
    addRole(profile, "energy_support", permanent ? 0.58 : 0.46, "Advanced scan recognized energy support.");
  }

  if (/\bmills?\b|\bmill\b|\bputs? the rest of the revealed cards into their graveyard\b/.test(text)) {
    addRole(profile, "mill_support", 0.52, "Advanced scan recognized mill or graveyard-filling support.");
  }

  if (
    /\bgain control of\b|\byou control enchanted (?:creature|artifact|permanent)\b|\bput that card onto the battlefield under your control\b/.test(text) ||
    /\bput target creature card from an opponent'?s graveyard onto the battlefield under your control\b/.test(text) ||
    /\byou control enchanted land\b/.test(text) ||
    /\bexchange control of\b[^.]{0,220}\b(?:target|two|creature|artifact|enchantment|permanent|spell)\b/.test(text) ||
    /\bexile\b[^.]{0,180}\b(?:target|an opponent'?s|opponent'?s)\b[^.]{0,180}\byou may (?:cast|play)\b/.test(text) ||
    /\byou may (?:cast|play)\b[^.]{0,180}\bfrom (?:an|your) opponents?'? (?:graveyard|library|hand|exile)\b/.test(text) ||
    /\byou may (?:cast|play) spells? from (?:an opponent'?s|opponents?'?) (?:graveyard|library|hand|exile)\b/.test(text) ||
    /\bthat player owns from exile onto the battlefield under your control\b/.test(text) ||
    /\btarget opponent exiles cards\b[\s\S]{0,260}\byou may cast\b/.test(text)
  ) {
    addRole(profile, "theft_support", 0.5, "Advanced scan recognized theft or borrowed-resource support.");
  }

  if (
    /\b(?:target|an|each) opponent gains? control of\b/.test(text) ||
    /\bgains? control of target\b[^.]{0,140}\byou control\b/.test(text) ||
    /\bexchange control of\b[^.]{0,220}\b(?:target|two|creature|artifact|enchantment|permanent|spell)\b/.test(text) ||
    /\byou own\b[^.]{0,180}\b(?:an opponent controls|opponent controls)\b/.test(text) ||
    /\bpermanents? you own but don'?t control\b/.test(text) ||
    /\btarget opponent (?:creates?|gains?|may draw)\b/.test(text)
  ) {
    addRole(profile, "donation_support", permanent ? 0.64 : 0.56, "Advanced scan recognized donation, exchange, or political control-transfer support.");
  }

  if (
    /\bartifacts? you control\b|\bartifact you control\b|\bartifact or creature entering\b|\bnoncreature, non-equipment artifacts\b|\bequipped creature\b/.test(text) ||
    /\bput\b[^.]{0,140}\bartifact card from your hand\b[^.]{0,100}\bonto the battlefield\b/.test(text)
  ) {
    addRole(profile, "artifact_support", 0.54, "Advanced scan recognized artifact support.");
  }

  if (
    /\bcopy of\b|\bbecomes a copy\b|\bcopy that spell or ability\b/.test(text) ||
    /\bcopy (?:target|that|the)\b[^.]{0,120}\b(?:spell|instant|sorcery|ability)\b/.test(text) ||
    /\btriggered ability\b[\s\S]{0,120}\btriggers? an additional time\b/.test(text)
  ) {
    addRole(profile, "copy_support", 0.52, "Advanced scan recognized copy-based utility.");
  }

  if (
    /\bchangeling\b/.test(text) ||
    /\bgains? all creature types\b/.test(text) ||
    /\bloses? all creature types\b/.test(text) ||
    /\bcreatures you control are the chosen type\b/.test(text) ||
    /\bcreature spells you control\b[^.]{0,160}\bchosen type\b/.test(text)
  ) {
    addRole(profile, "kindred_support", permanent ? 0.58 : 0.48, "Advanced scan recognized kindred or creature-type support.");
  }

  if (/\bcreatures you control have all activated abilities of all land cards exiled\b/.test(text)) {
    addRole(profile, "land_synergy", 0.56, "Advanced scan recognized land-ability synergy.");
    addRole(profile, "ramp", 0.42, "Advanced scan recognized land abilities as potential mana access.");
  }
}

function detectAdvancedScalableSpellRoles(
  profile: CardRoleProfile,
  text: string,
  card: ScryfallCard,
) {
  const hasXCost = hasXInManaCost(card);
  const hasXEffect = hasScalableXEffectText(text);

  if (!hasXCost && !hasXEffect) {
    return;
  }

  const permanent = isPermanentCard(card);
  addRole(
    profile,
    "scalable_spell",
    hasXCost ? 0.66 : 0.5,
    hasXCost
      ? "Advanced scan recognized an X-cost spell that scales with available mana."
      : "Advanced scan recognized an effect that scales from an X value.",
  );

  if (hasXCost) {
    addRole(
      profile,
      "mana_sink",
      permanent ? 0.5 : 0.6,
      "Advanced scan recognized a scalable mana sink.",
    );
  }

  if (hasXDamageText(text) && hasXPlayerDamageText(text)) {
    addRole(profile, "finisher", 0.74, "Advanced scan recognized scalable X damage as a mana-sink finisher.");
    addRole(profile, "direct_finisher", 0.76, "Advanced scan recognized scalable X damage as a mana-sink finisher.");
  }

  if (hasXDamageText(text) && hasXTargetedDamageText(text)) {
    addRole(profile, "removal", 0.66, "Advanced scan recognized scalable X damage as battlefield interaction.");
    addRole(profile, "targeted_removal", 0.62, "Advanced scan recognized scalable X damage as battlefield interaction.");
  }

  if (hasXDamageText(text) && hasXCreatureDamageText(text)) {
    addRole(profile, "removal", 0.66, "Advanced scan recognized scalable X creature damage as battlefield interaction.");
    addRole(profile, "mass_removal", 0.6, "Advanced scan recognized scalable X creature damage as broad battlefield interaction.");
  }

  if (hasXLifeLossText(text)) {
    addRole(profile, "finisher", 0.82, "Advanced scan recognized scalable X life-loss as a finisher.");
    addRole(profile, "direct_finisher", 0.84, "Advanced scan recognized scalable X life-loss as a finisher.");
  }

  if (hasXDrawText(text)) {
    addRole(profile, "draw", 0.86, "Advanced scan recognized scalable X card draw.");
    addRole(profile, "direct_draw", 0.82, "Advanced scan recognized scalable X card draw.");
  }

  if (hasXTokenText(text)) {
    addRole(profile, "token_support", 0.76, "Advanced scan recognized scalable X token production.");
    addRole(profile, "combat_support", 0.48, "Advanced scan recognized scalable X token production.");
  }

  if (hasXTutorText(text)) {
    addRole(profile, "tutor", 0.76, "Advanced scan recognized scalable X search or battlefield access.");
    addRole(profile, "restricted_tutor", 0.76, "Advanced scan recognized scalable X search or battlefield access.");
  }

  if (hasXRemovalText(text)) {
    addRole(profile, "removal", 0.72, "Advanced scan recognized scalable X removal.");
    addRole(
      profile,
      /\b(?:each|all)\b[^.]{0,80}\b(?:creatures?|artifacts?|enchantments?|permanents?|nonland permanents?)\b/.test(text)
        ? "mass_removal"
        : "targeted_removal",
      0.72,
      "Advanced scan recognized scalable X removal.",
    );
  }

  if (hasXMillText(text)) {
    addRole(profile, "mill_support", 0.62, "Advanced scan recognized scalable X mill.");
    addRole(profile, "alternate_finisher", 0.46, "Advanced scan recognized scalable X mill as a possible alternate finisher.");
  }

  if (hasXCounterOrPumpText(text)) {
    addRole(profile, "counter_support", 0.64, "Advanced scan recognized scalable X counters or pump.");
    addRole(profile, "combat_support", 0.58, "Advanced scan recognized scalable X counters or pump.");
  }
}

function hasAnyKeyword(keywords: Set<string>, values: string[]) {
  return values.some((value) => keywords.has(normalizeKeyword(value)));
}

function normalizeKeyword(keyword: string) {
  return keyword
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasDiceText(text: string) {
  return (
    /\broll(?:s|ed|ing)?\b[\s\S]{0,100}\b(?:die|dice|d\d+)\b/.test(text) ||
    /\bwhenever you roll\b/.test(text) ||
    /\bif you would roll\b/.test(text) ||
    /\bd20\b|\bd12\b|\bd10\b|\bd8\b|\bd6\b|\bd4\b/.test(text)
  );
}

function hasCoinFlipText(text: string) {
  return (
    /\bflip(?:s|ped|ping)?\b[\s\S]{0,80}\bcoins?\b/.test(text) ||
    /\bcoin flips?\b|\bwin(?:s|ning)? a flip\b|\blose(?:s|ing)? a flip\b/.test(text) ||
    /\bif you would flip\b/.test(text)
  );
}

function hasReplacementText(text: string) {
  return (
    /\bif\b[\s\S]{0,180}\bwould\b[\s\S]{0,180}\binstead\b/.test(text) ||
    /\breplacement effect\b/.test(text) ||
    /\bas though\b/.test(text) ||
    /\btriggered ability\b[\s\S]{0,120}\btriggers? an additional time\b/.test(text) ||
    /\bignore (?:the|one of those)\b[\s\S]{0,80}\b(?:rolls?|flips?)\b/.test(text)
  );
}

function hasDoublerOrMultiplierText(text: string) {
  return (
    /\bif\b[\s\S]{0,180}\bwould\b[\s\S]{0,180}\b(?:twice|double|additional)\b[\s\S]{0,140}\binstead\b/.test(text) ||
    /\btriggers? an additional time\b/.test(text) ||
    /\btriggered ability\b[\s\S]{0,160}\btriggers?[^.]{0,80}\badditional time\b/.test(text) ||
    /\b(?:double|doubles?)\b[^.]{0,160}\b(?:counters?|tokens?|mana|power|toughness|damage|life|life total)\b/.test(text) ||
    /\btwice (?:that many|the number|as much)\b/.test(text) ||
    /\badditional (?:time|counter|token|mana|combat phase|copy)\b/.test(text)
  );
}

function hasXInManaCost(card: ScryfallCard) {
  const costs = [card.mana_cost, ...(card.card_faces?.map((face) => face.mana_cost) ?? [])];
  return costs.some((cost) => /\{x\}/i.test(cost ?? ""));
}

function hasTopLibraryFilteringText(text: string) {
  return (
    /\blook at the top (?:x|\d+|one|two|three|four|five|six|seven|a|an) cards? of your library\b[\s\S]{0,180}\bput (?:them|those cards|the rest|any number of them|that card|it)\b[\s\S]{0,120}\b(?:back|on top|on the bottom|into your graveyard)\b/.test(
      text,
    ) ||
    /\brearrange\b[\s\S]{0,120}\btop (?:x|\d+|one|two|three|four|five|six|seven|a|an) cards? of your library\b/.test(
      text,
    )
  );
}

function hasSelfReplacingTopDrawText(text: string) {
  return /\bdraw a card\b[^.]{0,120}\bput [^.]{0,100}\bon top of (?:its|your) owner'?s library\b/.test(
    text,
  );
}

function hasSelfContainedGraveyardCastText(text: string) {
  return (
    /\byou may cast this card from your graveyard\b/.test(text) ||
    (/\bflashback\b/.test(text) &&
      !/\btarget\b[^.]{0,120}\bcard in your graveyard\b[^.]{0,180}\bgains flashback\b/.test(
        text,
      ) &&
      !/\bcards? in your graveyard\b[^.]{0,180}\b(?:has|have|gains?) flashback\b/.test(text))
  );
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
  return (
    /\bdeals? (?:\w+\s+times\s+)?x damage\b/.test(text) ||
    /\bdeals? damage equal to x\b/.test(text)
  );
}

function hasXTargetedDamageText(text: string) {
  return (
    /\bdeals? (?:\w+\s+times\s+)?x damage to (?:any (?:other )?target|target\b|each of up to x targets?)\b/.test(text) ||
    /\bdeals? (?:\w+\s+times\s+)?x damage divided as you choose\b/.test(text) ||
    /\bdeals? (?:\w+\s+times\s+)?x damage divided\b[^.]{0,120}\bamong any number of targets?\b/.test(text)
  );
}

function hasXPlayerDamageText(text: string) {
  return /\bdeals? (?:\w+\s+times\s+)?x damage\b[^.]{0,160}\b(?:any target|any number of targets?(?!\s+creatures?\b)|target player|target opponent(?! controls)|each (?:player|opponent)|each opponent)\b/.test(
    text,
  );
}

function hasXCreatureDamageText(text: string) {
  return /\bdeals? (?:\w+\s+times\s+)?x damage\b[^.]{0,160}\b(?:target creature|all creatures|each creature|creatures target opponent controls|creatures? [^.]{0,80} controls)\b/.test(
    text,
  );
}

function hasXLifeLossText(text: string) {
  return /\b(?:each opponent|target opponent|target player|each player)\b[^.]{0,120}\bloses? x life\b/.test(text);
}

function hasXDrawText(text: string) {
  return (
    /\bdraw x cards?\b/.test(text) ||
    /\bdraw cards? equal to x\b/.test(text) ||
    /\btarget player draws x cards?\b/.test(text)
  );
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
    /\b\+x\/\+0\b/.test(text) ||
    /\bx \+\d+\/\+\d+ counters?\b/.test(text) ||
    /\bput x \+\d+\/\+\d+ counters?\b/.test(text) ||
    /\bdistribute x \+\d+\/\+\d+ counters?\b/.test(text) ||
    /\bbase power and toughness x\/x\b/.test(text)
  );
}

function hasFaceDownPurposeText(text: string, keywords: string[] = []) {
  return (
    /\bface-down\b|\bface down\b|\bface-up\b|\bface up\b|\bturned face up\b|\bturn\b[\s\S]{0,80}\bface (?:up|down)\b/.test(text) ||
    /\bturned\b[\s\S]{0,80}\bface up\b/.test(text) ||
    /\b(?:morph|megamorph|manifest|manifest dread|cloak|disguise|cloak it|cloak that card)\b/.test(text) ||
    keywords.some((keyword) =>
      ["Morph", "Megamorph", "Manifest", "Manifest Dread", "Cloak", "Disguise"].includes(keyword),
    )
  );
}

function hasFlashEnablerText(text: string) {
  return (
    /\byou may cast\b[^.]{0,180}\bas though (?:they|it|those cards?|that card) had flash\b/.test(text) ||
    /\byou may cast spells as though they had flash\b/.test(text) ||
    /\byou may cast\b[^.]{0,80}\bspells?\b[^.]{0,120}\bas though (?:they|it) had flash\b/.test(text) ||
    /\byou may cast\b[^.]{0,180}\bany time you could cast an instant\b/.test(text) ||
    /\b(?:creature|artifact|enchantment|nonland|permanent|historic|legendary|sorcery|planeswalker) spells? you cast have flash\b/.test(text) ||
    /\byou may play\b[^.]{0,180}\bas though (?:they|it|those cards?|that card) had flash\b/.test(text)
  );
}

function isPermanentCard(card: ScryfallCard) {
  return hasCardType(card, "Artifact") ||
    isCreatureCard(card) ||
    hasCardType(card, "Enchantment") ||
    hasCardType(card, "Planeswalker") ||
    hasCardType(card, "Battle") ||
    hasCardType(card, "Land");
}

function isCreatureCard(card: ScryfallCard) {
  return hasCardType(card, "Creature") ||
    card.type_line.startsWith("Summon ") ||
    (card.card_faces?.some((face) => face.type_line?.startsWith("Summon ")) ?? false);
}

function isRepeatableText(text: string, permanent: boolean) {
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

function hasCombatKeyword(card: ScryfallCard) {
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

function getCacheKey(card: ScryfallCard) {
  return [
    card.id,
    card.name,
    card.oracle_text ?? "",
    card.type_line,
    ...(card.card_faces?.flatMap((face) => [face.name ?? "", face.type_line ?? "", face.oracle_text ?? ""]) ?? []),
  ].join("|");
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
