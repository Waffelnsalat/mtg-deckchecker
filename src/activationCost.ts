export function estimateEffectActivationManaCost(text: string) {
  const normalizedText = text.toLowerCase().replace(/\s+/g, " ");
  const costs: number[] = [];
  const activatedClauses = normalizedText.matchAll(/(?<cost>[^.;]{0,140}):(?<effect>[^.;]{0,260})/g);

  for (const match of activatedClauses) {
    const costText = match.groups?.cost ?? "";
    const effectText = match.groups?.effect ?? "";

    if (!isRelevantActivatedEffect(effectText)) {
      continue;
    }

    const manaCost = estimateManaSymbols(costText);
    if (manaCost > 0) {
      costs.push(manaCost);
    }
  }

  return costs.length === 0 ? 0 : Math.min(...costs);
}

export function applyActivationCostDiscount(value: number, text: string, penaltyPerMana = 0.1) {
  const activationCost = estimateEffectActivationManaCost(text);
  if (activationCost <= 0) {
    return value;
  }

  const discount = Math.min(0.42, activationCost * penaltyPerMana);
  return value * (1 - discount);
}

export function estimateEffectDrawbackPenalty(text: string) {
  const normalizedText = text.toLowerCase().replace(/\s+/g, " ");
  let penalty = 0;

  const lifeLoss = [...normalizedText.matchAll(/\b(?:you )?(?:lose|pay) (?<amount>\d+) life\b/g)]
    .reduce((sum, match) => sum + Number(match.groups?.amount ?? 0), 0);
  const selfDamage = [...normalizedText.matchAll(/\bdeals? (?<amount>\d+) damage to you\b/g)]
    .reduce((sum, match) => sum + Number(match.groups?.amount ?? 0), 0);
  penalty += Math.min(0.18, (lifeLoss + selfDamage) * 0.025);

  if (/\b(?:you )?(?:lose|pay) life equal to\b/.test(normalizedText)) {
    penalty += 0.08;
  }

  if (/\bas an additional cost\b[^.]{0,120}\b(?:discard|sacrifice|exile|pay \d+ life|lose \d+ life)\b/.test(normalizedText)) {
    penalty += 0.14;
  } else if (/\b(?:discard|sacrifice) (?:a|an|another|one or more) [^.]{0,80}:\b/.test(normalizedText)) {
    penalty += 0.1;
  }

  penalty += estimateSacrificeResourcePenalty(normalizedText);

  if (/\btarget opponent\b[^.]{0,160}\b(?:draws?|creates?|gains?)\b/.test(normalizedText)) {
    penalty += 0.1;
  }

  penalty += estimateRemovalCompensationPenalty(normalizedText);

  if (/\benters? (?:the battlefield )?tapped\b/.test(normalizedText)) {
    penalty += 0.04;
  }

  return Math.min(0.35, penalty);
}

export function applyEffectDrawbackDiscount(value: number, text: string) {
  const penalty = estimateEffectDrawbackPenalty(text);
  return penalty <= 0 ? value : value * (1 - penalty);
}

export function applyEffectQualityDiscount(value: number, text: string, activationPenaltyPerMana = 0.1) {
  return applyEffectDrawbackDiscount(
    applyActivationCostDiscount(value, text, activationPenaltyPerMana),
    text,
  );
}

function isRelevantActivatedEffect(effectText: string) {
  return (
    /\badd\b/.test(effectText) ||
    /\buntap\b/.test(effectText) ||
    /\bsearch\b[^.]{0,160}\blibrary\b/.test(effectText) ||
    /\bput\b[^.]{0,160}\bonto the battlefield\b/.test(effectText) ||
    /\bdraw\b/.test(effectText) ||
    /\bexile\b|\bdestroy\b|\bcounter\b|\breturn\b|\bphase\b|\bprevent\b/.test(effectText) ||
    /\bdouble\b|\bcopy\b|\bcreate\b|\bdeals? damage\b|\bloses? life\b|\bwin the game\b/.test(effectText)
  );
}

function estimateSacrificeResourcePenalty(text: string) {
  if (!hasSacrificeForValuePattern(text)) {
    return 0;
  }

  let penalty = 0.1;

  if (/\bsacrifice (?:a|an|another|one or more) (?:creature|nontoken creature|permanent|land)\b/.test(text)) {
    penalty += 0.05;
  }

  if (/\bsacrifice (?:a|an|another|one or more) (?:clue|food|blood|map|treasure|token|artifact)\b/.test(text)) {
    penalty -= 0.03;
  }

  if (/\bas an additional cost\b[^.]{0,160}\bsacrifice\b/.test(text)) {
    penalty += 0.03;
  }

  return clamp(penalty, 0.06, 0.18);
}

