import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckDraw } from "./drawAnalysis";
import { DeckResolutionDocument, DeckSection, ResolvedDeckCard, ScryfallCard } from "./types";

test("analyzeDeckDraw classifies generic wording-based draw patterns", () => {
  const document = createDocument([
    createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 3),
    createResolvedCard("mainboard", 35, "Basic Island", "Basic Land - Island", 0, "{T}: Add {U}."),
    createResolvedCard("mainboard", 1, "Study Spell", "Sorcery", 3, "Draw two cards."),
    createResolvedCard(
      "mainboard",
      1,
      "Research Log",
      "Sorcery",
      3,
      "Draw three cards, then discard a card.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Archive Engine",
      "Artifact",
      3,
      "At the beginning of your upkeep, draw a card.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Impulse Spark",
      "Enchantment",
      4,
      "At the beginning of your end step, exile the top card of your library. Until the end of your next turn, you may play that card.",
    ),
    createResolvedCard(
      "mainboard",
      1,
      "Deep Search",
      "Instant",
      2,
      "Look at the top four cards of your library. Put one of them into your hand and the rest into your graveyard.",
    ),
    createResolvedCard("mainboard", 59, "Filler Spell", "Creature - Scout", 2, ""),
  ]);

  const analysis = analyzeDeckDraw(document);
  const taggedCards = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(analysis.counts.draw >= 2 && analysis.counts.draw <= 2.5);
  assert.ok(analysis.counts.selection >= 1.6 && analysis.counts.selection <= 1.9);
  assert.ok(analysis.counts.repeatable >= 1.7 && analysis.counts.repeatable <= 1.9);
  assert.ok(taggedCards.get("Study Spell")?.has("card_draw"));
  assert.ok(taggedCards.get("Research Log")?.has("card_draw"));
  assert.ok(taggedCards.get("Research Log")?.has("card_selection"));
  assert.ok(taggedCards.get("Archive Engine")?.has("repeatable_advantage"));
  assert.ok(taggedCards.get("Impulse Spark")?.has("card_selection"));
  assert.ok(taggedCards.get("Impulse Spark")?.has("repeatable_advantage"));
  assert.ok(taggedCards.get("Deep Search")?.has("card_selection"));
});

test("analyzeDeckDraw treats looting as selection first, not full draw", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Rogue", 2),
      createResolvedCard(
        "mainboard",
        1,
        "Merfolk Looter Style",
        "Creature - Merfolk Rogue",
        2,
        "{T}: Draw a card, then discard a card.",
      ),
      createResolvedCard("mainboard", 98, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const looter = analysis.taggedCards.find((card) => card.name === "Merfolk Looter Style");

  assert.ok(looter);
  assert.ok(looter?.hits.some((hit) => hit.tag === "card_draw"));
  assert.ok(looter?.hits.some((hit) => hit.tag === "card_selection"));
  assert.ok(looter?.hits.some((hit) => hit.tag === "repeatable_advantage"));
  assert.ok(analysis.counts.selection > analysis.counts.draw);
});

test("analyzeDeckDraw treats top filtering as selection, not repeatable card advantage", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 2),
      createResolvedCard(
        "mainboard",
        1,
        "Sensei's Divining Top Style",
        "Artifact",
        1,
        "{1}: Look at the top three cards of your library, then put them back in any order. {T}: Draw a card, then put Sensei's Divining Top Style on top of its owner's library.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Ponder Style",
        "Sorcery",
        1,
        "Look at the top three cards of your library, then put them back in any order. You may shuffle. Draw a card.",
      ),
      createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const top = analysis.taggedCards.find((card) => card.name === "Sensei's Divining Top Style");
  const ponder = analysis.taggedCards.find((card) => card.name === "Ponder Style");

  assert.ok(top);
  assert.deepEqual(
    top?.hits.map((hit) => hit.tag),
    ["card_selection"],
  );
  assert.ok(ponder?.hits.some((hit) => hit.tag === "card_selection"));
  assert.ok(ponder?.hits.some((hit) => hit.tag === "card_draw"));
  assert.ok(!ponder?.hits.some((hit) => hit.tag === "repeatable_advantage"));
});

test("analyzeDeckDraw discounts draw that costs sacrificed material", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Cleric", 2),
      createResolvedCard("mainboard", 1, "Clean Draw Two", "Instant", 2, "Draw two cards."),
      createResolvedCard(
        "mainboard",
        1,
        "Village Rites Style",
        "Instant",
        1,
        "As an additional cost to cast this spell, sacrifice a creature. Draw two cards.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Sacrifice Engine Style",
        "Creature - Vampire",
        2,
        "Sacrifice another creature: Draw a card.",
      ),
      createResolvedCard("mainboard", 96, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const values = new Map(analysis.taggedCards.map((card) => [card.name, card.drawValue]));
  const taggedCards = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(taggedCards.get("Village Rites Style")?.has("card_draw"));
  assert.ok(taggedCards.get("Sacrifice Engine Style")?.has("card_draw"));
  assert.ok((values.get("Clean Draw Two") ?? 0) > (values.get("Village Rites Style") ?? 0));
  assert.ok((values.get("Clean Draw Two") ?? 0) > (values.get("Sacrifice Engine Style") ?? 0));
});

