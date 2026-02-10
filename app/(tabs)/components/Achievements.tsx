import { styles } from "@/app/(tabs)/styles";
import { useTheme } from "@/app/(tabs)/utils/themeContext";
import React from "react";
import { Text, View } from "react-native";
import type { Achievement } from "../utils/types";

interface AchievementsProps {
  achievements: Achievement[];
}

export function Achievements({ achievements }: AchievementsProps) {
  const { colors } = useTheme();
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
        <View style={[styles.achievementProgress, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
          <Text style={[styles.achievementProgressText, { color: colors.textPrimary }]}>{unlockedCount}/{totalCount}</Text>
        </View>
      </View>

      <View style={styles.achievementGrid}>
        {achievements.map((achievement) => (
          <View
            key={achievement.id}
            style={[
              styles.achievementBadge,
              { backgroundColor: colors.bgCard, borderColor: colors.border },
              achievement.unlockedAt ? { borderColor: colors.accent, backgroundColor: colors.accent + '10' } : { opacity: 0.5 },
            ]}
          >
            <Text style={styles.achievementIcon}>{achievement.icon}</Text>
            <Text style={[styles.achievementName, { color: colors.textPrimary }]}>{achievement.name}</Text>
            <Text style={[styles.achievementDesc, { color: colors.textSecondary }]}>{achievement.description}</Text>
            {achievement.unlockedAt && (
              <Text style={[styles.achievementDate, { color: colors.accent }]}>{formatDate(achievement.unlockedAt)}</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
