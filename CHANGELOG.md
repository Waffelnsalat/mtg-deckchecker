# Changelog

## 0.4.8 - 2026-06-21

### Neu

- Alpha-Karten ohne Analyzer-Rolle werden jetzt durch zusaetzliche alte Wording-Muster erfasst.
- Neue Detailtags erkennen unter anderem `color_change`, `text_change`, `ante_card`, `land_type_change`, `animation_effect`, `tap_untap`, `hand_info`, `player_control`, `regeneration_protection`, `combat_body` und Alpha-Land-Basistags.
- `data/card-role-worksheets/lea-role-review.tsv` wurde neu erzeugt; Alpha hat jetzt keine Karten mehr ohne Analyzer-Rolle.

### Validierung

- `npm test -- --test-name-pattern Alpha-era`
- `npm run build`
- `npm run audit:cards -- worksheet lea`
- Null-Rollen-Pruefung auf `lea-role-review.tsv`: `missing=0`

## 0.4.7 - 2026-06-21

### Neu

- Die Card View trennt Hauptrollen jetzt sichtbar von konkreten Analyzer-Detailtags.
- Rollen-Chips zeigen Details wie `Targeted Removal`, `Land Denial` oder `Broad Protection` direkt unter der Hauptrolle statt nur im Tooltip.
- Die Website-Version wurde auf `v0.4.7` angehoben.

### Validierung

- `npm run check`

## 0.4.6 - 2026-06-21

### Neu

- Neuer Audit-Befehl `npm run audit:cards -- names reviewed` erzeugt reine Kartennamenlisten fuer gepruefte Editionen.
- Neue Dateien `data/card-name-lists/lea-card-names.txt`, `data/card-name-lists-index.json` und `data/card-name-lists-index.tsv` dokumentieren die aktuell gepruefte Alpha-Liste.

### Validierung

- `npm run audit:cards -- names reviewed`
- `npm run check`

## 0.4.5 - 2026-06-21

### Neu

- Neuer Audit-Befehl `npm run audit:cards -- progress` erzeugt eine Set-Fortschrittsuebersicht.
- Neue Dateien `data/card-role-set-progress.json` und `data/card-role-set-progress.tsv` markieren jede Edition als `done`, `in_progress` oder `pending`.

### Validierung

- `npm run audit:cards -- progress`
- `npm run check`

## 0.4.4 - 2026-06-21

### Neu

- Neue Todo-Datei `docs/card-role-todo.md` haelt groessere Tag-Taxonomie-Aufgaben fest.
- Protection-Tags sollen spaeter nach geschuetztem Objekt, Methode, Dauer und Scope unterschieden werden.

### Validierung

- Doku-Aenderung, keine Tests ausgefuehrt.

## 0.4.3 - 2026-06-21

### Neu

- Alpha-Audit-Batch 1 erkennt alte Wording-Muster fuer Land Denial, Mana Denial, Damage Prevention, Extra Turns und wiederholten Tischschaden.
- `data/card-role-audit.json` enthaelt jetzt die ersten 23 geprueften Alpha-Karten.
- Neue Website-Pruefdateien unter `data/card-role-verification/` liefern eine Deckliste und erwartete Rollen fuer manuelle UI-Kontrolle.

### Validierung

- `npm run audit:cards -- worksheet lea`
- `npm run check`

## 0.4.2 - 2026-06-21

### Neu

- Neuer Audit-Befehl `npm run audit:cards -- import-worksheet <set>` importiert manuell bearbeitete TSV-Reviews in `data/card-role-audit.json`.
- Die Audit-Doku beschreibt jetzt den kompletten Worksheet-Loop von manueller Pruefung bis Ledger-Import.

### Validierung

- `npm run audit:cards -- help`
- `npm run check`

## 0.4.1 - 2026-06-21

### Neu

