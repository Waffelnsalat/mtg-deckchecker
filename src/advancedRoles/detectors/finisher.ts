import { CardRoleProfile, addRole } from "../profile";
import { isRepeatableText } from "../shared";

export function detectAdvancedFinisherRoles(
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
    /\beach opponent loses?\b/.test(text) ||
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
    /\bdeals? damage to any target equal to (?:three times )?the number of (?:creatures|artifacts|lands|permanents) (?:you control|tapped this way)\b/.test(text) ||
    /\bdeals? damage to any target equal to the number of times\b/.test(text) ||
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

  if (/\beach player'?s life total becomes the number of creatures they control\b/.test(text)) {
    addRole(profile, "finisher", 0.78, "Advanced scan recognized a life-total reset finisher.");
    addRole(profile, "direct_finisher", 0.72, "Advanced scan recognized a life-total reset finisher.");
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

  if (/\btarget player loses life equal to the damage already dealt to that player this turn\b/.test(text)) {
    addRole(profile, "finisher", 0.62, "Advanced scan recognized damage-amplifying life loss.");
    addRole(profile, "direct_finisher", 0.62, "Advanced scan recognized damage-amplifying life loss.");
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