function hasSacrificeForValuePattern(text: string) {
  if (/\b(?:target|each|an) opponent\b[^.]{0,140}\bsacrifices?\b/.test(text)) {
    return false;
  }

  const valueEffect =
    /\b(?:draw|search|return|put|create|add|gain|investigate|discover|surveil|mill)\b/.source;
  const sacrificeMaterial =
    /\bsacrifice (?:a|an|another|one or more|any number of)? ?(?:creature|nontoken creature|artifact|enchantment|permanent|land|token|clue|food|blood|map|treasure)\b/.source;

  return (
    new RegExp(`${sacrificeMaterial}[^.]{0,180}${valueEffect}`).test(text) ||
    new RegExp(`${sacrificeMaterial}[^.]{0,120}\\.\\s*(?:if you do,?\\s*)?[^.]{0,120}${valueEffect}`).test(text) ||
    new RegExp(`${sacrificeMaterial}[^:]{0,120}:[^.]{0,180}${valueEffect}`).test(text) ||
    new RegExp(`as an additional cost[^.]{0,160}${sacrificeMaterial}[\\s\\S]{0,220}${valueEffect}`).test(text)
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function estimateRemovalCompensationPenalty(text: string) {
  if (!hasRemovalAction(text)) {
    return 0;
  }

  let penalty = 0;

  if (
    /\b(?:its|that (?:creature|artifact|enchantment|planeswalker|battle|permanent)'s) controller creates?\b[^.]{0,120}\b(?:creature )?tokens?\b/.test(
      text,
    ) ||
    /\bthat player creates?\b[^.]{0,120}\b(?:creature )?tokens?\b/.test(text)
  ) {
    penalty += hasLargeCompensationToken(text) ? 0.16 : 0.11;
  }

  if (
    /\b(?:its|that (?:creature|artifact|enchantment|planeswalker|battle|permanent)'s) controller (?:may )?search(?:es)?\b[^.]{0,180}\blibrary\b/.test(
      text,
    )
  ) {
    penalty += 0.1;
  }

  if (
    /\b(?:its|that (?:creature|artifact|enchantment|planeswalker|battle|permanent)'s) controller (?:draws?|may draw)\b/.test(
      text,
    )
  ) {
    penalty += 0.12;
  }

  if (
    /\b(?:its|that (?:creature|artifact|enchantment|planeswalker|battle|permanent)'s) controller gains?\b[^.]{0,80}\blife\b/.test(
      text,
    )
  ) {
    penalty += 0.07;
  }

  if (
    /\b(?:its|that (?:creature|artifact|enchantment|planeswalker|battle|permanent)'s) owner\b[^.]{0,180}\b(?:reveals?|puts?)\b[^.]{0,220}\bonto the battlefield\b/.test(
      text,
    ) ||
    /\breveals? the top card of (?:their|his or her) library\b[\s\S]{0,220}\bputs? (?:that card|it)\b[^.]{0,80}\bonto the battlefield\b/.test(
      text,
    )
  ) {
    penalty += 0.14;
  }

  return Math.min(0.22, penalty);
}

function hasRemovalAction(text: string) {
  return (
    /\b(?:destroy|exile)\b[^.]{0,160}\btarget\b/.test(text) ||
    /\bthe owner of target permanent\b[^.]{0,120}\bshuffles? it\b/.test(text) ||
    /\btarget permanent\b[^.]{0,120}\bshuffles? (?:it|itself)\b/.test(text)
  );
}

function hasLargeCompensationToken(text: string) {
  return /\b(?:3\/3|4\/4|5\/5|x\/x)\b/.test(text);
}

function estimateManaSymbols(costText: string) {
  return [...costText.matchAll(/\{([^}]+)\}/g)].reduce((sum, match) => {
    const symbol = match[1]?.toLowerCase() ?? "";

    if (symbol === "t" || symbol === "q" || symbol === "e") {
      return sum;
    }

    if (symbol === "x") {
      return sum + 2;
    }

    const generic = Number(symbol);
    if (Number.isFinite(generic)) {
      return sum + generic;
    }

    if (/[wubrgc]/.test(symbol)) {
      return sum + 1;
    }

    return sum;
  }, 0);
}
