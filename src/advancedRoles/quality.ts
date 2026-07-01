import {
  applyEffectQualityDiscount,
  estimateEffectActivationManaCost,
  estimateEffectDrawbackPenalty,
} from "../activationCost";
import { CommanderColorProfile } from "../commanderColorProfile";
import { ScryfallCard } from "../types";
import { CardRoleProfile } from "./profile";
import { clamp, roundTo } from "./shared";

export interface AdvancedRoleHit {
  tag: string;
  weight: number;
  reason: string;
}

export interface AdvancedCardQuality {
  score: number;
  manaFactor: number;
  colorFactor: number;
  synergyFactor: number;
  drawbackPenalty: number;
}

const ADVANCED_DRAWBACK_ROLES = new Set([
  "timing_delay",
  "timing_restriction",
  "resource_payment",
  "temporary_body",
  "scaled_down_mode",
  "time_limited",
  "upkeep_cost",
  "combat_liability",
  "deckbuilding_restriction",
  "condition_restriction",
  "tempo_liability",
]);

const LOW_SIGNAL_ADVANCED_ROLES = new Set([
  "land_base",
  "land_slot",
  "basic_land",
  "mana_source",
]);

export function estimateAdvancedCardQuality(input: {
  card: ScryfallCard;
  rawHits: AdvancedRoleHit[];
  colorProfile: CommanderColorProfile;
  effectiveManaValue: number;
  roleCounts: Map<string, number>;
}): AdvancedCardQuality {
  const positiveHits = input.rawHits.filter(
    (hit) => !isAdvancedDrawbackRole(hit.tag) && !isLowSignalRole(hit.tag),
  );
  const drawbackPenalty = estimateAdvancedDrawbackPenalty(input.rawHits);
  const colorFactor = estimateAdvancedColorFactor(input.card, input.colorProfile);
  const synergyFactor = estimateAdvancedSynergyFactor(positiveHits, input.roleCounts);
  const manaFactor = estimateAdvancedManaFactor(input.effectiveManaValue, positiveHits);
  const positiveScore = estimateAdvancedPositiveScore(positiveHits, input.effectiveManaValue);
  const score = roundTo(
    clamp(positiveScore * colorFactor * synergyFactor * (1 - drawbackPenalty), 0.02, 2.4),
    2,
  );

  return {
    score,
    manaFactor,
    colorFactor,
    synergyFactor,
    drawbackPenalty,
  };
}

export function estimateAdvancedHitQuality(hit: AdvancedRoleHit, quality: AdvancedCardQuality) {
  if (isLowSignalRole(hit.tag)) {
    return roundTo(Math.min(hit.weight, 0.08), 2);
  }

  if (isAdvancedDrawbackRole(hit.tag)) {
    return roundTo(Math.min(hit.weight * 0.22, 0.07), 2);
  }

  return roundTo(
    clamp(
      hit.weight * quality.manaFactor * quality.colorFactor * quality.synergyFactor * (1 - quality.drawbackPenalty),
      0.03,
      1.6,
    ),
    2,
  );
}

export function estimateAdvancedPositiveScore(hits: AdvancedRoleHit[], effectiveManaValue: number) {
  if (hits.length === 0) {
    return 0.06;
  }

  const adjusted = hits
    .map((hit) => hit.weight * estimateRoleManaFactor(effectiveManaValue, hit.tag))
    .sort((left, right) => right - left);
  const diminishingReturns = [1, 0.55, 0.35, 0.22, 0.12];
  const score = adjusted.reduce(
    (sum, value, index) => sum + value * (diminishingReturns[index] ?? 0.08),
    0,
  );

  return roundTo(clamp(score, 0.04, 2.15), 2);
}

export function estimateAdvancedManaFactor(effectiveManaValue: number, hits: AdvancedRoleHit[]) {
  if (hits.length === 0) {
    return 0.78;
  }

  const weightedFactor = hits.reduce(
    (sum, hit) => sum + estimateRoleManaFactor(effectiveManaValue, hit.tag) * hit.weight,
    0,
  );
  const totalWeight = hits.reduce((sum, hit) => sum + hit.weight, 0);

  return roundTo(clamp(weightedFactor / Math.max(totalWeight, 0.01), 0.58, 1.12), 2);
}

export function estimateRoleManaFactor(effectiveManaValue: number, role: string) {
  if (effectiveManaValue <= 0) {
    return isLowSignalRole(role) ? 0.45 : 1.08;
  }

  const curvePoint = getAdvancedRoleCurvePoint(role);
  const penaltyPerStep = getAdvancedRoleManaPenalty(role);
  const stepsPastCurve = Math.max(effectiveManaValue - curvePoint, 0);
  const stepsBeforeCurve = Math.max(curvePoint - effectiveManaValue, 0);
  const cheapBonus = Math.min(0.1, stepsBeforeCurve * 0.025);
  const factor = 1 + cheapBonus - stepsPastCurve * penaltyPerStep;

  return roundTo(clamp(factor, 0.56, 1.12), 2);
}

