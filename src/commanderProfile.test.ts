import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCommanderProfiles } from "./commanderProfile";
import { DeckResolutionDocument, DeckSection, ResolvedDeckCard, ScryfallCard } from "./types";

test("analyzeCommanderProfiles infers face-down commander material generically", () => {
  const profiles = analyzeCommanderProfiles(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Face-Down Commander",
        "Legendary Creature - Snake Wizard",
        4,
        "The first face-down creature spell you cast each turn costs {3} less to cast. Whenever a face-down creature enters the battlefield under your control, draw a card.",
      ),
      createResolvedCard("mainboard", 6, "Morph Creature", "Creature - Beast", 3, "Morph {2}{G}."),
      createResolvedCard("mainboard", 4, "Manifest Engine", "Enchantment", 3, "At the beginning of your upkeep, manifest the top card of your library."),
      createResolvedCard("mainboard", 89, "Forest", "Basic Land - Forest", 0, ""),
    ]),
  );

  const faceDownProfile = profiles.find((profile) => profile.key === "face_down");
  assert.ok(faceDownProfile);
  assert.equal(faceDownProfile.supportCount, 10);
  assert.ok(faceDownProfile.confidence >= 60);
});

test("analyzeCommanderProfiles infers requested creature type packages", () => {
  const profiles = analyzeCommanderProfiles(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Rat Commander",
        "Legendary Creature - Rat Noble",
        3,
        "Whenever one or more Rats you control attack, draw a card.",
      ),
      createResolvedCard("mainboard", 12, "Rat Pack", "Creature - Rat Rogue", 2, ""),
      createResolvedCard("mainboard", 1, "Rat Anthem", "Enchantment", 3, "Rats you control get +1/+1."),
      createResolvedCard("mainboard", 86, "Swamp", "Basic Land - Swamp", 0, ""),
    ]),
  );

  const kindredProfile = profiles.find((profile) => profile.key === "kindred");
  assert.ok(kindredProfile);
  assert.equal(kindredProfile.supportCount, 13);
  assert.ok(kindredProfile.label.includes("Rat"));
});

test("analyzeCommanderProfiles shows thin support when a commander ask is not backed up", () => {
  const profiles = analyzeCommanderProfiles(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Tap Commander",
        "Legendary Creature - Human Wizard",
        3,
        "Whenever a creature an opponent controls becomes tapped, create a 1/1 creature token.",
      ),
      createResolvedCard("mainboard", 1, "Tap Spell", "Instant", 2, "Tap target creature."),
      createResolvedCard("mainboard", 98, "Island", "Basic Land - Island", 0, ""),
    ]),
  );

  const tapProfile = profiles.find((profile) => profile.key === "tap_untap");
  assert.ok(tapProfile);
  assert.equal(tapProfile.supportCount, 1);
  assert.ok(tapProfile.confidence < 52);
  assert.ok(tapProfile.missingPieces.length > 0);
});

test("analyzeCommanderProfiles does not treat commander creature types as kindred asks", () => {
  const profiles = analyzeCommanderProfiles(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Ludevic, Necro-Alchemist",
        "Legendary Creature - Human Wizard",
        3,
        "At the beginning of each player's end step, that player may draw a card if a player other than you lost life this turn.",
      ),
      createResolvedCard("mainboard", 6, "Helpful Human", "Creature - Human Advisor", 2, ""),
      createResolvedCard("mainboard", 93, "Island", "Basic Land - Island", 0, ""),
    ]),
  );

  assert.ok(!profiles.some((profile) => profile.key === "kindred"));
});

test("analyzeCommanderProfiles does not treat standalone lifelink as a lifegain ask", () => {
  const profiles = analyzeCommanderProfiles(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Tymna the Weaver",
        "Legendary Creature - Human Cleric",
        3,
        "Lifelink. At the beginning of your postcombat main phase, you may pay X life. If you do, draw X cards, where X is the number of opponents that were dealt combat damage this turn.",
      ),
      createResolvedCard("mainboard", 6, "Incidental Life Card", "Creature - Cleric", 2, "When this creature enters, you gain 2 life."),
      createResolvedCard("mainboard", 93, "Plains", "Basic Land - Plains", 0, ""),
    ]),
  );

  assert.ok(!profiles.some((profile) => profile.key === "lifegain"));
});

