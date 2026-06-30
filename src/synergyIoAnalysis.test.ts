import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckSynergyIo, inferSynergyIoAtoms } from "./synergyIoAnalysis";
import { DeckResolutionDocument, DeckSection, ScryfallCard } from "./types";

test("inferSynergyIoAtoms separates graveyard triggers from graveyard outputs", () => {
  const payoff = createCard(
    "Grave Listener",
    "Creature - Spirit",
    3,
    "Whenever one or more cards leave your graveyard, draw a card.",
  );
  const output = createCard(
    "Grave Return",
    "Sorcery",
    2,
    "Return target creature card from your graveyard to your hand.",
  );

  assertAtom(inferSynergyIoAtoms(payoff), "graveyard", "input", "graveyard_leave_trigger");
  assertAtom(inferSynergyIoAtoms(payoff), "graveyard", "payoff", "graveyard_leave_payoff");
  assertAtom(inferSynergyIoAtoms(output), "graveyard", "output", "return_graveyard_to_hand");
});

test("analyzeDeckSynergyIo summarizes complete and incomplete packages", () => {
  const commander = createCard("Life Commander", "Legendary Creature - Cleric", 3, "", {
    color_identity: ["W", "B"],
  });
  const graveListener = createCard(
    "Grave Listener",
    "Creature - Spirit",
    3,
    "Whenever one or more cards leave your graveyard, draw a card.",
  );
  const graveReturn = createCard(
    "Grave Return",
    "Sorcery",
    2,
    "Return target creature card from your graveyard to your hand.",
  );
  const bloodArtist = createCard(
    "Death Payoff",
    "Creature - Vampire",
    2,
    "Whenever another creature you control dies, each opponent loses 1 life and you gain 1 life.",
  );
  const sacrificeOutlet = createCard(
    "Sacrifice Outlet",
    "Creature - Zombie",
    2,
    "Sacrifice a creature: Draw a card.",
  );
  const tokenMaker = createCard(
    "Token Maker",
    "Sorcery",
    3,
    "Create two 1/1 white Soldier creature tokens.",
  );
  const counterPayoff = createCard(
    "Counter Listener",
    "Creature - Elf",
    2,
    "Whenever one or more +1/+1 counters are put on a creature you control, draw a card.",
  );
  const lifePayoff = createCard(
    "Lifegain Listener",
    "Creature - Cleric",
    2,
    "Whenever you gain life, put a +1/+1 counter on this creature.",
  );

  const analysis = analyzeDeckSynergyIo(createDeckDocument([
    { card: commander, section: "commander" },
    { card: graveListener },
    { card: graveReturn },
    { card: bloodArtist },
    { card: sacrificeOutlet },
    { card: tokenMaker },
    { card: counterPayoff },
    { card: lifePayoff },
  ]));
  const packages = new Map(analysis.packages.map((entry) => [entry.domain, entry]));

  assert.ok((packages.get("graveyard")?.score ?? 0) > 0);
  assert.ok((packages.get("graveyard")?.inputs ?? 0) > 0);
  assert.ok((packages.get("graveyard")?.outputs ?? 0) > 0);
  assert.ok((packages.get("graveyard")?.payoffs ?? 0) > 0);
  assert.ok((packages.get("sacrifice")?.score ?? 0) > 0);
  assert.ok((packages.get("tokens")?.outputs ?? 0) > 0);
  assert.ok((packages.get("tokens")?.gaps ?? []).length > 0);
  assert.ok((packages.get("counters")?.inputs ?? 0) > 0);
  assert.ok((packages.get("lifegain")?.inputs ?? 0) > 0);
  assert.ok(analysis.summary.includes("Strongest Synergy IO packages"));
});

test("inferSynergyIoAtoms recognizes spell, token, counter, sacrifice, and lifegain roles", () => {
  const spells = inferSynergyIoAtoms(createCard(
    "Magecraft Payoff",
    "Creature - Wizard",
    2,
    "Whenever you cast an instant or sorcery spell, create a Treasure token.",
  ));
  const tokens = inferSynergyIoAtoms(createCard(
    "Token Anthem",
    "Enchantment",
    3,
    "Creature tokens you control get +1/+1.",
  ));
  const counters = inferSynergyIoAtoms(createCard(
    "Counter Spell",
    "Sorcery",
    2,
    "Put two +1/+1 counters on target creature. Proliferate.",
  ));
  const lifegain = inferSynergyIoAtoms(createCard(
    "Soul Sister",
    "Creature - Cleric",
    1,
    "Whenever you gain life, draw a card. Lifelink",
  ));

  assertAtom(spells, "spells", "input", "spell_cast_trigger");
  assertAtom(spells, "spells", "payoff", "spell_cast_payoff");
  assertAtom(tokens, "tokens", "payoff", "token_board_payoff");
  assertAtom(counters, "counters", "output", "counter_placement_output");
  assertAtom(lifegain, "lifegain", "input", "lifegain_trigger");
  assertAtom(lifegain, "lifegain", "output", "lifegain_output");
  assertAtom(lifegain, "lifegain", "payoff", "lifegain_payoff");
});

