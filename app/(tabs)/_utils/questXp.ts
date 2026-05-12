import type { Quest } from "./types";

export const QUEST_XP_BY_DIFFICULTY: Record<Quest["difficulty"], number> = {
  easy: 10,
  medium: 20,
  hard: 30,
};

export function getQuestXpForDifficulty(difficulty: Quest["difficulty"]): number {
  return QUEST_XP_BY_DIFFICULTY[difficulty] ?? QUEST_XP_BY_DIFFICULTY.easy;
}
