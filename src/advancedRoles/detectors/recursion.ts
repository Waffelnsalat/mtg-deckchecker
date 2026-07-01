import { CardRoleProfile, addRole } from "../profile";
import { hasSelfContainedGraveyardCastText, isRepeatableText } from "../shared";

export function detectAdvancedRecursionRoles(profile: CardRoleProfile, text: string, permanent: boolean) {
  const repeatable = isRepeatableText(text, permanent);
  const battlefield =
    /\breturn\b[^.]{0,140}\b(?:target|up to .*?)\b[^.]{0,140}\bfrom your graveyard\b[^.]{0,120}\bto the battlefield\b/.test(text) ||
    /\breturn\b[^.]{0,140}\b(?:artifact|creature|enchantment|planeswalker|permanent) card\b[^.]{0,140}\bfrom your graveyard\b[^.]{0,120}\bto the battlefield\b/.test(text) ||
    /\bput\b[^.]{0,80}\brandom creature from (?:a|any) random graveyard into play under your control\b/.test(text) ||
    /\b(?:target|up to .*?)\b[^.]{0,140}\bcreature cards? in your graveyard\b[^.]{0,180}\breturn (?:it|them|those cards?) to the battlefield\b/.test(text) ||
    /\btarget creature cards? in your graveyard\b[\s\S]{0,180}\breturn them to the battlefield\b/.test(text) ||
    /\bseparate all creature cards in your graveyard into two piles\b[\s\S]{0,180}\breturn the other to the battlefield\b/.test(text) ||
    /\bwhenever a creature is put into your graveyard from the battlefield\b[\s\S]{0,180}\breturn that card to the battlefield\b/.test(text) ||
    /\bwhenever a spell or ability an opponent controls causes a land to be put into your graveyard from the battlefield\b[\s\S]{0,180}\breturn that card to the battlefield\b/.test(text) ||
    /\breturn a card exiled with this enchantment to the battlefield\b/.test(text) ||
    /\breturn enchanted creature card to the battlefield\b/.test(text) ||
    /\breturn each creature card exiled with this artifact to the battlefield under your control\b/.test(text) ||
    /\bchoose up to two target permanent cards in your graveyard\b[\s\S]{0,160}\breturn them to the battlefield\b/.test(text);
  const hand =
    /\breturn\b[^.]{0,140}\b(?:target|up to .*?)\b[^.]{0,140}\bfrom your graveyard\b[^.]{0,120}\bto your hand\b/.test(text) ||
    /\breturn\b[^.]{0,140}\b(?:artifact|creature|enchantment|planeswalker|instant|sorcery|permanent) card\b[^.]{0,140}\bfrom your graveyard\b[^.]{0,120}\bto your hand\b/.test(text) ||
    /\breturn a creature card from their graveyard to their hand\b/.test(text) ||
    /\btarget opponent chooses one of the top two cards of your graveyard\b[\s\S]{0,160}\bput the other one into your hand\b/.test(text) ||
    /\bwhenever a creature is put into your graveyard from the battlefield\b[\s\S]{0,180}\breturn that card to your hand\b/.test(text) ||
    /\bwhenever a nontoken creature is put into your graveyard from the battlefield\b[\s\S]{0,180}\breturn that card to your hand\b/.test(text) ||
    /\bchooses? a card in your graveyard\b[\s\S]{0,220}\bput the last chosen card into your hand\b/.test(text) ||
    /\bexchange your hand and graveyard\b/.test(text) ||
    /\breturn target exiled card with flashback you own to your hand\b/.test(text) ||
    /\bchoose up to four target cards in your graveyard\b[\s\S]{0,220}\bput the rest into your hand\b/.test(text);
  const replay =
    !hasSelfContainedGraveyardCastText(text) &&
    (/\byou may (?:cast|play)\b[^.]{0,120}\bfrom your graveyard\b/.test(text) ||
      /\b(?:each|every|instant|sorcery|nonland|creature|artifact|enchantment|permanent)[^.]{0,140}\bcards? in your graveyard\b[^.]{0,180}\bgains? flashback\b/.test(text) ||
      /\beach\b[^.]{0,80}\bnonland card\b[^.]{0,100}\bhas escape\b/.test(text));
  const mass =
    /\breturn all\b[^.]{0,160}\bfrom your graveyard\b/.test(text) ||
    /\breturn each\b[^.]{0,160}\bfrom your graveyard\b/.test(text) ||
    /\breturn\b[^.]{0,120}\bany number of\b[^.]{0,160}\bfrom your graveyard\b/.test(text) ||
    /\bseparate all creature cards in your graveyard into two piles\b[\s\S]{0,180}\breturn the other to the battlefield\b/.test(text) ||
    /\bput all creature cards from all graveyards onto the battlefield under your control\b/.test(text) ||
    /\bput onto the battlefield under your control all creature cards in all graveyards\b/.test(text) ||
    /\bchoose a creature card with mana value 1 in your graveyard\b[\s\S]{0,180}\breturn those cards to the battlefield\b/.test(text) ||
    /\bchoose any number of target creature and\/or planeswalker cards in graveyards\b[\s\S]{0,180}\bput them onto the battlefield under your control\b/.test(text) ||
    /\beach opponent chooses a creature card in their graveyard\b[\s\S]{0,120}\bput those cards onto the battlefield under your control\b/.test(text);
  const library =
    /\bshuffle your graveyard into your library\b/.test(text) ||
    /\bshuffle\b[^.]{0,120}\bfrom your graveyard\b[^.]{0,120}\binto your library\b/.test(text) ||
    /\bput\b[^.]{0,120}\bfrom your graveyard\b[^.]{0,120}\bon top of your library\b/.test(text) ||
    /\bwhenever a creature you control is put into your graveyard from the battlefield\b[^.]{0,160}\bput it on top of your library\b/.test(text) ||
    /\bwhenever a creature is put into your graveyard from the battlefield\b[^.]{0,160}\bput that card on top of your library\b/.test(text) ||
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
