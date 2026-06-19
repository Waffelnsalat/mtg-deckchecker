import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckRamp } from "./rampAnalysis";
import { DeckResolutionDocument, DeckSection, ResolvedDeckCard, ScryfallCard } from "./types";

test("analyzeDeckRamp classifies generic wording-based ramp patterns", () => {
  const document = createDocument([
    createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 3),
    createResolvedCard("mainboard", 34, "Basic Forest", "Basic Land - Forest", 0, "{T}: Add {G}."),
    createResolvedCard(
      "mainboard",
      1,
      "Mana Device",
      "Artifact",
      2,
      "{T}: Add one mana of any color.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Growth Lesson",
      "Sorcery",
      2,
      "Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
    ),
    createResolvedCard("mainboard", 1, "Red Ritual", "Instant", 1, "Add {R}{R}{R}."),
    createResolvedCard(
      "mainboard",
      1,
      "Spirit Guide Style",
      "Creature - Elf Spirit",
      3,
      "Exile Spirit Guide Style from your hand: Add {G}.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Treasure Plan",
      "Sorcery",
      3,
      "Create two Treasure tokens.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Forge Banner",
      "Artifact",
      3,
      "Red spells you cast cost {1} less to cast.",
    ),
    createResolvedCard("mainboard", 60, "Filler Spell", "Creature - Scout", 2, ""),
  ]);

  const analysis = analyzeDeckRamp(document);

  assert.ok(analysis.counts.stable >= 0.9 && analysis.counts.stable <= 1.1);
  assert.ok(analysis.counts.landAcceleration >= 0.9 && analysis.counts.landAcceleration <= 1.1);
  assert.ok(analysis.counts.burst >= 2.5 && analysis.counts.burst <= 3.2);
  assert.ok(analysis.counts.manaFixing >= 1.4 && analysis.counts.manaFixing <= 1.7);
  assert.ok(analysis.counts.costReduction >= 0.8 && analysis.counts.costReduction <= 1);
  assert.equal(analysis.taggedCards.length, 6);
  assert.ok(analysis.findings.some((finding) => finding.code === "core_ramp_low"));
});

test("analyzeDeckRamp does not treat normal lands as ramp", () => {
  const document = createDocument([
    createResolvedCard("commander", 1, "Mono Commander", "Legendary Creature - Human", 2),
    createResolvedCard("mainboard", 99, "Basic Mountain", "Basic Land - Mountain", 0, "{T}: Add {R}."),
  ]);

  const analysis = analyzeDeckRamp(document);

  assert.equal(analysis.counts.stable, 0);
  assert.equal(analysis.taggedCards.length, 0);
  assert.ok(analysis.findings.some((finding) => finding.code === "core_ramp_low"));
});

test("analyzeDeckRamp keeps premium acceleration above fixing rocks in card value", () => {
  const analysis = analyzeDeckRamp(
    createDocument([
      createResolvedCard(
        "mainboard",
        1,
        "Sol Ring",
        "Artifact",
        1,
        "{T}: Add {C}{C}.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Talisman of Hierarchy",
        "Artifact",
        2,
        "{T}: Add {C}.\n{T}: Add {W} or {B}. Talisman of Hierarchy deals 1 damage to you.",
        { color_identity: ["W", "B"] },
      ),
    ]),
  );

  const solRing = analysis.taggedCards.find((card) => card.name === "Sol Ring");
  const talisman = analysis.taggedCards.find((card) => card.name === "Talisman of Hierarchy");

  assert.ok(solRing);
  assert.ok(talisman);
  assert.ok(solRing.rampValue > talisman.rampValue);
});

test("analyzeDeckRamp values all-land untap engines as real stable ramp", () => {
  const analysis = analyzeDeckRamp(
    createDocument([
      createResolvedCard(
        "mainboard",
        1,
        "Wilderness Reclamation",
        "Enchantment",
        4,
        "At the beginning of your end step, untap all lands you control.",
        { color_identity: ["G"] },
      ),
    ]),
  );

  const reclamation = analysis.taggedCards.find((card) => card.name === "Wilderness Reclamation");

  assert.ok(reclamation);
  assert.ok(reclamation.rampValue >= 1);
  assert.ok(reclamation.hits.some((hit) => hit.tag === "stable_ramp"));
});

