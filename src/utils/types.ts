export type Category = {
  id: string;
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
};

export type QuestRepeat = "once" | "daily" | "weekdays" | "weekly";

export type QuestCompletionReceipt = {
  dateKey: string;
  completedAt: string;
  awardedXp: number;
  categoryBefore: Category;
  unlockedAchievementIds: string[];
};

export type Quest = {
  id: string;
  title: string;
  categoryId: string;
  xp: number;
  target?: string;
  difficulty: "easy" | "medium" | "hard";
  repeat?: QuestRepeat;
  scheduledWeekday?: number;
  scheduledDate?: string;
  done: boolean;
  pinned: boolean;
  contract?: boolean;
  paused?: boolean;
  completionReceipt?: QuestCompletionReceipt;
};

export type ArchivedQuest = Quest & {
  archivedAt: string;
};

export type QuestTemplate = {
  id: string;
  title: string;
  categoryId: string;
  xp: number;
  target: string;
  difficulty: Quest["difficulty"];
  repeat?: QuestRepeat;
  scheduledWeekday?: number;
  contract?: boolean;
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null; // ISO date when unlocked
};

export type DrHistoryEntry = {
  date: string;
  dr: number;
  delta: number;
  pct: number;
  title?: string;
  contractCompletedCount?: number;
  contractTotalCount?: number;
  comebackBonus?: number;
  recoveryDay?: boolean;
};

export type DailyReflection = {
  date: string;
  note: string;
  updatedAt: string;
};

export type RankPromotionRecord = {
  id: string;
  date: string;
  unlockedAt: string;
  fromRank: string;
  rank: string;
  drBefore: number;
  drAfter: number;
  drGained: number;
  dayScore: number;
  streak: number;
  strongestCategory?: string;
  contractCompletedCount: number;
  contractTotalCount: number;
};

export type StoredState = {
  categories: Category[];
  quests: Quest[];
  disciplineRating: number;
  lastDrDelta: number;
  lastCompletionPct: number;
  lastDrUpdateDate: string;
  drHistory: DrHistoryEntry[];
  lastResetDate: string;
  achievements: Achievement[];
  equippedBadgeIds?: (string | null)[];
  lifetimeCompletedQuestCount: number;
  archivedQuests: ArchivedQuest[];
  dailyReflections?: DailyReflection[];
  recoveryDays?: string[];
  rankPromotions?: RankPromotionRecord[];
};

export const STORAGE_KEY = "lifeRpg:v1";
export const ONBOARDING_STORAGE_KEY = "hasSeenOnboarding";
