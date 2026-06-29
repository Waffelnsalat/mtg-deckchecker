import assert from "node:assert/strict";
import test from "node:test";
import { getRoleWeight, inferAdvancedRoleProfile } from "./advancedCardScan";
import { ScryfallCard } from "./types";

test("inferAdvancedRoleProfile recognizes repeatable impulse card flow", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Count on Luck",
      "Enchantment",
      3,
      "At the beginning of your upkeep, exile the top card of your library. You may play that card this turn.",
    ),
  );

  assert.ok(getRoleWeight(profile, "draw") > 0);
  assert.ok(getRoleWeight(profile, "selection") > 0);
  assert.ok(getRoleWeight(profile, "repeatable_draw") > 0);
});

test("inferAdvancedRoleProfile recognizes chosen-creature removal without target text", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Sadistic Shell Game",
      "Sorcery",
      4,
      "Starting with the next opponent in turn order, each player chooses a creature you don't control. Destroy the chosen creatures.",
    ),
  );

  assert.ok(getRoleWeight(profile, "targeted_removal") > 0.9);
});

test("inferAdvancedRoleProfile recognizes each-opponent edict removal", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Soul Shatter Style",
      "Instant",
      3,
      "Each opponent sacrifices a creature or planeswalker with the highest mana value among creatures and planeswalkers they control.",
    ),
  );

  assert.ok(getRoleWeight(profile, "targeted_removal") > 0.7);
});

test("inferAdvancedRoleProfile recognizes plural edict wording like Make an Example", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Make an Example Style",
      "Sorcery",
      4,
      "Each opponent separates the creatures they control into two piles. For each opponent, you choose one of their piles. Each opponent sacrifices the creatures in their chosen pile.",
    ),
  );

  assert.ok(getRoleWeight(profile, "targeted_removal") > 0.7);
});

test("inferAdvancedRoleProfile recognizes equipment-based phasing protection", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Robe of Stars Style",
      "Artifact - Equipment",
      2,
      "Equipped creature gets +0/+3. Astral Projection — {1}{W}: Equipped creature phases out. Equip {1}.",
    ),
  );

  assert.ok(getRoleWeight(profile, "equipment_protection") > 0);
});

test("inferAdvancedRoleProfile recognizes graveyard replay engines", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Replay Engine",
      "Enchantment",
      4,
      "During each of your turns, you may play a land card from your graveyard.",
    ),
  );

  assert.ok(getRoleWeight(profile, "replay_recursion") > 0);
});

test("inferAdvancedRoleProfile recognizes plural extra-combat finishers", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Full Throttle",
      "Sorcery",
      6,
      "After this main phase, there are two additional combat phases. At the beginning of each combat this turn, untap all creatures that attacked this turn.",
    ),
  );

  assert.ok(getRoleWeight(profile, "combat_finisher") > 0.9);
  assert.ok(getRoleWeight(profile, "finisher") > 0);
});

test("inferAdvancedRoleProfile recognizes repeatable attack-trigger damage as removal and closing pressure", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Drakuseth, Maw of Flames",
      "Legendary Creature - Dragon",
      7,
      "Flying Whenever Drakuseth attacks, it deals 4 damage to any target and 3 damage to each of up to two other targets.",
    ),
  );

  assert.ok(getRoleWeight(profile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(profile, "repeatable_finisher") > 0);
});

test("inferAdvancedRoleProfile recognizes any-other-target damage reflection", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Screaming Nemesis",
      "Creature - Spirit",
      3,
      "Haste Whenever this creature is dealt damage, it deals that much damage to any other target. If a player is dealt damage this way, they can't gain life for the rest of the game.",
      { keywords: ["Haste"] },
    ),
  );

  assert.ok(getRoleWeight(profile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(profile, "repeatable_finisher") > 0);
});

test("inferAdvancedRoleProfile recognizes spell-lock combat pieces", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Hope of Ghirapur",
      "Legendary Artifact Creature - Thopter",
      1,
      "Flying Sacrifice Hope of Ghirapur: Until your next turn, target player who was dealt combat damage by Hope of Ghirapur this turn can't cast noncreature spells.",
    ),
  );

  assert.ok(getRoleWeight(profile, "stack") > 0);
});

test("inferAdvancedRoleProfile recognizes aura neutralization as removal", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Song of the Dryads",
      "Enchantment - Aura",
      3,
      "Enchant permanent. Enchanted permanent is a colorless Forest land.",
    ),
  );

  assert.ok(getRoleWeight(profile, "targeted_removal") > 0.7);
});

test("inferAdvancedRoleProfile recognizes scalable any-target damage", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Comet Storm",
      "Instant",
      2,
      "Multikicker {1}. Choose any target, then choose another target for each time this spell was kicked. Comet Storm deals X damage to each of them.",
    ),
  );

  assert.ok(getRoleWeight(profile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(profile, "direct_finisher") > 0);

  const multiTargetProfile = inferAdvancedRoleProfile(
    createCard(
      "Crackle with Power",
      "Sorcery",
      5,
      "Crackle with Power deals five times X damage to each of up to X targets.",
    ),
  );

  assert.ok(getRoleWeight(multiTargetProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(multiTargetProfile, "direct_finisher") > 0);
});

test("inferAdvancedRoleProfile keeps small fixed burn out of finisher tags", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Lightning Bolt Style",
      "Instant",
      1,
      "This spell deals 3 damage to any target.",
    ),
  );

  assert.ok(getRoleWeight(profile, "targeted_removal") > 0);
  assert.equal(getRoleWeight(profile, "direct_finisher"), 0);
});

test("inferAdvancedRoleProfile treats top filtering as selection, not repeatable draw", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Sensei's Divining Top Style",
      "Artifact",
      1,
      "{1}: Look at the top three cards of your library, then put them back in any order. {T}: Draw a card, then put Sensei's Divining Top Style on top of its owner's library.",
    ),
  );

  assert.ok(getRoleWeight(profile, "selection") > 0);
  assert.equal(getRoleWeight(profile, "direct_draw"), 0);
  assert.equal(getRoleWeight(profile, "repeatable_draw"), 0);
  assert.equal(getRoleWeight(profile, "repeatable_advantage"), 0);
});

test("inferAdvancedRoleProfile does not count self-contained flashback as deck recursion", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Faithless Looting Style",
      "Sorcery",
      1,
      "Draw two cards, then discard two cards. Flashback {2}{R}.",
      { keywords: ["Flashback"] },
    ),
  );

  assert.equal(getRoleWeight(profile, "replay_recursion"), 0);
  assert.ok(getRoleWeight(profile, "graveyard_support") > 0);
});

test("inferAdvancedRoleProfile keeps built-in self-protection out of scored protection roles", () => {
  const selfProtectedProfile = inferAdvancedRoleProfile(
    createCard(
      "Self-Protected Threat",
      "Legendary Creature - Squirrel",
      4,
      "This spell can't be countered. Indestructible. Whenever a creature you control deals combat damage to a player, draw a card.",
    ),
  );
  const playerProtectedProfile = inferAdvancedRoleProfile(
    createCard(
      "Player Shield",
      "Legendary Artifact",
      4,
      "Indestructible. When this artifact enters, if you cast it, you gain protection from everything until your next turn.",
    ),
  );

  assert.ok(getRoleWeight(selfProtectedProfile, "self_protection") > 0);
  assert.equal(getRoleWeight(selfProtectedProfile, "targeted_protection"), 0);
  assert.ok(getRoleWeight(playerProtectedProfile, "broad_protection") > 0);
});

test("inferAdvancedRoleProfile keeps token and lifegain support categorized", () => {
  const tokenProfile = inferAdvancedRoleProfile(
    createCard(
      "Wolfcaller's Howl",
      "Enchantment",
      5,
      "At the beginning of your upkeep, create X 2/2 green Wolf creature tokens, where X is the number of your opponents with four or more cards in hand.",
    ),
  );
  const lifeProfile = inferAdvancedRoleProfile(
    createCard(
      "Congregate",
      "Instant",
      4,
      "Target player gains 2 life for each creature on the battlefield.",
    ),
  );

  assert.ok(getRoleWeight(tokenProfile, "token_support") > 0);
  assert.ok(getRoleWeight(lifeProfile, "lifegain") > 0);
});

test("inferAdvancedRoleProfile categorizes alternate costs and scaling combat bodies", () => {
  const costProfile = inferAdvancedRoleProfile(
    createCard(
      "Fist of Suns",
      "Artifact",
      3,
      "You may pay {W}{U}{B}{R}{G} rather than pay the mana cost for spells that you cast.",
    ),
  );
  const combatProfile = inferAdvancedRoleProfile(
    createCard(
      "Wight of Precinct Six",
      "Creature - Zombie",
      2,
      "Wight of Precinct Six gets +1/+1 for each creature card in your opponents' graveyards.",
    ),
  );

  assert.ok(getRoleWeight(costProfile, "cost_reduction") > 0);
  assert.ok(getRoleWeight(combatProfile, "combat_support") > 0);
});

test("inferAdvancedRoleProfile categorizes equipment combat and graveyard support", () => {
  const equipmentProfile = inferAdvancedRoleProfile(
    createCard(
      "Loxodon Warhammer",
      "Artifact - Equipment",
      3,
      "Equipped creature gets +3/+0 and has trample and lifelink. Equip {3}.",
    ),
  );
  const graveyardProfile = inferAdvancedRoleProfile(
    createCard(
      "Shadow Kin",
      "Creature - Shapeshifter",
      4,
      "At the beginning of your upkeep, each player mills three cards. You may exile a creature card from among the cards milled this way. If you do, this creature becomes a copy of that card, except it has this ability.",
    ),
  );

  assert.ok(getRoleWeight(equipmentProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(equipmentProfile, "lifegain") > 0);
  assert.ok(getRoleWeight(graveyardProfile, "mill_support") > 0);
});

test("inferAdvancedRoleProfile categorizes artifact and copy utility", () => {
  const artifactProfile = inferAdvancedRoleProfile(
    createCard(
      "Dan Lewis",
      "Legendary Creature - Human",
      3,
      'Noncreature, non-Equipment artifacts you control are Equipment in addition to their other types and have "Equipped creature gets +1/+0" and equip {1}.',
    ),
  );
  const copyProfile = inferAdvancedRoleProfile(
    createCard(
      "Mirage Mirror",
      "Artifact",
      3,
      "{2}: This artifact becomes a copy of target artifact, creature, enchantment, or land until end of turn.",
    ),
  );
  const landCopyProfile = inferAdvancedRoleProfile(
    createCard(
      "Copy Land",
      "Enchantment",
      3,
      "You may have this enchantment enter as a copy of any land on the battlefield, except it's an enchantment in addition to its other types.",
    ),
  );

  assert.ok(getRoleWeight(artifactProfile, "artifact_support") > 0);
  assert.ok(getRoleWeight(artifactProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(copyProfile, "copy_support") > 0);
  assert.ok(getRoleWeight(landCopyProfile, "mana_fixing") > 0);
});

test("inferAdvancedRoleProfile recognizes dice and coin-flip replacement support", () => {
  const diceProfile = inferAdvancedRoleProfile(
    createCard(
      "Barbarian Class Style",
      "Enchantment - Class",
      1,
      "If you would roll one or more dice, instead roll that many dice plus one and ignore the lowest roll.",
    ),
  );
  const coinProfile = inferAdvancedRoleProfile(
    createCard(
      "Krark's Thumb Style",
      "Artifact",
      2,
      "If you would flip a coin, instead flip two coins and ignore one.",
    ),
  );

  assert.ok(getRoleWeight(diceProfile, "dice_support") > 0);
  assert.ok(getRoleWeight(diceProfile, "replacement_engine") > 0);
  assert.ok(getRoleWeight(coinProfile, "coin_support") > 0);
  assert.ok(getRoleWeight(coinProfile, "replacement_engine") > 0);
});

test("inferAdvancedRoleProfile recognizes token, counter, and trigger replacement engines", () => {
  const tokenProfile = inferAdvancedRoleProfile(
    createCard(
      "Token Doubler Style",
      "Enchantment",
      4,
      "If one or more tokens would be created under your control, twice that many of those tokens are created instead.",
    ),
  );
  const counterProfile = inferAdvancedRoleProfile(
    createCard(
      "Counter Doubler Style",
      "Enchantment",
      3,
      "If one or more counters would be put on a creature you control, that many plus one counters are put on it instead.",
    ),
  );
  const triggerProfile = inferAdvancedRoleProfile(
    createCard(
      "Panharmonicon Style",
      "Artifact",
      4,
      "If an artifact or creature entering causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.",
    ),
  );

  assert.ok(getRoleWeight(tokenProfile, "token_support") > 0);
  assert.ok(getRoleWeight(tokenProfile, "replacement_engine") > 0);
  assert.ok(getRoleWeight(counterProfile, "counter_support") > 0);
  assert.ok(getRoleWeight(counterProfile, "replacement_engine") > 0);
  assert.ok(getRoleWeight(triggerProfile, "copy_support") > 0);
  assert.ok(getRoleWeight(triggerProfile, "replacement_engine") > 0);
});

test("inferAdvancedRoleProfile categorizes face-down support and commander cost reduction", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Kadena, Slinking Sorcerer",
      "Legendary Creature - Naga Wizard",
      4,
      "The first face-down creature spell you cast each turn costs {3} less to cast. Whenever a face-down creature enters the battlefield under your control, draw a card.",
    ),
  );

  assert.ok(getRoleWeight(profile, "face_down_support") > 0);
  assert.ok(getRoleWeight(profile, "repeatable_draw") > 0);
  assert.ok(getRoleWeight(profile, "cost_reduction") > 0);
});

test("inferAdvancedRoleProfile recognizes reveal-and-cast topdeck engines", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Powerbalance",
      "Enchantment",
      5,
      "Whenever an opponent casts a spell, you may reveal the top card of your library. If you do, you may cast that card without paying its mana cost if the two spells have the same mana value.",
    ),
  );

  assert.ok(getRoleWeight(profile, "draw") > 0);
  assert.ok(getRoleWeight(profile, "selection") > 0);
});

test("inferAdvancedRoleProfile recognizes library dig into hand or battlefield", () => {
  const handProfile = inferAdvancedRoleProfile(
    createCard(
      "Mill Pick Style",
      "Sorcery",
      2,
      "Mill three cards. You may put a creature or land card from among the cards milled this way into your hand.",
    ),
  );
  const battlefieldProfile = inferAdvancedRoleProfile(
    createCard(
      "Battlefield Pick Style",
      "Sorcery",
      5,
      "Look at the top five cards of your library. You may put a creature card from among them onto the battlefield.",
    ),
  );

  assert.ok(getRoleWeight(handProfile, "selection") > 0);
  assert.ok(getRoleWeight(handProfile, "restricted_tutor") > 0);
  assert.ok(getRoleWeight(battlefieldProfile, "selection") > 0);
  assert.ok(getRoleWeight(battlefieldProfile, "restricted_tutor") > 0);
});

test("inferAdvancedRoleProfile recognizes symmetric library searches that put nonland cards onto the battlefield", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Incoming!",
      "Sorcery",
      8,
      "Each player searches their library for any number of artifact, creature, enchantment, and/or land cards, puts them onto the battlefield, then shuffles.",
    ),
  );

  assert.ok(getRoleWeight(profile, "tutor") > 0);
  assert.ok(getRoleWeight(profile, "restricted_tutor") > 0);
  assert.ok(getRoleWeight(profile, "cheat_into_play") > 0);
  assert.ok(getRoleWeight(profile, "land_acceleration") > 0);
  assert.ok(getRoleWeight(profile, "mana_fixing") > 0);
});

test("inferAdvancedRoleProfile recognizes scalable bodies and targeted pump as combat roles", () => {
  const pumpProfile = inferAdvancedRoleProfile(
    createCard(
      "Timberwatch Style",
      "Creature - Elf",
      3,
      "{T}: Target creature gets +X/+X until end of turn, where X is the number of Elves on the battlefield.",
    ),
  );
  const bodyProfile = inferAdvancedRoleProfile(
    createCard(
      "Drove Style",
      "Creature - Elf",
      4,
      "Hexproof. This creature's power and toughness are each equal to the number of green permanents you control.",
    ),
  );

  assert.ok(getRoleWeight(pumpProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(bodyProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(bodyProfile, "self_protection") > 0);
  assert.equal(getRoleWeight(bodyProfile, "targeted_protection"), 0);
});

test("inferAdvancedRoleProfile recognizes mass bounce and tap-down tempo", () => {
  const bounceProfile = inferAdvancedRoleProfile(
    createCard(
      "Scourge Style",
      "Creature - Kraken",
      7,
      "When this creature enters, return each creature your opponents control with toughness X or less to its owner's hand, where X is the number of Islands you control.",
    ),
  );
  const tapProfile = inferAdvancedRoleProfile(
    createCard(
      "Elder Deep-Fiend Style",
      "Creature - Eldrazi Octopus",
      8,
      "Flash. When you cast this spell, tap up to four target permanents.",
    ),
  );

  assert.ok(getRoleWeight(bounceProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(tapProfile, "tempo_removal") > 0);
});

test("inferAdvancedRoleProfile recognizes tribal lords and exile-cast engines", () => {
  const lordProfile = inferAdvancedRoleProfile(
    createCard(
      "Lord Style",
      "Creature - Zombie",
      3,
      "Other Zombies you control get +1/+1. {1}{B}, {T}: All Zombies gain menace until end of turn.",
    ),
  );
  const exileCastProfile = inferAdvancedRoleProfile(
    createCard(
      "Chaos Wand Style",
      "Artifact",
      3,
      "Target opponent exiles cards from the top of their library until they exile an instant or sorcery card. You may cast that card without paying its mana cost.",
    ),
  );

  assert.ok(getRoleWeight(lordProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(exileCastProfile, "selection") > 0);
  assert.ok(getRoleWeight(exileCastProfile, "theft_support") > 0);
});

test("inferAdvancedRoleProfile recognizes damage payoffs and selective sweepers", () => {
  const damageProfile = inferAdvancedRoleProfile(
    createCard(
      "Warstorm Style",
      "Enchantment",
      6,
      "Whenever a creature you control enters, it deals damage equal to its power to any target.",
    ),
  );
  const sweeperProfile = inferAdvancedRoleProfile(
    createCard(
      "Selective Obliteration Style",
      "Sorcery",
      5,
      "Each player chooses a color. Then exile each permanent unless it's colorless or it's only the color its controller chose.",
    ),
  );

  assert.ok(getRoleWeight(damageProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(damageProfile, "direct_finisher") > 0);
  assert.ok(getRoleWeight(sweeperProfile, "mass_removal") > 0);
});

test("inferAdvancedRoleProfile recognizes exile-land ramp and power/toughness switching", () => {
  const rampProfile = inferAdvancedRoleProfile(
    createCard(
      "Oblivion Sower Style",
      "Creature - Eldrazi",
      6,
      "When you cast this spell, target opponent exiles the top four cards of their library, then you may put any number of land cards that player owns from exile onto the battlefield under your control.",
    ),
  );
  const switchProfile = inferAdvancedRoleProfile(
    createCard(
      "Inversion Style",
      "Creature - Eldrazi",
      2,
      "At the beginning of combat on your turn, switch the power and toughness of each of any number of target creatures until end of turn.",
    ),
  );

  assert.ok(getRoleWeight(rampProfile, "land_acceleration") > 0);
  assert.ok(getRoleWeight(rampProfile, "theft_support") > 0);
  assert.ok(getRoleWeight(switchProfile, "combat_support") > 0);
});

test("inferAdvancedRoleProfile recognizes artifact hand-cheat engines", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Master Transmuter",
      "Artifact Creature - Human Artificer",
      4,
      "{U}, {T}, Return an artifact you control to its owner's hand: You may put an artifact card from your hand onto the battlefield.",
    ),
  );

  assert.ok(getRoleWeight(profile, "artifact_support") > 0);
  assert.ok(getRoleWeight(profile, "cost_reduction") > 0);
});

test("inferAdvancedRoleProfile recognizes one-sided shrink sweepers with death-drain", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Massacre Wurm",
      "Creature - Phyrexian Wurm",
      6,
      "When this creature enters, creatures your opponents control get -2/-2 until end of turn. Whenever a creature an opponent controls dies, that player loses 2 life.",
    ),
  );

  assert.ok(getRoleWeight(profile, "mass_removal") > 0);
  assert.ok(getRoleWeight(profile, "direct_finisher") > 0);
});

