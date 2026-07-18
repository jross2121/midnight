import { questTemplates } from "./defaultData";
import { getQuestXpForDifficulty } from "./questXp";
import type { Quest } from "./types";

export const ONBOARDING_STARTER_IDS = [
  "walk_20",
  "reset_room",
  "inbox_zero_10",
  "budget_check",
  "message_someone",
  "real_rest",
] as const;

export const DEFAULT_ONBOARDING_STARTER_IDS: string[] = [
  "walk_20",
  "reset_room",
  "inbox_zero_10",
];

export const MIN_ONBOARDING_STARTERS = 2;
export const MAX_ONBOARDING_STARTERS = 3;

export function buildOnboardingStarterQuests(
  selectedIds: readonly string[],
  createdAt = Date.now()
): Quest[] {
  const allowedIds = new Set<string>(ONBOARDING_STARTER_IDS);
  const uniqueIds = Array.from(new Set(selectedIds))
    .filter((id) => allowedIds.has(id))
    .slice(0, MAX_ONBOARDING_STARTERS);

  return uniqueIds.flatMap((id, index) => {
    const template = questTemplates.find((item) => item.id === id);
    if (!template) return [];

    return [{
      id: `onboarding-${createdAt}-${index}-${template.id}`,
      title: template.title,
      categoryId: template.categoryId,
      xp: getQuestXpForDifficulty(template.difficulty),
      target: template.target,
      difficulty: template.difficulty,
      repeat: "once" as const,
      done: false,
      pinned: false,
      contract: false,
      paused: false,
    }];
  });
}
