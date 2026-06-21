# ARN Website Verification

Paste `data/card-role-verification/arn-website-check.deck` into the website analyzer and inspect the card breakdown / tagged card sections.

This deck is intentionally a verification fixture, not a Commander-legal deck recommendation. It focuses on Arabian Nights cards whose old wording added or corrected analyzer roles.

## Expected New Signals

| Card | Expected analyzer roles |
| --- | --- |
| Eye for an Eye | `damage_engine`, `damage_reflection` |
| Shahrazad | `alternate_play`, `life_pressure`, `subgame` |
| Oubliette | `removal`, `targeted_removal`, `tempo_removal`; no protection tag |
| Drop of Honey | `removal`, `targeted_removal` |
| Cyclone | `damage_engine`, `group_slug`, `mass_removal` |
| Ifh-Bíff Efreet | `damage_engine`, `group_slug`, `mass_removal` |
| Magnetic Mountain | `hate_piece`, `stax_piece` |
| Pyramids | `land_protection`, `targeted_protection`, `targeted_removal` |
| Jandor's Saddlebags | `tap_untap`, `tempo_support`; no ramp tag |
| King Suleiman | `targeted_removal` |
| Repentant Blacksmith | `self_protection` |
| Ali from Cairo | `broad_protection`, `life_total_protection`; no lifegain tag |
| Sandstorm | `mass_removal` |
| Sorceress Queen | `targeted_removal` |
| Fishliver Oil | `landwalk_support` |
| Desert Nomads | `landwalk_support` |
| Island of Wak-Wak | `targeted_removal` |
| Camel | `desert_hate`, `self_protection` |
