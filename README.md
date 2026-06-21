# MTG Deckchecker API

First iteration of the backend and website for an EDH deck checker. The app accepts a decklist as text or `.txt` upload, parses common decklist formats, resolves the cards through the Scryfall API, and can save a generated JSON export for later analysis.

## Scripts

- `npm run dev` starts the local development server on port `3000`.
- `npm run build` compiles TypeScript to `dist/`.
- `npm run export:deck -- <input.txt> [output.json]` reads a decklist text file and writes a resolved JSON export.
- `npm start` runs the compiled server.
- `npm test` runs the TypeScript test suite.
- `npm run check` runs the TypeScript build and test suite.
- `npm run audit:cards -- next-set` shows the oldest Scryfall set with open card-role review work.
- `npm run audit:cards -- progress` writes done/in-progress/pending status for every Scryfall set.
- `npm run audit:cards -- names reviewed` writes plain card-name lists for reviewed sets.

## Finding Your Way Around

- [CHANGELOG.md](CHANGELOG.md) lists what changed in each published version.
- [docs/code-map.md](docs/code-map.md) explains where each major feature lives.
- [docs/analysis-flow.md](docs/analysis-flow.md) diagrams the request flow, analysis dependencies, score calculation, and likely weak spots.
- [docs/card-role-audit.md](docs/card-role-audit.md) explains the set-by-set card wording and role review workflow.
- [docs/card-role-todo.md](docs/card-role-todo.md) tracks larger follow-up work such as splitting broad tags into clearer sub-tags.
- [src/README.md](src/README.md) maps the backend and analysis files.
- [public/README.md](public/README.md) maps the browser UI files.

## Website

Run the web app locally:

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

The page lets you:

- paste a decklist into a textarea
- upload a `.txt` decklist file
- generate and download a JSON export
- keep a saved copy of the JSON in `generated-decks/`

Moxfield URL import uses a headless local Chromium fallback only when the direct API request is
blocked. Set `MTG_DECKCHECKER_ALLOW_HEADED_BROWSER=1` if you intentionally want that fallback to
open a visible browser during local troubleshooting.

## Export A Decklist File

This command reads a `.txt` decklist, resolves all cards against Scryfall, and writes a `.json` file.

```bash
npm run export:deck -- "C:\Users\Waffelnsalat\Downloads\delina.txt"
```

If no output path is provided, the exporter writes the JSON next to the input file using the same base name, for example `delina.json`.

## Endpoint

`POST /api/edh/decklists/resolve`

Request body:

```json
{
  "decklist": "Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring\n1 Arcane Signet\n12 Forest"
}
```

Example request:

```bash
curl -X POST http://localhost:3000/api/edh/decklists/resolve \
  -H "Content-Type: application/json" \
  -d "{\"decklist\":\"Commander\n1 Atraxa, Praetors' Voice\n\nDeck\n1 Sol Ring\n1 Arcane Signet\"}"
```

The response includes:

- parsed deck entries with quantities and sections
- Scryfall card data for every resolved card
- unmatched lines when a card could not be found
- deck-level warnings such as a non-100-card EDH total
