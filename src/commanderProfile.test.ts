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
