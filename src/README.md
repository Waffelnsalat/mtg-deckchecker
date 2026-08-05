# Source Folder Guide

`src/` contains the TypeScript backend and all deck analysis code.

## Entry Points

- `server.ts`: starts the Express server.
- `app.ts`: creates the Express app and defines all API routes.
- `exportDeck.ts`: CLI entry point for exporting a text decklist to JSON.

## Core Data Flow

- `decklist.ts`: parses raw decklist text into entries.
- `scryfall.ts`: resolves parsed entries into Scryfall card data with collection batching, cache reuse, throttling, and 429 retry handling.
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
- `winConditionAnalysis.ts`: finishers and compact Commander Spellbook combo scoring.
- `strategyAnalysis.ts`: broad archetype detection.
- `winStrategyAnalysis.ts`: primary and backup win plans.
- `commanderAnalysis.ts`: commander impact and dependency.
- `bracketAnalysis.ts`: Commander bracket read.
- `powerAnalysis.ts`: final power score, dimensional scores, and high-power hand-selection leverage.
- `recommendationAnalysis.ts`: upgrade, downshift, and bracket-blocker suggestions.
- `weaknessAnalysis.ts`: opposing plans and hate profiles the deck is likely weak against.
- `advancedCardScan.ts`: generic card role tags used by several modules.

## Support Files

- `activationCost.ts`: helpers for detecting activation costs.
- `effectiveManaValue.ts`: adjusts mana value for alternate or reduced costs.
- `commanderAvailability.ts`: command-zone availability helpers.
- `commanderColorProfile.ts`: color identity profile helpers.
- `commanderManaSink.ts`: detects infinite-mana sink potential.
- `commanderProfile.ts`: commander-specific deck profile inference.
- `commanderSpellbook.ts`: external combo lookup for scoring plus the standalone combo-finder endpoint.
- `edhrec.ts`: external EDHREC context.
- `recommander.ts`: external recommendation context.
- `asyncUtils.ts`: small shared async helpers.

## Scoring Notes

- `powerAnalysis.ts` builds weighted dimensions first, then maps the internal power index to the visible 1-10 score.
- Extra low-curve, tutor-heavy, combo-focused decks can receive a small mulligan / hand-selection boost because higher-power pilots are expected to ship weak openers more often.
- Category overflow is dampened. Running more draw, ramp, recursion, protection, interaction, or closing pieces than the baseline asks for should not automatically tank the score.
- `bracketAnalysis.ts` combines the visible power read with hard Commander bracket barometers. It also has soft target-aware boundaries, so close misses can read as `2+`, `3+`, `3-`, or `4-` instead of jumping abruptly.
- Hard bracket pressure still overrides softness: Game Changers, compact two-card infinite combos, repeated extra turns, mass land denial, and overwhelming cEDH profiles can force the higher bracket.

## Where To Add New Logic

- New parser format: `decklist.ts`, then `decklist.test.ts`.
- New legality rule: `deckValidation.ts`, then `deckValidation.test.ts`.
- New card role wording: usually `advancedCardScan.ts`, then `advancedCardScan.test.ts`.
- New scoring rule for one category: the matching analysis file and test.
- New final power rule: `powerAnalysis.ts`.
- New bracket rule: `bracketAnalysis.ts`.
- New recommendation rule: `recommendationAnalysis.ts`, then `recommendationAnalysis.test.ts`.
- New weakness rule: `weaknessAnalysis.ts`, then add focused tests if the behavior is not already covered by a higher-level fixture.
- New UI response field: update `types.ts`, backend producer, and the relevant `public/*.js` renderer.