test("analyzeDeckRamp discounts mana paid to activate ramp effects", () => {
  const analysis = analyzeDeckRamp(
    createDocument([
      createResolvedCard(
        "mainboard",
        1,
        "Free Mana Doubler",
        "Artifact",
        3,
        "{T}: Double the amount of each type of unspent mana you have.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Paid Mana Doubler",
        "Artifact",
        3,
        "{3}, {T}: Double the amount of each type of unspent mana you have.",
      ),
    ]),
  );

  const freeDoubler = analysis.taggedCards.find((card) => card.name === "Free Mana Doubler");
  const paidDoubler = analysis.taggedCards.find((card) => card.name === "Paid Mana Doubler");

  assert.ok(freeDoubler);
  assert.ok(paidDoubler);
  assert.ok(freeDoubler.rampValue > paidDoubler.rampValue);
});

test("analyzeDeckRamp does not count ordinary fixing lands as ramp-side fixing", () => {
  const document = createDocument([
    createResolvedCard(
      "commander",
      1,
      "Two-Color Commander",
      "Legendary Creature - Human",
      3,
      "",
      { color_identity: ["W", "U"] },
    ),
    createResolvedCard("mainboard", 1, "Rainbow Land", "Land", 0, "{T}: Add one mana of any color."),
    createResolvedCard("mainboard", 1, "Dual Land", "Land", 0, "{T}: Add {W} or {U}."),
    createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Human", 2, ""),
  ]);

  const analysis = analyzeDeckRamp(document);

  assert.equal(analysis.counts.manaFixing, 0);
  assert.equal(analysis.taggedCards.length, 0);
});

