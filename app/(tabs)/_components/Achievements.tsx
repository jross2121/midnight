import React from "react";
import { Text, View } from "react-native";
import { createStyles } from "../_styles";
import { withAlpha } from "../_utils/designSystem";
import { useTheme } from "../_utils/themeContext";
import type { Achievement } from "../_utils/types";

interface AchievementsProps {
  achievements: Achievement[];
}

export function Achievements({ achievements }: AchievementsProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;
  const totalCount = achievements.length;

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <View style={styles.achievementSection}>
      <View style={styles.achievementHeader}>
        <Text style={[styles.section, { color: colors.textPrimary }]}>Achievements</Text>
        <View style={[styles.achievementProgress, { backgroundColor: withAlpha(colors.bg, 0.35), borderColor: withAlpha(colors.border, 0.24) }]}>
          <Text style={[styles.achievementProgressText, { color: colors.textPrimary }]}>{unlockedCount}/{totalCount}</Text>
        </View>
      </View>

      <View style={styles.achievementGrid}>
        {achievements.map((achievement) => (
          <View
            key={achievement.id}
            style={[
              styles.achievementBadge,
              { backgroundColor: withAlpha(colors.surface2, 0.82), borderColor: withAlpha(colors.border, 0.24) },
              achievement.unlockedAt
                ? { borderColor: withAlpha(colors.accentPrimary, 0.35), backgroundColor: withAlpha(colors.accentPrimary, 0.1) }
                : { opacity: 0.5 },
            ]}
          >
            <Text style={styles.achievementIcon}>{achievement.icon}</Text>
            <Text style={[styles.achievementName, { color: colors.textPrimary }]}>{achievement.name}</Text>
            <Text style={[styles.achievementDesc, { color: colors.textSecondary }]}>{achievement.description}</Text>
            {achievement.unlockedAt && (
              <Text style={[styles.achievementDate, { color: colors.accentPrimary }]}>{formatDate(achievement.unlockedAt)}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
