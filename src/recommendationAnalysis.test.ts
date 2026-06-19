import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckRecommendations } from "./recommendationAnalysis";

test("analyzeDeckRecommendations suggests an early green ramp swap for low-ramp shells", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      document: createDocument([
        createResolvedCard("commander", "Trelasarra, Moon Dancer", "Legendary Creature — Elf Cleric", 3, [
          "G",
          "W",
        ]),
        createResolvedCard("mainboard", "Giant Adephage", "Creature — Insect", 7, ["G"]),
        createResolvedCard("mainboard", "Sun Titan", "Creature — Giant", 6, ["W"]),
      ]),
      bracket: createBracket(2),
      ramp: {
        rampScore: 42,
        counts: {
          core: 2,
          stable: 2,
        },
        recommendations: {
          coreTarget: 8,
          stableTarget: 6,
        },
        taggedCards: [],
      },
    }) as any,
  );

  const rampTopic = recommendations.topics.find((topic) => topic.key === "ramp");

  assert.ok(rampTopic);
  assert.equal(rampTopic?.cards[0]?.name, "Rampant Growth");
  assert.equal(rampTopic?.cards[0]?.direction, "up");
  assert.match(rampTopic?.cards[0]?.reason ?? "", /2 core \/ 2 stable against targets of 8 \/ 6/i);
});

test("analyzeDeckRecommendations caps weak-topic output at the two strongest suggestions", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      document: createDocument([
        createResolvedCard(
          "commander",
          "Yeva, Nature's Herald",
          "Legendary Creature - Elf Shaman",
          4,
          ["G"],
        ),
        createResolvedCard("mainboard", "Ancient Brontodon", "Creature - Dinosaur", 8, ["G"]),
      ]),
      bracket: createBracket(2),
      ramp: {
        rampScore: 28,
        counts: {
          core: 1,
          stable: 1,
        },
        recommendations: {
          coreTarget: 8,
          stableTarget: 6,
        },
        taggedCards: [],
      },
    }) as any,
  );

  const rampTopic = recommendations.topics.find((topic) => topic.key === "ramp");

  assert.ok(rampTopic);
  assert.deepEqual(
    rampTopic?.cards.map((card) => card.name),
    ["Rampant Growth", "Cultivate"],
  );
});

test("analyzeDeckRecommendations does not ask for more ramp when the deck is already over target", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      bracket: createBracket(5, "below"),
      ramp: {
        rampScore: 58,
        counts: {
          core: 20,
          stable: 13,
          burst: 4,
        },
        recommendations: {
          coreTarget: 8,
          stableTarget: 7,
        },
        taggedCards: [],
      },
    }) as any,
  );

  const rampTopic = recommendations.topics.find((topic) => topic.key === "ramp");

  assert.ok(rampTopic);
  assert.equal(rampTopic?.cards.length, 0);
});

test("analyzeDeckRecommendations suggests fast-mana staples when high-bracket ramp is slot-inefficient", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      bracket: createBracket(5, "below"),
      ramp: {
        rampScore: 88,
        counts: {
          core: 9,
          stable: 9,
          burst: 0,
        },
        recommendations: {
          coreTarget: 8,
          stableTarget: 7,
        },
        taggedCards: createTaggedCards("Medium Ramp", 14),
      },
    }) as any,
  );

  const rampTopic = recommendations.topics.find((topic) => topic.key === "ramp");

  assert.ok(rampTopic);
  assert.equal(rampTopic?.cards[0]?.name, "Sol Ring");
  assert.match(rampTopic?.cards[0]?.reason ?? "", /per card/i);
  assert.doesNotMatch(rampTopic?.cards[0]?.reason ?? "", /compactness|per slot|slot efficiency/i);
});

test("analyzeDeckRecommendations suggests premium card-flow staples for high-bracket efficiency", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      document: createDocument([
        createResolvedCard("commander", "Kess, Dissident Mage", "Legendary Creature - Human Wizard", 4, [
          "U",
          "B",
          "R",
        ]),
        createResolvedCard("mainboard", "Chart a Course", "Sorcery", 2, ["U"]),
      ]),
      bracket: createBracket(5, "below"),
      draw: {
        drawScore: 86,
        counts: {
          draw: 8,
          repeatable: 3,
          selection: 0,
        },
        recommendations: {
          drawTarget: 8,
          repeatableTarget: 3,
        },
        taggedCards: createTaggedCards("Medium Draw", 12),
      },
    }) as any,
  );

  const cardFlowTopic = recommendations.topics.find((topic) => topic.key === "card_flow");

  assert.ok(cardFlowTopic);
  assert.equal(cardFlowTopic?.cards[0]?.name, "Mystic Remora");
  assert.match(cardFlowTopic?.summary ?? "", /per card/i);
  assert.doesNotMatch(cardFlowTopic?.summary ?? "", /compactness|per slot|compression/i);
});

