import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckStrategy } from "./strategyAnalysis";
import {
  DeckResolutionDocument,
  DeckSection,
  DeckWinConditionAnalysis,
  ResolvedDeckCard,
  ScryfallCard,
} from "./types";

test("analyzeDeckStrategy identifies spellslinger shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Spell Commander",
        "Legendary Creature - Wizard",
        3,
        "Whenever you cast or copy an instant or sorcery spell, draw a card.",
        { color_identity: ["U", "R"] },
      ),
      createResolvedCard("mainboard", 18, "Cantrip", "Instant", 1, "Draw a card."),
      createResolvedCard(
        "mainboard",
        8,
        "Spell Copy",
        "Instant",
        2,
        "Copy target instant or sorcery spell. You may choose new targets for the copy.",
      ),
      createResolvedCard(
        "mainboard",
        6,
        "Magecraft Engine",
        "Creature - Human Wizard",
        2,
        "Magecraft — Whenever you cast or copy an instant or sorcery spell, this deals 1 damage to each opponent.",
      ),
      createResolvedCard("mainboard", 67, "Filler", "Sorcery", 2, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "spellslinger");
  assert.ok((analysis.mainStrategy?.score ?? 0) >= 70);
  assert.ok((analysis.synergy?.synergyScore ?? 0) >= 70);
  assert.ok((analysis.synergy?.supportCards ?? 0) >= 20);
});

test("analyzeDeckStrategy identifies X-spell shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Mana Commander",
        "Legendary Creature - Wizard",
        4,
        "Whenever you cast a spell with X in its mana cost, draw a card. {T}: Add two mana in any combination of colors. Spend this mana only to cast spells with X in their mana costs.",
        { color_identity: ["U", "R", "G"] },
      ),
      createResolvedCard(
        "mainboard",
        2,
        "Crackle with Power",
        "Sorcery",
        5,
        "Crackle with Power deals five times X damage to each of up to X targets.",
        { mana_cost: "{X}{X}{X}{R}{R}" },
      ),
      createResolvedCard(
        "mainboard",
        2,
        "Blue Sun's Zenith",
        "Instant",
        3,
        "Target player draws X cards. Shuffle Blue Sun's Zenith into its owner's library.",
        { mana_cost: "{X}{U}{U}{U}" },
      ),
      createResolvedCard(
        "mainboard",
        2,
        "Finale of Devastation",
        "Sorcery",
        2,
        "Search your library and/or graveyard for a creature card with mana value X or less and put it onto the battlefield. If X is 10 or more, creatures you control get +X/+X and gain haste until end of turn.",
        { mana_cost: "{X}{G}{G}" },
      ),
      createResolvedCard(
        "mainboard",
        2,
        "Hangarback Walker",
        "Artifact Creature - Construct",
        0,
        "Hangarback Walker enters the battlefield with X +1/+1 counters on it. When Hangarback Walker dies, create a 1/1 colorless Thopter artifact creature token with flying for each +1/+1 counter on Hangarback Walker.",
        { mana_cost: "{X}{X}" },
      ),
      createResolvedCard("mainboard", 8, "Mana Rock", "Artifact", 2, "{T}: Add one mana of any color."),
      createResolvedCard("mainboard", 12, "Ramp Spell", "Sorcery", 2, "Search your library for a basic land card, put that card onto the battlefield tapped, then shuffle."),
      createResolvedCard("mainboard", 73, "Filler Creature", "Creature - Elk", 2, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "x_spells");
  assert.ok((analysis.mainStrategy?.score ?? 0) >= 70);
  assert.ok(analysis.mainStrategy?.keyCards.includes("Crackle with Power"));
  assert.ok((analysis.synergy?.supportCards ?? 0) >= 8);
});

test("analyzeDeckStrategy identifies blink shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Blink Commander",
        "Legendary Creature - Spirit",
        4,
        "Whenever Blink Commander deals combat damage to a player, exile any number of target nonland permanents you control, then return those cards to the battlefield under their owner's control.",
        { color_identity: ["W", "U"] },
      ),
      createResolvedCard(
        "mainboard",
        10,
        "Blink Spell",
        "Instant",
        1,
        "Exile target creature you control, then return it to the battlefield under its owner's control.",
      ),
      createResolvedCard(
        "mainboard",
        12,
        "ETB Creature",
        "Creature - Human",
        3,
        "When ETB Creature enters the battlefield, draw a card.",
      ),
      ...createVariedFillerCreatures([
        ["Soldier Filler", "Creature - Soldier", 11],
        ["Cleric Filler", "Creature - Cleric", 11],
        ["Wizard Filler", "Creature - Wizard", 11],
        ["Knight Filler", "Creature - Knight", 11],
        ["Bird Filler", "Creature - Bird", 11],
        ["Elemental Filler", "Creature - Elemental", 11],
        ["Scout Filler", "Creature - Scout", 11],
      ]),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "blink");
  assert.ok((analysis.mainStrategy?.score ?? 0) >= 65);
});

test("analyzeDeckStrategy links enablers with otherwise quiet material cards", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Plain Commander",
        "Legendary Creature - Advisor",
        3,
        "",
        { color_identity: ["G", "W"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Toughness Enabler",
        "Enchantment",
        2,
        "Each creature you control assigns combat damage equal to its toughness rather than its power.",
      ),
      createResolvedCard(
        "mainboard",
        10,
        "Quiet Wall",
        "Creature - Wall",
        2,
        "",
        { power: "0", toughness: "4", keywords: ["Defender"] },
      ),
      createResolvedCard("mainboard", 20, "Forest", "Basic Land - Forest", 0, ""),
      createResolvedCard("mainboard", 58, "Plains", "Basic Land - Plains", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "toughness_matter");
  assert.ok((analysis.synergy?.supportCards ?? 0) >= 10);
  assert.ok(analysis.mainStrategy?.keyCards.includes("Quiet Wall"));
});

test("analyzeDeckStrategy identifies aristocrats with token support", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Sacrifice Commander",
        "Legendary Creature - Devil",
        4,
        "Whenever you sacrifice another creature, each opponent loses 1 life and you gain 1 life.",
        { color_identity: ["B", "R"] },
      ),
      createResolvedCard(
        "mainboard",
        16,
        "Token Maker",
        "Sorcery",
        3,
        "Create three 1/1 creature tokens.",
      ),
      createResolvedCard(
        "mainboard",
        10,
        "Sac Outlet",
        "Creature - Vampire",
        2,
        "Sacrifice another creature: Draw a card.",
      ),
      createResolvedCard(
        "mainboard",
        8,
        "Death Payoff",
        "Enchantment",
        2,
        "Whenever another creature dies, each opponent loses 1 life and you gain 1 life.",
      ),
      ...createVariedFillerCreatures([
        ["Skeleton Filler", "Creature - Skeleton", 10],
        ["Bat Filler", "Creature - Bat", 10],
        ["Warlock Filler", "Creature - Warlock", 10],
        ["Zombie Filler", "Creature - Zombie", 10],
        ["Rat Filler", "Creature - Rat", 10],
        ["Vampire Filler", "Creature - Vampire", 10],
        ["Imp Filler", "Creature - Imp", 9],
      ]),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "aristocrats");
  assert.ok(analysis.subStrategies.some((entry) => entry.key === "tokens"));
});

