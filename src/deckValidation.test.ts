import test from "node:test";
import assert from "node:assert/strict";
import { parseDecklist } from "./decklist";
import { validateEdhDeck } from "./deckValidation";
import { DeckResolutionDocument, ScryfallCard } from "./types";

test("parseDecklist can promote the first card to commander by default", () => {
  const result = parseDecklist(
    `
1 Delina, Wild Mage
99 Mountain
`,
    { assumeFirstCardAsCommander: true },
  );

  assert.equal(result.entries[0]?.section, "commander");
});

test("validateEdhDeck accepts a simple mono-red EDH deck", () => {
  const commanderCard = createCard({
    name: "Delina, Wild Mage",
    type_line: "Legendary Creature — Elf Shaman",
    color_identity: ["R"],
    legalities: { commander: "legal" },
  });
  const mountainCard = createCard({
    name: "Mountain",
    type_line: "Basic Land — Mountain",
    color_identity: ["R"],
    legalities: { commander: "legal" },
    oracle_text: "({T}: Add {R}.)",
  });

  const document: DeckResolutionDocument = {
    format: "edh",
    parse: {
      entries: [
        {
          lineNumber: 1,
          originalLine: "1 Delina, Wild Mage",
          quantity: 1,
          name: "Delina, Wild Mage",
          section: "commander",
        },
        {
          lineNumber: 2,
          originalLine: "99 Mountain",
          quantity: 99,
          name: "Mountain",
          section: "mainboard",
        },
      ],
      errors: [],
      warnings: [],
      totalCards: 100,
      uniqueCards: 2,
    },
    result: {
      resolvedCards: [
        {
          quantity: 1,
          section: "commander",
          requestedName: "Delina, Wild Mage",
          originalLine: "1 Delina, Wild Mage",
          lineNumber: 1,
          card: commanderCard,
        },
        {
          quantity: 99,
          section: "mainboard",
          requestedName: "Mountain",
          originalLine: "99 Mountain",
          lineNumber: 2,
          card: mountainCard,
        },
      ],
      unresolvedCards: [],
      resolvedCount: 2,
      unresolvedCount: 0,
    },
  };

  const validation = validateEdhDeck(document);

  assert.equal(validation.isValid, true);
  assert.equal(validation.issues.length, 0);
});

test("validateEdhDeck accepts multiple snow-covered basic lands", () => {
  const commanderCard = createCard({
    name: "Aesi, Tyrant of Gyre Strait",
    type_line: "Legendary Creature — Serpent",
    color_identity: ["G", "U"],
    legalities: { commander: "legal" },
  });
  const snowIslandCard = createCard({
    name: "Snow-Covered Island",
    type_line: "Basic Snow Land — Island",
    color_identity: ["U"],
    legalities: { commander: "legal" },
    oracle_text: "({T}: Add {U}.)",
  });
  const snowForestCard = createCard({
    name: "Snow-Covered Forest",
    type_line: "Basic Snow Land — Forest",
    color_identity: ["G"],
    legalities: { commander: "legal" },
    oracle_text: "({T}: Add {G}.)",
  });

  const validation = validateEdhDeck(
    createDocument([
      createResolvedCard(1, "commander", "Aesi, Tyrant of Gyre Strait", commanderCard),
      createResolvedCard(2, "mainboard", "Snow-Covered Island", snowIslandCard, 49),
      createResolvedCard(3, "mainboard", "Snow-Covered Forest", snowForestCard, 50),
    ]),
  );

  assert.equal(validation.isValid, true);
  assert.equal(validation.issues.length, 0);
});

test("validateEdhDeck accepts a commander-legal planeswalker", () => {
  const commanderCard = createCard({
    name: "Aminatou, the Fateshifter",
    type_line: "Legendary Planeswalker — Aminatou",
    color_identity: ["W", "U", "B"],
    legalities: { commander: "legal" },
    oracle_text:
      "+1: Draw a card, then put a card from your hand on top of your library.\nAminatou, the Fateshifter can be your commander.",
  });
  const plainsCard = createCard({
    name: "Plains",
    type_line: "Basic Land — Plains",
    color_identity: ["W"],
    legalities: { commander: "legal" },
    oracle_text: "({T}: Add {W}.)",
  });

  const validation = validateEdhDeck(
    createDocument([
      createResolvedCard(1, "commander", "Aminatou, the Fateshifter", commanderCard),
      createResolvedCard(2, "mainboard", "Plains", plainsCard, 99),
    ]),
  );

  assert.equal(validation.isValid, true);
  assert.equal(validation.issues.length, 0);
});

