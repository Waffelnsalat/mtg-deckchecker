import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckRemoval, analyzeDeckSpellInteraction } from "./interactionAnalysis";
import { DeckResolutionDocument, DeckSection, ResolvedDeckCard, ScryfallCard } from "./types";

test("analyzeDeckRemoval classifies targeted removal, sweepers, and hand attack", () => {
  const analysis = analyzeDeckRemoval(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 3),
      createResolvedCard("mainboard", 1, "Clean Answer", "Instant", 2, "Destroy target creature."),
      createResolvedCard("mainboard", 1, "Reset Button", "Sorcery", 4, "Destroy all creatures."),
      createResolvedCard(
        "mainboard",
        1,
        "Thoughtseize Style",
        "Sorcery",
        1,
        "Target player reveals their hand. You choose a nonland card from it. That player discards that card.",
      ),
      createResolvedCard("mainboard", 96, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Clean Answer")?.has("targeted_removal"));
  assert.ok(labels.get("Reset Button")?.has("mass_removal"));
  assert.ok(labels.get("Thoughtseize Style")?.has("hand_attack"));
  assert.ok(analysis.counts.targeted >= 0.8);
  assert.ok(analysis.counts.mass >= 0.8);
  assert.ok(analysis.counts.handAttack > 0);
});

test("analyzeDeckRemoval accounts for mana value and life costs on comparable kill spells", () => {
  const analysis = analyzeDeckRemoval(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 3),
      createResolvedCard("mainboard", 1, "Two Mana Kill", "Instant", 2, "Destroy target creature."),
      createResolvedCard("mainboard", 1, "Three Mana Kill", "Instant", 3, "Destroy target creature."),
      createResolvedCard(
        "mainboard",
        1,
        "Pain Kill",
        "Instant",
        2,
        "As an additional cost to cast this spell, pay 2 life. Destroy target creature.",
      ),
    ]),
  );

  const values = new Map(analysis.taggedCards.map((card) => [card.name, card.removalValue]));

  assert.ok((values.get("Two Mana Kill") ?? 0) > (values.get("Three Mana Kill") ?? 0));
  assert.ok((values.get("Two Mana Kill") ?? 0) > (values.get("Pain Kill") ?? 0));
});

test("analyzeDeckRemoval discounts removal that compensates the affected controller", () => {
  const analysis = analyzeDeckRemoval(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 3),
      createResolvedCard("mainboard", 1, "Clean Permanent Kill", "Instant", 3, "Destroy target permanent."),
      createResolvedCard(
        "mainboard",
        1,
        "Beast Within Style",
        "Instant",
        3,
        "Destroy target permanent. Its controller creates a 3/3 green Beast creature token.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Path Style",
        "Instant",
        1,
        "Exile target creature. Its controller may search their library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Swords Style",
        "Instant",
        1,
        "Exile target creature. Its controller gains life equal to its power.",
      ),
    ]),
  );

  const values = new Map(analysis.taggedCards.map((card) => [card.name, card.removalValue]));

  assert.ok((values.get("Clean Permanent Kill") ?? 0) > (values.get("Beast Within Style") ?? 0));
  assert.ok((values.get("Path Style") ?? 0) < 1.08);
  assert.ok((values.get("Swords Style") ?? 0) < 1.08);
  assert.ok((values.get("Path Style") ?? 0) < (values.get("Swords Style") ?? 0));
});

test("analyzeDeckRemoval treats bounce and tuck as tempo removal, not clean removal", () => {
  const analysis = analyzeDeckRemoval(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 3),
      createResolvedCard(
        "mainboard",
        1,
        "Bounce Spell",
        "Instant",
        2,
        "Return target nonland permanent to its owner's hand.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Aether Gust Style",
        "Instant",
        2,
        "Choose target spell or permanent that's red or green. Its owner puts it on the top or bottom of their library.",
      ),
      createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Bounce Spell")?.has("tempo_removal"));
  assert.ok(!labels.get("Bounce Spell")?.has("targeted_removal"));
  assert.ok(labels.get("Aether Gust Style")?.has("tempo_removal"));
});