test("analyzeDeckStrategy reads Teysa Karlov as aristocrats plus tokens", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Teysa Karlov",
        "Legendary Creature - Human Advisor",
        4,
        "If a creature dying causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time. Creature tokens you control have vigilance and lifelink.",
        { color_identity: ["W", "B"] },
      ),
      createResolvedCard(
        "mainboard",
        8,
        "Death Payoff",
        "Creature - Vampire",
        2,
        "Whenever another creature dies, each opponent loses 1 life and you gain 1 life.",
      ),
      createResolvedCard(
        "mainboard",
        8,
        "Token Fodder",
        "Sorcery",
        3,
        "Create two 1/1 creature tokens.",
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Sac Outlet",
        "Creature - Vampire",
        2,
        "Sacrifice another creature: Draw a card.",
      ),
      createResolvedCard("mainboard", 78, "Plains", "Basic Land - Plains", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "aristocrats");
  assert.ok(analysis.subStrategies.some((entry) => entry.key === "tokens"));
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy reads Kadena-style commanders as face-down build-arounds", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Kadena, Slinking Sorcerer",
        "Legendary Creature - Naga Wizard",
        4,
        "The first face-down creature spell you cast each turn costs {3} less to cast. Whenever a face-down creature enters the battlefield under your control, draw a card.",
        { color_identity: ["B", "G", "U"] },
      ),
      createResolvedCard(
        "mainboard",
        6,
        "Morph Creature",
        "Creature - Beast",
        4,
        "Morph {3}{G}. When this creature is turned face up, destroy target artifact or enchantment.",
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Manifest Engine",
        "Enchantment",
        4,
        "At the beginning of your end step, manifest the top card of your library.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Disguise Trickster",
        "Creature - Faerie Rogue",
        3,
        "Disguise {2}{U}. When this creature is turned face up, counter target spell.",
        { keywords: ["Disguise"] },
      ),
      createResolvedCard("mainboard", 84, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "face_down");
  assert.equal(analysis.synergy?.commanderAligned, true);
  assert.ok((analysis.synergy?.supportCards ?? 0) >= 10);
});

test("analyzeDeckStrategy reads commander-specific dice shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Wyll, Blade of Frontiers",
        "Legendary Creature - Human Warlock",
        2,
        "If you would roll one or more dice, instead roll that many dice plus one and ignore the lowest roll.",
        { color_identity: ["R"] },
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Dice Payoff",
        "Creature - Barbarian",
        3,
        "Whenever you roll one or more dice, this creature deals 1 damage to each opponent.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "D20 Spell",
        "Sorcery",
        3,
        "Roll a d20. Create Treasure tokens equal to the result.",
      ),
      createResolvedCard("mainboard", 91, "Mountain", "Basic Land - Mountain", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "dice_rolls");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy reads commander-specific counter shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Counter Commander",
        "Legendary Creature - Elf Druid",
        3,
        "If one or more +1/+1 counters would be put on a creature you control, twice that many +1/+1 counters are put on it instead.",
        { color_identity: ["G"] },
      ),
      createResolvedCard(
        "mainboard",
        7,
        "Counter Creature",
        "Creature - Elf",
        2,
        "When this creature enters, put a +1/+1 counter on target creature you control.",
      ),
      createResolvedCard(
        "mainboard",
        3,
        "Proliferate Spell",
        "Sorcery",
        3,
        "Proliferate.",
      ),
      createResolvedCard("mainboard", 89, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "counters");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy reads Obeka-style extra-upkeep commanders", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Obeka, Splitter of Seconds",
        "Legendary Creature - Ogre Warlock",
        4,
        "Menace. Whenever Obeka deals combat damage to a player, you get that many additional upkeep steps after this phase.",
        { color_identity: ["U", "B", "R"] },
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Upkeep Payoff",
        "Enchantment",
        3,
        "At the beginning of your upkeep, each opponent loses 1 life and you draw a card.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Cumulative Engine",
        "Enchantment",
        2,
        "Cumulative upkeep {1}. At the beginning of your upkeep, create a Treasure token.",
      ),
      createResolvedCard("mainboard", 90, "Swamp", "Basic Land - Swamp", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "extra_upkeep");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy reads Hylda-style tap/untap commanders", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Hylda of the Icy Crown",
        "Legendary Creature - Human Warlock",
        4,
        "Whenever you tap an untapped creature an opponent controls, you may pay {1}. When you do, choose one — Create a 4/4 creature token; put a +1/+1 counter on each creature you control; or scry 2, then draw a card.",
        { color_identity: ["W", "U"] },
      ),
      createResolvedCard(
        "mainboard",
        7,
        "Tap Spell",
        "Instant",
        2,
        "Tap target creature. Put a stun counter on it.",
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Tapped Payoff",
        "Creature - Wizard",
        3,
        "Whenever you tap a creature an opponent controls, draw a card.",
      ),
      createResolvedCard("mainboard", 87, "Island", "Basic Land - Island", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "tap_untap");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy exposes alternate strategy perspectives for review", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Sacrifice Commander",
        "Legendary Creature - Devil",
        4,
        "Whenever you sacrifice another creature, each opponent loses 1 life and you gain 1 life.",
        { color_identity: ["B", "R"] },
      ),
      createResolvedCard(
        "mainboard",
        16,
        "Token Maker",
        "Sorcery",
        3,
        "Create three 1/1 creature tokens.",
      ),
      createResolvedCard(
        "mainboard",
        10,
        "Sac Outlet",
        "Creature - Vampire",
        2,
        "Sacrifice another creature: Draw a card.",
      ),
      createResolvedCard(
        "mainboard",
        8,
        "Death Payoff",
        "Enchantment",
        2,
        "Whenever another creature dies, each opponent loses 1 life and you gain 1 life.",
      ),
      ...createVariedFillerCreatures([
        ["Skeleton Filler", "Creature - Skeleton", 10],
        ["Bat Filler", "Creature - Bat", 10],
        ["Warlock Filler", "Creature - Warlock", 10],
        ["Zombie Filler", "Creature - Zombie", 10],
        ["Rat Filler", "Creature - Rat", 10],
        ["Vampire Filler", "Creature - Vampire", 10],
        ["Imp Filler", "Creature - Imp", 9],
      ]),
    ]),
    createEmptyWinConditions(),
  );

  const mainPerspective = analysis.perspectives.find(
    (perspective) => perspective.strategy.key === "aristocrats",
  );
  const tokensPerspective = analysis.perspectives.find(
    (perspective) => perspective.strategy.key === "tokens",
  );

  assert.ok(mainPerspective);
  assert.ok(tokensPerspective);
  assert.ok(mainPerspective?.subStrategies.some((entry) => entry.key === "tokens"));
  assert.ok(tokensPerspective?.subStrategies.some((entry) => entry.key === "aristocrats"));
  assert.ok((tokensPerspective?.synergy.supportCards ?? 0) > 0);
});

test("analyzeDeckStrategy identifies extra combat shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Combat Commander",
        "Legendary Creature - Human Warrior",
        4,
        "Whenever Combat Commander attacks, untap each creature you control. After this phase, there is an additional combat phase.",
        { color_identity: ["R", "W"] },
      ),
      createResolvedCard(
        "mainboard",
        10,
        "Extra Combat Spell",
        "Sorcery",
        4,
        "Untap all creatures you control. After this phase, there is an additional combat phase.",
      ),
      createResolvedCard(
        "mainboard",
        10,
        "Attack Payoff",
        "Creature - Warrior",
        3,
        "Whenever Attack Payoff attacks, it gets +1/+0 until end of turn.",
      ),
      ...createVariedFillerCreatures([
        ["Knight Filler", "Creature - Knight", 12],
        ["Rogue Filler", "Creature - Rogue", 12],
        ["Soldier Filler", "Creature - Soldier", 12],
        ["Samurai Filler", "Creature - Samurai", 12],
        ["Angel Filler", "Creature - Angel", 12],
        ["Goblin Filler", "Creature - Goblin", 12],
      ]),
      createResolvedCard("mainboard", 27, "Mountain", "Basic Land - Mountain", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "extra_combat");
});

test("analyzeDeckStrategy identifies kindred shells with a specific tribe label", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Dragon Commander",
        "Legendary Creature - Dragon",
        6,
        "Other Dragons you control get +1/+1.",
        { color_identity: ["R", "G"] },
      ),
      createResolvedCard(
        "mainboard",
        8,
        "Dragon Lord",
        "Creature - Dragon",
        5,
        "Dragons you control have haste.",
      ),
      createResolvedCard(
        "mainboard",
        8,
        "Dragon's Banner",
        "Artifact",
        3,
        "As Dragon's Banner enters, choose a creature type. Creatures you control of the chosen type get +1/+1.",
      ),
      createResolvedCard("mainboard", 20, "Dragon Filler", "Creature - Dragon", 5, ""),
      createResolvedCard("mainboard", 63, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "kindred");
  assert.equal(analysis.mainStrategy?.label, "Dragon Kindred");
});