test("validateEdhDeck accepts a commander-legal legendary vehicle", () => {
  const commanderCard = createCard({
    name: "Adrestia",
    type_line: "Legendary Artifact — Vehicle",
    color_identity: ["U"],
    legalities: { commander: "legal" },
    oracle_text:
      "Islandwalk\nWhenever Adrestia attacks, if an Assassin crewed it this turn, draw a card. Adrestia becomes an Assassin in addition to its other types until end of turn.\nCrew 1",
  });
  const islandCard = createCard({
    name: "Island",
    type_line: "Basic Land — Island",
    color_identity: ["U"],
    legalities: { commander: "legal" },
    oracle_text: "({T}: Add {U}.)",
  });

  const validation = validateEdhDeck(
    createDocument([
      createResolvedCard(1, "commander", "Adrestia", commanderCard),
      createResolvedCard(2, "mainboard", "Island", islandCard, 99),
    ]),
  );

  assert.equal(validation.isValid, true);
  assert.equal(validation.issues.length, 0);
});

test("validateEdhDeck accepts a commander-legal legendary spacecraft", () => {
  const commanderCard = createCard({
    name: "Dawnsire, Sunstar Dreadnought",
    type_line: "Legendary Artifact — Spacecraft",
    color_identity: ["W"],
    legalities: { commander: "legal" },
    oracle_text:
      "Station\n4+ | Flying, lifelink\n9+ | Other creatures you control get +1/+1 and have flying and lifelink.",
  });
  const plainsCard = createCard({
    name: "Plains",
    type_line: "Basic Land — Plains",
    color_identity: ["W"],
    legalities: { commander: "legal" },
    oracle_text: "({T}: Add {W}.)",
  });

  const validation = validateEdhDeck(
    createDocument([
      createResolvedCard(1, "commander", "Dawnsire, Sunstar Dreadnought", commanderCard),
      createResolvedCard(2, "mainboard", "Plains", plainsCard, 99),
    ]),
  );

  assert.equal(validation.isValid, true);
  assert.equal(validation.issues.length, 0);
});

test("validateEdhDeck does not treat a back-face vehicle as a legal commander on its own", () => {
  const commanderCard = createCard({
    name: "Balamb Garden, SeeD Academy // Balamb Garden, Airborne",
    type_line: "Land — Town // Legendary Artifact — Vehicle",
    color_identity: ["W", "U"],
    legalities: { commander: "legal" },
    card_faces: [
      {
        name: "Balamb Garden, SeeD Academy",
        type_line: "Land — Town",
        oracle_text: "{T}: Add {W} or {U}.",
      },
      {
        name: "Balamb Garden, Airborne",
        type_line: "Legendary Artifact — Vehicle",
        oracle_text: "Flying\nCrew 3",
      },
    ],
  });
  const islandCard = createCard({
    name: "Island",
    type_line: "Basic Land — Island",
    color_identity: ["U"],
    legalities: { commander: "legal" },
    oracle_text: "({T}: Add {U}.)",
  });

  const validation = validateEdhDeck(
    createDocument([
      createResolvedCard(1, "commander", "Balamb Garden, SeeD Academy // Balamb Garden, Airborne", commanderCard),
      createResolvedCard(2, "mainboard", "Island", islandCard, 99),
    ]),
  );

  assert.equal(validation.isValid, false);
  assert.match(
    validation.issues.map((issue) => issue.code).join(","),
    /illegal_commander/,
  );
});

