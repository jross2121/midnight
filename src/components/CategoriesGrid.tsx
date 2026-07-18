import React from "react";
import { Text, View } from "react-native";
import { createStyles } from "@/src/styles";
import { getCategoryDisplayName } from "@/src/utils/categoryLabels";
import { clamp } from "@/src/utils/gameHelpers";
import { useTheme } from "@/src/utils/themeContext";
import type { Category } from "@/src/utils/types";

interface CategoriesGridProps {
  categories: Category[];
}

export function CategoriesGrid({ categories }: CategoriesGridProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.grid}>
      {categories.map((c) => {
        const pct = clamp(c.xp / c.xpToNext, 0, 1);
        return (
          <View key={c.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{getCategoryDisplayName(c)}</Text>
              <Text style={styles.level}>Lv {c.level}</Text>
            </View>

            <Text style={styles.xpText}>
              XP: {c.xp} / {c.xpToNext}
            </Text>

            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