test("analyzeDeckStrategy uses exact combo lines as a real strategy signal", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Artifact Commander",
        "Legendary Creature - Artificer",
        4,
        "",
        { color_identity: ["U"] },
      ),
      createResolvedCard("mainboard", 1, "Isochron Scepter", "Artifact", 2, ""),
      createResolvedCard("mainboard", 1, "Dramatic Reversal", "Instant", 2, ""),
      createResolvedCard("mainboard", 1, "Sol Ring", "Artifact", 1, ""),
      createResolvedCard("mainboard", 96, "Island", "Basic Land - Island", 0, ""),
    ]),
    {
      ...createEmptyWinConditions(),
      combos: {
        source: "Commander Spellbook",
        lookupStatus: "ok",
        exactCount: 1,
        finisherCount: 0,
        engineCount: 1,
        nearMissCount: 0,
        exact: [
          {
            id: "dramatic-scepter",
            comboValue: 1.3,
            lineType: "engine",
            cardNames: ["Dramatic Reversal", "Isochron Scepter"],
            outcomeNames: ["Infinite mana nonland permanents you control can produce"],
            description: "Infinite mana loop.",
            manaNeeded: "",
            notablePrerequisites: [],
            bracketTag: "S",
            variantCount: 1,
            commanderInvolved: false,
          },
        ],
      },
    },
  );

  assert.ok(analysis.topStrategies.some((entry) => entry.key === "combo"));
  assert.ok(
    (analysis.topStrategies.find((entry) => entry.key === "combo")?.score ?? 0) >= 30,
  );
});

test("analyzeDeckStrategy counts exact combo pieces toward combo synergy", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Combo Commander",
        "Legendary Creature - Human Artificer",
        4,
        "Artifacts you control have \"{T}: Add {U}.\"",
        { color_identity: ["U"] },
      ),
      createResolvedCard("mainboard", 1, "Isochron Scepter", "Artifact", 2, ""),
      createResolvedCard("mainboard", 1, "Dramatic Reversal", "Instant", 2, ""),
      createResolvedCard("mainboard", 1, "Basalt Monolith", "Artifact", 3, "{T}: Add {C}{C}{C}."),
      createResolvedCard("mainboard", 1, "Power Artifact", "Enchantment - Aura", 2, "Enchant artifact"),
      createResolvedCard("mainboard", 1, "Rings of Brighthearth", "Artifact", 3, ""),
      createResolvedCard("mainboard", 1, "Voltaic Key", "Artifact", 1, "{1}, {T}: Untap target artifact."),
      createResolvedCard("mainboard", 93, "Island", "Basic Land - Island", 0, ""),
    ]),
    {
      ...createEmptyWinConditions(),
      combos: {
        source: "Commander Spellbook",
        lookupStatus: "ok",
        exactCount: 3,
        finisherCount: 1,
        engineCount: 2,
        nearMissCount: 4,
        exact: [
          {
            id: "scepter",
            comboValue: 1.2,
            lineType: "engine",
            cardNames: ["Combo Commander", "Isochron Scepter", "Dramatic Reversal"],
            outcomeNames: ["Infinite mana"],
            description: "",
            manaNeeded: "",
            notablePrerequisites: [],
            bracketTag: "S",
            variantCount: 1,
            commanderInvolved: true,
          },
          {
            id: "basalt",
            comboValue: 1.2,
            lineType: "engine",
            cardNames: ["Basalt Monolith", "Power Artifact"],
            outcomeNames: ["Infinite colorless mana"],
            description: "",
            manaNeeded: "",
            notablePrerequisites: [],
            bracketTag: "S",
            variantCount: 1,
            commanderInvolved: false,
          },
          {
            id: "rings",
            comboValue: 1.2,
            lineType: "finisher",
            cardNames: ["Basalt Monolith", "Rings of Brighthearth", "Voltaic Key"],
            outcomeNames: ["Infinite mana and activations"],
            description: "",
            manaNeeded: "",
            notablePrerequisites: [],
            bracketTag: "S",
            variantCount: 1,
            commanderInvolved: false,
          },
        ],
      },
    },
  );

  const comboPerspective = analysis.perspectives.find(
    (perspective) => perspective.strategy.key === "combo",
  );

  assert.ok(comboPerspective);
  assert.ok((comboPerspective?.synergy.supportCards ?? 0) >= 6);
  assert.ok((comboPerspective?.synergy.coreCards ?? 0) >= 5);
  assert.ok((comboPerspective?.synergy.synergyScore ?? 0) >= 70);
  assert.equal(comboPerspective?.synergy.commanderAligned, true);
});

test("analyzeDeckStrategy gives a secret commander a small extra pull", () => {
  const document = createDocument([
    createResolvedCard(
      "commander",
      1,
      "Value Commander",
      "Legendary Creature - Human Wizard",
      4,
      "Draw a card.",
      { color_identity: ["U", "B"] },
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Hidden Reanimator",
      "Creature - Horror",
      5,
      "At the beginning of your end step, you may return target creature card from your graveyard to the battlefield.",
    ),
    createResolvedCard(
      "mainboard",
      8,
      "Reanimate Spell",
      "Sorcery",
      2,
      "Return target creature card from your graveyard to the battlefield.",
    ),
    createResolvedCard("mainboard", 90, "Swamp", "Basic Land - Swamp", 0, ""),
  ]);

  const baseAnalysis = analyzeDeckStrategy(document, createEmptyWinConditions());
  const secretCommanderAnalysis = analyzeDeckStrategy(document, createEmptyWinConditions(), {
    secretCommanderName: "Hidden Reanimator",
  });

  assert.ok(
    (secretCommanderAnalysis.topStrategies.find((entry) => entry.key === "reanimator")?.rawScore ??
      0) >
      (baseAnalysis.topStrategies.find((entry) => entry.key === "reanimator")?.rawScore ?? 0),
  );
});

test("analyzeDeckStrategy can promote a selected alternate perspective to the active main plan", () => {
  const document = createDocument([
    createResolvedCard(
      "commander",
      1,
      "Sacrifice Commander",
      "Legendary Creature - Devil",
      4,
      "Whenever you sacrifice another creature, each opponent loses 1 life and you gain 1 life.",
      { color_identity: ["B", "R"] },
    ),
    createResolvedCard(
      "mainboard",
      16,
      "Token Maker",
      "Sorcery",
      3,
      "Create three 1/1 creature tokens.",
    ),
    createResolvedCard(
      "mainboard",
      10,
      "Sac Outlet",
      "Creature - Vampire",
      2,
      "Sacrifice another creature: Draw a card.",
    ),
    createResolvedCard(
      "mainboard",
      8,
      "Death Payoff",
      "Enchantment",
      2,
      "Whenever another creature dies, each opponent loses 1 life and you gain 1 life.",
    ),
    ...createVariedFillerCreatures([
      ["Skeleton Filler", "Creature - Skeleton", 10],
      ["Bat Filler", "Creature - Bat", 10],
      ["Warlock Filler", "Creature - Warlock", 10],
      ["Zombie Filler", "Creature - Zombie", 10],
      ["Rat Filler", "Creature - Rat", 10],
      ["Vampire Filler", "Creature - Vampire", 10],
      ["Imp Filler", "Creature - Imp", 9],
    ]),
  ]);

  const detectedAnalysis = analyzeDeckStrategy(document, createEmptyWinConditions());
  const selectedAnalysis = analyzeDeckStrategy(document, createEmptyWinConditions(), {
    preferredStrategyKey: "tokens",
  });

  assert.equal(detectedAnalysis.mainStrategy?.key, "aristocrats");
  assert.equal(selectedAnalysis.detectedMainStrategy?.key, "aristocrats");
  assert.equal(selectedAnalysis.mainStrategy?.key, "tokens");
});

test("analyzeDeckStrategy marks thin theme support as low synergy", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Loose Token Commander",
        "Legendary Creature - Soldier",
        4,
        "Whenever Loose Token Commander attacks, create a 1/1 creature token.",
        { color_identity: ["W", "R"] },
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Token Maker",
        "Sorcery",
        3,
        "Create two 1/1 creature tokens.",
      ),
      createResolvedCard("mainboard", 95, "Mountain", "Basic Land - Mountain", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "tokens");
  assert.ok((analysis.synergy?.synergyScore ?? 100) < 60);
});