test("analyzeDeckRecommendations suggests premium tutors when high-bracket consistency is too spread out", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      document: createDocument([
        createResolvedCard("commander", "Kess, Dissident Mage", "Legendary Creature - Human Wizard", 4, [
          "U",
          "B",
          "R",
        ]),
        createResolvedCard("mainboard", "Diabolic Tutor", "Sorcery", 4, ["B"]),
      ]),
      bracket: createBracket(5, "below"),
      consistency: {
        consistencyScore: 82,
        counts: {
          direct: 3,
          restricted: 0,
          repeatable: 1,
          selectionSupport: 0,
        },
        recommendations: {
          directTarget: 3,
          repeatableTarget: 1,
        },
        taggedCards: createTaggedCards("Medium Tutor", 6),
      },
    }) as any,
  );

  const consistencyTopic = recommendations.topics.find((topic) => topic.key === "consistency");

  assert.ok(consistencyTopic);
  assert.equal(consistencyTopic?.cards[0]?.name, "Vampiric Tutor");
  assert.match(consistencyTopic?.cards[0]?.reason ?? "", /per card|stronger card/i);
  assert.doesNotMatch(consistencyTopic?.cards[0]?.reason ?? "", /compactness|per slot/i);
});

test("analyzeDeckRecommendations suggests free interaction when high-bracket answers use too many slots", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      document: createDocument([
        createResolvedCard("commander", "Talrand, Sky Summoner", "Legendary Creature - Merfolk Wizard", 4, [
          "U",
        ]),
        createResolvedCard("mainboard", "Cancel", "Instant", 3, ["U"]),
      ]),
      bracket: createBracket(5, "below"),
      removal: {
        removalScore: 82,
        counts: {
          targeted: 5,
          mass: 1,
          tempo: 0,
          handAttack: 0,
        },
        recommendations: {
          targetedTarget: 5,
          massTarget: 1,
        },
        taggedCards: createTaggedCards("Medium Removal", 6),
      },
      spellInteraction: {
        interactionScore: 82,
        counts: {
          hard: 3,
          soft: 2,
          spellTempo: 0,
          broad: 0,
        },
        recommendations: {
          hardTarget: 3,
          softTarget: 2,
        },
        taggedCards: createTaggedCards("Medium Counter", 6),
      },
    }) as any,
  );

  const interactionTopic = recommendations.topics.find((topic) => topic.key === "interaction");

  assert.ok(interactionTopic);
  assert.equal(interactionTopic?.cards[0]?.name, "Force of Will");
  assert.match(interactionTopic?.summary ?? "", /per card/i);
});

test("analyzeDeckRecommendations uses stronger consistency upgrades for higher target brackets", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      document: createDocument([
        createResolvedCard("commander", "Kess, Dissident Mage", "Legendary Creature — Human Wizard", 4, [
          "U",
          "B",
          "R",
        ]),
        createResolvedCard("mainboard", "Diluvian Primordial", "Creature — Avatar", 7, ["U"]),
      ]),
      bracket: createBracket(4, "below"),
      strategy: {
        mainStrategy: {
          label: "Spellslinger",
          key: "spellslinger",
          keyCards: [],
        },
        subStrategies: [],
        topStrategies: [],
      },
      winStrategy: {
        primaryPlan: {
          key: "spell_burst",
          label: "Spell Burst",
          keyCards: [],
        },
        backupPlans: [],
      },
      consistency: {
        consistencyScore: 41,
        counts: {
          direct: 0,
          repeatable: 0,
        },
        recommendations: {
          directTarget: 2.5,
          repeatableTarget: 1,
        },
        taggedCards: [],
      },
    }) as any,
  );

  const consistencyTopic = recommendations.topics.find((topic) => topic.key === "consistency");

  assert.ok(consistencyTopic);
  assert.equal(consistencyTopic?.cards[0]?.name, "Mystical Tutor");
  assert.equal(consistencyTopic?.cards[0]?.direction, "up");
});

