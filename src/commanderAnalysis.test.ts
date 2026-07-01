import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckCommander } from "./commanderAnalysis";

test("analyzeDeckCommander recognizes high-impact command-zone engines", () => {
  const analysis = analyzeDeckCommander(
    createDocument([
      createCommanderCard({
        name: "Urza, Lord High Artificer",
        type_line: "Legendary Creature - Human Artificer",
        oracle_text:
          "When Urza, Lord High Artificer enters the battlefield, create a 0/0 colorless Construct artifact creature token with \"This creature gets +1/+1 for each artifact you control.\" Tap an untapped artifact you control: Add {U}. {5}: Shuffle your library, then exile the top card. Until end of turn, you may play that card without paying its mana cost.",
      }),
    ]),
    {
      mainStrategy: { key: "artifacts", label: "Artifacts" },
      synergy: {
        commanderAligned: true,
      },
      perspectives: [],
    } as any,
    {
      primaryPlan: {
        key: "infinite_combo",
        label: "Infinite Combo",
      },
    } as any,
    {
      combos: {
        lookupStatus: "ok",
        exact: [
          {
            lineType: "engine",
            commanderInvolved: true,
            cardNames: ["Urza, Lord High Artificer", "Isochron Scepter", "Dramatic Reversal"],
          },
          {
            lineType: "finisher",
            commanderInvolved: true,
            cardNames: ["Urza, Lord High Artificer", "Power Artifact", "Basalt Monolith"],
          },
        ],
      },
    } as any,
  );

  assert.ok(analysis.impactScore >= 75);
  assert.ok(analysis.ceilingScore >= 80);
  assert.equal(analysis.commanderInvolvedCombos, 2);
  assert.ok(analysis.keyRoles.includes("Mana Engine"));
  assert.ok(analysis.keyRoles.includes("Combo Enabler"));
  assert.ok(analysis.prior.matched.includes("Urza, Lord High Artificer"));
});

test("analyzeDeckCommander keeps low-text commanders from looking too central", () => {
  const analysis = analyzeDeckCommander(
    createDocument([
      createCommanderCard({
        name: "Isamaru, Hound of Konda",
        type_line: "Legendary Creature - Dog",
        oracle_text: "",
      }),
    ]),
    {
      mainStrategy: { key: "aggro", label: "Aggro" },
      synergy: {
        commanderAligned: false,
      },
      perspectives: [],
    } as any,
    {
      primaryPlan: {
        key: "go_wide_combat",
        label: "Go-Wide Combat",
      },
    } as any,
    {
      combos: {
        lookupStatus: "ok",
        exact: [],
      },
    } as any,
  );

  assert.ok(analysis.impactScore < 40);
  assert.ok(analysis.dependencyScore < 45);
  assert.equal(analysis.taggedCommanders.length, 0);
});