test("analyzeDeckStrategy flags thin commander profile support in synergy", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Kadena, Slinking Sorcerer",
        "Legendary Creature - Naga Wizard",
        4,
        "The first face-down creature spell you cast each turn costs {3} less to cast. Whenever a face-down creature enters the battlefield under your control, draw a card.",
        { color_identity: ["B", "G", "U"] },
      ),
      createResolvedCard("mainboard", 2, "Morph Creature", "Creature - Beast", 3, "Morph {2}{G}."),
      createResolvedCard("mainboard", 97, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "face_down");
  assert.ok((analysis.synergy?.synergyScore ?? 100) < 60);
  assert.ok(
    analysis.synergy?.findings.some((finding) => finding.code === "strategy_commander_profile_gap"),
  );
});

test("analyzeDeckStrategy rewards supported commander profile packages", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Kadena, Slinking Sorcerer",
        "Legendary Creature - Naga Wizard",
        4,
        "The first face-down creature spell you cast each turn costs {3} less to cast. Whenever a face-down creature enters the battlefield under your control, draw a card.",
        { color_identity: ["B", "G", "U"] },
      ),
      createResolvedCard("mainboard", 9, "Morph Creature", "Creature - Beast", 3, "Morph {2}{G}."),
      createResolvedCard("mainboard", 4, "Manifest Engine", "Enchantment", 3, "At the beginning of your upkeep, manifest the top card of your library."),
      createResolvedCard("mainboard", 1, "Trail of Mystery", "Enchantment", 2, "Whenever a face-down creature enters the battlefield under your control, you may search your library for a basic land card."),
      createResolvedCard("mainboard", 85, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "face_down");
  assert.ok((analysis.synergy?.synergyScore ?? 0) >= 70);
  assert.ok(
    analysis.synergy?.findings.some((finding) => finding.code === "strategy_commander_profile_good"),
  );
});

test("analyzeDeckStrategy identifies superfriends shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Loyalty Commander",
        "Legendary Creature - Human Wizard",
        4,
        "Planeswalkers you control have \"[+1]: Draw a card.\"",
        { color_identity: ["W", "U", "R"] },
      ),
      createResolvedCard(
        "mainboard",
        7,
        "Support Walker",
        "Planeswalker - Tezzeret",
        4,
        "+1: Draw a card. -3: Create a 1/1 token.",
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Loyalty Engine",
        "Enchantment",
        3,
        "At the beginning of your end step, proliferate. You may activate loyalty abilities of planeswalkers you control twice each turn rather than only once.",
      ),
      createResolvedCard("mainboard", 87, "Island", "Basic Land - Island", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "superfriends");
  assert.ok(analysis.subStrategies.some((entry) => entry.key === "counters"));
});

test("analyzeDeckStrategy identifies group hug shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Friendly Commander",
        "Legendary Creature - Advisor",
        4,
        "At the beginning of each player's draw step, that player draws an additional card.",
        { color_identity: ["G", "U", "W"] },
      ),
      createResolvedCard(
        "mainboard",
        8,
        "Table Gift",
        "Enchantment",
        3,
        "Each player may draw a card. Each player may put a land card from their hand onto the battlefield.",
      ),
      createResolvedCard(
        "mainboard",
        6,
        "Mana Flare Style",
        "Enchantment",
        3,
        "Whenever a player taps a land for mana, that player adds one mana of any type that land produced.",
      ),
      createResolvedCard("mainboard", 85, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "group_hug");
});

test("analyzeDeckStrategy keeps self-mill in reanimator instead of mill", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Graveyard Commander",
        "Legendary Creature - Zombie Wizard",
        4,
        "At the beginning of your end step, return target creature card from your graveyard to your hand.",
        { color_identity: ["U", "B"] },
      ),
      createResolvedCard("mainboard", 12, "Self Mill Spell", "Sorcery", 2, "Mill three cards."),
      createResolvedCard("mainboard", 8, "Surveil Setup", "Instant", 2, "Surveil 2, then draw a card."),
      createResolvedCard(
        "mainboard",
        10,
        "Reanimate Spell",
        "Sorcery",
        3,
        "Return target creature card from your graveyard to the battlefield.",
      ),
      createResolvedCard("mainboard", 69, "Swamp", "Basic Land - Swamp", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "reanimator");
  assert.ok(!analysis.subStrategies.some((entry) => entry.key === "mill"));
});

test("analyzeDeckStrategy still identifies opponent-mill shells as mill", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Mill Commander",
        "Legendary Creature - Horror",
        4,
        "Whenever one or more cards are put into an opponent's graveyard from their library, draw a card.",
        { color_identity: ["U", "B"] },
      ),
      createResolvedCard("mainboard", 14, "Mind Grind", "Sorcery", 3, "Target player mills four cards."),
      createResolvedCard(
        "mainboard",
        8,
        "Mill Payoff",
        "Enchantment",
        3,
        "Whenever one or more cards are put into an opponent's graveyard from their library, each opponent loses 1 life.",
      ),
      createResolvedCard("mainboard", 77, "Island", "Basic Land - Island", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "mill");
});

test("analyzeDeckStrategy labels counter decks by dominant counter subtype", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Charge Commander",
        "Legendary Creature - Vedalken Artificer",
        3,
        "Artifacts you control enter with an additional charge counter on them.",
        { color_identity: ["U"] },
      ),
      createResolvedCard(
        "mainboard",
        10,
        "Charge Engine",
        "Artifact",
        2,
        "Charge Engine enters the battlefield with two charge counters on it. Remove a charge counter from Charge Engine: Add {U}.",
      ),
      createResolvedCard(
        "mainboard",
        8,
        "Counter Battery",
        "Artifact",
        3,
        "Put a charge counter on target artifact. Proliferate.",
      ),
      createResolvedCard("mainboard", 81, "Island", "Basic Land - Island", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "counters");
  assert.equal(analysis.mainStrategy?.label, "Counters (Charge)");
});

test("analyzeDeckStrategy identifies dice-roll packages", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Dice Commander",
        "Legendary Creature - Elf Shaman",
        3,
        "Whenever you roll one or more dice, create a 1/1 red Goblin creature token.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Dice Class",
        "Enchantment - Class",
        1,
        "If you would roll one or more dice, instead roll that many dice plus one and ignore the lowest roll.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Dice Payoff",
        "Artifact",
        3,
        "Whenever you roll a d20, put a charge counter on this artifact.",
      ),
      createResolvedCard("mainboard", 91, "Mountain", "Basic Land - Mountain", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "dice_rolls");
  assert.ok((analysis.mainStrategy?.score ?? 0) >= 70);
});

test("analyzeDeckStrategy identifies coin-flip packages", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Coin Commander",
        "Legendary Creature - Goblin",
        3,
        "Whenever you win a coin flip, draw a card.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Coin Doubler",
        "Artifact",
        2,
        "If you would flip a coin, instead flip two coins and ignore one.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Coin Payoff",
        "Enchantment",
        3,
        "Whenever a player flips a coin, target opponent loses 1 life.",
      ),
      createResolvedCard("mainboard", 91, "Mountain", "Basic Land - Mountain", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "coin_flip");
  assert.ok((analysis.mainStrategy?.score ?? 0) >= 70);
});

test("analyzeDeckStrategy identifies face-down morph shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Kadena, Slinking Sorcerer",
        "Legendary Creature - Naga Wizard",
        4,
        "The first face-down creature spell you cast each turn costs {3} less to cast. Whenever a face-down creature enters the battlefield under your control, draw a card.",
        { color_identity: ["B", "G", "U"] },
      ),
      createResolvedCard(
        "mainboard",
        8,
        "Morph Creature",
        "Creature - Beast",
        3,
        "Morph {2}{G}. When this creature is turned face up, destroy target artifact or enchantment.",
        { keywords: ["Morph"] },
      ),
      createResolvedCard(
        "mainboard",
        6,
        "Manifest Engine",
        "Enchantment",
        4,
        "At the beginning of your end step, manifest the top card of your library.",
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Disguise Creature",
        "Creature - Shapeshifter",
        3,
        "Disguise {2}{U}. When this creature is turned face up, counter target spell unless its controller pays {2}.",
        { keywords: ["Disguise"] },
      ),
      createResolvedCard("mainboard", 80, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "face_down");
  assert.ok((analysis.mainStrategy?.score ?? 0) >= 70);
  assert.ok((analysis.synergy?.supportCards ?? 0) >= 10);
});

