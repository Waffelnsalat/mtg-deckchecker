# Code Map

This project has two main halves:

- `src/`: TypeScript backend, deck parsing, validation, card resolution, and all analysis logic.
- `public/`: Browser UI served by Express.

Use this file when you know what you want to change, but not where to start.

## Common Tasks

| Goal | Start Here | Notes |
| --- | --- | --- |
| Change API routes | `src/app.ts` | Express app, request validation, response shape. |
| Change local server startup | `src/server.ts` | Reads `PORT` and starts the app. |
| Change decklist parsing | `src/decklist.ts` | Text sections, quantities, cleanup of card names. |
| Change URL imports | `src/deckImport.ts` | Archidekt and Moxfield import logic. |
| Change Scryfall resolution | `src/scryfall.ts` | Batch lookup, fuzzy fallback, public card shape. |
| Change EDH legality checks | `src/deckValidation.ts` | Commander count, color identity, singleton rules. |
| Change JSON export format | `src/deckExport.ts` | Builds the resolved document and writes export files. |
| Change CLI export behavior | `src/exportDeck.ts` | Command-line wrapper around `deckExport.ts`. |
| Change power/bracket score | `src/powerAnalysis.ts`, `src/bracketAnalysis.ts` | Final scoring and Commander bracket interpretation. |
| Change card recommendations | `src/recommendationAnalysis.ts` | Add/up suggestions and external recommendation context. |
| Change website layout | `public/index.html` | Static HTML structure and element ids. |
| Change website styling | `public/styles.css` | Visual design and responsive layout. |
| Change browser behavior | `public/app.js` | UI events, API calls, rendering analysis results. |

## Backend Flow

The normal analysis path is:

1. `src/app.ts` receives `POST /api/edh/decklists/analyze`.
2. `src/deckExport.ts` calls `parseDecklist`, `resolveDeckEntries`, and `validateEdhDeck`.
3. `src/app.ts` runs the focused analysis modules.
4. `src/powerAnalysis.ts` combines module scores.
5. `src/bracketAnalysis.ts` turns the power read and rules signals into a bracket.
6. `src/recommendationAnalysis.ts` builds card suggestions.
7. The API returns `{ document, analysis }` to `public/app.js`.

## Analysis Modules

Most analysis files follow this pattern:

- They export one main `analyzeDeck...` function.
- They return a typed analysis object from `src/types.ts`.
- Their matching `.test.ts` file shows expected behavior and is usually the best place to learn the module.

| Area | File |
| --- | --- |
| Shell structure, curve, card type counts | `src/deckAnalysis.ts` |
| Land base quality | `src/landBaseAnalysis.ts` |
| Ramp and mana fixing | `src/rampAnalysis.ts` |
| Draw and card selection | `src/drawAnalysis.ts` |
| Tutors and consistency | `src/consistencyAnalysis.ts` |
| Protection | `src/protectionAnalysis.ts` |
| Recursion | `src/recursionAnalysis.ts` |
| Removal and stack interaction | `src/interactionAnalysis.ts` |
| Win conditions and combos | `src/winConditionAnalysis.ts` |
| Overall strategy detection | `src/strategyAnalysis.ts` |
| How the deck actually wins | `src/winStrategyAnalysis.ts` |
| Commander role and dependency | `src/commanderAnalysis.ts` |
| Card-level generic role scan | `src/advancedCardScan.ts` |
| Commander bracket rules | `src/bracketAnalysis.ts` |
| Final power score | `src/powerAnalysis.ts` |

## External Services

| Service | File | Purpose |
| --- | --- | --- |
| Scryfall | `src/scryfall.ts` | Resolve decklist names to card data. |
| Archidekt | `src/deckImport.ts` | Import public deck URLs. |
| Moxfield | `src/deckImport.ts` | Import public deck URLs. |
| Commander Spellbook | `src/commanderSpellbook.ts` | Find exact combo lines. |
| EDHREC | `src/edhrec.ts` | Commander-specific card context. |
| Recommander | `src/recommander.ts` | Context-fit recommendation candidates. |

## Tests

Run everything:

```bash
npm run check
```

Run tests only:

```bash
npm test
```

Run the TypeScript compiler only:

```bash
npm run build
```

When changing one analysis module, start by opening the matching `.test.ts` file. The tests are the most compact explanation of the intended behavior.
