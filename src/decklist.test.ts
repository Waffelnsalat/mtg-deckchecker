import test from "node:test";
import assert from "node:assert/strict";
import { parseDecklist } from "./decklist";

test("parseDecklist handles sections, quantities, and exported set metadata", () => {
  const result = parseDecklist(`
Commander
1 Atraxa, Praetors' Voice

Deck
1 Sol Ring (CMM) 396
12 Forest
SB: 1 Swords to Plowshares
`);

  assert.equal(result.entries.length, 4);
  assert.deepEqual(
    result.entries.map((entry) => ({
      name: entry.name,
      quantity: entry.quantity,
      section: entry.section,
    })),
    [
      { name: "Atraxa, Praetors' Voice", quantity: 1, section: "commander" },
      { name: "Sol Ring", quantity: 1, section: "mainboard" },
      { name: "Forest", quantity: 12, section: "mainboard" },
      { name: "Swords to Plowshares", quantity: 1, section: "sideboard" },
    ],
  );
});

test("parseDecklist handles commented section headers and extra export markers", () => {
  const result = parseDecklist(`
// COMMANDER
1 Delina, Wild Mage (AFR) 317

1 Fanatic of Mogis (PLST) THS-121
1 Screaming Nemesis (DSK) 348 *F*
// SIDEBOARD
1 Fable of the Mirror-Breaker (NEO) 141
// MAYBEBOARD
1 Cursed Mirror (MH3) 279
`);

  assert.deepEqual(
    result.entries.map((entry) => ({
      name: entry.name,
      section: entry.section,
    })),
    [
      { name: "Delina, Wild Mage", section: "commander" },
      { name: "Fanatic of Mogis", section: "mainboard" },
      { name: "Screaming Nemesis", section: "mainboard" },
      { name: "Fable of the Mirror-Breaker", section: "sideboard" },
      { name: "Cursed Mirror", section: "maybeboard" },
    ],
  );
});

test("parseDecklist treats partner and background headers as commander slots", () => {
  const result = parseDecklist(`
[COMMANDER]
1 Wilson, Refined Grizzly
[BACKGROUND]
1 Flaming Fist

[DECK]
98 Forest
`);

  assert.deepEqual(
    result.entries.map((entry) => ({
      name: entry.name,
      section: entry.section,
    })),
    [
      { name: "Wilson, Refined Grizzly", section: "commander" },
      { name: "Flaming Fist", section: "commander" },
      { name: "Forest", section: "mainboard" },
    ],
  );
});

test("parseDecklist ignores unknown bracketed section headers in any language", () => {
  const result = parseDecklist(
    `
[KOMMANDEUR]
1 Delina, Wild Mage
[KREATUREN]
1 Fanatic of Mogis
[LAENDER]
2 Mountain
`,
    { assumeFirstCardAsCommander: true },
  );

  assert.equal(result.errors.length, 0);
  assert.deepEqual(
    result.entries.map((entry) => ({
      name: entry.name,
      quantity: entry.quantity,
      section: entry.section,
    })),
    [
      { name: "Delina, Wild Mage", quantity: 1, section: "commander" },
      { name: "Fanatic of Mogis", quantity: 1, section: "mainboard" },
      { name: "Mountain", quantity: 2, section: "mainboard" },
    ],
  );
});

test("parseDecklist resets to mainboard after unknown bracketed type headers", () => {
  const result = parseDecklist(`
[COMMANDER]
1 Delina, Wild Mage
[KREATUREN]
1 Fanatic of Mogis
`);

  assert.equal(result.errors.length, 0);
  assert.deepEqual(
    result.entries.map((entry) => ({
      name: entry.name,
      section: entry.section,
    })),
    [
      { name: "Delina, Wild Mage", section: "commander" },
      { name: "Fanatic of Mogis", section: "mainboard" },
    ],
  );
});

test("parseDecklist can promote a selected additional commander generically", () => {
  const result = parseDecklist(
    `
1 The Thirteenth Doctor
1 Yasmin Khan
98 Island
`,
    {
      commanderName: "The Thirteenth Doctor",
      additionalCommanderName: "Yasmin Khan",
      assumeFirstCardAsCommander: true,
    },
  );

  assert.deepEqual(
    result.entries.map((entry) => ({
      name: entry.name,
      section: entry.section,
    })),
    [
      { name: "The Thirteenth Doctor", section: "commander" },
      { name: "Yasmin Khan", section: "commander" },
      { name: "Island", section: "mainboard" },
    ],
  );
});