test("analyzeDeckDraw treats mill-then-pick effects as card selection", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard("commander", 1, "Golgari Commander", "Legendary Creature - Druid", 3),
      createResolvedCard(
        "mainboard",
        1,
        "Grisly Salvage Style",
        "Instant",
        2,
        "Mill three cards. You may put a creature or land card from among the cards milled this way into your hand.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Battlefield Dig Style",
        "Sorcery",
        4,
        "Look at the top five cards of your library. You may put a creature card from among them onto the battlefield.",
      ),
      createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const taggedCards = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(taggedCards.get("Grisly Salvage Style")?.has("card_selection"));
  assert.ok(taggedCards.get("Battlefield Dig Style")?.has("card_selection"));
  assert.ok(analysis.counts.selection > 0);
});

test("analyzeDeckDraw does not flag ordinary non-draw cards", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard("commander", 1, "Mono Commander", "Legendary Creature - Human", 2),
      createResolvedCard("mainboard", 50, "Bear", "Creature - Bear", 2, ""),
      createResolvedCard("mainboard", 49, "Shock Variant", "Instant", 1, "This spell deals 2 damage to any target."),
    ]),
  );

  assert.equal(analysis.taggedCards.length, 0);
  assert.ok(analysis.drawScore <= 35);
  assert.ok(analysis.findings.some((finding) => finding.code === "draw_core_low"));
});

test("analyzeDeckDraw ignores draw references that are not actual card draw", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard("commander", 1, "Mono Commander", "Legendary Creature - Human", 2),
      createResolvedCard(
        "mainboard",
        1,
        "Laboratory Maniac",
        "Creature - Human Wizard",
        3,
        "If you would draw a card while your library has no cards in it, you win the game instead.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Draw Payoff",
        "Creature - Wizard",
        3,
        "Whenever you draw a card, each opponent loses 1 life.",
      ),
      createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  assert.equal(analysis.taggedCards.length, 0);
});

test("analyzeDeckDraw catches recurring external card-access engines like Grolnok", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Grolnok, the Omnivore",
        "Legendary Creature - Frog",
        4,
        "Whenever a Frog you control attacks, mill three cards. Whenever a permanent card is put into your graveyard from your library, exile it with a croak counter on it. You may play lands and cast spells from among cards you own in exile with croak counters on them.",
        { color_identity: ["G", "U"] },
      ),
      createResolvedCard("mainboard", 99, "Filler Spell", "Creature - Frog", 2, ""),
    ]),
  );

  const grolnok = analysis.taggedCards.find((card) => card.name === "Grolnok, the Omnivore");

  assert.ok(grolnok);
  assert.ok(grolnok?.hits.some((hit) => hit.tag === "card_selection"));
  assert.ok(grolnok?.hits.some((hit) => hit.tag === "repeatable_advantage"));
});

test("analyzeDeckDraw counts investigate and clue creation as delayed draw", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Detective", 3),
      createResolvedCard("mainboard", 1, "Case Notes", "Sorcery", 2, "Investigate."),
      createResolvedCard(
        "mainboard",
        1,
        "Evidence Cache",
        "Instant",
        3,
        "Create two Clue tokens.",
      ),
      createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const caseNotes = analysis.taggedCards.find((card) => card.name === "Case Notes");
  const evidenceCache = analysis.taggedCards.find((card) => card.name === "Evidence Cache");

  assert.ok(caseNotes?.hits.some((hit) => hit.tag === "card_draw"));
  assert.ok(evidenceCache?.hits.some((hit) => hit.tag === "card_draw"));
  assert.ok((evidenceCache?.drawValue ?? 0) > (caseNotes?.drawValue ?? 0));
});

test("analyzeDeckDraw treats repeatable investigate as a long-game engine", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Detective", 3),
      createResolvedCard(
        "mainboard",
        1,
        "Trail of Evidence Style",
        "Enchantment",
        3,
        "Whenever you cast an instant or sorcery spell, investigate.",
      ),
      createResolvedCard("mainboard", 98, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const clueEngine = analysis.taggedCards.find((card) => card.name === "Trail of Evidence Style");

  assert.ok(clueEngine);
  assert.ok(clueEngine?.hits.some((hit) => hit.tag === "card_draw"));
  assert.ok(clueEngine?.hits.some((hit) => hit.tag === "repeatable_advantage"));
});