test("analyzeDeckRamp boosts commander ramp roles", () => {
  const analysis = analyzeDeckRamp(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Ramp Commander",
        "Legendary Creature - Elf Druid",
        2,
        "{T}: Add one mana of any color.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Mana Dork",
        "Creature - Elf Druid",
        2,
        "{T}: Add one mana of any color.",
      ),
      createResolvedCard("mainboard", 98, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const commander = analysis.taggedCards.find((card) => card.name === "Ramp Commander");
  const mainboard = analysis.taggedCards.find((card) => card.name === "Mana Dork");

  assert.ok(commander);
  assert.ok(mainboard);
  assert.ok((commander?.rampValue ?? 0) > (mainboard?.rampValue ?? 0));
  assert.ok((commander?.hits.find((hit) => hit.tag === "stable_ramp")?.weight ?? 0)
    > (mainboard?.hits.find((hit) => hit.tag === "stable_ramp")?.weight ?? 0));
});

test("analyzeDeckRamp discounts delayed activated land ramp", () => {
  const analysis = analyzeDeckRamp(
    createDocument([
      createResolvedCard("commander", 1, "Mono Commander", "Legendary Creature - Human", 3),
      createResolvedCard(
        "mainboard",
        1,
        "Clean Land Ramp",
        "Sorcery",
        2,
        "Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Bauble Ramp",
        "Artifact",
        1,
        "{2}, {T}, Sacrifice this artifact: Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Landscape Ramp",
        "Land",
        0,
        "{2}, {T}, Sacrifice this land: Search your library for up to two basic land cards, put them onto the battlefield tapped, then shuffle.",
      ),
      createResolvedCard("mainboard", 96, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const tagged = new Map(
    analysis.taggedCards.map((card) => [
      card.name,
      card.hits.find((hit) => hit.tag === "land_acceleration")?.weight ?? 0,
    ]),
  );

  assert.ok(tagged.get("Clean Land Ramp")! > tagged.get("Bauble Ramp")!);
  assert.ok(tagged.get("Landscape Ramp")! < 1.4);
});

test("analyzeDeckRamp catches broader wording-based ramp patterns", () => {
  const document = createDocument([
    createResolvedCard("commander", 1, "Five-Color Commander", "Legendary Creature - Human", 4),
    createResolvedCard(
      "mainboard",
      1,
      "Charge Engine",
      "Artifact",
      3,
      "This artifact enters with X charge counters on it. {T}: Choose a color. Add one mana of that color for each charge counter on this artifact.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Forest Untapper",
      "Creature - Elf Druid",
      1,
      "{T}: Untap target Forest.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Forest Tutor",
      "Sorcery",
      2,
      "Search your library for a Forest card, put that card onto the battlefield, then shuffle.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Tri-Land Tutor",
      "Sorcery",
      2,
      "Search your library for a Plains, Island, Swamp, or Mountain card, put it onto the battlefield tapped, then shuffle.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Forest Aura",
      "Enchantment - Aura",
      1,
      "Enchant Forest As this Aura enters, choose a color. Whenever enchanted Forest is tapped for mana, its controller adds an additional one mana of the chosen color.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Land Doubler",
      "Enchantment",
      5,
      "Whenever you tap a land for mana, add one mana of any type that land produced.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Spell Refund",
      "Legendary Creature - God",
      3,
      "Whenever you cast a spell, add {R}. Until end of turn, you don't lose this mana as steps and phases end.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Color Pair Reducer",
      "Creature - Goblin Shaman",
      2,
      "Each spell you cast that's red or green costs {1} less to cast.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Tribal Reducer",
      "Artifact",
      3,
      "As this artifact enters, choose a creature type. Creature spells of the chosen type cost {2} less to cast.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Permanent Untapper",
      "Creature - Merfolk",
      2,
      "{T}: Untap another target permanent.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Alternate Cost Engine",
      "Artifact",
      3,
      "You may pay {W}{U}{B}{R}{G} rather than pay the mana cost for spells that you cast.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Attack Untap Engine",
      "Enchantment - Aura Curse",
      2,
      "Enchant player. Whenever enchanted player is attacked, untap all nonland permanents you control.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Charge Battery",
      "Artifact",
      2,
      "This artifact enters tapped and with three charge counters on it. {T}, Remove a charge counter from this artifact: Add one mana of any color.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Land Color Doubler",
      "Artifact",
      6,
      "As this artifact enters, choose a color. Whenever a land's ability causes you to add one or more mana of the chosen color, add an additional one mana of that color.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Basic Land Doubler",
      "Artifact",
      5,
      "As this artifact enters, choose a color. Whenever a basic land is tapped for mana of the chosen color, its controller adds an additional one mana of that color.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Topdeck Land Burst",
      "Sorcery",
      4,
      "Reveal the top X cards of your library. Put all land cards from among them onto the battlefield tapped and the rest on the bottom of your library in a random order.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Crewed Mana Dork",
      "Creature - Dryad",
      2,
      "{T}, Tap an untapped creature you control: Add one mana of any color.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Druid Channeler",
      "Legendary Creature - Centaur Druid",
      3,
      "Tap an untapped Druid you control: Add {G}.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Land Untapper X",
      "Creature - Wizard",
      1,
      "{X}, {T}: Untap X target lands.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Victory Lantern",
      "Artifact",
      3,
      "{T}: A player of your choice adds {C}.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Stored Prism",
      "Artifact",
      2,
      "Remove a charge counter from this artifact: Add one mana of any color.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Land Copy Engine",
      "Artifact",
      3,
      "This artifact has all activated abilities of all lands on the battlefield.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Mana Frenzy",
      "Instant",
      1,
      "Until end of turn, whenever a player taps an Island for mana, that player adds an additional {U}.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Mana Swell",
      "Enchantment",
      3,
      "Whenever a player taps a land for mana, that player adds one mana of any type that land produced.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Main Phase Banner",
      "Enchantment",
      4,
      "At the beginning of each of your main phases, add {G}{G}.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Improvise Forge",
      "Artifact",
      3,
      "Nonartifact spells you cast have improvise. (Your artifacts can help cast those spells. Each artifact you tap after you're done activating mana abilities pays for {1}.)",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "ETB Burst Priest",
      "Creature - Cleric",
      3,
      "When this creature enters, add {R}{R}{R}.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Catchup Sponsor",
      "Creature - Advisor",
      4,
      "When this creature enters, each player who controls fewer lands than the player who controls the most lands searches their library for a number of basic land cards less than or equal to the difference, puts those cards onto the battlefield tapped, then shuffles.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Plains Explorer",
      "Creature - Cat Scout",
      2,
      "When this creature enters, search your library for up to X Plains cards, reveal those cards, put them into your hand, then shuffle.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Hand Terrain Engine",
      "Land",
      0,
      "{2}, {T}: You may put a basic land card from your hand onto the battlefield tapped.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Attack Scope",
      "Artifact - Equipment",
      1,
      "Whenever equipped creature attacks, look at the top card of your library. If it's a land card, you may put it onto the battlefield tapped.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Artifact Main Phase Engine",
      "Artifact",
      5,
      "At the beginning of each player's first main phase, if this artifact is untapped, that player adds {C} for each artifact they control.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Mountain Boost",
      "Artifact",
      4,
      "Whenever a Mountain is tapped for mana, its controller adds an additional {R}.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Mana Cube",
      "Artifact",
      2,
      "{3}, {T}: Double the amount of each type of unspent mana you have.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Creature-To-Land Engine",
      "Enchantment",
      2,
      "Tap an untapped creature you control: Untap target basic land.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Permanent Multiplier",
      "Enchantment",
      6,
      "If you tap a permanent for mana, it produces twice as much of that mana instead.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Combat Land Sword",
      "Artifact - Equipment",
      3,
      "Whenever equipped creature deals combat damage to a player, exile up to one target creature you own, then search your library for a basic land card. Put both cards onto the battlefield under your control, then shuffle.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Conditional Plains Farmer",
      "Creature - Dwarf",
      3,
      "When this creature enters, search your library for a basic Plains card and reveal it. If an opponent controls more lands than you, put it onto the battlefield tapped. Otherwise, put it into your hand. Then shuffle.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Catchup Explorer",
      "Creature - Cat Scout",
      2,
      "When this creature enters, search your library for up to X Plains cards, where X is the number of players who control more lands than you. Reveal those cards, put them into your hand, then shuffle.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Scope of Surveying",
      "Artifact",
      2,
      "{T}, Exile this artifact: Search your library for up to X basic land cards, where X is the number of players who control at least two more lands than you. Put those cards onto the battlefield, then shuffle.",
    ),
    createResolvedCard("mainboard", 90, "Filler Spell", "Creature - Scout", 2, ""),
  ]);

  const analysis = analyzeDeckRamp(document);
  const taggedCards = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(taggedCards.get("Charge Engine")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Forest Untapper")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Forest Tutor")?.has("land_acceleration"));
  assert.ok(taggedCards.get("Forest Tutor")?.has("mana_fixing"));
  assert.ok(taggedCards.get("Tri-Land Tutor")?.has("land_acceleration"));
  assert.ok(taggedCards.get("Tri-Land Tutor")?.has("mana_fixing"));
  assert.ok(taggedCards.get("Forest Aura")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Land Doubler")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Land Doubler")?.has("mana_fixing"));
  assert.ok(taggedCards.get("Spell Refund")?.has("burst_ramp"));
  assert.ok(taggedCards.get("Color Pair Reducer")?.has("cost_reduction"));
  assert.ok(taggedCards.get("Tribal Reducer")?.has("cost_reduction"));
  assert.ok(taggedCards.get("Permanent Untapper")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Alternate Cost Engine")?.has("cost_reduction"));
  assert.ok(taggedCards.get("Attack Untap Engine")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Charge Battery")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Charge Battery")?.has("mana_fixing"));
  assert.ok(taggedCards.get("Land Color Doubler")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Basic Land Doubler")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Topdeck Land Burst")?.has("land_acceleration"));
  assert.ok(taggedCards.get("Crewed Mana Dork")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Crewed Mana Dork")?.has("mana_fixing"));
  assert.ok(taggedCards.get("Druid Channeler")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Land Untapper X")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Victory Lantern")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Stored Prism")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Stored Prism")?.has("mana_fixing"));
  assert.ok(taggedCards.get("Land Copy Engine")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Mana Frenzy")?.has("burst_ramp"));
  assert.ok(taggedCards.get("Mana Swell")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Main Phase Banner")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Improvise Forge")?.has("cost_reduction"));
  assert.ok(taggedCards.get("ETB Burst Priest")?.has("burst_ramp"));
  assert.ok(taggedCards.get("Catchup Sponsor")?.has("land_acceleration"));
  assert.ok(taggedCards.get("Plains Explorer")?.has("land_acceleration"));
  assert.ok(taggedCards.get("Plains Explorer")?.has("mana_fixing"));
  assert.ok(taggedCards.get("Hand Terrain Engine")?.has("land_acceleration"));
  assert.ok(taggedCards.get("Attack Scope")?.has("land_acceleration"));
  assert.ok(taggedCards.get("Artifact Main Phase Engine")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Mountain Boost")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Mana Cube")?.has("burst_ramp"));
  assert.ok(taggedCards.get("Creature-To-Land Engine")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Permanent Multiplier")?.has("stable_ramp"));
  assert.ok(taggedCards.get("Combat Land Sword")?.has("land_acceleration"));
  assert.ok(taggedCards.get("Conditional Plains Farmer")?.has("land_acceleration"));
  assert.ok(taggedCards.get("Catchup Explorer")?.has("land_acceleration"));
  assert.ok(taggedCards.get("Catchup Explorer")?.has("mana_fixing"));
  assert.ok(taggedCards.get("Scope of Surveying")?.has("land_acceleration"));
});

test("analyzeDeckRamp raises fixing targets for real color pressure", () => {
  const lowDemand = analyzeDeckRamp(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Two-Color Commander",
        "Legendary Creature - Human",
        3,
        "",
        { color_identity: ["G", "W"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Simple Signet",
        "Artifact",
        2,
        "{T}: Add one mana of any color.",
      ),
      createResolvedCard(
        "mainboard",
        40,
        "Green Spell",
        "Creature - Elf",
        2,
        "",
        { mana_cost: "{1}{G}" },
      ),
      createResolvedCard(
        "mainboard",
        58,
        "Colorless Spell",
        "Artifact",
        3,
        "",
        { mana_cost: "{3}" },
      ),
    ]),
  );

  const highDemand = analyzeDeckRamp(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Five-Color Commander",
        "Legendary Creature - Dragon",
        5,
        "",
        { color_identity: ["W", "U", "B", "R", "G"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Simple Signet",
        "Artifact",
        2,
        "{T}: Add one mana of any color.",
      ),
      createResolvedCard(
        "mainboard",
        20,
        "Three Color Spell",
        "Sorcery",
        3,
        "",
        { mana_cost: "{W}{U}{B}" },
      ),
      createResolvedCard(
        "mainboard",
        20,
        "Other Three Color Spell",
        "Sorcery",
        3,
        "",
        { mana_cost: "{B}{R}{G}" },
      ),
      createResolvedCard(
        "mainboard",
        20,
        "Two Color Spell",
        "Creature - Wizard",
        2,
        "",
        { mana_cost: "{G}{W}" },
      ),
      createResolvedCard(
        "mainboard",
        38,
        "Filler Spell",
        "Artifact",
        2,
        "",
        { mana_cost: "{2}" },
      ),
    ]),
  );

  assert.ok(lowDemand.recommendations.fixingTarget >= 1);
  assert.ok(lowDemand.recommendations.fixingTarget <= 2);
  assert.ok(highDemand.recommendations.fixingTarget >= 8);
  assert.ok(highDemand.recommendations.fixingTarget > lowDemand.recommendations.fixingTarget);
});