test("validateEdhDeck accepts a legal partner pair with a 98-card mainboard", () => {
  const firstPartner = createCard({
    name: "Kraum, Ludevic's Opus",
    type_line: "Legendary Creature — Zombie Horror",
    color_identity: ["U", "R"],
    legalities: { commander: "legal" },
    keywords: ["Partner"],
    oracle_text: "Flying, haste\nPartner",
  });
  const secondPartner = createCard({
    name: "Tymna the Weaver",
    type_line: "Legendary Creature — Human Cleric",
    color_identity: ["W", "B"],
    legalities: { commander: "legal" },
    keywords: ["Partner"],
    oracle_text: "Lifelink\nPartner",
  });
  const plainsCard = createCard({
    name: "Plains",
    type_line: "Basic Land — Plains",
    color_identity: ["W"],
    legalities: { commander: "legal" },
    oracle_text: "({T}: Add {W}.)",
  });

  const validation = validateEdhDeck(
    createDocument([
      createResolvedCard(1, "commander", "Kraum, Ludevic's Opus", firstPartner),
      createResolvedCard(2, "commander", "Tymna the Weaver", secondPartner),
      createResolvedCard(3, "mainboard", "Plains", plainsCard, 98),
    ]),
    {
      commanderName: "Kraum, Ludevic's Opus",
      partnerName: "Tymna the Weaver",
    },
  );

  assert.equal(validation.isValid, true);
  assert.equal(validation.issues.length, 0);
  assert.equal(validation.commanders?.length, 2);
});

test("validateEdhDeck accepts a legal commander plus background pair", () => {
  const commanderCard = createCard({
    name: "Wilson, Refined Grizzly",
    type_line: "Legendary Creature — Bear Warrior",
    color_identity: ["G"],
    legalities: { commander: "legal" },
    oracle_text: "Choose a Background",
  });
  const backgroundCard = createCard({
    name: "Candlekeep Sage",
    type_line: "Legendary Enchantment — Background",
    color_identity: ["U"],
    legalities: { commander: "legal" },
    oracle_text: "Commander creatures you own have \"Whenever this creature enters or leaves the battlefield, draw a card.\"",
  });
  const islandCard = createCard({
    name: "Island",
    type_line: "Basic Land — Island",
    color_identity: ["U"],
    legalities: { commander: "legal" },
    oracle_text: "({T}: Add {U}.)",
  });

  const validation = validateEdhDeck(
    createDocument([
      createResolvedCard(1, "commander", "Wilson, Refined Grizzly", commanderCard),
      createResolvedCard(2, "commander", "Candlekeep Sage", backgroundCard),
      createResolvedCard(3, "mainboard", "Island", islandCard, 98),
    ]),
    {
      commanderName: "Wilson, Refined Grizzly",
      backgroundName: "Candlekeep Sage",
    },
  );

  assert.equal(validation.isValid, true);
  assert.equal(validation.issues.length, 0);
  assert.deepEqual(
    validation.commanders?.map((entry) => entry.role),
    ["commander", "background"],
  );
});

test("validateEdhDeck accepts a legal Doctor's companion pair", () => {
  const doctorCard = createCard({
    name: "The Thirteenth Doctor",
    type_line: "Legendary Creature â€” Time Lord Doctor",
    color_identity: ["G", "U", "R"],
    legalities: { commander: "legal" },
    oracle_text: "Paradox â€” Whenever you cast a spell from anywhere other than your hand, put a +1/+1 counter on target creature.",
  });
  const companionCard = createCard({
    name: "Yasmin Khan",
    type_line: "Legendary Creature â€” Human",
    color_identity: ["G", "U", "R"],
    legalities: { commander: "legal" },
    keywords: ["Doctor's companion"],
    oracle_text: "Doctor's companion\nYou may look at the top card of your library any time.",
  });
  const forestCard = createCard({
    name: "Forest",
    type_line: "Basic Land â€” Forest",
    color_identity: ["G"],
    legalities: { commander: "legal" },
    oracle_text: "({T}: Add {G}.)",
  });

  const validation = validateEdhDeck(
    createDocument([
      createResolvedCard(1, "commander", "The Thirteenth Doctor", doctorCard),
      createResolvedCard(2, "commander", "Yasmin Khan", companionCard),
      createResolvedCard(3, "mainboard", "Forest", forestCard, 98),
    ]),
    {
      commanderName: "The Thirteenth Doctor",
      additionalCommanderName: "Yasmin Khan",
    },
  );

  assert.equal(validation.isValid, true);
  assert.equal(validation.issues.length, 0);
  assert.deepEqual(
    validation.commanders?.map((entry) => entry.role),
    ["commander", "doctor_companion"],
  );
});

