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

  assert.ok(getRoleWeight(chimeraProfile, "broad_stack") > 0);
  assert.ok(getRoleWeight(chimeraProfile, "donation_support") > 0);
  assert.ok(getRoleWeight(roleReversalProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(roleReversalProfile, "donation_support") > 0);
  assert.ok(getRoleWeight(shiftingGriftProfile, "tempo_removal") > 0);
  assert.ok(getRoleWeight(shiftingGriftProfile, "donation_support") > 0);
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
