# Changelog

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