test("analyzeDeckDraw catches top-of-library access engines", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 4),
      createResolvedCard(
        "mainboard",
        1,
        "Future Sight Style",
        "Enchantment",
        5,
        "Play with the top card of your library revealed. You may play lands and cast spells from the top of your library.",
      ),
      createResolvedCard("mainboard", 98, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const engine = analysis.taggedCards.find((card) => card.name === "Future Sight Style");

  assert.ok(engine);
  assert.ok(engine?.hits.some((hit) => hit.tag === "card_selection"));
  assert.ok(engine?.hits.some((hit) => hit.tag === "repeatable_advantage"));
});

test("analyzeDeckDraw catches graveyard replay and recursion access", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 4),
      createResolvedCard(
        "mainboard",
        1,
        "Snapcaster Style",
        "Creature - Human Wizard",
        2,
        "Flash When this creature enters, target instant or sorcery card in your graveyard gains flashback until end of turn. The flashback cost is equal to its mana cost.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Muldrotha Style",
        "Legendary Creature - Elemental Avatar",
        6,
        "During each of your turns, you may play up to one permanent card of each permanent type from your graveyard.",
      ),
      createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const snapcaster = analysis.taggedCards.find((card) => card.name === "Snapcaster Style");
  const muldrotha = analysis.taggedCards.find((card) => card.name === "Muldrotha Style");

  assert.ok(snapcaster?.hits.some((hit) => hit.tag === "card_selection"));
  assert.ok(!snapcaster?.hits.some((hit) => hit.tag === "repeatable_advantage"));
  assert.ok(muldrotha?.hits.some((hit) => hit.tag === "card_selection"));
  assert.ok(muldrotha?.hits.some((hit) => hit.tag === "repeatable_advantage"));
});

test("analyzeDeckDraw catches long-term access to exiled cards without tagging payoffs", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 4),
      createResolvedCard(
        "mainboard",
        1,
        "Gonti Style",
        "Legendary Creature - Rogue",
        4,
        "When this creature enters, look at the top four cards of target opponent's library, exile one of them face down, then put the rest on the bottom of that library in a random order. For as long as that card remains exiled, you may look at it, you may cast it, and mana of any type can be spent to cast it.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Passionate Archaeologist Style",
        "Enchantment",
        3,
        "Commander creatures you own have \"Whenever you cast a spell from exile, this creature deals damage equal to that spell's mana value to target opponent.\"",
      ),
      createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const gonti = analysis.taggedCards.find((card) => card.name === "Gonti Style");
  const payoff = analysis.taggedCards.find((card) => card.name === "Passionate Archaeologist Style");

  assert.ok(gonti?.hits.some((hit) => hit.tag === "card_selection"));
  assert.ok(!gonti?.hits.some((hit) => hit.tag === "repeatable_advantage"));
  assert.equal(payoff, undefined);
});

test("analyzeDeckDraw catches draw triggers where the draw happens after the condition", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 4),
      createResolvedCard(
        "mainboard",
        1,
        "Wedding Ring Style",
        "Artifact",
        4,
        "Whenever an opponent who controls one of these tokens draws a card during their turn, you draw a card.",
      ),
      createResolvedCard("mainboard", 98, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const ring = analysis.taggedCards.find((card) => card.name === "Wedding Ring Style");

  assert.ok(ring);
  assert.ok(ring?.hits.some((hit) => hit.tag === "card_draw"));
  assert.ok(ring?.hits.some((hit) => hit.tag === "repeatable_advantage"));
});

test("analyzeDeckDraw catches continuous exile access with qualifiers", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Wizard", 4),
      createResolvedCard(
        "mainboard",
        1,
        "Haldan Style",
        "Legendary Creature - Human Wizard",
        3,
        "You may play noncreature cards from exile with fetch counters on them if you exiled them, and you may spend mana as though it were mana of any color to cast those spells.",
      ),
      createResolvedCard("mainboard", 98, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const haldan = analysis.taggedCards.find((card) => card.name === "Haldan Style");

  assert.ok(haldan);
  assert.ok(haldan?.hits.some((hit) => hit.tag === "card_selection"));
  assert.ok(haldan?.hits.some((hit) => hit.tag === "repeatable_advantage"));
});

test("analyzeDeckDraw boosts commander card-flow roles", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Archive Commander",
        "Legendary Artifact Creature - Construct",
        3,
        "At the beginning of your upkeep, draw a card.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Archive Engine",
        "Artifact",
        3,
        "At the beginning of your upkeep, draw a card.",
      ),
      createResolvedCard("mainboard", 98, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const commander = analysis.taggedCards.find((card) => card.name === "Archive Commander");
  const mainboard = analysis.taggedCards.find((card) => card.name === "Archive Engine");

  assert.ok(commander);
  assert.ok(mainboard);
  assert.ok((commander?.drawValue ?? 0) > (mainboard?.drawValue ?? 0));
  assert.ok((commander?.hits.find((hit) => hit.tag === "repeatable_advantage")?.weight ?? 0)
    > (mainboard?.hits.find((hit) => hit.tag === "repeatable_advantage")?.weight ?? 0));
});

