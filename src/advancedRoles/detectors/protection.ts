import { CardRoleProfile, addRole } from "../profile";
import { isRepeatableText } from "../shared";

export function detectAdvancedProtectionRoles(
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
    /\btarget (?:opponent|player) skips? (?:all combat phases of )?(?:their|his or her) next (?:turn|combat phase)\b/.test(text) ||
    /\bplayers and permanents can'?t be the targets of spells or activated abilities\b/.test(text) ||
    /\bcreatures can'?t be the targets of spells\b/.test(text) ||
    /\bcreatures you control can'?t be the targets of spells or abilities your opponents control\b/.test(text) ||
    /\bthe next time a creature of your choice\b[^.]{0,160}\bwould deal damage to you\b[^.]{0,120}\bprevent that damage\b/.test(text) ||
    /\bthe next time a creature of the chosen type would deal damage to you\b[^.]{0,120}\bprevent that damage\b/.test(text) ||
    /\bthe next time\b[^.]{0,120}\bsource of your choice would deal damage this turn\b[^.]{0,80}\bprevent that damage\b/.test(text) ||
    /\bsource of your choice of the chosen color would deal damage to you this turn\b[^.]{0,80}\bprevent that damage\b/.test(text) ||
    /\ball damage that would be dealt to you\b[^.]{0,120}\bis dealt to\b/.test(text) ||
    /\ball damage that would be dealt this turn to you and permanents you control is dealt to the chosen permanent instead\b/.test(text) ||
    /\bthe next time an instant or sorcery spell would deal damage to you\b[\s\S]{0,140}\bthat spell deals that damage to its controller instead\b/.test(text) ||
    /\bprevent all (?:combat )?damage\b[^.]{0,180}\b(?:this turn|that would be dealt this turn|that would be dealt to you|dealt by creatures)\b/.test(text) ||
    /\bprevent all damage that would be dealt to creatures\b/.test(text) ||
    /\bprevent all noncombat damage that would be dealt to creatures you control\b/.test(text) ||
    /\bif (?:an artifact|a source an opponent controls) would deal damage to you\b[^.]{0,80}\bprevent \d+ of that damage\b/.test(text) ||
    /\bprevent all damage that would be dealt to a creature by another creature\b/.test(text) ||
    /\bprevent the next \d+ damage that would be dealt this turn to any number of targets\b/.test(text) ||
    /\bcreatures deal no combat damage\b/.test(text) ||
    /\bthe next time\b[^.]{0,100}\bsource of your choice would deal damage to you\b[^.]{0,80}\bprevent that damage\b/.test(text) ||
    /\bprevent the next (?:x|\d+|one|two|three|four|five|six|seven|eight|nine|ten) damage that would be dealt to you\b/.test(text);
  const playerProtection =
    /\byou (?:gain|have) protection from everything\b/.test(text) ||
    /\byou (?:gain|have) hexproof\b/.test(text) ||
    /\byou can'?t lose the game and your opponents can'?t win the game\b/.test(text) ||
    /\bdamage that would reduce your life total to less than 1 reduces it to 1 instead\b/.test(text);
  const regenerationProtection =
    /\bregenerate (?:this creature|enchanted creature|target creature|that creature)\b/.test(text);
  const targetedProtection =
    /\btarget\b[^.]{0,120}\b(?:creature|artifact|enchantment|planeswalker|permanent)\b[^.]{0,120}\b(?:gains?|gain)\b[^.]{0,120}\b(?:hexproof|indestructible|ward|protection from)\b/.test(text) ||
    /\btarget\b[^.]{0,120}\b(?:creature|artifact|enchantment|planeswalker|permanent)\b[^.]{0,80}\byou control\b[^.]{0,80}\bphases out\b/.test(text) ||
    /\benchanted creature can'?t be the target of spells\b/.test(text) ||
    /\bprevent all damage that would be dealt to enchanted creature\b[^.]{0,120}\bby sources? of\b/.test(text) ||
    /\bprevent all damage that would be dealt to enchanted creature\b/.test(text) ||
    /\bprevent all damage that would be dealt to and dealt by enchanted creature\b/.test(text) ||
    /\bprevent all damage that would be dealt by enchanted creature\b/.test(text) ||
    /\bthe next \d+ damage that would be dealt to enchanted creature this turn is dealt to any target instead\b/.test(text) ||
    /\bif a spell or ability that targets that creature would cause a source to deal damage to that creature\b[^.]{0,120}\bprevent that damage\b/.test(text) ||
    /\bregenerate target\b/.test(text) ||
    regenerationProtection ||
    /\bthe next time target land would be destroyed this turn\b/.test(text) ||
    /\bthe next time a source of your choice would deal damage to target creature this turn\b[^.]{0,80}\bprevent that damage\b/.test(text) ||
    /\bprevent the next (?:x|\d+|one|two|three|four|five|six|seven|eight|nine|ten) damage that would be dealt to (?:any target|target (?:creature|permanent|artifact|enchantment|planeswalker|player)|that (?:permanent|creature|player))\b/.test(text) ||
    /\ball damage that would be dealt this turn to target creature you control by a source of your choice is dealt to another target creature instead\b/.test(text) ||
    /\bthe next \d+ damage that a source of your choice would deal to you and\/or permanents you control this turn is dealt to any target instead\b/.test(text) ||
    /\bthe next \d+ damage that would be dealt to this creature this turn is dealt to target creature you control instead\b/.test(text) ||
    /\bthe next (?:x|\d+|one|two|three|four|five|six|seven|eight|nine|ten) damage that would be dealt to target creature you control\b[^.]{0,120}\bis dealt to you instead\b/.test(text) ||
    /\bthe next \d+ damage that would be dealt to target legendary creature you control this turn is dealt to you instead\b/.test(text) ||
    /\bthe next time\b[^.]{0,100}\bsource of your choice would deal damage to target creature\b[^.]{0,120}\bdeals that damage to you instead\b/.test(text);
  const redirectedDamageProtection =
    /\bgains?\b[^.]{0,120}\bthe next (?:x|\d+|one|two|three|four|five|six|seven|eight|nine|ten) damage that would be dealt to target\b[^.]{0,180}\bis dealt to (?:this|that) creature instead\b/.test(text) ||
    /\bif damage would be dealt to you this turn by a source of your choice\b[\s\S]{0,160}\bprevent that damage\b/.test(text);
  const selfBounce =
    /\breturn target\b[^.]{0,120}\b(?:creature|artifact|enchantment|planeswalker|permanent|land)\b[^.]{0,120}\byou control\b[^.]{0,120}\bto (?:its|their) owner's hand\b/.test(text) ||
    /\breturn any number of target creatures you control to their owner'?s hand\b/.test(text) ||
    /\bwhenever a creature you control becomes blocked\b[^.]{0,120}\byou may return it to its owner'?s hand\b/.test(text) ||
    /\bwhenever another permanent you control becomes the target of a spell or ability an opponent controls\b[^.]{0,140}\byou may return that permanent to its owner'?s hand\b/.test(text) ||
    /\breturn this permanent to its owner'?s hand\b/.test(text) ||
    /\breturn this aura to its owner'?s hand\b/.test(text) ||
    /\breturn target permanent you both own and control to your hand\b/.test(text) ||
    /\bshuffle target nontoken permanent you control into its owner'?s library\b/.test(text);
  const flicker =
    /\bexile\b[^.]{0,120}\btarget\b[^.]{0,120}\b(?:creature|artifact|enchantment|planeswalker|permanent)\b[^.]{0,120}\byou control\b[^.]{0,160}\breturn\b[^.]{0,120}\bto the battlefield\b/.test(text) ||
    /\bexile target (?:creature|enchantment|creature or enchantment)\b[^.]{0,120}\bthen return (?:it|that card)\b[^.]{0,120}\bto the battlefield\b/.test(text) ||
    /\bexile another target permanent you control\b[\s\S]{0,160}\breturn it to the battlefield\b/.test(text) ||
    /\bexile target creature you control\b[\s\S]{0,160}\breturn that card to the battlefield\b/.test(text) ||
    /\bexile (?:up to two|two|any number of) target\b[^.]{0,120}\byou control\b[\s\S]{0,180}\breturn those cards to the battlefield\b/.test(text) ||
    /\bexile enchanted creature and all auras attached to it\b[\s\S]{0,200}\breturn that card to the battlefield\b/.test(text) ||
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
