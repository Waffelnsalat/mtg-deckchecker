import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDeckProtection } from "./protectionAnalysis";
import { DeckResolutionDocument, DeckSection, ResolvedDeckCard, ScryfallCard } from "./types";

test("analyzeDeckProtection classifies broad, targeted, equipment, bounce, and flicker protection", () => {
  const analysis = analyzeDeckProtection(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Human", 3, "", {
        color_identity: ["W", "U"],
      }),
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
        "Safekeeping Style",
        "Instant",
        1,
        "Target permanent you control gains hexproof and indestructible until end of turn.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Lightning Greaves Style",
        "Artifact - Equipment",
        2,
        "Equipped creature has shroud and haste. Equip {0}.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Rescue Style",
        "Instant",
        1,
        "Return target creature you control to its owner's hand.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Ephemerate Style",
        "Instant",
        1,
        "Exile target creature you control, then return it to the battlefield under its owner's control.",
      ),
      createResolvedCard("mainboard", 94, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Heroic Intervention Style")?.has("broad_protection"));
  assert.ok(labels.get("Safekeeping Style")?.has("targeted_protection"));
  assert.ok(labels.get("Lightning Greaves Style")?.has("equipment_protection"));
  assert.ok(labels.get("Rescue Style")?.has("self_bounce"));
  assert.ok(labels.get("Ephemerate Style")?.has("flicker"));
  assert.ok(analysis.counts.broad > 0);
  assert.ok(analysis.counts.targeted > 0);
  assert.ok(analysis.counts.equipment > 0);
  assert.ok(analysis.counts.selfBounce > 0);
  assert.ok(analysis.counts.flicker > 0);
});

test("analyzeDeckProtection counts ward as protection support", () => {
  const analysis = analyzeDeckProtection(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Human", 3),
      createResolvedCard(
        "mainboard",
        1,
        "Ward Charm Style",
        "Instant",
        1,
        "Target creature gains ward {2} until end of turn.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Ward Boots Style",
        "Artifact - Equipment",
        2,
        "Equipped creature gets +1/+1 and has ward {1}. Equip {1}.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Team Ward Style",
        "Enchantment",
        3,
        "Artifacts you control have ward {1}.",
      ),
      createResolvedCard("mainboard", 96, "Filler Spell", "Artifact", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Ward Charm Style")?.has("targeted_protection"));
  assert.ok(labels.get("Ward Boots Style")?.has("equipment_protection"));
  assert.ok(labels.get("Team Ward Style")?.has("broad_protection"));
});

test("analyzeDeckProtection catches protection-from effects like Mother of Runes", () => {
  const analysis = analyzeDeckProtection(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Human", 3, "", {
        color_identity: ["W"],
      }),
      createResolvedCard(
        "mainboard",
        1,
        "Mother of Runes Style",
        "Creature - Human Cleric",
        1,
        "{T}: Target creature you control gains protection from the color of your choice until end of turn.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Team Protection Style",
        "Instant",
        2,
        "Creatures you control gain protection from black until end of turn.",
      ),
      createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Mother of Runes Style")?.has("targeted_protection"));
  assert.ok(labels.get("Team Protection Style")?.has("broad_protection"));
});

test("analyzeDeckProtection separates player protection from self-protected permanents", () => {
  const analysis = analyzeDeckProtection(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Human", 3, "", {
        color_identity: ["W"],
      }),
      createResolvedCard(
        "mainboard",
        1,
        "One Ring Style",
        "Legendary Artifact",
        4,
        "Indestructible. When this artifact enters, if you cast it, you gain protection from everything until your next turn.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Toski Style",
        "Legendary Creature - Squirrel",
        4,
        "This spell can't be countered. Indestructible. Whenever a creature you control deals combat damage to a player, draw a card.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Helix Pinnacle Style",
        "Enchantment",
        1,
        "Shroud. {X}: Put X tower counters on this enchantment.",
      ),
      createResolvedCard("mainboard", 96, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("One Ring Style")?.has("broad_protection"));
  assert.ok(!labels.has("Toski Style"));
  assert.ok(!labels.has("Helix Pinnacle Style"));
});

