export const TAG_STAT_ALIASES: Record<string, string> = {
  draw: "Draw",
  card_draw: "Draw",
  direct_draw: "Draw",
  repeatable_draw: "Repeatable Draw",
  repeatable_advantage: "Repeatable Draw",
  card_selection: "Selection",
  selection: "Selection",
  card_flow: "Card Flow",
};

export function normalizeTagStatAlias(tag: string) {
  const normalizedTag = tag
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  return TAG_STAT_ALIASES[normalizedTag] ?? tag;
}