test("analyzeDeckRecommendations keeps spell-only tutors out of kindred consistency suggestions", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      document: createDocument([
        createResolvedCard("commander", "The Ur-Dragon", "Legendary Creature - Dragon Avatar", 9, [
          "W",
          "U",
          "B",
          "R",
          "G",
        ]),
        createResolvedCard("mainboard", "Lathliss, Dragon Queen", "Creature - Dragon", 6, ["R"]),
        createResolvedCard("mainboard", "Miirym, Sentinel Wyrm", "Legendary Creature - Dragon Spirit", 6, [
          "G",
          "U",
          "R",
        ]),
        createResolvedCard("mainboard", "Dragon Tempest", "Enchantment", 2, ["R"]),
      ]),
      bracket: createBracket(4, "below"),
      strategy: {
        mainStrategy: {
          label: "Dragon Kindred",
          key: "kindred",
          keyCards: [],
        },
        subStrategies: [],
        topStrategies: [],
        synergy: {
          synergyScore: 68,
          supportCards: 8,
          recommendations: {
            supportTarget: 10,
          },
        },
      },
      winStrategy: {
        primaryPlan: {
          key: "go_wide_combat",
          label: "Go-Wide Combat",
          keyCards: [],
        },
        backupPlans: [],
      },
      structure: {
        structureScore: 70,
        counts: {
          lands: 37,
          creatures: 24,
        },
        mana: {
          recommendedLands: {
            min: 36,
            max: 38,
          },
        },
      },
      consistency: {
        consistencyScore: 38,
        counts: {
          direct: 0,
          repeatable: 0,
        },
        recommendations: {
          directTarget: 2,
          repeatableTarget: 1,
        },
        taggedCards: [],
      },
    }) as any,
  );

  const consistencyTopic = recommendations.topics.find((topic) => topic.key === "consistency");

  assert.ok(consistencyTopic);
  assert.equal(consistencyTopic?.cards[0]?.name, "Worldly Tutor");
  assert.ok(!consistencyTopic?.cards.some((card) => card.name === "Solve the Equation"));
});

test("analyzeDeckRecommendations upgrades weak land-base slots with a real fixer", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      document: createDocument([
        createResolvedCard("commander", "Raff, Weatherlight Stalwart", "Legendary Creature — Human Wizard", 3, [
          "W",
          "U",
        ]),
        createResolvedCard("mainboard", "Azorius Guildgate", "Land", 0, []),
        createResolvedCard("mainboard", "Island", "Basic Land — Island", 0, []),
      ]),
      landBase: {
        landBaseScore: 48,
        counts: {
          alwaysTapped: 6,
          colorlessOnly: 0,
          costly: 0,
          utility: 1,
        },
        recommendations: {
          alwaysTappedMax: 3,
          colorlessOnlyMax: 1,
          costlyMax: 2,
        },
        taggedCards: [
          {
            name: "Azorius Guildgate",
            hits: [{ tag: "always_tapped" }],
          },
        ],
      },
    }) as any,
  );

  const manaTopic = recommendations.topics.find((topic) => topic.key === "land_base");

  assert.ok(manaTopic);
  assert.equal(manaTopic?.cards[0]?.name, "Command Tower");
  assert.equal(manaTopic?.cards[0]?.direction, "up");
});

test("analyzeDeckRecommendations offers fairer consistency cards when the deck is above its target bracket", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      document: createDocument([
        createResolvedCard("commander", "Kess, Dissident Mage", "Legendary Creature — Human Wizard", 4, [
          "U",
          "B",
          "R",
        ]),
        createResolvedCard("mainboard", "Rhystic Study", "Enchantment", 3, ["U"]),
      ]),
      bracket: createBracket(2, "above"),
      consistency: {
        consistencyScore: 82,
        counts: {
          direct: 3,
          repeatable: 1,
        },
        recommendations: {
          directTarget: 0.5,
          repeatableTarget: 0.5,
        },
        taggedCards: [],
      },
    }) as any,
  );

  const consistencyTopic = recommendations.topics.find((topic) => topic.key === "consistency");

  assert.ok(consistencyTopic);
  assert.equal(consistencyTopic?.cards[0]?.name, "Impulse");
  assert.equal(consistencyTopic?.cards[0]?.direction, "down");
});

