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
};

export const DR_RANK_THRESHOLDS: RankThreshold[] = [
  { name: "Foundation", minDr: 0 },
  { name: "Consistent", minDr: 100 },
  { name: "Focused", minDr: 250 },
  { name: "Driven", minDr: 500 },
  { name: "Relentless", minDr: 800 },
  { name: "Elite", minDr: 1200 },
  { name: "Grand Discipline", minDr: 1600 },
];

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

export function getRankEmoji(rank: DisciplineRank): string {
  switch (rank) {
    case "Foundation":
      return "🌱";
    case "Consistent":
      return "✅";
    case "Focused":
      return "🎯";
    case "Driven":
      return "🚀";
    case "Relentless":
      return "⚔️";
    case "Elite":
      return "👑";
    case "Grand Discipline":
      return "🔥";
    default:
      return "🌱";
  }
}