- Neuer Audit-Befehl `npm run audit:cards -- worksheet <set>` erzeugt eine TSV-Datei fuer manuelle Set-Reviews.
- Erstes Worksheet fuer `lea` wurde unter `data/card-role-worksheets/lea-role-review.tsv` erstellt.

### Validierung

- `npm run audit:cards -- worksheet lea`

## 0.4.0 - 2026-06-20

### Neu

- Neues Card-Role-Audit-Geruest fuer setweises Review aller Magic-Karten nach Scryfall-Releasedatum.
- `data/scryfall-sets.json` speichert die komplette Scryfall-Setliste, damit kein Set vergessen wird.
- `data/card-role-audit.json` dient als maschinenlesbares Ledger fuer Review-Status, erwartete Rollen, neue Tag-Entscheidungen und offene Code-Arbeit.
- Neuer Befehl `npm run audit:cards` mit `refresh-sets`, `summary`, `next-set` und `set <code>`.
- Neue Doku `docs/card-role-audit.md` beschreibt Workflow, Statuswerte und Tag-Layer.

### Validierung

- `npm run audit:cards -- refresh-sets`
- `npm run audit:cards -- next-set`
- `npm run check` konnte in dieser Runde wegen Approval-/Usage-Limit nicht erneut ausgefuehrt werden.

## 0.3.1 - 2026-06-20

### Verbessert

- Moxfield Browser-Fallback wartet nicht mehr 45 Sekunden starr auf exakt eine API-Response.
- Der Fallback prueft API-Antworten jetzt per Origin/Path statt exakter URL und versucht zusaetzlich eine Anfrage ueber den Playwright-Request-Context.
- Wenn Moxfield automatisierte Importe mit `403` blockiert, zeigt die App jetzt eine klare Meldung mit dem Hinweis, den Moxfield-Text-Export einzufuegen.

### Validierung

- `npm run check`
- 295 Tests bestanden
- Live-Test gegen Moxfield in dieser Umgebung endet weiterhin mit Moxfield/Cloudflare `403`, aber nicht mehr mit dem alten `page.waitForResponse` Timeout.

## 0.3.0 - 2026-06-20

### Neu

- Die Analyse-Antwort enthaelt jetzt `sources` mit Status fuer Scryfall, EDHREC, Commander Spellbook und Recommander.
- Die Website zeigt Quellenprobleme sofort in der `Analysis Limited` Box.
- Der Deck-Status zeigt eine eigene `Sources` Karte neben `Confidence`, Bracket, Power, Strategie und Win Plan.
- Recommander wird im Analyse-Endpunkt explizit geladen und an die Empfehlungsauswertung weitergegeben, damit Quellenstatus und Empfehlungen denselben Datenstand nutzen.

### Verbessert

- Die Analyse-Doku beschreibt jetzt die Source-Status-Metadaten.
- Ein neuer Test sichert ab, dass fehlende Quellen nicht mehr als vollstaendig gepruefte Analyse erscheinen.

### Validierung

- `npm run check`
- 295 Tests bestanden

## 0.2.0 - 2026-06-20

### Neu

- Die Website zeigt jetzt eine sichtbare Versionsnummer im oberen Bereich.
- `CHANGELOG.md` dokumentiert ab jetzt, was sich pro Version geaendert hat.
- Der Analyse-Endpunkt kann Decks mit Validierungsproblemen trotzdem teilweise auswerten.
- Die UI markiert solche Ergebnisse sofort als eingeschraenkt mit `Analysis Limited` und einer `Confidence`-Karte.
- Eine neue Analyse-Doku beschreibt Request Flow, Abhaengigkeiten, Score-Berechnung und Schwachstellen.
- Eine zentrale Logger-Funktion vereinheitlicht Server-, Export- und externe-Service-Logs.

### Verbessert

- `npm test` und `npm run check` laufen jetzt auch unter Windows zuverlaessig.
- TypeScript nutzt moderne `Node16` Modulaufloesung statt des veralteten `Node10` Modus.

### Validierung

- `npm run check`
- 293 Tests bestanden
