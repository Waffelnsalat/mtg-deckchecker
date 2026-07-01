import { ScryfallCard } from "../../types";
import { CardRoleProfile, addRole } from "../profile";
import {
  hasCardType,
  hasCoinFlipText,
  hasCombatKeyword,
  hasDiceText,
  hasDoublerOrMultiplierText,
  hasFaceDownPurposeText,
  hasFlashEnablerText,
  hasLandAnimationText,
  hasReplacementText,
  isCreatureCard,
  isPermanentCard,
  isRepeatableText,
  normalizeText,
  normalizeKeyword,
} from "../shared";

export function detectAdvancedPurposeRoles(
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

  addKeywordDerivedRoles(profile, keywords, text, permanent, isCreatureCard(card));

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
    /\btarget spell or permanent becomes\b[^.]{0,40}\b(?:white|blue|black|red|green|colorless)\b/.test(text) ||
    /\ball permanents are colorless\b/.test(text) ||
    /\ball nonland permanents are the chosen color\b/.test(text) ||
    /\btarget permanent becomes the colors? or colors? of your choice\b/.test(text) ||
    /\btarget permanent becomes the color of your choice until end of turn\b/.test(text) ||
    /\bone or more target creatures become (?:white|blue|black|red|green|colorless)\b/.test(text) ||
    /\ball creatures (?:are|become) (?:white|blue|black|red|green|colorless)\b/.test(text) ||
    /\benchanted creature becomes the colors? or colors? of your choice\b/.test(text) ||
    /\btarget permanent you control becomes the color of your choice\b/.test(text) ||
    /\bbecomes a random color permanently\b/.test(text) ||
    /\b(?:black|red|white|blue|green)(?: and\/or (?:black|red|white|blue|green))? permanents and spells are colorless sources of damage\b/.test(text)
  ) {
    addRole(profile, "color_change", 0.3, "Advanced scan recognized color-changing utility.");
  }

  if (/\bchange the text of target spell or permanent\b/.test(text) || /\ball instances of color words in the text of spells and permanents are changed\b/.test(text)) {
    addRole(profile, "text_change", 0.34, "Advanced scan recognized text-changing utility.");
  }

  if (
    /\bas this (?:artifact|enchantment) enters, choose a creature type\b/.test(text) ||
    /\beach creature (?:card )?(?:you control|in your graveyard)\b[^.]{0,120}\b(?:is|has) the chosen creature type\b/.test(text) ||
    /\bcreatures you control are\b[^.]{0,80}\bin addition to their other creature types\b/.test(text) ||
    /\btarget creature becomes (?:the chosen type|that type|the creature type of your choice)\b/.test(text)
  ) {
    addRole(profile, "kindred", 0.42, "Advanced scan recognized creature-type setup.");
    addRole(profile, "kindred_support", 0.54, "Advanced scan recognized creature-type setup.");
  }

  if (/\bremove this card from your deck before playing if you're not playing for ante\b/.test(text)) {
    addRole(profile, "ante_card", 0.18, "Advanced scan recognized an ante-only card.");
  }

  if (
    /\bas long as enchanted artifact isn't a creature\b[^.]{0,120}\bit's an artifact creature\b/.test(text) ||
    /\bthis artifact becomes\b[^.]{0,80}\bartifact creature\b/.test(text) ||
    /\bthis artifact is a \d+\/\d+\b[^.]{0,120}\bartifact creature\b/.test(text) ||
    /\bif this permanent is an enchantment\b[^.]{0,120}\bbecomes? a \d+\/\d+\b[^.]{0,120}\bcreature\b/.test(text) ||
    /\bthis enchantment becomes? a \d+\/\d+\b[^.]{0,120}\bcreature\b/.test(text) ||
    /\bthis enchantment becomes an? x\/x\b[^.]{0,120}\bcreature\b/.test(text) ||
    /\benchanted (?:land|mountain) is a \d+\/\d+\b[^.]{0,120}\bcreature\b/.test(text) ||
    /\blands you control are \d+\/\d+ creatures\b[\s\S]{0,160}\bthey'?re still lands\b/.test(text) ||
    /\beach other non-aura enchantment is a creature\b/.test(text) ||
    /\ball lands become \d+\/\d+ creatures until end of turn\b/.test(text) ||
    /\btarget land(?: you control)? becomes a \d+\/\d+\b[^.]{0,120}\bcreature\b/.test(text) ||
    /\btarget creature or land you control becomes a \d+\/\d+\b[^.]{0,120}\bcreature\b/.test(text) ||
    /\btarget artifact or creature becomes\b[^.]{0,120}\bwith base power and toughness\b/.test(text) ||
    /\btarget nonland permanent loses all abilities and becomes\b[^.]{0,160}\bwith base power and toughness\b/.test(text) ||
    /\btarget creature becomes\b[^.]{0,120}\bwith base power and toughness\b/.test(text) ||
    /\btarget creature has base power\b/.test(text) ||
    /\benchanted (?:mountain|artifact) is a creature\b[^.]{0,120}\bbase power and toughness \d+\/\d+\b/.test(text) ||
    /\bthis vehicle enters\b[^.]{0,120}\bit becomes an artifact creature until end of turn\b/.test(text) ||
    /\bthis vehicle becomes an artifact creature until end of turn\b/.test(text) ||
    /\bcrew \d+\b/.test(text) ||
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

  if (/\beach land is (?:a |an )?(?:plains|island|swamp|mountain|forest)\b/.test(text) || /\ball lands become (?:plains|islands|swamps|mountains|forests)\b/.test(text)) {
    addRole(profile, "land_type_change", 0.48, "Advanced scan recognized global land type-changing utility.");
    addRole(profile, "land_denial", 0.36, "Advanced scan recognized global land type changes as possible mana disruption.");
    addRole(profile, "mana_fixing", 0.28, "Advanced scan recognized global land type changes as possible mana fixing.");
  }

  if (/\blands you control are every basic land type\b/.test(text)) {
    addRole(profile, "land_type_change", 0.5, "Advanced scan recognized land type fixing.");
    addRole(profile, "mana_fixing", 0.54, "Advanced scan recognized land type fixing.");
    addRole(profile, "lands_matter", 0.34, "Advanced scan recognized land-type synergy.");
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

  if (/\bif a basic land you control is tapped for mana\b[^.]{0,120}\bproduces mana of a color of your choice\b/.test(text)) {
    addRole(profile, "mana_fixing", 0.52, "Advanced scan recognized basic-land color fixing.");
    addRole(profile, "land_synergy", 0.34, "Advanced scan recognized land mana conversion.");
  }

  if (
    /\beach player may play an additional land\b/.test(text) ||
    /\byou may play up to (?:one|two|three|four|five|six|\d+) additional lands?\b/.test(text)
  ) {
    addRole(profile, "land_synergy", 0.58, "Advanced scan recognized extra land-play utility.");
    addRole(profile, "land_acceleration", 0.56, "Advanced scan recognized additional land plays.");
    addRole(profile, "ramp", 0.36, "Advanced scan recognized additional land plays as ramp material.");
  }

  if (/\bwhenever a land is tapped for mana\b[^.]{0,120}\breturn it to its owner'?s hand\b/.test(text)) {
    addRole(profile, "land_synergy", 0.58, "Advanced scan recognized land-bounce utility.");
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
    /\b(?:tap|untap) enchanted creature\b/.test(text) ||
    /\buntap two target creatures\b/.test(text) ||
    /\btarget player untaps all basic lands they control\b/.test(text) ||
    /\buntap all creatures you control\b/.test(text) ||
    /\b(?:tap all untapped|untap all tapped) permanents of the chosen type target player controls\b/.test(text) ||
    /\btap any number of random target creatures\b/.test(text) ||
    /\btap (?:x|one|two|three|four|five|six|\d+) target lands?\b/.test(text)
  ) {
    addRole(profile, "tap_untap", 0.48, "Advanced scan recognized tap-or-untap utility.");
    addRole(profile, "tempo_support", 0.44, "Advanced scan recognized tap-or-untap tempo utility.");
    if (/\b(?:lands?|artifact, creature, or land)\b/.test(text)) {
      addRole(profile, "ramp", 0.28, "Advanced scan recognized untapping lands as possible mana utility.");
    }
  }

  if (/\btarget player gains? \d+ life\b/.test(text)) {
    addRole(profile, "lifegain", permanent ? 0.5 : 0.42, "Advanced scan recognized direct lifegain.");
  }

  if (/\bwhenever a permanent you control enters tapped\b[^.]{0,80}\buntap it\b/.test(text)) {
    addRole(profile, "ramp", 0.54, "Advanced scan recognized tapped-permanent untap acceleration.");
    addRole(profile, "tap_untap", 0.56, "Advanced scan recognized tapped-permanent untap utility.");
  }

  if (/\beach opponent sacrifices a land\b/.test(text)) {
    addRole(profile, "land_denial", 0.54, "Advanced scan recognized opponent land sacrifice.");
    addRole(profile, "mana_denial", 0.42, "Advanced scan recognized land sacrifice as mana pressure.");
  }

  if (/\bat the beginning of enchanted player'?s first upkeep each turn\b[^.]{0,120}\badditional upkeep step\b/.test(text)) {
    addRole(profile, "upkeep_synergy", 0.42, "Advanced scan recognized additional-upkeep utility.");
    addRole(profile, "combo_support", 0.3, "Advanced scan recognized extra upkeep as synergy material.");
  }

  if (/\bat the beginning of your end step\b[^.]{0,120}\buntap all [a-z]+ you control\b/.test(text)) {
    addRole(profile, "tap_untap", 0.5, "Advanced scan recognized kindred untap utility.");
    addRole(profile, "kindred_support", 0.36, "Advanced scan recognized kindred untap utility.");
  }

  if (/\bcreatures with flying can'?t block creatures you control\b/.test(text) || /\benchanted creature loses flying\b/.test(text)) {
    addRole(profile, "combat_support", permanent ? 0.42 : 0.34, "Advanced scan recognized evasive combat support.");
  }

  if (/\benchanted land has \"untap this land during each other player'?s untap step/.test(text)) {
    addRole(profile, "ramp", 0.42, "Advanced scan recognized repeatable land untap utility.");
    addRole(profile, "tap_untap", 0.48, "Advanced scan recognized repeatable land untap utility.");
  }

  if (/\bmove any number of \+1\/\+1 counters from target creature onto another target creature\b/.test(text)) {
    addRole(profile, "counter_support", 0.5, "Advanced scan recognized counter transfer.");
  }

  if (/\bwhenever an opponent shuffles their library\b[^.]{0,160}\byou may exile one of those cards\b/.test(text)) {
    addRole(profile, "hate_piece", 0.36, "Advanced scan recognized shuffle-punisher library pressure.");
    addRole(profile, "topdeck_control", 0.34, "Advanced scan recognized topdeck manipulation.");
  }

  if (/\bplayers play a magic subgame\b/.test(text)) {
    addRole(profile, "subgame", 0.36, "Advanced scan recognized subgame text.");
    addRole(profile, "alternate_play", 0.3, "Advanced scan recognized alternate-gameplay text.");
    addRole(profile, "life_pressure", 0.22, "Advanced scan recognized subgame life-loss pressure.");
  }

  if (
    /\bsource of your choice would deal damage to you\b[^.]{0,180}\bdeals that much damage to that source'?s controller\b/.test(text) ||
    /\bsource of your choice would deal damage this turn\b[^.]{0,180}\bthat damage is dealt to that source'?s controller instead\b/.test(text) ||
    /\bsource of your choice would deal damage to any target this turn\b[\s\S]{0,260}\bprevent that damage\b[\s\S]{0,260}\bdeals? that much damage to the source'?s controller\b/.test(text) ||
    /\ball damage that would be dealt\b[^.]{0,180}\bby target sorcery spell\b[^.]{0,120}\bis dealt to that spell'?s controller instead\b/.test(text) ||
    /\ball damage that would be dealt to enchanted creature\b[^.]{0,120}\bis dealt to its controller instead\b/.test(text) ||
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

  if (/\ball phased-out creatures phase in\b[^.]{0,120}\ball creatures with phasing phase out\b/.test(text)) {
    addRole(profile, "phase_support", 0.4, "Advanced scan recognized phasing-state utility.");
    addRole(profile, "tempo_support", 0.34, "Advanced scan recognized phasing-state utility as tempo material.");
  }

  if (
    /\btarget creature defending player controls can block any number of creatures\b/.test(text) ||
    /\bremove target creature defending player controls from combat\b/.test(text) ||
    /\ball creatures able to block target creature this turn do so\b/.test(text) ||
    /\ball creatures able to block enchanted creature do so\b/.test(text) ||
    /\bcreatures without flying can'?t block this turn\b/.test(text) ||
    /\bcreatures with flying get -\d+\/-\d+\b/.test(text) ||
    /\bcreatures you control have (?:reach|shadow)\b/.test(text) ||
    /\bcreatures with flying can block only creatures with flying\b/.test(text) ||
    /\bcreatures you control gain reach until end of turn\b/.test(text) ||
    /\bcreatures without flying have reach\b/.test(text) ||
    /\bcreatures don'?t untap during their controllers'? untap steps\b/.test(text)
  ) {
    addRole(profile, "combat_support", 0.48, "Advanced scan recognized a combat-manipulation effect.");
    addRole(profile, "tempo_support", 0.36, "Advanced scan recognized combat manipulation as tempo utility.");
  }

  if (
    /\blook at target (?:player|opponent)'?s hand\b|\bplayers play with their hands revealed\b|\byour opponents play with their hands revealed\b/.test(text) ||
    /\btarget player reveals their hand\b/.test(text) ||
    /\btarget player reveals a card at random from their hand\b/.test(text)
  ) {
    addRole(profile, "hand_info", 0.28, "Advanced scan recognized hand-information utility.");
  }

  if (
    /\blook at the top (?:three|five|\d+) cards of target player'?s library\b/.test(text) ||
    /\blook at the top (?:three|five|\d+) cards of target opponent'?s library\b/.test(text) ||
    /\blook at the top card of target player'?s library\b/.test(text) ||
    /\btarget player looks at the top (?:three|five|\d+) cards of their library\b/.test(text) ||
    /\btarget player chooses a card name\b[^.]{0,140}\breveals? the top card of their library\b/.test(text)
  ) {
    addRole(profile, "selection", 0.36, "Advanced scan recognized top-of-library ordering utility.");
    addRole(profile, "topdeck_control", 0.34, "Advanced scan recognized top-of-library ordering utility.");
  }

  if (/\blook at the top (?:three|five|\d+) cards of target opponent'?s library\b[\s\S]{0,220}\bput one of those cards into that player'?s graveyard\b/.test(text)) {
    addRole(profile, "selection", 0.36, "Advanced scan recognized top-of-library denial.");
    addRole(profile, "topdeck_control", 0.46, "Advanced scan recognized top-of-library denial.");
    addRole(profile, "mill_support", 0.3, "Advanced scan recognized selective top-of-library milling.");
  }

  if (/\bplayers play with the top card of their libraries revealed\b/.test(text) || /\beach player plays with the top card of their library\b[^.]{0,140}\brevealed to each other player\b/.test(text)) {
    addRole(profile, "topdeck_info", 0.3, "Advanced scan recognized top-of-library information.");
    addRole(profile, "selection", 0.22, "Advanced scan recognized revealed-library information as planning utility.");
  }

  if (/\bput any number of target\b[^.]{0,160}\bfrom target player's graveyard on top of their library\b/.test(text)) {
    addRole(profile, "topdeck_control", 0.42, "Advanced scan recognized graveyard-to-library ordering utility.");
  }

  if (/\blook at the top card of target player'?s library\b[\s\S]{0,220}\bput it into that player'?s graveyard\b/.test(text)) {
    addRole(profile, "topdeck_control", 0.42, "Advanced scan recognized top-of-library denial.");
    addRole(profile, "mill_support", 0.34, "Advanced scan recognized top-of-library milling.");
  }

  if (/\blook at the top card of your library\b[\s\S]{0,120}\byou may put that card into your graveyard\b/.test(text)) {
    addRole(profile, "selection", 0.34, "Advanced scan recognized self top-of-library filtering.");
    addRole(profile, "graveyard_support", 0.3, "Advanced scan recognized optional self-mill setup.");
  }

  if (/\btarget player reveals the top (?:four|three|two|\d+) cards of their library\b[\s\S]{0,180}\bput them into that player'?s graveyard\b/.test(text)) {
    addRole(profile, "topdeck_control", 0.46, "Advanced scan recognized top-of-library denial.");
    addRole(profile, "mill_support", 0.38, "Advanced scan recognized selective top-of-library milling.");
  }

  if (/\blook at the top card of target opponent'?s library\b[\s\S]{0,180}\bput that card on the bottom of that player'?s library\b/.test(text)) {
    addRole(profile, "selection", 0.36, "Advanced scan recognized top-of-library denial.");
    addRole(profile, "topdeck_control", 0.46, "Advanced scan recognized top-of-library denial.");
  }

  if (/\btarget player puts a card from their hand on top of their library\b/.test(text)) {
    addRole(profile, "hand_attack", 0.46, "Advanced scan recognized hand-to-library pressure.");
    addRole(profile, "topdeck_control", 0.42, "Advanced scan recognized hand-to-library pressure.");
  }

  if (/\bput up to\b[^.]{0,80}\btarget cards? from an opponent'?s graveyard on top of their library\b/.test(text)) {
    addRole(profile, "topdeck_control", 0.42, "Advanced scan recognized graveyard-to-library ordering utility.");
    addRole(profile, "graveyard_hate", 0.34, "Advanced scan recognized opposing graveyard disruption.");
  }

  if (/\bwhenever another card is put into a graveyard from anywhere\b[^.]{0,120}\bexile that card\b/.test(text)) {
    addRole(profile, "graveyard_hate", 0.64, "Advanced scan recognized graveyard replacement hate.");
    addRole(profile, "hate_piece", 0.46, "Advanced scan recognized graveyard hate.");
  }

  if (/\btarget player shuffles their graveyard into their library\b/.test(text)) {
    addRole(profile, "graveyard_hate", 0.44, "Advanced scan recognized graveyard reset utility.");
  }

  if (/\beach player shuffles their graveyard into their library\b/.test(text)) {
    addRole(profile, "graveyard_hate", 0.38, "Advanced scan recognized symmetrical graveyard reset.");
    addRole(profile, "library_recursion", 0.32, "Advanced scan recognized graveyard recycling.");
  }

  if (/\btarget player shuffles up to (?:four|three|two|\d+) target cards from their graveyard into their library\b/.test(text)) {
    addRole(profile, "graveyard_hate", 0.4, "Advanced scan recognized targeted graveyard reset utility.");
    addRole(profile, "topdeck_control", 0.28, "Advanced scan recognized graveyard-to-library reset utility.");
  }

  if (/\bsearch target player'?s library for up to seven cards and exile them\b/.test(text)) {
    addRole(profile, "mill_support", 0.46, "Advanced scan recognized targeted library exile.");
    addRole(profile, "topdeck_control", 0.36, "Advanced scan recognized targeted library exile.");
  }

  if (/\bsearch target player'?s library for a card and exile it\b/.test(text)) {
    addRole(profile, "mill_support", 0.36, "Advanced scan recognized targeted library exile.");
    addRole(profile, "topdeck_control", 0.32, "Advanced scan recognized targeted library exile.");
  }

  if (/\byou control that player\b/.test(text)) {
    addRole(profile, "player_control", 0.46, "Advanced scan recognized player-control utility.");
    addRole(profile, "theft_support", 0.34, "Advanced scan recognized control of another player's choices.");
  }

  if (/\byou control enchanted enchantment\b/.test(text)) {
    addRole(profile, "theft_support", 0.5, "Advanced scan recognized enchantment theft.");
    addRole(profile, "tempo_removal", 0.58, "Advanced scan recognized enchantment theft as battlefield interaction.");
    addRole(profile, "removal", 0.48, "Advanced scan recognized enchantment theft as battlefield interaction.");
  }

  if (/\byou have no maximum hand size\b|\bmaximum hand size is (?:four|three|two|one|\d+)\b/.test(text)) {
    addRole(profile, "hand_size", 0.34, "Advanced scan recognized maximum-hand-size utility.");
  }

  if (/\btarget player skips their next draw step\b/.test(text)) {
    addRole(profile, "hand_denial", 0.48, "Advanced scan recognized draw-step denial.");
    addRole(profile, "tempo_support", 0.34, "Advanced scan recognized draw-step denial as tempo utility.");
  }

  if (/\bif (?:a |an )?(?:white|blue|black|red|green)? ?source would deal damage to you\b[^.]{0,120}\bprevent \d+ of that damage\b/.test(text)) {
    addRole(profile, "self_protection", 0.44, "Advanced scan recognized damage-prevention protection.");
    addRole(profile, "protection", 0.32, "Advanced scan recognized damage-prevention protection.");
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

  if (/\breveal a card in your hand\b[\s\S]{0,140}\bput that card onto the battlefield\b/.test(text)) {
    addRole(profile, "cheat_into_play", 0.48, "Advanced scan recognized conditional hand-to-battlefield setup.");
    addRole(profile, "cost_reduction", 0.36, "Advanced scan recognized hand-to-battlefield setup as mana-equivalent acceleration.");
  }

  if (/\breveal cards from the top of their library until they reveal a creature card\b[\s\S]{0,180}\bputs? that card onto the battlefield\b/.test(text)) {
    addRole(profile, "cheat_into_play", permanent ? 0.74 : 0.62, "Advanced scan recognized top-library creature deployment.");
    addRole(profile, "selection", permanent ? 0.54 : 0.44, "Advanced scan recognized reveal-until-creature access.");
    addRole(profile, "mill_support", permanent ? 0.38 : 0.3, "Advanced scan recognized graveyard fill from reveal-until-creature text.");
  }

  if (/\breveal the top card of your library\b[\s\S]{0,180}\bif it'?s a creature card\b[\s\S]{0,160}\bput it onto the battlefield\b/.test(text)) {
    addRole(profile, "cheat_into_play", permanent ? 0.58 : 0.48, "Advanced scan recognized top-of-library creature deployment.");
    addRole(profile, "card_selection", permanent ? 0.42 : 0.34, "Advanced scan recognized conditional top-card access.");
    addRole(profile, "selection", permanent ? 0.36 : 0.28, "Advanced scan recognized conditional top-card access.");
  }

  if (/\blook at the top (?:ten|\d+) cards of your library\b[\s\S]{0,180}\bexile any number of them\b[\s\S]{0,160}\bput the rest back on top of your library\b/.test(text)) {
    addRole(profile, "selection", permanent ? 0.48 : 0.38, "Advanced scan recognized deep top-library filtering.");
    addRole(profile, "card_selection", permanent ? 0.46 : 0.36, "Advanced scan recognized deep top-library filtering.");
    addRole(profile, "topdeck_control", permanent ? 0.4 : 0.32, "Advanced scan recognized deep top-library filtering.");
  }

  if (/\bexile the top card of your library\b[\s\S]{0,120}\byou may put that card into your hand\b[\s\S]{0,180}\brepeat this process until\b/.test(text)) {
    addRole(profile, "selection", 0.56, "Advanced scan recognized repeatable top-library card access.");
    addRole(profile, "tutor", 0.42, "Advanced scan recognized top-library card access.");
    addRole(profile, "restricted_tutor", 0.38, "Advanced scan recognized top-library card access.");
  }

  if (graveyardCastKeyword || graveyardBodyKeyword) {
    addRole(
      profile,
      "graveyard_support",
      graveyardBodyKeyword ? 0.58 : 0.48,
      "Advanced scan recognized self-contained graveyard reuse.",
    );
  }

  if (/\bsearch target player'?s library for up to (?:three|two|\d+) cards with flashback\b[\s\S]{0,160}\bput them into that player'?s graveyard\b/.test(text)) {
    addRole(profile, "graveyard_support", 0.52, "Advanced scan recognized flashback graveyard setup.");
    addRole(profile, "mill_support", 0.34, "Advanced scan recognized targeted library-to-graveyard setup.");
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
    /\bcreates? that many\b[^.]{0,120}\btokens?\b/.test(text) ||
    tokenKeyword ||
    /\bwhenever enchanted creature is dealt damage\b[\s\S]{0,140}\bits controller creates that many\b[^.]{0,80}\bcreature tokens?\b/.test(text) ||
    /\bput\b[^.]{0,140}\b(?:creature|artifact creature|egg artifact creature)\s+token\b[^.]{0,120}\bonto the battlefield\b/.test(text) ||
    /\bput a token creature into play\b/.test(text) ||
    /\bput\b[^.]{0,160}\b(?:spawn of azar|token creature|creature)\s+token\b[^.]{0,160}\binto play\b/.test(text) ||
    /\btokens? would be created\b[\s\S]{0,180}\b(?:twice that many|that many plus|additional)\b/.test(text) ||
    /\bcreate\b[\s\S]{0,120}\b(?:twice that many|that many plus|additional)\b[\s\S]{0,80}\btokens?\b/.test(text)
  ) {
    if (!/\b(?:target opponent|an opponent|its controller|that player|that creature'?s controller) creates?\b/.test(text)) {
      addRole(profile, "token_support", permanent ? 0.68 : 0.58, "Advanced scan recognized token support.");
    }
  }

  if (/\bwhenever enchanted creature is dealt damage\b[\s\S]{0,180}\bits controller creates that many\b[\s\S]{0,120}\btokens?\b/.test(text)) {
    addRole(profile, "token_support", permanent ? 0.58 : 0.48, "Advanced scan recognized damage-conversion token support.");
  }

  if (/\bthat player exiles a card at random from their hand\b[\s\S]{0,220}\b(?:that|the) player may play that card this turn\b/.test(text)) {
    addRole(profile, "selection", 0.36, "Advanced scan recognized forced temporary card access.");
    addRole(profile, "hand_attack", 0.36, "Advanced scan recognized random hand exile pressure.");
    addRole(profile, "replacement_engine", 0.28, "Advanced scan recognized a temporary play-or-lose replacement pattern.");
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
    /\bwhenever enchanted creature becomes blocked\b[^.]{0,120}\btap all lands defending player controls\b/.test(text) ||
    /\bif a player taps a nonbasic land for mana\b[^.]{0,120}\bit produces colorless mana instead\b/.test(text) ||
    /\blands target player controls don'?t untap during their next untap step\b/.test(text) ||
    /\bwhenever a player puts a nontoken creature onto the battlefield\b[^.]{0,160}\bthat player returns a land they control to its owner'?s hand\b/.test(text) ||
    /\beach player chooses from the lands they control a land of each basic land type\b[\s\S]{0,160}\bsacrifices the rest\b/.test(text) ||
    /\beach player chooses a land they control of each basic land type\b[\s\S]{0,140}\breturn those lands to their owners'? hands\b/.test(text) ||
    /\bwhenever a land enters\b[^.]{0,120}\btap all lands its controller controls\b/.test(text) ||
    /\bat the beginning of each player'?s upkeep\b[^.]{0,140}\bthat player sacrifices a nonbasic land\b/.test(text) ||
    /\bwhenever a player taps a land for mana\b[^.]{0,120}\bif it'?s not that player'?s turn\b[^.]{0,80}\bdestroy that land\b/.test(text) ||
    /\bwhenever a land an opponent controls is tapped for mana\b[^.]{0,180}\btap all lands that player controls\b/.test(text) ||
    /\bwhenever a player casts a spell\b[^.]{0,160}\bthat player returns a land they control to its owner'?s hand\b/.test(text) ||
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

  if (/\bat the beginning of each upkeep\b[^.]{0,120}\buntap all creatures and lands\b/.test(text)) {
    addRole(profile, "tap_untap", 0.54, "Advanced scan recognized global untap utility.");
    addRole(profile, "group_hug", 0.28, "Advanced scan recognized symmetrical untap utility.");
  }

  if (/\blands with the chosen names can'?t be played\b/.test(text)) {
    addRole(profile, "land_denial", 0.36, "Advanced scan recognized a named-land play restriction.");
    addRole(profile, "hate_piece", 0.42, "Advanced scan recognized a named-card restriction as a hate piece.");
    addRole(profile, "stax_piece", 0.38, "Advanced scan recognized a named-card play restriction.");
  }

  if (
    /\bwhenever a player casts\b[^.]{0,80}\b(?:spell|enchantment spell)\b[^.]{0,80}\bcounter it\b/.test(text) ||
    /\bpermanents don'?t untap during their controllers'? untap steps\b/.test(text) ||
    /\bcreatures don'?t untap during their controllers'? untap steps\b/.test(text) ||
    /\blegendary creatures don'?t untap during their controllers'? untap steps\b/.test(text) ||
    /\bcreatures without flying don't untap during their controllers'? untap steps\b/.test(text) ||
    /\bcreatures of the chosen type don't untap during their controllers'? untap steps\b/.test(text) ||
    /\bcreatures with power \d+ or less don'?t untap during their controllers'? untap steps\b/.test(text) ||
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
    /\bwhenever an opponent casts a creature spell\b[^.]{0,120}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bwhenever an opponent discards a card\b[^.]{0,120}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bwhenever a player says the chosen word\b[^.]{0,120}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bwhenever a player says\b[^.]{0,80}\bat any other time\b[^.]{0,120}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bwhenever a creature deals damage to a player\b[^.]{0,180}\bdeals? \d+ damage to them\b/.test(text) ||
    /\bif the player doesn'?t\b[^.]{0,120}\bdeals? \d+ damage to them\b/.test(text) ||
    /\bat the beginning of your upkeep\b[^.]{0,80}\bfor each player\b[^.]{0,120}\bdeals? \d+ damage to that player unless they pay\b/.test(text) ||
    /\bat the beginning of the upkeep of enchanted creature'?s controller\b[\s\S]{0,220}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bwhenever enchanted creature becomes tapped\b[^.]{0,120}\bdeals? \d+ damage to that creature'?s controller\b/.test(text) ||
    /\btarget player chooses a card name\b[\s\S]{0,220}\bdeals? \d+ damage to them\b/.test(text) ||
    /\bwhenever enchanted creature deals damage to you\b[^.]{0,160}\bdeals? that much damage to that creature'?s controller\b/.test(text) ||
    /\bwhenever a creature is dealt damage\b[^.]{0,160}\bdeals? that much damage to that creature'?s controller\b/.test(text) ||
    /\bwhenever an opponent draws a card\b[^.]{0,140}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bwhenever an opponent discards a card\b[^.]{0,140}\bthat player loses \d+ life\b/.test(text) ||
    /\bat the beginning of each opponent'?s upkeep\b[^.]{0,160}\bthey lose \d+ life\b/.test(text) ||
    /\bat the beginning of the upkeep of enchanted creature'?s controller\b[^.]{0,120}\bthat player loses \d+ life\b/.test(text) ||
    /\bat the beginning of enchanted player'?s upkeep\b[^.]{0,160}\bthis aura deals? \d+ damage to that player\b/.test(text) ||
    /\bwhenever you cast a spell during an opponent'?s turn\b[^.]{0,120}\beach opponent loses \d+ life\b/.test(text) ||
    /\bwhenever an opponent casts a white spell\b[^.]{0,120}\bthey lose \d+ life\b/.test(text) ||
    /\bwhenever a player casts a spell\b[^.]{0,120}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bat the beginning of your upkeep\b[^.]{0,180}\btarget player loses \d+ life\b/.test(text) ||
    /\bwhenever a player draws a card\b[^.]{0,160}\bthat player loses \d+ life unless they pay\b/.test(text) ||
    /\bmay have this enchantment deal \d+ damage to the second player\b/.test(text) ||
    /\bat the beginning of the end step of enchanted creature'?s controller\b[^.]{0,180}\bdeals? \d+ damage to that player unless that creature attacked this turn\b/.test(text) ||
    /\bwhenever a nontoken permanent is put into a player'?s graveyard from the battlefield\b[^.]{0,120}\bthat player loses \d+ life\b/.test(text) ||
    /\bwhenever a player taps a land for mana\b[^.]{0,160}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bwhenever a player taps an island for mana\b[^.]{0,160}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bat the beginning of each player'?s upkeep\b[^.]{0,160}\bthat player gains \d+ life for each basic land type\b[\s\S]{0,160}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bwhenever an artifact becomes tapped\b[^.]{0,220}\bdeals? \d+ damage to that artifact's controller\b/.test(text) ||
    /\bwhenever enchanted (?:land|artifact) becomes tapped\b[^.]{0,160}\bdeals? \d+ damage to that (?:land|artifact)'?s controller\b/.test(text) ||
    /\bwhenever a player taps a nonbasic land for mana\b[^.]{0,160}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bwhenever a land enters\b[^.]{0,160}\bdeals? \d+ damage to that land'?s controller\b/.test(text) ||
    /\bwhenever a land is put into a graveyard\b[^.]{0,180}\bdeals? \d+ damage to that land'?s controller\b/.test(text) ||
    /\bwhenever a creature dies\b[^.]{0,160}\bdeals? \d+ damage to that creature'?s controller\b/.test(text) ||
    /\bwhenever a creature blocks\b[^.]{0,120}\bdeals? \d+ damage to that creature'?s controller\b/.test(text) ||
    /\bwhen the chosen player draws a card with the chosen name\b[\s\S]{0,180}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\beach player may discard\b[\s\S]{0,160}\bdeals damage to each player\b/.test(text) ||
    /\beach player loses life equal to the number of items they revealed\b[\s\S]{0,180}\bloses half their life\b/.test(text) ||
    /\b(?:deals? (?:x|\d+) damage|deals? damage equal to [^.]{0,80}) to each creature\b[^.]{0,80}\band each player\b/.test(text) ||
    /\beach enchantment deals \d+ damage to its controller\b/.test(text) ||
    /\bwhenever another artifact is put into a graveyard from the battlefield\b[^.]{0,120}\bdeals? \d+ damage\b/.test(text) ||
    /\bwhenever enchanted creature is dealt damage\b[^.]{0,120}\bit deals that much damage to its controller\b/.test(text)
  ) {
    addRole(profile, "group_slug", 0.62, "Advanced scan recognized repeatable table damage.");
    addRole(profile, "damage_engine", 0.56, "Advanced scan recognized repeatable damage pressure.");
  }

  if (
    /\bdeals damage to target player equal to the number of cards in that player'?s hand\b/.test(text) ||
    /\bdeals damage to that player equal to the number of cards in that player'?s hand\b/.test(text) ||
    /\bdeals damage to that player equal to the number of white cards in their hand\b/.test(text) ||
    /\bdeals damage to each player equal to the number of lands they control\b/.test(text) ||
    /\beach player loses \d+ life for each creature they control\b/.test(text) ||
    /\bdeals damage to each player equal to the number of creatures of that color that player controls\b/.test(text) ||
    /\bdeals damage equal to that card'?s mana value to that player\b/.test(text) ||
    /\bdeals? damage to any target equal to the number of (?:arcane cards in your graveyard|cards in your hand|shrines you control)\b/.test(text) ||
    /\bdeals? damage to target spell'?s controller equal to that spell'?s mana value\b/.test(text) ||
    /\bdeals? damage to any target equal to the number of (?:mountains|forests|permanents you control of the chosen type)\b/.test(text) ||
    /\bdeals? damage to target (?:creature|player|opponent) equal to the number of (?:forests|swamps|islands|mountains|plains) you control\b/.test(text) ||
    /\bdeals? \d+ damage divided as you choose among (?:one, two, or three|one or two) target/.test(text) ||
    /\bdeals? \d+ damage divided as you choose among one, two, or three targets\b/.test(text) ||
    /\btarget player loses \d+ life for each tapped artifact they control\b/.test(text) ||
    /\btarget player loses \d+ life\b/.test(text) ||
    /\benchanted (?:artifact|creature|land) has\b[^.]{0,120}\b(?:you lose|target player loses) \d+ life\b/.test(text) ||
    /\bwhenever enchanted (?:creature|land|artifact) (?:is dealt damage|becomes tapped)\b[^.]{0,180}\bits controller loses\b/.test(text) ||
    /\bwhenever a spell or ability causes a player to shuffle their library\b[^.]{0,160}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bwhenever an opponent is dealt \d+ or more damage by a single source\b[^.]{0,120}\bthat player discards a card\b/.test(text) ||
    /\benchanted land has\b[^.]{0,120}\btarget player loses \d+ life\b/.test(text) ||
    /\beach player loses life equal to the number of items they revealed\b[\s\S]{0,180}\bloses half their life\b/.test(text) ||
    /\bdeals? \d+ damage to each player\b/.test(text) ||
    /\bdeals? \d+ damage to that player for each card of the chosen type revealed this way\b/.test(text) ||
    /\bdeals? 10 damage to that player\b/.test(text) ||
    /\bdeals? 8 damage to that player\b/.test(text) ||
    /\bdeals? damage to that creature and that player equal to the revealed card'?s mana value\b/.test(text) ||
    /\bdeals? damage to any target equal to 1 plus the number of instant and sorcery spells cast\b/.test(text) ||
    /\bwhenever you and\/or at least one permanent you control becomes the target\b[\s\S]{0,160}\bdeals? \d+ damage to that player\b/.test(text) ||
    /\bdeals damage equal to its intensity to any target\b/.test(text) ||
    /\bdeals damage to each opponent equal to the number of islands that player controls\b/.test(text)
  ) {
    addRole(profile, "direct_finisher", 0.54, "Advanced scan recognized scalable direct player damage.");
    addRole(profile, "finisher", 0.42, "Advanced scan recognized scalable player damage as closing pressure.");
  }

  if (/\bexchange life totals with (?:target|that) player\b/.test(text) || /\btarget player\b[^.]{0,80}\bexchange life totals\b/.test(text)) {
    addRole(profile, "lifegain", 0.34, "Advanced scan recognized life-total exchange utility.");
    addRole(profile, "life_pressure", 0.3, "Advanced scan recognized life-total exchange pressure.");
  }

  if (/\btarget player'?s life total becomes \d+\b/.test(text)) {
    addRole(profile, "lifegain", 0.34, "Advanced scan recognized life-total setting utility.");
    addRole(profile, "life_pressure", 0.34, "Advanced scan recognized life-total setting pressure.");
  }

  if (
    /\battacks?\b|\bcombat damage\b|\bcreatures you control get\b|\battacking creatures\b|\bcan't be blocked\b|\bgoad\b/.test(
      text,
    ) ||
    /\bcreatures? (?:can't|can not) block\b/.test(text) ||
    /\ball creatures block each combat if able\b/.test(text) ||
    /\bcan block an additional creature each combat\b/.test(text) ||
    /\b(?:all |other |face-down |attacking |blocking |tapped |untapped )?(?:creatures?|creature tokens?|zombies|skeletons|elves|goblins|dragons|vampires|soldiers|warriors|slivers|eldrazi|angels|humans|wizards|rogues|knights|merfolk|pirates|cats|beasts|tokens)(?: you control)?\b[^.]{0,160}\b(?:get|gets) (?:\+\d+\/\+\d+|\+\d+\/\+0|\+0\/\+\d+|\+x\/\+x)\b/.test(text) ||
    /\b(?:creatures?|employees|dogs|tokens)(?: and (?:creatures?|employees|dogs|tokens))? you control\b[^.]{0,160}\b(?:get|gets) (?:\+x\/\+\d+|\+x\/\+0|\+\d+\/\+\d+|\+\d+\/\+0|\+0\/\+\d+|\+x\/\+x)\b/.test(text) ||
    /\bother (?:zombies|skeletons|elves|goblins|dragons|vampires|soldiers|warriors|slivers|eldrazi|angels|humans|wizards|rogues|knights|merfolk|pirates|cats|beasts)\b[^.]{0,140}\byou control get \+\d+\/\+\d+\b/.test(text) ||
    /\ball (?:zombies|skeletons|elves|goblins|dragons|vampires|soldiers|warriors|slivers|eldrazi|angels|humans|wizards|rogues|knights|merfolk|pirates|cats|beasts)\b[^.]{0,120}\bgain\b/.test(text) ||
    /\b(?:all |other |face-down |attacking |blocking |tapped |untapped )?(?:creatures?|creature tokens?|sliver creatures|knight creatures|zombies|skeletons|elves|goblins|dragons|vampires|soldiers|warriors|slivers|eldrazi|angels|humans|wizards|rogues|knights|merfolk|pirates|cats|beasts)(?: you control)?\b[^.]{0,160}\b(?:gain|gains|have|has)\b[^.]{0,120}\b(?:flying|haste|double strike|first strike|menace|trample|lifelink|vigilance|deathtouch|indestructible|ward)\b/.test(text) ||
    /\btarget creature gains\b[^.]{0,120}\bflanking\b/.test(text) ||
    /\btarget creature gains shadow\b/.test(text) ||
    /\btarget creature with\b[^.]{0,120}\bloses it and another target creature gains it\b/.test(text) ||
    /\bcreatures you control gain haste\b/.test(text) ||
    /\bcreatures your opponents control\b[^.]{0,120}\bcan'?t block\b/.test(text) ||
    /\bother creatures they control can'?t block this turn\b/.test(text) ||
    /\benchanted creature can block any number of creatures\b/.test(text) ||
    /\benchanted creature has reach\b/.test(text) ||
    /\blands you control are \d+\/\d+ creatures\b[^.]{0,120}\bwith first strike\b/.test(text) ||
    /\ball creatures lose flying\b/.test(text) ||
    /\btap all (?:non(?:blue|white|black|red|green)|blue|white|black|red|green)? ?creatures\b/.test(text) ||
    /\btarget creature doesn't untap during its controller'?s next untap step\b/.test(text) ||
    /\bcreatures target player controls don'?t untap during that player'?s next untap step\b/.test(text) ||
    /\btarget creature blocks this turn if able\b/.test(text) ||
    /\btarget creature blocks target creature this turn if able\b/.test(text) ||
    /\btarget creature an opponent controls blocks this turn if able\b/.test(text) ||
    /\btarget creature defending player controls can block any number of creatures\b/.test(text) ||
    /\bcreatures without flying don't untap during their controllers'? untap steps\b/.test(text) ||
    /\bcreatures of the chosen type don't untap during their controllers'? untap steps\b/.test(text) ||
    /\ball creatures able to block enchanted creature do so\b/.test(text) ||
    /\bonly creatures in the chosen piles can block this turn\b/.test(text) ||
    /\btarget creature attacks target opponent this turn if able\b/.test(text) ||
    /\b(?:target creature|creature you control|equipped creature|enchanted creature)\b[^.]{0,140}\bgets? (?:\+\d+\/\+\d+|\+x\/\+(?:x|0))\b/.test(text) ||
    /\beach of them gets? \+\d+\/\+\d+ until end of turn\b/.test(text) ||
    /\bit gets? \+\d+\/\+\d+ until end of turn\b/.test(text) ||
    /\b(?:target creature|creature you control|equipped creature|enchanted creature)\b[^.]{0,140}\bgets? \+\d+\/-\d+\b/.test(text) ||
    /\btarget creature gets? -x\/\+x until end of turn\b/.test(text) ||
    /\benchanted creature\b[^.]{0,140}\bgets? -(?:x|\d+)\/-(?:y|\d+)\b/.test(text) ||
    combatKeywordSupport ||
    /\bgets? (?:\+\d+\/\+\d+|\+x\/\+x) for each\b/.test(text) ||
    /\bpower and toughness (?:are )?each equal to\b/.test(text) ||
    /\bhas power and toughness equal to\b/.test(text) ||
    /\bswitch (?:target creature'?s|the) power and toughness\b/.test(text) ||
    /\bdistribute x \+\d+\/\+\d+ counters?\b/.test(text) ||
    /\bhave base power and toughness x\/x\b/.test(text) ||
    /\bequipped creature\b[^.]{0,120}\b(?:gets|has|gains)\b[^.]{0,120}(?:\+\d+\/\+\d+|\+\d+\/\+0|\b(?:trample|double strike|first strike|menace|flying|lifelink)\b)/.test(text) ||
    /\btarget creature gains\b[^.]{0,120}\b(?:haste|first strike|double strike|trample|menace|flying)\b/.test(text) ||
    /\btarget creature can block any number of creatures\b/.test(text) ||
    /\buntap up to two target creatures\b[\s\S]{0,100}\bthey each get \+\d+\/\+\d+\b/.test(text) ||
    /\beach land gets \+\d+\/\+\d+ as long as it'?s a creature\b/.test(text)
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
    /\bplayers can'?t draw cards\b/.test(text) ||
    /\bspells with the chosen name can'?t be cast\b/.test(text) ||
    /\bcreature spells can'?t be countered\b/.test(text) ||
    /\bactivated abilities of artifacts and creatures can'?t be activated unless they'?re mana abilities\b/.test(text) ||
    /\beach artifact spell costs \{1\} more to cast for each artifact its controller controls\b/.test(text) ||
    /\bactivated abilities cost \{\d+\} more to activate unless they'?re mana abilities\b/.test(text) ||
    /\bnonland permanents don'?t untap during their controllers'? untap steps\b/.test(text) ||
    /\bcreatures played by your opponents enter tapped\b/.test(text) ||
    /\btap all other artifacts\b[\s\S]{0,180}\bthey don'?t untap during their controllers'? untap steps\b/.test(text) ||
    /\ball creatures lose all abilities and have base power and toughness \d+\/\d+\b/.test(text) ||
    /\ball lands are \d+\/\d+ creatures\b/.test(text) ||
    /\bwhenever a player casts a spell\b[^.]{0,160}\bthat player returns a land they control to its owner'?s hand\b/.test(text) ||
    /\bthat player can untap only permanents of the chosen type this step\b/.test(text) ||
    /\bmercenaries don'?t untap during their controllers'? untap steps\b/.test(text) ||
    /\bcreatures with power \d+ or less don'?t untap during their controllers'? untap steps\b/.test(text) ||
    /\bwhenever a creature enters\b[^.]{0,120}\bexile that creature\b/.test(text) ||
    /\beach nontoken permanent\b[^.]{0,120}\bis sacrificed by its controller\b/.test(text) ||
    /\b(?:blue creatures|creatures with power \d+ or greater|creatures of the chosen type) don't untap during (?:their|their controllers'?) untap steps\b/.test(text) ||
    /\bactivated abilities of artifacts can'?t be activated\b/.test(text) ||
    /\bspells you control can'?t be countered\b/.test(text) ||
    /\btarget player puts all the cards from their graveyard on the bottom of their library\b/.test(text) ||
    /\bplayers can'?t get counters\b/.test(text) ||
    /\bcounters can'?t be put on artifacts, creatures, enchantments, or lands\b/.test(text) ||
    /\bwhenever an opponent casts a creature spell\b[^.]{0,120}\bthat player loses \d+ life unless they pay\b/.test(text) ||
    /\bwhenever a player casts a spell from their hand\b[\s\S]{0,240}\bmay cast that card without paying its mana cost\b/.test(text)
  ) {
    addRole(profile, "hate_piece", 0.72, "Advanced scan recognized a hate or tax piece.");
  }

  if (
    /\bactivated abilities of artifacts and creatures can'?t be activated unless they'?re mana abilities\b/.test(text) ||
    /\beach artifact spell costs \{1\} more to cast for each artifact its controller controls\b/.test(text) ||
    /\bactivated abilities cost \{\d+\} more to activate unless they'?re mana abilities\b/.test(text) ||
    /\bwhenever a player casts a creature spell\b[^.]{0,120}\bthat player adds \{g\}/.test(text) ||
    /\bwhenever an opponent casts a creature spell\b[^.]{0,120}\bthat player loses \d+ life unless they pay\b/.test(text) ||
    /\bwhenever a player casts a spell from their hand\b[\s\S]{0,240}\bmay cast that card without paying its mana cost\b/.test(text)
  ) {
    addRole(profile, "stax_piece", 0.48, "Advanced scan recognized tax or activation restriction pressure.");
  }

  if (/\bwhenever a player casts a creature spell\b[^.]{0,120}\bthat player adds \{g\}/.test(text)) {
    addRole(profile, "group_hug", 0.32, "Advanced scan recognized symmetrical creature-cast mana.");
    addRole(profile, "ramp", 0.24, "Advanced scan recognized symmetrical creature-cast mana.");
  }

  if (/\btarget player loses all poison counters\b/.test(text)) {
    addRole(profile, "poison_hate", 0.34, "Advanced scan recognized poison-counter removal.");
    addRole(profile, "hate_piece", 0.24, "Advanced scan recognized poison-counter removal as narrow hate.");
  }

  if (/\benchanted creature has infect\b/.test(text)) {
    addRole(profile, "finisher", 0.44, "Advanced scan recognized infect as poison pressure.");
    addRole(profile, "alternate_finisher", 0.46, "Advanced scan recognized infect as poison pressure.");
    addRole(profile, "combat_support", 0.34, "Advanced scan recognized infect as combat support.");
  }

  if (/\bremove all counters from all permanents and exile all tokens\b/.test(text)) {
    addRole(profile, "counter_hate", 0.58, "Advanced scan recognized counter and token reset.");
    addRole(profile, "hate_piece", 0.46, "Advanced scan recognized counter and token hate.");
    addRole(profile, "removal", 0.44, "Advanced scan recognized token cleanup.");
  }

  if (/\bremove up to (?:five|\d+) counters from target\b/.test(text)) {
    addRole(profile, "counter_hate", 0.4, "Advanced scan recognized targeted counter removal.");
    addRole(profile, "hate_piece", 0.24, "Advanced scan recognized targeted counter hate.");
  }

  if (/\bwhenever an opponent shuffles their library\b[\s\S]{0,160}\byou may exile one of those cards\b/.test(text)) {
    addRole(profile, "hate_piece", 0.36, "Advanced scan recognized shuffle-punisher library pressure.");
    addRole(profile, "topdeck_control", 0.34, "Advanced scan recognized topdeck manipulation.");
  }

  const sacrificeOnlyAsEtbDrawback =
    /\bwhen this (?:creature|land) enters, sacrifice it unless\b/.test(text) &&
    !/\bsacrifice\b[^.]{0,100}:/.test(text) &&
    !/\bas an additional cost\b[^.]{0,120}\bsacrifice\b/.test(text) &&
    !/\b(?:whenever|when)\b[^.]{0,120}\bdies\b/.test(text);
  const sacrificeOnlyAsCumulativeUpkeepDrawback =
    /\bcumulative upkeep\b/.test(text) &&
    !/\bsacrifice\b[^.]{0,100}:/.test(text) &&
    !/\bas an additional cost\b[^.]{0,120}\bsacrifice\b/.test(text) &&
    !/\b(?:whenever|when)\b[^.]{0,120}\bdies\b/.test(text) &&
    !/\byou may sacrifice\b/.test(text);
  const deathOnlySelfReplacement =
    /\bwhen this creature dies\b[^.]{0,120}\b(?:shuffle it into its owner'?s library|return it to its owner'?s hand|put it on top of its owner'?s library)\b/.test(text) &&
    !/\b(?:each opponent|target|destroy|discard|draw|gain|lose|create|token|return target)\b/.test(text);

  if (
    (/\bsacrifice\b/.test(text) && !sacrificeOnlyAsEtbDrawback && !sacrificeOnlyAsCumulativeUpkeepDrawback) ||
    (!deathOnlySelfReplacement && /\bwhenever\b[^.]{0,120}\bdies\b|\bwhen\b[^.]{0,120}\bdies\b/.test(text)) ||
    /\b(?:creature|artifact|permanent)s? dying causes a triggered ability\b[^.]{0,180}\btriggers? an additional time\b/.test(text) ||
    /\b(?:creature|artifact|permanent)s? dying\b[^.]{0,160}\btriggered ability\b[^.]{0,160}\badditional time\b/.test(text)
  ) {
    addRole(profile, "sacrifice_support", 0.58, "Advanced scan recognized sacrifice or death-trigger support.");
  }

  if (
    /\b\+\d+\/\+\d+ counters?\b|\bcounters? on\b|\bproliferate\b|\bmove (?:a|any number of) counters?\b/.test(text) ||
    /\bdistribute\b[^.]{0,120}[+-]\d+\/[+-]\d+ counters? among\b/.test(text) ||
    /\bput a -\d+\/-\d+ counter on target creature\b/.test(text) ||
    hasAnyKeyword(keywords, ["proliferate", "support", "backup", "adapt", "monstrosity", "level up"]) ||
    /\bcounters? would be (?:put|placed)\b[\s\S]{0,180}\b(?:that many plus|additional|twice that many)\b/.test(text)
  ) {
    addRole(profile, "counter_support", 0.58, "Advanced scan recognized counter support.");
  }

  if (/\bmove all counters from target creature onto another target creature\b/.test(text)) {
    addRole(profile, "counter_support", 0.64, "Advanced scan recognized counter transfer.");
  }

  if (/\benergy counters?\b|\bpay \{e\}/.test(text)) {
    addRole(profile, "energy_support", permanent ? 0.58 : 0.46, "Advanced scan recognized energy support.");
  }

  if (/\bmills?\b|\bmill\b|\bputs? the rest of the revealed cards into their graveyard\b/.test(text)) {
    addRole(profile, "mill_support", 0.52, "Advanced scan recognized mill or graveyard-filling support.");
  }

  if (
    (/\bcreate(?:s)? (?:a|one|two|three|\d+|x) [^.]*(?:creature )?tokens?\b/.test(text) ||
      /\bcreates? a \d+\/\d+ [^.]*creature token\b/.test(text)) &&
    (
      !/\b(?:its|that creature'?s|enchanted creature'?s|target .*'?s) controller creates?\b/.test(text) ||
      /\bwhenever a nontoken creature enters\b[^.]{0,180}\bthat creature'?s controller creates?\b/.test(text) ||
      /\bwhenever a land enters\b[^.]{0,120}\bits controller creates?\b/.test(text)
    )
  ) {
    addRole(profile, "tokens", permanent ? 0.58 : 0.48, "Advanced scan recognized token production.");
    addRole(profile, "token_support", permanent ? 0.62 : 0.5, "Advanced scan recognized token production.");
  }

  if (/\ball permanents are enchantments in addition to their other types\b/.test(text)) {
    addRole(profile, "enchantress", 0.36, "Advanced scan recognized enchantment-type conversion.");
    addRole(profile, "type_change", 0.42, "Advanced scan recognized global type-changing utility.");
  }

  if (/\benchanted permanent is an enchantment and loses all other card types\b/.test(text)) {
    addRole(profile, "type_change", 0.42, "Advanced scan recognized enchantment-type conversion.");
    addRole(profile, "removal", 0.34, "Advanced scan recognized type conversion as functional removal.");
  }

  if (/\bnonland permanents you control are artifacts in addition to their other types\b/.test(text)) {
    addRole(profile, "artifact_support", 0.48, "Advanced scan recognized artifact-type conversion.");
    addRole(profile, "type_change", 0.36, "Advanced scan recognized artifact-type conversion.");
  }

  if (
    /\btarget opponent reveals cards from the top of their library until\b[\s\S]{0,180}\bputs? all (?:cards|noncreature cards) revealed this way into their graveyard\b/.test(text)
  ) {
    addRole(profile, "mill_support", 0.5, "Advanced scan recognized reveal-until mill pressure.");
    addRole(profile, "cheat_into_play", 0.38, "Advanced scan recognized a creature entering from an opponent library.");
  }

  if (/\bexchange your graveyard and library\b/.test(text)) {
    addRole(profile, "graveyard_support", 0.62, "Advanced scan recognized library-graveyard exchange setup.");
    addRole(profile, "mill_support", 0.48, "Advanced scan recognized library-graveyard exchange as graveyard fill.");
  }

  if (/\beach player may draw up to (?:one|two|three|\d+) cards?\b/.test(text)) {
    addRole(profile, "draw", 0.34, "Advanced scan recognized symmetrical optional card draw.");
    addRole(profile, "card_draw", 0.34, "Advanced scan recognized symmetrical optional card draw.");
    addRole(profile, "group_hug", 0.3, "Advanced scan recognized symmetrical table resource support.");
    if (/\bthat player gains? \d+ life\b/.test(text)) {
      addRole(profile, "lifegain", 0.24, "Advanced scan recognized symmetrical life gain.");
    }
  }

  if (
    /\byour life total becomes (?:the number of|that number|\d+)\b/.test(text) ||
    /\byour life total becomes equal to your starting life total\b/.test(text) ||
    /\beach player's life total becomes\b/.test(text) ||
    /\btwo target players exchange life totals\b/.test(text) ||
    /\bredistribute any number of players'? life totals\b/.test(text)
  ) {
    addRole(profile, "lifegain", 0.34, "Advanced scan recognized life-total setting utility.");
    addRole(profile, "life_pressure", 0.34, "Advanced scan recognized life-total manipulation.");
  }

  if (
    /\bwhenever a player casts an instant or sorcery spell\b[^.]{0,220}\beach other player copies that spell\b/.test(text) ||
    /\bwhenever a player casts an instant or sorcery card\b[\s\S]{0,240}\bthat player copies each instant or sorcery card exiled\b/.test(text) ||
    /\bwhenever a player casts an instant or sorcery spell\b[^.]{0,120}\bthat player copies it\b/.test(text) ||
    /\bwhenever you cast an adventure instant or sorcery spell\b[^.]{0,120}\bcopy it\b/.test(text)
  ) {
    addRole(profile, "copy_support", 0.58, "Advanced scan recognized spell-copy engine.");
    addRole(profile, "spellslinger", 0.52, "Advanced scan recognized spell-copy engine.");
  }

  if (/\bwhenever a nonartifact permanent you control enters\b[^.]{0,180}\breturn another permanent you control\b/.test(text)) {
    addRole(profile, "bounce_engine", 0.58, "Advanced scan recognized repeatable self-bounce engine.");
    addRole(profile, "blink", 0.34, "Advanced scan recognized repeatable ETB reuse support.");
    addRole(profile, "combo_support", 0.36, "Advanced scan recognized reusable permanent-loop material.");
  }

  if (/\bplay (?:x|\d+) random fast effects\b|\bplay a random effect\b/.test(text)) {
    addRole(profile, "random_effect", 0.22, "Advanced scan recognized random-effect text.");
    addRole(profile, "alternate_play", 0.18, "Advanced scan recognized alternate gameplay text.");
  }

  if (/\bwhenever a spell or ability is put onto the stack\b[\s\S]{0,160}\breselect its target at random\b/.test(text)) {
    addRole(profile, "random_effect", 0.44, "Advanced scan recognized random retargeting.");
    addRole(profile, "stax_piece", 0.34, "Advanced scan recognized target disruption.");
  }

  if (/\bplayers don'?t lose unspent mana as steps and phases end\b/.test(text)) {
    addRole(profile, "ramp", 0.34, "Advanced scan recognized mana retention.");
    addRole(profile, "group_hug", 0.28, "Advanced scan recognized symmetrical mana retention.");
  }

  if (
    /\bgain control of\b|\byou control enchanted (?:creature|artifact|permanent)\b|\bput that card onto the battlefield under your control\b/.test(text) ||
    /\bput\b[^.]{0,80}\brandom creature from (?:a|any) random graveyard into play under your control\b/.test(text) ||
    /\bput target creature card from an opponent'?s graveyard onto the battlefield under your control\b/.test(text) ||
    /\byou control enchanted land\b/.test(text) ||
    /\bexchange control of\b[^.]{0,220}\b(?:target|two|all|creature|artifact|enchantment|permanent|permanents|spell)\b/.test(text) ||
    /\bthose players exchange control of those creatures\b/.test(text) ||
    /\byou control enchanted enchantment\b/.test(text) ||
    /\bexchanges? control of\b[^.]{0,260}\brandom target\b[^.]{0,160}\b(?:artifact|creature|land|permanent)\b/.test(text) ||
    /\bexile\b[^.]{0,180}\b(?:target|an opponent'?s|opponent'?s)\b[^.]{0,180}\byou may (?:cast|play)\b/.test(text) ||
    /\byou may (?:cast|play)\b[^.]{0,180}\bfrom (?:an|your) opponents?'? (?:graveyard|library|hand|exile)\b/.test(text) ||
    /\byou may (?:cast|play) spells? from (?:an opponent'?s|opponents?'?) (?:graveyard|library|hand|exile)\b/.test(text) ||
    /\bthat player owns from exile onto the battlefield under your control\b/.test(text) ||
    /\btarget opponent exiles cards\b[\s\S]{0,260}\byou may cast\b/.test(text) ||
    /\bput a creature card\b[^.]{0,120}\bexiled with\b[^.]{0,120}\bonto the battlefield under your control\b/.test(text) ||
    /\byou control target player during\b/.test(text) ||
    /\bthe first player controls the second player\b/.test(text)
  ) {
    addRole(profile, "theft_support", 0.5, "Advanced scan recognized theft or borrowed-resource support.");
  }

  if (
    /\b(?:target|an|each) opponent gains? control of\b/.test(text) ||
    /\bgains? control of target\b[^.]{0,140}\byou control\b/.test(text) ||
    /\bexchange control of\b[^.]{0,220}\b(?:target|two|all|creature|artifact|enchantment|permanent|permanents|spell)\b/.test(text) ||
    /\bexchanges? control of\b[^.]{0,260}\brandom target\b[^.]{0,160}\b(?:artifact|creature|land|permanent)\b/.test(text) ||
    /\byou own\b[^.]{0,180}\b(?:an opponent controls|opponent controls)\b/.test(text) ||
    /\bpermanents? you own but don'?t control\b/.test(text) ||
    /\btarget opponent (?:creates?|gains?|may draw)\b/.test(text) ||
    /\btarget opponent may choose\b[^.]{0,160}\bput it onto the battlefield under their control\b/.test(text)
  ) {
    addRole(profile, "donation_support", permanent ? 0.64 : 0.56, "Advanced scan recognized donation, exchange, or political control-transfer support.");
  }

  if (hasLandAnimationText(text)) {
    addRole(profile, "land_animation", 0.46, "Advanced scan recognized land animation.");
    addRole(profile, "combat_support", 0.28, "Advanced scan recognized land animation as combat material.");
  }

  if (
    /\bartifacts? you control\b|\bartifact you control\b|\bartifact or creature entering\b|\bnoncreature, non-equipment artifacts\b|\bequipped creature\b/.test(text) ||
    /\btarget permanent becomes an artifact in addition to its other types\b/.test(text) ||
    /\bput\b[^.]{0,140}\bartifact card from your hand\b[^.]{0,100}\bonto the battlefield\b/.test(text) ||
    /\b(?:unattach|attach|equipment)\b/.test(text)
  ) {
    addRole(profile, "artifact_support", 0.54, "Advanced scan recognized artifact support.");
  }

  if (/\b(?:storm|replicate)\b/.test(text)) {
    addRole(profile, "copy_support", 0.42, "Advanced scan recognized spell-copy keyword text.");
    addRole(profile, "spellslinger", 0.36, "Advanced scan recognized spell-copy keyword text.");
  }

  if (/\bripple \d+\b/.test(text) || /\bspells you cast have ripple\b/.test(text)) {
    addRole(profile, "copy_support", 0.34, "Advanced scan recognized ripple-style spell chaining.");
    addRole(profile, "spellslinger", 0.28, "Advanced scan recognized ripple-style spell chaining.");
  }

  if (/\bwhenever you cast a kicked spell\b[^.]{0,140}\bdeals? damage to any target\b/.test(text)) {
    addRole(profile, "damage_engine", 0.46, "Advanced scan recognized kicker damage payoff.");
    addRole(profile, "direct_finisher", 0.36, "Advanced scan recognized repeatable damage payoff.");
  }

  if (/\bshrines?\b/.test(text)) {
    addRole(profile, "shrine_support", 0.58, "Advanced scan recognized Shrine-scaling text.");
    addRole(profile, "enchantress", 0.32, "Advanced scan recognized Shrine enchantment material.");
  }

  if (/\bthe \"legend rule\" doesn'?t apply\b|\ball nonland permanents are legendary\b/.test(text)) {
    addRole(profile, "legendary_support", 0.42, "Advanced scan recognized legendary-matters utility.");
  }

  if (
    /\bcopy of\b|\bbecomes a copy\b|\bcopy that spell or ability\b/.test(text) ||
    /\bcopy (?:target|that|the)\b[^.]{0,120}\b(?:spell|instant|sorcery|ability)\b/.test(text) ||
    /\bcopy (?:those cards|each card exiled with this enchantment)\b/.test(text) ||
    /\bcopy three (?:instant|sorcery) cards chosen at random\b/.test(text) ||
    /\bcopy it for each other instant and sorcery spell\b/.test(text) ||
    /\btriggered ability\b[\s\S]{0,120}\btriggers? an additional time\b/.test(text)
  ) {
    addRole(profile, "copy_support", 0.52, "Advanced scan recognized copy-based utility.");
  }

  if (/\bwhenever you cast (?:your first )?instant or sorcery spell\b/.test(text) || /\bwhenever you cast an instant or sorcery spell\b/.test(text)) {
    addRole(profile, "spellslinger", permanent ? 0.62 : 0.5, "Advanced scan recognized instant/sorcery cast payoff.");
    addRole(profile, "copy_support", permanent ? 0.48 : 0.36, "Advanced scan recognized instant/sorcery cast payoff.");
  }

  if (/\bcopy three (?:instant|sorcery) cards chosen at random\b[\s\S]{0,120}\byou may cast one of the copies without paying its mana cost\b/.test(text)) {
    addRole(profile, "spellslinger", 0.5, "Advanced scan recognized random spell-copy access.");
    addRole(profile, "cost_reduction", 0.42, "Advanced scan recognized free spell-copy access.");
  }

  if (/\beach opponent exiles cards from the top of their library until\b[\s\S]{0,140}\btotal mana value\b/.test(text)) {
    addRole(profile, "mill_support", 0.5, "Advanced scan recognized library exile pressure.");
    addRole(profile, "graveyard_hate", 0.24, "Advanced scan recognized exile-based library pressure.");
  }

  if (/\bwhenever (?:enchanted player|a player) casts\b[^.]{0,180}\bthis aura deals? \d+ damage\b/.test(text) || /\bwhenever a player casts a spell of the chosen color\b[^.]{0,120}\bthat player loses \d+ life\b/.test(text)) {
    addRole(profile, "damage_engine", permanent ? 0.48 : 0.34, "Advanced scan recognized spell-punisher damage.");
    addRole(profile, "group_slug", permanent ? 0.46 : 0.34, "Advanced scan recognized spell-punisher damage.");
    addRole(profile, "hate_piece", permanent ? 0.36 : 0.28, "Advanced scan recognized spell-punisher pressure.");
  }

  if (/\bwhenever an opponent casts a spell\b[^.]{0,120}\bthat player loses \d+ life unless they discard a card\b/.test(text)) {
    addRole(profile, "stax_piece", 0.54, "Advanced scan recognized spell-punisher discard tax.");
    addRole(profile, "damage_engine", 0.46, "Advanced scan recognized spell-punisher life pressure.");
    addRole(profile, "group_slug", 0.42, "Advanced scan recognized spell-punisher life pressure.");
    addRole(profile, "hand_attack", 0.34, "Advanced scan recognized discard-tax pressure.");
  }

  if (/\bthis aura deals damage to that player equal to the number of curses attached to them\b/.test(text)) {
    addRole(profile, "damage_engine", 0.58, "Advanced scan recognized Curse damage payoff.");
    addRole(profile, "group_slug", 0.42, "Advanced scan recognized Curse damage payoff.");
  }

  if (/\btarget creature you control becomes\b[^.]{0,120}\bbase power and toughness \d+\/\d+\b/.test(text)) {
    addRole(profile, "combat_support", 0.42, "Advanced scan recognized temporary creature scaling.");
  }

  if (
    /\bchangeling\b/.test(text) ||
    /\bgains? all creature types\b/.test(text) ||
    /\bloses? all creature types\b/.test(text) ||
    /\bcreatures you control are the chosen type\b/.test(text) ||
    /\bchoose a creature type\b[\s\S]{0,160}\btarget creature becomes that type until end of turn\b/.test(text) ||
    /\b(?:enchanted creature|each creature) becomes (?:the creature type of your choice|that type) until end of turn\b/.test(text) ||
    /\bcreature spells you control\b[^.]{0,160}\bchosen type\b/.test(text)
  ) {
    addRole(profile, "kindred_support", permanent ? 0.58 : 0.48, "Advanced scan recognized kindred or creature-type support.");
  }

  if (/\bcreatures you control have all activated abilities of all land cards exiled\b/.test(text)) {
    addRole(profile, "land_synergy", 0.56, "Advanced scan recognized land-ability synergy.");
    addRole(profile, "ramp", 0.42, "Advanced scan recognized land abilities as potential mana access.");
  }
}

export function hasAnyKeyword(keywords: Set<string>, values: string[]) {
  return values.some((value) => keywords.has(normalizeKeyword(value)));
}

export function addKeywordDerivedRoles(
  profile: CardRoleProfile,
  keywords: Set<string>,
  text: string,
  permanent: boolean,
  creature: boolean,
) {
  if (keywords.size === 0) {
    addTextDerivedDrawbackRoles(profile, text);
    return;
  }

  const has = (values: string[]) => hasAnyKeyword(keywords, values);

  if (has([
    "flying",
    "menace",
    "skulk",
    "shadow",
    "fear",
    "intimidate",
    "horsemanship",
    "landwalk",
    "plainswalk",
    "islandwalk",
    "swampwalk",
    "mountainwalk",
    "forestwalk",
    "desertwalk",
    "legendary landwalk",
    "nonbasic landwalk",
  ])) {
    addRole(profile, "evasion", creature ? 0.44 : 0.3, "Advanced scan recognized evasion from keyword data.");
    addRole(profile, "combat_threat", creature ? 0.46 : 0.28, "Advanced scan recognized evasion from keyword data.");
  }

  if (has([
    "first strike",
    "double strike",
    "deathtouch",
    "trample",
    "vigilance",
    "reach",
    "haste",
    "banding",
    "flanking",
    "bushido",
    "rampage",
    "frenzy",
    "provoke",
    "afflict",
    "annihilator",
  ])) {
    addRole(profile, "combat_threat", creature ? 0.44 : 0.3, "Advanced scan recognized combat keyword data.");
  }

  if (has([
    "hexproof",
    "hexproof from",
    "shroud",
    "indestructible",
    "ward",
    "protection",
    "absorb",
    "regenerate",
    "umbra armor",
  ])) {
    addRole(profile, "self_protection", permanent ? 0.4 : 0.3, "Advanced scan recognized protective keyword data.");
    if (!creature) {
      addRole(profile, "protection", 0.24, "Advanced scan recognized protective keyword data.");
    }
  }

  if (has(["infect", "toxic", "poisonous"])) {
    addRole(profile, "finisher", creature ? 0.64 : 0.48, "Advanced scan recognized poison keyword data.");
    addRole(profile, "alternate_finisher", creature ? 0.7 : 0.52, "Advanced scan recognized poison keyword data.");
    addRole(profile, "poison_support", 0.56, "Advanced scan recognized poison keyword data.");
  }

  if (has(["wither"])) {
    addRole(profile, "counter_support", 0.34, "Advanced scan recognized -1/-1 counter keyword data.");
    addRole(profile, "combat_support", 0.3, "Advanced scan recognized -1/-1 counter combat pressure.");
  }

  if (has([
    "backup",
    "battle cry",
    "bloodrush",
    "dash",
    "dethrone",
    "exalted",
    "melee",
    "mentor",
    "mutate",
    "ninjutsu",
    "commander ninjutsu",
    "prowess",
    "riot",
    "saddle",
    "training",
    "web-slinging",
    "enlist",
    "firebending",
    "power-up",
    "teamwork",
    "mobilize",
    "battalion",
    "ferocious",
    "formidable",
    "pack tactics",
    "raid",
    "rally",
    "coven",
    "alliance",
    "celebration",
    "survival",
    "valiant",
    "flurry",
    "heroic",
    "bloodthirst",
    "soulbond",
    "tribute",
    "devour",
  ])) {
    addRole(profile, "combat_support", permanent ? 0.48 : 0.38, "Advanced scan recognized combat-support keyword data.");
  }

  if (has([
    "adapt",
    "amplify",
    "bolster",
    "compleated",
    "evolve",
    "graft",
    "level up",
    "modular",
    "monstrosity",
    "outlast",
    "reinforce",
    "renown",
    "support",
    "sunburst",
    "station",
    "endure",
    "increment",
    "max speed",
    "bloodthirst",
    "unleash",
    "devour",
    "ravenous",
  ])) {
    addRole(profile, "counter_support", 0.52, "Advanced scan recognized counter-based keyword data.");
  }

  if (has(["persist", "undying", "vanishing", "fading", "suspend", "time travel", "impending"])) {
    addRole(profile, "counter_support", 0.36, "Advanced scan recognized time or return counter keyword data.");
  }

  if (has(["lifelink", "extort", "heal"])) {
    addRole(profile, "lifegain", 0.42, "Advanced scan recognized lifegain keyword data.");
  }

  if (has(["extort"])) {
    addRole(profile, "group_slug", 0.34, "Advanced scan recognized drain keyword data.");
    addRole(profile, "life_pressure", 0.34, "Advanced scan recognized drain keyword data.");
  }

  if (has([
    "afterlife",
    "amass",
    "assemble",
    "fabricate",
    "for mirrodin",
    "incubate",
    "living weapon",
    "myriad",
    "offspring",
    "populate",
    "role token",
    "squad",
    "mobilize",
    "decayed",
    "double team",
  ])) {
    addRole(profile, "token_support", permanent ? 0.62 : 0.5, "Advanced scan recognized token keyword data.");
  }

  if (has(["affinity", "improvise", "metalcraft", "craft", "equip", "fortify", "living metal", "reconfigure", "prototype", "station", "crew", "imprint"])) {
    addRole(profile, "artifact_support", 0.48, "Advanced scan recognized artifact-related keyword data.");
  }

  if (has(["bestow", "constellation", "eerie", "enchant", "read ahead", "saga", "harmonize", "aura swap"])) {
    addRole(profile, "enchantress", 0.34, "Advanced scan recognized enchantment-related keyword data.");
  }

  if (has(["changeling"])) {
    addRole(profile, "kindred_support", 0.5, "Advanced scan recognized all-creature-types keyword data.");
  }

  if (has([
    "flashback",
    "jump start",
    "retrace",
    "escape",
    "disturb",
    "unearth",
    "embalm",
    "eternalize",
    "encore",
    "dredge",
    "recover",
    "scavenge",
    "soulshift",
    "aftermath",
    "harmonize",
    "haunt",
  ])) {
    addRole(profile, "graveyard_support", permanent ? 0.56 : 0.48, "Advanced scan recognized graveyard keyword data.");
  }

  if (has(["delirium", "descend", "fathomless descent", "threshold", "undergrowth", "collect evidence", "forage", "morbid", "revolt", "underdog"])) {
    addRole(profile, "graveyard_support", 0.4, "Advanced scan recognized graveyard-count keyword data.");
  }

  if (has(["cascade", "discover", "hideaway", "seek", "scry", "surveil", "explore", "connive", "learn", "clash", "behold", "forecast", "parley", "kinship", "fateful hour", "hellbent", "addendum", "renew", "repartee", "opus", "infusion"])) {
    addRole(profile, "selection", 0.5, "Advanced scan recognized card-selection keyword data.");
  }

  if (has(["fateseal", "investigate"])) {
    addRole(profile, "selection", 0.36, "Advanced scan recognized card-access keyword data.");
  }

  if (has(["cycling", "typecycling", "landcycling", "basic landcycling"]) || [...keywords].some((keyword) => keyword.endsWith("cycling"))) {
    addRole(profile, "selection", 0.5, "Advanced scan recognized cycling keyword data.");
    addRole(profile, "tutor", 0.28, "Advanced scan recognized cycling as restricted card access.");
  }

  if (has(["transmute", "transfigure"])) {
    addRole(profile, "tutor", 0.58, "Advanced scan recognized tutor keyword data.");
    addRole(profile, "restricted_tutor", 0.5, "Advanced scan recognized tutor keyword data.");
  }

  if (has(["plot", "foretell", "suspend", "adventure", "impending", "warp", "phasing", "sneak"])) {
    addRole(profile, "selection", 0.42, "Advanced scan recognized delayed-cast keyword data.");
    addRole(profile, "cost_reduction", 0.34, "Advanced scan recognized delayed-cast keyword data.");
  }

  if (has([
    "affinity",
    "assist",
    "bargain",
    "bestow",
    "blitz",
    "buyback",
    "casualty",
    "cleave",
    "convoke",
    "dash",
    "delve",
    "emerge",
    "evoke",
    "freerunning",
    "improvise",
    "kicker",
    "madness",
    "miracle",
    "more than meets the eye",
    "offering",
    "overload",
    "prowl",
    "prototype",
    "spectacle",
    "surge",
    "undaunted",
    "web-slinging",
    "multikicker",
    "entwine",
    "escalate",
    "fuse",
    "spree",
    "exhaust",
    "kicker",
    "intensity",
    "strive",
    "covercast",
  ])) {
    addRole(profile, "cost_reduction", 0.34, "Advanced scan recognized alternate-cost keyword data.");
  }

  if (has(["storm", "gravestorm", "replicate", "conspire", "demonstrate", "double", "triple", "ripple", "cipher", "display of power"])) {
    addRole(profile, "copy_support", 0.46, "Advanced scan recognized copy keyword data.");
    addRole(profile, "spellslinger", 0.36, "Advanced scan recognized copy keyword data.");
  }

  if (has(["prowess", "magecraft", "splice", "rebound", "jump start", "flashback", "storm", "gravestorm", "replicate", "cipher", "harmonize", "spell mastery"])) {
    addRole(profile, "spellslinger", 0.42, "Advanced scan recognized spell-matter keyword data.");
  }

  if (has(["split second", "counter", "detain", "abandon"])) {
    addRole(profile, "stack", 0.34, "Advanced scan recognized stack or lock keyword data.");
  }

  if (has(["flash"])) {
    addRole(profile, "flash_support", 0.28, "Advanced scan recognized flash keyword data.");
    addRole(profile, "stack", 0.22, "Advanced scan recognized instant-speed keyword data.");
  }

  if (has(["mill", "ingest", "manifest dread"])) {
    addRole(profile, "mill_support", 0.44, "Advanced scan recognized mill keyword data.");
  }

  if (has(["venture into the dungeon", "take the initiative"])) {
    addRole(profile, "dungeon_support", 0.58, "Advanced scan recognized dungeon keyword data.");
    addRole(profile, "repeatable_advantage", 0.34, "Advanced scan recognized dungeon keyword data.");
  }

  if (has(["goad", "suspect", "monarch", "tempting offer", "will of the council", "council's dilemma", "vote", "join forces", "secret council", "will of the planeswalkers"])) {
    addRole(profile, "politics", 0.3, "Advanced scan recognized political keyword data.");
  }

  if (has(["landfall", "domain", "landship", "awaken", "chroma", "converge", "adamant", "vivid", "sweep"])) {
    addRole(profile, "lands_matter", 0.4, "Advanced scan recognized land-matters keyword data.");
  }

  if (has(["food", "treasure", "blood", "clue", "investigate"])) {
    addRole(profile, "artifact_support", 0.34, "Advanced scan recognized artifact-token keyword data.");
  }

  if (has(["create", "role token"])) {
    addRole(profile, "token_support", 0.34, "Advanced scan recognized create keyword action.");
  }

  if (has(["destroy", "fight"])) {
    addRole(profile, "removal", 0.44, "Advanced scan recognized removal keyword action.");
    addRole(profile, "targeted_removal", 0.38, "Advanced scan recognized removal keyword action.");
  }

  if (has(["exile"])) {
    addRole(profile, "removal", 0.3, "Advanced scan recognized exile keyword action.");
    addRole(profile, "graveyard_hate", 0.24, "Advanced scan recognized exile keyword action.");
  }

  if (has(["discard"])) {
    addRole(profile, "hand_attack", 0.36, "Advanced scan recognized discard keyword action.");
  }

  if (has(["exchange", "heist"])) {
    addRole(profile, "theft_support", 0.34, "Advanced scan recognized exchange or heist keyword data.");
  }

  if (has(["channel", "boast", "activate"])) {
    addRole(profile, "activated_utility", 0.3, "Advanced scan recognized activated-utility keyword data.");
  }

  if (has(["sacrifice", "exploit", "casualty"])) {
    addRole(profile, "sacrifice_support", 0.4, "Advanced scan recognized sacrifice keyword data.");
  }

  if (has(["tap", "untap", "inspired", "exert", "waterbend", "airbend", "earthbend"])) {
    addRole(profile, "tap_untap", 0.36, "Advanced scan recognized tap/untap keyword data.");
  }

  if (has(["transform", "meld", "convert", "daybound", "nightbound"])) {
    addRole(profile, "transform_support", 0.34, "Advanced scan recognized transformation keyword data.");
    addRole(profile, "type_change", 0.24, "Advanced scan recognized transformation keyword data.");
  }

  if (has(["regenerate"])) {
    addRole(profile, "protection", 0.36, "Advanced scan recognized regeneration keyword data.");
    addRole(profile, "regeneration_protection", 0.42, "Advanced scan recognized regeneration keyword data.");
  }

  if (has(["start your engines", "max speed", "solved"])) {
    addRole(profile, "progression_support", 0.3, "Advanced scan recognized progress-tracking keyword data.");
  }

  if (has(["ascend"])) {
    addRole(profile, "progression_support", 0.28, "Advanced scan recognized city-blessing keyword data.");
  }

  if (has(["corrupted"])) {
    addRole(profile, "poison_support", 0.34, "Advanced scan recognized poison-threshold keyword data.");
  }

  if (has(["enrage"])) {
    addRole(profile, "damage_engine", 0.34, "Advanced scan recognized damage-trigger keyword data.");
  }

  if (has(["conjure"])) {
    addRole(profile, "token_support", 0.26, "Advanced scan recognized conjure keyword data.");
  }

  addKeywordDrawbackRoles(profile, keywords);
  addTextDerivedDrawbackRoles(profile, text);
}

export function addKeywordDrawbackRoles(profile: CardRoleProfile, keywords: Set<string>) {
  const has = (values: string[]) => hasAnyKeyword(keywords, values);

  if (has(["suspend", "plot", "foretell", "impending", "warp", "adventure", "sneak"])) {
    addRole(profile, "timing_delay", 0.28, "Advanced scan recognized delayed-access keyword data.");
  }

  if (has(["miracle", "madness", "spectacle", "prowl", "surge", "freerunning", "addendum", "raid", "revolt", "morbid", "fateful hour", "hellbent", "corrupted"])) {
    addRole(profile, "condition_restriction", 0.24, "Advanced scan recognized conditional keyword data.");
  }

  if (has([
    "bargain",
    "casualty",
    "convoke",
    "delve",
    "improvise",
    "collect evidence",
    "forage",
    "exploit",
    "emerge",
    "offering",
    "assist",
    "craft",
    "station",
    "saddle",
    "enlist",
    "exert",
    "strive",
    "kicker",
    "multikicker",
    "buyback",
    "entwine",
    "escalate",
    "spree",
    "cleave",
    "overload",
    "bestow",
    "mutate",
    "web-slinging",
  ])) {
    addRole(profile, "resource_payment", 0.26, "Advanced scan recognized keyword data that asks for extra mana or board resources.");
  }

  if (has(["dash", "blitz", "evoke", "unearth", "encore", "sneak", "warp"])) {
    addRole(profile, "temporary_body", 0.26, "Advanced scan recognized temporary-board-access keyword data.");
  }

  if (has(["impending", "prototype"])) {
    addRole(profile, "scaled_down_mode", 0.22, "Advanced scan recognized a reduced or delayed body mode.");
  }

  if (has(["fading", "vanishing", "read ahead", "saga"])) {
    addRole(profile, "time_limited", 0.24, "Advanced scan recognized time-limited keyword data.");
  }

  if (has(["cumulative upkeep", "echo"])) {
    addRole(profile, "upkeep_cost", 0.28, "Advanced scan recognized recurring or delayed upkeep-cost keyword data.");
    addRole(profile, "resource_payment", 0.22, "Advanced scan recognized upkeep-cost keyword data.");
  }

  if (has(["defender", "decayed", "goad", "suspect", "unleash"])) {
    addRole(profile, "combat_liability", 0.2, "Advanced scan recognized a combat restriction or liability keyword.");
  }

  if (has(["companion", "choose a background", "partner", "partner with", "friends forever", "doctor's companion", "hidden agenda", "double agenda", "specialize"])) {
    addRole(profile, "deckbuilding_restriction", 0.2, "Advanced scan recognized commander or deck-construction keyword data.");
  }
}

export function addTextDerivedDrawbackRoles(profile: CardRoleProfile, text: string) {
  if (/\bactivate only as a sorcery\b|\bcast this spell only\b|\bcast only\b|\bonly during your turn\b|\bonly during combat\b|\bonly before attackers are declared\b/.test(text)) {
    addRole(profile, "timing_restriction", 0.24, "Advanced scan recognized timing-restricted rules text.");
  }

  if (/\benters? (?:the battlefield )?tapped\b|\bdoesn'?t untap during (?:your|its controller'?s|their) next untap step\b/.test(text)) {
    addRole(profile, "tempo_liability", 0.22, "Advanced scan recognized tempo-cost rules text.");
  }

  if (/\bas an additional cost\b[^.]{0,160}\b(?:discard|sacrifice|exile|pay \d+ life|lose \d+ life|tap)\b/.test(text)) {
    addRole(profile, "resource_payment", 0.28, "Advanced scan recognized an additional resource cost.");
  }

  if (/\bat the beginning of (?:the next|your next|each|your) (?:end step|upkeep)\b[^.]{0,180}\b(?:sacrifice|exile|return it to its owner'?s hand)\b/.test(text)) {
    addRole(profile, "temporary_body", 0.26, "Advanced scan recognized temporary-access rules text.");
  }

  if (/\bcan'?t block\b|\bcan'?t attack\b|\battacks each combat if able\b|\bblocks each combat if able\b|\bmust be blocked if able\b/.test(text)) {
    addRole(profile, "combat_liability", 0.22, "Advanced scan recognized combat-restriction rules text.");
  }

  if (/\bcumulative upkeep\b|\becho\b/.test(text)) {
    addRole(profile, "upkeep_cost", 0.28, "Advanced scan recognized upkeep-cost rules text.");
  }

  if (/\bremove (?:a|one) time counter\b|\bwhen the last (?:time|omen) counter is removed\b|\bif (?:it|this permanent) has no (?:time|fade) counters\b/.test(text)) {
    addRole(profile, "timing_delay", 0.22, "Advanced scan recognized counter-based delay rules text.");
  }
}
