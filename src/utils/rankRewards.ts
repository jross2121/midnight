import { DR_RANK_THRESHOLDS, type DisciplineRank } from "./rank";
import type { RankPromotionRecord } from "./types";

export type RankReward = {
  rank: DisciplineRank;
  title: string;
  description: string;
};

export const RANK_REWARDS: RankReward[] = [
  {
    rank: "Foundation",
    title: "Rank Path",
    description: "Your Discipline Rating, promotion target, and seven-tier climb.",
  },
  {
    rank: "Consistent",
    title: "Consistency Lens",
    description: "A permanent promotion insight focused on reliability and streak strength.",
  },
  {
    rank: "Focused",
    title: "Focus Lens",
    description: "A permanent insight showing which category carried the promotion.",
  },
  {
    rank: "Driven",
    title: "Drive Lens",
    description: "A promotion snapshot connecting Day Score to the DR earned.",
  },
  {
    rank: "Relentless",
    title: "Resilience Lens",
    description: "A deeper promotion record covering streak and Contract execution.",
  },
  {
    rank: "Elite",
    title: "Elite Crest",
    description: "An Elite rank treatment and a permanent high-performance record.",
  },
  {
    rank: "Grand Discipline",
    title: "Legacy Record",
    description: "The summit emblem and a permanent record of the day Grand Discipline was reached.",
  },
];

export function getRankReward(rank: string): RankReward {
  return RANK_REWARDS.find((reward) => reward.rank === rank) ?? RANK_REWARDS[0];
}

export function isRankRewardUnlocked(rewardRank: DisciplineRank, currentDr: number): boolean {
  const threshold = DR_RANK_THRESHOLDS.find((rank) => rank.name === rewardRank);
  return Boolean(threshold && currentDr >= threshold.minDr);
}

export function buildPromotionInsight(record: RankPromotionRecord): string {
  switch (record.rank) {
    case "Consistent":
      return record.streak > 1
        ? `A ${record.streak}-day solid streak turned repetition into your first promotion.`
        : `A ${record.dayScore}% Day Score proved the routine can hold under judgment.`;
    case "Focused":
      return record.strongestCategory
        ? `${record.strongestCategory} carried the strongest completed work on your promotion day.`
        : `The promotion came from a cleaner, more deliberate board.`;
    case "Driven":
      return `A ${record.dayScore}% Day Score produced ${record.drGained >= 0 ? "+" : ""}${record.drGained} DR across the recorded transition.`;
    case "Relentless":
      return record.contractTotalCount > 0
        ? `${record.contractCompletedCount}/${record.contractTotalCount} Contracts held while the streak reached ${record.streak} days.`
        : `The streak reached ${record.streak} days without needing Contract pressure.`;
    case "Elite":
      return `Elite was earned with a ${record.dayScore}% Day Score and a ${record.streak}-day solid streak.`;
    case "Grand Discipline":
      return `Grand Discipline was reached at ${record.drAfter} DR. This is the permanent summit record.`;
    default:
      return `This promotion was secured with a ${record.dayScore}% Day Score.`;
  }
}
