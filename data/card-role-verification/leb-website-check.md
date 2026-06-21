# LEB Website Verification

Paste `data/card-role-verification/leb-website-check.deck` into the website analyzer and inspect the card breakdown / tagged card sections.

This deck is intentionally a verification fixture, not a Commander-legal deck recommendation. It only covers the two Beta cards that were not already covered by the Alpha audit.

## Expected New Signals

| Card | Expected analyzer roles |
| --- | --- |
| Circle of Protection: Black | `broad_protection`, `protection` |
| Volcanic Island | `land_base`, `land_slot`, `mana_source`, `typed_land` |
