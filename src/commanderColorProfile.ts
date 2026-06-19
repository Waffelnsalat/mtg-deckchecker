import { ResolvedDeckCard } from "./types";

export interface CommanderColorProfile {
  colors: string[];
  colorCount: number;
  hasWhite: boolean;
  hasBlue: boolean;
  hasBlack: boolean;
  hasRed: boolean;
  hasGreen: boolean;
  isColorless: boolean;
  isMonoColor: boolean;
}

export function getCommanderColorProfile(cards: ResolvedDeckCard[]): CommanderColorProfile {
  const colors = [...new Set(
    cards
      .filter((card) => card.section === "commander")
      .flatMap((card) => card.card.color_identity ?? []),
  )];

  return {
    colors,
    colorCount: colors.length,
    hasWhite: colors.includes("W"),
    hasBlue: colors.includes("U"),
    hasBlack: colors.includes("B"),
    hasRed: colors.includes("R"),
    hasGreen: colors.includes("G"),
    isColorless: colors.length === 0,
    isMonoColor: colors.length === 1,
  };
}
