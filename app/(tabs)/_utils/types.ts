export type Category = {
  id: string;
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
};

export type Quest = {
  id: string;
  title: string;
  categoryId: string;
  xp: number;
  difficulty: "easy" | "medium" | "hard";
  done: boolean;
  pinned: boolean;
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
};

export const STORAGE_KEY = "lifeRpg:v1";
