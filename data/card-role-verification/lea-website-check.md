# LEA Website Verification

Paste `data/card-role-verification/lea-website-check.deck` into the website analyzer and inspect the card breakdown / tagged card sections.

This deck is intentionally a verification fixture, not a Commander-legal deck recommendation. `Time Walk` may trigger validation warnings, but the lenient analyzer should still return partial results.

## Expected New Signals

| Card | Expected analyzer roles |
| --- | --- |
| Armageddon | `mass_land_denial`, `land_denial`, `mass_removal`, `hate_piece` |
| Flashfires | `mass_land_denial`, `land_denial`, `mass_removal`, `hate_piece` |
| Tsunami | `mass_land_denial`, `land_denial`, `mass_removal`, `hate_piece` |
| Sinkhole | `targeted_land_removal`, `land_denial`, `targeted_removal` |
| Stone Rain | `targeted_land_removal`, `land_denial`, `targeted_removal` |
| Ice Storm | `targeted_land_removal`, `land_denial`, `targeted_removal` |
| Kudzu | `targeted_land_removal`, `land_denial`, `targeted_removal` |
| Tunnel | `targeted_removal` |
| Dwarven Demolition Team | `targeted_removal` |
| Mana Short | `mana_denial`, `land_denial`, `hate_piece` |
| Drain Power | `mana_denial`, `land_denial`, `hate_piece` |
| Circle of Protection: Blue | `broad_protection` |
| Samite Healer | `targeted_protection` |
| Conservator | `broad_protection` |
| Jade Monolith | `targeted_protection` |
| Veteran Bodyguard | `broad_protection` |
| Time Walk | `extra_turn`, `finisher` |
| Manabarbs | `group_slug`, `damage_engine` |
| Karma | `group_slug`, `damage_engine` |
| Psychic Venom | `group_slug`, `damage_engine` |
| Ankh of Mishra | `group_slug`, `damage_engine` |
| Dingus Egg | `group_slug`, `damage_engine` |
| Copper Tablet | `group_slug`, `damage_engine` |
