import React from "react";
import { Text, View } from "react-native";
import { createStyles } from "../_styles";
import { useTheme } from "../_utils/themeContext";
import type { Category } from "../_utils/types";

interface StatsOverviewProps {
  categories: Category[];
}

export function StatsOverview({ categories }: StatsOverviewProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
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
        <View style={[styles.card, { borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={styles.cardTitle}>Next Milestone</Text>
            <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Avg +{xpToNextAvgLevel} XP</Text>
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
                  backgroundColor: colors.accentSecondary,
                },
              ]}
            />
          </View>
          <Text style={[styles.smallLabel, { color: colors.accentSecondary, marginTop: 6 }]}> 
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
              backgroundColor: colors.surface,
              borderColor: colors.accentPrimary,
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
              backgroundColor: colors.surface,
              borderColor: colors.accentTertiary,
            },
          ]}
        >
          <Text style={styles.pillLabel}>Mastery Score</Text>
          <Text style={[styles.pillValue, { color: colors.accentTertiary }]}>{masteryPercent}%</Text>
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
              backgroundColor: colors.surface,
              borderColor: colors.accentSecondary,
            },
          ]}
        >
          <Text style={styles.pillLabel}>Balance Score</Text>
          <Text style={[styles.pillValue, { color: colors.accentSecondary }]}>{Math.round(balanceScore)}%</Text>
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
              backgroundColor: colors.surface,
              borderColor: colors.accentPrimary,
            },
          ]}
        >
          <Text style={styles.pillLabel}>Total XP</Text>
          <Text style={[styles.pillValue, { color: colors.accentPrimary }]}>{totalXP}</Text>
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
                health: colors.accentPrimary,
                money: colors.accentSecondary,
                career: colors.accentTertiary,
                social: colors.accentPrimary,
                home: colors.accentSecondary,
                fun: colors.accentTertiary,
              };
              const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣"];
              const color = colorMap[category.id] || colors.accentPrimary;
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
                    backgroundColor: colors.surface,
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
                    <Text style={{ color: colors.textPrimary, fontWeight: "900", fontSize: 12 }}>
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
                  <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Level {level}+</Text>
                  <Text style={[styles.smallLabel, { color: colors.accentPrimary }]}>
                    {categoriesAtLevel}/6 categories
                  </Text>
                </View>
                <View style={[styles.barTrack, { height: 8 }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${percent}%`,
                        backgroundColor: colors.accentPrimary,
                        opacity: 0.3 + (level / 6) * 0.7,
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