test("analyzeDeckRemoval ignores protection and flicker shells", () => {
  const analysis = analyzeDeckRemoval(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 3),
      createResolvedCard(
        "mainboard",
        1,
        "Heroic Intervention Style",
        "Instant",
        2,
        "Permanents you control gain hexproof and indestructible until end of turn.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Eldrazi Displacer",
        "Creature - Eldrazi",
        3,
        "{2}{C}: Exile another target creature, then return it to the battlefield tapped under its owner's control.",
      ),
      createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  assert.equal(analysis.taggedCards.length, 0);
});

test("analyzeDeckRemoval catches chosen-creature removal that avoids targeting", () => {
  const analysis = analyzeDeckRemoval(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 3),
      createResolvedCard(
        "mainboard",
        1,
        "Sadistic Shell Game",
        "Sorcery",
        4,
        "Starting with the next opponent in turn order, each player chooses a creature you don't control. Destroy the chosen creatures.",
      ),
      createResolvedCard("mainboard", 98, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Sadistic Shell Game")?.has("targeted_removal"));
});

test("analyzeDeckRemoval catches edict-style sacrifice removal across common black wording", () => {
  const analysis = analyzeDeckRemoval(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 3),
      createResolvedCard(
        "mainboard",
        1,
        "Soul Shatter Style",
        "Instant",
        3,
        "Each opponent sacrifices a creature or planeswalker with the highest mana value among creatures and planeswalkers they control.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Sheoldred's Edict Style",
        "Instant",
        2,
        "Target opponent sacrifices a creature token.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Make an Example Style",
        "Sorcery",
        4,
        "Each opponent separates the creatures they control into two piles. For each opponent, you choose one of their piles. Each opponent sacrifices the creatures in their chosen pile.",
      ),
      createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Soul Shatter Style")?.has("targeted_removal"));
  assert.ok(labels.get("Sheoldred's Edict Style")?.has("targeted_removal"));
  assert.ok(labels.get("Make an Example Style")?.has("targeted_removal"));
});

test("analyzeDeckRemoval catches aura neutralization and scalable any-target damage", () => {
  const analysis = analyzeDeckRemoval(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 3),
      createResolvedCard(
        "mainboard",
        1,
        "Song of the Dryads Style",
        "Enchantment - Aura",
        3,
        "Enchant permanent. Enchanted permanent is a colorless Forest land.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Comet Storm Style",
        "Instant",
        2,
        "Multikicker {1}. Choose any target, then choose another target for each time this spell was kicked. Comet Storm deals X damage to each of them.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Crackle with Power Style",
        "Sorcery",
        5,
        "Crackle with Power deals five times X damage to each of up to X targets.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Chaos Warp Style",
        "Instant",
        3,
        "The owner of target permanent shuffles it into their library, then reveals the top card of their library.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Aether Gale Style",
        "Sorcery",
        5,
        "Return six target nonland permanents to their owners' hands.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Peel from Reality Style",
        "Instant",
        2,
        "Return target creature you control and target creature you don't control to their owners' hands.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Gaze of Granite Style",
        "Sorcery",
        2,
        "Destroy each nonland permanent with mana value X or less.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Aetherspouts Style",
        "Instant",
        5,
        "For each attacking creature, its owner puts it on their choice of the top or bottom of their library.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Frenzied Fugue Style",
        "Enchantment - Aura",
        4,
        "Enchant permanent. At the beginning of your upkeep, gain control of enchanted permanent until end of turn. Untap that permanent. It gains haste until end of turn.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Dispatch Style",
        "Instant",
        1,
        "Tap target creature. Metalcraft - If you control three or more artifacts, exile that creature.",
      ),
      createResolvedCard("mainboard", 96, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Song of the Dryads Style")?.has("targeted_removal"));
  assert.ok(labels.get("Comet Storm Style")?.has("targeted_removal"));
  assert.ok(labels.get("Crackle with Power Style")?.has("targeted_removal"));
  assert.ok(labels.get("Chaos Warp Style")?.has("targeted_removal"));
  assert.ok(labels.get("Aether Gale Style")?.has("tempo_removal"));
  assert.ok(labels.get("Peel from Reality Style")?.has("tempo_removal"));
  assert.ok(labels.get("Gaze of Granite Style")?.has("mass_removal"));
  assert.ok(labels.get("Aetherspouts Style")?.has("mass_removal"));
  assert.ok(labels.get("Frenzied Fugue Style")?.has("tempo_removal"));
  assert.ok(labels.get("Dispatch Style")?.has("targeted_removal"));
});

test("analyzeDeckRemoval does not bottom out mono-blue tempo shells", () => {
  const analysis = analyzeDeckRemoval(
    createDocument([
      createResolvedCard("commander", 1, "Urza Style", "Legendary Creature - Artificer", 4, "", {
        color_identity: ["U"],
      }),
      createResolvedCard(
        "mainboard",
        1,
        "Aether Spellbomb",
        "Artifact",
        1,
        "{U}, Sacrifice Aether Spellbomb: Return target creature to its owner's hand.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Chain of Vapor",
        "Instant",
        1,
        "Return target nonland permanent to its owner's hand.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Submerge",
        "Instant",
        5,
        "If an opponent controls a Forest and you control an Island, you may cast this spell without paying its mana cost. Put target creature on top of its owner's library.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Sink into Stupor Style",
        "Instant",
        2,
        "Return target spell or nonland permanent an opponent controls to its owner's hand.",
      ),
      createResolvedCard("mainboard", 95, "Filler Spell", "Artifact", 2, ""),
    ]),
  );

  assert.ok(analysis.counts.tempo >= 2.5);
  assert.ok(analysis.recommendations.tempoTarget >= 2);
  assert.ok(analysis.removalScore >= 35);
});

test("analyzeDeckSpellInteraction classifies hard, soft, tempo, and broad stack answers", () => {
  const analysis = analyzeDeckSpellInteraction(
    createDocument([
      createResolvedCard("commander", 1, "Blue Commander", "Legendary Creature - Wizard", 3, "", {
        color_identity: ["U"],
      }),
      createResolvedCard("mainboard", 1, "Counterspell Style", "Instant", 2, "Counter target spell."),
      createResolvedCard(
        "mainboard",
        1,
        "Mana Leak Style",
        "Instant",
        2,
        "Counter target spell unless its controller pays {3}.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Remand Style",
        "Instant",
        2,
        "Counter target spell. If that spell is countered this way, return it to its owner's hand instead of putting it into that player's graveyard.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Summary Dismissal Style",
        "Instant",
        4,
        "Exile all other spells and counter all abilities.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Mindbreak Trap Style",
        "Instant",
        4,
        "If an opponent cast three or more spells this turn, you may pay {0} rather than pay this spell's mana cost. Exile any number of target spells.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Green Slime Style",
        "Creature - Ooze",
        3,
        "When this creature enters, counter target activated or triggered ability from an artifact or enchantment source.",
      ),
      createResolvedCard("mainboard", 95, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Counterspell Style")?.has("hard_stack"));
  assert.ok(labels.get("Mana Leak Style")?.has("soft_stack"));
  assert.ok(labels.get("Remand Style")?.has("hard_stack"));
  assert.ok(labels.get("Summary Dismissal Style")?.has("broad_stack"));
  assert.ok(labels.get("Mindbreak Trap Style")?.has("broad_stack"));
  assert.ok(labels.get("Green Slime Style")?.has("broad_stack"));
  assert.ok(analysis.counts.hard >= 1);
  assert.ok(analysis.counts.soft > 0);
  assert.ok(analysis.counts.broad > 0);
});

test("analyzeDeckSpellInteraction catches spell bounce and spell tuck separately from removal", () => {
  const analysis = analyzeDeckSpellInteraction(
    createDocument([
      createResolvedCard("commander", 1, "Blue Commander", "Legendary Creature - Wizard", 3, "", {
        color_identity: ["U"],
      }),
      createResolvedCard(
        "mainboard",
        1,
        "Sink into Stupor Style",
        "Instant",
        2,
        "Return target spell or nonland permanent an opponent controls to its owner's hand.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Aether Gust Style",
        "Instant",
        2,
        "Choose target spell or permanent that's red or green. Its owner puts it on the top or bottom of their library.",
      ),
      createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Sink into Stupor Style")?.has("spell_tempo"));
  assert.ok(labels.get("Aether Gust Style")?.has("spell_tempo"));
});

test("analyzeDeckSpellInteraction classifies stax and asymmetric hate pieces", () => {
  const analysis = analyzeDeckSpellInteraction(
    createDocument([
      createResolvedCard("commander", 1, "White Commander", "Legendary Creature - Cleric", 3, "", {
        color_identity: ["W"],
      }),
      createResolvedCard(
        "mainboard",
        1,
        "Rule of Law Style",
        "Enchantment",
        3,
        "Each player can't cast more than one spell each turn.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Opposition Agent Style",
        "Creature - Human Rogue",
        3,
        "Your opponents can't search libraries.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Thalia Style",
        "Creature - Human Soldier",
        2,
        "Noncreature spells your opponents cast cost {1} more to cast.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Ethersworn Canonist Style",
        "Artifact Creature - Human Cleric",
        2,
        "Each player who has cast a nonartifact spell this turn can't cast additional nonartifact spells.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Grafdigger Cage Style",
        "Artifact",
        1,
        "Creature cards in graveyards and libraries can't enter the battlefield. Players can't cast spells from graveyards or libraries.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Containment Priest Style",
        "Creature - Human Cleric",
        2,
        "If a nontoken creature would enter and it wasn't cast, exile it instead.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Torpor Orb Style",
        "Artifact",
        2,
        "Creatures entering don't cause abilities to trigger.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Aven Mindcensor Style",
        "Creature - Bird Wizard",
        3,
        "If an opponent would search a library, that player searches the top four cards of that library instead.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Damping Sphere Style",
        "Artifact",
        2,
        "If a land is tapped for two or more mana, it produces {C} instead of any other type and amount. Each spell a player casts costs {1} more to cast for each other spell that player has cast this turn.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "City of Solitude Style",
        "Enchantment",
        3,
        "Players can cast spells and activate abilities only during their own turns.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Back to Basics Style",
        "Enchantment",
        3,
        "Nonbasic lands don't untap during their controllers' untap steps.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Blood Moon Style",
        "Enchantment",
        3,
        "Nonbasic lands are Mountains.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Pithing Needle Style",
        "Artifact",
        1,
        "Activated abilities of sources with the chosen name can't be activated unless they're mana abilities.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Chalice Style",
        "Artifact",
        0,
        "Whenever a player casts a spell with mana value equal to the number of charge counters on this artifact, counter that spell.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Aura of Silence Style",
        "Enchantment",
        3,
        "Artifacts and enchantments your opponents cast cost {2} more to cast.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Tabernacle Style",
        "Land",
        0,
        'All creatures have "At the beginning of your upkeep, destroy this creature unless you pay {1}."',
      ),
      createResolvedCard("mainboard", 82, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Rule of Law Style")?.has("stax_piece"));
  assert.ok(labels.get("Opposition Agent Style")?.has("stax_piece"));
  assert.ok(labels.get("Thalia Style")?.has("stax_piece"));
  assert.ok(labels.get("Ethersworn Canonist Style")?.has("stax_piece"));
  assert.ok(labels.get("Grafdigger Cage Style")?.has("stax_piece"));
  assert.ok(labels.get("Containment Priest Style")?.has("stax_piece"));
  assert.ok(labels.get("Torpor Orb Style")?.has("stax_piece"));
  assert.ok(labels.get("Aven Mindcensor Style")?.has("stax_piece"));
  assert.ok(labels.get("Damping Sphere Style")?.has("stax_piece"));
  assert.ok(labels.get("City of Solitude Style")?.has("stax_piece"));
  assert.ok(labels.get("Back to Basics Style")?.has("stax_piece"));
  assert.ok(labels.get("Blood Moon Style")?.has("stax_piece"));
  assert.ok(labels.get("Pithing Needle Style")?.has("stax_piece"));
  assert.ok(labels.get("Chalice Style")?.has("stax_piece"));
  assert.ok(labels.get("Aura of Silence Style")?.has("stax_piece"));
  assert.ok(labels.get("Tabernacle Style")?.has("stax_piece"));
  assert.ok((analysis.counts.stax ?? 0) > 10);
  assert.ok(analysis.counts.core > 0);
});

test("analyzeDeckSpellInteraction classifies graveyard hate", () => {
  const analysis = analyzeDeckSpellInteraction(
    createDocument([
      createResolvedCard("commander", 1, "Black Commander", "Legendary Creature - Cleric", 3, "", {
        color_identity: ["B"],
      }),
      createResolvedCard(
        "mainboard",
        1,
        "Bojuka Bog Style",
        "Land",
        0,
        "When Bojuka Bog Style enters the battlefield, exile target player's graveyard.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Rest in Peace Style",
        "Enchantment",
        2,
        "When Rest in Peace Style enters the battlefield, exile all graveyards. If a card or token would be put into a graveyard from anywhere, exile it instead.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Soul Guide Lantern Style",
        "Artifact",
        1,
        "When this artifact enters the battlefield, exile target card from a graveyard. {T}, Sacrifice this artifact: Exile each opponent's graveyard.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Dauthi Voidwalker Style",
        "Creature - Dauthi Rogue",
        2,
        "If a card would be put into an opponent's graveyard from anywhere, instead exile it with a void counter on it.",
      ),
      createResolvedCard("mainboard", 95, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Bojuka Bog Style")?.has("graveyard_hate"));
  assert.ok(labels.get("Rest in Peace Style")?.has("graveyard_hate"));
  assert.ok(labels.get("Soul Guide Lantern Style")?.has("graveyard_hate"));
  assert.ok(labels.get("Dauthi Voidwalker Style")?.has("graveyard_hate"));
  assert.ok((analysis.counts.graveyardHate ?? 0) > 2);
});

test("analyzeDeckSpellInteraction does not flag removal-only cards", () => {
  const analysis = analyzeDeckSpellInteraction(
    createDocument([
      createResolvedCard("commander", 1, "Mono Red Commander", "Legendary Creature - Human", 2),
      createResolvedCard("mainboard", 1, "Chaos Warp Style", "Instant", 3, "The owner of target permanent shuffles it into their library, then reveals the top card of their library."),
      createResolvedCard("mainboard", 98, "Bear", "Creature - Bear", 2, ""),
    ]),
  );

  assert.equal(analysis.taggedCards.length, 0);
});

test("commanders get boosted in both removal and spell interaction", () => {
  const removal = analyzeDeckRemoval(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Removal Commander",
        "Legendary Creature - Wizard",
        3,
        "When this creature enters the battlefield, destroy target creature an opponent controls.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Removal Spell",
        "Sorcery",
        3,
        "Destroy target creature.",
      ),
      createResolvedCard("mainboard", 98, "Bear", "Creature - Bear", 2, ""),
    ]),
  );
  const interaction = analyzeDeckSpellInteraction(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Counter Commander",
        "Legendary Creature - Wizard",
        3,
        "Counter target spell.",
        { color_identity: ["U"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Counter Spell",
        "Instant",
        2,
        "Counter target spell.",
      ),
      createResolvedCard("mainboard", 98, "Bear", "Creature - Bear", 2, ""),
    ]),
  );

  const removalCommander = removal.taggedCards.find((card) => card.name === "Removal Commander");
  const removalSpell = removal.taggedCards.find((card) => card.name === "Removal Spell");
  const interactionCommander = interaction.taggedCards.find((card) => card.name === "Counter Commander");
  const interactionSpell = interaction.taggedCards.find((card) => card.name === "Counter Spell");

  assert.ok((removalCommander?.removalValue ?? 0) > (removalSpell?.removalValue ?? 0));
  assert.ok((interactionCommander?.interactionValue ?? 0) > (interactionSpell?.interactionValue ?? 0));
});

function createDocument(resolvedCards: ResolvedDeckCard[]): DeckResolutionDocument {
  return {
    format: "edh",
    parse: {
      entries: [],
      errors: [],
      warnings: [],
      totalCards: resolvedCards.reduce((sum, card) => sum + card.quantity, 0),
      uniqueCards: resolvedCards.length,
    },
    result: {
      resolvedCards,
      unresolvedCards: [],
      resolvedCount: resolvedCards.length,
      unresolvedCount: 0,
    },
  };
}

function createResolvedCard(
  section: DeckSection,
  quantity: number,
  name: string,
  typeLine: string,
  cmc: number,
  oracleText = "",
  overrides: Partial<ScryfallCard> = {},
): ResolvedDeckCard {
  const card: ScryfallCard = {
    id: `${name}-${section}`,
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

  return {
    quantity,
    section,
    requestedName: name,
    originalLine: `${quantity} ${name}`,
    lineNumber: 1,
    card,
  };
}