test("analyzeDeckRecommendations does not suggest lower-pressure consistency when tutor pressure is absent", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      bracket: createBracket(2, "above"),
      consistency: {
        consistencyScore: 82,
        counts: {
          direct: 0,
          restricted: 0,
          repeatable: 0,
          selectionSupport: 8,
        },
        recommendations: {
          directTarget: 0.5,
          repeatableTarget: 0.5,
        },
        taggedCards: createTaggedCards("Selection", 8),
      },
    }) as any,
  );

  const consistencyTopic = recommendations.topics.find((topic) => topic.key === "consistency");

  assert.ok(consistencyTopic);
  assert.equal(consistencyTopic?.cards.some((card) => card.direction === "down"), false);
  assert.doesNotMatch(JSON.stringify(consistencyTopic), /0 direct tutors|sharper than|depower/i);
});

test("analyzeDeckRecommendations lets EDHREC reorder a same-bracket shell suggestion", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      document: createDocument([
        createResolvedCard("commander", "Teysa Karlov", "Legendary Creature - Human Advisor", 4, [
          "W",
          "B",
        ]),
        createResolvedCard("mainboard", "Doomed Traveler", "Creature - Human Soldier", 1, ["W"]),
        createResolvedCard("mainboard", "Hunted Witness", "Creature - Human", 1, ["W"]),
        createResolvedCard("mainboard", "Orzhov Basilica", "Land", 0, []),
      ]),
      bracket: createBracket(3, "below"),
      structure: {
        structureScore: 58,
        counts: {
          lands: 36,
          creatures: 26,
        },
        mana: {
          recommendedLands: {
            min: 35,
            max: 37,
          },
        },
      },
      strategy: {
        mainStrategy: {
          label: "Tokens",
          key: "tokens",
          keyCards: [],
        },
        subStrategies: [],
        synergy: {
          synergyScore: 54,
          supportCards: 2,
          recommendations: {
            supportTarget: 6,
          },
        },
      },
      edhrec: createEdhrecInsights("Upgraded", [
        {
          name: "Bastion of Remembrance",
          synergy: 0.41,
          listTags: ["highsynergycards"],
        },
      ]),
    }) as any,
  );

  const shellTopic = recommendations.topics.find((topic) => topic.key === "shell");

  assert.ok(shellTopic);
  assert.equal(shellTopic?.cards[0]?.name, "Bastion of Remembrance");
  assert.match(shellTopic?.cards[0]?.reason ?? "", /EDHREC/i);
});

test("analyzeDeckRecommendations lets commander-specific EDHREC ramp beat generic exact-bracket ramp", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      document: createDocument([
        createResolvedCard("commander", "Trelasarra, Moon Dancer", "Legendary Creature - Elf Cleric", 3, [
          "G",
          "W",
        ]),
        createResolvedCard("mainboard", "Giant Adephage", "Creature - Insect", 7, ["G"]),
      ]),
      bracket: createBracket(2),
      ramp: {
        rampScore: 36,
        counts: {
          core: 1,
          stable: 1,
        },
        recommendations: {
          coreTarget: 8,
          stableTarget: 6,
        },
        taggedCards: [],
      },
      edhrec: createEdhrecInsights("Core", [
        {
          name: "Nature's Lore",
          synergy: 0.52,
          listTags: ["highsynergycards"],
        },
      ]),
    }) as any,
  );

  const rampTopic = recommendations.topics.find((topic) => topic.key === "ramp");

  assert.ok(rampTopic);
  assert.equal(rampTopic?.cards[0]?.name, "Nature's Lore");
  assert.match(rampTopic?.cards[0]?.reason ?? "", /EDHREC/i);
});

test("analyzeDeckRecommendations can use Recommander context-fit shell suggestions", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      bracket: createBracket(3, "below"),
      structure: {
        structureScore: 58,
        counts: {
          lands: 36,
          creatures: 26,
        },
        mana: {
          recommendedLands: {
            min: 35,
            max: 37,
          },
        },
      },
      strategy: {
        mainStrategy: {
          label: "Tokens",
          key: "tokens",
          keyCards: [],
        },
        subStrategies: [],
        synergy: {
          synergyScore: 54,
          supportCards: 2,
          recommendations: {
            supportTarget: 6,
          },
        },
      },
      recommander: createRecommanderInsights([
        {
          name: "Bitterblossom",
          score: 0.94,
          rank: 1,
        },
      ]),
    }) as any,
  );

  const shellTopic = recommendations.topics.find((topic) => topic.key === "shell");

  assert.ok(shellTopic);
  assert.equal(shellTopic?.cards[0]?.name, "Bitterblossom");
  assert.match(shellTopic?.cards[0]?.reason ?? "", /Recommander/i);
  assert.equal(shellTopic?.cards[0]?.source, "recommander");
  assert.equal(shellTopic?.cards[0]?.recommanderRank, 1);
  assert.equal(shellTopic?.cards[0]?.recommanderScore, 0.94);
  assert.match(shellTopic?.cards[0]?.sourceLabel ?? "", /Recommander #1/);
});

