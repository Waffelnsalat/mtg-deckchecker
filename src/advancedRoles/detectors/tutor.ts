import { CardRoleProfile, addRole } from "../profile";

export function detectAdvancedTutorRoles(profile: CardRoleProfile, text: string, permanent: boolean) {
  const librarySearch =
    /\bsearch(?:es)?\b[^.]{0,220}\b(?:your|their|his or her) library\b/.test(text);
  const outsideGameTutor =
    /\byou may (?:reveal |put )?(?:an? )?(?:artifact|creature|enchantment|instant|sorcery|land)?(?: or (?:artifact|creature|enchantment|instant|sorcery|land))? card you own from outside the game\b[\s\S]{0,120}\bput it into your hand\b/.test(
      text,
    ) ||
    /\byou may reveal (?:a|an) [a-z -]+ card you own from outside the game and put it into your hand\b/.test(text) ||
    /\byou may put a card you own from outside the game into your hand\b/.test(text) ||
    /\byou may play a card you own from outside the game this turn\b/.test(text);
  const libraryDig =
    /\b(?:look at|reveal|mill)\b[\s\S]{0,180}\bput\b[\s\S]{0,160}\b(?:from among them|from among those cards|from among the revealed cards|from among the cards revealed this way|from among the milled cards|from among the cards milled this way|from among cards milled this way)\b[\s\S]{0,160}\b(?:into your hand|onto the battlefield)\b/.test(text) ||
    /\bput\b[\s\S]{0,160}\b(?:from among them|from among those cards|from among the revealed cards|from among the cards revealed this way|from among the milled cards|from among the cards milled this way|from among cards milled this way)\b[\s\S]{0,160}\b(?:into your hand|onto the battlefield)\b/.test(text) ||
    /\breveal the cards in your library\b[\s\S]{0,260}\bopponent chooses\b[\s\S]{0,220}\byou put the chosen cards into your hand\b/.test(text) ||
    /\breveal cards? from the top of your library until\b[\s\S]{0,220}\bput (?:that card|it|one of them)\b[\s\S]{0,120}\b(?:into your hand|onto the battlefield)\b/.test(text) ||
    /\breveal cards? from the top of your library until\b[\s\S]{0,220}\bput all cards revealed this way into your hand\b/.test(text) ||
    /\breveal cards? from the top of your library until you reveal (?:three|two|\d+) nonland cards?\b[\s\S]{0,180}\bput the nonland cards revealed this way into your hand\b/.test(text) ||
    /\bexile cards? from the top of your library until\b[\s\S]{0,260}\bput (?:that card|it|one of them|those cards?|those [a-z]+ cards?|the exiled cards?)\b[\s\S]{0,160}\b(?:into your hand|onto the battlefield)\b/.test(text);
  const symmetricTopdeckTutor =
    /\bchoose\b[^.]{0,80}\btarget players?\b[\s\S]{0,180}\beach of them searches (?:their|his or her) library for a card\b[\s\S]{0,180}\bputs? that card on top\b/.test(
      text,
    );

  if (!librarySearch && !libraryDig && !symmetricTopdeckTutor && !outsideGameTutor) {
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

  if (outsideGameTutor) {
    addRole(profile, "tutor", 0.72, "Advanced scan recognized outside-game card access.");
    addRole(profile, "restricted_tutor", 0.68, "Advanced scan recognized outside-game card access.");
  } else if (symmetricTopdeckTutor) {
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

  if (/\bsearch target player'?s library for up to (?:three|two|\d+) cards with flashback\b[\s\S]{0,120}\bput them into that player'?s graveyard\b/.test(text)) {
    addRole(profile, "graveyard_support", 0.52, "Advanced scan recognized flashback graveyard setup.");
    addRole(profile, "mill_support", 0.34, "Advanced scan recognized targeted library-to-graveyard setup.");
  }
}
