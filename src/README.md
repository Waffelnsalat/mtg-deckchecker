# Source Folder Guide

`src/` contains the TypeScript backend and all deck analysis code.

## Entry Points

- `server.ts`: starts the Express server.
- `app.ts`: creates the Express app and defines all API routes.
- `exportDeck.ts`: CLI entry point for exporting a text decklist to JSON.

## Core Data Flow

- `decklist.ts`: parses raw decklist text into entries.
- `scryfall.ts`: resolves parsed entries into Scryfall card data.
- `deckValidation.ts`: checks EDH rules after cards are resolved.
- `deckExport.ts`: combines parsing, resolution, validation, and JSON export.
- `types.ts`: shared result types used by the API and analysis modules.

## Analysis Files

Each `*Analysis.ts` file is responsible for one slice of the deck read. The matching
`*.test.ts` file is the best practical documentation for that module.

- `deckAnalysis.ts`: structure, card type counts, mana curve.
- `landBaseAnalysis.ts`: land slots, tapped lands, fixing, utility lands.
- `rampAnalysis.ts`: ramp, fixing, burst mana, cost reduction.
- `drawAnalysis.ts`: draw, selection, repeatable card advantage.
- `consistencyAnalysis.ts`: tutors and card access.
- `interactionAnalysis.ts`: removal, stack interaction, stax, graveyard hate.
- `protectionAnalysis.ts`: shields, bounce, flicker, equipment protection.
- `recursionAnalysis.ts`: graveyard and replay effects.
- `winConditionAnalysis.ts`: finishers and Commander Spellbook combo lookup.
- `strategyAnalysis.ts`: broad archetype detection.
- `winStrategyAnalysis.ts`: primary and backup win plans.
- `commanderAnalysis.ts`: commander impact and dependency.
- `bracketAnalysis.ts`: Commander bracket read.
- `powerAnalysis.ts`: final power score.
- `recommendationAnalysis.ts`: add suggestions.
- `advancedCardScan.ts`: generic card role tags used by several modules.

## Support Files

- `activationCost.ts`: helpers for detecting activation costs.
- `effectiveManaValue.ts`: adjusts mana value for alternate or reduced costs.
- `commanderAvailability.ts`: command-zone availability helpers.
- `commanderColorProfile.ts`: color identity profile helpers.
- `commanderManaSink.ts`: detects infinite-mana sink potential.
- `commanderProfile.ts`: commander-specific deck profile inference.
- `commanderSpellbook.ts`: external combo lookup.
- `edhrec.ts`: external EDHREC context.
- `recommander.ts`: external recommendation context.
- `asyncUtils.ts`: small shared async helpers.

## Where To Add New Logic

- New parser format: `decklist.ts`, then `decklist.test.ts`.
- New legality rule: `deckValidation.ts`, then `deckValidation.test.ts`.
- New card role wording: usually `advancedCardScan.ts`, then `advancedCardScan.test.ts`.
- New scoring rule for one category: the matching analysis file and test.
- New final power rule: `powerAnalysis.ts`.
- New bracket rule: `bracketAnalysis.ts`.
- New UI response field: update `types.ts`, backend producer, and `public/app.js`.
