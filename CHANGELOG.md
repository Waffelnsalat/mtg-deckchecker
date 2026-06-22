# Changelog

## 0.4.16 - 2026-06-22

### Neu

- Media and Collaboration Promos (`pmei`) wurde vollstaendig als `covered` in das Card-Role-Audit importiert.
- Die komplette Namensliste fuer `pmei` wurde unter `data/card-name-lists/pmei-card-names.txt` angelegt.
- Neue Website-Pruefdateien fuer `pmei` dokumentieren Reprint-, X-Damage-, Stack-, Tutor-, Removal- und moderne Engine-Fokusfaelle.
- Der Worksheet-Import erhaelt bei Reprints jetzt bestehende `firstSet`-/`releasedAt`-Werte und vorhandene Notizen/Tag-Entscheidungen.
- `Fireball` und aehnliche `any number of targets`-X-Schadenstexte werden wieder als Direct Finisher und Removal erkannt.
- Fortschritt und Namenslisten wurden aktualisiert; 10 Editionen sind abgeschlossen.

### Validierung

- `npm test -- --test-name-pattern "Fallen Empires|creature-only damage"`
- `npm run audit:cards -- worksheet pmei`
- `npm run audit:cards -- import-worksheet pmei`
- `npm run audit:cards -- progress`
- `npm run audit:cards -- names reviewed`
- `npm run check`

## 0.4.15 - 2026-06-21

### Neu

- Fallen Empires (`fem`) wurde vollstaendig als `covered` in das Card-Role-Audit importiert.
- Die komplette Namensliste fuer Fallen Empires wurde unter `data/card-name-lists/fem-card-names.txt` angelegt.
- Neue Website-Pruefdateien fuer Fallen Empires dokumentieren die wichtigsten erwarteten Rollen.
- Der Advanced Scanner unterscheidet skalierbaren Kreaturen-Schaden jetzt sauber von Direct-Finisher-Schaden.
- `Farrel's Zealot` bleibt dadurch Removal statt Direct Finisher; `Dwarven Catapult` wird als Scalable Spell/Mass Removal statt Direct Finisher gelesen.
- Fortschritt und Namenslisten wurden aktualisiert; 9 Editionen sind abgeschlossen.

### Validierung

- `npm test -- --test-name-pattern "Fallen Empires|creature-only damage"`
- `npm run audit:cards -- worksheet fem`
- Lokaler Ledger-/Progress-/Namenslisten-Abgleich aus `data/card-role-worksheets/fem-role-review.tsv`
- `npm run check`

## 0.4.14 - 2026-06-21

### Neu

- The Dark wurde vollstaendig als `covered` in das Card-Role-Audit importiert.
- HarperPrism Book Promos (`phpr`) wurde direkt mit abgeschlossen.
- Der Advanced Scanner erkennt jetzt alte The-Dark-Wording-Muster fuer Land-Denial mit Zahlungsausweichung, kleine Sweeper, Mana-Konvertierung, globale Tap-Effekte, Hand-Reveal-Discard und Combat-Removal-Auren.
- `Cleansing` wird als Mass-Land-Denial gelesen, waehrend `Erosion` targeted Land-Denial bleibt.
- Neue Website-Pruefdateien fuer The Dark dokumentieren die wichtigsten erwarteten Rollen.
- Fortschritt und Namenslisten wurden aktualisiert; 8 Editionen sind abgeschlossen. Naechster grosser Set-Block laut lokaler Setliste: Fallen Empires (`fem`).

### Validierung

- `npm test -- --test-name-pattern "The Dark"`
- `npm run audit:cards -- worksheet drk`
- `npm run audit:cards -- import-worksheet drk`
- `npm run audit:cards -- worksheet phpr`
- `npm run audit:cards -- import-worksheet phpr`
- `npm run audit:cards -- progress`
- `npm run audit:cards -- names reviewed`
- `npm run check`

## 0.4.13 - 2026-06-21

### Neu

- Legends wurde vollstaendig als `covered` in das Card-Role-Audit importiert.
- Dragon Con (`pdrc`) wurde direkt mit abgeschlossen; `Nalathni Dragon` ist als reviewed erfasst.
- Der Advanced Scanner erkennt jetzt alte Legends-Wording-Familien fuer Farbwechsel, Reveal-Information, Aura-Umhaengen, Spell-Locks, Damage Reflection, Damage Redirection, Land-Animation, Flying-Hate und symmetrisches Cheat-into-play.
- Legends hat jetzt keine Karten mehr ohne Analyzer-Rollen und keine Attention Candidates.
- Neue Website-Pruefdateien fuer Legends dokumentieren die wichtigsten erwarteten Rollen.
- Fortschritt und Namenslisten wurden aktualisiert; 6 Editionen sind abgeschlossen. Naechster grosser Set-Block laut lokaler Setliste: The Dark (`drk`).