test("analyzeDeckRecommendations classifies Recommander cards into the weak ramp topic before generic staples", async () => {
  const restoreFetch = mockScryfallCards({
    "Nature's Lore": {
      typeLine: "Sorcery",
      cmc: 2,
      colorIdentity: ["G"],
      oracleText: "Search your library for a Forest card, put that card onto the battlefield, then shuffle.",
    },
  });

  try {
    const recommendations = await analyzeDeckRecommendations(
      createInput({
        document: createDocument([
          createResolvedCard("commander", "Trelasarra, Moon Dancer", "Legendary Creature - Elf Cleric", 3, [
            "G",
            "W",
          ]),
          createResolvedCard("mainboard", "Giant Adephage", "Creature - Insect", 7, ["G"]),
        ]),
        bracket: createBracket(3, "below"),
        ramp: {
          rampScore: 32,
          counts: {
            core: 1,
            stable: 1,
          },
          recommendations: {
            coreTarget: 8,
            stableTarget: 6,
          },
          taggedCards: [],
        },
        recommander: createRecommanderInsights([
          {
            name: "Nature's Lore",
            score: 0.96,
            rank: 1,
          },
        ]),
      }) as any,
    );

    const rampTopic = recommendations.topics.find((topic) => topic.key === "ramp");

    assert.ok(rampTopic);
    assert.equal(rampTopic?.cards[0]?.name, "Nature's Lore");
    assert.equal(rampTopic?.cards[0]?.source, "recommander");
    assert.match(rampTopic?.cards[0]?.reason ?? "", /rules text reads as Ramp/i);
  } finally {
    restoreFetch();
  }
});

test("analyzeDeckRecommendations does not put off-topic Recommander cards into card-flow slots", async () => {
  const restoreFetch = mockScryfallCards({
    Bitterblossom: {
      typeLine: "Tribal Enchantment - Faerie",
      cmc: 2,
      colorIdentity: ["B"],
      oracleText:
        "At the beginning of your upkeep, you lose 1 life and create a 1/1 black Faerie Rogue creature token with flying.",
    },
    "Phyrexian Arena": {
      typeLine: "Enchantment",
      cmc: 3,
      colorIdentity: ["B"],
      oracleText: "At the beginning of your upkeep, you draw a card and you lose 1 life.",
    },
  });

  try {
    const recommendations = await analyzeDeckRecommendations(
      createInput({
        document: createDocument([
          createResolvedCard("commander", "Braids, Arisen Nightmare", "Legendary Creature - Nightmare", 3, [
            "B",
          ]),
          createResolvedCard("mainboard", "Doomed Dissenter", "Creature - Human", 2, ["B"]),
        ]),
        bracket: createBracket(3, "below"),
        draw: {
          drawScore: 36,
          counts: {
            draw: 1,
            repeatable: 0,
            selection: 0,
          },
          recommendations: {
            drawTarget: 7,
            repeatableTarget: 2,
          },
          taggedCards: [],
        },
        recommander: createRecommanderInsights([
          {
            name: "Bitterblossom",
            score: 0.97,
            rank: 1,
          },
          {
            name: "Phyrexian Arena",
            score: 0.92,
            rank: 2,
          },
        ]),
      }) as any,
    );

    const cardFlowTopic = recommendations.topics.find((topic) => topic.key === "card_flow");

    assert.ok(cardFlowTopic);
    assert.equal(cardFlowTopic?.cards[0]?.name, "Phyrexian Arena");
    assert.equal(cardFlowTopic?.cards[0]?.source, "recommander");
    assert.ok(!cardFlowTopic?.cards.some((card) => card.name === "Bitterblossom"));
  } finally {
    restoreFetch();
  }
});