test("analyzeDeckDraw connects face-down commander draw triggers to morph density", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Kadena Style Commander",
        "Legendary Creature - Naga Wizard",
        4,
        "Whenever a face-down creature enters the battlefield under your control, draw a card.",
      ),
      createResolvedCard(
        "mainboard",
        18,
        "Morph Creature",
        "Creature - Shapeshifter",
        3,
        "Morph {2}{U}",
        { keywords: ["Morph"] },
      ),
      createResolvedCard("mainboard", 81, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const commander = analysis.taggedCards.find((card) => card.name === "Kadena Style Commander");

  assert.ok(commander);
  assert.ok((commander?.drawValue ?? 0) >= 5);
  assert.ok(analysis.counts.draw >= 3);
  assert.ok(analysis.counts.repeatable >= 2);
});

test("analyzeDeckDraw rewards healthy raw draw and repeatable engines", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Engine Commander",
        "Legendary Creature - Sphinx",
        4,
      ),
      createResolvedCard("mainboard", 9, "Study Spell", "Sorcery", 3, "Draw two cards."),
      createResolvedCard(
        "mainboard",
        3,
        "Archive Engine",
        "Artifact",
        3,
        "At the beginning of your upkeep, draw a card.",
      ),
      createResolvedCard(
        "mainboard",
        2,
        "Impulse Spark",
        "Enchantment",
        4,
        "At the beginning of your end step, exile the top card of your library. Until the end of your next turn, you may play that card.",
      ),
      createResolvedCard("mainboard", 85, "Filler Spell", "Creature - Wizard", 3, ""),
    ]),
  );

  assert.ok(analysis.counts.draw >= analysis.recommendations.drawTarget);
  assert.ok(analysis.counts.repeatable >= analysis.recommendations.repeatableTarget);
  assert.ok(analysis.drawScore >= 76);
});

test("analyzeDeckDraw adjusts raw draw expectations by color identity", () => {
  const boros = analyzeDeckDraw(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Boros Commander",
        "Legendary Creature - Soldier",
        3,
        "",
        { color_identity: ["R", "W"] },
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Impulse Engine",
        "Enchantment",
        3,
        "At the beginning of your end step, exile the top card of your library. Until the end of your next turn, you may play that card.",
      ),
      createResolvedCard("mainboard", 95, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const dimir = analyzeDeckDraw(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Dimir Commander",
        "Legendary Creature - Rogue",
        3,
        "",
        { color_identity: ["U", "B"] },
      ),
      createResolvedCard(
        "mainboard",
        4,
        "Impulse Engine",
        "Enchantment",
        3,
        "At the beginning of your end step, exile the top card of your library. Until the end of your next turn, you may play that card.",
      ),
      createResolvedCard("mainboard", 95, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  assert.ok(boros.recommendations.drawTarget < dimir.recommendations.drawTarget);
  assert.ok(
    boros.findings.some((finding) => finding.message.includes("Selection helps more in these colors")),
  );
});

test("analyzeDeckDraw gives fair decks credit for repeatable black draw engines", () => {
  const analysis = analyzeDeckDraw(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Willowdusk, Essence Seer",
        "Legendary Creature - Dryad",
        3,
        "",
        { color_identity: ["B", "G"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Greed",
        "Enchantment",
        4,
        "{B}, Pay 2 life: Draw a card.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Well of Lost Dreams",
        "Artifact",
        4,
        "Whenever you gain life, you may pay X, where X is less than or equal to the amount of life you gained. If you do, draw X cards.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Alhammarret's Archive",
        "Artifact",
        5,
        "If you would gain life, you gain twice that much life instead. If you would draw a card except the first one you draw in each of your draw steps, draw two cards instead.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Ancient Craving",
        "Sorcery",
        4,
        "You draw three cards and you lose 3 life.",
      ),
      createResolvedCard("mainboard", 95, "Filler Spell", "Creature - Shaman", 3, ""),
    ]),
  );

  const greed = analysis.taggedCards.find((card) => card.name === "Greed");
  const well = analysis.taggedCards.find((card) => card.name === "Well of Lost Dreams");
  const archive = analysis.taggedCards.find((card) => card.name === "Alhammarret's Archive");

  assert.ok(greed?.hits.some((hit) => hit.tag === "repeatable_advantage"));
  assert.ok(well?.hits.some((hit) => hit.tag === "repeatable_advantage"));
  assert.ok(archive?.hits.some((hit) => hit.tag === "repeatable_advantage"));
  assert.ok(analysis.drawScore > 0);
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