### Validierung

- `npm test -- --test-name-pattern Legends`
- `npm run audit:cards -- worksheet leg`
- `npm run audit:cards -- import-worksheet leg`
- `npm run audit:cards -- worksheet pdrc`
- `npm run audit:cards -- import-worksheet pdrc`
- `npm run audit:cards -- progress`
- `npm run audit:cards -- names reviewed`
- `npm run check`

## 0.4.12 - 2026-06-21

### Neu

- Antiquities wurde vollstaendig als `covered` in das Card-Role-Audit importiert.
- `Drafna's Restoration` wird jetzt auch in der Interaction-Analyse nicht mehr als `tempo_removal` fehlklassifiziert.
- Das Antiquities-Worksheet wurde neu erzeugt; alle 85 Karten haben Analyzer-Rollen.
- Die Fortschrittsdateien markieren jetzt 4 abgeschlossene Editionen: Alpha, Beta, Arabian Nights und Antiquities.
- Legends wurde als naechste Audit-Edition vorbereitet, inklusive Worksheet mit 310 Karten und kompletter Namensliste.

### Validierung

- `npm test -- --test-name-pattern "Antiquities|Arabian Nights"`
- `npm test -- --test-name-pattern "Antiquities|graveyard-to-library|bounce and tuck"`
- `npm run audit:cards -- worksheet atq`
- `npm run audit:cards -- import-worksheet atq`
- `npm run audit:cards -- progress`
- `npm run audit:cards -- names reviewed`
- `npm run audit:cards -- next-set`
- `npm run audit:cards -- worksheet leg`
- `npm run check`

## 0.4.11 - 2026-06-21

### Neu

- Antiquities wurde als naechste Audit-Edition bearbeitet und die Website-Pruefliste fuer die kritischen Karten angelegt.
- Der Advanced Scanner erkennt jetzt aktivierte Ability-Kostenreduktion, Artefakt-Punisher, alte `+N/-N`-Combat-Pumps, Handgroessen-Locks, Graveyard-zu-Library-Recycling, setbezogene Sacrifice-Sweeper und Self-Bounce nach altem Antiquities-Wording.
- `Drafna's Restoration` wird nicht mehr als Tempo Removal fehlklassifiziert, sondern als Library Recursion/Topdeck Control vorbereitet.
- Neue Detail-Labels machen `hand_denial`, `hate_piece` und `artifact_hate` in der Website lesbarer.

### Validierung

- Blockiert: `npm test -- --test-name-pattern "Antiquities|Arabian Nights"` und `npm run check` konnten wegen Sandbox-/Usage-Limit nicht ausgefuehrt werden.

## 0.4.10 - 2026-06-21

### Neu

- Arabian Nights wurde im Card-Role-Audit vollstaendig geprueft und als `covered` importiert.
- Der Analyzer erkennt jetzt alte Arabian-Nights-Wording-Muster wie `damage_reflection`, `subgame`, `landwalk_support`, `desert_hate`, `land_protection` und `life_total_protection`.
- `Oubliette` wird jetzt als Removal/Tempo-Removal erkannt und nicht mehr als Protection-Karte zusammengefuehrt.
- `Ali from Cairo` wird als Life-Total-Schutz erkannt und nicht mehr als Lifegain.
- Neue Website-Pruefdateien fuer Arabian Nights dokumentieren die wichtigsten erwarteten Tags.
- Antiquities wurde als naechste Arbeitsedition vorbereitet, inklusive Worksheet und Kartennamenliste.

### Validierung

- `npm test -- --test-name-pattern Arabian Nights|Oubliette`
- `npm run audit:cards -- worksheet arn`
- `npm run audit:cards -- import-worksheet arn`
- `npm run audit:cards -- progress`
- `npm run audit:cards -- names reviewed`
- `npm run audit:cards -- worksheet atq`
- `npm run check`

## 0.4.9 - 2026-06-21

### Neu

- Alpha wurde im Card-Role-Audit-Ledger vollstaendig als `covered` abgeschlossen.
- Beta wurde vorbereitet und direkt abgeschlossen; offen waren nur `Circle of Protection: Black` und `Volcanic Island`.
- Neue Beta-Website-Pruefdateien dokumentieren die erwarteten Rollen fuer die beiden Beta-spezifischen Karten.
- Arabian Nights wurde als naechste Arbeitsedition vorbereitet, inklusive Worksheet und reiner Kartennamenliste.

### Validierung

- `npm run audit:cards -- import-worksheet lea`
- `npm run audit:cards -- worksheet leb`
- `npm run audit:cards -- import-worksheet leb`
- `npm run audit:cards -- progress`
- `npm run audit:cards -- worksheet arn`
- `npm run check`

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