test("analyzeDeckCommander counts shell cards that turn on with commanders in play", () => {
  const analysis = analyzeDeckCommander(
    createDocument([
      createCommanderCard({
        name: "Rograkh, Son of Rohgahh",
        cmc: 0,
        type_line: "Legendary Creature - Kobold Warrior",
        oracle_text: "First strike, menace, trample.",
        color_identity: ["R"],
      }),
      createCommanderCard({
        name: "Silas Renn, Seeker Adept",
        cmc: 3,
        type_line: "Legendary Artifact Creature - Human",
        oracle_text: "Deathtouch. Whenever Silas Renn, Seeker Adept deals combat damage to a player, choose target artifact card in your graveyard. You may cast that card this turn.",
        color_identity: ["U", "B"],
      }),
      createMainboardCard({
        name: "Fierce Guardianship",
        type_line: "Instant",
        cmc: 3,
        oracle_text:
          "If you control a commander, you may cast this spell without paying its mana cost. Counter target noncreature spell.",
      }),
      createMainboardCard({
        name: "Deadly Rollick",
        type_line: "Instant",
        cmc: 4,
        oracle_text:
          "If you control a commander, you may cast this spell without paying its mana cost. Exile target creature.",
      }),
      createMainboardCard({
        name: "Mox Amber",
        type_line: "Legendary Artifact",
        cmc: 0,
        oracle_text:
          "{T}: Add one mana of any color among legendary creatures and planeswalkers you control.",
      }),
      createMainboardCard({
        name: "Springleaf Drum",
        type_line: "Artifact",
        cmc: 1,
        oracle_text:
          "{T}, Tap an untapped creature you control: Add one mana of any color.",
      }),
      createMainboardCard({
        name: "Culling the Weak",
        type_line: "Instant",
        cmc: 1,
        oracle_text: "As an additional cost to cast this spell, sacrifice a creature. Add {B}{B}{B}{B}.",
      }),
      createMainboardCard({
        name: "Diabolic Intent",
        type_line: "Sorcery",
        cmc: 2,
        oracle_text:
          "As an additional cost to cast this spell, sacrifice a creature. Search your library for a card, put that card into your hand, then shuffle.",
      }),
    ]),
    {
      mainStrategy: { key: "combo", label: "Combo" },
      synergy: {
        commanderAligned: true,
      },
      perspectives: [],
    } as any,
    {
      primaryPlan: {
        key: "infinite_combo",
        label: "Infinite Combo",
      },
    } as any,
    {
      combos: {
        lookupStatus: "ok",
        exact: [],
      },
    } as any,
  );

  assert.ok(analysis.counts.mana >= 0.9);
  assert.ok(analysis.counts.interaction >= 0.8);
  assert.ok(analysis.counts.tutors >= 0.9);
  assert.ok(analysis.counts.costReduction >= 1.5);
  assert.ok(analysis.dependencyScore >= 55);
  assert.ok(analysis.impactScore >= 75);
  assert.ok(analysis.findings.some((entry) => entry.code.includes("shell_support")));
  assert.equal(analysis.taggedCommanders[0]?.name, "Rograkh, Son of Rohgahh");
  assert.ok(analysis.taggedCommanders[0]?.roleValue > (analysis.taggedCommanders[1]?.roleValue ?? 0));
  assert.ok(
    analysis.taggedCommanders[0]?.hits.some((hit) => hit.tag === "mana_engine"),
  );
  assert.ok(
    analysis.taggedCommanders[0]?.hits.some((hit) => hit.tag === "combo_enabler"),
  );
  assert.ok(
    analysis.taggedCommanders[0]?.hits.some((hit) => hit.tag === "interaction_engine"),
  );
});

test("analyzeDeckCommander boosts commanders that turn infinite mana into value", () => {
  const analysis = analyzeDeckCommander(
    createDocument([
      createCommanderCard({
        name: "Thrasios, Triton Hero",
        cmc: 2,
        type_line: "Legendary Creature - Merfolk Wizard",
        oracle_text:
          "{4}: Scry 1, then reveal the top card of your library. If it's a land card, put it onto the battlefield tapped. Otherwise draw a card.",
        color_identity: ["G", "U"],
      }),
    ]),
    {
      mainStrategy: { key: "combo", label: "Combo" },
      synergy: {
        commanderAligned: true,
      },
      perspectives: [],
    } as any,
    {
      primaryPlan: {
        key: "infinite_combo",
        label: "Infinite Combo",
      },
    } as any,
    {
      combos: {
        lookupStatus: "ok",
        exact: [
          {
            lineType: "engine",
            commanderInvolved: false,
            cardNames: ["Basalt Monolith", "Rings of Brighthearth"],
            outcomeNames: ["Infinite colorless mana"],
            description: "Infinite colorless mana.",
            id: "basalt-rings",
            comboValue: 1.2,
            notablePrerequisites: [],
            variantCount: 1,
          },
        ],
      },
    } as any,
  );

  assert.ok(analysis.counts.combo >= 0.8);
  assert.ok(analysis.counts.cards >= 0.7);
  assert.ok(
    analysis.taggedCommanders[0]?.hits.some((hit) => hit.tag === "card_engine"),
  );
  assert.ok(
    analysis.findings.some((entry) => entry.code === "commander_infinite_mana_sink"),
  );
});