test("analyzeDeckProtection catches equipment that grants phasing protection", () => {
  const analysis = analyzeDeckProtection(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Human", 3),
      createResolvedCard(
        "mainboard",
        1,
        "Robe of Stars Style",
        "Artifact - Equipment",
        2,
        "Equipped creature gets +0/+3. Astral Projection — {1}{W}: Equipped creature phases out. Equip {1}.",
      ),
      createResolvedCard("mainboard", 98, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const robe = analysis.taggedCards.find((card) => card.name === "Robe of Stars Style");

  assert.ok(robe?.hits.some((hit) => hit.tag === "equipment_protection"));
});

test("analyzeDeckProtection does not treat Oubliette-style phasing removal as protection", () => {
  const analysis = analyzeDeckProtection(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Human", 3),
      createResolvedCard(
        "mainboard",
        1,
        "Oubliette Style",
        "Enchantment",
        3,
        "When this enchantment enters, target creature phases out until this enchantment leaves the battlefield. Tap that creature as it phases in this way.",
      ),
      createResolvedCard("mainboard", 98, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  assert.ok(!analysis.taggedCards.some((card) => card.name === "Oubliette Style"));
});

test("analyzeDeckProtection treats Brago and Eldrazi Displacer as flicker protection", () => {
  const analysis = analyzeDeckProtection(
    createDocument([
      createResolvedCard("commander", 1, "Test Commander", "Legendary Creature - Spirit", 4, "", {
        color_identity: ["W", "U"],
      }),
      createResolvedCard(
        "mainboard",
        1,
        "Eldrazi Displacer",
        "Creature - Eldrazi",
        3,
        "{2}{C}: Exile another target creature, then return it to the battlefield tapped under its owner's control.",
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Brago Style",
        "Legendary Creature - Spirit",
        4,
        "Whenever Brago Style deals combat damage to a player, exile any number of target nonland permanents you control, then return those cards to the battlefield under their owner's control.",
      ),
      createResolvedCard("mainboard", 97, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const labels = new Map(
    analysis.taggedCards.map((card) => [card.name, new Set(card.hits.map((hit) => hit.tag))]),
  );

  assert.ok(labels.get("Eldrazi Displacer")?.has("flicker"));
  assert.ok(labels.get("Brago Style")?.has("flicker"));
});

test("analyzeDeckProtection boosts commander protection roles", () => {
  const analysis = analyzeDeckProtection(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Shield Commander",
        "Legendary Creature - Knight",
        3,
        "Target creature you control gains indestructible until end of turn.",
        { color_identity: ["W"] },
      ),
      createResolvedCard(
        "mainboard",
        1,
        "Shield Spell",
        "Instant",
        1,
        "Target creature you control gains indestructible until end of turn.",
      ),
      createResolvedCard("mainboard", 98, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const commander = analysis.taggedCards.find((card) => card.name === "Shield Commander");
  const spell = analysis.taggedCards.find((card) => card.name === "Shield Spell");

  assert.ok((commander?.protectionValue ?? 0) > (spell?.protectionValue ?? 0));
});

test("analyzeDeckProtection keeps broad targets lower in colors with less access", () => {
  const rakdos = analyzeDeckProtection(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Rakdos Commander",
        "Legendary Creature - Devil",
        4,
        "",
        { color_identity: ["B", "R"] },
      ),
      createResolvedCard("mainboard", 99, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  const azorius = analyzeDeckProtection(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Azorius Commander",
        "Legendary Creature - Spirit",
        4,
        "",
        { color_identity: ["W", "U"] },
      ),
      createResolvedCard("mainboard", 99, "Filler Spell", "Creature - Human", 2, ""),
    ]),
  );

  assert.ok(rakdos.recommendations.broadTarget < azorius.recommendations.broadTarget);
  assert.ok(rakdos.recommendations.targetedTarget <= azorius.recommendations.targetedTarget);
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