test("validateEdhDeck rejects two commanders that are not a legal pair", () => {
  const firstCommander = createCard({
    name: "Delina, Wild Mage",
    type_line: "Legendary Creature — Elf Shaman",
    color_identity: ["R"],
    legalities: { commander: "legal" },
  });
  const secondCommander = createCard({
    name: "Grolnok, the Omnivore",
    type_line: "Legendary Creature — Frog",
    color_identity: ["G", "U"],
    legalities: { commander: "legal" },
  });
  const mountainCard = createCard({
    name: "Mountain",
    type_line: "Basic Land — Mountain",
    color_identity: ["R"],
    legalities: { commander: "legal" },
    oracle_text: "({T}: Add {R}.)",
  });

  const validation = validateEdhDeck(
    createDocument([
      createResolvedCard(1, "commander", "Delina, Wild Mage", firstCommander),
      createResolvedCard(2, "commander", "Grolnok, the Omnivore", secondCommander),
      createResolvedCard(3, "mainboard", "Mountain", mountainCard, 98),
    ]),
  );

  assert.equal(validation.isValid, false);
  assert.match(
    validation.issues.map((issue) => issue.code).join(","),
    /invalid_commander_pair/,
  );
});

test("validateEdhDeck accepts a legal companion outside the 100-card deck", () => {
  const commanderCard = createCard({
    name: "Atraxa, Praetors' Voice",
    type_line: "Legendary Creature — Phyrexian Angel Horror",
    color_identity: ["W", "U", "B", "G"],
    legalities: { commander: "legal" },
  });
  const forestCard = createCard({
    name: "Forest",
    type_line: "Basic Land — Forest",
    color_identity: ["G"],
    legalities: { commander: "legal" },
    oracle_text: "({T}: Add {G}.)",
  });
  const companionCard = createCard({
    name: "Jegantha, the Wellspring",
    type_line: "Legendary Creature — Elemental Elk",
    color_identity: ["R", "G"],
    legalities: { commander: "legal" },
    keywords: ["Companion"],
    oracle_text: "Companion — No card in your starting deck has more than one of the same mana symbol in its mana cost.",
  });

  const validation = validateEdhDeck(
    createDocument([
      createResolvedCard(1, "commander", "Atraxa, Praetors' Voice", commanderCard),
      createResolvedCard(2, "mainboard", "Forest", forestCard, 99),
      createResolvedCard(0, "companion", "Jegantha, the Wellspring", companionCard),
    ]),
    {
      companionName: "Jegantha, the Wellspring",
    },
  );

  assert.equal(validation.isValid, true);
  assert.equal(validation.issues.length, 0);
});

function createDocument(resolvedCards: DeckResolutionDocument["result"]["resolvedCards"]): DeckResolutionDocument {
  const totalCards = resolvedCards.reduce((sum, card) => sum + card.quantity, 0);

  return {
    format: "edh",
    parse: {
      entries: resolvedCards.map((card) => ({
        lineNumber: card.lineNumber,
        originalLine: card.originalLine,
        quantity: card.quantity,
        name: card.requestedName,
        section: card.section,
      })),
      errors: [],
      warnings: [],
      totalCards,
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
  lineNumber: number,
  section: "commander" | "mainboard" | "companion",
  requestedName: string,
  card: ScryfallCard,
  quantity = 1,
) {
  return {
    quantity,
    section,
    requestedName,
    originalLine: `${quantity} ${requestedName}`,
    lineNumber,
    card,
  } as const;
}

function createCard(overrides: Partial<ScryfallCard>): ScryfallCard {
  return {
    id: overrides.id ?? "card-id",
    name: overrides.name ?? "Card Name",
    cmc: overrides.cmc ?? 0,
    type_line: overrides.type_line ?? "Creature",
    color_identity: overrides.color_identity ?? [],
    keywords: overrides.keywords ?? [],
    layout: overrides.layout ?? "normal",
    oracle_text: overrides.oracle_text,
    colors: overrides.colors,
    legalities: overrides.legalities,
    prices: overrides.prices,
    produced_mana: overrides.produced_mana,
    image_uris: overrides.image_uris,
    card_faces: overrides.card_faces,
    mana_cost: overrides.mana_cost,
    oracle_id: overrides.oracle_id,
    scryfall_uri: overrides.scryfall_uri ?? "https://scryfall.com/card/test",
  };
}
