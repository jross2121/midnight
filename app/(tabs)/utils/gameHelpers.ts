import type { Category } from "./types";

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function getStreakMultiplier(streakDays: number) {
  if (streakDays < 3) return 1;
  if (streakDays < 7) return 1.1;
  if (streakDays < 14) return 1.2;
  if (streakDays < 30) return 1.35;
  return 1.5; // Cap at 50% bonus for 30+ day streaks
}

export function levelUp(cat: Category) {
  let { level, xp, xpToNext } = cat;
  while (xp >= xpToNext) {
    xp -= xpToNext;
    level += 1;
    xpToNext = Math.round(xpToNext * 1.15 + 25);
  }
  return { ...cat, level, xp, xpToNext };
}