test("analyzeDeckStrategy amplifies narrow commander themes when the 99 follows the commander", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Kadena, Slinking Sorcerer",
        "Legendary Creature - Naga Wizard",
        4,
        "The first face-down creature spell you cast each turn costs {3} less to cast. Whenever a face-down creature enters the battlefield under your control, draw a card.",
        { color_identity: ["B", "G", "U"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Ainok Survivalist",
        "Creature - Dog Shaman",
        2,
        "Megamorph {1}{G}. When Ainok Survivalist is turned face up, destroy target artifact or enchantment an opponent controls.",
        { keywords: ["Megamorph"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Kheru Spellsnatcher",
        "Creature - Naga Wizard",
        4,
        "Morph {4}{U}{U}. When Kheru Spellsnatcher is turned face up, counter target spell.",
        { keywords: ["Morph"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Secret Plans",
        "Enchantment",
        2,
        "Face-down creatures you control get +0/+1. Whenever a permanent you control is turned face up, draw a card.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Trail of Mystery",
        "Enchantment",
        2,
        "Whenever a face-down creature enters the battlefield under your control, you may search your library for a basic land card.",
      ),
      createResolvedCard("mainboard", 12, "Island", "Basic Land - Island", 0, ""),
      createResolvedCard("mainboard", 12, "Forest", "Basic Land - Forest", 0, ""),
      createResolvedCard("mainboard", 11, "Swamp", "Basic Land - Swamp", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "face_down");
  assert.ok(
    analysis.mainStrategy?.reasons.some((reason) => /explicitly points toward Face-Down/i.test(reason)),
  );
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy reads life-loss commanders as group-slug shells when the deck supports them", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Y'shtola, Night's Blessed",
        "Legendary Creature - Cat Warlock",
        3,
        "At the beginning of each end step, if a player lost 4 or more life this turn, draw a card.",
        { color_identity: ["W", "U", "B"] },
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Drain Engine",
        "Enchantment",
        3,
        "Whenever an opponent loses life, you gain 1 life.",
      ),
      createResolvedCard(
        "mainboard",
        3,
        "Table Punisher",
        "Creature - Human Warlock",
        3,
        "Whenever a player casts a spell, Table Punisher deals 1 damage to each opponent.",
      ),
      createResolvedCard("mainboard", 12, "Island", "Basic Land - Island", 0, ""),
      createResolvedCard("mainboard", 12, "Plains", "Basic Land - Plains", 0, ""),
      createResolvedCard("mainboard", 11, "Swamp", "Basic Land - Swamp", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "group_slug");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy reads toughness-matters commanders as a specific build-around", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Arcades, the Strategist",
        "Legendary Creature - Elder Dragon",
        4,
        "Flying, vigilance. Whenever a creature with defender enters the battlefield under your control, draw a card. Each creature you control with defender assigns combat damage equal to its toughness rather than its power and can attack as though it didn't have defender.",
        { color_identity: ["G", "W", "U"], power: "3", toughness: "5" },
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Wall of Blossoms",
        "Creature - Plant Wall",
        2,
        "Defender. When Wall of Blossoms enters the battlefield, draw a card.",
        { power: "0", toughness: "4" },
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Wall of Omens",
        "Creature - Wall",
        2,
        "Defender. When Wall of Omens enters the battlefield, draw a card.",
        { power: "0", toughness: "4" },
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Shield Sphere",
        "Artifact Creature - Wall",
        0,
        "Defender.",
        { power: "0", toughness: "6" },
      ),
      createResolvedCard("mainboard", 85, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "toughness_matter");
  assert.ok((analysis.mainStrategy?.score ?? 0) >= 70);
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy reads exact small-damage commanders as pinger shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Ghyrson Starn, Kelermorph",
        "Legendary Creature - Human Tyranid",
        3,
        "Ward {2}. Three Autostubs - Whenever another source you control deals exactly 1 damage to a permanent or player, Ghyrson Starn, Kelermorph deals 2 damage to that permanent or player.",
        { color_identity: ["U", "R"] },
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Prodigal Pyromancer",
        "Creature - Human Wizard",
        3,
        "{T}: Prodigal Pyromancer deals 1 damage to any target.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Thermo-Alchemist",
        "Creature - Human Shaman",
        2,
        "Defender. {T}: Thermo-Alchemist deals 1 damage to each opponent.",
      ),
      createResolvedCard(
        "mainboard",
        3,
        "End the Festivities",
        "Sorcery",
        1,
        "End the Festivities deals 1 damage to each opponent and each creature and planeswalker they control.",
      ),
      createResolvedCard("mainboard", 88, "Island", "Basic Land - Island", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "pingers");
  assert.ok((analysis.mainStrategy?.score ?? 0) >= 70);
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy lets commander-requested creature types drive kindred", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Frog Matriarch",
        "Legendary Creature - Frog Druid",
        3,
        "Whenever another Frog you control enters the battlefield, draw a card.",
        { color_identity: ["G", "U"] },
      ),
      createResolvedCard("mainboard", 8, "Frog Scout", "Creature - Frog Scout", 2, ""),
      createResolvedCard("mainboard", 7, "Frog Mystic", "Creature - Frog Wizard", 3, ""),
      createResolvedCard(
        "mainboard",
        2,
        "Frog Anthem",
        "Enchantment",
        3,
        "Frogs you control get +1/+1.",
      ),
      createResolvedCard("mainboard", 82, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "kindred");
  assert.match(analysis.mainStrategy?.label ?? "", /Frog Kindred/);
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy checks commander-requested artifacts and enchantments as deck material", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Alela, Artful Provocateur",
        "Legendary Creature - Faerie Warlock",
        4,
        "Flying, deathtouch, lifelink. Other creatures you control with flying get +1/+0. Whenever you cast an artifact or enchantment spell, create a 1/1 blue Faerie creature token with flying.",
        { color_identity: ["W", "U", "B"] },
      ),
      createResolvedCard("mainboard", 10, "Cheap Artifact", "Artifact", 2, ""),
      createResolvedCard("mainboard", 8, "Value Enchantment", "Enchantment", 3, ""),
      createResolvedCard("mainboard", 81, "Plains", "Basic Land - Plains", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  const strategyKeys = new Set([
    analysis.mainStrategy?.key,
    ...analysis.subStrategies.map((entry) => entry.key),
    ...analysis.topStrategies.slice(0, 4).map((entry) => entry.key),
  ]);
  assert.ok(strategyKeys.has("artifacts"));
  assert.ok(strategyKeys.has("enchantress"));
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy checks Vehicle-specific commanders against Vehicle density", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Vehicle Commander",
        "Legendary Creature - Pilot",
        3,
        "Vehicle spells you cast cost {1} less to cast. Whenever a Vehicle you control becomes crewed, draw a card.",
        { color_identity: ["U", "R"] },
      ),
      createResolvedCard("mainboard", 7, "Fast Car", "Artifact - Vehicle", 2, "Crew 2."),
      createResolvedCard("mainboard", 5, "Airship", "Artifact - Vehicle", 4, "Flying. Crew 3."),
      createResolvedCard("mainboard", 87, "Island", "Basic Land - Island", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "artifacts");
  assert.ok(analysis.mainStrategy?.reasons.some((reason) => /Vehicle cards/i.test(reason)));
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy checks spell-matter commanders against instant and sorcery density", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Kalamax, the Stormsire",
        "Legendary Creature - Elemental Dinosaur",
        4,
        "Whenever you cast your first instant spell each turn, if Kalamax is tapped, copy that spell. Whenever you copy an instant spell, put a +1/+1 counter on Kalamax.",
        { color_identity: ["G", "U", "R"] },
      ),
      createResolvedCard("mainboard", 14, "Instant Trick", "Instant", 1, "Draw a card."),
      createResolvedCard("mainboard", 10, "Sorcery Setup", "Sorcery", 2, "Draw two cards."),
      createResolvedCard("mainboard", 75, "Island", "Basic Land - Island", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "spellslinger");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy checks low-power creature commanders against the right creature package", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Alesha, Who Smiles at Death",
        "Legendary Creature - Human Warrior",
        3,
        "Whenever Alesha, Who Smiles at Death attacks, you may pay {W/B}{W/B}. If you do, return target creature card with power 2 or less from your graveyard to the battlefield tapped and attacking.",
        { color_identity: ["R", "W", "B"], power: "3", toughness: "2" },
      ),
      createResolvedCard(
        "mainboard",
        8,
        "Small Utility Creature",
        "Creature - Human",
        2,
        "When this creature enters the battlefield, draw a card.",
        { power: "2", toughness: "2" },
      ),
      createResolvedCard(
        "mainboard",
        6,
        "Small Removal Creature",
        "Creature - Assassin",
        3,
        "When this creature enters the battlefield, destroy target creature.",
        { power: "1", toughness: "1" },
      ),
      createResolvedCard("mainboard", 85, "Swamp", "Basic Land - Swamp", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "reanimator");
  assert.ok(analysis.mainStrategy?.reasons.some((reason) => /low-power creature/i.test(reason)));
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy keeps non-recursive low-power commanders in Power Matters", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Duskana, the Rage Mother",
        "Legendary Creature - Bear",
        5,
        "When Duskana enters the battlefield, draw a card for each creature you control with base power and toughness 2/2. Whenever a creature you control with base power and toughness 2/2 attacks, it gets +3/+3 until end of turn.",
        { color_identity: ["R", "G", "W"], power: "5", toughness: "5" },
      ),
      createResolvedCard("mainboard", 8, "Grizzly Bears", "Creature - Bear", 2, "", {
        power: "2",
        toughness: "2",
      }),
      createResolvedCard("mainboard", 6, "Watchwolf", "Creature - Wolf", 2, "", {
        power: "2",
        toughness: "2",
      }),
      createResolvedCard("mainboard", 85, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "power_matter");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies mana-value commander shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Ghalta, Primal Hunger",
        "Legendary Creature - Elder Dinosaur",
        12,
        "Whenever you cast a creature spell with mana value 5 or greater, draw a card.",
        { color_identity: ["G"], power: "12", toughness: "12" },
      ),
      createResolvedCard("mainboard", 5, "Large Dinosaur", "Creature - Dinosaur", 6, "", {
        power: "6",
        toughness: "6",
      }),
      createResolvedCard("mainboard", 5, "Large Beast", "Creature - Beast", 5, "", {
        power: "5",
        toughness: "5",
      }),
      createResolvedCard("mainboard", 89, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "mana_value_matter");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies legendary-matters commander shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Shanid, Sleepers' Scourge",
        "Legendary Creature - Human Knight",
        4,
        "Menace. Other legendary creatures you control have menace. Whenever you play a legendary land or cast a legendary spell, you draw a card and you lose 1 life.",
        { color_identity: ["R", "W", "B"], power: "2", toughness: "4" },
      ),
      createResolvedCard("mainboard", 5, "Legendary Hero", "Legendary Creature - Human", 3, "", {
        power: "3",
        toughness: "3",
      }),
      createResolvedCard("mainboard", 4, "Legendary Relic", "Legendary Artifact", 2, ""),
      createResolvedCard("mainboard", 90, "Plains", "Basic Land - Plains", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "legends_matter");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies Sefris-style dungeon venture shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Sefris of the Hidden Ways",
        "Legendary Creature - Human Wizard",
        3,
        "Whenever one or more creature cards are put into your graveyard from anywhere, venture into the dungeon. This ability triggers only once each turn. Create Undead - Whenever you complete a dungeon, return target creature card from your graveyard to the battlefield.",
        { color_identity: ["W", "U", "B"] },
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Dungeon Delver",
        "Creature - Human Rogue",
        2,
        "When Dungeon Delver enters the battlefield, venture into the dungeon.",
      ),
      createResolvedCard(
        "mainboard",
        3,
        "Initiative Scout",
        "Creature - Human Scout",
        3,
        "When Initiative Scout enters the battlefield, you take the initiative.",
      ),
      createResolvedCard(
        "mainboard",
        3,
        "Dungeon Payoff",
        "Creature - Spirit",
        4,
        "Whenever you complete a dungeon, draw a card.",
      ),
      createResolvedCard("mainboard", 89, "Island", "Basic Land - Island", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "dungeons");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies Anje-style madness discard shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Anje Falkenrath",
        "Legendary Creature - Vampire",
        3,
        "Haste. {T}, Discard a card: Draw a card. Whenever you discard a card, if it has madness, untap Anje Falkenrath.",
        { color_identity: ["B", "R"] },
      ),
      createResolvedCard(
        "mainboard",
        8,
        "Madness Spell",
        "Instant",
        2,
        "Madness {B}. Draw a card.",
        { keywords: ["Madness"] },
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Discard Payoff",
        "Enchantment",
        3,
        "Whenever you discard a card, each opponent loses 1 life.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Discard Outlet",
        "Creature - Vampire",
        2,
        "Discard a card: Draw a card.",
      ),
      createResolvedCard("mainboard", 83, "Swamp", "Basic Land - Swamp", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "madness");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies Yuriko-style ninjutsu shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Yuriko, the Tiger's Shadow",
        "Legendary Creature - Human Ninja",
        3,
        "Commander ninjutsu {U}{B}. Whenever a Ninja you control deals combat damage to a player, reveal the top card of your library and put that card into your hand. Each opponent loses life equal to that card's mana value.",
        { color_identity: ["U", "B"], keywords: ["Commander ninjutsu"] },
      ),
      createResolvedCard(
        "mainboard",
        7,
        "Ninja Attacker",
        "Creature - Human Ninja",
        2,
        "Ninjutsu {1}{U}. Whenever Ninja Attacker deals combat damage to a player, draw a card.",
        { keywords: ["Ninjutsu"] },
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Evasive One-Drop",
        "Creature - Faerie Rogue",
        1,
        "Flying. Evasive One-Drop can't be blocked except by creatures with flying or reach.",
      ),
      createResolvedCard("mainboard", 87, "Island", "Basic Land - Island", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "ninjutsu");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies Lynde-style curse shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Lynde, Cheerful Tormentor",
        "Legendary Creature - Human Warlock",
        4,
        "Deathtouch. Whenever a Curse is put into your graveyard from the battlefield, return it to the battlefield attached to you at the beginning of the next end step. At the beginning of your upkeep, you may attach a Curse attached to you to one of your opponents.",
        { color_identity: ["U", "B", "R"] },
      ),
      createResolvedCard(
        "mainboard",
        7,
        "Painful Curse",
        "Enchantment - Aura Curse",
        3,
        "Enchant player. At the beginning of enchanted player's upkeep, Painful Curse deals 2 damage to that player.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Curse Payoff",
        "Enchantment",
        4,
        "Whenever you cast a Curse spell, draw a card.",
      ),
      createResolvedCard("mainboard", 88, "Swamp", "Basic Land - Swamp", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "curses");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies Prosper-style cast-from-exile shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Prosper, Tome-Bound",
        "Legendary Creature - Tiefling Warlock",
        4,
        "Deathtouch. Mystic Arcanum - At the beginning of your end step, exile the top card of your library. Until the end of your next turn, you may play that card. Pact Boon - Whenever you play a card from exile, create a Treasure token.",
        { color_identity: ["B", "R"] },
      ),
      createResolvedCard(
        "mainboard",
        6,
        "Impulse Draw",
        "Sorcery",
        2,
        "Exile the top two cards of your library. Until the end of your next turn, you may play those cards.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Exile Payoff",
        "Creature - Devil",
        3,
        "Whenever you play a card from exile, Exile Payoff deals 1 damage to each opponent.",
      ),
      createResolvedCard("mainboard", 89, "Mountain", "Basic Land - Mountain", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "exile_cast");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies Gyome-style food shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Gyome, Master Chef",
        "Legendary Creature - Troll Warlock",
        4,
        "Trample. At the beginning of your end step, create a Food token for each nontoken creature you had enter the battlefield under your control this turn. Sacrifice a Food: Target creature gains indestructible until end of turn. Tap it.",
        { color_identity: ["B", "G"] },
      ),
      createResolvedCard(
        "mainboard",
        6,
        "Food Maker",
        "Creature - Halfling",
        2,
        "When Food Maker enters the battlefield, create a Food token.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Food Payoff",
        "Creature - Cat",
        3,
        "Whenever you sacrifice a Food, draw a card.",
      ),
      createResolvedCard("mainboard", 89, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "food");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies clue and investigate shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Morska, Undersea Sleuth",
        "Legendary Creature - Vedalken Fish Detective",
        3,
        "You have no maximum hand size. At the beginning of your upkeep, investigate. Whenever you draw your second card each turn, put a +1/+1 counter on Morska, Undersea Sleuth.",
        { color_identity: ["G", "W", "U"] },
      ),
      createResolvedCard(
        "mainboard",
        6,
        "Investigator",
        "Creature - Human Detective",
        2,
        "When Investigator enters the battlefield, investigate.",
        { keywords: ["Investigate"] },
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Clue Payoff",
        "Artifact",
        3,
        "Whenever you sacrifice a Clue, create a 1/1 creature token.",
      ),
      createResolvedCard("mainboard", 89, "Island", "Basic Land - Island", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "clues");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies Satya-style energy shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Satya, Aetherflux Genius",
        "Legendary Creature - Human Artificer",
        4,
        "Menace, haste. Whenever Satya attacks, create a tapped and attacking token that's a copy of up to one other target nontoken creature you control. You get {E}{E}. At the beginning of the next end step, sacrifice that token unless you pay an amount of {E} equal to its mana value.",
        { color_identity: ["U", "R", "W"] },
      ),
      createResolvedCard(
        "mainboard",
        6,
        "Energy Producer",
        "Creature - Human Artificer",
        2,
        "When Energy Producer enters the battlefield, you get two energy counters.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Energy Payoff",
        "Artifact",
        4,
        "Pay six energy counters: Draw three cards.",
      ),
      createResolvedCard("mainboard", 89, "Island", "Basic Land - Island", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "energy");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies Tom Bombadil-style saga shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Tom Bombadil",
        "Legendary Creature - God Bard",
        5,
        "As long as there are four or more lore counters among Sagas you control, Tom Bombadil has hexproof and indestructible. Whenever the final chapter ability of a Saga you control resolves, reveal cards from the top of your library until you reveal a Saga card. Put that card onto the battlefield.",
        { color_identity: ["W", "U", "B", "R", "G"] },
      ),
      createResolvedCard(
        "mainboard",
        8,
        "Value Saga",
        "Enchantment - Saga",
        3,
        "I, II - Draw a card. III - Create a creature token.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Saga Payoff",
        "Creature - Human Bard",
        3,
        "Whenever a lore counter is put on a Saga you control, draw a card.",
      ),
      createResolvedCard("mainboard", 87, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "sagas");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies Queen Marchesa-style monarch shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Queen Marchesa",
        "Legendary Creature - Human Assassin",
        4,
        "Deathtouch, haste. When Queen Marchesa enters the battlefield, you become the monarch. At the beginning of your upkeep, if an opponent is the monarch, create a 1/1 black Assassin creature token with deathtouch and haste.",
        { color_identity: ["R", "W", "B"] },
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Court Enchantment",
        "Enchantment",
        4,
        "When Court Enchantment enters the battlefield, you become the monarch. At the beginning of your upkeep, if you're the monarch, each opponent loses 2 life.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Monarch Guard",
        "Creature - Human Soldier",
        3,
        "When Monarch Guard enters the battlefield, you become the monarch.",
      ),
      createResolvedCard("mainboard", 90, "Plains", "Basic Land - Plains", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "monarch");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies Xanathar-style theft shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Xanathar, Guild Kingpin",
        "Legendary Creature - Beholder",
        6,
        "At the beginning of your upkeep, choose target opponent. Until end of turn, that player can't cast spells, you may look at the top card of their library any time, you may play the top card of their library, and you may spend mana as though it were mana of any color to cast spells this way.",
        { color_identity: ["U", "B"] },
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Control Magic Variant",
        "Enchantment - Aura",
        4,
        "Enchant creature. You control enchanted creature.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Opponent Library Thief",
        "Creature - Horror",
        5,
        "You may cast spells from an opponent's library, and you may spend mana as though it were mana of any color to cast them.",
      ),
      createResolvedCard("mainboard", 90, "Island", "Basic Land - Island", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "theft");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies Marisi-style goad shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Marisi, Breaker of the Coil",
        "Legendary Creature - Cat Warrior",
        4,
        "Your opponents can't cast spells during combat. Whenever a creature you control deals combat damage to a player, goad each creature that player controls.",
        { color_identity: ["R", "G", "W"] },
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Goad Spell",
        "Sorcery",
        3,
        "Goad all creatures your opponents control.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Forced Combat",
        "Enchantment",
        3,
        "Creatures your opponents control attack each combat if able.",
      ),
      createResolvedCard("mainboard", 90, "Mountain", "Basic Land - Mountain", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "goad");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies Go-Shintai-style shrine shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Go-Shintai of Life's Origin",
        "Legendary Enchantment Creature - Shrine",
        4,
        "Whenever Go-Shintai of Life's Origin or another nontoken Shrine enters the battlefield under your control, create a 1/1 colorless Shrine enchantment creature token.",
        { color_identity: ["W", "U", "B", "R", "G"] },
      ),
      createResolvedCard(
        "mainboard",
        7,
        "Value Shrine",
        "Legendary Enchantment - Shrine",
        3,
        "At the beginning of your upkeep, draw a card for each Shrine you control.",
      ),
      createResolvedCard(
        "mainboard",
        3,
        "Shrine Payoff",
        "Enchantment",
        4,
        "Whenever a Shrine enters the battlefield under your control, each opponent loses 1 life.",
      ),
      createResolvedCard("mainboard", 89, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "shrines");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies Gavi-style cycling shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Gavi, Nest Warden",
        "Legendary Creature - Human Shaman",
        5,
        "You may pay {0} rather than pay the cycling cost of the first card you cycle each turn. Whenever you draw your second card each turn, create a 2/2 red and white Dinosaur Cat creature token.",
        { color_identity: ["U", "R", "W"] },
      ),
      createResolvedCard(
        "mainboard",
        8,
        "Cycling Card",
        "Instant",
        2,
        "Cycling {1}. Draw a card.",
        { keywords: ["Cycling"] },
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Cycling Payoff",
        "Enchantment",
        3,
        "Whenever you cycle a card, Cycling Payoff deals 1 damage to each opponent.",
      ),
      createResolvedCard("mainboard", 87, "Island", "Basic Land - Island", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "cycling");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies Otrimi-style mutate shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Otrimi, the Ever-Playful",
        "Legendary Creature - Nightmare Beast",
        6,
        "Mutate {1}{B}{G}{U}. Whenever this creature deals combat damage to a player, return target creature card with mutate from your graveyard to your hand.",
        { color_identity: ["B", "G", "U"], keywords: ["Mutate"] },
      ),
      createResolvedCard(
        "mainboard",
        7,
        "Mutate Creature",
        "Creature - Beast",
        4,
        "Mutate {2}{G}. Whenever this creature mutates, draw a card.",
        { keywords: ["Mutate"] },
      ),
      createResolvedCard(
        "mainboard",
        3,
        "Merged Payoff",
        "Creature - Horror",
        3,
        "Merged creatures you control have trample.",
      ),
      createResolvedCard("mainboard", 89, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "mutate");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies Fynn-style poison shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Fynn, the Fangbearer",
        "Legendary Creature - Human Warrior",
        2,
        "Whenever a creature you control with deathtouch deals combat damage to a player, that player gets two poison counters.",
        { color_identity: ["G"] },
      ),
      createResolvedCard(
        "mainboard",
        6,
        "Infect Creature",
        "Creature - Phyrexian",
        2,
        "Infect.",
        { keywords: ["Infect"] },
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Toxic Creature",
        "Creature - Snake",
        2,
        "Toxic 1. Deathtouch.",
        { keywords: ["Toxic"] },
      ),
      createResolvedCard("mainboard", 88, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "poison");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies battle-focused commander shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Battle Commander",
        "Legendary Creature - Human Soldier",
        4,
        "Whenever you cast a Battle spell, draw a card. Whenever a battle you control is defeated, create a 3/3 creature token.",
        { color_identity: ["R", "W"] },
      ),
      createResolvedCard(
        "mainboard",
        6,
        "Invasion of Value",
        "Battle - Siege",
        3,
        "When Invasion of Value enters the battlefield, draw a card.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Battle Payoff",
        "Enchantment",
        3,
        "Whenever a battle you control is defeated, Battle Payoff deals 2 damage to each opponent.",
      ),
      createResolvedCard("mainboard", 89, "Mountain", "Basic Land - Mountain", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "battles");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies pillowfort shells without calling them generic control", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Pramikon, Sky Rampart",
        "Legendary Creature - Wall",
        3,
        "Flying, defender. As Pramikon enters the battlefield, choose left or right. Each player may attack only the nearest opponent in the chosen direction and planeswalkers controlled by that opponent.",
        { color_identity: ["U", "R", "W"] },
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Attack Tax",
        "Enchantment",
        3,
        "Creatures can't attack you unless their controller pays {2} for each creature they control that's attacking you.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Damage Prevention",
        "Enchantment",
        4,
        "Prevent all combat damage that would be dealt to you.",
      ),
      createResolvedCard("mainboard", 90, "Plains", "Basic Land - Plains", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "pillowfort");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy identifies copy and clone commander shells", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Riku of Two Reflections",
        "Legendary Creature - Human Wizard",
        5,
        "Whenever you cast an instant or sorcery spell, you may pay {U}{R}. If you do, copy that spell. Whenever another nontoken creature enters the battlefield under your control, you may pay {G}{U}. If you do, create a token that's a copy of that creature.",
        { color_identity: ["G", "U", "R"] },
      ),
      createResolvedCard(
        "mainboard",
        5,
        "Clone Creature",
        "Creature - Shapeshifter",
        4,
        "You may have Clone Creature enter the battlefield as a copy of any creature on the battlefield.",
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Copy Spell",
        "Instant",
        2,
        "Copy target instant or sorcery spell. You may choose new targets for the copy.",
      ),
      createResolvedCard("mainboard", 90, "Island", "Basic Land - Island", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "copy_clone");
  assert.equal(analysis.synergy?.commanderAligned, true);
});

