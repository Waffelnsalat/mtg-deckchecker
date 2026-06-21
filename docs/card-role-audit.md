# Card Role Audit

This workflow reviews Magic cards set by set, oldest first, so wording gaps and missing mechanics can be found once and kept covered by tests.

## Files

- `data/scryfall-sets.json`: generated list of every Scryfall set, sorted by release date.
- `data/card-role-set-progress.json`: generated progress state for every set.
- `data/card-role-set-progress.tsv`: generated readable progress table for every set.
- `data/card-name-lists/<set>-card-names.txt`: generated card-name-only lists for reviewed sets.
- `data/card-name-lists-index.tsv`: generated index of card-name-only lists.
- `data/card-role-audit.json`: manual review ledger, keyed by `oracleId`.
- `data/card-role-worksheets/<set>-role-review.tsv`: generated manual review worksheets.
- `docs/card-role-todo.md`: larger follow-up list for tag taxonomy and analyzer design work.
- `scripts/card-role-audit.ts`: CLI for refreshing set data and finding the next open set.

## Commands

```bash
npm run audit:cards -- refresh-sets
npm run audit:cards -- summary
npm run audit:cards -- next-set
npm run audit:cards -- set lea
npm run audit:cards -- worksheet lea
npm run audit:cards -- import-worksheet lea
npm run audit:cards -- progress
npm run audit:cards -- names reviewed
```

## Review Rule

Review each `oracle_id` once. Reprints are skipped automatically unless Oracle wording changes require a new decision later.

The normal loop is:

1. Run `npm run audit:cards -- next-set`.
2. Run `npm run audit:cards -- worksheet <set>` to create a TSV review file.
3. Review the listed cards in Scryfall and in the worksheet.
4. Fill `auditStatus`, `expectedRoles`, `needsCodeChange`, `tagDecision`, and `manualNotes` in the worksheet.
5. Run `npm run audit:cards -- import-worksheet <set>` to copy reviewed rows into `data/card-role-audit.json`.
6. For `missing` or `wrong` entries, add or adjust analyzer tags and tests.
7. Rerun the audit command until the set has no open cards.
8. Run `npm run audit:cards -- progress` to refresh the edition progress overview.
9. Run `npm run audit:cards -- names reviewed` to refresh plain card-name lists for reviewed editions.

The worksheet is for human review and can be imported after editing. The ledger is the source of truth for completed decisions. Do not regenerate a worksheet over manual edits before importing it.

## Set Progress

The progress command marks every tracked Scryfall set as:

- `done`: worksheet exists and every unique oracle ID in the set is reviewed.
- `in_progress`: at least one card is reviewed, but open cards remain.
- `pending`: no reviewed cards are known locally yet.

`progressKnown` is `true` when a worksheet exists for the set, because the command can count total unique oracle IDs from that worksheet. Without a worksheet, progress can only use existing ledger entries.

## Card Name Lists

The names command writes simple one-name-per-line lists. By default it only writes sets that have local review progress.

- `npm run audit:cards -- names reviewed`: writes lists for reviewed or in-progress sets.
- `npm run audit:cards -- names lea`: writes one specific set.
- `npm run audit:cards -- names all`: writes every tracked Scryfall set.

The list removes duplicate names inside a set, so alternate print variants do not appear multiple times.

## Statuses

- `covered`: current analyzer output matches the expected role decision.
- `missing`: a role should exist but is not detected yet.
- `wrong`: the analyzer assigns a misleading role.
- `intentional_ignore`: the card is not strategically relevant for this analyzer.
- `needs_decision`: the card needs human review before code changes.
- `unsupported`: accepted gap for later work.

## Tag Decisions

When a card exposes a missing mechanic, record the decision before coding it:

```json
{
  "oracleId": "...",
  "name": "Fastbond",
  "firstSet": "lea",
  "releasedAt": "1993-08-05",
  "expectedRoles": ["land_acceleration", "extra_land_play"],
  "actualRoles": [],
  "status": "missing",
  "needsCodeChange": true,
  "tagDecisions": [
    {
      "tag": "extra_land_play",
      "action": "add_new",
      "layer": "mechanic",
      "note": "Extra land plays should support land acceleration scoring."
    }
  ]
}
```

If a new tag is added, wire it into the right layer:

- Core score tags affect module scores and recommendations.
- Strategy tags help identify archetypes.
- Mechanic tags preserve wording/mechanic knowledge and may later feed scores.

In the worksheet, write tag decisions as `tag:action:layer:note`. Multiple decisions can be separated with ` | `.

Example:

```text
extra_land_play:add_new:mechanic:Extra land wording is not covered yet | land_acceleration:use_existing:coreScore:Should count as ramp support
```
