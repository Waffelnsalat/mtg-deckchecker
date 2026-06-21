# Card Role Todo

This list tracks larger analyzer improvements that should be handled after the set-by-set audit exposes enough examples.

## Tag Taxonomy

- [ ] Split broad role tags into clearer dimensions.
- [ ] Keep one high-level role for scoring, but add specific sub-tags for target, scope, timing, and quality.
- [ ] Make the website show the useful specific tags without overwhelming the card breakdown.

### Protection Tags

The current protection tags are still too general. `protection` and `broad_protection` do not clearly explain what is protected or how.

Add sub-tags for:

- [ ] Protected object:
  - player or controller
  - one target creature/permanent
  - all creatures
  - all permanents
  - commander only
  - equipped/enchanted object
- [ ] Protection method:
  - damage prevention
  - regeneration
  - indestructible
  - hexproof/shroud/ward
  - protection from color/type
  - phasing
  - flicker
  - redirect damage
- [ ] Duration/repeatability:
  - one-shot
  - until end of turn
  - static/continuous
  - activated repeatable
  - triggered repeatable
- [ ] Scope quality:
  - self-only
  - single target
  - board-wide
  - player shield
  - combat-only
  - damage-only

Example:

`Circle of Protection: Blue` could keep `protection` for scoring, but also expose `protects_player`, `damage_prevention`, `activated_repeatable`, and `color_specific`.

`Heroic Intervention` could keep `protection`, but also expose `protects_all_permanents`, `hexproof`, `indestructible`, and `one_shot`.

## Other Role Families To Split Later

- [ ] Removal: distinguish creature, permanent, artifact/enchantment, land, spell, graveyard, and player-resource interaction.
- [ ] Land denial: separate single land destruction, mass land destruction, land lock, mana denial, and land-type conversion.
- [ ] Draw/card flow: separate real draw, impulse access, selection, topdeck filtering, recursion-access, and delayed card advantage.
- [ ] Ramp: separate mana rocks, land ramp, extra land plays, mana doubling, rituals, cost reduction, treasure, and fixing.
- [ ] Damage engines: separate player damage, creature damage, land-trigger punishment, upkeep punishment, aristocrat drain, and scalable X damage.
- [ ] Stax/hate: separate symmetrical lock pieces, opponent-only hate, tax effects, timing locks, search hate, and untap denial.

## Implementation Notes

- [ ] Add the taxonomy to `data/card-role-audit.json` or a dedicated metadata file before wiring too many new tags into code.
- [ ] Keep analyzer tests focused on wording patterns, not just card names.
- [ ] Make the audit worksheet include both high-level roles and specific sub-tags once the schema is ready.
- [ ] Decide which tags affect scores and which tags are explanatory only.
