# Changelog

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
