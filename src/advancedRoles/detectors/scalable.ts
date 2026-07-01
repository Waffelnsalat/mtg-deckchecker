import { ScryfallCard } from "../../types";
import { CardRoleProfile, addRole } from "../profile";
import { isPermanentCard } from "../shared";

export function detectAdvancedScalableSpellRoles(
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

export function hasXInManaCost(card: ScryfallCard) {
  const costs = [card.mana_cost, ...(card.card_faces?.map((face) => face.mana_cost) ?? [])];
  return costs.some((cost) => /\{x\}/i.test(cost ?? ""));
}

export function hasScalableXEffectText(text: string) {
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

export function hasXDamageText(text: string) {
  return (
    /\bdeals? (?:\w+\s+times\s+)?x damage\b/.test(text) ||
    /\bdeals? damage equal to x\b/.test(text)
  );
}

export function hasXTargetedDamageText(text: string) {
  return (
    /\bdeals? (?:\w+\s+times\s+)?x damage to (?:any (?:other )?target|target\b|each of up to x targets?)\b/.test(text) ||
    /\bdeals? (?:\w+\s+times\s+)?x damage divided as you choose\b/.test(text) ||
    /\bdeals? (?:\w+\s+times\s+)?x damage divided\b[^.]{0,120}\bamong any number of targets?\b/.test(text)
  );
}

export function hasXPlayerDamageText(text: string) {
  return /\bdeals? (?:\w+\s+times\s+)?x damage\b[^.]{0,160}\b(?:any target|any number of targets?(?!\s+creatures?\b)|target player|target opponent(?! controls)|each (?:player|opponent)|each opponent)\b/.test(
    text,
  );
}

export function hasXCreatureDamageText(text: string) {
  return /\bdeals? (?:\w+\s+times\s+)?x damage\b[^.]{0,160}\b(?:target creature|all creatures|each creature|creatures target opponent controls|creatures? [^.]{0,80} controls)\b/.test(
    text,
  );
}

export function hasXLifeLossText(text: string) {
  return /\b(?:each opponent|target opponent|target player|each player)\b[^.]{0,120}\bloses? x life\b/.test(text);
}

export function hasXDrawText(text: string) {
  return (
    /\bdraw x cards?\b/.test(text) ||
    /\bdraw cards? equal to x\b/.test(text) ||
    /\btarget player draws x cards?\b/.test(text)
  );
}

export function hasXTokenText(text: string) {
  return (
    /\bcreate x\b[^.]{0,140}\btokens?\b/.test(text) ||
    /\bcreate\b[^.]{0,140}\bx\b[^.]{0,100}\btokens?\b/.test(text) ||
    /\bcreate\b[^.]{0,120}\btokens?\b[^.]{0,80}\bwhere x is\b/.test(text)
  );
}

export function hasXTutorText(text: string) {
  return (
    /\bsearch(?:es)?\b[^.]{0,220}\byour library\b[^.]{0,220}\b(?:mana value|value|cost) x or less\b/.test(text) ||
    /\bsearch(?:es)?\b[^.]{0,220}\byour library\b[^.]{0,220}\bwith mana value x\b/.test(text) ||
    /\breveal\b[^.]{0,160}\btop x cards?\b[^.]{0,220}\bput\b[^.]{0,120}\b(?:into your hand|onto the battlefield)\b/.test(text)
  );
}

export function hasXRemovalText(text: string) {
  return (
    /\b(?:destroy|exile)\b[^.]{0,180}\b(?:mana value|value|cost) x or less\b/.test(text) ||
    /\ball creatures get -x\/-x\b/.test(text) ||
    /\btarget creature gets -x\/-x\b/.test(text) ||
    /\breturn\b[^.]{0,160}\bwith mana value x or less\b[^.]{0,120}\bto (?:its|their) owners?'? hands?\b/.test(text)
  );
}

export function hasXMillText(text: string) {
  return (
    /\bmills? x cards?\b/.test(text) ||
    /\btarget player mills x cards?\b/.test(text) ||
    /\bput the top x cards? of\b[^.]{0,120}\binto (?:their|his or her|your) graveyard\b/.test(text)
  );
}

export function hasXCounterOrPumpText(text: string) {
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