test("inferAdvancedRoleProfile recognizes broader precon utility gaps", () => {
  const typeProfile = inferAdvancedRoleProfile(
    createCard(
      "Arcane Adaptation Style",
      "Enchantment",
      3,
      "As this enchantment enters, choose a creature type. Creatures you control are the chosen type in addition to their other types.",
    ),
  );
  const copyProfile = inferAdvancedRoleProfile(
    createCard(
      "Narset's Reversal Style",
      "Instant",
      2,
      "Copy target instant or sorcery spell, then return it to its owner's hand. You may choose new targets for the copy.",
    ),
  );
  const recursionProfile = inferAdvancedRoleProfile(
    createCard(
      "Animate Dead Style",
      "Enchantment - Aura",
      2,
      "Enchant creature card in a graveyard. Return enchanted creature card to the battlefield under your control and attach this Aura to it.",
    ),
  );

  assert.ok(getRoleWeight(typeProfile, "kindred_support") > 0);
  assert.ok(getRoleWeight(copyProfile, "copy_support") > 0);
  assert.ok(getRoleWeight(copyProfile, "spell_tempo") > 0);
  assert.ok(getRoleWeight(recursionProfile, "battlefield_recursion") > 0);
});

test("inferAdvancedRoleProfile recognizes untap, type-lord, and selection utility", () => {
  const untapProfile = inferAdvancedRoleProfile(
    createCard(
      "Seedborn Muse Style",
      "Creature - Spirit",
      5,
      "Untap all permanents you control during each other player's untap step.",
    ),
  );
  const lordProfile = inferAdvancedRoleProfile(
    createCard(
      "Cloudshredder Style",
      "Creature - Sliver",
      2,
      "Sliver creatures you control have flying and haste.",
    ),
  );
  const selectionProfile = inferAdvancedRoleProfile(
    createCard(
      "Cream of the Crop Style",
      "Enchantment",
      2,
      "Whenever a creature you control enters, you may look at the top X cards of your library, where X is that creature's power. If you do, put one of those cards on top of your library.",
    ),
  );

  assert.ok(getRoleWeight(untapProfile, "stable_ramp") > 0);
  assert.ok(getRoleWeight(lordProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(selectionProfile, "selection") > 0);
});

test("inferAdvancedRoleProfile recognizes special sweepers, mass reanimation, and graveyard hate", () => {
  const sweeperProfile = inferAdvancedRoleProfile(
    createCard(
      "Wave Style",
      "Sorcery",
      4,
      "Each creature deals damage to itself equal to its power.",
    ),
  );
  const massReanimateProfile = inferAdvancedRoleProfile(
    createCard(
      "Rise Style",
      "Sorcery",
      9,
      "Put all creature cards from all graveyards onto the battlefield under your control.",
    ),
  );
  const hateProfile = inferAdvancedRoleProfile(
    createCard(
      "Endurance Style",
      "Creature - Elemental Incarnation",
      3,
      "When this creature enters, up to one target player puts all the cards from their graveyard on the bottom of their library in a random order.",
    ),
  );

  assert.ok(getRoleWeight(sweeperProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(massReanimateProfile, "mass_recursion") > 0);
  assert.ok(getRoleWeight(hateProfile, "hate_piece") > 0);
});

test("inferAdvancedRoleProfile recognizes remaining audited utility effects", () => {
  const recentRecursionProfile = inferAdvancedRoleProfile(
    createCard(
      "Continue Style",
      "Instant",
      4,
      "Choose up to four target creature cards in your graveyard that were put there from the battlefield this turn. Return them to the battlefield.",
    ),
  );
  const drainProfile = inferAdvancedRoleProfile(
    createCard(
      "Jaws Style",
      "Enchantment",
      3,
      "Whenever a creature you control enters, target opponent loses life equal to the difference between that creature's power and its toughness.",
    ),
  );
  const landAbilityProfile = inferAdvancedRoleProfile(
    createCard(
      "Steward Style",
      "Creature - Human Druid",
      3,
      "When this creature enters, exile up to three target land cards from your graveyard. Creatures you control have all activated abilities of all land cards exiled with this creature.",
    ),
  );
  const redirectProfile = inferAdvancedRoleProfile(
    createCard(
      "Pariah Style",
      "Enchantment - Aura",
      3,
      "Enchant creature. All damage that would be dealt to you is dealt to enchanted creature instead.",
    ),
  );

  assert.ok(getRoleWeight(recentRecursionProfile, "battlefield_recursion") > 0);
  assert.ok(getRoleWeight(drainProfile, "direct_finisher") > 0);
  assert.ok(getRoleWeight(landAbilityProfile, "land_synergy") > 0);
  assert.ok(getRoleWeight(redirectProfile, "broad_protection") > 0);
});

test("inferAdvancedRoleProfile recognizes broader face-down and face-up support", () => {
  const faceUpProfile = inferAdvancedRoleProfile(
    createCard(
      "Face-Up Engine",
      "Creature - Human Wizard",
      3,
      "Whenever a permanent you control is turned face up, draw a card. You may turn face-down creatures you control face up any time.",
    ),
  );
  const cloakProfile = inferAdvancedRoleProfile(
    createCard(
      "Cloak Engine",
      "Enchantment",
      4,
      "At the beginning of combat on your turn, cloak the top card of your library.",
    ),
  );

  assert.ok(getRoleWeight(faceUpProfile, "face_down_support") > 0);
  assert.ok(getRoleWeight(cloakProfile, "face_down_support") > 0);
});

test("inferAdvancedRoleProfile recognizes fog and damage-prevention effects", () => {
  const fogProfile = inferAdvancedRoleProfile(
    createCard(
      "Fog Style",
      "Instant",
      1,
      "Prevent all combat damage that would be dealt this turn.",
    ),
  );
  const noDamageProfile = inferAdvancedRoleProfile(
    createCard(
      "No Combat Damage Style",
      "Enchantment",
      3,
      "Creatures deal no combat damage to players.",
    ),
  );
  const circleProfile = inferAdvancedRoleProfile(
    createCard(
      "Circle Style",
      "Enchantment",
      2,
      "{1}: The next time a blue source of your choice would deal damage to you this turn, prevent that damage.",
    ),
  );
  const healerProfile = inferAdvancedRoleProfile(
    createCard(
      "Healer Style",
      "Creature - Human Cleric",
      2,
      "{T}: Prevent the next 1 damage that would be dealt to any target this turn.",
    ),
  );
  const conservatorProfile = inferAdvancedRoleProfile(
    createCard(
      "Conservator",
      "Artifact",
      4,
      "{3}, {T}: Prevent the next 2 damage that would be dealt to you this turn.",
    ),
  );
  const monolithProfile = inferAdvancedRoleProfile(
    createCard(
      "Jade Monolith",
      "Artifact",
      4,
      "{1}: The next time a source of your choice would deal damage to target creature this turn, that source deals that damage to you instead.",
    ),
  );

  assert.ok(getRoleWeight(fogProfile, "broad_protection") > 0);
  assert.ok(getRoleWeight(noDamageProfile, "broad_protection") > 0);
  assert.ok(getRoleWeight(circleProfile, "broad_protection") > 0);
  assert.ok(getRoleWeight(healerProfile, "targeted_protection") > 0);
  assert.ok(getRoleWeight(conservatorProfile, "broad_protection") > 0);
  assert.ok(getRoleWeight(monolithProfile, "targeted_protection") > 0);
});

test("inferAdvancedRoleProfile recognizes Alpha-era land denial and mana denial", () => {
  const armageddonProfile = inferAdvancedRoleProfile(
    createCard("Armageddon", "Sorcery", 4, "Destroy all lands."),
  );
  const stoneRainProfile = inferAdvancedRoleProfile(
    createCard("Stone Rain", "Sorcery", 3, "Destroy target land."),
  );
  const manaShortProfile = inferAdvancedRoleProfile(
    createCard(
      "Mana Short",
      "Instant",
      3,
      "Tap all lands target player controls and that player loses all unspent mana.",
    ),
  );

  assert.ok(getRoleWeight(armageddonProfile, "mass_land_denial") > 0);
  assert.ok(getRoleWeight(armageddonProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(stoneRainProfile, "targeted_land_removal") > 0);
  assert.ok(getRoleWeight(stoneRainProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(manaShortProfile, "mana_denial") > 0);
});

test("inferAdvancedRoleProfile recognizes Alpha-era extra turns and table damage", () => {
  const timeWalkProfile = inferAdvancedRoleProfile(
    createCard("Time Walk", "Sorcery", 2, "Take an extra turn after this one."),
  );
  const manabarbsProfile = inferAdvancedRoleProfile(
    createCard(
      "Manabarbs",
      "Enchantment",
      4,
      "Whenever a player taps a land for mana, this enchantment deals 1 damage to that player.",
    ),
  );
  const karmaProfile = inferAdvancedRoleProfile(
    createCard(
      "Karma",
      "Enchantment",
      4,
      "At the beginning of each player's upkeep, this enchantment deals damage to that player equal to the number of Swamps they control.",
    ),
  );
  const venomProfile = inferAdvancedRoleProfile(
    createCard(
      "Psychic Venom",
      "Enchantment - Aura",
      2,
      "Enchant land. Whenever enchanted land becomes tapped, this Aura deals 2 damage to that land's controller.",
    ),
  );

  assert.ok(getRoleWeight(timeWalkProfile, "extra_turn") > 0);
  assert.ok(getRoleWeight(timeWalkProfile, "finisher") > 0);
  assert.ok(getRoleWeight(manabarbsProfile, "group_slug") > 0);
  assert.ok(getRoleWeight(manabarbsProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(karmaProfile, "group_slug") > 0);
  assert.ok(getRoleWeight(venomProfile, "damage_engine") > 0);
});

test("inferAdvancedRoleProfile recognizes Alpha-era utility, laces, and ante cards", () => {
  const laceProfile = inferAdvancedRoleProfile(
    createCard(
      "Purelace",
      "Instant",
      1,
      "Target spell or permanent becomes white. (Mana symbols on that permanent remain unchanged.)",
    ),
  );
  const hackProfile = inferAdvancedRoleProfile(
    createCard(
      "Magical Hack",
      "Instant",
      1,
      'Change the text of target spell or permanent by replacing all instances of one basic land type with another. (For example, you may change "swampwalk" to "plainswalk." This effect lasts indefinitely.)',
    ),
  );
  const anteProfile = inferAdvancedRoleProfile(
    createCard(
      "Demonic Attorney",
      "Sorcery",
      3,
      "Remove this card from your deck before playing if you're not playing for ante. Each player antes the top card of their library.",
    ),
  );
  const wordProfile = inferAdvancedRoleProfile(
    createCard(
      "Word of Command",
      "Instant",
      2,
      "Look at target opponent's hand and choose a card from it. You control that player until Word of Command finishes resolving.",
    ),
  );

  assert.ok(getRoleWeight(laceProfile, "color_change") > 0);
  assert.ok(getRoleWeight(hackProfile, "text_change") > 0);
  assert.ok(getRoleWeight(anteProfile, "ante_card") > 0);
  assert.ok(getRoleWeight(wordProfile, "hand_info") > 0);
  assert.ok(getRoleWeight(wordProfile, "player_control") > 0);
});

test("inferAdvancedRoleProfile recognizes Alpha-era combat and lockdown oddities", () => {
  const paralyzeProfile = inferAdvancedRoleProfile(
    createCard(
      "Paralyze",
      "Enchantment - Aura",
      1,
      "Enchant creature. When this Aura enters, tap enchanted creature. Enchanted creature doesn't untap during its controller's untap step.",
    ),
  );
  const weaknessProfile = inferAdvancedRoleProfile(
    createCard("Weakness", "Enchantment - Aura", 1, "Enchant creature. Enchanted creature gets -2/-1."),
  );
  const basiliskProfile = inferAdvancedRoleProfile(
    createCard(
      "Thicket Basilisk",
      "Creature - Basilisk",
      5,
      "Whenever this creature blocks or becomes blocked by a non-Wall creature, destroy that creature at end of combat.",
    ),
  );
  const lureProfile = inferAdvancedRoleProfile(
    createCard("Lure", "Enchantment - Aura", 3, "Enchant creature. All creatures able to block enchanted creature do so."),
  );
  const meekstoneProfile = inferAdvancedRoleProfile(
    createCard("Meekstone", "Artifact", 1, "Creatures with power 3 or greater don't untap during their controllers' untap steps."),
  );

  assert.ok(getRoleWeight(paralyzeProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(weaknessProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(basiliskProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(basiliskProfile, "combat_body") > 0);
  assert.ok(getRoleWeight(lureProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(meekstoneProfile, "hate_piece") > 0);
});

test("inferAdvancedRoleProfile recognizes Alpha-era lands, animation, regeneration, and low-signal bodies", () => {
  const dualProfile = inferAdvancedRoleProfile(
    createCard("Badlands", "Land - Swamp Mountain", 0, "({T}: Add {B} or {R}.)"),
  );
  const basicProfile = inferAdvancedRoleProfile(
    createCard("Forest", "Basic Land - Forest", 0, "({T}: Add {G}.)"),
  );
  const animateProfile = inferAdvancedRoleProfile(
    createCard(
      "Animate Artifact",
      "Enchantment - Aura",
      1,
      "Enchant artifact. As long as enchanted artifact isn't a creature, it's an artifact creature with power and toughness each equal to its mana value.",
    ),
  );
  const terrainProfile = inferAdvancedRoleProfile(
    createCard(
      "Phantasmal Terrain",
      "Enchantment - Aura",
      2,
      "Enchant land. As this Aura enters, choose a basic land type. Enchanted land is the chosen type.",
    ),
  );
  const regenerationProfile = inferAdvancedRoleProfile(
    createCard("Regeneration", "Enchantment - Aura", 2, "Enchant creature. {G}: Regenerate enchanted creature."),
  );
  const bearProfile = inferAdvancedRoleProfile(
    createCard("Grizzly Bears", "Creature - Bear", 2, ""),
  );

  assert.ok(getRoleWeight(dualProfile, "land_base") > 0);
  assert.ok(getRoleWeight(dualProfile, "typed_land") > 0);
  assert.ok(getRoleWeight(basicProfile, "basic_land") > 0);
  assert.ok(getRoleWeight(animateProfile, "animation_effect") > 0);
  assert.ok(getRoleWeight(terrainProfile, "land_type_change") > 0);
  assert.ok(getRoleWeight(regenerationProfile, "regeneration_protection") > 0);
  assert.ok(getRoleWeight(bearProfile, "combat_body") > 0);
});

test("inferAdvancedRoleProfile recognizes Arabian Nights oddities", () => {
  const eyeProfile = inferAdvancedRoleProfile(
    createCard(
      "Eye for an Eye",
      "Instant",
      2,
      "The next time a source of your choice would deal damage to you this turn, instead that source deals that much damage to you and Eye for an Eye deals that much damage to that source's controller.",
    ),
  );
  const shahrazadProfile = inferAdvancedRoleProfile(
    createCard(
      "Shahrazad",
      "Sorcery",
      2,
      "Players play a Magic subgame, using their libraries as their decks. Each player who doesn't win the subgame loses half their life, rounded up.",
    ),
  );
  const mountainProfile = inferAdvancedRoleProfile(
    createCard(
      "Magnetic Mountain",
      "Enchantment",
      3,
      "Blue creatures don't untap during their controllers' untap steps. At the beginning of each player's upkeep, that player may choose any number of tapped blue creatures they control and pay {4} for each creature chosen this way. If the player does, untap those creatures.",
    ),
  );
  const sandstormProfile = inferAdvancedRoleProfile(
    createCard("Sandstorm", "Instant", 1, "Sandstorm deals 1 damage to each attacking creature."),
  );
  const saddlebagsProfile = inferAdvancedRoleProfile(
    createCard("Jandor's Saddlebags", "Artifact", 3, "{3}, {T}: Untap target creature."),
  );
  const pyramidsProfile = inferAdvancedRoleProfile(
    createCard(
      "Pyramids",
      "Artifact",
      6,
      "{2}: Choose one — • Destroy target Aura attached to a land. • The next time target land would be destroyed this turn, remove all damage marked on it instead.",
    ),
  );
  const dropProfile = inferAdvancedRoleProfile(
    createCard(
      "Drop of Honey",
      "Enchantment",
      1,
      "At the beginning of your upkeep, destroy the creature with the least power. It can't be regenerated. If two or more creatures are tied for least power, you choose one of them. When there are no creatures on the battlefield, sacrifice this enchantment.",
    ),
  );

  assert.ok(getRoleWeight(eyeProfile, "damage_reflection") > 0);
  assert.ok(getRoleWeight(shahrazadProfile, "subgame") > 0);
  assert.ok(getRoleWeight(mountainProfile, "hate_piece") > 0);
  assert.ok(getRoleWeight(sandstormProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(saddlebagsProfile, "tap_untap") > 0);
  assert.equal(getRoleWeight(saddlebagsProfile, "ramp"), 0);
  assert.ok(getRoleWeight(pyramidsProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(pyramidsProfile, "land_protection") > 0);
  assert.ok(getRoleWeight(dropProfile, "targeted_removal") > 0);
});

test("inferAdvancedRoleProfile recognizes Arabian Nights combat and protection details", () => {
  const kingProfile = inferAdvancedRoleProfile(
    createCard("King Suleiman", "Creature - Human Noble", 2, "{T}: Destroy target Djinn or Efreet."),
  );
  const blacksmithProfile = inferAdvancedRoleProfile(
    createCard("Repentant Blacksmith", "Creature - Human", 2, "Protection from red"),
  );
  const wardProfile = inferAdvancedRoleProfile(
    createCard(
      "Red Ward",
      "Enchantment - Aura",
      1,
      "Enchant creature. Enchanted creature has protection from red. This effect doesn't remove this Aura.",
    ),
  );
  const fishliverProfile = inferAdvancedRoleProfile(
    createCard(
      "Fishliver Oil",
      "Enchantment - Aura",
      2,
      "Enchant creature. Enchanted creature has islandwalk.",
    ),
  );
  const queenProfile = inferAdvancedRoleProfile(
    createCard(
      "Sorceress Queen",
      "Creature - Human Wizard",
      3,
      "{T}: Target creature other than this creature has base power and toughness 0/2 until end of turn.",
    ),
  );
  const oublietteProfile = inferAdvancedRoleProfile(
    createCard(
      "Oubliette",
      "Enchantment",
      3,
      "When this enchantment enters, target creature phases out until this enchantment leaves the battlefield. Tap that creature as it phases in this way.",
    ),
  );
  const aliProfile = inferAdvancedRoleProfile(
    createCard(
      "Ali from Cairo",
      "Creature - Human",
      4,
      "Damage that would reduce your life total to less than 1 reduces it to 1 instead.",
    ),
  );

  assert.ok(getRoleWeight(kingProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(blacksmithProfile, "self_protection") > 0);
  assert.equal(getRoleWeight(wardProfile, "self_protection"), 0);
  assert.ok(getRoleWeight(fishliverProfile, "landwalk_support") > 0);
  assert.ok(getRoleWeight(queenProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(oublietteProfile, "tempo_removal") > 0);
  assert.equal(getRoleWeight(oublietteProfile, "targeted_protection"), 0);
  assert.ok(getRoleWeight(aliProfile, "life_total_protection") > 0);
  assert.equal(getRoleWeight(aliProfile, "lifegain"), 0);
});

test("inferAdvancedRoleProfile recognizes broader theft and borrowed-resource effects", () => {
  const permanentTheftProfile = inferAdvancedRoleProfile(
    createCard(
      "Control Magic Style",
      "Enchantment - Aura",
      4,
      "Enchant creature. You control enchanted creature.",
    ),
  );
  const castOpponentProfile = inferAdvancedRoleProfile(
    createCard(
      "Opponent Graveyard Cast Style",
      "Creature - Rogue",
      3,
      "You may cast spells from an opponent's graveyard, and you may spend mana as though it were mana of any color to cast them.",
    ),
  );

  assert.ok(getRoleWeight(permanentTheftProfile, "theft_support") > 0);
  assert.ok(getRoleWeight(castOpponentProfile, "theft_support") > 0);
  assert.ok(getRoleWeight(castOpponentProfile, "replacement_engine") > 0);
});

test("inferAdvancedRoleProfile recognizes broader cheat and flash timing effects", () => {
  const cheatProfile = inferAdvancedRoleProfile(
    createCard(
      "Creature Cheat Style",
      "Creature - Elf Shaman",
      4,
      "You may put a creature card from your hand onto the battlefield.",
    ),
  );
  const flashProfile = inferAdvancedRoleProfile(
    createCard(
      "Flash Enabler Style",
      "Enchantment",
      4,
      "You may cast creature spells as though they had flash.",
    ),
  );

  assert.ok(getRoleWeight(cheatProfile, "cost_reduction") > 0);
  assert.ok(getRoleWeight(flashProfile, "replacement_engine") > 0);
  assert.ok(getRoleWeight(flashProfile, "tempo_support") > 0);
});

test("inferAdvancedRoleProfile recognizes missed face-down precon cards", () => {
  const manifestProfile = inferAdvancedRoleProfile(
    createCard(
      "Abhorrent Oculus",
      "Creature - Eye",
      3,
      "Flying. At the beginning of each opponent's upkeep, manifest dread.",
      { keywords: ["Flying", "Manifest", "Manifest dread"] },
    ),
  );
  const faceDownRemovalProfile = inferAdvancedRoleProfile(
    createCard(
      "Cyber Conversion",
      "Instant",
      3,
      "Turn target creature face down. It's a 2/2 Cyberman artifact creature.",
    ),
  );
  const ixidorProfile = inferAdvancedRoleProfile(
    createCard(
      "Ixidor, Reality Sculptor",
      "Legendary Creature - Human Wizard",
      5,
      "Face-down creatures get +1/+1. {2}{U}: Turn target face-down creature face up.",
    ),
  );

  assert.ok(getRoleWeight(manifestProfile, "face_down_support") > 0);
  assert.ok(getRoleWeight(faceDownRemovalProfile, "face_down_support") > 0);
  assert.ok(getRoleWeight(faceDownRemovalProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(ixidorProfile, "face_down_support") > 0);
  assert.ok(getRoleWeight(ixidorProfile, "combat_support") > 0);
});

test("inferAdvancedRoleProfile recognizes exchange theft, attack forcing, and flash engines", () => {
  const exchangeProfile = inferAdvancedRoleProfile(
    createCard(
      "Chromeshell Crab",
      "Creature - Crab Beast",
      5,
      "Morph {4}{U}. When this creature is turned face up, you may exchange control of target creature you control and target creature an opponent controls.",
      { keywords: ["Morph"] },
    ),
  );
  const sirenProfile = inferAdvancedRoleProfile(
    createCard(
      "Dulcet Sirens",
      "Creature - Siren",
      3,
      "{U}, {T}: Target creature attacks target opponent this turn if able. Morph {U}.",
      { keywords: ["Morph"] },
    ),
  );
  const flashProfile = inferAdvancedRoleProfile(
    createCard(
      "High Fae Trickster",
      "Creature - Faerie Wizard",
      4,
      "Flash. Flying. You may cast spells as though they had flash.",
      { keywords: ["Flash", "Flying"] },
    ),
  );

  assert.ok(getRoleWeight(exchangeProfile, "theft_support") > 0);
  assert.ok(getRoleWeight(exchangeProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(sirenProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(flashProfile, "tempo_support") > 0);
  assert.ok(getRoleWeight(flashProfile, "replacement_engine") > 0);
});

test("inferAdvancedRoleProfile recognizes wider board buff wording", () => {
  const anthemProfile = inferAdvancedRoleProfile(
    createCard(
      "Keyword Anthem",
      "Enchantment",
      3,
      "Creature tokens you control get +1/+1 and have vigilance.",
    ),
  );
  const globalKeywordProfile = inferAdvancedRoleProfile(
    createCard(
      "Team Keyword",
      "Creature - Human Knight",
      4,
      "Other creatures you control gain flying and double strike until end of turn.",
    ),
  );

  assert.ok(getRoleWeight(anthemProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(globalKeywordProfile, "combat_support") > 0);
});

test("inferAdvancedRoleProfile recognizes mass flicker, symmetric tutors, and combat skips", () => {
  const ghostwayProfile = inferAdvancedRoleProfile(
    createCard(
      "Ghostway",
      "Instant",
      3,
      "Exile each creature you control. Return those cards to the battlefield under their owner's control at the beginning of the next end step.",
    ),
  );
  const schemingProfile = inferAdvancedRoleProfile(
    createCard(
      "Scheming Symmetry",
      "Sorcery",
      1,
      "Choose two target players. Each of them searches their library for a card, then shuffles and puts that card on top.",
    ),
  );
  const stonehornProfile = inferAdvancedRoleProfile(
    createCard(
      "Stonehorn Dignitary",
      "Creature - Rhino Soldier",
      4,
      "When Stonehorn Dignitary enters the battlefield, target opponent skips their next combat phase.",
    ),
  );

  assert.ok(getRoleWeight(ghostwayProfile, "flicker") > 0);
  assert.ok(getRoleWeight(ghostwayProfile, "protection") > 0);
  assert.ok(getRoleWeight(schemingProfile, "direct_tutor") > 0);
  assert.ok(getRoleWeight(stonehornProfile, "broad_protection") > 0);
});

test("inferAdvancedRoleProfile recognizes keyword-driven library and dungeon mechanics", () => {
  const discoverProfile = inferAdvancedRoleProfile(
    createCard(
      "Chimil, the Inner Sun",
      "Legendary Artifact",
      6,
      "Spells you control can't be countered. At the beginning of your end step, discover 5.",
      { keywords: ["Discover"] },
    ),
  );
  const initiativeProfile = inferAdvancedRoleProfile(
    createCard(
      "White Plume Adventurer",
      "Creature - Orc Cleric",
      3,
      "When this creature enters, you take the initiative.",
      { keywords: ["Take the Initiative"] },
    ),
  );
  const mutateProfile = inferAdvancedRoleProfile(
    createCard(
      "Auspicious Starrix",
      "Creature - Elk Beast",
      5,
      "Mutate {5}{G}. Whenever this creature mutates, exile cards from the top of your library until you exile X permanent cards, where X is the number of times this creature has mutated. Put those permanent cards onto the battlefield.",
      { keywords: ["Mutate"] },
    ),
  );

  assert.ok(getRoleWeight(discoverProfile, "selection") > 0);
  assert.ok(getRoleWeight(discoverProfile, "cost_reduction") > 0);
  assert.ok(getRoleWeight(discoverProfile, "broad_stack") > 0);
  assert.ok(getRoleWeight(initiativeProfile, "dungeon_support") > 0);
  assert.ok(getRoleWeight(mutateProfile, "restricted_tutor") > 0);
  assert.ok(getRoleWeight(mutateProfile, "combat_support") > 0);
});

test("inferAdvancedRoleProfile recognizes stack exile, hand-exile mana, and multiplier text", () => {
  const mindbreakProfile = inferAdvancedRoleProfile(
    createCard(
      "Mindbreak Trap",
      "Instant",
      4,
      "If an opponent cast three or more spells this turn, you may pay {0} rather than pay this spell's mana cost. Exile any number of target spells.",
    ),
  );
  const spiritGuideProfile = inferAdvancedRoleProfile(
    createCard(
      "Elvish Spirit Guide",
      "Creature - Elf Spirit",
      3,
      "Exile Elvish Spirit Guide from your hand: Add {G}.",
    ),
  );
  const doublerProfile = inferAdvancedRoleProfile(
    createCard(
      "Doubler Engine",
      "Artifact",
      4,
      "If one or more triggered abilities of permanents you control trigger, those abilities trigger an additional time.",
    ),
  );

  assert.ok(getRoleWeight(mindbreakProfile, "broad_stack") > 0);
  assert.ok(getRoleWeight(spiritGuideProfile, "burst_ramp") > 0);
  assert.ok(getRoleWeight(doublerProfile, "multiplier_support") > 0);
});

test("inferAdvancedRoleProfile gives all-land untap engines meaningful ramp weight", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Wilderness Reclamation",
      "Enchantment",
      4,
      "At the beginning of your end step, untap all lands you control.",
      { color_identity: ["G"] },
    ),
  );

  assert.ok(getRoleWeight(profile, "stable_ramp") >= 0.78);
});

test("inferAdvancedRoleProfile discounts mana paid to activate effects", () => {
  const freeProfile = inferAdvancedRoleProfile(
    createCard(
      "Free Removal Engine",
      "Artifact",
      3,
      "{T}: Destroy target creature.",
    ),
  );
  const paidProfile = inferAdvancedRoleProfile(
    createCard(
      "Paid Removal Engine",
      "Artifact",
      3,
      "{3}, {T}: Destroy target creature.",
    ),
  );

  assert.ok(getRoleWeight(freeProfile, "removal") > getRoleWeight(paidProfile, "removal"));
});

test("inferAdvancedRoleProfile recognizes Teysa Karlov as death-trigger support", () => {
  const profile = inferAdvancedRoleProfile(
    createCard(
      "Teysa Karlov",
      "Legendary Creature - Human Advisor",
      4,
      "If a creature dying causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time. Creature tokens you control have vigilance and lifelink.",
    ),
  );

  assert.ok(getRoleWeight(profile, "multiplier_support") > 0);
  assert.ok(getRoleWeight(profile, "sacrifice_support") > 0);
  assert.ok(getRoleWeight(profile, "token_support") > 0);
});

test("inferAdvancedRoleProfile recognizes generic X-spell scaling", () => {
  const drawProfile = inferAdvancedRoleProfile(
    createCard(
      "Blue Sun's Zenith",
      "Instant",
      3,
      "Target player draws X cards. Shuffle Blue Sun's Zenith into its owner's library.",
      { mana_cost: "{X}{U}{U}{U}" },
    ),
  );
  const tutorProfile = inferAdvancedRoleProfile(
    createCard(
      "Finale of Devastation",
      "Sorcery",
      2,
      "Search your library and/or graveyard for a creature card with mana value X or less and put it onto the battlefield. If X is 10 or more, creatures you control get +X/+X and gain haste until end of turn.",
      { mana_cost: "{X}{G}{G}" },
    ),
  );
  const tokenProfile = inferAdvancedRoleProfile(
    createCard(
      "Hangarback Walker",
      "Artifact Creature - Construct",
      0,
      "Hangarback Walker enters the battlefield with X +1/+1 counters on it. When Hangarback Walker dies, create a 1/1 colorless Thopter artifact creature token with flying for each +1/+1 counter on Hangarback Walker.",
      { mana_cost: "{X}{X}" },
    ),
  );

  assert.ok(getRoleWeight(drawProfile, "scalable_spell") > 0);
  assert.ok(getRoleWeight(drawProfile, "mana_sink") > 0);
  assert.ok(getRoleWeight(drawProfile, "direct_draw") > 0);
  assert.ok(getRoleWeight(tutorProfile, "restricted_tutor") > 0);
  assert.ok(getRoleWeight(tutorProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(tokenProfile, "counter_support") > 0);
  assert.ok(getRoleWeight(tokenProfile, "token_support") > 0);
});

test("inferAdvancedRoleProfile recognizes political control-exchange cards", () => {
  const chimeraProfile = inferAdvancedRoleProfile(
    createCard(
      "Perplexing Chimera",
      "Enchantment Creature - Chimera",
      5,
      "Whenever an opponent casts a spell, you may exchange control of Perplexing Chimera and that spell. If you do, you may choose new targets for the spell.",
    ),
  );
  const roleReversalProfile = inferAdvancedRoleProfile(
    createCard(
      "Role Reversal",
      "Sorcery",
      3,
      "Exchange control of two target permanents that share a permanent type.",
    ),
  );
  const shiftingGriftProfile = inferAdvancedRoleProfile(
    createCard(
      "Shifting Grift",
      "Sorcery",
      2,
      "Spree. Exchange control of two target creatures. Exchange control of two target artifacts. Exchange control of two target enchantments.",
    ),
  );
  const mirrorProfile = inferAdvancedRoleProfile(
    createCard(
      "Mirror Mirror",
      "Artifact",
      7,
      "This artifact enters tapped. {7}, {T}, Sacrifice this artifact: Choose target player. At the beginning of the next end step, exchange life totals with that player, exchange control of all permanents you and that player control, and exchange cards in your hands, cards in your libraries, and cards in your graveyards.",
    ),
  );

  assert.ok(getRoleWeight(chimeraProfile, "broad_stack") > 0);
  assert.ok(getRoleWeight(chimeraProfile, "donation_support") > 0);
  assert.ok(getRoleWeight(roleReversalProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(roleReversalProfile, "donation_support") > 0);
  assert.ok(getRoleWeight(shiftingGriftProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(shiftingGriftProfile, "donation_support") > 0);
  assert.ok(getRoleWeight(mirrorProfile, "theft_support") > 0);
  assert.ok(getRoleWeight(mirrorProfile, "donation_support") > 0);
});

test("inferAdvancedRoleProfile recognizes Antiquities utility and hate wording", () => {
  const powerArtifactProfile = inferAdvancedRoleProfile(
    createCard(
      "Power Artifact",
      "Enchantment - Aura",
      2,
      "Enchant artifact. Enchanted artifact's activated abilities cost {2} less to activate. This effect can't reduce the mana in that cost to less than one mana.",
    ),
  );
  const hauntingWindProfile = inferAdvancedRoleProfile(
    createCard(
      "Haunting Wind",
      "Enchantment",
      4,
      "Whenever an artifact becomes tapped or a player activates an artifact's ability without {T} in its activation cost, Haunting Wind deals 1 damage to that artifact's controller.",
    ),
  );
  const cursedRackProfile = inferAdvancedRoleProfile(
    createCard(
      "Cursed Rack",
      "Artifact",
      4,
      "As Cursed Rack enters, choose an opponent. The chosen player's maximum hand size is four.",
    ),
  );
  const golgothianSylexProfile = inferAdvancedRoleProfile(
    createCard(
      "Golgothian Sylex",
      "Artifact",
      4,
      "{1}, {T}: Each nontoken permanent originally printed in the Antiquities expansion is sacrificed by its controller.",
    ),
  );

  assert.ok(getRoleWeight(powerArtifactProfile, "cost_reduction") > 0);
  assert.ok(getRoleWeight(powerArtifactProfile, "ramp") > 0);
  assert.ok(getRoleWeight(hauntingWindProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(hauntingWindProfile, "artifact_hate") > 0);
  assert.ok(getRoleWeight(cursedRackProfile, "hand_size") > 0);
  assert.ok(getRoleWeight(cursedRackProfile, "hand_denial") > 0);
  assert.ok(getRoleWeight(golgothianSylexProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(golgothianSylexProfile, "hate_piece") > 0);
});

test("inferAdvancedRoleProfile recognizes Antiquities recursion and rescue wording", () => {
  const battleGearProfile = inferAdvancedRoleProfile(
    createCard(
      "Ashnod's Battle Gear",
      "Artifact",
      2,
      "You may choose not to untap Ashnod's Battle Gear during your untap step. {2}, {T}: Target creature you control gets +2/-2 for as long as Ashnod's Battle Gear remains tapped.",
    ),
  );
  const feldonsCaneProfile = inferAdvancedRoleProfile(
    createCard(
      "Feldon's Cane",
      "Artifact",
      1,
      "{T}, Exile Feldon's Cane: Shuffle your graveyard into your library.",
    ),
  );
  const obeliskProfile = inferAdvancedRoleProfile(
    createCard(
      "Obelisk of Undoing",
      "Artifact",
      1,
      "{6}, {T}: Return target permanent you both own and control to your hand.",
    ),
  );
  const drafnasRestorationProfile = inferAdvancedRoleProfile(
    createCard(
      "Drafna's Restoration",
      "Sorcery",
      1,
      "Put any number of target artifact cards from target player's graveyard on top of their library in any order.",
    ),
  );

  assert.ok(getRoleWeight(battleGearProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(feldonsCaneProfile, "library_recursion") > 0);
  assert.ok(getRoleWeight(obeliskProfile, "self_bounce") > 0);
  assert.ok(getRoleWeight(obeliskProfile, "rescue_protection") > 0);
  assert.ok(getRoleWeight(drafnasRestorationProfile, "library_recursion") > 0);
  assert.ok(getRoleWeight(drafnasRestorationProfile, "topdeck_control") > 0);
  assert.equal(getRoleWeight(drafnasRestorationProfile, "tempo_removal"), 0);
  assert.equal(getRoleWeight(drafnasRestorationProfile, "targeted_removal"), 0);
});

test("inferAdvancedRoleProfile recognizes Legends color and information utility wording", () => {
  const gateProfile = inferAdvancedRoleProfile(
    createCard("Heaven's Gate", "Instant", 1, "One or more target creatures become white until end of turn."),
  );
  const dreamCoatProfile = inferAdvancedRoleProfile(
    createCard(
      "Dream Coat",
      "Enchantment - Aura",
      1,
      "Enchant creature. {0}: Enchanted creature becomes the color or colors of your choice. Activate only once each turn.",
    ),
  );
  const tombProfile = inferAdvancedRoleProfile(
    createCard(
      "Alchor's Tomb",
      "Artifact",
      4,
      "{2}, {T}: Target permanent you control becomes the color of your choice. This effect lasts indefinitely.",
    ),
  );
  const visionsProfile = inferAdvancedRoleProfile(
    createCard(
      "Visions",
      "Sorcery",
      1,
      "Look at the top five cards of target player's library. You may then have that player shuffle that library.",
    ),
  );
  const revelationProfile = inferAdvancedRoleProfile(
    createCard("Revelation", "World Enchantment", 1, "Players play with their hands revealed."),
  );
  const fieldProfile = inferAdvancedRoleProfile(
    createCard("Field of Dreams", "World Enchantment", 1, "Players play with the top card of their libraries revealed."),
  );

  assert.ok(getRoleWeight(gateProfile, "color_change") > 0);
  assert.ok(getRoleWeight(dreamCoatProfile, "color_change") > 0);
  assert.ok(getRoleWeight(tombProfile, "color_change") > 0);
  assert.ok(getRoleWeight(visionsProfile, "topdeck_control") > 0);
  assert.ok(getRoleWeight(revelationProfile, "hand_info") > 0);
  assert.ok(getRoleWeight(fieldProfile, "topdeck_info") > 0);
});

test("inferAdvancedRoleProfile recognizes Legends stack locks and protection wording", () => {
  const presenceProfile = inferAdvancedRoleProfile(
    createCard(
      "Presence of the Master",
      "Enchantment",
      4,
      "Whenever a player casts an enchantment spell, counter it.",
    ),
  );
  const netherVoidProfile = inferAdvancedRoleProfile(
    createCard(
      "Nether Void",
      "World Enchantment",
      4,
      "Whenever a player casts a spell, counter it unless that player pays {3}.",
    ),
  );
  const rustProfile = inferAdvancedRoleProfile(
    createCard("Rust", "Instant", 1, "Counter target activated ability from an artifact source. Mana abilities can't be targeted."),
  );
  const auraProfile = inferAdvancedRoleProfile(
    createCard(
      "Anti-Magic Aura",
      "Enchantment - Aura",
      3,
      "Enchant creature. Enchanted creature can't be the target of spells and can't be enchanted by other Auras.",
    ),
  );
  const silhouetteProfile = inferAdvancedRoleProfile(
    createCard(
      "Silhouette",
      "Instant",
      2,
      "Choose target creature. If a spell or ability that targets that creature would cause a source to deal damage to that creature this turn, prevent that damage.",
    ),
  );

  assert.ok(getRoleWeight(presenceProfile, "hard_stack") > 0);
  assert.ok(getRoleWeight(presenceProfile, "stax_piece") > 0);
  assert.ok(getRoleWeight(netherVoidProfile, "soft_stack") > 0);
  assert.ok(getRoleWeight(netherVoidProfile, "stax_piece") > 0);
  assert.ok(getRoleWeight(rustProfile, "broad_stack") > 0);
  assert.ok(getRoleWeight(auraProfile, "targeted_protection") > 0);
  assert.ok(getRoleWeight(silhouetteProfile, "targeted_protection") > 0);
});

test("inferAdvancedRoleProfile recognizes Legends reflection, animation, and cheat wording", () => {
  const backfireProfile = inferAdvancedRoleProfile(
    createCard(
      "Backfire",
      "Enchantment - Aura",
      1,
      "Enchant creature. Whenever enchanted creature deals damage to you, this Aura deals that much damage to that creature's controller.",
    ),
  );
  const reverberationProfile = inferAdvancedRoleProfile(
    createCard(
      "Reverberation",
      "Instant",
      4,
      "All damage that would be dealt this turn by target sorcery spell is dealt to that spell's controller instead.",
    ),
  );
  const eurekaProfile = inferAdvancedRoleProfile(
    createCard(
      "Eureka",
      "Sorcery",
      4,
      "Starting with you, each player may put a permanent card from their hand onto the battlefield. Repeat this process until no one puts a card onto the battlefield.",
    ),
  );
  const livingPlaneProfile = inferAdvancedRoleProfile(
    createCard("Living Plane", "World Enchantment", 4, "All lands are 1/1 creatures that are still lands."),
  );
  const gravityProfile = inferAdvancedRoleProfile(
    createCard("Gravity Sphere", "World Enchantment", 3, "All creatures lose flying."),
  );
  const transmutationProfile = inferAdvancedRoleProfile(
    createCard("Transmutation", "Instant", 2, "Switch target creature's power and toughness until end of turn."),
  );

  assert.ok(getRoleWeight(backfireProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(reverberationProfile, "damage_reflection") > 0);
  assert.ok(getRoleWeight(eurekaProfile, "cheat_into_play") > 0);
  assert.ok(getRoleWeight(livingPlaneProfile, "animation_effect") > 0);
  assert.ok(getRoleWeight(gravityProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(transmutationProfile, "combat_support") > 0);
});

test("inferAdvancedRoleProfile recognizes The Dark land denial and small sweeper wording", () => {
  const cleansingProfile = inferAdvancedRoleProfile(
    createCard("Cleansing", "Sorcery", 3, "For each land, destroy that land unless any player pays 1 life."),
  );
  const erosionProfile = inferAdvancedRoleProfile(
    createCard(
      "Erosion",
      "Enchantment - Aura",
      3,
      "Enchant land. At the beginning of the upkeep of enchanted land's controller, destroy that land unless that player pays {1} or 1 life.",
    ),
  );
  const holyLightProfile = inferAdvancedRoleProfile(
    createCard("Holy Light", "Instant", 3, "Nonwhite creatures get -1/-1 until end of turn."),
  );
  const crusadeProfile = inferAdvancedRoleProfile(
    createCard("Tivadar's Crusade", "Sorcery", 3, "Destroy all Goblins."),
  );

  assert.ok(getRoleWeight(cleansingProfile, "mass_land_denial") > 0);
  assert.ok(getRoleWeight(cleansingProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(erosionProfile, "targeted_land_removal") > 0);
  assert.ok(getRoleWeight(holyLightProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(crusadeProfile, "mass_removal") > 0);
});

test("inferAdvancedRoleProfile recognizes The Dark hand pressure and tap-lock wording", () => {
  const mindBombProfile = inferAdvancedRoleProfile(
    createCard(
      "Mind Bomb",
      "Sorcery",
      1,
      "Each player may discard up to three cards. Mind Bomb deals damage to each player equal to 3 minus the number of cards they discarded this way.",
    ),
  );
  const inquisitionProfile = inferAdvancedRoleProfile(
    createCard(
      "Inquisition",
      "Sorcery",
      3,
      "Target player reveals their hand. Inquisition deals damage to that player equal to the number of white cards in their hand.",
    ),
  );
  const cageProfile = inferAdvancedRoleProfile(
    createCard("Barl's Cage", "Artifact", 4, "{3}: Target creature doesn't untap during its controller's next untap step."),
  );
  const wandProfile = inferAdvancedRoleProfile(
    createCard(
      "Wand of Ith",
      "Artifact",
      4,
      "{3}, {T}: Target player reveals a card at random from their hand. If it's a land card, that player discards it unless they pay 1 life. If it isn't a land card, the player discards it unless they pay life equal to its mana value. Activate only during your turn.",
    ),
  );

  assert.ok(getRoleWeight(mindBombProfile, "group_slug") > 0);
  assert.ok(getRoleWeight(mindBombProfile, "hand_attack") > 0);
  assert.ok(getRoleWeight(inquisitionProfile, "hand_info") > 0);
  assert.ok(getRoleWeight(inquisitionProfile, "direct_finisher") > 0);
  assert.ok(getRoleWeight(cageProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(wandProfile, "hand_info") > 0);
  assert.ok(getRoleWeight(wandProfile, "hand_attack") > 0);
});

test("inferAdvancedRoleProfile recognizes The Dark mana conversion and creature combat tricks", () => {
  const deepWaterProfile = inferAdvancedRoleProfile(
    createCard(
      "Deep Water",
      "Enchantment",
      2,
      "{U}: Until end of turn, if you tap a land you control for mana, it produces {U} instead of any other type.",
    ),
  );
  const riptideProfile = inferAdvancedRoleProfile(
    createCard("Riptide", "Instant", 1, "Tap all blue creatures."),
  );
  const venomProfile = inferAdvancedRoleProfile(
    createCard(
      "Venom",
      "Enchantment - Aura",
      3,
      "Enchant creature. Whenever enchanted creature blocks or becomes blocked by a non-Wall creature, destroy the other creature at end of combat.",
    ),
  );

  assert.ok(getRoleWeight(deepWaterProfile, "mana_fixing") > 0);
  assert.ok(getRoleWeight(riptideProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(venomProfile, "targeted_removal") > 0);
});

test("inferAdvancedRoleProfile recognizes Ice Age control, snow, and Aura utility wording", () => {
  const hallowedGroundProfile = inferAdvancedRoleProfile(
    createCard("Hallowed Ground", "Enchantment", 2, "{W}{W}: Return target nonsnow land you control to its owner's hand."),
  );
  const prismaticWardProfile = inferAdvancedRoleProfile(
    createCard(
      "Prismatic Ward",
      "Enchantment - Aura",
      2,
      "Enchant creature. As this Aura enters, choose a color. Prevent all damage that would be dealt to enchanted creature by sources of the chosen color.",
    ),
  );
  const soulBarrierProfile = inferAdvancedRoleProfile(
    createCard(
      "Soul Barrier",
      "Enchantment",
      3,
      "Whenever an opponent casts a creature spell, this enchantment deals 2 damage to that player unless they pay {2}.",
    ),
  );
  const wordOfUndoingProfile = inferAdvancedRoleProfile(
    createCard(
      "Word of Undoing",
      "Instant",
      1,
      "Return target creature and all white Auras you own attached to it to their owners' hands.",
    ),
  );
  const leshracsSigilProfile = inferAdvancedRoleProfile(
    createCard(
      "Leshrac's Sigil",
      "Enchantment",
      2,
      "Whenever an opponent casts a green spell, you may pay {B}{B}. If you do, look at that player's hand and choose a card from it. The player discards that card. {B}{B}: Return this enchantment to its owner's hand.",
    ),
  );
  const hexProfile = inferAdvancedRoleProfile(
    createCard(
      "Lim-Dul's Hex",
      "Enchantment",
      3,
      "At the beginning of your upkeep, for each player, this enchantment deals 1 damage to that player unless they pay {B} or {3}.",
    ),
  );
  const mindWhipProfile = inferAdvancedRoleProfile(
    createCard(
      "Mind Whip",
      "Enchantment - Aura",
      3,
      "Enchant creature. At the beginning of the upkeep of enchanted creature's controller, that player may pay {3}. If they don't, this Aura deals 2 damage to that player and you tap that creature.",
    ),
  );
  const conquerProfile = inferAdvancedRoleProfile(
    createCard("Conquer", "Enchantment - Aura", 5, "Enchant land. You control enchanted land."),
  );
  const curseProfile = inferAdvancedRoleProfile(
    createCard(
      "Curse of Marit Lage",
      "Enchantment",
      5,
      "When this enchantment enters, tap all Islands. Islands don't untap during their controllers' untap steps.",
    ),
  );
  const meltingProfile = inferAdvancedRoleProfile(createCard("Melting", "Enchantment", 4, "All lands are no longer snow."));
  const mudslideProfile = inferAdvancedRoleProfile(
    createCard(
      "Mudslide",
      "Enchantment",
      3,
      "Creatures without flying don't untap during their controllers' untap steps. At the beginning of each player's upkeep, that player may choose any number of tapped creatures without flying they control and pay {2} for each creature chosen this way. If the player does, untap those creatures.",
    ),
  );
  const forgottenLoreProfile = inferAdvancedRoleProfile(
    createCard(
      "Forgotten Lore",
      "Sorcery",
      1,
      "Target opponent chooses a card in your graveyard. You may pay {G}. If you do, repeat this process except that opponent can't choose a card already chosen for Forgotten Lore. Then put the last chosen card into your hand.",
    ),
  );
  const snowblindProfile = inferAdvancedRoleProfile(
    createCard(
      "Snowblind",
      "Enchantment - Aura",
      4,
      "Enchant creature. Enchanted creature gets -X/-Y. If that creature is attacking, X is the number of snow lands defending player controls. Otherwise, X is the number of snow lands its controller controls. Y is equal to X or to enchanted creature's toughness minus 1, whichever is smaller.",
    ),
  );
  const stuntedGrowthProfile = inferAdvancedRoleProfile(
    createCard(
      "Stunted Growth",
      "Sorcery",
      5,
      "Target player chooses three cards from their hand and puts them on top of their library in any order.",
    ),
  );
  const ghostlyFlameProfile = inferAdvancedRoleProfile(
    createCard("Ghostly Flame", "Enchantment", 3, "Black and/or red permanents and spells are colorless sources of damage."),
  );
  const weatherVaneProfile = inferAdvancedRoleProfile(
    createCard(
      "Arcum's Weathervane",
      "Artifact",
      2,
      "{2}, {T}: Target snow land is no longer snow. {2}, {T}: Target nonsnow basic land becomes snow.",
    ),
  );
  const crownProfile = inferAdvancedRoleProfile(
    createCard("Crown of the Ages", "Artifact", 2, "{4}, {T}: Attach target Aura attached to a creature to another creature."),
  );
  const arcanixProfile = inferAdvancedRoleProfile(
    createCard(
      "Vexing Arcanix",
      "Artifact",
      4,
      "{3}, {T}: Target player chooses a card name, then reveals the top card of their library. If that card has the chosen name, that player puts it into their hand. Otherwise, they put it into their graveyard and this artifact deals 2 damage to them.",
    ),
  );

  assert.ok(getRoleWeight(hallowedGroundProfile, "self_bounce") > 0);
  assert.ok(getRoleWeight(prismaticWardProfile, "targeted_protection") > 0);
  assert.ok(getRoleWeight(soulBarrierProfile, "group_slug") > 0);
  assert.ok(getRoleWeight(wordOfUndoingProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(leshracsSigilProfile, "hand_attack") > 0);
  assert.ok(getRoleWeight(hexProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(mindWhipProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(conquerProfile, "theft_support") > 0);
  assert.ok(getRoleWeight(curseProfile, "stax_piece") > 0);
  assert.ok(getRoleWeight(meltingProfile, "snow_support") > 0);
  assert.ok(getRoleWeight(mudslideProfile, "stax_piece") > 0);
  assert.ok(getRoleWeight(forgottenLoreProfile, "hand_recursion") > 0);
  assert.ok(getRoleWeight(snowblindProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(stuntedGrowthProfile, "hand_attack") > 0);
  assert.ok(getRoleWeight(stuntedGrowthProfile, "topdeck_control") > 0);
  assert.ok(getRoleWeight(ghostlyFlameProfile, "color_change") > 0);
  assert.ok(getRoleWeight(weatherVaneProfile, "snow_support") > 0);
  assert.ok(getRoleWeight(crownProfile, "attachment_support") > 0);
  assert.ok(getRoleWeight(arcanixProfile, "topdeck_control") > 0);
  assert.ok(getRoleWeight(arcanixProfile, "damage_engine") > 0);
});

test("inferAdvancedRoleProfile recognizes Homelands lock, poison, and delayed edict wording", () => {
  const leechesProfile = inferAdvancedRoleProfile(
    createCard("Leeches", "Sorcery", 3, "Target player loses all poison counters. Leeches deals that much damage to that player."),
  );
  const aetherStormProfile = inferAdvancedRoleProfile(
    createCard(
      "Aether Storm",
      "Enchantment",
      4,
      "Creature spells can't be cast. Pay 4 life: Destroy this enchantment. It can't be regenerated. Any player may activate this ability.",
    ),
  );
  const funeralMarchProfile = inferAdvancedRoleProfile(
    createCard(
      "Funeral March",
      "Enchantment - Aura",
      3,
      "Enchant creature. When enchanted creature leaves the battlefield, its controller sacrifices a creature of their choice.",
    ),
  );
  const ruinsProfile = inferAdvancedRoleProfile(
    createCard(
      "An-Zerrin Ruins",
      "Enchantment",
      4,
      "As this enchantment enters, choose a creature type. Creatures of the chosen type don't untap during their controllers' untap steps.",
    ),
  );
  const evaporateProfile = inferAdvancedRoleProfile(
    createCard("Evaporate", "Sorcery", 3, "Evaporate deals 1 damage to each white and/or blue creature."),
  );

  assert.ok(getRoleWeight(leechesProfile, "poison_hate") > 0);
  assert.ok(getRoleWeight(aetherStormProfile, "stax_piece") > 0);
  assert.ok(getRoleWeight(aetherStormProfile, "soft_stack") > 0);
  assert.ok(getRoleWeight(funeralMarchProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(ruinsProfile, "stax_piece") > 0);
  assert.ok(getRoleWeight(ruinsProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(evaporateProfile, "mass_removal") > 0);
});

test("inferAdvancedRoleProfile keeps Fallen Empires creature-only damage out of direct finishers", () => {
  const farrelsZealotProfile = inferAdvancedRoleProfile(
    createCard(
      "Farrel's Zealot",
      "Creature - Human",
      3,
      "Whenever this creature attacks and isn't blocked, you may have it deal 3 damage to target creature. If you do, this creature assigns no combat damage this turn.",
    ),
  );
  const dwarvenCatapultProfile = inferAdvancedRoleProfile(
    createCard(
      "Dwarven Catapult",
      "Instant",
      1,
      "Dwarven Catapult deals X damage divided evenly, rounded down, among all creatures target opponent controls.",
      { mana_cost: "{X}{R}" },
    ),
  );
  const blazeProfile = inferAdvancedRoleProfile(
    createCard("Blaze", "Sorcery", 1, "Blaze deals X damage to any target.", { mana_cost: "{X}{R}" }),
  );
  const fireballProfile = inferAdvancedRoleProfile(
    createCard(
      "Fireball",
      "Sorcery",
      1,
      "This spell costs {1} more to cast for each target beyond the first. Fireball deals X damage divided evenly, rounded down, among any number of targets.",
      { mana_cost: "{X}{R}" },
    ),
  );
  const fireCovenantProfile = inferAdvancedRoleProfile(
    createCard(
      "Fire Covenant",
      "Instant",
      3,
      "As an additional cost to cast this spell, pay X life. Fire Covenant deals X damage divided as you choose among any number of target creatures.",
    ),
  );

  assert.equal(getRoleWeight(farrelsZealotProfile, "direct_finisher"), 0);
  assert.equal(getRoleWeight(dwarvenCatapultProfile, "direct_finisher"), 0);
  assert.equal(getRoleWeight(fireCovenantProfile, "direct_finisher"), 0);
  assert.ok(getRoleWeight(dwarvenCatapultProfile, "removal") > 0);
  assert.ok(getRoleWeight(dwarvenCatapultProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(fireCovenantProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(blazeProfile, "direct_finisher") > 0);
  assert.ok(getRoleWeight(fireballProfile, "direct_finisher") > 0);
  assert.ok(getRoleWeight(fireballProfile, "targeted_removal") > 0);
});

test("inferAdvancedRoleProfile recognizes Alliances utility wording and avoids one-shot draw overtagging", () => {
  const carrierPigeonsProfile = inferAdvancedRoleProfile(
    createCard(
      "Carrier Pigeons",
      "Creature - Bird",
      4,
      "Flying When this creature enters, draw a card at the beginning of the next turn's upkeep.",
    ),
  );
  const hereticProfile = inferAdvancedRoleProfile(
    createCard(
      "Soldevi Heretic",
      "Creature - Human Cleric",
      3,
      "{W}, {T}: Prevent the next 2 damage that would be dealt to target creature this turn. Target opponent may draw a card.",
    ),
  );
  const diminishingProfile = inferAdvancedRoleProfile(
    createCard(
      "Diminishing Returns",
      "Sorcery",
      4,
      "Each player shuffles their hand and graveyard into their library. You exile the top ten cards of your library. Then each player draws up to seven cards.",
    ),
  );
  const martyrdomProfile = inferAdvancedRoleProfile(
    createCard(
      "Martyrdom",
      "Instant",
      3,
      'Until end of turn, target creature you control gains "{0}: The next 1 damage that would be dealt to target creature, planeswalker, or player this turn is dealt to this creature instead." Only you may activate this ability.',
    ),
  );
  const contagionProfile = inferAdvancedRoleProfile(
    createCard(
      "Contagion",
      "Instant",
      5,
      "You may pay 1 life and exile a black card from your hand rather than pay this spell's mana cost. Distribute two -2/-1 counters among one or two target creatures.",
    ),
  );
  const stenchProfile = inferAdvancedRoleProfile(
    createCard("Stench of Decay", "Instant", 3, "Nonartifact creatures get -1/-1 until end of turn."),
  );
  const bountyProfile = inferAdvancedRoleProfile(
    createCard(
      "Bounty of the Hunt",
      "Instant",
      5,
      "You may exile a green card from your hand rather than pay this spell's mana cost. Distribute three +1/+1 counters among one, two, or three target creatures.",
    ),
  );
  const castingProfile = inferAdvancedRoleProfile(
    createCard(
      "Casting of Bones",
      "Enchantment - Aura",
      3,
      "Enchant creature When enchanted creature dies, draw three cards, then discard one of them.",
    ),
  );
  const misinformationProfile = inferAdvancedRoleProfile(
    createCard("Misinformation", "Instant", 1, "Put up to three target cards from an opponent's graveyard on top of their library in any order."),
  );
  const winterNightProfile = inferAdvancedRoleProfile(
    createCard(
      "Winter's Night",
      "World Enchantment",
      3,
      "Whenever a player taps a snow land for mana, that player adds one mana of any type that land produced. That land doesn't untap during its controller's next untap step.",
    ),
  );
  const floodwaterProfile = inferAdvancedRoleProfile(
    createCard("Floodwater Dam", "Artifact", 3, "{X}{X}{1}, {T}: Tap X target lands."),
  );
  const compassProfile = inferAdvancedRoleProfile(
    createCard("Mystic Compass", "Artifact", 2, "{1}, {T}: Target land becomes the basic land type of your choice until end of turn."),
  );
  const diggerProfile = inferAdvancedRoleProfile(
    createCard("Soldevi Digger", "Artifact", 2, "{2}: Put the top card of your graveyard on the bottom of your library."),
  );
  const cauldronProfile = inferAdvancedRoleProfile(
    createCard(
      "Storm Cauldron",
      "Artifact",
      5,
      "Each player may play an additional land during each of their turns. Whenever a land is tapped for mana, return it to its owner's hand.",
    ),
  );

  assert.ok(getRoleWeight(carrierPigeonsProfile, "draw") > 0);
  assert.equal(getRoleWeight(carrierPigeonsProfile, "repeatable_draw"), 0);
  assert.equal(getRoleWeight(hereticProfile, "draw"), 0);
  assert.ok(getRoleWeight(hereticProfile, "targeted_protection") > 0);
  assert.ok(getRoleWeight(diminishingProfile, "draw") > 0);
  assert.ok(getRoleWeight(martyrdomProfile, "targeted_protection") > 0);
  assert.ok(getRoleWeight(contagionProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(contagionProfile, "counter_support") > 0);
  assert.ok(getRoleWeight(stenchProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(bountyProfile, "counter_support") > 0);
  assert.ok(getRoleWeight(castingProfile, "draw") > 0);
  assert.equal(getRoleWeight(castingProfile, "repeatable_draw"), 0);
  assert.ok(getRoleWeight(misinformationProfile, "topdeck_control") > 0);
  assert.ok(getRoleWeight(winterNightProfile, "snow_support") > 0);
  assert.ok(getRoleWeight(floodwaterProfile, "mana_denial") > 0);
  assert.ok(getRoleWeight(compassProfile, "land_type_change") > 0);
  assert.ok(getRoleWeight(diggerProfile, "library_recursion") > 0);
  assert.ok(getRoleWeight(cauldronProfile, "land_acceleration") > 0);
  assert.ok(getRoleWeight(cauldronProfile, "mana_denial") > 0);
});

test("inferAdvancedRoleProfile recognizes Celebration Card old wording", () => {
  const championProfile = inferAdvancedRoleProfile(
    createCard(
      "1996 World Champion",
      "Summon Legend",
      5,
      "Cannot be the target of spells or effects. World Champion has power and toughness equal to the life total of target opponent. {0}: Discard your hand to search your library for 1996 World Champion and reveal it to all players. Shuffle your library and put 1996 World Champion on top of it. Use this ability only at the beginning of your upkeep, and only if 1996 World Champion is in your library.",
    ),
  );
  const dragonProfile = inferAdvancedRoleProfile(
    createCard(
      "Shichifukujin Dragon",
      "Summon Dragon",
      9,
      "When Shichifukujin Dragon comes into play, put seven +1/+1 counters on it. {R}{R}{R}, Sacrifice two +1/+1 counters: Put three +1/+1 counters on Shichifukujin Dragon at end of turn. Play this ability as a sorcery.",
    ),
  );
  const robotProfile = inferAdvancedRoleProfile(
    createCard(
      "Robot Chicken",
      "Artifact Creature - Chicken Construct",
      4,
      "Whenever you cast a spell, put a 0/1 colorless Egg artifact creature token onto the battlefield. Whenever an Egg you control is put into a graveyard from the battlefield, destroy target artifact or creature.",
    ),
  );
  const debProfile = inferAdvancedRoleProfile(
    createCard(
      "Deb Thomas",
      "Legendary Planeswalker - Deb",
      4,
      "Whenever an Employee enters under your control, put a loyalty counter on Deb Thomas. +1: Create a 1/1 red Employee creature token. -X: Employees and Dogs you control get +X/+0 until end of turn.",
    ),
  );

  assert.ok(getRoleWeight(championProfile, "combat_body") > 0);
  assert.ok(getRoleWeight(championProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(championProfile, "self_protection") > 0);
  assert.ok(getRoleWeight(championProfile, "direct_tutor") > 0);
  assert.ok(getRoleWeight(dragonProfile, "combat_body") > 0);
  assert.ok(getRoleWeight(dragonProfile, "counter_support") > 0);
  assert.ok(getRoleWeight(robotProfile, "token_support") > 0);
  assert.ok(getRoleWeight(robotProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(debProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(debProfile, "token_support") > 0);
});

test("inferAdvancedRoleProfile recognizes Mirage utility wording and avoids compensation overtags", () => {
  const untapProfile = inferAdvancedRoleProfile(
    createCard("Alarum", "Instant", 2, "Untap target nonattacking creature. It gets +1/+3 until end of turn."),
  );
  const spellLockProfile = inferAdvancedRoleProfile(
    createCard(
      "Null Chamber",
      "World Enchantment",
      4,
      "As this enchantment enters, you and an opponent each choose a card name other than a basic land card name. Spells with the chosen names can't be cast and lands with the chosen names can't be played.",
    ),
  );
  const targetChangeProfile = inferAdvancedRoleProfile(
    createCard(
      "Meddle",
      "Instant",
      2,
      "If target spell has only one target and that target is a creature, change that spell's target to another creature.",
    ),
  );
  const theftProfile = inferAdvancedRoleProfile(
    createCard("Ashen Powder", "Sorcery", 4, "Put target creature card from an opponent's graveyard onto the battlefield under your control."),
  );
  const landRemovalProfile = inferAdvancedRoleProfile(
    createCard("Choking Sands", "Sorcery", 3, "Destroy target non-Swamp land. If that land was nonbasic, Choking Sands deals 2 damage to the land's controller."),
  );
  const smallSweeperProfile = inferAdvancedRoleProfile(
    createCard("Kaervek's Hex", "Sorcery", 4, "Kaervek's Hex deals 1 damage to each nonblack creature and an additional 1 damage to each green creature."),
  );
  const landUntapProfile = inferAdvancedRoleProfile(
    createCard("Early Harvest", "Instant", 3, "Target player untaps all basic lands they control."),
  );
  const colorDenialProfile = inferAdvancedRoleProfile(
    createCard(
      "Hall of Gemstone",
      "World Enchantment",
      3,
      "At the beginning of each player's upkeep, that player chooses a color. Until end of turn, lands tapped for mana produce mana of the chosen color instead of any other color.",
    ),
  );
  const exileRecursionProfile = inferAdvancedRoleProfile(
    createCard(
      "Purgatory",
      "Enchantment",
      4,
      "Whenever a nontoken creature is put into your graveyard from the battlefield, exile that card. At the beginning of your upkeep, you may pay {4} and 2 life. If you do, return a card exiled with this enchantment to the battlefield.",
    ),
  );
  const reflectionProfile = inferAdvancedRoleProfile(
    createCard(
      "Reflect Damage",
      "Instant",
      5,
      "The next time a source of your choice would deal damage this turn, that damage is dealt to that source's controller instead.",
    ),
  );
  const playerDamageProfile = inferAdvancedRoleProfile(
    createCard(
      "Misers' Cage",
      "Artifact",
      3,
      "At the beginning of each opponent's upkeep, if that player has five or more cards in hand, this artifact deals 2 damage to that player.",
    ),
  );
  const opponentDrawProfile = inferAdvancedRoleProfile(
    createCard(
      "Harbor Guardian",
      "Creature - Gargoyle",
      6,
      "Reach. Whenever this creature attacks, defending player may draw a card.",
    ),
  );
  const lifeSwapProfile = inferAdvancedRoleProfile(
    createCard(
      "Psychic Transfer",
      "Sorcery",
      5,
      "If the difference between your life total and target player's life total is 5 or less, exchange life totals with that player.",
    ),
  );
  const damageRemovalProfile = inferAdvancedRoleProfile(
    createCard("Spitting Earth", "Sorcery", 2, "Spitting Earth deals damage to target creature equal to the number of Mountains you control."),
  );
  const tokenCompensationProfile = inferAdvancedRoleProfile(
    createCard("Afterlife", "Instant", 3, "Destroy target nonblack creature. It can't be regenerated. Its controller creates a 1/1 white Spirit creature token with flying."),
  );
  const lifeCompensationProfile = inferAdvancedRoleProfile(
    createCard("Illumination", "Instant", 2, "Counter target artifact or enchantment spell. Its controller gains life equal to its mana value."),
  );

  assert.ok(getRoleWeight(untapProfile, "tap_untap") > 0);
  assert.ok(getRoleWeight(untapProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(spellLockProfile, "soft_stack") > 0);
  assert.ok(getRoleWeight(spellLockProfile, "stax_piece") > 0);
  assert.ok(getRoleWeight(targetChangeProfile, "broad_stack") > 0);
  assert.ok(getRoleWeight(theftProfile, "theft_support") > 0);
  assert.ok(getRoleWeight(landRemovalProfile, "targeted_land_removal") > 0);
  assert.ok(getRoleWeight(smallSweeperProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(landUntapProfile, "tap_untap") > 0);
  assert.ok(getRoleWeight(landUntapProfile, "ramp") > 0);
  assert.ok(getRoleWeight(colorDenialProfile, "mana_denial") > 0);
  assert.ok(getRoleWeight(exileRecursionProfile, "battlefield_recursion") > 0);
  assert.ok(getRoleWeight(reflectionProfile, "damage_reflection") > 0);
  assert.ok(getRoleWeight(playerDamageProfile, "damage_engine") > 0);
  assert.equal(getRoleWeight(opponentDrawProfile, "draw"), 0);
  assert.ok(getRoleWeight(lifeSwapProfile, "life_pressure") > 0);
  assert.ok(getRoleWeight(damageRemovalProfile, "targeted_removal") > 0);
  assert.equal(getRoleWeight(tokenCompensationProfile, "token_support"), 0);
  assert.equal(getRoleWeight(lifeCompensationProfile, "lifegain"), 0);
});

test("inferAdvancedRoleProfile recognizes Multiverse Gift Box wording without drawback overtags", () => {
  const peaceTalksProfile = inferAdvancedRoleProfile(
    createCard(
      "Peace Talks",
      "Sorcery",
      2,
      "This turn and next turn, creatures can't attack, and players and permanents can't be the targets of spells or activated abilities.",
    ),
  );
  const ovinomancerProfile = inferAdvancedRoleProfile(
    createCard(
      "Ovinomancer",
      "Creature - Human Wizard",
      3,
      "When this creature enters, sacrifice it unless you return three basic lands you control to their owner's hand. {T}, Return this creature to its owner's hand: Destroy target creature. It can't be regenerated. That creature's controller creates a 0/1 green Sheep creature token.",
    ),
  );
  const drawbackProfile = inferAdvancedRoleProfile(
    createCard(
      "Bull Elephant",
      "Creature - Elephant",
      4,
      "When this creature enters, sacrifice it unless you return two Forests you control to their owner's hand.",
    ),
  );

  assert.ok(getRoleWeight(peaceTalksProfile, "broad_protection") > 0);
  assert.ok(getRoleWeight(ovinomancerProfile, "targeted_removal") > 0);
  assert.equal(getRoleWeight(ovinomancerProfile, "token_support"), 0);
  assert.equal(getRoleWeight(ovinomancerProfile, "sacrifice_support"), 0);
  assert.equal(getRoleWeight(drawbackProfile, "sacrifice_support"), 0);
});

test("inferAdvancedRoleProfile recognizes Visions utility wording and avoids draw/drawback overtags", () => {
  const passageProfile = inferAdvancedRoleProfile(
    createCard(
      "Honorable Passage",
      "Instant",
      2,
      "The next time a source of your choice would deal damage to any target this turn, prevent that damage. If damage from a red source is prevented this way, Honorable Passage deals that much damage to the source's controller.",
    ),
  );
  const remedyProfile = inferAdvancedRoleProfile(
    createCard("Remedy", "Instant", 2, "Prevent the next 5 damage that would be dealt this turn to any number of targets, divided as you choose."),
  );
  const tidesProfile = inferAdvancedRoleProfile(
    createCard(
      "Dream Tides",
      "Enchantment",
      4,
      "Creatures don't untap during their controllers' untap steps. At the beginning of each player's upkeep, that player may choose any number of tapped nongreen creatures they control and pay {2} for each creature chosen this way. If the player does, untap those creatures.",
    ),
  );
  const phaseProfile = inferAdvancedRoleProfile(
    createCard("Time and Tide", "Instant", 2, "Simultaneously, all phased-out creatures phase in and all creatures with phasing phase out."),
  );
  const landTypeProfile = inferAdvancedRoleProfile(
    createCard("Blanket of Night", "Enchantment", 3, "Each land is a Swamp in addition to its other land types."),
  );
  const lairProfile = inferAdvancedRoleProfile(
    createCard(
      "Elkin Lair",
      "World Enchantment",
      4,
      "At the beginning of each player's upkeep, that player exiles a card at random from their hand. The player may play that card this turn. At the beginning of the next end step, if the player hasn't played the card, they put it into their graveyard.",
    ),
  );
  const mortalWoundProfile = inferAdvancedRoleProfile(
    createCard("Mortal Wound", "Enchantment - Aura", 1, "Enchant creature. When enchanted creature is dealt damage, destroy it."),
  );
  const summerBloomProfile = inferAdvancedRoleProfile(
    createCard("Summer Bloom", "Sorcery", 2, "You may play up to three additional lands this turn."),
  );
  const legacyProfile = inferAdvancedRoleProfile(
    createCard(
      "Suleiman's Legacy",
      "Enchantment",
      2,
      "When this enchantment enters, destroy all Djinns and Efreets. They can't be regenerated. Whenever a Djinn or Efreet enters, destroy it. It can't be regenerated.",
    ),
  );
  const denialProfile = inferAdvancedRoleProfile(
    createCard(
      "Wand of Denial",
      "Artifact",
      2,
      "{T}: Look at the top card of target player's library. If it's a nonland card, you may pay 2 life. If you do, put it into that player's graveyard.",
    ),
  );
  const replacementDrawProfile = inferAdvancedRoleProfile(
    createCard(
      "Breathstealer's Crypt",
      "Enchantment",
      4,
      "If a player would draw a card, instead they draw a card and reveal it. If it's a creature card, that player discards it unless they pay 3 life.",
    ),
  );
  const landDrawbackProfile = inferAdvancedRoleProfile(
    createCard(
      "Dormant Volcano",
      "Land",
      0,
      "This land enters tapped. When this land enters, sacrifice it unless you return an untapped Mountain you control to its owner's hand. {T}: Add {C}{R}.",
    ),
  );

  assert.ok(getRoleWeight(passageProfile, "damage_reflection") > 0);
  assert.ok(getRoleWeight(remedyProfile, "broad_protection") > 0);
  assert.ok(getRoleWeight(tidesProfile, "stax_piece") > 0);
  assert.ok(getRoleWeight(phaseProfile, "phase_support") > 0);
  assert.ok(getRoleWeight(landTypeProfile, "land_type_change") > 0);
  assert.ok(getRoleWeight(lairProfile, "hand_attack") > 0);
  assert.ok(getRoleWeight(mortalWoundProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(summerBloomProfile, "land_acceleration") > 0);
  assert.equal(getRoleWeight(summerBloomProfile, "stax_piece"), 0);
  assert.ok(getRoleWeight(legacyProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(denialProfile, "topdeck_control") > 0);
  assert.ok(getRoleWeight(denialProfile, "mill_support") > 0);
  assert.equal(getRoleWeight(replacementDrawProfile, "draw"), 0);
  assert.equal(getRoleWeight(landDrawbackProfile, "sacrifice_support"), 0);
});

test("inferAdvancedRoleProfile recognizes Astral Cards old random wording", () => {
  const aswanProfile = inferAdvancedRoleProfile(
    createCard(
      "Aswan Jaguar",
      "Creature - Cat",
      2,
      "When Aswan Jaguar comes into play, choose a random creature type from those in target opponent's deck. {G}{G}, {T}: Bury target creature of the chosen type.",
    ),
  );
  const graveProfile = inferAdvancedRoleProfile(
    createCard(
      "Call from the Grave",
      "Sorcery",
      3,
      "Put a random creature from a random graveyard into play under your control. Call from the Grave deals to you an amount of damage equal to that creature's casting cost.",
    ),
  );
  const polkaProfile = inferAdvancedRoleProfile(
    createCard(
      "Goblin Polka Band",
      "Creature - Goblin",
      3,
      "{2}, {T}, Pay {R} for each target: Tap any number of random target creatures. Goblins tapped in this way do not untap during their controllers' next untap phases.",
    ),
  );
  const azarProfile = inferAdvancedRoleProfile(
    createCard(
      "Necropolis of Azar",
      "Land",
      0,
      "Whenever a non-black creature is put into any graveyard from play, put a husk counter on Necropolis of Azar. {5}, Remove a husk counter from Necropolis of Azar: Put a Spawn of Azar token into play. Treat this token as a black creature with a random power and toughness, each no less than 1 and no greater than 3, that has swampwalk.",
    ),
  );
  const struggleProfile = inferAdvancedRoleProfile(
    createCard(
      "Power Struggle",
      "Enchantment",
      4,
      "During each player's upkeep, that player exchanges control of random target artifact, creature or land he or she controls, for control of random target permanent of the same type that a random opponent controls.",
    ),
  );
  const dragonProfile = inferAdvancedRoleProfile(
    createCard(
      "Prismatic Dragon",
      "Creature - Dragon",
      6,
      "Flying During your upkeep, Prismatic Dragon becomes a random color permanently. {2}: Prismatic Dragon becomes a random color permanently.",
    ),
  );
  const whimsyProfile = inferAdvancedRoleProfile(createCard("Whimsy", "Sorcery", 2, "Play X random fast effects."));
  const boxProfile = inferAdvancedRoleProfile(
    createCard(
      "Pandora's Box",
      "Artifact",
      5,
      "{3}, {T}: Choose a random summon card from all players' decks. For each player, flip a coin. If the flip ends up heads, put a token creature into play and treat it as though an exact copy of the chosen summon card were just played.",
    ),
  );

  assert.ok(getRoleWeight(aswanProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(graveProfile, "battlefield_recursion") > 0);
  assert.ok(getRoleWeight(graveProfile, "theft_support") > 0);
  assert.ok(getRoleWeight(polkaProfile, "tap_untap") > 0);
  assert.ok(getRoleWeight(azarProfile, "token_support") > 0);
  assert.ok(getRoleWeight(struggleProfile, "theft_support") > 0);
  assert.ok(getRoleWeight(struggleProfile, "donation_support") > 0);
  assert.ok(getRoleWeight(dragonProfile, "color_change") > 0);
  assert.ok(getRoleWeight(whimsyProfile, "random_effect") > 0);
  assert.ok(getRoleWeight(boxProfile, "token_support") > 0);
  assert.ok(getRoleWeight(boxProfile, "copy_support") > 0);
});

test("inferAdvancedRoleProfile recognizes Portal starter wording and avoids self-replacement death overtags", () => {
  const falsePeaceProfile = inferAdvancedRoleProfile(
    createCard("False Peace", "Sorcery", 1, "Target player skips all combat phases of their next turn."),
  );
  const truceProfile = inferAdvancedRoleProfile(
    createCard(
      "Temporary Truce",
      "Sorcery",
      2,
      "Each player may draw up to two cards. For each card less than two a player draws this way, that player gains 2 life.",
    ),
  );
  const cruelFateProfile = inferAdvancedRoleProfile(
    createCard(
      "Cruel Fate",
      "Sorcery",
      5,
      "Look at the top five cards of target opponent's library. Put one of those cards into that player's graveyard and the rest on top of their library in any order.",
    ),
  );
  const exhaustionProfile = inferAdvancedRoleProfile(
    createCard("Exhaustion", "Sorcery", 3, "Creatures and lands target opponent controls don't untap during their next untap step."),
  );
  const forkedLightningProfile = inferAdvancedRoleProfile(
    createCard("Forked Lightning", "Sorcery", 4, "Forked Lightning deals 4 damage divided as you choose among one, two, or three target creatures."),
  );
  const wickedPactProfile = inferAdvancedRoleProfile(
    createCard("Wicked Pact", "Sorcery", 3, "Destroy two target nonblack creatures. You lose 5 life."),
  );
  const rainProfile = inferAdvancedRoleProfile(createCard("Rain of Salt", "Sorcery", 6, "Destroy two target lands."));
  const alluringProfile = inferAdvancedRoleProfile(
    createCard("Alluring Scent", "Sorcery", 3, "All creatures able to block target creature this turn do so."),
  );
  const mobilizeProfile = inferAdvancedRoleProfile(createCard("Mobilize", "Sorcery", 1, "Untap all creatures you control."));
  const treetopProfile = inferAdvancedRoleProfile(
    createCard(
      "Treetop Defense",
      "Instant",
      2,
      "Cast this spell only during the declare attackers step and only if you've been attacked this step. Creatures you control gain reach until end of turn. (They can block creatures with flying.)",
    ),
  );
  const selfShuffleProfile = inferAdvancedRoleProfile(
    createCard("Alabaster Dragon", "Creature - Dragon", 6, "Flying When this creature dies, shuffle it into its owner's library.", {
      keywords: ["Flying"],
    }),
  );
  const selfReturnProfile = inferAdvancedRoleProfile(
    createCard("Endless Cockroaches", "Creature - Insect", 3, "When this creature dies, return it to its owner's hand."),
  );
  const selfTopProfile = inferAdvancedRoleProfile(
    createCard("Undying Beast", "Creature - Beast", 4, "When this creature dies, put it on top of its owner's library."),
  );

  assert.ok(getRoleWeight(falsePeaceProfile, "broad_protection") > 0);
  assert.ok(getRoleWeight(truceProfile, "card_draw") > 0);
  assert.ok(getRoleWeight(truceProfile, "group_hug") > 0);
  assert.ok(getRoleWeight(cruelFateProfile, "topdeck_control") > 0);
  assert.ok(getRoleWeight(cruelFateProfile, "mill_support") > 0);
  assert.ok(getRoleWeight(exhaustionProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(forkedLightningProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(wickedPactProfile, "removal") > 0);
  assert.ok(getRoleWeight(wickedPactProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(rainProfile, "targeted_land_removal") > 0);
  assert.ok(getRoleWeight(alluringProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(mobilizeProfile, "tap_untap") > 0);
  assert.ok(getRoleWeight(treetopProfile, "combat_support") > 0);
  assert.equal(getRoleWeight(selfShuffleProfile, "sacrifice_support"), 0);
  assert.equal(getRoleWeight(selfReturnProfile, "sacrifice_support"), 0);
  assert.equal(getRoleWeight(selfTopProfile, "sacrifice_support"), 0);
});

test("inferAdvancedRoleProfile recognizes Vanguard global emblem-style text", () => {
  const mirriProfile = inferAdvancedRoleProfile(
    createCard("Mirri", "Vanguard", 0, "If a basic land you control is tapped for mana, it produces mana of a color of your choice instead of any other type."),
  );
  const squeeProfile = inferAdvancedRoleProfile(createCard("Squee", "Vanguard", 0, "Your opponents play with their hands revealed."));
  const grevenProfile = inferAdvancedRoleProfile(
    createCard(
      "Greven il-Vec",
      "Vanguard",
      0,
      "Whenever a creature you control deals damage to a creature, destroy the other creature. It can't be regenerated.",
    ),
  );
  const orimProfile = inferAdvancedRoleProfile(createCard("Orim", "Vanguard", 0, "Creatures you control have reach."));
  const volrathProfile = inferAdvancedRoleProfile(
    createCard(
      "Volrath",
      "Vanguard",
      0,
      "Whenever a creature you control is put into your graveyard from the battlefield, you may put it on top of your library.",
    ),
  );
  const eladamriProfile = inferAdvancedRoleProfile(
    createCard("Eladamri", "Vanguard", 0, "{0}: The next 1 damage that would be dealt to target creature you control is dealt to you instead."),
  );
  const lynaProfile = inferAdvancedRoleProfile(
    createCard("Lyna", "Vanguard", 0, "Creatures you control have shadow. (They can block and be blocked only by creatures with shadow.)"),
  );
  const ashnodProfile = inferAdvancedRoleProfile(createCard("Ashnod", "Vanguard", 0, "Whenever a creature deals damage to you, destroy it."));

  assert.ok(getRoleWeight(mirriProfile, "mana_fixing") > 0);
  assert.ok(getRoleWeight(squeeProfile, "hand_info") > 0);
  assert.ok(getRoleWeight(grevenProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(orimProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(volrathProfile, "library_recursion") > 0);
  assert.ok(getRoleWeight(eladamriProfile, "targeted_protection") > 0);
  assert.ok(getRoleWeight(lynaProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(ashnodProfile, "targeted_removal") > 0);
});

test("inferAdvancedRoleProfile recognizes Weatherlight enchantment and artifact utility gaps", () => {
  const aetherFlashProfile = inferAdvancedRoleProfile(
    createCard("Aether Flash", "Enchantment", 4, "Whenever a creature enters, this enchantment deals 2 damage to it."),
  );
  const heatStrokeProfile = inferAdvancedRoleProfile(
    createCard("Heat Stroke", "Enchantment", 3, "At end of combat, destroy each creature that blocked or was blocked this turn."),
  );
  const callProfile = inferAdvancedRoleProfile(
    createCard(
      "Call of the Wild",
      "Enchantment",
      4,
      "{2}{G}{G}: Reveal the top card of your library. If it's a creature card, put it onto the battlefield. Otherwise, put it into your graveyard.",
    ),
  );
  const denseProfile = inferAdvancedRoleProfile(createCard("Dense Foliage", "Enchantment", 3, "Creatures can't be the targets of spells."));
  const matrixProfile = inferAdvancedRoleProfile(createCard("Bubble Matrix", "Artifact", 4, "Prevent all damage that would be dealt to creatures."));
  const bannerProfile = inferAdvancedRoleProfile(
    createCard(
      "Jabari's Banner",
      "Artifact",
      2,
      "{1}, {T}: Target creature gains flanking until end of turn. (Whenever a creature without flanking blocks this creature, the blocking creature gets -1/-1 until end of turn.)",
    ),
  );
  const webProfile = inferAdvancedRoleProfile(
    createCard(
      "Mana Web",
      "Artifact",
      3,
      "Whenever a land an opponent controls is tapped for mana, tap all lands that player controls that could produce any type of mana that land could produce.",
    ),
  );
  const renewalProfile = inferAdvancedRoleProfile(
    createCard(
      "Angelic Renewal",
      "Enchantment",
      2,
      "Whenever a creature is put into your graveyard from the battlefield, you may sacrifice this enchantment. If you do, return that card to the battlefield.",
    ),
  );
  const ancestralProfile = inferAdvancedRoleProfile(
    createCard(
      "Ancestral Knowledge",
      "Enchantment",
      2,
      "Cumulative upkeep {1}. When this enchantment enters, look at the top ten cards of your library, then exile any number of them and put the rest back on top of your library in any order. When this enchantment leaves the battlefield, shuffle your library.",
    ),
  );
  const waveProfile = inferAdvancedRoleProfile(
    createCard(
      "Wave of Terror",
      "Enchantment",
      3,
      "Cumulative upkeep {1}. At the beginning of your draw step, destroy each creature with mana value equal to the number of age counters on this enchantment. They can't be regenerated.",
    ),
  );
  const firestormProfile = inferAdvancedRoleProfile(
    createCard("Firestorm", "Instant", 1, "As an additional cost to cast this spell, discard X cards. This spell deals X damage to each of X targets."),
  );
  const dingusProfile = inferAdvancedRoleProfile(
    createCard("Dingus Staff", "Artifact", 4, "Whenever a creature dies, this artifact deals 2 damage to that creature's controller."),
  );
  const nullRodProfile = inferAdvancedRoleProfile(createCard("Null Rod", "Artifact", 2, "Activated abilities of artifacts can't be activated."));

  assert.ok(getRoleWeight(aetherFlashProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(heatStrokeProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(callProfile, "cheat_into_play") > 0);
  assert.ok(getRoleWeight(denseProfile, "broad_protection") > 0);
  assert.ok(getRoleWeight(matrixProfile, "broad_protection") > 0);
  assert.ok(getRoleWeight(bannerProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(webProfile, "mana_denial") > 0);
  assert.ok(getRoleWeight(renewalProfile, "battlefield_recursion") > 0);
  assert.ok(getRoleWeight(ancestralProfile, "card_selection") > 0);
  assert.equal(getRoleWeight(ancestralProfile, "sacrifice_support"), 0);
  assert.ok(getRoleWeight(waveProfile, "mass_removal") > 0);
  assert.equal(getRoleWeight(waveProfile, "sacrifice_support"), 0);
  assert.ok(getRoleWeight(firestormProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(dingusProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(nullRodProfile, "hate_piece") > 0);
});

test("inferAdvancedRoleProfile recognizes Tempest utility wording gaps", () => {
  const circleProfile = inferAdvancedRoleProfile(
    createCard("Circle of Protection: Shadow", "Enchantment", 2, "{1}: The next time a creature of your choice with shadow would deal damage to you this turn, prevent that damage."),
  );
  const humilityProfile = inferAdvancedRoleProfile(createCard("Humility", "Enchantment", 4, "All creatures lose all abilities and have base power and toughness 1/1."));
  const repentanceProfile = inferAdvancedRoleProfile(createCard("Repentance", "Sorcery", 3, "Target creature deals damage to itself equal to its power."));
  const precognitionProfile = inferAdvancedRoleProfile(
    createCard(
      "Precognition",
      "Enchantment",
      5,
      "At the beginning of your upkeep, you may look at the top card of target opponent's library. If you do, you may put that card on the bottom of that player's library.",
    ),
  );
  const stealProfile = inferAdvancedRoleProfile(createCard("Steal Enchantment", "Enchantment - Aura", 2, "Enchant enchantment You control enchanted enchantment."));
  const dauthiProfile = inferAdvancedRoleProfile(createCard("Dauthi Embrace", "Enchantment", 3, "{B}{B}: Target creature gains shadow until end of turn."));
  const pitsProfile = inferAdvancedRoleProfile(createCard("Death Pits of Rath", "Enchantment", 5, "Whenever a creature is dealt damage, destroy it. It can't be regenerated."));
  const nightProfile = inferAdvancedRoleProfile(createCard("Dread of Night", "Enchantment", 1, "White creatures get -1/-1."));
  const havocProfile = inferAdvancedRoleProfile(createCard("Havoc", "Enchantment", 2, "Whenever an opponent casts a white spell, they lose 2 life."));
  const noQuarterProfile = inferAdvancedRoleProfile(
    createCard(
      "No Quarter",
      "Enchantment",
      4,
      "Whenever a creature becomes blocked by a creature with lesser power, destroy the blocking creature. Whenever a creature blocks a creature with lesser power, destroy the attacking creature.",
    ),
  );
  const revoltProfile = inferAdvancedRoleProfile(createCard("Nature's Revolt", "Enchantment", 5, "All lands are 2/2 creatures that are still lands."));
  const grimoireProfile = inferAdvancedRoleProfile(
    createCard("Phyrexian Grimoire", "Artifact - Book", 3, "{4}, {T}: Target opponent chooses one of the top two cards of your graveyard. Exile that card and put the other one into your hand."),
  );
  const splicerProfile = inferAdvancedRoleProfile(
    createCard(
      "Phyrexian Splicer",
      "Artifact",
      2,
      "{2}, {T}, Choose flying, first strike, trample, or shadow: Until end of turn, target creature with the chosen ability loses it and another target creature gains it.",
    ),
  );
  const convulsionsProfile = inferAdvancedRoleProfile(createCard("Fevered Convulsions", "Enchantment", 4, "{2}{B}{B}: Put a -1/-1 counter on target creature."));
  const trapProfile = inferAdvancedRoleProfile(
    createCard(
      "Booby Trap",
      "Artifact",
      6,
      "As this artifact enters, choose an opponent and a card name other than a basic land card name. The chosen player reveals each card they draw. When the chosen player draws a card with the chosen name, sacrifice this artifact. If you do, this artifact deals 10 damage to that player.",
    ),
  );
  const storageProfile = inferAdvancedRoleProfile(
    createCard("Cold Storage", "Artifact", 4, "{3}: Exile target creature you control. Sacrifice this artifact: Return each creature card exiled with this artifact to the battlefield under your control."),
  );
  const rackProfile = inferAdvancedRoleProfile(
    createCard(
      "Scroll Rack",
      "Artifact",
      2,
      "{1}, {T}: Exile any number of cards from your hand face down. Put that many cards from the top of your library into your hand. Then look at the exiled cards and put them on top of your library in any order.",
    ),
  );

  assert.ok(getRoleWeight(circleProfile, "protection") > 0);
  assert.ok(getRoleWeight(humilityProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(repentanceProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(precognitionProfile, "topdeck_control") > 0);
  assert.ok(getRoleWeight(stealProfile, "theft_support") > 0);
  assert.ok(getRoleWeight(dauthiProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(pitsProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(nightProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(havocProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(noQuarterProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(revoltProfile, "land_animation") > 0);
  assert.ok(getRoleWeight(grimoireProfile, "hand_recursion") > 0);
  assert.ok(getRoleWeight(splicerProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(convulsionsProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(trapProfile, "direct_finisher") > 0);
  assert.ok(getRoleWeight(storageProfile, "battlefield_recursion") > 0);
  assert.ok(getRoleWeight(rackProfile, "card_selection") > 0);
});

test("inferAdvancedRoleProfile recognizes Stronghold utility wording gaps", () => {
  const sacredGroundProfile = inferAdvancedRoleProfile(
    createCard(
      "Sacred Ground",
      "Enchantment",
      2,
      "Whenever a spell or ability an opponent controls causes a land to be put into your graveyard from the battlefield, return that card to the battlefield.",
    ),
  );
  const blessingProfile = inferAdvancedRoleProfile(
    createCard(
      "Samite Blessing",
      "Enchantment - Aura",
      2,
      "Enchant creature Enchanted creature has \"{T}: The next time a source of your choice would deal damage to target creature this turn, prevent that damage.\"",
    ),
  );
  const dreamProfile = inferAdvancedRoleProfile(
    createCard("Dream Halls", "Enchantment", 5, "Rather than pay the mana cost for a spell, its controller may discard a card that shares a color with that spell."),
  );
  const pitProfile = inferAdvancedRoleProfile(createCard("Bottomless Pit", "Enchantment", 3, "At the beginning of each player's upkeep, that player discards a card at random."));
  const megrimProfile = inferAdvancedRoleProfile(createCard("Megrim", "Enchantment", 3, "Whenever an opponent discards a card, this enchantment deals 2 damage to that player."));
  const mortuaryProfile = inferAdvancedRoleProfile(
    createCard("Mortuary", "Enchantment", 4, "Whenever a creature is put into your graveyard from the battlefield, put that card on top of your library."),
  );
  const heatProfile = inferAdvancedRoleProfile(createCard("Heat of Battle", "Enchantment", 2, "Whenever a creature blocks, this enchantment deals 1 damage to that creature's controller."));
  const plansProfile = inferAdvancedRoleProfile(createCard("Invasion Plans", "Enchantment", 3, "All creatures block each combat if able. The attacking player chooses how each creature blocks each combat."));
  const awakeningProfile = inferAdvancedRoleProfile(createCard("Awakening", "Enchantment", 4, "At the beginning of each upkeep, untap all creatures and lands."));
  const touchProfile = inferAdvancedRoleProfile(
    createCard("Verdant Touch", "Sorcery", 2, "Buyback {3}. Target land becomes a 2/2 creature that's still a land. This effect lasts indefinitely."),
  );
  const portcullisProfile = inferAdvancedRoleProfile(
    createCard(
      "Portcullis",
      "Artifact",
      4,
      "Whenever a creature enters, if there are two or more other creatures on the battlefield, exile that creature. Return that card to the battlefield under its owner's control when this artifact leaves the battlefield.",
    ),
  );
  const nomadsProfile = inferAdvancedRoleProfile(
    createCard("Nomads en-Kor", "Creature - Kor Nomad Soldier", 1, "{0}: The next 1 damage that would be dealt to this creature this turn is dealt to target creature you control instead."),
  );
  const scapegoatProfile = inferAdvancedRoleProfile(
    createCard("Scapegoat", "Instant", 1, "As an additional cost to cast this spell, sacrifice a creature. Return any number of target creatures you control to their owner's hand."),
  );
  const hesitationProfile = inferAdvancedRoleProfile(createCard("Hesitation", "Enchantment", 2, "When a player casts a spell, sacrifice this enchantment and counter that spell."));
  const basiliskProfile = inferAdvancedRoleProfile(
    createCard("Lowland Basilisk", "Creature - Basilisk", 3, "Whenever this creature deals damage to a creature, destroy that creature at end of combat."),
  );
  const hibernationProfile = inferAdvancedRoleProfile(
    createCard("Hibernation Sliver", "Creature - Sliver", 2, "All Slivers have \"Pay 2 life: Return this permanent to its owner's hand.\""),
  );

  assert.ok(getRoleWeight(sacredGroundProfile, "battlefield_recursion") > 0);
  assert.ok(getRoleWeight(blessingProfile, "targeted_protection") > 0);
  assert.ok(getRoleWeight(dreamProfile, "cost_reduction") > 0);
  assert.ok(getRoleWeight(pitProfile, "hand_attack") > 0);
  assert.ok(getRoleWeight(megrimProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(mortuaryProfile, "library_recursion") > 0);
  assert.ok(getRoleWeight(heatProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(plansProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(awakeningProfile, "stable_ramp") > 0);
  assert.ok(getRoleWeight(touchProfile, "land_animation") > 0);
  assert.ok(getRoleWeight(portcullisProfile, "hate_piece") > 0);
  assert.ok(getRoleWeight(nomadsProfile, "targeted_protection") > 0);
  assert.ok(getRoleWeight(scapegoatProfile, "rescue_protection") > 0);
  assert.ok(getRoleWeight(hesitationProfile, "hard_stack") > 0);
  assert.ok(getRoleWeight(basiliskProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(hibernationProfile, "rescue_protection") > 0);
});

test("inferAdvancedRoleProfile recognizes Exodus utility wording gaps", () => {
  const highGroundProfile = inferAdvancedRoleProfile(createCard("High Ground", "Enchantment", 1, "Each creature you control can block an additional creature each combat."));
  const chantProfile = inferAdvancedRoleProfile(
    createCard(
      "Kor Chant",
      "Instant",
      3,
      "All damage that would be dealt this turn to target creature you control by a source of your choice is dealt to another target creature instead.",
    ),
  );
  const penanceProfile = inferAdvancedRoleProfile(
    createCard(
      "Penance",
      "Enchantment",
      3,
      "Put a card from your hand on top of your library: The next time a black or red source of your choice would deal damage this turn, prevent that damage.",
    ),
  );
  const fadeProfile = inferAdvancedRoleProfile(
    createCard("Fade Away", "Sorcery", 3, "For each creature, its controller sacrifices a permanent of their choice unless they pay {1}."),
  );
  const breachProfile = inferAdvancedRoleProfile(
    createCard("Mana Breach", "Enchantment", 3, "Whenever a player casts a spell, that player returns a land they control to its owner's hand."),
  );
  const hatredProfile = inferAdvancedRoleProfile(
    createCard("Hatred", "Instant", 5, "As an additional cost to cast this spell, pay X life. Target creature gets +X/+0 until end of turn."),
  );
  const ghoulsProfile = inferAdvancedRoleProfile(
    createCard(
      "Oath of Ghouls",
      "Enchantment",
      2,
      "At the beginning of each player's upkeep, that player chooses target player whose graveyard has fewer creature cards in it than their graveyard does and is their opponent. The first player may return a creature card from their graveyard to their hand.",
    ),
  );
  const dungeonProfile = inferAdvancedRoleProfile(
    createCard(
      "Volrath's Dungeon",
      "Enchantment",
      4,
      "Pay 5 life: Destroy this enchantment. Any player may activate this ability but only during their turn. Discard a card: Target player puts a card from their hand on top of their library. Activate only as a sorcery.",
    ),
  );
  const magesProfile = inferAdvancedRoleProfile(
    createCard(
      "Oath of Mages",
      "Enchantment",
      2,
      "At the beginning of each player's upkeep, that player chooses target player who has more life than they do and is their opponent. The first player may have this enchantment deal 1 damage to the second player.",
    ),
  );
  const spellshockProfile = inferAdvancedRoleProfile(createCard("Spellshock", "Enchantment", 3, "Whenever a player casts a spell, this enchantment deals 2 damage to that player."));
  const druidsProfile = inferAdvancedRoleProfile(
    createCard(
      "Oath of Druids",
      "Enchantment",
      2,
      "At the beginning of each player's upkeep, that player chooses target player who controls more creatures than they do and is their opponent. The first player may reveal cards from the top of their library until they reveal a creature card. If the first player does, that player puts that card onto the battlefield and all other cards revealed this way into their graveyard.",
    ),
  );
  const crystalProfile = inferAdvancedRoleProfile(createCard("Memory Crystal", "Artifact", 3, "Buyback costs cost {2} less."));

  assert.ok(getRoleWeight(highGroundProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(chantProfile, "targeted_protection") > 0);
  assert.ok(getRoleWeight(penanceProfile, "protection") > 0);
  assert.ok(getRoleWeight(fadeProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(breachProfile, "mana_denial") > 0);
  assert.ok(getRoleWeight(hatredProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(ghoulsProfile, "hand_recursion") > 0);
  assert.ok(getRoleWeight(dungeonProfile, "hand_attack") > 0);
  assert.ok(getRoleWeight(magesProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(spellshockProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(druidsProfile, "cheat_into_play") > 0);
  assert.ok(getRoleWeight(crystalProfile, "cost_reduction") > 0);
});

test("inferAdvancedRoleProfile recognizes Portal Second Age utility wording gaps", () => {
  const piracyProfile = inferAdvancedRoleProfile(
    createCard("Piracy", "Sorcery", 2, "Until end of turn, you may tap lands you don't control for mana. Spend this mana only to cast spells."),
  );
  const warCryProfile = inferAdvancedRoleProfile(
    createCard("Goblin War Cry", "Sorcery", 3, "Target opponent chooses a creature they control. Other creatures they control can't block this turn."),
  );
  const lightningProfile = inferAdvancedRoleProfile(createCard("Jagged Lightning", "Sorcery", 5, "Jagged Lightning deals 3 damage to each of two target creatures."));

  assert.ok(getRoleWeight(piracyProfile, "burst_ramp") > 0);
  assert.ok(getRoleWeight(warCryProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(lightningProfile, "targeted_removal") > 0);
});

test("inferAdvancedRoleProfile recognizes Unglued utility wording gaps", () => {
  const getALifeProfile = inferAdvancedRoleProfile(createCard("Get a Life", "Instant", 1, "Target player and each of that player's teammates exchange life totals."));
  const dciProfile = inferAdvancedRoleProfile(
    createCard(
      "Look at Me, I'm the DCI",
      "Sorcery",
      7,
      "Ban a card other than a basic land card for the rest of the match. (All cards with that name in any zone or sideboard are removed from the match.)",
    ),
  );
  const censorshipProfile = inferAdvancedRoleProfile(
    createCard("Censorship", "Enchantment", 1, "As this enchantment enters, choose a word. Whenever a player says the chosen word, this enchantment deals 2 damage to that player."),
  );
  const checksProfile = inferAdvancedRoleProfile(
    createCard(
      "Checks and Balances",
      "Enchantment",
      3,
      "Cast this spell only if there are three or more players in the game. Whenever a player casts a spell, each of that player's opponents may discard a card. If they do, counter that spell.",
    ),
  );
  const deniedProfile = inferAdvancedRoleProfile(
    createCard("Denied!", "Instant", 1, "Choose a card name, then target spell's controller reveals their hand. If a card with the chosen name is revealed this way, counter that spell."),
  );
  const networkProfile = inferAdvancedRoleProfile(
    createCard("Psychic Network", "Enchantment", 1, "Each player plays with the top card of their library held against their forehead, revealed to each other player."),
  );
  const sorryProfile = inferAdvancedRoleProfile(
    createCard(
      "Sorry",
      "Enchantment",
      2,
      "Before any player casts a spell with the same name as a card in any graveyard, that player may say \"sorry.\" If they don't, any other player may say \"sorry\" as the spell is being cast. When another player says \"sorry\" this way, counter the spell. Whenever a player says \"sorry\" at any other time, Sorry deals 2 damage to that player.",
    ),
  );
  const doubleCrossProfile = inferAdvancedRoleProfile(
    createCard(
      "Double Cross",
      "Sorcery",
      5,
      "Choose another player. Look at that player's hand and choose a card other than a basic land card from it. They discard that card.",
    ),
  );
  const owProfile = inferAdvancedRoleProfile(
    createCard("Ow", "Enchantment", 1, "Whenever a creature deals damage to a player, that player may say \"Ow\". If the player doesn't, this enchantment deals 1 damage to them."),
  );
  const confettiProfile = inferAdvancedRoleProfile(
    createCard("Chaos Confetti", "Artifact", 4, "{4}, {T}: Tear this artifact into pieces. Destroy each permanent that a piece touches."),
  );

  assert.ok(getRoleWeight(getALifeProfile, "life_pressure") > 0);
  assert.ok(getRoleWeight(dciProfile, "removal") > 0);
  assert.ok(getRoleWeight(censorshipProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(checksProfile, "soft_stack") > 0);
  assert.ok(getRoleWeight(deniedProfile, "soft_stack") > 0);
  assert.ok(getRoleWeight(networkProfile, "topdeck_info") > 0);
  assert.ok(getRoleWeight(sorryProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(doubleCrossProfile, "hand_attack") > 0);
  assert.ok(getRoleWeight(owProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(confettiProfile, "removal") > 0);
});

test("inferAdvancedRoleProfile recognizes Urza's Saga utility wording gaps", () => {
  const opalProfile = inferAdvancedRoleProfile(
    createCard("Opal Archangel", "Enchantment", 5, "When an opponent casts a creature spell, if this permanent is an enchantment, it becomes a 5/5 Angel creature with flying and vigilance."),
  );
  const curfewProfile = inferAdvancedRoleProfile(createCard("Curfew", "Instant", 1, "Each player returns a creature they control to its owner's hand."));
  const showProfile = inferAdvancedRoleProfile(createCard("Show and Tell", "Sorcery", 3, "Each player may put an artifact, creature, enchantment, or land card from their hand onto the battlefield."));
  const turnaboutProfile = inferAdvancedRoleProfile(
    createCard("Turnabout", "Instant", 4, "Choose artifact, creature, or land. Tap all untapped permanents of the chosen type target player controls, or untap all tapped permanents of that type that player controls."),
  );
  const darkestProfile = inferAdvancedRoleProfile(createCard("Darkest Hour", "Enchantment", 1, "All creatures are black."));
  const oppressionProfile = inferAdvancedRoleProfile(createCard("Oppression", "Enchantment", 3, "Whenever a player casts a spell, that player discards a card."));
  const voidProfile = inferAdvancedRoleProfile(createCard("Planar Void", "Enchantment", 1, "Whenever another card is put into a graveyard from anywhere, exile that card."));
  const aetherProfile = inferAdvancedRoleProfile(createCard("Tainted Aether", "Enchantment", 4, "Whenever a creature enters, its controller sacrifices a creature or land of their choice."));
  const soilProfile = inferAdvancedRoleProfile(createCard("Acidic Soil", "Sorcery", 3, "Acidic Soil deals damage to each player equal to the number of lands they control."));
  const lightningProfile = inferAdvancedRoleProfile(createCard("Arc Lightning", "Sorcery", 3, "Arc Lightning deals 3 damage divided as you choose among one, two, or three targets."));
  const falterProfile = inferAdvancedRoleProfile(createCard("Falter", "Instant", 2, "Creatures without flying can't block this turn."));
  const scaldProfile = inferAdvancedRoleProfile(createCard("Scald", "Enchantment", 2, "Whenever a player taps an Island for mana, this enchantment deals 1 damage to that player."));
  const crosswindsProfile = inferAdvancedRoleProfile(createCard("Crosswinds", "Enchantment", 2, "Creatures with flying get -2/-0."));
  const fangsProfile = inferAdvancedRoleProfile(createCard("Venomous Fangs", "Enchantment — Aura", 3, "Enchant creature Whenever enchanted creature deals damage to a creature, destroy the other creature."));
  const scalesProfile = inferAdvancedRoleProfile(
    createCard("Noetic Scales", "Artifact", 4, "At the beginning of each player's upkeep, return to its owner's hand each creature that player controls with power greater than the number of cards in their hand."),
  );
  const scytheProfile = inferAdvancedRoleProfile(
    createCard("Purging Scythe", "Artifact", 5, "At the beginning of your upkeep, this artifact deals 2 damage to the creature with the least toughness."),
  );
  const armorProfile = inferAdvancedRoleProfile(createCard("Urza's Armor", "Artifact", 6, "If a source would deal damage to you, prevent 1 of that damage."));

  assert.ok(getRoleWeight(opalProfile, "animation_effect") > 0);
  assert.ok(getRoleWeight(curfewProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(showProfile, "cost_reduction") > 0);
  assert.ok(getRoleWeight(turnaboutProfile, "tap_untap") > 0);
  assert.ok(getRoleWeight(darkestProfile, "color_change") > 0);
  assert.ok(getRoleWeight(oppressionProfile, "hand_attack") > 0);
  assert.ok(getRoleWeight(voidProfile, "graveyard_hate") > 0);
  assert.ok(getRoleWeight(aetherProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(soilProfile, "direct_finisher") > 0);
  assert.ok(getRoleWeight(lightningProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(falterProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(scaldProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(crosswindsProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(fangsProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(scalesProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(scytheProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(armorProfile, "protection") > 0);
});

test("inferAdvancedRoleProfile recognizes Urza's Legacy utility wording gaps", () => {
  const hopeProfile = inferAdvancedRoleProfile(createCard("Hope and Glory", "Instant", 2, "Untap two target creatures. Each of them gets +1/+1 until end of turn."));
  const slowProfile = inferAdvancedRoleProfile(
    createCard(
      "Slow Motion",
      "Enchantment — Aura",
      3,
      "Enchant creature At the beginning of the upkeep of enchanted creature's controller, that player sacrifices that creature unless they pay {2}. When this Aura is put into a graveyard from the battlefield, return it to its owner's hand.",
    ),
  );
  const plagueProfile = inferAdvancedRoleProfile(createCard("Engineered Plague", "Enchantment", 3, "As this enchantment enters, choose a creature type. All creatures of the chosen type get -1/-1."));
  const sickProfile = inferAdvancedRoleProfile(createCard("Sick and Tired", "Instant", 3, "Two target creatures each get -1/-1 until end of turn."));
  const linkProfile = inferAdvancedRoleProfile(createCard("Treacherous Link", "Enchantment — Aura", 2, "Enchant creature All damage that would be dealt to enchanted creature is dealt to its controller instead."));
  const pyroProfile = inferAdvancedRoleProfile(createCard("Pyromancy", "Enchantment", 4, "{3}, Discard a card at random: This enchantment deals damage to any target equal to the mana value of the discarded card."));
  const convergenceProfile = inferAdvancedRoleProfile(createCard("Harmonic Convergence", "Instant", 3, "Put all enchantments on top of their owners' libraries."));
  const lensProfile = inferAdvancedRoleProfile(createCard("Thran Lens", "Artifact", 2, "All permanents are colorless."));

  assert.ok(getRoleWeight(hopeProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(slowProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(plagueProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(sickProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(linkProfile, "damage_reflection") > 0);
  assert.ok(getRoleWeight(pyroProfile, "targeted_removal") > 0);
  assert.ok(getRoleWeight(convergenceProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(lensProfile, "color_change") > 0);
});

test("inferAdvancedRoleProfile recognizes Portal Three Kingdoms utility wording gaps", () => {
  const damProfile = inferAdvancedRoleProfile(createCard("Broken Dam", "Sorcery", 1, "Tap one or two target creatures without horsemanship."));
  const edictProfile = inferAdvancedRoleProfile(createCard("Imperial Edict", "Sorcery", 2, "Target opponent chooses a creature they control. Destroy that creature."));

  assert.ok(getRoleWeight(damProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(edictProfile, "targeted_removal") > 0);
});

test("inferAdvancedRoleProfile recognizes Urza's Destiny utility wording gaps", () => {
  const opalescenceProfile = inferAdvancedRoleProfile(
    createCard("Opalescence", "Enchantment", 4, "Each other non-Aura enchantment is a creature in addition to its other types and has base power and base toughness each equal to its mana value."),
  );
  const disappearProfile = inferAdvancedRoleProfile(createCard("Disappear", "Enchantment — Aura", 4, "Enchant creature {U}: Return enchanted creature and this Aura to their owners' hands."));
  const fatigueProfile = inferAdvancedRoleProfile(createCard("Fatigue", "Sorcery", 2, "Target player skips their next draw step."));
  const carnivalProfile = inferAdvancedRoleProfile(createCard("Carnival of Souls", "Enchantment", 2, "Whenever a creature enters, you lose 1 life and add {B}."));
  const stingProfile = inferAdvancedRoleProfile(createCard("Aether Sting", "Enchantment", 4, "Whenever an opponent casts a creature spell, this enchantment deals 1 damage to that player."));
  const repercussionProfile = inferAdvancedRoleProfile(createCard("Repercussion", "Enchantment", 3, "Whenever a creature is dealt damage, this enchantment deals that much damage to that creature's controller."));
  const saltProfile = inferAdvancedRoleProfile(
    createCard("Sowing Salt", "Sorcery", 4, "Exile target nonbasic land. Search its controller's graveyard, hand, and library for all cards with the same name as that land and exile them. Then that player shuffles."),
  );
  const plowProfile = inferAdvancedRoleProfile(createCard("Plow Under", "Sorcery", 5, "Put two target lands on top of their owners' libraries."));
  const matrixProfile = inferAdvancedRoleProfile(
    createCard(
      "Storage Matrix",
      "Artifact",
      3,
      "As long as this artifact is untapped, each player chooses artifact, creature, or land during their untap step. That player can untap only permanents of the chosen type this step.",
    ),
  );
  const foundryProfile = inferAdvancedRoleProfile(createCard("Thran Foundry", "Artifact", 1, "{1}, {T}, Exile this artifact: Target player shuffles their graveyard into their library."));

  assert.ok(getRoleWeight(opalescenceProfile, "animation_effect") > 0);
  assert.ok(getRoleWeight(disappearProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(fatigueProfile, "hand_denial") > 0);
  assert.ok(getRoleWeight(carnivalProfile, "burst_ramp") > 0);
  assert.ok(getRoleWeight(stingProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(repercussionProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(saltProfile, "land_denial") > 0);
  assert.ok(getRoleWeight(plowProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(matrixProfile, "hate_piece") > 0);
  assert.ok(getRoleWeight(foundryProfile, "graveyard_hate") > 0);
});

test("inferAdvancedRoleProfile recognizes Mercadian Masques utility wording gaps", () => {
  const inviolabilityProfile = inferAdvancedRoleProfile(createCard("Inviolability", "Enchantment — Aura", 2, "Enchant creature Prevent all damage that would be dealt to enchanted creature."));
  const muzzleProfile = inferAdvancedRoleProfile(createCard("Muzzle", "Enchantment — Aura", 2, "Enchant creature Prevent all damage that would be dealt by enchanted creature."));
  const storyProfile = inferAdvancedRoleProfile(
    createCard("Story Circle", "Enchantment", 3, "As this enchantment enters, choose a color. {W}: The next time a source of your choice of the chosen color would deal damage to you this turn, prevent that damage."),
  );
  const cowardiceProfile = inferAdvancedRoleProfile(
    createCard("Cowardice", "Enchantment", 5, "Whenever a creature becomes the target of a spell or ability, return that creature to its owner's hand."),
  );
  const embargoProfile = inferAdvancedRoleProfile(createCard("Embargo", "Enchantment", 4, "Nonland permanents don't untap during their controllers' untap steps. At the beginning of your upkeep, you lose 2 life."));
  const misstepProfile = inferAdvancedRoleProfile(createCard("Misstep", "Sorcery", 2, "Creatures target player controls don't untap during that player's next untap step."));
  const insubordinationProfile = inferAdvancedRoleProfile(
    createCard("Insubordination", "Enchantment — Aura", 2, "Enchant creature At the beginning of the end step of enchanted creature's controller, this Aura deals 2 damage to that player unless that creature attacked this turn."),
  );
  const liabilityProfile = inferAdvancedRoleProfile(createCard("Liability", "Enchantment", 3, "Whenever a nontoken permanent is put into a player's graveyard from the battlefield, that player loses 1 life."));
  const claimProfile = inferAdvancedRoleProfile(createCard("Pretender's Claim", "Enchantment — Aura", 2, "Enchant creature Whenever enchanted creature becomes blocked, tap all lands defending player controls."));
  const putrefactionProfile = inferAdvancedRoleProfile(createCard("Putrefaction", "Enchantment", 5, "Whenever a player casts a green or white spell, that player discards a card."));
  const oathProfile = inferAdvancedRoleProfile(
    createCard("Blood Oath", "Instant", 4, "Choose a card type. Target opponent reveals their hand. Blood Oath deals 3 damage to that player for each card of the chosen type revealed this way."),
  );
  const uphillProfile = inferAdvancedRoleProfile(createCard("Uphill Battle", "Enchantment", 3, "Creatures played by your opponents enter tapped."));
  const warpathProfile = inferAdvancedRoleProfile(createCard("Warpath", "Instant", 4, "Warpath deals 3 damage to each blocking creature and each blocked creature."));
  const clearProfile = inferAdvancedRoleProfile(
    createCard("Clear the Land", "Sorcery", 3, "Each player reveals the top five cards of their library, puts all land cards revealed this way onto the battlefield tapped, and exiles the rest."),
  );
  const preserveProfile = inferAdvancedRoleProfile(
    createCard("Game Preserve", "Enchantment", 3, "At the beginning of your upkeep, each player reveals the top card of their library. If all cards revealed this way are creature cards, put those cards onto the battlefield under their owners' control."),
  );
  const affinityProfile = inferAdvancedRoleProfile(createCard("Natural Affinity", "Instant", 3, "All lands become 2/2 creatures until end of turn. They're still lands."));
  const lensProfile = inferAdvancedRoleProfile(createCard("Distorting Lens", "Artifact", 2, "{T}: Target permanent becomes the color of your choice until end of turn."));
  const pawnshopProfile = inferAdvancedRoleProfile(createCard("Rishadan Pawnshop", "Artifact", 2, "{2}, {T}: Shuffle target nontoken permanent you control into its owner's library."));

  assert.ok(getRoleWeight(inviolabilityProfile, "targeted_protection") > 0);
  assert.ok(getRoleWeight(muzzleProfile, "targeted_protection") > 0);
  assert.ok(getRoleWeight(storyProfile, "protection") > 0);
  assert.ok(getRoleWeight(cowardiceProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(embargoProfile, "hate_piece") > 0);
  assert.ok(getRoleWeight(misstepProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(insubordinationProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(liabilityProfile, "damage_engine") > 0);
  assert.ok(getRoleWeight(claimProfile, "mana_denial") > 0);
  assert.ok(getRoleWeight(putrefactionProfile, "hand_attack") > 0);
  assert.ok(getRoleWeight(oathProfile, "direct_finisher") > 0);
  assert.ok(getRoleWeight(uphillProfile, "hate_piece") > 0);
  assert.ok(getRoleWeight(warpathProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(clearProfile, "land_acceleration") > 0);
  assert.ok(getRoleWeight(preserveProfile, "cost_reduction") > 0);
  assert.ok(getRoleWeight(affinityProfile, "animation_effect") > 0);
  assert.ok(getRoleWeight(lensProfile, "color_change") > 0);
  assert.ok(getRoleWeight(pawnshopProfile, "self_bounce") > 0);
});

test("inferAdvancedRoleProfile recognizes Nemesis utility wording gaps", () => {
  const barrierProfile = inferAdvancedRoleProfile(createCard("Aether Barrier", "Enchantment", 3, "Whenever a player casts a creature spell, that player sacrifices a permanent of their choice unless they pay {1}."));
  const moonProfile = inferAdvancedRoleProfile(createCard("Pale Moon", "Instant", 2, "Until end of turn, if a player taps a nonbasic land for mana, it produces colorless mana instead of any other type."));
  const disciplineProfile = inferAdvancedRoleProfile(createCard("Stronghold Discipline", "Sorcery", 4, "Each player loses 1 life for each creature they control."));
  const riftProfile = inferAdvancedRoleProfile(createCard("Flame Rift", "Sorcery", 2, "Flame Rift deals 4 damage to each player."));
  const gambitProfile = inferAdvancedRoleProfile(
    createCard("Stronghold Gambit", "Sorcery", 2, "Each player chooses a card in their hand. Then each player reveals their chosen card. The owner of each creature card revealed this way with the lowest mana value puts it onto the battlefield."),
  );
  const armorProfile = inferAdvancedRoleProfile(createCard("Belbe's Armor", "Artifact", 3, "{X}, {T}: Target creature gets -X/+X until end of turn."));
  const switchProfile = inferAdvancedRoleProfile(
    createCard("Kill Switch", "Artifact", 3, "{2}, {T}: Tap all other artifacts. They don't untap during their controllers' untap steps for as long as this artifact remains tapped."),
  );

  assert.ok(getRoleWeight(barrierProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(moonProfile, "mana_denial") > 0);
  assert.ok(getRoleWeight(disciplineProfile, "direct_finisher") > 0);
  assert.ok(getRoleWeight(riftProfile, "direct_finisher") > 0);
  assert.ok(getRoleWeight(gambitProfile, "cost_reduction") > 0);
  assert.ok(getRoleWeight(armorProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(switchProfile, "hate_piece") > 0);
});

test("inferAdvancedRoleProfile recognizes Prophecy utility wording gaps", () => {
  const blessedProfile = inferAdvancedRoleProfile(createCard("Blessed Wind", "Sorcery", 9, "Target player's life total becomes 20."));
  const entanglerProfile = inferAdvancedRoleProfile(createCard("Entangler", "Enchantment — Aura", 4, "Enchant creature Enchanted creature can block any number of creatures."));
  const denyingProfile = inferAdvancedRoleProfile(createCard("Denying Wind", "Sorcery", 9, "Search target player's library for up to seven cards and exile them. Then that player shuffles."));
  const vaporsProfile = inferAdvancedRoleProfile(createCard("Mana Vapors", "Sorcery", 2, "Lands target player controls don't untap during their next untap step."));
  const overburdenProfile = inferAdvancedRoleProfile(
    createCard("Overburden", "Enchantment", 2, "Whenever a player puts a nontoken creature onto the battlefield, that player returns a land they control to its owner's hand."),
  );
  const outbreakProfile = inferAdvancedRoleProfile(
    createCard("Outbreak", "Sorcery", 4, "You may discard a Swamp card rather than pay this spell's mana cost. Choose a creature type. All creatures of that type get -1/-1 until end of turn."),
  );
  const survivorsProfile = inferAdvancedRoleProfile(
    createCard("Search for Survivors", "Sorcery", 3, "Reorder your graveyard at random. An opponent chooses a card at random in your graveyard. If it's a creature card, put it onto the battlefield. Otherwise, exile it."),
  );
  const terrainProfile = inferAdvancedRoleProfile(createCard("Living Terrain", "Enchantment — Aura", 4, "Enchant land Enchanted land is a 5/6 green Treefolk creature that's still a land."));
  const cageProfile = inferAdvancedRoleProfile(createCard("Root Cage", "Enchantment", 2, "Mercenaries don't untap during their controllers' untap steps."));

  assert.ok(getRoleWeight(blessedProfile, "life_pressure") > 0);
  assert.ok(getRoleWeight(entanglerProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(denyingProfile, "mill_support") > 0);
  assert.ok(getRoleWeight(vaporsProfile, "mana_denial") > 0);
  assert.ok(getRoleWeight(overburdenProfile, "mana_denial") > 0);
  assert.ok(getRoleWeight(outbreakProfile, "mass_removal") > 0);
  assert.ok(getRoleWeight(survivorsProfile, "cost_reduction") > 0);
  assert.ok(getRoleWeight(terrainProfile, "animation_effect") > 0);
  assert.ok(getRoleWeight(cageProfile, "hate_piece") > 0);
});

test("inferAdvancedRoleProfile recognizes Invasion utility wording gaps", () => {
  const deathProfile = inferAdvancedRoleProfile(
    createCard("Death or Glory", "Sorcery", 5, "Separate all creature cards in your graveyard into two piles. Exile the pile of an opponent's choice and return the other to the battlefield."),
  );
  const ruinProfile = inferAdvancedRoleProfile(
    createCard("Global Ruin", "Sorcery", 5, "Each player chooses from the lands they control a land of each basic land type, then sacrifices the rest."),
  );
  const liberateProfile = inferAdvancedRoleProfile(
    createCard("Liberate", "Instant", 2, "Exile target creature you control. Return that card to the battlefield under its owner's control at the beginning of the next end step."),
  );
  const battleProfile = inferAdvancedRoleProfile(
    createCard("Psychic Battle", "Enchantment", 5, "Whenever a player chooses one or more targets, each player reveals the top card of their library. The player who reveals the card with the greatest mana value may change the target or targets."),
  );
  const plansProfile = inferAdvancedRoleProfile(
    createCard("Well-Laid Plans", "Enchantment", 3, "Prevent all damage that would be dealt to a creature by another creature if they share a color."),
  );
  const bordersProfile = inferAdvancedRoleProfile(
    createCard("Collapsing Borders", "Enchantment", 4, "Domain - At the beginning of each player's upkeep, that player gains 1 life for each basic land type among lands they control. Then this enchantment deals 3 damage to that player."),
  );
  const contestProfile = inferAdvancedRoleProfile(
    createCard("Mages' Contest", "Instant", 3, "You and target spell's controller bid life. You start the bidding with a bid of 1. The high bidder loses life equal to the high bid. If you win the bidding, counter that spell."),
  );
  const raysProfile = inferAdvancedRoleProfile(
    createCard("Searing Rays", "Sorcery", 3, "Choose a color. Searing Rays deals damage to each player equal to the number of creatures of that color that player controls."),
  );
  const fallProfile = inferAdvancedRoleProfile(
    createCard("Stand or Fall", "Enchantment", 4, "At the beginning of combat on your turn, for each defending player, separate all creatures that player controls into two piles and that player chooses one. Only creatures in the chosen piles can block this turn."),
  );
  const instabilityProfile = inferAdvancedRoleProfile(createCard("Tectonic Instability", "Enchantment", 3, "Whenever a land enters, tap all lands its controller controls."));
  const silkProfile = inferAdvancedRoleProfile(createCard("Whip Silk", "Enchantment — Aura", 1, "Enchant creature Enchanted creature has reach. {G}: Return this Aura to its owner's hand."));
  const spiteProfile = inferAdvancedRoleProfile(
    createCard("Barrin's Spite", "Sorcery", 4, "Choose two target creatures controlled by the same player. Their controller chooses and sacrifices one of them. Return the other to its owner's hand."),
  );
  const stakesProfile = inferAdvancedRoleProfile(createCard("Juntu Stakes", "Artifact", 2, "Creatures with power 1 or less don't untap during their controllers' untap steps."));

  assert.ok(getRoleWeight(deathProfile, "battlefield_recursion") > 0);
  assert.ok(getRoleWeight(ruinProfile, "mana_denial") > 0);
  assert.ok(getRoleWeight(liberateProfile, "flicker") > 0);
  assert.ok(getRoleWeight(battleProfile, "broad_stack") > 0);
  assert.ok(getRoleWeight(plansProfile, "broad_protection") > 0);
  assert.ok(getRoleWeight(bordersProfile, "group_slug") > 0);
  assert.ok(getRoleWeight(contestProfile, "soft_stack") > 0);
  assert.ok(getRoleWeight(raysProfile, "direct_finisher") > 0);
  assert.ok(getRoleWeight(fallProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(instabilityProfile, "mana_denial") > 0);
  assert.ok(getRoleWeight(silkProfile, "combat_support") > 0);
  assert.ok(getRoleWeight(spiteProfile, "removal") > 0);
  assert.ok(getRoleWeight(stakesProfile, "hate_piece") > 0);
});

test("inferAdvancedRoleProfile recognizes Planeshift utility wording gaps", () => {
  const overlayProfile = inferAdvancedRoleProfile(
    createCard("Planar Overlay", "Sorcery", 3, "Each player chooses a land they control of each basic land type. Return those lands to their owners' hands."),
  );
  const skyProfile = inferAdvancedRoleProfile(createCard("Shifting Sky", "Enchantment", 3, "As this enchantment enters, choose a color. All nonland permanents are the chosen color."));
  const hopeProfile = inferAdvancedRoleProfile(
    createCard("Sunken Hope", "Enchantment", 5, "At the beginning of each player's upkeep, that player returns a creature they control to its owner's hand."),
  );
  const vaporsProfile = inferAdvancedRoleProfile(
    createCard("Noxious Vapors", "Sorcery", 3, "Each player reveals their hand, chooses one card of each color from it, then discards all other nonland cards."),
  );
  const devotionProfile = inferAdvancedRoleProfile(createCard("Warped Devotion", "Enchantment", 3, "Whenever a permanent is returned to a player's hand, that player discards a card."));
  const gameProfile = inferAdvancedRoleProfile(
    createCard("Goblin Game", "Sorcery", 7, "Each player hides at least one item, then all players reveal them simultaneously. Each player loses life equal to the number of items they revealed. The player who revealed the fewest items then loses half their life, rounded up."),
  );
  const furyProfile = inferAdvancedRoleProfile(
    createCard("Planeswalker's Fury", "Enchantment", 3, "{3}{R}: Target opponent reveals a card at random from their hand. This enchantment deals damage equal to that card's mana value to that player. Activate only as a sorcery."),
  );
  const coverProfile = inferAdvancedRoleProfile(
    createCard("Cloud Cover", "Enchantment", 4, "Whenever another permanent you control becomes the target of a spell or ability an opponent controls, you may return that permanent to its owner's hand."),
  );
  const flowProfile = inferAdvancedRoleProfile(createCard("Destructive Flow", "Enchantment", 3, "At the beginning of each player's upkeep, that player sacrifices a nonbasic land of their choice."));
  const emergenceProfile = inferAdvancedRoleProfile(
    createCard("Natural Emergence", "Enchantment", 4, "When this enchantment enters, return a red or green enchantment you control to its owner's hand. Lands you control are 2/2 creatures with first strike. They're still lands."),
  );
  const tyrannyProfile = inferAdvancedRoleProfile(createCard("Phyrexian Tyranny", "Enchantment", 3, "Whenever a player draws a card, that player loses 2 life unless they pay {2}."));

  assert.ok(getRoleWeight(overlayProfile, "mana_denial") > 0);
  assert.ok(getRoleWeight(skyProfile, "color_change") > 0);
  assert.ok(getRoleWeight(hopeProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(vaporsProfile, "hand_attack") > 0);
  assert.ok(getRoleWeight(devotionProfile, "hand_attack") > 0);
  assert.ok(getRoleWeight(gameProfile, "direct_finisher") > 0);
  assert.ok(getRoleWeight(furyProfile, "direct_finisher") > 0);
  assert.ok(getRoleWeight(coverProfile, "self_bounce") > 0);
  assert.ok(getRoleWeight(flowProfile, "mana_denial") > 0);
  assert.ok(getRoleWeight(emergenceProfile, "animation_effect") > 0);
  assert.ok(getRoleWeight(tyrannyProfile, "group_slug") > 0);
});

test("inferAdvancedRoleProfile recognizes Apocalypse utility wording gaps", () => {
  const caveProfile = inferAdvancedRoleProfile(
    createCard("Ice Cave", "Enchantment", 5, "Whenever a player casts a spell, any other player may pay that spell's mana cost. If a player does, counter the spell."),
  );
  const selectionProfile = inferAdvancedRoleProfile(createCard("Unnatural Selection", "Enchantment", 2, "{1}: Choose a creature type other than Wall. Target creature becomes that type until end of turn."));
  const sanctuaryProfile = inferAdvancedRoleProfile(
    createCard("Necra Sanctuary", "Enchantment", 3, "At the beginning of your upkeep, if you control a green or white permanent, target player loses 1 life. If you control a green permanent and a white permanent, that player loses 3 life instead."),
  );
  const glareProfile = inferAdvancedRoleProfile(
    createCard("Tahngarth's Glare", "Sorcery", 1, "Look at the top three cards of target opponent's library, then put them back in any order. That player looks at the top three cards of your library, then puts them back in any order."),
  );
  const passageProfile = inferAdvancedRoleProfile(
    createCard("Guided Passage", "Sorcery", 3, "Reveal the cards in your library. An opponent chooses from among them a creature card, a land card, and a noncreature, nonland card. You put the chosen cards into your hand. Then shuffle."),
  );

  assert.ok(getRoleWeight(caveProfile, "soft_stack") > 0);
  assert.ok(getRoleWeight(selectionProfile, "kindred_support") > 0);
  assert.ok(getRoleWeight(sanctuaryProfile, "group_slug") > 0);
  assert.ok(getRoleWeight(glareProfile, "topdeck_control") > 0);
  assert.ok(getRoleWeight(passageProfile, "restricted_tutor") > 0);
});

test("inferAdvancedRoleProfile recognizes Sega Dreamcast random damage wording", () => {
  const breathProfile = inferAdvancedRoleProfile(
    createCard("Ashuza's Breath", "Sorcery", 3, "For each creature, choose a number from 0 to 2 at random. Ashuza's Breath deals that much damage to that creature."),
  );

  assert.ok(getRoleWeight(breathProfile, "mass_removal") > 0);
});

function createCard(
  name: string,
  typeLine: string,
  cmc: number,
  oracleText: string,
  overrides: Partial<ScryfallCard> = {},
): ScryfallCard {
  return {
    id: name,
    name,
    cmc,
    type_line: typeLine,
    oracle_text: oracleText,
    color_identity: [],
    keywords: [],
    layout: "normal",
    scryfall_uri: "https://scryfall.com",
    ...overrides,
  };
}