test("analyzeDeckRecommendations prioritizes face-down shell cards over generic shell upgrades", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      document: createDocument([
        createResolvedCard("commander", "Kadena, Slinking Sorcerer", "Legendary Creature - Naga Wizard", 4, [
          "B",
          "G",
          "U",
        ]),
        createResolvedCard("mainboard", "Morph Creature", "Creature - Beast", 3, ["G"]),
      ]),
      strategy: createStrategyStub("face_down", "Face-Down"),
      winStrategy: createWinStrategyStub("value_attrition"),
    }) as any,
  );

  const shellTopic = recommendations.topics.find((topic) => topic.key === "shell");

  assert.ok(shellTopic);
  assert.equal(shellTopic?.cards[0]?.name, "Trail of Mystery");
  assert.match(shellTopic?.cards[0]?.reason ?? "", /face-down/i);
});

test("analyzeDeckRecommendations uses commander profile gaps even when broad strategy misses the shell", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      document: createDocument([
        createResolvedCard("commander", "Kadena, Slinking Sorcerer", "Legendary Creature - Naga Wizard", 4, [
          "B",
          "G",
          "U",
        ]),
        createResolvedCard("mainboard", "Angel of Serenity", "Creature - Angel", 7, ["W"]),
      ]),
      bracket: createBracket(3, "below"),
      commander: {
        dependencyScore: 62,
        profiles: [
          {
            commanderName: "Kadena, Slinking Sorcerer",
            key: "face_down",
            label: "Face-Down Package",
            supportReason: "Face-down cards are the material this commander asks for.",
            supportTarget: 14,
            supportCount: 4,
            coreCount: 2,
            confidence: 46,
            supportCards: [],
            missingPieces: ["More true core pieces"],
          },
        ],
      },
      strategy: createStrategyStub("tokens", "Tokens"),
    }) as any,
  );

  const shellTopic = recommendations.topics.find((topic) => topic.key === "shell");

  assert.ok(shellTopic);
  assert.equal(shellTopic?.cards[0]?.name, "Trail of Mystery");
  assert.match(shellTopic?.summary ?? "", /Kadena/i);
  assert.match(shellTopic?.cards[0]?.reason ?? "", /Face-Down Package/i);
});

test("analyzeDeckRecommendations lets Recommander profile matches beat static profile suggestions", async () => {
  const restoreFetch = mockScryfallCards({
    "Ugin's Mastery": {
      typeLine: "Enchantment",
      cmc: 4,
      colorIdentity: [],
      oracleText:
        "Whenever you cast a colorless creature spell, manifest the top card of your library. Whenever you attack with creatures with total power 6 or greater, you may turn a face-down creature you control face up.",
    },
  });

  try {
    const recommendations = await analyzeDeckRecommendations(
      createInput({
        document: createDocument([
          createResolvedCard("commander", "Kadena, Slinking Sorcerer", "Legendary Creature - Naga Wizard", 4, [
            "B",
            "G",
            "U",
          ]),
        ]),
        bracket: createBracket(3, "below"),
        commander: {
          dependencyScore: 62,
          profiles: [
            {
              commanderName: "Kadena, Slinking Sorcerer",
              key: "face_down",
              label: "Face-Down Package",
              supportReason: "Face-down cards are the material this commander asks for.",
              supportTarget: 14,
              supportCount: 4,
              coreCount: 2,
              confidence: 46,
              supportCards: [],
              missingPieces: ["More true core pieces"],
            },
          ],
        },
        strategy: createStrategyStub("tokens", "Tokens"),
        recommander: createRecommanderInsights([
          {
            name: "Ugin's Mastery",
            score: 0.96,
            rank: 1,
          },
        ]),
      }) as any,
    );

    const shellTopic = recommendations.topics.find((topic) => topic.key === "shell");

    assert.ok(shellTopic);
    assert.equal(shellTopic?.cards[0]?.name, "Ugin's Mastery");
    assert.equal(shellTopic?.cards[0]?.source, "recommander");
  } finally {
    restoreFetch();
  }
});

test("analyzeDeckRecommendations respects power-matters commander shells", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      document: createDocument([
        createResolvedCard("commander", "Duskana, the Rage Mother", "Legendary Creature - Bear", 5, [
          "R",
          "G",
          "W",
        ]),
        createResolvedCard("mainboard", "Runeclaw Bear", "Creature - Bear", 2, ["G"]),
      ]),
      strategy: createStrategyStub("power_matter", "Power Matters"),
      winStrategy: createWinStrategyStub("go_wide_combat"),
    }) as any,
  );

  const shellTopic = recommendations.topics.find((topic) => topic.key === "shell");

  assert.ok(shellTopic);
  assert.equal(shellTopic?.cards[0]?.name, "Jasmine Boreal of the Seven");
  assert.match(shellTopic?.cards[0]?.reason ?? "", /low-stat|power-matters|base 2\/2/i);
});

