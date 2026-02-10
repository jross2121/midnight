import React from "react";
import { Text, View } from "react-native";
import { styles } from "../styles";
import type { Category } from "../utils/types";

interface StatsOverviewProps {
  categories: Category[];
}

export function StatsOverview({ categories }: StatsOverviewProps) {
  // Calculate comprehensive metrics
  const totalLevel = categories.reduce((sum, c) => sum + c.level, 0);
  const avgLevel = categories.length ? Math.round((totalLevel / categories.length) * 10) / 10 : 0;
  const totalXP = categories.reduce((sum, c) => sum + c.xp, 0);
  const maxLevel = Math.max(...categories.map((c) => c.level), 0);
  const minLevel = Math.min(...categories.map((c) => c.level), 0);

  // Balance score (0-100): how evenly distributed levels are
  const levelVariance = maxLevel - minLevel;
  const balanceScore = Math.max(0, 100 - levelVariance * 10);

  // Completion score based on categories at level 5+
  const masteryCategoriesCount = categories.filter((c) => c.level >= 5).length;
  const masteryPercent = categories.length
    ? Math.round((masteryCategoriesCount / categories.length) * 100)
    : 0;

  // Total XP to next milestone (when all categories average to next level)
  const xpToNextAvgLevel = categories.length
    ? Math.round(
        categories.reduce((sum, c) => {
          const nextLevelXp = Math.round(c.xpToNext * 1.15 + 25);
          return sum + Math.max(0, nextLevelXp - c.xp);
        }, 0) / categories.length
      )
    : 0;

  const nextMilestoneCategory = categories.reduce<
    { name: string; remaining: number; progress: number } | null
  >((closest, c) => {
    const remaining = Math.max(0, c.xpToNext - c.xp);
    const progress = c.xpToNext > 0 ? Math.min(1, c.xp / c.xpToNext) : 0;
    if (!closest || remaining < closest.remaining) {
      return { name: c.name, remaining, progress };
    }
    return closest;
  }, null);

  return (
    <View style={{ gap: 12, marginBottom: 20 }}>
      {/* Next milestone hint */}
      {nextMilestoneCategory && (
        <View style={[styles.card, { borderColor: "#2a3a4a" }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={styles.cardTitle}>Next Milestone</Text>
            <Text style={[styles.smallLabel, { color: "#8fa3b0" }]}>Avg +{xpToNextAvgLevel} XP</Text>
          </View>
          <Text style={[styles.questMeta, { marginTop: 8 }]}>
            Level up {nextMilestoneCategory.name} in {nextMilestoneCategory.remaining} XP
          </Text>
          <View style={[styles.barTrack, { height: 8, marginTop: 10 }]}>
            <View
              style={[
                styles.barFill,
                {
                  width: `${Math.round(nextMilestoneCategory.progress * 100)}%`,
                  backgroundColor: "#00ff88",
                },
              ]}
            />
          </View>
          <Text style={[styles.smallLabel, { color: "#00ff88", marginTop: 6 }]}>
            {Math.round(nextMilestoneCategory.progress * 100)}% to next level
          </Text>
        </View>
      )}

      {/* Main stats grid */}
      <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
        <View
          style={[
            styles.pill,
            {
              flex: 0,
              minWidth: "48%",
              backgroundColor: "#0f1419",
              borderColor: "#00d9ff",
            },
          ]}
        >
          <Text style={styles.pillLabel}>Average Level</Text>
          <Text style={styles.pillValue}>{avgLevel}</Text>
          <Text style={[styles.questMeta, { marginTop: 6, fontSize: 10 }]}>
            {totalLevel} total levels
          </Text>
        </View>

        <View
          style={[
            styles.pill,
            {
              flex: 0,
              minWidth: "48%",
              backgroundColor: "#0f1419",
              borderColor: "#ffaa00",
            },
          ]}
        >
          <Text style={styles.pillLabel}>Mastery Score</Text>
          <Text style={[styles.pillValue, { color: "#ffaa00" }]}>{masteryPercent}%</Text>
          <Text style={[styles.questMeta, { marginTop: 6, fontSize: 10 }]}>
            {masteryCategoriesCount}/6 maxed
          </Text>
        </View>

        <View
          style={[
            styles.pill,
            {
              flex: 0,
              minWidth: "48%",
              backgroundColor: "#0f1419",
              borderColor: "#00bcd4",
            },
          ]}
        >
          <Text style={styles.pillLabel}>Balance Score</Text>
          <Text style={[styles.pillValue, { color: "#00ff88" }]}>{Math.round(balanceScore)}%</Text>
          <Text style={[styles.questMeta, { marginTop: 6, fontSize: 10 }]}>
            Lv {minLevel} to {maxLevel}
          </Text>
        </View>

        <View
          style={[
            styles.pill,
            {
              flex: 0,
              minWidth: "48%",
              backgroundColor: "#0f1419",
              borderColor: "#ff6b9d",
            },
          ]}
        >
          <Text style={styles.pillLabel}>Total XP</Text>
          <Text style={[styles.pillValue, { color: "#ff6b9d" }]}>{totalXP}</Text>
          <Text style={[styles.questMeta, { marginTop: 6, fontSize: 10 }]}>
            Earned lifetime
          </Text>
        </View>
      </View>

      {/* Category rankings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Category Rankings</Text>
        <View style={{ gap: 10, marginTop: 12 }}>
          {[...categories]
            .sort((a, b) => {
              // Sort by level descending, then by XP descending
              if (a.level !== b.level) return b.level - a.level;
              return b.xp - a.xp;
            })
            .map((category, index) => {
              const colorMap: { [key: string]: string } = {
                health: "#00bcd4",
                money: "#00ff00",
                career: "#ff9800",
                social: "#ff6b9d",
                home: "#ff4444",
                fun: "#9d4edd",
              };
              const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣"];
              const color = colorMap[category.id] || "#00d9ff";
              const medal = medals[index];

              return (
                <View
                  key={category.id}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    backgroundColor: "#141d2a",
                    borderRadius: 10,
                    borderLeftWidth: 3,
                    borderLeftColor: color,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <Text style={{ fontSize: 16 }}>{medal}</Text>
                    <View>
                      <Text style={[styles.questTitle, { color }]}>{category.name}</Text>
                      <Text style={[styles.questMeta, { fontSize: 11 }]}>
                        Level {category.level} • {category.xp} XP
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      backgroundColor: color,
                      borderRadius: 8,
                      opacity: 0.8,
                    }}
                  >
                    <Text style={{ color: "#0a0e14", fontWeight: "900", fontSize: 12 }}>
                      {((category.xp / category.xpToNext) * 100).toFixed(0)}%
                    </Text>
                  </View>
                </View>
              );
            })}
        </View>
      </View>

      {/* Progress tracker */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progression Timeline</Text>
        <Text style={[styles.questMeta, { marginTop: 8, marginBottom: 12 }]}>
          Avg level increases as you balance your categories
        </Text>

        {/* Level distribution */}
        <View style={{ gap: 10 }}>
          {[1, 2, 3, 4, 5, 6].map((level) => {
            const categoriesAtLevel = categories.filter((c) => c.level >= level).length;
            const percent = (categoriesAtLevel / categories.length) * 100;

            return (
              <View key={`level-${level}`} style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={[styles.smallLabel, { color: "#8fa3b0" }]}>Level {level}+</Text>
                  <Text style={[styles.smallLabel, { color: "#00d9ff" }]}>
                    {categoriesAtLevel}/6 categories
                  </Text>
                </View>
                <View style={[styles.barTrack, { height: 8 }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${percent}%`,
                        backgroundColor: `rgba(0, 217, 255, ${0.3 + (level / 6) * 0.7})`,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