test("analyzeDeckStrategy keeps political donation shells out of token and upkeep plans", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Ludevic, Necro-Alchemist",
        "Legendary Creature - Human Wizard",
        3,
        "At the beginning of each player's end step, that player may draw a card if a player other than you lost life this turn.",
        { color_identity: ["U", "R"] },
      ),
      createResolvedCard(
        "commander",
        1,
        "Tymna the Weaver",
        "Legendary Creature - Human Cleric",
        3,
        "Lifelink. At the beginning of your postcombat main phase, you may pay X life. If you do, draw X cards, where X is the number of opponents that were dealt combat damage this turn.",
        { color_identity: ["W", "B"] },
      ),
      createResolvedCard(
        "mainboard",
        3,
        "Harmless Offering",
        "Sorcery",
        3,
        "Target opponent gains control of target permanent you control.",
      ),
      createResolvedCard(
        "mainboard",
        3,
        "Demonic Pact",
        "Enchantment",
        4,
        "At the beginning of your upkeep, choose one that hasn't been chosen. Target opponent discards two cards. Demonic Pact deals 4 damage to any target and you gain 4 life. Draw two cards. You lose the game.",
      ),
      createResolvedCard(
        "mainboard",
        2,
        "Nine Lives",
        "Enchantment",
        3,
        "When Nine Lives leaves the battlefield, you lose the game.",
      ),
      createResolvedCard(
        "mainboard",
        2,
        "Akroan Horse",
        "Artifact Creature - Horse",
        4,
        "Defender. When Akroan Horse enters the battlefield, an opponent gains control of it. At the beginning of each opponent's upkeep, that player creates a 1/1 white Soldier creature token.",
      ),
      createResolvedCard(
        "mainboard",
        2,
        "Role Reversal",
        "Sorcery",
        3,
        "Exchange control of two target permanents that share a permanent type.",
      ),
      createResolvedCard(
        "mainboard",
        2,
        "Jon Irenicus, Shattered One",
        "Legendary Creature - Elf Wizard",
        4,
        "At the beginning of your end step, target opponent gains control of up to one target creature you control. Put two +1/+1 counters on it and tap it. It is goaded for the rest of the game.",
      ),
      createResolvedCard(
        "mainboard",
        2,
        "Zedruu the Greathearted",
        "Legendary Creature - Minotaur Monk",
        4,
        "At the beginning of your upkeep, you gain X life and draw X cards, where X is the number of permanents you own that your opponents control.",
      ),
      createResolvedCard("mainboard", 80, "Filler Land", "Basic Land - Plains", 0, ""),
    ]),
    createEmptyWinConditions(),
  );

  assert.equal(analysis.mainStrategy?.key, "donation");
  assert.notEqual(analysis.mainStrategy?.key, "tokens");
  assert.notEqual(analysis.mainStrategy?.key, "extra_upkeep");
  assert.ok(!analysis.subStrategies.some((strategy) => strategy.key === "tokens"));
});