export function getAdvancedRoleCurvePoint(role: string) {
  if (role.includes("finisher") || role === "combat_finisher" || role === "alternate_finisher") {
    return 4.2;
  }

  if (
    role.includes("removal") ||
    role.includes("stack") ||
    role === "hand_attack" ||
    role === "graveyard_hate" ||
    role === "protection" ||
    role === "self_protection"
  ) {
    return 2.2;
  }

  if (
    role.includes("draw") ||
    role.includes("tutor") ||
    role.includes("selection") ||
    role.includes("recursion") ||
    role === "repeatable_advantage"
  ) {
    return 3.1;
  }

  if (role.includes("ramp") || role === "cost_reduction" || role === "mana_fixing") {
    return 2.4;
  }

  if (
    role.includes("support") ||
    role.includes("engine") ||
    role === "artifact_support" ||
    role === "enchantress"
  ) {
    return 3.4;
  }

  if (role.includes("land") || role === "mana_source" || role === "basic_land") {
    return 0.5;
  }

  return 3;
}

export function getAdvancedRoleManaPenalty(role: string) {
  if (role.includes("finisher") || role === "mass_removal" || role === "repeatable_advantage") {
    return 0.045;
  }

  if (
    role.includes("removal") ||
    role.includes("stack") ||
    role === "hand_attack" ||
    role === "protection" ||
    role === "self_protection"
  ) {
    return 0.075;
  }

  if (role.includes("ramp") || role === "cost_reduction" || role === "mana_fixing") {
    return 0.07;
  }

  return 0.055;
}

export function estimateAdvancedColorFactor(card: ScryfallCard, colorProfile: CommanderColorProfile) {
  const colors = new Set(card.color_identity ?? []);

  if (colors.size === 0) {
    return 1;
  }

  const offColor = [...colors].some((color) => !colorProfile.colors.includes(color));
  if (offColor) {
    return 0.35;
  }

  if (colorProfile.isColorless) {
    return 0.35;
  }

  if (colors.size === 1) {
    return colorProfile.isMonoColor ? 1.02 : 1;
  }

  if (colors.size >= 4) {
    return 0.9;
  }

  if (colors.size === 3) {
    return colorProfile.colorCount >= 4 ? 0.95 : 0.92;
  }

  return colorProfile.colorCount >= 3 ? 0.98 : 0.94;
}

export function estimateAdvancedSynergyFactor(hits: AdvancedRoleHit[], roleCounts: Map<string, number>) {
  const bestCount = hits.reduce((best, hit) => Math.max(best, roleCounts.get(hit.tag) ?? 0), 0);

  if (bestCount >= 10) {
    return 1.12;
  }

  if (bestCount >= 6) {
    return 1.08;
  }

  if (bestCount >= 3) {
    return 1.04;
  }

  return 1;
}

export function estimateAdvancedDrawbackPenalty(hits: AdvancedRoleHit[]) {
  const penalty = hits.reduce((sum, hit) => {
    if (!isAdvancedDrawbackRole(hit.tag)) {
      return sum;
    }

    return sum + Math.min(0.09, hit.weight * getAdvancedDrawbackSeverity(hit.tag));
  }, 0);

  return roundTo(clamp(penalty, 0, 0.34), 2);
}

export function getAdvancedDrawbackSeverity(role: string) {
  switch (role) {
    case "upkeep_cost":
      return 0.45;
    case "temporary_body":
      return 0.38;
    case "resource_payment":
      return 0.34;
    case "timing_delay":
    case "timing_restriction":
      return 0.3;
    case "combat_liability":
    case "tempo_liability":
      return 0.28;
    case "condition_restriction":
    case "scaled_down_mode":
    case "time_limited":
      return 0.24;
    case "deckbuilding_restriction":
      return 0.18;
    default:
      return 0.25;
  }
}

export function isAdvancedDrawbackRole(role: string) {
  return ADVANCED_DRAWBACK_ROLES.has(role);
}

export function isLowSignalRole(role: string) {
  return LOW_SIGNAL_ADVANCED_ROLES.has(role);
}

export function applyEffectQualityDiscountToProfile(profile: CardRoleProfile, text: string) {
  if (estimateEffectActivationManaCost(text) <= 0 && estimateEffectDrawbackPenalty(text) <= 0) {
    return;
  }

  for (const [role, weight] of profile.weights) {
    profile.weights.set(role, roundTo(applyEffectQualityDiscount(weight, text), 2));
    const reasons = profile.reasons.get(role) ?? new Set<string>();
    reasons.add("Mana costs or drawbacks attached to the effect lower its practical value.");
    profile.reasons.set(role, reasons);
  }
}
