import { getCommanderColorProfile } from "./commanderColorProfile";
import {
  createEffectiveManaValueContext,
  estimateEffectiveManaValue,
} from "./effectiveManaValue";
import { DeckResolutionDocument, DeckSection, ResolvedDeckCard, ScryfallCard } from "./types";
import {
  CardRoleProfile,
  createCardRoleProfile,
  mergeCardRoleProfile,
} from "./advancedRoles/profile";
import {
  getCacheKey,
  getCardOracleText,
  hasCardType,
  isPermanentCard,
  normalizeText,
} from "./advancedRoles/shared";
import {
  AdvancedRoleHit,
  applyEffectQualityDiscountToProfile,
  estimateAdvancedCardQuality,
  estimateAdvancedHitQuality,
  isAdvancedDrawbackRole,
  isLowSignalRole,
} from "./advancedRoles/quality";
import { detectAdvancedDrawRoles } from "./advancedRoles/detectors/draw";
import { detectAdvancedRampRoles } from "./advancedRoles/detectors/ramp";
import { detectAdvancedTutorRoles } from "./advancedRoles/detectors/tutor";
import { detectAdvancedRemovalRoles, detectAdvancedStackRoles } from "./advancedRoles/detectors/interaction";
import { detectAdvancedProtectionRoles } from "./advancedRoles/detectors/protection";
import { detectAdvancedRecursionRoles } from "./advancedRoles/detectors/recursion";
import { detectAdvancedFinisherRoles } from "./advancedRoles/detectors/finisher";
import { detectAdvancedPurposeRoles } from "./advancedRoles/detectors/purpose";
import { detectAdvancedScalableSpellRoles } from "./advancedRoles/detectors/scalable";

export type { CardRoleProfile } from "./advancedRoles/profile";
export { createCardRoleProfile, mergeCardRoleProfile } from "./advancedRoles/profile";
export { getCardOracleText, hasCardType, normalizeText } from "./advancedRoles/shared";

export interface AdvancedRoleTaggedCard {
  name: string;
  quantity: number;
  section: DeckSection;
  roleValue: number;
  effectiveManaValue: number;
  hits: Array<{
    tag: string;
    weight: number;
    reason: string;
  }>;
}

export interface DeckAdvancedRoleAnalysis {
  taggedCards: AdvancedRoleTaggedCard[];
}

const advancedRoleCache = new Map<string, CardRoleProfile | null>();

export function inferAdvancedRoleProfile(card: ScryfallCard) {
  const cacheKey = getCacheKey(card);
  const cached = advancedRoleCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const text = getCardOracleText(card);
  const profile = createCardRoleProfile();
  const permanent = isPermanentCard(card);
  const land = hasCardType(card, "Land");
  const equipment = hasCardType(card, "Equipment");

  detectAdvancedDrawRoles(profile, text, permanent);
  detectAdvancedRampRoles(profile, text, permanent, land);
  detectAdvancedTutorRoles(profile, text, permanent);
  detectAdvancedRemovalRoles(profile, text);
  detectAdvancedStackRoles(profile, text);
  detectAdvancedProtectionRoles(profile, text, permanent, equipment);
  detectAdvancedRecursionRoles(profile, text, permanent);
  detectAdvancedFinisherRoles(profile, text, permanent, card.keywords ?? []);
  detectAdvancedPurposeRoles(profile, text, card);
  detectAdvancedScalableSpellRoles(profile, text, card);
  applyEffectQualityDiscountToProfile(profile, text);

  const result = profile.roles.size > 0 ? profile : null;
  advancedRoleCache.set(cacheKey, result);
  return result;
}

export function getRoleWeight(profile: CardRoleProfile | null | undefined, role: string) {
  return profile?.weights.get(role) ?? 0;
}

export function getRoleReason(profile: CardRoleProfile | null | undefined, role: string) {
  return [...(profile?.reasons.get(role) ?? [])].join(" ");
}

export function analyzeDeckAdvancedRoles(document: DeckResolutionDocument): DeckAdvancedRoleAnalysis {
  const deckCards = document.result.resolvedCards.filter(
    (card) => card.section === "commander" || card.section === "mainboard" || card.section === "companion",
  );
  const colorProfile = getCommanderColorProfile(deckCards);
  const effectiveManaContext = createEffectiveManaValueContext(deckCards);
  const roleCounts = buildAdvancedRoleCounts(deckCards);

  const taggedCards = document.result.resolvedCards
    .map((entry): AdvancedRoleTaggedCard | null => {
      const profile = inferAdvancedRoleProfile(entry.card);
      if (!profile) {
        return null;
      }

      const effectiveManaValue = estimateEffectiveManaValue(entry.card, effectiveManaContext);
      const rawHits = [...profile.roles]
        .map((role) => ({
          tag: role,
          weight: profile.weights.get(role) ?? 0,
          reason: getRoleReason(profile, role),
        }))
        .filter((hit) => hit.weight > 0);
      const quality = estimateAdvancedCardQuality({
        card: entry.card,
        rawHits,
        colorProfile,
        effectiveManaValue,
        roleCounts,
      });
      const hits = rawHits
        .map((hit) => ({
          ...hit,
          weight: estimateAdvancedHitQuality(hit, quality),
        }))
        .filter((hit) => hit.weight > 0)
        .sort((left, right) => right.weight - left.weight || left.tag.localeCompare(right.tag));

      if (hits.length === 0) {
        return null;
      }

      return {
        name: entry.card.name,
        quantity: entry.quantity,
        section: entry.section,
        roleValue: quality.score,
        effectiveManaValue,
        hits,
      };
    })
    .filter((card): card is AdvancedRoleTaggedCard => card !== null);

  return { taggedCards };
}

function buildAdvancedRoleCounts(deckCards: ResolvedDeckCard[]) {
  const counts = new Map<string, number>();

  for (const entry of deckCards) {
    const profile = inferAdvancedRoleProfile(entry.card);
    if (!profile) {
      continue;
    }

    for (const role of profile.roles) {
      if (isAdvancedDrawbackRole(role) || isLowSignalRole(role)) {
        continue;
      }

      counts.set(role, (counts.get(role) ?? 0) + entry.quantity);
    }
  }

  return counts;
}
