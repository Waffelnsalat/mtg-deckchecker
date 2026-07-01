import { roundTo } from "./shared";

export interface CardRoleProfile {
  roles: Set<string>;
  weights: Map<string, number>;
  reasons: Map<string, Set<string>>;
}

export function createCardRoleProfile(): CardRoleProfile {
  return {
    roles: new Set<string>(),
    weights: new Map<string, number>(),
    reasons: new Map<string, Set<string>>(),
  };
}

export function mergeCardRoleProfile(
  target: CardRoleProfile,
  source: CardRoleProfile,
  multiplier = 1,
) {
  for (const role of source.roles) {
    target.roles.add(role);
    const sourceWeight = source.weights.get(role) ?? 0;
    target.weights.set(role, roundTo((target.weights.get(role) ?? 0) + sourceWeight * multiplier, 2));
    const sourceReasons = source.reasons.get(role);
    if (!sourceReasons?.size) {
      continue;
    }

    const targetReasons = target.reasons.get(role) ?? new Set<string>();
    sourceReasons.forEach((reason) => targetReasons.add(reason));
    target.reasons.set(role, targetReasons);
  }
}

export function addRole(profile: CardRoleProfile, role: string, weight: number, reason: string) {
  profile.roles.add(role);
  profile.weights.set(role, roundTo(Math.max(profile.weights.get(role) ?? 0, weight), 2));
  const reasons = profile.reasons.get(role) ?? new Set<string>();
  reasons.add(reason);
  profile.reasons.set(role, reasons);
}
