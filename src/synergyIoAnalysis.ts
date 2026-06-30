import { getCardOracleText, hasCardType, normalizeText } from "./advancedCardScan";
import {
  DeckResolutionDocument,
  DeckSection,
  DeckSynergyIoAnalysis,
  CommanderSynergyIoAnalysis,
  ScryfallCard,
  SynergyIoAtom,
  SynergyIoDomain,
  SynergyIoKind,
  SynergyIoPackage,
} from "./types";

const DOMAIN_LABELS: Record<SynergyIoDomain, string> = {
  graveyard: "Graveyard",
  sacrifice: "Sacrifice / Death",
  spells: "Spell Cast",
  tokens: "Tokens",
  counters: "Counters",
  lifegain: "Lifegain",
  kindred: "Kindred / Type",
  artifacts: "Artifacts",
  enchantments: "Enchantments",
  discard: "Discard",
  combat: "Combat / Attack",
  timing: "Timing",
  resources: "Resources",
  protection: "Protection / Setup",
};

const DOMAIN_ORDER: SynergyIoDomain[] = [
  "graveyard",
  "sacrifice",
  "spells",
  "tokens",
  "counters",
  "lifegain",
  "kindred",
  "artifacts",
  "enchantments",
  "discard",
  "combat",
  "timing",
  "resources",
  "protection",
];