test("analyzeDeckStrategy uses EDHREC commander themes only when the deck backs them up", () => {
  const analysis = analyzeDeckStrategy(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Ivy, Gleeful Spellthief",
        "Legendary Creature - Faerie Rogue",
        2,
        "Flying. Whenever a player casts a spell that targets only a single creature other than Ivy, Gleeful Spellthief, you may copy that spell. The copy targets Ivy.",
        { color_identity: ["G", "U"] },
      ),
      createResolvedCard("mainboard", 8, "Combat Research", "Enchantment - Aura", 1, "Enchant creature. Enchanted creature has \"Whenever this creature deals combat damage to a player, draw a card.\""),
      createResolvedCard("mainboard", 5, "Snake Umbra", "Enchantment - Aura", 3, "Enchant creature. Enchanted creature gets +1/+1 and has \"Whenever this creature deals combat damage to an opponent, draw a card.\""),
      createResolvedCard("mainboard", 4, "Gemrazer", "Creature - Beast", 4, "Mutate {1}{G}{G}. Reach, trample. Whenever this creature mutates, destroy target artifact or enchantment.", { keywords: ["Mutate"] }),
      createResolvedCard("mainboard", 2, "Vesuvan Duplimancy", "Enchantment", 4, "Whenever you cast a spell that targets only a single artifact or creature you control, create a token that's a copy of that artifact or creature."),
      createResolvedCard("mainboard", 5, "Tyvar's Stand", "Instant", 1, "Target creature you control gets +X/+X and gains hexproof and indestructible until end of turn."),
      createResolvedCard("mainboard", 75, "Forest", "Basic Land - Forest", 0, ""),
    ]),
    createEmptyWinConditions(),
    {
      edhrec: createEdhrecInsights([
        { label: "Auras", slug: "auras", count: 101 },
        { label: "Mutate", slug: "mutate", count: 88 },
        { label: "Spell Copy", slug: "spell-copy", count: 21 },
      ]),
    },
  );

  assert.equal(analysis.mainStrategy?.key, "voltron");
  assert.equal(analysis.commanderProfiles?.[0]?.label, "Auras Package");
  assert.ok(analysis.commanderProfiles?.some((profile) => profile.key === "mutate"));
  assert.ok(analysis.commanderProfiles?.some((profile) => profile.key === "copy_clone"));
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

