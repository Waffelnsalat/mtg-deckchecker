# Card Role Audit

This workflow reviews Magic cards set by set, oldest first, so wording gaps and missing mechanics can be found once and kept covered by tests.

## Files

- `data/scryfall-sets.json`: generated list of every Scryfall set, sorted by release date.
- `data/card-role-audit.json`: manual review ledger, keyed by `oracleId`.
- `data/card-role-worksheets/<set>-role-review.tsv`: generated manual review worksheets.
- `scripts/card-role-audit.ts`: CLI for refreshing set data and finding the next open set.

## Commands

```bash
npm run audit:cards -- refresh-sets
npm run audit:cards -- summary
npm run audit:cards -- next-set
npm run audit:cards -- set lea
npm run audit:cards -- worksheet lea
npm run audit:cards -- import-worksheet lea
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

The worksheet is for human review and can be imported after editing. The ledger is the source of truth for completed decisions. Do not regenerate a worksheet over manual edits before importing it.

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
