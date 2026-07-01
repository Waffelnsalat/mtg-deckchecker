import { CardRoleProfile, addRole } from "../profile";

export function detectAdvancedRampRoles(
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
    /\bput any number of land cards\b[^.]{0,160}\bonto the battlefield\b/.test(text) ||
    /\bputs all land cards revealed this way onto the battlefield tapped\b/.test(text);
  const landCopyMana =
    /\benter as a copy of any land\b/.test(text) ||
    /\bbecomes a copy of target\b[^.]{0,120}\bland\b/.test(text);
  const costReduction =
    /\bspells? you cast\b[^.]{0,80}\bcosts?\b[^.]{0,40}\bless to cast\b/.test(text) ||
    /\b(?:artifact|creature|instant|sorcery|enchantment|legendary|historic|dragon|face-down creature)\s+spells? you cast\b[^.]{0,80}\bcosts?\b[^.]{0,40}\bless to cast\b/.test(text) ||
    /\b[a-z-]+(?: [a-z-]+){0,4} spells? you cast\b[^.]{0,100}\bcosts?\b[^.]{0,50}\bless to cast\b/.test(text) ||
    /\b(?:activated )?abilities\b[^.]{0,80}\bcost \{[^}]+\} less to activate\b/.test(text) ||
    /\bbuyback costs cost\b[^.]{0,60}\bless\b/.test(text) ||
    /\bflashback costs you pay cost \{[^}]+\} less\b/.test(text) ||
    /\byou may pay\b[^.]{0,80}\brather than pay (?:the )?mana cost\b/.test(text) ||
    /\brather than pay the mana cost for a spell\b[^.]{0,120}\bdiscard a card\b/.test(text);
  const artifactImprovise =
    /\bnonartifact spells? you cast have improvise\b/.test(text) ||
    /\bspells? you cast have improvise\b/.test(text);
  const handCheatMana =
    /\bput\b[^.]{0,140}\b(?:artifact|creature|enchantment|permanent) card from your hand\b[^.]{0,100}\bonto the battlefield\b/.test(text) ||
    /\bput\b[^.]{0,140}\b(?:a|an|target|that|the)?\s*(?:artifact|creature|enchantment|permanent|nonland permanent) card\b[^.]{0,180}\bfrom (?:your hand|among them|among those cards|the top .*? of your library)\b[^.]{0,120}\bonto the battlefield\b/.test(text) ||
    /\breveal a card in your hand\b[\s\S]{0,140}\bput that card onto the battlefield\b/.test(text) ||
    /\beach player may put\b[^.]{0,140}\b(?:artifact|creature|enchantment|land) card from their hand onto the battlefield\b/.test(text) ||
    /\bif all cards revealed this way are creature cards\b[^.]{0,120}\bput those cards onto the battlefield\b/.test(text) ||
    /\bowner of each creature card revealed this way\b[^.]{0,120}\bputs? it onto the battlefield\b/.test(text) ||
    /\beach player puts? all (?:artifact, creature, and land|artifact, creature, enchantment, or land) cards? revealed this way onto the battlefield\b/.test(text) ||
    /\bif it'?s an? (?:artifact|creature|enchantment|land)(?:, (?:artifact|creature|enchantment|land))*?(?:,? or (?:artifact|creature|enchantment|land))? card\b[^.]{0,120}\b(?:that|the) player may put it onto the battlefield\b/.test(text) ||
    /\bexile the top card of your library\b[\s\S]{0,160}\bif it'?s a permanent card\b[\s\S]{0,120}\byou may put it onto the battlefield\b/.test(text) ||
    /\bif it'?s a land card\b[^.]{0,120}\bthe player puts it onto the battlefield\b[\s\S]{0,160}\botherwise\b[^.]{0,120}\bcasts? it without paying its mana cost\b/.test(text) ||
    /\bif it'?s a land card\b[^.]{0,120}\byou may put it onto the battlefield\b/.test(text) ||
    /\bif it'?s a permanent card\b[^.]{0,120}\byou may put it onto the battlefield\b/.test(text) ||
    /\bmay cast a spell from among (?:other )?cards exiled\b[^.]{0,160}\bwithout paying (?:its|that spell'?s) mana cost\b/.test(text) ||
    /\bmay cast that card without paying its mana cost\b/.test(text) ||
    /\byou may cast a spell from your hand without paying its mana cost\b/.test(text) ||
    /\bmay cast spells with mana value less than or equal to the number of lands you control without paying their mana costs\b/.test(text) ||
    /\byou may cast spells from your hand without paying their mana costs\b/.test(text) ||
    /\bopponent chooses a card at random in your graveyard\b[\s\S]{0,160}\bif it'?s a creature card\b[^.]{0,120}\bput it onto the battlefield\b/.test(text) ||
    /\breveal the top (?:five|four|three|two|\d+) cards of your library\b[\s\S]{0,160}\bopponent chooses a creature card from among them\b[\s\S]{0,120}\bput that card onto the battlefield\b/.test(text) ||
    /\byou may put\b[^.]{0,180}\b(?:artifact|creature|enchantment|permanent|nonland permanent) card\b[^.]{0,180}\bonto the battlefield\b/.test(text) ||
    /\bput\b[^.]{0,180}\b(?:artifact|creature|enchantment|permanent|nonland permanent) card\b[^.]{0,180}\bonto the battlefield\b/.test(text) ||
    /\breveals cards from the top of their library until they reveal an artifact card\b[\s\S]{0,120}\bputs that card onto the battlefield\b/.test(text) ||
    /\breveal cards? from the top of your library until\b[\s\S]{0,220}\bput those cards onto the battlefield\b/.test(text);
  const untapManaEngine =
    /\buntap all (?:nonland permanents|artifacts|lands) you control\b/.test(text) ||
    /\buntap all permanents you control during each other player'?s untap step\b/.test(text) ||
    /\bat the beginning of each upkeep\b[^.]{0,120}\buntap all creatures and lands\b/.test(text) ||
    /\bduring each other player's untap step\b[^.]{0,160}\buntap\b/.test(text);
  const manaToken =
    /\bcreate\b[^.]{0,80}\b(?:treasure|lotus|gold)\b[^.]{0,80}\btoken/.test(text) ||
    /\bcreate\b[^.]{0,80}\btoken\b[^.]{0,120}\badd one mana\b/.test(text);
  const triggerMana =
    /\bwhenever a creature enters\b[^.]{0,120}\byou lose \d+ life and add \{[wubrgc]\}/.test(text) ||
    /\bwhenever a creature enters\b[^.]{0,160}\byou may add an amount of \{[wubrgc]\}/.test(text) ||
    /\bat the beginning of each player'?s first main phase\b[^.]{0,80}\bthat player adds \{[wubrgc]\}/.test(text) ||
    /\bwhenever a player casts a creature spell\b[^.]{0,120}\bthat player adds \{[wubrgc]\}/.test(text);
  const temporaryLandAccess =
    /\buntil end of turn\b[^.]{0,120}\byou may tap lands you don'?t control for mana\b/.test(text);
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

  if (burstMana || handExileMana || manaToken || temporaryLandAccess || triggerMana) {
    addRole(profile, "ramp", 0.72, "Advanced scan recognized temporary mana acceleration.");
    addRole(profile, "burst_ramp", handExileMana ? 0.82 : 0.74, "Advanced scan recognized burst mana.");
  }

  if (costReduction || handCheatMana || artifactImprovise) {
    addRole(profile, "ramp", 0.62, "Advanced scan recognized mana-equivalent cost reduction.");
    addRole(
      profile,
      "cost_reduction",
      handCheatMana ? 0.64 : artifactImprovise ? 0.62 : 0.72,
      handCheatMana
        ? "Advanced scan recognized cheating cards from hand as mana-equivalent acceleration."
        : artifactImprovise
          ? "Advanced scan recognized improvise as artifact-backed cost reduction."
        : "Advanced scan recognized cost reduction.",
    );
    if (artifactImprovise) {
      addRole(profile, "artifact_support", 0.54, "Advanced scan recognized artifact-backed improvise support.");
    }
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
