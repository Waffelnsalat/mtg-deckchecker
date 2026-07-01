import { CardRoleProfile, addRole } from "../profile";
import {
  hasSelfContainedGraveyardCastText,
  hasSelfReplacingTopDrawText,
  hasTopLibraryFilteringText,
  isRepeatableText,
} from "../shared";

export function detectAdvancedDrawRoles(profile: CardRoleProfile, text: string, permanent: boolean) {
  const repeatable = isRepeatableText(text, permanent);
  const opponentOnlyDraw =
    /\b(?:target opponent|defending player|that player|its controller) may draw\b/.test(text) &&
    !/\byou (?:may )?draw\b|\beach player (?:may )?draws?\b|\ban opponent chooses one\b[\s\S]{0,120}\byou draw\b/.test(
      text,
    );
  const delayedNextTurnDraw =
    /\bdraw (?:a card|one|two|three|four|five|six|seven|eight|nine|ten|\d+ cards?)\b[^.]{0,100}\bat the beginning of the next turn'?s upkeep\b/.test(
      text,
    );
  const oneShotDrawTrigger =
    /\bwhen\b[^.]{0,120}\b(?:enters(?: the battlefield)?|dies|leaves the battlefield)\b[^.]{0,160}\bdraw(?:s)?\b/.test(
      text,
    );
  const hasImpulseAccess =
    /\bexile the top\b.{0,180}\byou may (?:play|cast)\b/.test(text) ||
    /\blook at the top\b.{0,120}\byou may (?:play|cast)\b/.test(text);
  const hasRevealCastAccess =
    /\breveal the top card of your library\b.{0,180}\byou may (?:play|cast)\b/.test(text) ||
    /\breveal\b.{0,60}\btop card of your library\b.{0,180}\byou may cast that card\b/.test(text);
  const hasTopdeckAccess =
    /\bplay with the top card of your library revealed\b/.test(text) ||
    /\byou may look at the top card of your library\b/.test(text) ||
    /\byou may (?:play|cast)\b[^.]{0,100}\btop card of your library\b/.test(text);
  const hasGraveyardAccess =
    !hasSelfContainedGraveyardCastText(text) &&
    (/\byou may (?:play|cast)\b[^.]{0,120}\bfrom your graveyard\b/.test(text) ||
      /\bduring each of your turns, you may play\b[^.]{0,120}\bfrom your graveyard\b/.test(text) ||
      /\byou may play\b[^.]{0,120}\bcards? exiled with\b/.test(text));
  const hasExileCastAccess =
    /\byou may cast\b[^.]{0,220}\b(?:card|one of them|that card|it)\b[^.]{0,140}\bwithout paying (?:its|their) mana cost\b/.test(text) ||
    /\byou may cast\b[^.]{0,220}\bspells? from among\b[^.]{0,180}\bexiled this way\b/.test(text) ||
    /\bexile\b[^.]{0,200}\b(?:instant or sorcery card|card)\b[^.]{0,200}\byou may cast that card\b/.test(text) ||
    /\bcards? exiled with\b[^.]{0,160}\byou may cast\b/.test(text);
  const hasLibraryDigSelection =
    /\b(?:look at|reveal|mill)\b[\s\S]{0,180}\bput\b[\s\S]{0,160}\b(?:from among them|from among those cards|from among the revealed cards|from among the cards revealed this way|from among the milled cards|from among the cards milled this way|from among cards milled this way)\b[\s\S]{0,160}\b(?:into your hand|onto the battlefield)\b/.test(text) ||
    /\bput\b[\s\S]{0,160}\b(?:from among them|from among those cards|from among the revealed cards|from among the cards revealed this way|from among the milled cards|from among the cards milled this way|from among cards milled this way)\b[\s\S]{0,160}\b(?:into your hand|onto the battlefield)\b/.test(text) ||
    /\breveal cards? from the top of your library until\b[\s\S]{0,220}\bput (?:that card|it|one of them|those cards)\b[\s\S]{0,120}\b(?:into your hand|onto the battlefield)\b/.test(text) ||
    /\breveal cards? from the top of your library until\b[\s\S]{0,220}\bput all cards revealed this way into your hand\b/.test(text) ||
    /\bexile cards? from the top of your library until\b[\s\S]{0,260}\bput (?:that card|it|one of them|those cards?|those [a-z]+ cards?|the exiled cards?)\b[\s\S]{0,160}\b(?:into your hand|onto the battlefield)\b/.test(text) ||
    /\blook at the top (?:x|\d+|[a-z]+) cards? of your library\b[\s\S]{0,180}\bput one of those cards on top of your library\b/.test(text);
  const hasTopLibraryFiltering = hasTopLibraryFilteringText(text);
  const hasSelfReplacingTopDraw = hasSelfReplacingTopDrawText(text);

  if (hasImpulseAccess || hasRevealCastAccess) {
    addRole(profile, "draw", 1, "Advanced scan recognized repeatable or delayed impulse card flow.");
    addRole(profile, "direct_draw", 0.72, "Advanced scan recognized impulse access as practical card flow.");
    addRole(profile, "selection", 0.78, "Advanced scan recognized extra card access outside the hand.");
    if (repeatable) {
      addRole(profile, "repeatable_draw", 0.88, "Advanced scan recognized recurring impulse card advantage.");
      addRole(profile, "repeatable_advantage", 0.86, "Advanced scan recognized a repeatable card-flow engine.");
    }
  } else {
    if (
      (
        /\bdraw (?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x)\b/.test(text) ||
        /\b(?:you|each player) draws? up to (?:one|two|three|four|five|six|seven|eight|nine|ten|\d+) cards?\b/.test(text)
      ) &&
      !opponentOnlyDraw &&
      !/\bif (?:you|a player|that player) would draw\b/.test(text) &&
      !/\bwhenever (?:you|a player|an opponent|one or more players) draw\b/.test(text) &&
      !hasSelfReplacingTopDraw
    ) {
      addRole(profile, "draw", 0.92, "Advanced scan recognized direct card draw.");
      addRole(profile, "direct_draw", 0.76, "Advanced scan recognized direct card draw.");
      if (repeatable && !delayedNextTurnDraw && !oneShotDrawTrigger) {
        addRole(profile, "repeatable_draw", 0.64, "Advanced scan recognized recurring draw text.");
      }
    }

    if (/\bat the beginning of each player'?s draw step\b[^.]{0,120}\bthat player draws? (?:one|two|three|\d+) additional cards?\b/.test(text)) {
      addRole(profile, "draw", 0.58, "Advanced scan recognized symmetrical extra draw.");
      addRole(profile, "card_draw", 0.52, "Advanced scan recognized symmetrical extra draw.");
      addRole(profile, "group_hug", 0.46, "Advanced scan recognized symmetrical table draw.");
    }

    if (
      /\bat the beginning of each player'?s draw step\b[^.]{0,180}\bthat player draws? an additional card\b/.test(text) ||
      /\bat the beginning of each player'?s end step\b[^.]{0,180}\bthat player draws? a card\b/.test(text)
    ) {
      addRole(profile, "draw", 0.56, "Advanced scan recognized symmetrical recurring draw.");
      addRole(profile, "card_draw", 0.52, "Advanced scan recognized symmetrical recurring draw.");
      addRole(profile, "group_hug", 0.42, "Advanced scan recognized symmetrical table draw.");
      if (permanent) {
        addRole(profile, "repeatable_draw", 0.48, "Advanced scan recognized a recurring table draw engine.");
      }
    }

    if (
      /\beach player discards? (?:their|his or her) hand\b[^.]{0,160}\bthen draws? (?:seven|one|two|three|four|five|six|\d+|x)? ?cards?(?: equal to)?\b/.test(text)
    ) {
      addRole(profile, "draw", 0.74, "Advanced scan recognized wheel-style card flow.");
      addRole(profile, "selection", 0.64, "Advanced scan recognized wheel-style hand reset.");
      addRole(profile, "hand_denial", 0.46, "Advanced scan recognized symmetrical hand disruption.");
    }

    if (/\binvestigate\b|\bcreate (?:a|one|two|three|x|\d+) clue token/.test(text)) {
      addRole(profile, "draw", 0.72, "Advanced scan recognized Clue-based delayed card draw.");
      addRole(profile, "selection", 0.42, "Advanced scan recognized Clue-based card access.");
      if (repeatable) {
        addRole(profile, "repeatable_draw", 0.44, "Advanced scan recognized recurring Clue generation.");
        addRole(profile, "repeatable_advantage", 0.42, "Advanced scan recognized a recurring Clue engine.");
      }
    }

    if (/\bdraw\b[^.]{0,80}\bdiscard\b|\bdiscard\b[^.]{0,80}\bdraw\b/.test(text)) {
      addRole(profile, "selection", 0.62, "Advanced scan recognized looting-style card selection.");
      if (repeatable && !oneShotDrawTrigger) {
        addRole(profile, "repeatable_advantage", 0.36, "Advanced scan recognized recurring looting as a small engine.");
      }
    }

    if (/\bdraw cards? (?:and lose life )?equal to\b/.test(text)) {
      addRole(profile, "draw", 0.84, "Advanced scan recognized scalable card draw.");
      addRole(profile, "direct_draw", 0.78, "Advanced scan recognized scalable card draw.");
    }
  }

  if (hasTopdeckAccess || hasGraveyardAccess || hasExileCastAccess) {
    addRole(profile, "selection", 0.7, "Advanced scan recognized ongoing access to extra cards.");
    if (repeatable || hasExileCastAccess) {
      addRole(profile, "repeatable_draw", 0.72, "Advanced scan recognized a lasting card-access engine.");
      addRole(profile, "repeatable_advantage", 0.76, "Advanced scan recognized a repeatable value engine.");
    }
  }

  if (hasLibraryDigSelection) {
    addRole(profile, "draw", 0.58, "Advanced scan recognized library dig as card access.");
    addRole(profile, "selection", 0.74, "Advanced scan recognized library dig selection.");
    if (repeatable) {
      addRole(profile, "repeatable_advantage", 0.52, "Advanced scan recognized repeatable library dig selection.");
    }
  }

  if (hasTopLibraryFiltering) {
    addRole(
      profile,
      "card_selection",
      permanent ? 0.54 : 0.46,
      "Advanced scan recognized top-of-library filtering.",
    );
    addRole(
      profile,
      "selection",
      permanent ? 0.62 : 0.54,
      "Advanced scan recognized top-of-library filtering.",
    );
  }
}