test("analyzeDeckRecommendations respects legends-matter commander shells", async () => {
  const recommendations = await analyzeDeckRecommendations(
    createInput({
      document: createDocument([
        createResolvedCard("commander", "Shanid, Sleepers' Scourge", "Legendary Creature - Human Knight", 4, [
          "R",
          "W",
          "B",
        ]),
        createResolvedCard("mainboard", "Legendary Hero", "Legendary Creature - Human", 3, ["W"]),
      ]),
      strategy: createStrategyStub("legends_matter", "Legends Matter"),
      winStrategy: createWinStrategyStub("value_attrition"),
    }) as any,
  );

  const shellTopic = recommendations.topics.find((topic) => topic.key === "shell");

  assert.ok(shellTopic);
  assert.equal(shellTopic?.cards[0]?.name, "Heroes' Podium");
  assert.match(shellTopic?.cards[0]?.reason ?? "", /legendary/i);
});

function createInput(overrides: Record<string, unknown> = {}) {
  return {
    document: createDocument([
      createResolvedCard("commander", "Alela, Artful Provocateur", "Legendary Creature — Faerie Warlock", 4, [
        "W",
        "U",
        "B",
      ]),
      createResolvedCard("mainboard", "Angel of Serenity", "Creature — Angel", 7, ["W"]),
      createResolvedCard("mainboard", "Mind Rot", "Sorcery", 3, ["B"]),
      createResolvedCard("mainboard", "Island", "Basic Land — Island", 0, []),
      createResolvedCard("mainboard", "Plains", "Basic Land — Plains", 0, []),
      createResolvedCard("mainboard", "Swamp", "Basic Land — Swamp", 0, []),
    ]),
    edhrec: null,
    recommander: null,
    commander: {
      dependencyScore: 52,
    },
    bracket: createBracket(3),
    strategy: {
      mainStrategy: {
        label: "Tokens",
        key: "tokens",
        keyCards: ["Skullclamp"],
      },
      subStrategies: [],
    },
    winStrategy: {
      primaryPlan: {
        keyCards: [],
      },
      backupPlans: [],
    },
    structure: {
      structureScore: 74,
      counts: {
        lands: 36,
        creatures: 24,
      },
      mana: {
        recommendedLands: {
          min: 35,
          max: 37,
        },
      },
    },
    landBase: {
      landBaseScore: 73,
      counts: {
        alwaysTapped: 2,
        colorlessOnly: 0,
        costly: 0,
        utility: 2,
      },
      recommendations: {
        alwaysTappedMax: 3,
        colorlessOnlyMax: 1,
        costlyMax: 2,
      },
      taggedCards: [],
    },
    ramp: {
      rampScore: 76,
      counts: {
        core: 8,
        stable: 6,
      },
      recommendations: {
        coreTarget: 8,
        stableTarget: 6,
      },
      taggedCards: [],
    },
    draw: {
      drawScore: 71,
      counts: {
        draw: 8,
        repeatable: 3,
      },
      recommendations: {
        drawTarget: 7,
        repeatableTarget: 2,
      },
      taggedCards: [],
    },
    consistency: {
      consistencyScore: 76,
      counts: {
        direct: 2,
        repeatable: 1,
      },
      recommendations: {
        directTarget: 2,
        repeatableTarget: 1,
      },
      taggedCards: [],
    },
    protection: {
      protectionScore: 68,
      counts: {
        core: 4,
        broad: 2,
      },
      recommendations: {
        coreTarget: 4,
        broadTarget: 2,
      },
      taggedCards: [],
    },
    recursion: {
      taggedCards: [],
    },
    winConditions: {
      taggedCards: [],
      combos: {
        exact: [],
      },
    },
    removal: {
      removalScore: 69,
      counts: {
        targeted: 6,
        mass: 2,
      },
      recommendations: {
        targetedTarget: 5,
        massTarget: 1,
      },
      taggedCards: [],
    },
    spellInteraction: {
      interactionScore: 68,
      counts: {
        hard: 3,
        soft: 2,
      },
      recommendations: {
        hardTarget: 2,
        softTarget: 1,
      },
      taggedCards: [],
    },
    ...overrides,
  };
}