test("inferSynergyIoAtoms recognizes expanded synergy families and friction", () => {
  const kindred = inferSynergyIoAtoms(createCard(
    "Elf Lord",
    "Creature - Elf Druid",
    3,
    "Elves you control get +1/+1. Whenever an Elf you control enters, draw a card.",
  ));
  const artifact = inferSynergyIoAtoms(createCard(
    "Artifact Engine",
    "Artifact",
    3,
    "Whenever an artifact enters under your control, draw a card. Create a Treasure token.",
  ));
  const enchantment = inferSynergyIoAtoms(createCard(
    "Enchantress",
    "Enchantment Creature - Human Druid",
    3,
    "Constellation — Whenever an enchantment enters under your control, draw a card.",
  ));
  const discard = inferSynergyIoAtoms(createCard(
    "Madness Outlet",
    "Creature - Vampire",
    2,
    "Discard a card: Draw a card. Whenever you discard a card, each opponent loses 1 life.",
  ));
  const combat = inferSynergyIoAtoms(createCard(
    "Raid Captain",
    "Creature - Human Warrior",
    3,
    "Whenever this creature attacks, create a Treasure token. Creatures you control get +1/+0.",
  ));
  const timing = inferSynergyIoAtoms(createCard(
    "Flash Delay",
    "Instant",
    2,
    "Flash. Suspend 2—{U}. Activate only as a sorcery.",
  ));
  const protection = inferSynergyIoAtoms(createCard(
    "Shield Spell",
    "Instant",
    1,
    "Target creature you control gains hexproof and indestructible until end of turn.",
  ));

  assertAtom(kindred, "kindred", "output", "creature_type_material");
  assertAtom(kindred, "kindred", "input", "type_event_trigger");
  assertAtom(kindred, "kindred", "payoff", "type_board_payoff");
  assertAtom(artifact, "artifacts", "input", "artifact_event_trigger");
  assertAtom(artifact, "artifacts", "output", "artifact_token_output");
  assertAtom(enchantment, "enchantments", "input", "enchantment_event_trigger");
  assertAtom(enchantment, "enchantments", "output", "enchantment_material");
  assertAtom(discard, "discard", "input", "discard_trigger");
  assertAtom(discard, "discard", "output", "self_discard_output");
  assertAtom(combat, "combat", "input", "attack_damage_trigger");
  assertAtom(combat, "combat", "output", "combat_body_output");
  assertAtom(timing, "timing", "output", "instant_speed_output");
  assertAtom(timing, "timing", "friction", "timing_restriction_friction");
  assertAtom(protection, "protection", "output", "protection_output");
});

test("analyzeDeckSynergyIo compares commander asks against main-deck support", () => {
  const commander = createCard(
    "Artifact Commander",
    "Legendary Creature - Human Artificer",
    3,
    "Whenever an artifact enters under your control, draw a card.",
    { color_identity: ["U"] },
  );
  const treasureMaker = createCard(
    "Treasure Maker",
    "Sorcery",
    2,
    "Create two Treasure tokens.",
    { color_identity: ["U"] },
  );
  const artifactCreature = createCard(
    "Artifact Body",
    "Artifact Creature - Thopter",
    2,
    "Flying",
    { color_identity: ["U"] },
  );
  const unsupportedCommander = createCard(
    "Combat Commander",
    "Legendary Creature - Warrior",
    3,
    "Whenever one or more creatures you control deal combat damage to a player, draw a card.",
    { color_identity: ["U"] },
  );

  const supported = analyzeDeckSynergyIo(createDeckDocument([
    { card: commander, section: "commander" },
    { card: treasureMaker },
    { card: artifactCreature },
  ]));
  const unsupported = analyzeDeckSynergyIo(createDeckDocument([
    { card: unsupportedCommander, section: "commander" },
    { card: artifactCreature },
  ]));
  const artifactMatch = supported.commanderSynergy.matches.find((match) => match.domain === "artifacts");

  assert.ok((artifactMatch?.score ?? 0) > 0);
  assert.ok(supported.commanderSynergy.score > unsupported.commanderSynergy.score);
  assert.ok(unsupported.commanderSynergy.gaps.some((gap) => gap.includes("Combat")));
});

function assertAtom(
  atoms: ReturnType<typeof inferSynergyIoAtoms>,
  domain: string,
  kind: string,
  tag: string,
) {
  assert.ok(
    atoms.some((atom) => atom.domain === domain && atom.kind === kind && atom.tag === tag),
    `Expected ${domain}/${kind}/${tag}`,
  );
}

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

function createDeckDocument(
  cards: Array<{
    card: ScryfallCard;
    quantity?: number;
    section?: DeckSection;
  }>,
): DeckResolutionDocument {
  return {
    format: "edh",
    parse: {
      entries: [],
      errors: [],
      warnings: [],
      totalCards: cards.reduce((sum, entry) => sum + (entry.quantity ?? 1), 0),
      uniqueCards: cards.length,
    },
    result: {
      resolvedCards: cards.map((entry, index) => ({
        quantity: entry.quantity ?? 1,
        section: entry.section ?? "mainboard",
        requestedName: entry.card.name,
        originalLine: `${entry.quantity ?? 1} ${entry.card.name}`,
        lineNumber: index + 1,
        card: entry.card,
      })),
      unresolvedCards: [],
      resolvedCount: cards.reduce((sum, entry) => sum + (entry.quantity ?? 1), 0),
      unresolvedCount: 0,
    },
  };
}
