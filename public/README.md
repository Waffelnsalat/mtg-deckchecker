# Frontend Folder Guide

`public/` is the static browser app served by Express.

## Files

- `index.html`: page structure, form fields, result sections, modal markup.
- `about.html`, `how-it-works.html`, `privacy.html`, `terms.html`, `contact.html`: crawlable content and policy pages for public launch / ad-network readiness.
- `styles.css`: layout, responsive behavior, visual states.
- `app.js`: central browser state, API calls, orchestration, and shared render helpers.
- `deck-input.js` / `decklist-intake.js`: paste, upload, URL import, target bracket prompt, and scan start flow.
- `deck-identity.js`: deck name, commander, partner/background, companion, and extra-deck identity fields.
- `quick-read.js`: compact top-level read and opening-hand playtest widget.
- `summary-panels.js`, `structure-overview.js`, `strategy-renderer.js`, `recommendations.js`, `card-breakdown.js`, `tagged-card-sections.js`: focused result renderers.
- `metric-details.js`: hover descriptions and metric detail routing.
- `report-dialog.js`: feedback / report modal.
- `result-state.js`: shared UI state helpers.
- `frontend-config.js`: app version, release link, tag aliases, metric help text, and UI config values.
- `theme-media.js`: theme and background media behavior.
- `assets/`: local hero images used by the page.

## UI Flow

1. The user pastes, uploads, or imports a decklist.
2. The UI asks for the expected target bracket before analysis.
3. The first analysis pass detects possible strategies.
4. If multiple meaningful plans exist, the UI asks which strategy the user intends to play and recalculates with `preferredStrategyKey`.
5. The API returns `{ document, validation, sources, analysis }`.
6. The UI renders quick read, power, bracket, strategy, weaknesses, recommendations, tag frequency, card breakdown, and opening-hand tools.

## Good Starting Points In `app.js`

- Form setup and event listeners: near the top of the file.
- Analyze API payload: `buildAnalyzePayload`.
- Analyze request: `runDeckAnalysis`.
- URL import request: `deck-input.js` / `importDeckFromUrl`.
- Main render function: `renderAnalyzedDeck`.
- Validation errors: `renderValidationIssues`.
- Strategy view: `strategy-renderer.js`.
- Win strategy view: `renderWinStrategy`.
- Recommendations view: `recommendations.js`.
- Card breakdown and tag frequency: `card-breakdown.js`, `tagged-card-sections.js`.
- Metric hover text: `metric-details.js` and `frontend-config.js`.
- Quick read and starting hand: `quick-read.js`.
- Report modal: `report-dialog.js`.

## Editing Tips

- Keep element ids in `index.html` stable because `app.js` uses them directly.
- Prefer `textContent`, `createElement`, and `replaceChildren` for dynamic content.
- If a backend response shape changes, update `app.js` render code and the matching TypeScript type in `src/types.ts`.
- If tag wording or tag aggregation changes, update the shared backend alias list and mirror user-facing aliases in `frontend-config.js`.
- If a metric label is unclear, update the hover help in `frontend-config.js` before adding more visible text to the UI.
- After changing UI behavior, run `npm run build` and open the local site with `npm run dev`.
- Do not add live ad scripts until a real publisher id, privacy wording, and consent requirements are confirmed.
