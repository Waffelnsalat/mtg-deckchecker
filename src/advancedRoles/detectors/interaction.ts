import { CardRoleProfile, addRole } from "../profile";

export function detectAdvancedRemovalRoles(profile: CardRoleProfile, text: string) {
  const exchangeControl =
    /\bexchange control of\b[^.]{0,220}\b(?:target|two|all|creature|artifact|enchantment|permanent|permanents|spell)\b/.test(text);
  const targetedLandRemoval =
    /\bdestroy target (?:nonbasic |basic |non[- ]?(?:plains|island|swamp|mountain|forest) )?(?:land|plains|island|swamp|mountain|forest)\b/.test(text) ||
    /\bexile target land\b/.test(text) ||
    /\bexile target nonbasic land\b[\s\S]{0,180}\bsame name as that land and exile them\b/.test(text) ||
    /\bdestroy (?:one|two|three|four|five|six|\d+) target lands?\b/.test(text) ||
    /\bput target land on top of its owner'?s library\b/.test(text) ||
    /\benchanted land\b[^.]{0,160}\bdestroy it\b/.test(text) ||
    /\benchanted land'?s controller\b[^.]{0,160}\bdestroy that land unless that player pays\b/.test(text);
  const targetedWallRemoval = /\bdestroy target wall\b/.test(text);
  const targetedKindredRemoval = /\bdestroy target (?:djinn|efreet)\b/.test(text);
  const targetedCreatureTypeRemoval = /\bdestroy target (?:spirit|equipment)\b/.test(text);
  const targetedAuraRemoval = /\bdestroy target aura attached to\b/.test(text);
  const shrinkingAura = /\benchanted creature\b[^.]{0,120}\bgets? -(?:x|\d+)\/-(?:y|\d+)\b/.test(text);
  const powerResetRemoval =
    /\btarget (?:(?:attacking )?creature(?: other than this creature)?|creature with flying)\b[^.]{0,120}\bhas base power (?:and toughness )?(?:0|1)(?:\/\d+)?\b/.test(text) ||
    /\btarget creature loses all abilities and becomes\b[^.]{0,80}\bwith base power and toughness \d+\/\d+\b/.test(text) ||
    /\beach creature target player controls loses all abilities and becomes\b[^.]{0,80}\bwith base power and toughness \d+\/\d+\b/.test(text);
  const combatTriggeredRemoval =
    /\bwhenever this creature blocks or becomes blocked\b[^.]{0,180}\bdestroy that creature\b/.test(text) ||
    /\bwhenever a creature you control deals damage to a creature\b[^.]{0,120}\bdestroy the other creature\b/.test(text) ||
    /\bwhenever a creature deals damage to you\b[^.]{0,80}\bdestroy it\b/.test(text) ||
    /\bwhen enchanted creature is dealt damage\b[^.]{0,80}\bdestroy it\b/.test(text) ||
    /\bwhenever enchanted creature blocks or becomes blocked\b[^.]{0,180}\bdestroy the other creature\b/.test(text);
  const phaseOutRemoval = /\btarget creature phases out until\b[^.]{0,120}\bleaves the battlefield\b/.test(text);
  const lockdownAura =
    /\benchanted (?:artifact|creature|permanent) doesn'?t untap during its controller'?s untap step\b/.test(text) ||
    /\bwhen this aura enters\b[^.]{0,120}\btap enchanted (?:artifact|creature|permanent)\b/.test(text) ||
    /\bat the beginning of each upkeep\b[^.]{0,120}\bif enchanted creature is untapped\b[^.]{0,80}\btap it\b/.test(text) ||
    /\bas long as enchanted permanent is a creature\b[^.]{0,120}\b(?:gets? -\d+\/-\d+|can'?t block|loses flying)\b/.test(text);
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
    /\b(?:destroy|exile)\b[^.]{0,80}\b(?:the chosen|that creature|those|them|it)\b/.test(text);
  const leastPowerRemoval = /\bdestroy the creature with the least power\b/.test(text);
  const auraNeutralization =
    /\benchant (?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b/.test(text) &&
    (
      /\benchanted (?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b[^.]{0,180}\bloses all abilities\b/.test(text) ||
      /\benchanted (?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b[^.]{0,180}\bhas base power and toughness \d+\/\d+\b/.test(text) ||
      /\benchanted (?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b[^.]{0,180}\bhas defender\b/.test(text) ||
      /\benchanted (?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b[^.]{0,180}\bis (?:a|an)\b[^.]{0,120}\b(?:land|forest|treasure|insect|frog|elk|coward)\b/.test(text) ||
      /\benchanted (?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b[^.]{0,180}\bcan't attack or block\b/.test(text)
    );
  const edictRemoval =
    /\b(?:target (?:player|opponent)|each opponent|each player|each other player|for each opponent)\b[^.]{0,180}\bsacrifices?\b[^.]{0,120}\b(?:creatures?|artifacts?|enchantments?|planeswalkers?|battles?|permanents?|tokens?)\b/.test(
      text,
    ) &&
    !/\byou sacrifice\b/.test(text);
  const delayedAuraEdict =
    /\bwhen enchanted creature leaves the battlefield\b[^.]{0,140}\bits controller sacrifices a creature\b/.test(text) ||
    /\bat the beginning of the upkeep of enchanted creature'?s controller\b[^.]{0,160}\bthat player sacrifices that creature unless they pay\b/.test(text) ||
    /\bat the beginning of the end step of enchanted creature'?s controller\b[^.]{0,120}\bthat player sacrifices that creature\b/.test(text) ||
    /\bat the beginning of enchanted player'?s upkeep\b[^.]{0,160}\bthat player sacrifices a creature or planeswalker\b/.test(text);
  const targetedRemoval =
    /\b(?:destroy|exile)\b[^.]{0,120}\btarget\b[^.]{0,140}\b(?:creature|artifact|enchantment|planeswalker|battle|permanent|nonland permanent)\b/.test(text) ||
    /\b(?:destroy|exile)\b[^.]{0,40}(?:one|two|three|four|five|six|\d+)\s+target\b[^.]{0,140}\b(?:creatures?|artifacts?|enchantments?|planeswalkers?|battles?|permanents?|nonland permanents?)\b/.test(text) ||
    /\btarget creature and all other creatures with the same name as that creature get -\d+\/-\d+ until end of turn\b/.test(text) ||
    /\btarget creature gets? -(?:x|\d+)\/-(?:x|\d+) until end of turn\b/.test(text) ||
    /\btarget creature of their choice get -\d+\/-\d+ until end of turn\b/.test(text) ||
    /\ball creatures of that type get -\d+\/-\d+ until end of turn\b/.test(text) ||
    /\bwhen enchanted permanent becomes tapped\b[^.]{0,80}\bdestroy it\b/.test(text) ||
    /\btarget opponent exiles (?:a|target) (?:creature|planeswalker) they control\b/.test(text) ||
    /\btarget opponent exiles a creature or planeswalker they control\b/.test(text) ||
    /\bchoose two target creatures controlled by the same player\b[\s\S]{0,180}\bsacrifices one of them\b[\s\S]{0,120}\breturn the other to its owner'?s hand\b/.test(text) ||
    /\bchoose two target creatures controlled by the same player\b[\s\S]{0,120}\bthat player sacrifices one of them\b/.test(text) ||
    /\bbury target\b[^.]{0,140}\b(?:creature|artifact|enchantment|planeswalker|battle|permanent|nonland permanent)\b/.test(text) ||
    /\btap target creature\b[\s\S]{0,140}\bexile that creature\b/.test(text) ||
    /\bexile target creature\b[^.]{0,60}\bblocking a creature you control\b/.test(text) ||
    /\bturn target creature face down\b/.test(text) ||
    /\btarget permanent\b[^.]{0,120}\bshuffles? (?:it|itself) into (?:their|its) owner's library\b/.test(text) ||
    /\bthe owner of target permanent\b[^.]{0,120}\bshuffles? it into (?:their|its) library\b/.test(text) ||
    /\btarget (?:creature|artifact|nonland permanent)'?s owner puts it on their choice of the top or bottom of their library\b/.test(text) ||
    /\bchoose target artifact or enchantment\b[\s\S]{0,140}\bits owner shuffles it into their library\b/.test(text) ||
    edictRemoval ||
    delayedAuraEdict ||
    auraNeutralization ||
    targetedLandRemoval ||
    targetedWallRemoval ||
    targetedKindredRemoval ||
    targetedCreatureTypeRemoval ||
    targetedAuraRemoval ||
    shrinkingAura ||
    powerResetRemoval ||
    /\bwhenever a creature enters\b[^.]{0,120}\bexile that creature\b/.test(text) ||
    combatTriggeredRemoval ||
    /\bwhenever this creature deals damage to a creature\b[^.]{0,120}\bdestroy that creature\b/.test(text) ||
    /\bwhenever enchanted creature deals damage\b[^.]{0,120}\bthis aura deals that much damage to that creature\b/.test(text) ||
    /\bwhen this aura enters\b[^.]{0,120}\bit deals? \d+ damage to enchanted creature\b/.test(text) ||
    phaseOutRemoval ||
    leastPowerRemoval ||
    /\btarget creature deals damage to itself equal to its power\b/.test(text) ||
    /\btarget creature you control fights target creature you don'?t control\b/.test(text) ||
    /\btarget creature you control fights another target creature\b/.test(text) ||
    /\btarget blocking creature fights another target blocking creature\b/.test(text) ||
    /\btarget creature you control fights target creature the opponent\b/.test(text) ||
    /\btarget creature fights another target creature\b/.test(text) ||
    /\bchoose two target creatures\b[\s\S]{0,180}\bthose creatures fight each other\b/.test(text) ||
    /\bchoose target creature you control and target creature an opponent controls\b[\s\S]{0,160}\beach of those creatures deals damage\b/.test(text) ||
    /\btarget creature with\b[^.]{0,120}\bloses it and another target creature gains it\b/.test(text) ||
    /\bput a -\d+\/-\d+ counter on target creature\b/.test(text) ||
    /\btwo target creatures each get -\d+\/-\d+ until end of turn\b/.test(text) ||
    /\bwhenever a creature (?:becomes blocked by|blocks) a creature with lesser power\b[^.]{0,160}\bdestroy the\b/.test(text) ||
    /\bwhenever enchanted creature deals damage to a creature\b[^.]{0,120}\bdestroy the other creature\b/.test(text) ||
    /\bdestroy each permanent that a piece touches\b/.test(text) ||
    /\bdestroy each permanent chosen this way\b/.test(text) ||
    /\bdestroy each creature chosen this way\b/.test(text);
  const targetedDamageRemoval =
    /\bdeals? (?:x|\d+|that much) damage to any (?:other )?target\b/.test(text) ||
    /\bdeals? damage to any target equal to (?:three times )?the number of (?:creatures|artifacts|lands|permanents) (?:you control|tapped this way)\b/.test(text) ||
    /\bdeals? an amount of damage chosen at random from 0 to x to any target\b/.test(text) ||
    /\bdeals? damage to any target equal to the greatest mana value among permanents you control\b/.test(text) ||
    /\bdeals? damage to any target equal to the mana value of the discarded card\b/.test(text) ||
    /\bdeals? (?:x|\d+|that much) damage to target\b[^.]{0,140}\b(?:creature|artifact|enchantment|planeswalker|battle|permanent)\b/.test(text) ||
    /\bdeals? damage to that creature equal to\b/.test(text) ||
    /\bdeals? that much damage to that permanent\b/.test(text) ||
    /\bdeals? \d+ damage to each of two target creatures\b/.test(text) ||
    /\bdeals? \d+ damage divided as you choose among one, two, or three targets\b/.test(text) ||
    /\bdeals? \d+ damage to the creature with the least toughness\b/.test(text) ||
    /\bwhenever a creature enters\b[^.]{0,120}\bdeals? \d+ damage to it\b/.test(text) ||
    /\bdeals? (?:x|\d+|that much) damage to each of up to\b/.test(text) ||
    /\bdeals? damage equal to\b[^.]{0,120}\bto each of up to\b/.test(text) ||
    /\btarget creature you control deals damage equal to its power to each of two other target creatures\b/.test(text) ||
    /\bdeals? x damage to each of x targets?\b/.test(text) ||
    /\bdeals? \d+ damage divided as you choose among one, two, or three target creatures\b/.test(text) ||
    /\bdeals? \d+ damage divided as you choose among (?:one, two, or three|one or two) target/.test(text) ||
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
    /\bput all enchantments on top of their owners'? libraries\b/.test(text) ||
    /\bdestroy all (?:goblins|walls|elves|zombies|skeletons|soldiers|knights|dragons|beasts|merfolk|wizards|clerics|shamans|goblins)\b/.test(text) ||
    /\bexile each permanent\b/.test(text) ||
    /\bdestroy each nonland permanent\b[^.]{0,120}\bmana value (?:x|\d+) or less\b/.test(text) ||
    /\bdestroy each nonland artifact\b[^.]{0,120}\bmana value (?:x|\d+) or less\b/.test(text) ||
    /\b(?:destroy|exile) each (?:creature|nonland permanent)\b[^.]{0,120}\bmana value (?:x|\d+) or less\b/.test(text) ||
    /\bexile each creature with mana value of the chosen quality\b/.test(text) ||
    /\bcreatures that aren'?t of the chosen type get -\d+\/-\d+ until end of turn\b/.test(text) ||
    /\bat end of combat\b[^.]{0,120}\bdestroy each creature that blocked or was blocked this turn\b/.test(text) ||
    /\bdestroy each creature with mana value equal to the number of\b[^.]{0,120}\bcounters? on\b/.test(text) ||
    /\beach nontoken permanent\b[^.]{0,120}\bis sacrificed by its controller\b/.test(text) ||
    /\bfor each creature\b[^.]{0,120}\bits controller sacrifices a permanent\b[^.]{0,120}\bunless they pay\b/.test(text) ||
    /\bwhenever a creature enters\b[^.]{0,120}\bits controller sacrifices a creature or land\b/.test(text) ||
    /\bwhenever a player casts a creature spell\b[^.]{0,160}\bthat player sacrifices a permanent\b[^.]{0,120}\bunless they pay\b/.test(text) ||
    /\bfor each attacking creature\b[^.]{0,160}\bputs? it on (?:their|its) choice of the top or bottom of (?:their|its) library\b/.test(text) ||
    /\bput all creatures on the bottom of their owners'? libraries\b/.test(text) ||
    /\beach creature deals damage to itself equal to its power\b/.test(text) ||
    /\ball creatures get (?:[+-]\d+)\/(?:[+-]\d+) until end of turn\b/.test(text) ||
    /\ball creatures get -(?:x|\d+)\/-(?:x|\d+)\b/.test(text) ||
    /\ball creatures of the chosen type get -\d+\/-\d+\b/.test(text) ||
    /\ball creatures of that type get -\d+\/-\d+ until end of turn\b/.test(text) ||
    /\bcreatures target player controls get -\d+\/-\d+ until end of turn\b/.test(text) ||
    /\bcreatures enchanted player controls get -\d+\/-\d+\b/.test(text) ||
    /\bcreatures enchanted player controls lose all abilities and have base power and toughness \d+\/\d+\b/.test(text) ||
    /\bnon-?[a-z]+ creatures get -\d+\/-\d+ until end of turn\b/.test(text) ||
    /\bcreature tokens get -\d+\/-\d+\b/.test(text) ||
    /\bcreatures of the creature type of your choice get -\d+\/-\d+ until end of turn\b/.test(text) ||
    /\bnonartifact creatures get -\d+\/-\d+\b/.test(text) ||
    /\bnonwhite creatures get -\d+\/-\d+\b/.test(text) ||
    /\bcreatures your opponents control get -(?:x|\d+)\/-(?:x|\d+)\b/.test(text) ||
    /\bcreatures your opponents control have base power and toughness 0\/1\b/.test(text) ||
    /\ball creatures lose all abilities and have base power and toughness \d+\/\d+\b/.test(text) ||
    /\bcreatures enchanted player controls lose all abilities and have base power and toughness \d+\/\d+\b/.test(text) ||
    /\bwhenever a creature is dealt damage\b[^.]{0,120}\bdestroy it\b/.test(text) ||
    /\bwhite creatures get -\d+\/-\d+\b/.test(text) ||
    /\bother black creatures get -\d+\/-\d+\b/.test(text) ||
    /\bdestroy all auras\b/.test(text) ||
    /\bdestroy all (?:djinns and efreets|efreets and djinns)\b/.test(text) ||
    /\bdeals? \d+ damage to each non(?:white|blue|black|red|green) creature\b/.test(text) ||
    /\bdeals? \d+ damage to each (?:white|blue|black|red|green)(?: and\/or (?:white|blue|black|red|green))? creature\b/.test(text) ||
    /\b(?:deals? (?:x|\d+) damage|deals? damage equal to [^.]{0,80}) to each (?:attacking )?creature\b/.test(text) ||
    /\bdeals? \d+ damage to each blocking creature and each blocked creature\b/.test(text) ||
    /\bdeals? \d+ damage to each of two targets\b/.test(text) ||
    /\bdeals? damage to (?:that player and )?each creature\b[^.]{0,120}\bequal to the number of creatures\b/.test(text) ||
    /\bdeals? \d+ damage to each nonartifact creature\b/.test(text) ||
    /\bdeals? damage to each creature with flying equal to\b/.test(text) ||
    /\bchoose up to one creature\b[\s\S]{0,100}\bdestroy the rest\b/.test(text) ||
    /\bchoose a creature at random\b[\s\S]{0,100}\bdestroy the rest\b/.test(text) ||
    /\bexile each creature with power (?:greater|less) than the number of cards in your hand\b/.test(text) ||
    /\bexile each creature(?: and planeswalker)? with mana value less than\b/.test(text) ||
    /\bdestroy each creature that isn'?t all colors\b/.test(text) ||
    /\bdeals? \d+ damage to each non-?[a-z]+ creature\b/.test(text) ||
    /\bfor each creature\b[^.]{0,120}\bchoose a number from \d+ to \d+ at random\b[\s\S]{0,120}\bdeals that much damage to that creature\b/.test(text) ||
    massLandDenial;
  const tempoRemoval =
    /\beach player returns a creature they control to its owner'?s hand\b/.test(text) ||
    /\beach player returns a permanent they control to its owner'?s hand unless they pay \d+ life\b/.test(text) ||
    /\bat the beginning of each player'?s upkeep\b[^.]{0,160}\bthat player returns a permanent they control to its owner'?s hand unless they pay \d+ life\b/.test(text) ||
    /\bat the beginning of each player'?s upkeep\b[^.]{0,140}\bthat player returns a creature they control to its owner'?s hand\b/.test(text) ||
    /\breturn to its owner'?s hand each creature\b[^.]{0,180}\bwith power greater than\b/.test(text) ||
    /\breturn to their owners'? hands all creatures with toughness less than or equal to\b/.test(text) ||
    /\bif they don'?t\b[^.]{0,140}\bthey return a permanent they control to its owner'?s hand\b/.test(text) ||
    /\breturn\b[^.]{0,40}\btarget\b[^.]{0,140}\b(?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent)\b[^.]{0,140}\bto (?:(?:its|their) owner's|their owners') hands?\b/.test(text) ||
    /\bfor each (?:spirit|creature)\b[^.]{0,120}\breturn it to its owner'?s hand unless that player pays\b/.test(text) ||
    /\breturn target creature you control and target creature you don'?t control to their owners'? hands\b/.test(text) ||
    /\breturn enchanted creature and this aura to their owners'? hands\b/.test(text) ||
    /\breturn enchanted creature and all auras attached to that creature to their owners'? hands\b/.test(text) ||
    /\breturn any number of target enchantments to their owners'? hands\b/.test(text) ||
    /\bchoose two target creatures controlled by different players\b[\s\S]{0,120}\breturn those creatures to their owners'? hands\b/.test(text) ||
    /\breturn half the creatures they control to their owner'?s hand\b/.test(text) ||
    /\breturn each nonland permanent\b[^.]{0,120}\bto its owner'?s hand\b/.test(text) ||
    /\bwhenever a permanent deals damage to you\b[^.]{0,120}\breturn it to its owner'?s hand\b/.test(text) ||
    /\benchanted permanent is a vehicle artifact\b[\s\S]{0,140}\bit loses all other card types\b/.test(text) ||
    /\bwhenever a creature becomes the target of a spell or ability\b[^.]{0,120}\breturn that creature to its owner'?s hand\b/.test(text) ||
    /\breturn\b[^.]{0,80}\b(?:one|two|three|four|five|six|\d+|up to \d+|up to [a-z]+)\s+target\b[^.]{0,140}\b(?:creatures?|artifacts?|enchantments?|planeswalkers?|permanents?|nonland permanents?)\b[^.]{0,120}\bto (?:their|its) owners'? hands?\b/.test(text) ||
    /\breturn x target nonland permanents to their owners'? hands\b/.test(text) ||
    /\bput two target lands on top of their owners'? libraries\b/.test(text) ||
    (/\b(?:put|puts)\b[^.]{0,40}\btarget\b[^.]{0,140}\b(?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent|land)\b[^.]{0,120}\blibrary\b/.test(text) &&
      !/\bgraveyard\b/.test(text)) ||
    /\btap one or two target creatures\b/.test(text) ||
    /\btap all (?:spirits|non-spirit creatures)\b/.test(text) ||
    /\btap (?:up to )?(?:(?:one|two|three|four|five|six|\d+)\s+)?target\b[^.]{0,120}\b(?:creatures?|artifacts?|enchantments?|planeswalkers?|permanents?|nonland permanents?|lands?)\b/.test(text) ||
    phaseOutRemoval ||
    /\btarget spell, nonland permanent, or card in a graveyard\b[^.]{0,160}\btop or bottom of (?:their|its) library\b/.test(text) ||
    /\bchoose target spell or permanent\b[\s\S]{0,180}\bits owner puts it on their choice of the top or bottom of their library\b/.test(text) ||
    /\bowner of target spell or nonland permanent puts it on their choice of the top or bottom of their library\b/.test(text) ||
    /\bowner of target nonland permanent puts it into their library second from the top or on the bottom\b/.test(text);
  const massTapLock =
    /\bcreatures and lands target opponent controls don'?t untap during their next untap step\b/.test(text);
  const temporaryTheft =
    exchangeControl ||
    /\bfor each nonland permanent\b[\s\S]{0,220}\beach player gains control of each permanent\b/.test(text) ||
    /\bexchanges? control of\b[^.]{0,260}\brandom target\b[^.]{0,160}\b(?:artifact|creature|land|permanent)\b/.test(text) ||
    /\bgains? control of\b[^.]{0,120}\b(?:target|up to three target|enchanted)\b[^.]{0,120}\b(?:creatures?|artifact|enchantment|planeswalker|permanent)\b[^.]{0,160}\buntil end of turn\b/.test(
      text,
    ) ||
    /\bgain control of that artifact until\b/.test(
      text,
    );
  const permanentTheft =
    (
      /\bgain control of\b[^.]{0,120}\b(?:target|enchanted)\b[^.]{0,120}\b(?:creature|artifact|enchantment|planeswalker|permanent|nonland permanent|land)\b/.test(text) ||
      /\bspell or ability'?s controller gains control of that creature\b/.test(text) ||
      /\bgains control of the creature\b/.test(text) ||
      /\bthose players exchange control of those creatures\b/.test(text) ||
      /\byou control enchanted (?:creature|artifact|permanent|land)\b/.test(text)
    ) &&
    !/\buntil end of turn\b/.test(text);
  const handAttack =
    /\btarget (?:player|opponent)\b[^.]{0,140}\bdiscards?\b/.test(text) ||
    /\bany number of target players each discard a number of cards equal to\b/.test(text) ||
    /\btarget player reveals a card at random from their hand\b[\s\S]{0,220}\bdiscards? it unless\b/.test(text) ||
    /\beach player may discard\b[\s\S]{0,160}\bdeals damage to each player\b/.test(text) ||
    /\bat the beginning of each player'?s upkeep\b[^.]{0,120}\bthat player discards a card at random\b/.test(text) ||
    /\bat the beginning of each player'?s upkeep\b[^.]{0,120}\bthat player discards a card\b/.test(text) ||
    /\bwhenever a player casts a spell\b[^.]{0,120}\bthat player discards a card\b/.test(text) ||
    /\beach player reveals their hand\b[\s\S]{0,180}\bdiscards all other nonland cards\b/.test(text) ||
    /\bwhenever a permanent is returned to a player'?s hand\b[^.]{0,120}\bthat player discards a card\b/.test(text) ||
    /\bdiscard a card:\s*target player puts a card from their hand on top of their library\b/.test(text) ||
    /\beach opponent discards?\b/.test(text) ||
    /\bwhenever a player casts a (?:green|white|blue|black|red)(?: or (?:green|white|blue|black|red))? spell\b[^.]{0,120}\bthat player discards a card\b/.test(text) ||
    /\bexile\b[^.]{0,140}\bfrom (?:target|that) (?:player|opponent)'s hand\b/.test(text) ||
    /\btarget opponent reveals their hand\b[\s\S]{0,140}\byou choose a nonland card from it and exile that card\b/.test(text) ||
    /\blook at that player'?s hand\b[\s\S]{0,180}\bchoose a card(?: other than a basic land card)? from it\b[\s\S]{0,140}\b(?:discards? that card|player discards that card|they discard that card)\b/.test(text) ||
    /\btarget opponent reveals their hand\b[\s\S]{0,160}\byou choose a card from it with mana value\b[\s\S]{0,120}\bexile that card\b/.test(text) ||
    /\btarget opponent exiles (?:two|three|\d+) cards from their hand\b/.test(text) ||
    /\btarget opponent loses \d+ life and puts a card from their hand on top of their library\b/.test(text) ||
    /\btarget player reveals (?:three|two|\d+) cards from their hand\b[\s\S]{0,120}\byou choose one of them\b[\s\S]{0,80}\bthat player discards that card\b/.test(text) ||
    /\btarget player chooses\b[^.]{0,80}\bcards? from their hand\b[^.]{0,120}\bputs? them on top of their library\b/.test(text) ||
    /\btarget opponent reveals their hand\b[\s\S]{0,220}\brepeat this process until all cards in that hand have been exiled\b/.test(text) ||
    /\btarget player reveals a number of cards from their hand\b[\s\S]{0,160}\byou choose one of them\b[\s\S]{0,80}\bthat player discards that card\b/.test(text) ||
    /\btarget opponent reveals their hand\b[\s\S]{0,120}\byou may choose a nonland card from it\b[\s\S]{0,120}\bthat player discards that card\b/.test(text) ||
    /\btarget opponent reveals their hand\b[\s\S]{0,120}\byou choose a card from it\b[\s\S]{0,80}\bthat player shuffles that card into their library\b/.test(text) ||
    /\btarget opponent reveals their hand\b[\s\S]{0,160}\byou choose a nonland card from that player'?s graveyard or hand and exile it\b/.test(text) ||
    /\btarget opponent reveals their hand\b[\s\S]{0,120}\byou may choose a nonland card from it\b[\s\S]{0,120}\bthat player exiles that card\b/.test(text) ||
    /\btarget opponent reveals their hand\b[\s\S]{0,120}\byou choose a nonland card from it or a card from their graveyard\b[\s\S]{0,80}\bexile that card\b/.test(text) ||
    /\btarget opponent reveals their hand\b[\s\S]{0,120}\byou choose a nonland card from it\b[\s\S]{0,80}\bexile that card\b/.test(text);

  if (/\bexile up to (?:three|two|one|\d+) target cards? from (?:a single |target )?graveyard\b/.test(text)) {
    addRole(profile, "graveyard_hate", 0.44, "Advanced scan recognized targeted graveyard exile.");
    addRole(profile, "hate_piece", 0.28, "Advanced scan recognized graveyard hate.");
  }

  if (/\bshuffle\b[^.]{0,120}\btarget cards? from (?:a single |target )?graveyard into their owners'? libraries\b/.test(text)) {
    addRole(profile, "graveyard_hate", 0.34, "Advanced scan recognized graveyard recycling.");
    addRole(profile, "library_recursion", 0.28, "Advanced scan recognized graveyard-to-library recycling.");
  }

  if (
    /\bat the beginning of enchanted player'?s upkeep\b[^.]{0,120}\bthat player exiles (?:two|\d+) cards from their graveyard\b/.test(text) ||
    /\btarget opponent exiles a creature they control and their graveyard\b/.test(text) ||
    /\byou choose a nonland card from (?:that player'?s|their) graveyard or hand and exile it\b/.test(text)
  ) {
    addRole(profile, "graveyard_hate", 0.48, "Advanced scan recognized graveyard exile pressure.");
    addRole(profile, "hate_piece", 0.34, "Advanced scan recognized graveyard hate.");
  }

  if (
    /\bsearch (?:target player'?s|its owner'?s) graveyard, hand, and library for any number of cards\b[\s\S]{0,160}\bexile them\b/.test(text) ||
    /\bsearch target opponent'?s graveyard, hand, and library for any number of cards with that name and exile them\b/.test(text) ||
    /\bsearch target player'?s library for up to (?:three|\d+) cards\b[\s\S]{0,80}\bexile them\b/.test(text) ||
    /\bsearch (?:its controller'?s|target player'?s) graveyard, hand, and library for all cards with the same name\b[\s\S]{0,160}\bexile them\b/.test(text) ||
    /\bchoose a nonland card name\b[\s\S]{0,160}\bsearch target player'?s graveyard, hand, and library for all cards with that name and exile them\b/.test(text)
  ) {
    addRole(profile, "graveyard_hate", 0.46, "Advanced scan recognized extraction-style graveyard disruption.");
    addRole(profile, "hate_piece", 0.5, "Advanced scan recognized card-name denial.");
    addRole(profile, "hand_attack", 0.34, "Advanced scan recognized extraction-style hand pressure.");
  }

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

  if (/\bexile target creature\b[^.]{0,60}\bblocking a creature you control\b/.test(text)) {
    addRole(profile, "removal", 0.78, "Advanced scan recognized blocking-creature removal.");
    addRole(profile, "targeted_removal", 0.78, "Advanced scan recognized blocking-creature removal.");
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

  if (tempoRemoval || lockdownAura || temporaryTheft || permanentTheft || massTapLock) {
    addRole(profile, "removal", 0.58, "Advanced scan recognized tempo-based battlefield interaction.");
    addRole(
      profile,
      "tempo_removal",
      permanentTheft ? 0.72 : lockdownAura || massTapLock ? 0.76 : temporaryTheft ? 0.58 : 0.68,
      "Advanced scan recognized bounce, theft, or tuck interaction.",
    );
  }

  if (/\breturn each\b[^.]{0,120}\bcreature\b[^.]{0,180}\bto (?:its|their) owner'?s hand\b/.test(text)) {
    addRole(profile, "removal", 0.72, "Advanced scan recognized mass bounce as battlefield interaction.");
    addRole(profile, "tempo_removal", 0.78, "Advanced scan recognized mass bounce as tempo interaction.");
  }

  if (/\b(?:unattach all equipment from target creature|destroy target equipment|put two target artifacts on top of their owners'? libraries|tap all artifacts)\b/.test(text)) {
    addRole(profile, "removal", 0.5, "Advanced scan recognized artifact or Equipment interaction.");
    addRole(profile, "tempo_removal", 0.52, "Advanced scan recognized artifact or Equipment tempo interaction.");
    addRole(profile, "artifact_support", 0.34, "Advanced scan recognized artifact-focused interaction.");
  }

  if (/\bend the turn\b/.test(text)) {
    addRole(profile, "stack", 0.44, "Advanced scan recognized turn-ending interaction.");
    addRole(profile, "spell_tempo", 0.38, "Advanced scan recognized turn-ending stack cleanup.");
  }

  if (handAttack) {
    addRole(profile, "removal", 0.44, "Advanced scan recognized hand pressure as resource interaction.");
    addRole(profile, "hand_attack", 0.62, "Advanced scan recognized hand attack.");
  }

  if (/\btarget opponent puts the cards from their hand on top of their library\b[\s\S]{0,220}\bsearch that player'?s library for that many cards\b/.test(text)) {
    addRole(profile, "hand_attack", 0.66, "Advanced scan recognized hand replacement disruption.");
    addRole(profile, "topdeck_control", 0.54, "Advanced scan recognized hand-to-library disruption.");
  }

  if (/\beach player sacrifices a land\b/.test(text)) {
    addRole(profile, "land_denial", 0.64, "Advanced scan recognized symmetrical land sacrifice.");
    addRole(profile, "mass_land_denial", 0.58, "Advanced scan recognized symmetrical land sacrifice.");
    addRole(profile, "hate_piece", 0.42, "Advanced scan recognized land denial as a table-shaping hate piece.");
  }

  if (/\bban a card other than a basic land card\b[\s\S]{0,180}\bremoved from the match\b/.test(text)) {
    addRole(profile, "removal", 0.5, "Advanced scan recognized match-level removal.");
    addRole(profile, "hate_piece", 0.42, "Advanced scan recognized card-name denial.");
  }

  if (/\bplayers can'?t cycle cards\b/.test(text)) {
    addRole(profile, "stax_piece", 0.48, "Advanced scan recognized cycling restriction.");
    addRole(profile, "hate_piece", 0.42, "Advanced scan recognized cycling hate.");
  }
}

export function detectAdvancedStackRoles(profile: CardRoleProfile, text: string) {
  const hardCounter =
    /\bcounter (?:up to (?:one|two|\d+) )?target\b[^.]{0,60}\bspells?\b/.test(text) &&
    !/\bunless\b/.test(text);
  const triggeredHardCounter =
    /\bwhenever a player casts\b[^.]{0,80}\b(?:spell|enchantment spell|instant spell|sorcery spell)\b[^.]{0,40}\bcounter it\b/.test(text) &&
    !/\bunless\b/.test(text);
  const delayedTriggeredHardCounter =
    /\bwhen a player casts a spell\b[\s\S]{0,160}\bcounter that spell\b/.test(text) &&
    !/\bunless\b/.test(text);
  const softCounter =
    /\bcounter (?:up to one )?target\b[^.]{0,60}\bspell\b[^.]{0,120}\bunless\b/.test(text) ||
    /\bcounter target spell if\b/.test(text) ||
    /\bcounter that spell if it has the same mana value as\b/.test(text) ||
    /\btarget spell'?s controller reveals their hand\b[\s\S]{0,180}\bcounter that spell\b/.test(text) ||
    /\byou and target spell'?s controller bid life\b[\s\S]{0,260}\bif you win the bidding, counter that spell\b/.test(text) ||
    /\bwhenever a player casts a spell\b[\s\S]{0,220}\bif they do, counter that spell\b/.test(text) ||
    /\bwhenever a player casts a spell\b[\s\S]{0,180}\bany other player may pay that spell'?s mana cost\b[\s\S]{0,120}\bcounter the spell\b/.test(text) ||
    /\bwhenever a player casts\b[^.]{0,80}\b(?:spell|enchantment spell|instant spell|sorcery spell)\b[^.]{0,80}\bcounter it unless\b/.test(text) ||
    /\bfor each spell and ability your opponents control\b[^.]{0,120}\bcounter it unless its controller pays\b/.test(text) ||
    /\bwhenever an opponent casts a spell from their hand\b[\s\S]{0,180}\bif it shares a card type with that spell, counter that spell\b/.test(text);
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
    /\bchoose new targets? for target spell\b/.test(text) ||
    /\byou may change any targets? of target\b[^.]{0,80}\bspell\b/.test(text) ||
    /\bwhenever a player chooses one or more targets\b[\s\S]{0,260}\bmay change the target or targets\b/.test(text) ||
    /\bspells you control can'?t be countered\b/.test(text);
  const castRestriction =
    /\b(?:target player|target opponent|each opponent|your opponents)\b[^.]{0,160}\bcan'?t cast\b[^.]{0,120}\b(?:spells|noncreature spells|instant spells|sorcery spells)\b/.test(
      text,
    ) ||
    /\bcan'?t cast noncreature spells\b/.test(text) ||
    /\bspells with the chosen names can'?t be cast\b/.test(text) ||
    /\bcreature spells can'?t be cast\b/.test(text) ||
    /\byou can cast spells only during your turn and you can cast no more than two spells each turn\b/.test(text);

  if (hardCounter || triggeredHardCounter || delayedTriggeredHardCounter) {
    addRole(profile, "stack", 0.9, "Advanced scan recognized a hard counterspell.");
    addRole(profile, "hard_stack", triggeredHardCounter || delayedTriggeredHardCounter ? 0.82 : 0.92, "Advanced scan recognized a hard counterspell.");
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