export function analyzeDeckSynergyIo(document: DeckResolutionDocument): DeckSynergyIoAnalysis {
  const taggedCards = document.result.resolvedCards
    .filter((entry) => entry.section === "commander" || entry.section === "mainboard" || entry.section === "companion")
    .map((entry) => {
      const atoms = inferSynergyIoAtoms(entry.card);

      if (atoms.length === 0) {
        return null;
      }

      return {
        name: entry.card.name,
        quantity: entry.quantity,
        section: entry.section,
        synergyValue: roundTo(Math.min(2.4, atoms.reduce((sum, atom) => sum + atom.weight, 0)), 2),
        atoms,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const packages = DOMAIN_ORDER.map((domain) => summarizeDomain(domain, taggedCards))
    .filter((entry) => entry.inputs > 0 || entry.outputs > 0 || entry.payoffs > 0 || entry.frictions > 0)
    .sort((left, right) => right.score - left.score || DOMAIN_ORDER.indexOf(left.domain) - DOMAIN_ORDER.indexOf(right.domain));
  const commanderSynergy = summarizeCommanderSynergy(taggedCards);

  return {
    summary: summarizePackages(packages),
    packages,
    commanderSynergy,
    taggedCards,
  };
}

export function inferSynergyIoAtoms(card: ScryfallCard): SynergyIoAtom[] {
  const text = getCardOracleText(card);
  const typeLine = normalizeText(card.type_line);
  const atoms: SynergyIoAtom[] = [];

  detectGraveyardAtoms(atoms, text);
  detectSacrificeAtoms(atoms, text);
  detectSpellAtoms(atoms, text, card);
  detectTokenAtoms(atoms, text);
  detectCounterAtoms(atoms, text);
  detectLifegainAtoms(atoms, text);
  detectKindredAtoms(atoms, text, typeLine);
  detectArtifactAtoms(atoms, text, card);
  detectEnchantmentAtoms(atoms, text, card);
  detectDiscardAtoms(atoms, text);
  detectCombatAtoms(atoms, text, card);
  detectTimingAtoms(atoms, text);
  detectResourceAtoms(atoms, text);
  detectProtectionAtoms(atoms, text);

  if (/\bflashback\b|\bjump-start\b|\bretrace\b|\bescape\b|\bdisturb\b|\bunearth\b|\bembalm\b|\beternalize\b|\bencore\b/.test(text)) {
    addAtom(atoms, "graveyard", "output", "self_graveyard_use", 0.58, "Card can use itself from the graveyard.");
  }

  if (/\bcreature\b/.test(typeLine) && /\bwhen(?:ever)? this creature dies\b/.test(text)) {
    addAtom(atoms, "sacrifice", "input", "self_death_trigger", 0.44, "Card has its own death trigger.");
  }

  return atoms.sort((left, right) =>
    DOMAIN_ORDER.indexOf(left.domain) - DOMAIN_ORDER.indexOf(right.domain) ||
    kindOrder(left.kind) - kindOrder(right.kind) ||
    right.weight - left.weight ||
    left.tag.localeCompare(right.tag),
  );
}

function detectGraveyardAtoms(atoms: SynergyIoAtom[], text: string) {
  if (/\bwhenever\b[^.]{0,140}\bcards? leave(?:s)? your graveyard\b|\bwhenever one or more cards leave your graveyard\b/.test(text)) {
    addAtom(atoms, "graveyard", "input", "graveyard_leave_trigger", 0.74, "Triggers when cards leave your graveyard.");
    if (hasValueAfterTrigger(text)) {
      addAtom(atoms, "graveyard", "payoff", "graveyard_leave_payoff", 0.72, "Turns cards leaving your graveyard into value.");
    }
  }

  if (/\bwhenever\b[^.]{0,160}\b(?:cast|play)\b[^.]{0,80}\bfrom your graveyard\b/.test(text)) {
    addAtom(atoms, "graveyard", "input", "graveyard_cast_trigger", 0.66, "Triggers when you cast or play cards from your graveyard.");
    if (hasValueAfterTrigger(text)) {
      addAtom(atoms, "graveyard", "payoff", "graveyard_cast_payoff", 0.64, "Rewards casting or playing cards from your graveyard.");
    }
  }

  if (/\b(?:return|put)\b[^.]{0,120}\b(?:card|creature|permanent|artifact|enchantment|instant|sorcery|land) card\b[^.]{0,100}\bfrom your graveyard\b[^.]{0,100}\b(?:to your hand|into your hand)\b/.test(text)) {
    addAtom(atoms, "graveyard", "output", "return_graveyard_to_hand", 0.7, "Moves cards from your graveyard to your hand.");
  }

  if (/\b(?:return|put)\b[^.]{0,120}\b(?:card|creature|permanent|artifact|enchantment|land) card\b[^.]{0,100}\bfrom your graveyard\b[^.]{0,120}\b(?:to the battlefield|onto the battlefield)\b/.test(text)) {
    addAtom(atoms, "graveyard", "output", "return_graveyard_to_battlefield", 0.82, "Moves cards from your graveyard to the battlefield.");
  }

  if (/\byou may (?:cast|play)\b[^.]{0,140}\bfrom your graveyard\b|\byou may cast this card from your graveyard\b/.test(text)) {
    addAtom(atoms, "graveyard", "output", "cast_from_graveyard", 0.66, "Lets you cast or play cards from your graveyard.");
  }

  if (/\bexile\b[^.]{0,120}\b(?:card|cards) from your graveyard\b|\bexile\b[^.]{0,120}\byour graveyard\b/.test(text)) {
    addAtom(atoms, "graveyard", "output", "graveyard_exile_output", 0.48, "Moves cards out of your graveyard.");
  }

  if (/\bmill (?:a card|one|two|three|four|five|six|seven|eight|nine|ten|\d+|x) cards?\b|\bput\b[^.]{0,100}\btop\b[^.]{0,100}\bof your library into your graveyard\b/.test(text)) {
    addAtom(atoms, "graveyard", "output", "self_mill_output", 0.54, "Fills your graveyard from your library.");
  }

  if (/\bdiscard (?:a|one|two|three|\d+|x) cards?\b|\bdiscard your hand\b/.test(text)) {
    addAtom(atoms, "graveyard", "output", "discard_to_graveyard_output", 0.42, "Moves cards from hand toward the graveyard.");
  }
}

function detectSacrificeAtoms(atoms: SynergyIoAtom[], text: string) {
  if (/\bwhenever\b[^.]{0,160}\b(?:creature|permanent|artifact|token|nontoken creature)s? (?:you control )?(?:dies|die|is put into your graveyard|are put into your graveyard)\b/.test(text)) {
    addAtom(atoms, "sacrifice", "input", "death_trigger", 0.74, "Triggers when your material dies.");
    if (hasValueAfterTrigger(text)) {
      addAtom(atoms, "sacrifice", "payoff", "death_payoff", 0.74, "Turns deaths into value.");
    }
  }

  if (/\bwhenever\b[^.]{0,160}\byou sacrifice\b/.test(text)) {
    addAtom(atoms, "sacrifice", "input", "sacrifice_trigger", 0.72, "Triggers when you sacrifice material.");
    if (hasValueAfterTrigger(text)) {
      addAtom(atoms, "sacrifice", "payoff", "sacrifice_payoff", 0.72, "Rewards sacrificing material.");
    }
  }

  if (/\bsacrifice (?:a|an|another|one or more|any number of)? ?(?:creature|artifact|enchantment|permanent|token|clue|food|blood|treasure)\b[^.]{0,120}:/.test(text)) {
    addAtom(atoms, "sacrifice", "output", "sacrifice_outlet", 0.82, "Provides a sacrifice outlet.");
  }

  if (/\bas an additional cost\b[^.]{0,160}\bsacrifice\b|\bsacrifice (?:a|an|another|one or more) (?:creature|artifact|permanent|token)\b/.test(text)) {
    addAtom(atoms, "sacrifice", "output", "sacrifice_output", 0.58, "Causes you to sacrifice material.");
  }
}

function detectSpellAtoms(atoms: SynergyIoAtom[], text: string, card: ScryfallCard) {
  if (/\bwhenever\b[^.]{0,180}\byou cast\b[^.]{0,120}\b(?:instant|sorcery|noncreature|artifact|enchantment|spell|second spell)\b/.test(text)) {
    addAtom(atoms, "spells", "input", "spell_cast_trigger", 0.72, "Triggers from casting spells.");
    if (hasValueAfterTrigger(text)) {
      addAtom(atoms, "spells", "payoff", "spell_cast_payoff", 0.72, "Turns spell casts into value.");
    }
  }

  if (/\bwhenever you cast your second spell\b|\bif (?:it'?s|this is) the second spell\b/.test(text)) {
    addAtom(atoms, "spells", "input", "second_spell_trigger", 0.68, "Cares about the second spell each turn.");
  }

  if (hasCardType(card, "Instant") || hasCardType(card, "Sorcery")) {
    addAtom(atoms, "spells", "output", "instant_sorcery_spell", 0.3, "Provides instant or sorcery spell density.");
  }

  if (/\bcopy\b[^.]{0,120}\b(?:instant|sorcery|spell)\b|\bstorm\b|\breplicate\b|\bcopy that spell\b/.test(text)) {
    addAtom(atoms, "spells", "payoff", "spell_copy_payoff", 0.62, "Copies or multiplies spells.");
  }
}

function detectTokenAtoms(atoms: SynergyIoAtom[], text: string) {
  if (/\bwhenever\b[^.]{0,180}\b(?:create|created)\b[^.]{0,80}\btokens?\b|\bwhenever\b[^.]{0,160}\btokens? enters?\b/.test(text)) {
    addAtom(atoms, "tokens", "input", "token_creation_trigger", 0.68, "Triggers from token creation or token entries.");
    if (hasValueAfterTrigger(text)) {
      addAtom(atoms, "tokens", "payoff", "token_creation_payoff", 0.66, "Rewards creating tokens.");
    }
  }

  if (/\bcreate (?:a|an|one|two|three|four|five|six|\d+|x)\b[^.]{0,120}\btokens?\b|\bpopulate\b|\bamass\b|\bincubate\b/.test(text)) {
    addAtom(atoms, "tokens", "output", "token_creation_output", 0.66, "Creates tokens.");
  }

  if (/\btokens? you control\b[^.]{0,140}\b(?:get|gain|have|deal|can'?t be blocked)\b|\bcreature tokens? you control\b[^.]{0,140}\b(?:get|gain|have)\b/.test(text)) {
    addAtom(atoms, "tokens", "payoff", "token_board_payoff", 0.62, "Improves or rewards token boards.");
  }
}

function detectCounterAtoms(atoms: SynergyIoAtom[], text: string) {
  if (/\bwhenever\b[^.]{0,180}\b(?:counters? (?:are|is) put|put one or more counters?)\b/.test(text)) {
    addAtom(atoms, "counters", "input", "counter_placed_trigger", 0.7, "Triggers when counters are placed.");
    if (hasValueAfterTrigger(text)) {
      addAtom(atoms, "counters", "payoff", "counter_placed_payoff", 0.68, "Rewards putting counters on permanents.");
    }
  }

  if (/\bput (?:a|an|one|two|three|four|five|six|\d+|x)\s+\+1\/\+1 counters?\b|\bput\b[^.]{0,80}\bcounters?\b[^.]{0,80}\bon\b|\bproliferate\b/.test(text)) {
    addAtom(atoms, "counters", "output", "counter_placement_output", 0.66, "Places or grows counters.");
  }

  if (/\b(?:creatures?|permanents?) you control with counters? on them\b[^.]{0,140}\b(?:get|gain|have|can'?t|draw|create)\b/.test(text)) {
    addAtom(atoms, "counters", "payoff", "counter_board_payoff", 0.62, "Rewards permanents that already have counters.");
  }
}

function detectLifegainAtoms(atoms: SynergyIoAtom[], text: string) {
  if (/\bwhenever\b[^.]{0,160}\byou gain life\b/.test(text)) {
    addAtom(atoms, "lifegain", "input", "lifegain_trigger", 0.72, "Triggers when you gain life.");
    if (hasValueAfterTrigger(text)) {
      addAtom(atoms, "lifegain", "payoff", "lifegain_payoff", 0.72, "Turns lifegain into value.");
    }
  }

  if (/\byou gain (?:\d+|x|that much|life equal to|one|two|three|four|five|six)\b|\blifelink\b|\bextort\b/.test(text)) {
    addAtom(atoms, "lifegain", "output", "lifegain_output", 0.58, "Causes you to gain life.");
  }

  if (/\bwhenever\b[^.]{0,160}\byou gain life\b[^.]{0,180}\b(?:put|draw|create|each opponent loses|target opponent loses)\b/.test(text)) {
    addAtom(atoms, "lifegain", "payoff", "lifegain_value_payoff", 0.7, "Pays you for lifegain triggers.");
  }
}

function detectKindredAtoms(atoms: SynergyIoAtom[], text: string, typeLine: string) {
  if (/\bcreature\b/.test(typeLine) && !/\btoken\b/.test(typeLine)) {
    addAtom(atoms, "kindred", "output", "creature_type_material", 0.28, "Provides creature type material.");
  }

  if (/\b(?:choose|chosen) a creature type\b|\bcreatures? you control of the chosen type\b/.test(text)) {
    addAtom(atoms, "kindred", "input", "chosen_type_input", 0.56, "Cares about a chosen creature type.");
  }

  if (/\bwhenever\b[^.]{0,180}\b(?:creature|goblin|elf|zombie|human|vampire|dragon|wizard|soldier|sliver|merfolk|dinosaur|cat|rat|spirit|cleric|rogue|warrior|pirate|knight)s? (?:you control )?(?:enters?|attacks?|dies|cast)\b/.test(text)) {
    addAtom(atoms, "kindred", "input", "type_event_trigger", 0.64, "Triggers from a creature type event.");
    if (hasValueAfterTrigger(text)) {
      addAtom(atoms, "kindred", "payoff", "type_event_payoff", 0.62, "Rewards creature type events.");
    }
  }

  if (/\b(?:goblin|elf|zombie|human|vampire|dragon|wizard|soldier|sliver|merfolk|dinosaur|cat|rat|spirit|cleric|rogue|warrior|pirate|knight)s? you control\b[^.]{0,140}\b(?:get|gain|have|cost|create|draw)\b|\bcreatures? you control of the chosen type\b[^.]{0,140}\b(?:get|gain|have)\b/.test(text)) {
    addAtom(atoms, "kindred", "payoff", "type_board_payoff", 0.66, "Rewards a specific creature type board.");
  }

  if (/\bchangeling\b|\bevery creature type\b/.test(text)) {
    addAtom(atoms, "kindred", "output", "all_types_material", 0.58, "Provides all creature types.");
  }
}

function detectArtifactAtoms(atoms: SynergyIoAtom[], text: string, card: ScryfallCard) {
  if (hasCardType(card, "Artifact")) {
    addAtom(atoms, "artifacts", "output", "artifact_material", 0.34, "Provides artifact material.");
  }

  if (/\bwhenever\b[^.]{0,180}\b(?:artifact|treasure|clue|food|blood|map)s? (?:enters?|is put|dies|you control)\b|\bwhenever you cast an artifact\b/.test(text)) {
    addAtom(atoms, "artifacts", "input", "artifact_event_trigger", 0.66, "Triggers from artifact events.");
    if (hasValueAfterTrigger(text)) {
      addAtom(atoms, "artifacts", "payoff", "artifact_event_payoff", 0.64, "Rewards artifact events.");
    }
  }

  if (/\bcreate (?:a|an|one|two|three|four|five|six|\d+|x)\b[^.]{0,120}\b(?:treasure|clue|food|blood|map|artifact) tokens?\b/.test(text)) {
    addAtom(atoms, "artifacts", "output", "artifact_token_output", 0.62, "Creates artifact tokens.");
    addAtom(atoms, "resources", "output", "artifact_resource_output", 0.46, "Creates spendable artifact resources.");
  }

  if (/\bartifacts? you control\b[^.]{0,160}\b(?:get|gain|have|cost|tap|untap|draw|deal|create)\b|\baffinity for artifacts\b|\bimprovise\b|\bmetalcraft\b/.test(text)) {
    addAtom(atoms, "artifacts", "payoff", "artifact_board_payoff", 0.64, "Rewards artifact density.");
  }
}

function detectEnchantmentAtoms(atoms: SynergyIoAtom[], text: string, card: ScryfallCard) {
  if (hasCardType(card, "Enchantment")) {
    addAtom(atoms, "enchantments", "output", "enchantment_material", 0.34, "Provides enchantment material.");
  }

  if (/\bwhenever\b[^.]{0,180}\b(?:enchantment|aura|saga)s? (?:enters?|is put|you cast|you control)\b|\bconstellation\b|\beerie\b/.test(text)) {
    addAtom(atoms, "enchantments", "input", "enchantment_event_trigger", 0.66, "Triggers from enchantment events.");
    if (hasValueAfterTrigger(text)) {
      addAtom(atoms, "enchantments", "payoff", "enchantment_event_payoff", 0.64, "Rewards enchantment events.");
    }
  }

  if (/\benchant\b|\baura\b|\bbestow\b|\bsaga\b|\brole token\b/.test(text)) {
    addAtom(atoms, "enchantments", "output", "enchantment_subtype_output", 0.42, "Provides Aura, Saga, Role, or enchantment material.");
  }

  if (/\benchantments? you control\b[^.]{0,160}\b(?:get|gain|have|cost|draw|create|copy)\b|\benchantment spells? you cast\b[^.]{0,120}\bcost\b/.test(text)) {
    addAtom(atoms, "enchantments", "payoff", "enchantment_board_payoff", 0.62, "Rewards enchantment density.");
  }
}

function detectDiscardAtoms(atoms: SynergyIoAtom[], text: string) {
  if (/\bwhenever\b[^.]{0,180}\b(?:you discard|a player discards|an opponent discards)\b/.test(text)) {
    addAtom(atoms, "discard", "input", "discard_trigger", 0.68, "Triggers from discard events.");
    if (hasValueAfterTrigger(text)) {
      addAtom(atoms, "discard", "payoff", "discard_payoff", 0.66, "Rewards discard events.");
    }
  }

  if (/\bdiscard (?:a|one|two|three|four|five|six|\d+|x) cards?\b|\bdiscard your hand\b|\bas an additional cost\b[^.]{0,120}\bdiscard\b/.test(text)) {
    addAtom(atoms, "discard", "output", "self_discard_output", 0.58, "Creates discard material.");
  }

  if (/\btarget opponent\b[^.]{0,120}\bdiscards?\b|\beach opponent\b[^.]{0,120}\bdiscards?\b|\beach player\b[^.]{0,120}\bdiscards?\b/.test(text)) {
    addAtom(atoms, "discard", "output", "opponent_discard_output", 0.52, "Makes opponents discard cards.");
  }

  if (/\bmadness\b|\bwhen you discard this card\b/.test(text)) {
    addAtom(atoms, "discard", "payoff", "discard_self_payoff", 0.56, "Benefits from being discarded.");
  }
}

function detectCombatAtoms(atoms: SynergyIoAtom[], text: string, card: ScryfallCard) {
  if (hasCardType(card, "Creature")) {
    addAtom(atoms, "combat", "output", "combat_body_output", 0.28, "Provides a combat body.");
  }

  if (/\bwhenever\b[^.]{0,180}\b(?:attacks?|attack|deals combat damage|one or more creatures you control deal combat damage)\b/.test(text)) {
    addAtom(atoms, "combat", "input", "attack_damage_trigger", 0.66, "Triggers from attacking or combat damage.");
    if (hasValueAfterTrigger(text)) {
      addAtom(atoms, "combat", "payoff", "combat_damage_payoff", 0.64, "Rewards attacking or combat damage.");
    }
  }

  if (/\bcreatures? you control\b[^.]{0,140}\b(?:get|gain|have|can'?t be blocked|must be blocked)\b|\bextra combat phase\b|\badditional combat phase\b/.test(text)) {
    addAtom(atoms, "combat", "payoff", "combat_board_payoff", 0.62, "Improves combat pressure or creates extra combat.");
  }

  if (/\bcan'?t attack\b|\bcan'?t block\b|\bdefender\b|\bdecayed\b|\battacks each combat if able\b/.test(text)) {
    addAtom(atoms, "combat", "friction", "combat_restriction_friction", 0.4, "Adds a combat restriction or liability.");
  }
}

function detectTimingAtoms(atoms: SynergyIoAtom[], text: string) {
  if (/\bwhenever\b[^.]{0,160}\b(?:beginning of|end step|upkeep|draw step|combat|main phase)\b|\bat the beginning of\b/.test(text)) {
    addAtom(atoms, "timing", "input", "phase_timing_trigger", 0.5, "Uses phase or step timing.");
  }

  if (/\bflash\b|\bas though they had flash\b|\bany time you could cast an instant\b/.test(text)) {
    addAtom(atoms, "timing", "output", "instant_speed_output", 0.56, "Enables instant-speed timing.");
  }

  if (/\bextra turn\b|\badditional upkeep\b|\badditional beginning phase\b|\bextra combat phase\b|\badditional combat phase\b/.test(text)) {
    addAtom(atoms, "timing", "output", "extra_phase_output", 0.74, "Creates extra turns, phases, or combat steps.");
  }

  if (/\bactivate only as a sorcery\b|\bcast only during\b|\bcast this spell only\b|\bonly during your turn\b/.test(text)) {
    addAtom(atoms, "timing", "friction", "timing_restriction_friction", 0.42, "Restricts when the card can be used.");
  }

  if (/\bsuspend\b|\bforetell\b|\bplot\b|\bimpending\b|\bvanishing\b|\bfading\b/.test(text)) {
    addAtom(atoms, "timing", "friction", "timing_delay_friction", 0.36, "Adds delayed access or time-limited play.");
  }
}

function detectResourceAtoms(atoms: SynergyIoAtom[], text: string) {
  if (/\bwhenever\b[^.]{0,180}\b(?:you sacrifice|you discard|you create|treasure|clue|food|blood|tap an untapped)\b/.test(text)) {
    addAtom(atoms, "resources", "input", "resource_event_trigger", 0.54, "Triggers from resource conversion events.");
  }

  if (/\bcreate (?:a|an|one|two|three|four|five|six|\d+|x)\b[^.]{0,120}\b(?:treasure|clue|food|blood|map) tokens?\b|\badd \{[wubrgc]\}/.test(text)) {
    addAtom(atoms, "resources", "output", "resource_generation_output", 0.62, "Generates mana or spendable resource tokens.");
  }

  if (/\b(?:treasure|clue|food|blood|map)s? you control\b[^.]{0,140}\b(?:get|gain|have|cost|deal|draw|create)\b|\bwhenever you sacrifice\b[^.]{0,120}\b(?:treasure|clue|food|blood)\b/.test(text)) {
    addAtom(atoms, "resources", "payoff", "resource_token_payoff", 0.62, "Rewards spendable resource tokens.");
  }

  if (/\bas an additional cost\b[^.]{0,160}\b(?:discard|sacrifice|exile|pay \d+ life)\b|\bcollect evidence\b|\bforage\b|\bcasualty\b|\bbargain\b|\bdelve\b|\bconvoke\b|\bimprovise\b/.test(text)) {
    addAtom(atoms, "resources", "friction", "resource_payment_friction", 0.4, "Requires additional resources to operate.");
  }
}

function detectProtectionAtoms(atoms: SynergyIoAtom[], text: string) {
  if (/\bwhenever\b[^.]{0,180}\bbecomes the target\b|\bward\b/.test(text)) {
    addAtom(atoms, "protection", "input", "targeting_trigger", 0.52, "Cares about targeting or removal pressure.");
  }

  if (/\b(?:hexproof|indestructible|protection from|phase out|phases out|prevent all damage|regenerate|shield counter|can't be countered)\b|\breturn\b[^.]{0,120}\byou control\b[^.]{0,120}\bto its owner's hand\b/.test(text)) {
    addAtom(atoms, "protection", "output", "protection_output", 0.62, "Protects key cards or preserves board material.");
  }

  if (/\bwhenever\b[^.]{0,180}\bbecomes the target\b[^.]{0,180}\b(?:draw|create|copy|put|deal|gain)\b/.test(text)) {
    addAtom(atoms, "protection", "payoff", "targeting_payoff", 0.58, "Rewards targeting or protection play patterns.");
  }

  if (/\bcreatures? you control lose\b|\ball creatures lose\b|\bplayers can'?t gain life\b|\bactivated abilities\b[^.]{0,120}\bcan'?t be activated\b/.test(text)) {
    addAtom(atoms, "protection", "friction", "global_hate_friction", 0.36, "May shut off parts of your own board or plan.");
  }
}

function summarizeDomain(
  domain: SynergyIoDomain,
  taggedCards: Array<{
    name: string;
    quantity: number;
    section: DeckSection;
    synergyValue: number;
    atoms: SynergyIoAtom[];
  }>,
): SynergyIoPackage {
  const atoms = taggedCards.flatMap((card) =>
    card.atoms
      .filter((atom) => atom.domain === domain)
      .map((atom) => ({ ...atom, cardName: card.name, quantity: card.quantity })),
  );
  const inputs = sumKind(atoms, "input");
  const outputs = sumKind(atoms, "output");
  const payoffs = sumKind(atoms, "payoff");
  const frictions = sumKind(atoms, "friction");
  const score = scoreSynergyPackage(inputs, outputs, payoffs, frictions);

  return {
    domain,
    label: DOMAIN_LABELS[domain],
    score,
    inputs: roundTo(inputs, 2),
    outputs: roundTo(outputs, 2),
    payoffs: roundTo(payoffs, 2),
    frictions: roundTo(frictions, 2),
    inputTags: uniqueTags(atoms, "input"),
    outputTags: uniqueTags(atoms, "output"),
    payoffTags: uniqueTags(atoms, "payoff"),
    frictionTags: uniqueTags(atoms, "friction"),
    keyCards: keyCardsForDomain(atoms),
    gaps: describeGaps(inputs, outputs, payoffs, frictions),
  };
}

function scoreSynergyPackage(inputs: number, outputs: number, payoffs: number, frictions = 0) {
  const inputOutputLink = Math.min(inputs, outputs);
  const payoffLink = Math.min(outputs, payoffs);
  const triggerPayoffLink = Math.min(inputs, payoffs);
  const raw =
    inputOutputLink * 1.2 +
    payoffLink * 1.1 +
    triggerPayoffLink * 0.7 +
    Math.max(outputs - 0.5, 0) * 0.18 -
    frictions * 0.28;

  return roundTo(Math.min(10, Math.max(0, raw)), 2);
}

function summarizePackages(packages: SynergyIoPackage[]) {
  const livePackages = packages.filter((entry) => entry.score >= 1.5);

  if (livePackages.length === 0) {
    return "Synergy IO did not find a complete input/output/payoff package yet.";
  }

  const strongest = livePackages.slice(0, 3).map((entry) => `${entry.label} ${entry.score.toFixed(1)}`);
  return `Strongest Synergy IO packages: ${strongest.join(", ")}.`;
}

function summarizeCommanderSynergy(
  taggedCards: Array<{
    name: string;
    quantity: number;
    section: DeckSection;
    synergyValue: number;
    atoms: SynergyIoAtom[];
  }>,
): CommanderSynergyIoAnalysis {
  const commanderCards = taggedCards.filter((card) => card.section === "commander" || card.section === "companion");
  const supportCards = taggedCards.filter((card) => card.section === "mainboard");

  if (commanderCards.length === 0) {
    return {
      score: 0,
      summary: "No commander synergy could be read because no commander atoms were found.",
      matches: [],
      gaps: ["No commander atoms found."],
    };
  }

  const matches = DOMAIN_ORDER.map((domain) => {
    const commanderAtoms = atomsForDomain(commanderCards, domain);
    const supportAtoms = atomsForDomain(supportCards, domain);
    const commanderInputs = sumKind(commanderAtoms, "input");
    const commanderOutputs = sumKind(commanderAtoms, "output");
    const commanderPayoffs = sumKind(commanderAtoms, "payoff");
    const supportInputs = sumKind(supportAtoms, "input");
    const supportOutputs = sumKind(supportAtoms, "output");
    const supportPayoffs = sumKind(supportAtoms, "payoff");
    const commanderAsk = commanderInputs + commanderPayoffs + commanderOutputs * 0.55;
    const supportFit =
      Math.min(commanderInputs + commanderPayoffs, supportOutputs) * 1.25 +
      Math.min(commanderOutputs, supportInputs + supportPayoffs) * 0.9 +
      Math.min(commanderPayoffs, supportInputs) * 0.7;
    const score = roundTo(Math.min(10, supportFit + Math.max(0, commanderAsk - 0.5) * 0.25), 2);
    const gaps = describeCommanderGaps(
      commanderInputs,
      commanderOutputs,
      commanderPayoffs,
      supportInputs,
      supportOutputs,
      supportPayoffs,
    );

    return {
      domain,
      label: DOMAIN_LABELS[domain],
      score,
      commanderInputs: roundTo(commanderInputs, 2),
      commanderOutputs: roundTo(commanderOutputs, 2),
      commanderPayoffs: roundTo(commanderPayoffs, 2),
      supportInputs: roundTo(supportInputs, 2),
      supportOutputs: roundTo(supportOutputs, 2),
      supportPayoffs: roundTo(supportPayoffs, 2),
      keyCommanders: keyCardsForDomain(commanderAtoms),
      keySupportCards: keyCardsForDomain(supportAtoms),
      gaps,
    };
  })
    .filter((match) =>
      match.commanderInputs > 0 ||
      match.commanderOutputs > 0 ||
      match.commanderPayoffs > 0 ||
      match.score > 0,
    )
    .sort((left, right) => right.score - left.score || DOMAIN_ORDER.indexOf(left.domain) - DOMAIN_ORDER.indexOf(right.domain));
  const score = roundTo(Math.min(10, matches.slice(0, 3).reduce((sum, match, index) => sum + match.score * [1, 0.55, 0.3][index], 0)), 2);
  const gaps = matches.flatMap((match) => match.gaps.map((gap) => `${match.label}: ${gap}`)).slice(0, 6);

  return {
    score,
    summary: summarizeCommanderMatches(matches, score),
    matches,
    gaps,
  };
}

function atomsForDomain(
  cards: Array<{
    name: string;
    quantity: number;
    atoms: SynergyIoAtom[];
  }>,
  domain: SynergyIoDomain,
) {
  return cards.flatMap((card) =>
    card.atoms
      .filter((atom) => atom.domain === domain)
      .map((atom) => ({ ...atom, cardName: card.name, quantity: card.quantity })),
  );
}

function summarizeCommanderMatches(
  matches: CommanderSynergyIoAnalysis["matches"],
  score: number,
) {
  const live = matches.filter((match) => match.score >= 0.8).slice(0, 3);

  if (live.length === 0) {
    return "Commander synergy has visible asks, but the main deck does not strongly support them yet.";
  }

  return `Commander synergy ${score.toFixed(1)}/10, led by ${live.map((match) => `${match.label} ${match.score.toFixed(1)}`).join(", ")}.`;
}

function describeCommanderGaps(
  commanderInputs: number,
  commanderOutputs: number,
  commanderPayoffs: number,
  supportInputs: number,
  supportOutputs: number,
  supportPayoffs: number,
) {
  const gaps: string[] = [];

  if (commanderInputs + commanderPayoffs > 0.5 && supportOutputs < 0.5) {
    gaps.push("Commander listens for this event, but the 99 creates it lightly.");
  }

  if (commanderOutputs > 0.5 && supportInputs + supportPayoffs < 0.5) {
    gaps.push("Commander creates this material, but the 99 has few listeners or payoffs.");
  }

  if (commanderPayoffs > 0.5 && supportInputs < 0.5) {
    gaps.push("Commander payoff has few matching triggers/enablers in the 99.");
  }

  return gaps;
}

function sumKind(atoms: Array<SynergyIoAtom & { quantity: number }>, kind: SynergyIoKind) {
  return atoms
    .filter((atom) => atom.kind === kind)
    .reduce((sum, atom) => sum + atom.weight * atom.quantity, 0);
}

function uniqueTags(atoms: SynergyIoAtom[], kind: SynergyIoKind) {
  return [...new Set(atoms.filter((atom) => atom.kind === kind).map((atom) => atom.tag))].sort();
}

function keyCardsForDomain(atoms: Array<SynergyIoAtom & { cardName: string; quantity: number }>) {
  const values = new Map<string, number>();

  for (const atom of atoms) {
    values.set(atom.cardName, (values.get(atom.cardName) ?? 0) + atom.weight * atom.quantity);
  }

  return [...values.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([name]) => name);
}

function describeGaps(inputs: number, outputs: number, payoffs: number, frictions = 0) {
  const gaps: string[] = [];

  if (inputs > 0.5 && outputs < 0.5) {
    gaps.push("Has triggers/listeners, but few cards that create the event.");
  }

  if (outputs > 0.5 && inputs < 0.5 && payoffs < 0.5) {
    gaps.push("Creates the event, but has few cards that listen to or reward it.");
  }

  if ((inputs > 0.5 || outputs > 0.5) && payoffs < 0.5) {
    gaps.push("Has setup pieces, but payoff density looks thin.");
  }

  if (frictions > 0.8) {
    gaps.push("Contains restriction or friction pieces that may work against this package.");
  }

  return gaps;
}

function hasValueAfterTrigger(text: string) {
  return /\bwhenever\b[^.]{0,260}\b(?:draw|create|gain|loses? life|deals? damage|put|add|copy|return|exile|treasure|clue|food|counter)\b/.test(text);
}

function addAtom(
  atoms: SynergyIoAtom[],
  domain: SynergyIoDomain,
  kind: SynergyIoKind,
  tag: string,
  weight: number,
  reason: string,
) {
  const existing = atoms.find((atom) => atom.domain === domain && atom.kind === kind && atom.tag === tag);

  if (existing) {
    existing.weight = roundTo(Math.max(existing.weight, weight), 2);
    return;
  }

  atoms.push({
    domain,
    kind,
    tag,
    weight: roundTo(weight, 2),
    reason,
  });
}

function kindOrder(kind: SynergyIoKind) {
  switch (kind) {
    case "input":
      return 0;
    case "output":
      return 1;
    case "payoff":
      return 2;
    case "friction":
      return 3;
  }
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