test("analyzeDeckRamp does not hand out 100 to overbuilt ramp packages", () => {
  const analysis = analyzeDeckRamp(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Three-Color Commander",
        "Legendary Creature - Dragon",
        4,
        "",
        { color_identity: ["W", "U", "B"] },
      ),
      createResolvedCard(
        "mainboard",
        16,
        "Perfect Rock",
        "Artifact",
        2,
        "{T}: Add one mana of any color.",
      ),
      createResolvedCard(
        "mainboard",
        8,
        "Land Ramp Spell",
        "Sorcery",
        2,
        "Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
      ),
      createResolvedCard(
        "mainboard",
        10,
        "Tribal Reducer",
        "Artifact",
        3,
        "As this artifact enters, choose a creature type. Creature spells of the chosen type cost {2} less to cast.",
      ),
      createResolvedCard(
        "mainboard",
        65,
        "Filler Spell",
        "Sorcery",
        2,
        "",
        { mana_cost: "{W}{U}" },
      ),
    ]),
  );

  assert.ok(analysis.counts.core > analysis.recommendations.coreTarget + 10);
  assert.ok(analysis.rampScore < 100);
});

test("analyzeDeckRamp still rewards slightly heavy but reasonable ramp packages", () => {
  const analysis = analyzeDeckRamp(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Three-Color Commander",
        "Legendary Creature - Dragon",
        4,
        "",
        { color_identity: ["W", "U", "B"] },
      ),
      createResolvedCard(
        "mainboard",
        7,
        "Perfect Rock",
        "Artifact",
        2,
        "{T}: Add one mana of any color.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Land Ramp Spell",
        "Sorcery",
        2,
        "Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Useful Reducer",
        "Artifact",
        3,
        "Blue spells you cast cost {1} less to cast.",
      ),
      createResolvedCard(
        "mainboard",
        89,
        "Filler Spell",
        "Sorcery",
        3,
        "",
        { mana_cost: "{1}{W}{U}" },
      ),
    ]),
  );

  assert.ok(analysis.counts.core >= analysis.recommendations.coreTarget);
  assert.ok(analysis.counts.core <= analysis.recommendations.coreTarget + 2);
  assert.ok(analysis.rampScore >= 72);
});