test("analyzeCommanderProfiles reads creature-type asks from commander text without existing density", () => {
  const profiles = analyzeCommanderProfiles(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "The Ur-Dragon",
        "Legendary Creature - Dragon Avatar",
        9,
        "Other Dragon spells you cast cost {1} less to cast. Whenever one or more Dragons you control attack, draw that many cards.",
      ),
      createResolvedCard("mainboard", 99, "Mountain", "Basic Land - Mountain", 0, ""),
    ]),
  );

  const dragonProfile = profiles.find((profile) => profile.key === "kindred" && profile.label.includes("Dragon"));
  assert.ok(dragonProfile);
  assert.equal(dragonProfile.supportCount, 0);
});

test("analyzeCommanderProfiles detects broad top-commander package asks", () => {
  const profiles = analyzeCommanderProfiles(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Jodah, the Unifier",
        "Legendary Creature - Human Wizard",
        5,
        "Legendary creatures you control get +X/+X, where X is the number of legendary creatures you control. Whenever you cast a legendary spell from your hand, exile cards from the top of your library.",
      ),
      createResolvedCard(
        "commander",
        1,
        "Muldrotha, the Gravetide",
        "Legendary Creature - Elemental Avatar",
        6,
        "During each of your turns, you may play a land and cast a permanent spell of each permanent type from your graveyard.",
      ),
      createResolvedCard(
        "commander",
        1,
        "Isshin, Two Heavens as One",
        "Legendary Creature - Human Samurai",
        3,
        "If a creature attacking causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.",
      ),
      createResolvedCard("mainboard", 97, "Plains", "Basic Land - Plains", 0, ""),
    ]),
  );

  assert.ok(profiles.some((profile) => profile.key === "legends_matter"));
  assert.ok(profiles.some((profile) => profile.key === "reanimator"));
  assert.ok(profiles.some((profile) => profile.key === "aggro" && profile.label === "Attack-Trigger Package"));
});

test("analyzeCommanderProfiles detects draw-punisher commanders as group-slug asks", () => {
  const profiles = analyzeCommanderProfiles(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Nekusar, the Mindrazer",
        "Legendary Creature - Zombie Wizard",
        5,
        "At the beginning of each player's draw step, that player draws an additional card. Whenever an opponent draws a card, Nekusar deals 1 damage to that player.",
      ),
      createResolvedCard("mainboard", 99, "Swamp", "Basic Land - Swamp", 0, ""),
    ]),
  );

  assert.ok(profiles.some((profile) => profile.key === "group_slug"));
});

test("analyzeCommanderProfiles detects dice, food, discard, and artifact-sacrifice asks", () => {
  const profiles = analyzeCommanderProfiles(
    createDocument([
      createResolvedCard(
        "commander",
        1,
        "Mr. House, President and CEO",
        "Legendary Artifact Creature - Human",
        4,
        "Whenever you roll a 4 or higher, create a 3/3 colorless Robot artifact creature token. {4}, {T}: Roll a six-sided die.",
      ),
      createResolvedCard(
        "commander",
        1,
        "Ygra, Eater of All",
        "Legendary Creature - Elemental Cat",
        5,
        "Other creatures are Food artifacts in addition to their other types. Whenever a Food is put into a graveyard from the battlefield, put two +1/+1 counters on Ygra.",
      ),
      createResolvedCard(
        "commander",
        1,
        "Hashaton, Scarab's Fist",
        "Legendary Creature - Zombie Wizard",
        3,
        "Whenever you discard a creature card, you may pay {2}{U}. If you do, create a tapped token that's a copy of that card.",
      ),
      createResolvedCard(
        "commander",
        1,
        "Breya, Etherium Shaper",
        "Legendary Artifact Creature - Human",
        4,
        "When Breya enters, create two 1/1 blue Thopter artifact creature tokens with flying. {2}, Sacrifice two artifacts: Choose one.",
      ),
      createResolvedCard("mainboard", 96, "Island", "Basic Land - Island", 0, ""),
    ]),
  );

  assert.ok(profiles.some((profile) => profile.key === "dice_rolls"));
  assert.ok(profiles.some((profile) => profile.key === "food"));
  assert.ok(profiles.some((profile) => profile.key === "madness"));
  assert.ok(profiles.some((profile) => profile.key === "artifacts"));
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