function createStrategyStub(key: any, label: string) {
  return {
    mainStrategy: {
      label,
      key,
      keyCards: [],
    },
    subStrategies: [],
    topStrategies: [{ key, label, keyCards: [] }],
    synergy: {
      synergyScore: 42,
      supportCards: 2,
      recommendations: {
        supportTarget: 10,
      },
    },
  };
}

function createWinStrategyStub(key: any) {
  return {
    primaryPlan: {
      key,
      keyCards: [],
    },
    backupPlans: [],
  };
}

function createEdhrecInsights(
  pageLabel: string,
  cards: Array<{
    name: string;
    synergy: number;
    listTags: string[];
  }>,
) {
  const cardsByName = new Map<string, any>();

  for (const card of cards) {
    cardsByName.set(normalizeText(card.name), {
      name: card.name,
      normalizedName: normalizeText(card.name),
      url: `https://edhrec.com/cards/${encodeURIComponent(card.name)}`,
      synergy: card.synergy,
      inclusion: 100,
      numDecks: 100,
      potentialDecks: 100,
      listTags: card.listTags,
      listHeaders: card.listTags,
    });
  }

  return {
    source: "EDHREC",
    url: "https://edhrec.com/commanders/test",
    pageLabel,
    commanderNames: ["Teysa Karlov"],
    deckCount: 100,
    lists: [],
    cardsByName,
  };
}

function createRecommanderInsights(
  cards: Array<{
    name: string;
    score: number;
    rank: number;
  }>,
) {
  const normalizedCards = cards.map((card) => ({
    oracleId: null,
    name: card.name,
    normalizedName: normalizeText(card.name),
    score: card.score,
    rank: card.rank,
  }));

  return {
    source: "Recommander",
    url: "https://api.recommander.cards/public-release/api/decks/recommend/top",
    commanderName: "Alela, Artful Provocateur",
    partnerName: null,
    cards: normalizedCards,
    cardsByName: new Map(normalizedCards.map((card) => [card.normalizedName, card])),
  };
}

function mockScryfallCards(
  cards: Record<
    string,
    {
      typeLine: string;
      cmc: number;
      colorIdentity: string[];
      oracleText: string;
    }
  >,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input);
    const exactName = decodeURIComponent(url.match(/[?&]exact=([^&]+)/)?.[1] ?? "");
    const card = cards[exactName];

    if (!card) {
      return Promise.resolve(new Response("{}", { status: 404 }));
    }

    return Promise.resolve(
      new Response(
        JSON.stringify({
          id: `scryfall-${exactName}`,
          name: exactName,
          cmc: card.cmc,
          type_line: card.typeLine,
          oracle_text: card.oracleText,
          color_identity: card.colorIdentity,
          keywords: [],
          layout: "normal",
          scryfall_uri: `https://scryfall.com/card/${encodeURIComponent(exactName)}`,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );
  }) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function createBracket(targetBracket: number, targetAlignment: "below" | "aligned" | "above" = "aligned") {
  return {
    targetBracket,
    targetLabel: `Bracket ${targetBracket}`,
    targetName: "Upgraded",
    targetAlignment,
    recommendedBracket: targetBracket,
    recommendedLabel: `Bracket ${targetBracket}`,
  };
}

function createDocument(resolvedCards: ReturnType<typeof createResolvedCard>[]) {
  return {
    format: "edh",
    parse: {
      entries: [],
      errors: [],
      warnings: [],
      totalCards: resolvedCards.length,
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
  section: "commander" | "mainboard",
  name: string,
  typeLine: string,
  cmc: number,
  colorIdentity: string[],
) {
  return {
    quantity: 1,
    section,
    requestedName: name,
    originalLine: `1 ${name}`,
    lineNumber: 1,
    card: {
      id: `${section}-${name}`,
      name,
      cmc,
      type_line: typeLine,
      color_identity: colorIdentity,
      keywords: [],
      layout: "normal",
      scryfall_uri: `https://scryfall.com/card/${encodeURIComponent(name)}`,
    },
  };
}

function createTaggedCards(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    name: `${prefix} ${index + 1}`,
    quantity: 1,
    section: "mainboard",
    value: 1,
    hits: [],
  }));
}

function normalizeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .trim()
    .toLowerCase();
}