test("analyzeDeckRamp punishes decks that miss the ramp baseline", () => {
  const analysis = analyzeDeckRamp(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Three-Color Commander",
        "Legendary Creature - Dragon",
        4,
        "",
        { color_identity: ["W", "U", "B"] },
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Perfect Rock",
        "Artifact",
        2,
        "{T}: Add one mana of any color.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Land Ramp Spell",
        "Sorcery",
        2,
        "Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle.",
      ),
      createResolvedCard(
        "mainboard",
        93,
        "Filler Spell",
        "Sorcery",
        3,
        "",
        { mana_cost: "{1}{W}{U}" },
      ),
    ]),
  );

  assert.ok(analysis.counts.core < analysis.recommendations.coreTarget);
  assert.ok(analysis.counts.stable < analysis.recommendations.stableTarget);
  assert.ok(analysis.rampScore <= 35);
});

test("analyzeDeckRamp lowers impossible ramp expectations outside green", () => {
  const monoBlue = analyzeDeckRamp(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Mono-Blue Commander",
        "Legendary Creature - Wizard",
        3,
        "",
        { color_identity: ["U"] },
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Mana Rock",
        "Artifact",
        2,
        "{T}: Add one mana of any color.",
      ),
      createResolvedCard("mainboard", 94, "Filler Spell", "Instant", 2, ""),
    ]),
  );

  const monoGreen = analyzeDeckRamp(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Mono-Green Commander",
        "Legendary Creature - Elf",
        3,
        "",
        { color_identity: ["G"] },
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Mana Rock",
        "Artifact",
        2,
        "{T}: Add one mana of any color.",
      ),
      createResolvedCard("mainboard", 94, "Filler Spell", "Creature - Elf", 2, ""),
    ]),
  );

  assert.ok(monoBlue.recommendations.stableTarget < monoGreen.recommendations.stableTarget);
  assert.ok(monoBlue.recommendations.coreTarget < monoGreen.recommendations.coreTarget);
  assert.ok(
    monoBlue.findings.some((finding) => finding.message.includes("rocks, doublers, and cost reducers")),
  );
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
