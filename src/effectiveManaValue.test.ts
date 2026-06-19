import assert from "node:assert/strict";
import test from "node:test";
import {
  createEffectiveManaValueContext,
  estimateEffectiveManaValue,
} from "./effectiveManaValue";
import { DeckSection, ResolvedDeckCard, ScryfallCard } from "./types";

test("estimateEffectiveManaValue lowers self-reducing sweepers", () => {
  const context = createEffectiveManaValueContext([
    createResolvedCard("commander", 1, "Commander", "Legendary Creature - Human", 3),
  ]);

  const effectiveManaValue = estimateEffectiveManaValue(
    createCard("Blasphemous Act", "Sorcery", 9, {
      oracle_text: "This spell costs {1} less to cast for each creature on the battlefield.",
    }),
    context,
  );

  assert.ok(effectiveManaValue < 5);
});

test("estimateEffectiveManaValue lowers explicit impending costs", () => {
  const effectiveManaValue = estimateEffectiveManaValue(
    createCard("Overlord of the Boilerbilges", "Enchantment Creature - Avatar Horror", 7, {
      oracle_text:
        "Impending 4—{2}{R}{R} (If you cast this spell for its impending cost, it enters with four time counters and isn't a creature until the last is removed.)",
    }),
  );

  assert.ok(effectiveManaValue < 5.5);
  assert.ok(effectiveManaValue > 4);
});

test("estimateEffectiveManaValue lowers free commander interaction", () => {
  const context = createEffectiveManaValueContext([
    createResolvedCard("commander", 1, "Rograkh, Son of Rohgahh", "Legendary Creature - Kobold Warrior", 0),
  ]);

  const effectiveManaValue = estimateEffectiveManaValue(
    createCard("Fierce Guardianship", "Instant", 3, {
      oracle_text:
        "If you control a commander, you may cast this spell without paying its mana cost. Counter target noncreature spell.",
    }),
    context,
  );

  assert.ok(effectiveManaValue < 1);
});

function createResolvedCard(
  section: DeckSection,
  quantity: number,
  name: string,
  typeLine: string,
  cmc: number,
  overrides: Partial<ScryfallCard> = {},
): ResolvedDeckCard {
  return {
    quantity,
    section,
    requestedName: name,
    originalLine: `${quantity} ${name}`,
    lineNumber: 1,
    card: createCard(name, typeLine, cmc, overrides),
  };
}

function createCard(
  name: string,
  typeLine: string,
  cmc: number,
  overrides: Partial<ScryfallCard> = {},
): ScryfallCard {
  return {
    id: name,
    name,
    cmc,
    type_line: typeLine,
    color_identity: [],
    keywords: [],
    layout: "normal",
    scryfall_uri: "https://scryfall.com",
    ...overrides,
  };
}
