# Card Role Audit

This workflow reviews Magic cards set by set, oldest first, so wording gaps and missing mechanics can be found once and kept covered by tests.

## Files

- `data/scryfall-sets.json`: generated list of every Scryfall set, sorted by release date.
- `data/card-role-audit.json`: manual review ledger, keyed by `oracleId`.
- `scripts/card-role-audit.ts`: CLI for refreshing set data and finding the next open set.

## Commands

```bash
npm run audit:cards -- refresh-sets
npm run audit:cards -- summary
npm run audit:cards -- next-set
npm run audit:cards -- set lea
```

## Review Rule

Review each `oracle_id` once. Reprints are skipped automatically unless Oracle wording changes require a new decision later.

The normal loop is:

1. Run `npm run audit:cards -- next-set`.
2. Review the listed cards in Scryfall.
3. Add decisions to `data/card-role-audit.json`.
4. For `missing` or `wrong` entries, add or adjust analyzer tags and tests.
5. Rerun the audit command until the set has no open cards.

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