test("analyzeDeckCommander raises influence for dense commander profile support", () => {
  const analysis = analyzeDeckCommander(
    createDocument([
      createCommanderCard({
        name: "Aura Commander",
        cmc: 3,
        type_line: "Legendary Creature - Human Druid",
        oracle_text:
          "Whenever an enchantment enters the battlefield under your control, draw a card.",
        color_identity: ["G", "W"],
      }),
    ]),
    {
      mainStrategy: { key: "enchantress", label: "Enchantress" },
      synergy: {
        commanderAligned: true,
      },
      commanderProfiles: [
        {
          commanderName: "Aura Commander",
          key: "enchantress",
          label: "Enchantments Package",
          supportReason: "Commander rewards enchantment density.",
          supportTarget: 12,
          supportCount: 16,
          coreCount: 8,
          confidence: 88,
          supportCards: [],
          missingPieces: [],
        },
      ],
      perspectives: [],
    } as any,
    {
      primaryPlan: {
        key: "value_attrition",
        label: "Value Attrition",
      },
    } as any,
    {
      combos: {
        lookupStatus: "ok",
        exact: [],
      },
    } as any,
  );

  assert.ok(analysis.impactScore >= 52);
  assert.ok(analysis.dependencyScore >= 72);
  assert.ok(analysis.ceilingScore >= 60);
  assert.ok(analysis.findings.some((entry) => entry.code === "commander_profile_influence_bonus"));
});

test("analyzeDeckCommander treats supported X-copy commanders as high peak-turn influence", () => {
  const analysis = analyzeDeckCommander(
    createDocument([
      createCommanderCard({
        name: "X Copy Commander",
        cmc: 4,
        type_line: "Legendary Creature - Human Tyranid Wizard",
        oracle_text:
          "{T}: Add {C}{C}. When you next cast a spell with X in its mana cost or activate an ability with X in its activation cost this turn, copy that spell or ability.",
        color_identity: ["G", "U", "R"],
      }),
    ]),
    {
      mainStrategy: { key: "counters", label: "Counters" },
      synergy: {
        commanderAligned: true,
      },
      commanderProfiles: [
        {
          commanderName: "X Copy Commander",
          key: "counters",
          label: "Counters Package",
          supportReason: "Commander multiplies scalable X counter payoffs.",
          supportTarget: 14,
          supportCount: 29,
          coreCount: 29,
          confidence: 100,
          supportCards: [],
          missingPieces: [],
        },
      ],
      perspectives: [],
    } as any,
    {
      primaryPlan: {
        key: "big_mana_haymakers",
        label: "Big Mana Haymakers",
      },
    } as any,
    {
      combos: {
        lookupStatus: "ok",
        exact: [],
      },
    } as any,
  );

  assert.ok(analysis.counts.mana >= 1);
  assert.ok(analysis.counts.combo >= 1);
  assert.ok(analysis.impactScore >= 75);
  assert.ok(analysis.ceilingScore >= 82);
  assert.ok(analysis.findings.some((entry) => entry.code === "commander_profile_influence_bonus"));
});

function createDocument(resolvedCards: any[]) {
  return {
    format: "edh",
    parse: {
      entries: [],
      errors: [],
      warnings: [],
      totalCards: 100,
      uniqueCards: 100,
    },
    result: {
      resolvedCards,
      unresolvedCards: [],
      resolvedCount: resolvedCards.length,
      unresolvedCount: 0,
    },
  } as any;
}

function createCommanderCard(overrides: Record<string, unknown>) {
  return {
    quantity: 1,
    section: "commander",
    requestedName: overrides.name,
    originalLine: `1 ${overrides.name}`,
    lineNumber: 1,
    card: {
      id: "card-id",
      name: overrides.name,
      cmc: overrides.cmc ?? 4,
      type_line: overrides.type_line ?? "Legendary Creature",
      oracle_text: overrides.oracle_text ?? "",
      color_identity: overrides.color_identity ?? ["U"],
      keywords: overrides.keywords ?? [],
      layout: "normal",
      scryfall_uri: "https://scryfall.com/card/test",
    },
  };
}

function createMainboardCard(overrides: Record<string, unknown>) {
  return {
    quantity: 1,
    section: "mainboard",
    requestedName: overrides.name,
    originalLine: `1 ${overrides.name}`,
    lineNumber: 2,
    card: {
      id: "card-id-main",
      name: overrides.name,
      cmc: overrides.cmc ?? 2,
      type_line: overrides.type_line ?? "Artifact",
      oracle_text: overrides.oracle_text ?? "",
      color_identity: overrides.color_identity ?? [],
      keywords: overrides.keywords ?? [],
      layout: "normal",
      scryfall_uri: "https://scryfall.com/card/test",
    },
  };
}
