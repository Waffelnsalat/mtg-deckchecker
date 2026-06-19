import {
  TutorTag,
  TutorTagHit,
  DeckSection,
  DrawTag,
  DrawTagHit,
  ProtectionTag,
  ProtectionTagHit,
  RecursionTag,
  RecursionTagHit,
  RemovalTag,
  RemovalTagHit,
  RampTag,
  RampTagHit,
  SpellInteractionTag,
  SpellInteractionTagHit,
  WinConditionTag,
  WinConditionTagHit,
} from "./types";

const RAMP_COMMANDER_MULTIPLIERS: Record<RampTag, number> = {
  stable_ramp: 1.75,
  burst_ramp: 1.25,
  land_acceleration: 1.45,
  mana_fixing: 1.3,
  cost_reduction: 1.65,
};

const DRAW_COMMANDER_MULTIPLIERS: Record<DrawTag, number> = {
  card_draw: 1.75,
  card_selection: 1.4,
  repeatable_advantage: 1.9,
};

const TUTOR_COMMANDER_MULTIPLIERS: Record<TutorTag, number> = {
  direct_tutor: 1.8,
  restricted_tutor: 1.55,
  repeatable_tutor: 1.7,
  land_tutor: 1.3,
};

const PROTECTION_COMMANDER_MULTIPLIERS: Record<ProtectionTag, number> = {
  broad_protection: 1.8,
  targeted_protection: 1.55,
  equipment_protection: 1.4,
  self_bounce: 1.45,
  flicker: 1.7,
};

const RECURSION_COMMANDER_MULTIPLIERS: Record<RecursionTag, number> = {
  battlefield_recursion: 1.6,
  hand_recursion: 1.4,
  replay_recursion: 1.7,
  mass_recursion: 1.45,
  library_recursion: 1.25,
};

const WIN_CONDITION_COMMANDER_MULTIPLIERS: Record<WinConditionTag, number> = {
  combat_finisher: 1.7,
  direct_finisher: 1.6,
  alternate_finisher: 1.85,
  repeatable_finisher: 1.8,
};

const REMOVAL_COMMANDER_MULTIPLIERS: Record<RemovalTag, number> = {
  targeted_removal: 1.45,
  mass_removal: 1.2,
  tempo_removal: 1.35,
  hand_attack: 1.3,
};

const SPELL_INTERACTION_COMMANDER_MULTIPLIERS: Record<SpellInteractionTag, number> = {
  hard_stack: 1.45,
  soft_stack: 1.35,
  spell_tempo: 1.35,
  broad_stack: 1.25,
  stax_piece: 1.35,
  graveyard_hate: 1.3,
};

export function applyCommanderAvailabilityToRampHits(section: DeckSection, hits: RampTagHit[]) {
  if (section !== "commander") {
    return hits;
  }

  return hits.map((hit) => ({
    ...hit,
    weight: roundTo(hit.weight * RAMP_COMMANDER_MULTIPLIERS[hit.tag], 2),
    reason: `${hit.reason} Commander availability increases this ramp role.`,
  }));
}

export function applyCommanderAvailabilityToDrawHits(section: DeckSection, hits: DrawTagHit[]) {
  if (section !== "commander") {
    return hits;
  }

  return hits.map((hit) => ({
    ...hit,
    weight: roundTo(hit.weight * DRAW_COMMANDER_MULTIPLIERS[hit.tag], 2),
    reason: `${hit.reason} Commander availability increases this card-flow role.`,
  }));
}

export function applyCommanderAvailabilityToTutorHits(section: DeckSection, hits: TutorTagHit[]) {
  if (section !== "commander") {
    return hits;
  }

  return hits.map((hit) => ({
    ...hit,
    weight: roundTo(hit.weight * TUTOR_COMMANDER_MULTIPLIERS[hit.tag], 2),
    reason: `${hit.reason} Commander availability increases this consistency role.`,
  }));
}

export function applyCommanderAvailabilityToProtectionHits(
  section: DeckSection,
  hits: ProtectionTagHit[],
) {
  if (section !== "commander") {
    return hits;
  }

  return hits.map((hit) => ({
    ...hit,
    weight: roundTo(hit.weight * PROTECTION_COMMANDER_MULTIPLIERS[hit.tag], 2),
    reason: `${hit.reason} Commander availability increases this protection role.`,
  }));
}

export function applyCommanderAvailabilityToRecursionHits(
  section: DeckSection,
  hits: RecursionTagHit[],
) {
  if (section !== "commander") {
    return hits;
  }

  return hits.map((hit) => ({
    ...hit,
    weight: roundTo(hit.weight * RECURSION_COMMANDER_MULTIPLIERS[hit.tag], 2),
    reason: `${hit.reason} Commander availability increases this recursion role.`,
  }));
}

export function applyCommanderAvailabilityToWinConditionHits(
  section: DeckSection,
  hits: WinConditionTagHit[],
) {
  if (section !== "commander") {
    return hits;
  }

  return hits.map((hit) => ({
    ...hit,
    weight: roundTo(hit.weight * WIN_CONDITION_COMMANDER_MULTIPLIERS[hit.tag], 2),
    reason: `${hit.reason} Commander availability increases this finishing role.`,
  }));
}

export function applyCommanderAvailabilityToRemovalHits(
  section: DeckSection,
  hits: RemovalTagHit[],
) {
  if (section !== "commander") {
    return hits;
  }

  return hits.map((hit) => ({
    ...hit,
    weight: roundTo(hit.weight * REMOVAL_COMMANDER_MULTIPLIERS[hit.tag], 2),
    reason: `${hit.reason} Commander availability increases this removal role.`,
  }));
}

export function applyCommanderAvailabilityToSpellInteractionHits(
  section: DeckSection,
  hits: SpellInteractionTagHit[],
) {
  if (section !== "commander") {
    return hits;
  }

  return hits.map((hit) => ({
    ...hit,
    weight: roundTo(hit.weight * SPELL_INTERACTION_COMMANDER_MULTIPLIERS[hit.tag], 2),
    reason: `${hit.reason} Commander availability increases this spell-interaction role.`,
  }));
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
