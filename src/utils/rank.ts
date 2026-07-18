export type DisciplineRank =
  | "Foundation"
  | "Consistent"
  | "Focused"
  | "Driven"
  | "Relentless"
  | "Elite"
  | "Grand Discipline";

type RankThreshold = {
  name: DisciplineRank;
  minDr: number;
  maxDr: number;
  tier: number;
};

export const DR_RANK_THRESHOLDS: RankThreshold[] = [
  { name: "Foundation", minDr: 0, maxDr: 99, tier: 1 },
  { name: "Consistent", minDr: 100, maxDr: 249, tier: 2 },
  { name: "Focused", minDr: 250, maxDr: 499, tier: 3 },
  { name: "Driven", minDr: 500, maxDr: 799, tier: 4 },
  { name: "Relentless", minDr: 800, maxDr: 1199, tier: 5 },
  { name: "Elite", minDr: 1200, maxDr: 1599, tier: 6 },
  { name: "Grand Discipline", minDr: 1600, maxDr: Number.POSITIVE_INFINITY, tier: 7 },
];

export function getRankMeta(rank: DisciplineRank): RankThreshold {
  return DR_RANK_THRESHOLDS.find((entry) => entry.name === rank) ?? DR_RANK_THRESHOLDS[0];
}

export function getRankFromDR(dr: number): DisciplineRank {
  const safeDr = Number.isFinite(dr) ? Math.max(0, Math.floor(dr)) : 0;
  for (let i = DR_RANK_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    const threshold = DR_RANK_THRESHOLDS[i];
    if (safeDr >= threshold.minDr) {
      return threshold.name;
    }
  }
  return "Foundation";
}

export function getNextRank(dr: number): { name: DisciplineRank; remainingDr: number } | null {
  const safeDr = Number.isFinite(dr) ? Math.max(0, Math.floor(dr)) : 0;
  const next = DR_RANK_THRESHOLDS.find((rank) => rank.minDr > safeDr);
  if (!next) return null;
  return {
    name: next.name,
    remainingDr: next.minDr - safeDr,
  };
}
