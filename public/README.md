# Frontend Folder Guide

`public/` is the static browser app served by Express.

## Files

- `index.html`: page structure, form fields, result sections, modal markup.
- `styles.css`: layout, responsive behavior, visual states.
- `app.js`: browser behavior, API calls, rendering analysis results.
- `assets/`: local hero images used by the page.

## UI Flow

1. The user pastes, uploads, or imports a decklist.
2. `app.js` builds an analyze payload from the form.
3. `app.js` sends `POST /api/edh/decklists/analyze`.
4. The API returns `{ document, analysis }`.
5. `app.js` renders the result sections by analysis area.

## Good Starting Points In `app.js`

- Form setup and event listeners: near the top of the file.
- Analyze API payload: `buildAnalyzePayload`.
- Analyze request: `runDeckAnalysis`.
- URL import request: `importDeckFromUrl`.
- Main render function: `renderAnalyzedDeck`.
- Validation errors: `renderValidationIssues`.
- Strategy view: `renderStrategy`.
- Win strategy view: `renderWinStrategy`.
- Recommendations view: `renderRecommendations`.
- Card breakdown view: `renderCardBreakdown`.
- Report modal: `openReportDialog`, `submitReport`, `buildReportPayload`.

## Editing Tips

- Keep element ids in `index.html` stable because `app.js` uses them directly.
- Prefer `textContent`, `createElement`, and `replaceChildren` for dynamic content.
- If a backend response shape changes, update `app.js` render code and the matching TypeScript type in `src/types.ts`.
- After changing UI behavior, run `npm run build` and open the local site with `npm run dev`.
