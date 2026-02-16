import type { Category } from "./types";

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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