function createEdhrecInsights(themes: Array<{ label: string; slug: string; count: number }>) {
  return {
    source: "EDHREC",
    url: "https://edhrec.com/commanders/ivy-gleeful-spellthief",
    pageLabel: "Core",
    commanderNames: ["Ivy, Gleeful Spellthief"],
    deckCount: 1000,
    themes,
    lists: [],
    cardsByName: new Map(),
  } as any;
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

function createVariedFillerCreatures(entries: Array<[string, string, number]>) {
  return entries.map(([name, typeLine, quantity]) =>
    createResolvedCard("mainboard", quantity, name, typeLine, 2, ""),
  );
}

function createEmptyWinConditions(): DeckWinConditionAnalysis {
  return {
    finisherScore: 0,
    summary: "",
    counts: {
      core: 0,
      combat: 0,
      direct: 0,
      alternate: 0,
      repeatable: 0,
      combo: 0,
    },
    recommendations: {
      coreTarget: 0,
      combatTarget: 0,
      directTarget: 0,
    },
    findings: [],
    taggedCards: [],
    combos: {
      source: "Commander Spellbook",
      lookupStatus: "ok",
      exactCount: 0,
      finisherCount: 0,
      engineCount: 0,
      nearMissCount: 0,
      exact: [],
    },
  };
}
