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

export type Streak = {
  current: number;
  best: number;
  lastDate: string | null;
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null; // ISO date when unlocked
};

export type StoredState = {
  categories: Category[];
  quests: Quest[];
  lastResetDate: string;
  streakAny: Streak;
  streakPerfect: Streak;
  achievements: Achievement[];
};

export const STORAGE_KEY = "lifeRpg:v1";
