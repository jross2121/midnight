import { styles } from "@/app/(tabs)/styles";
import React from "react";
import { Text, View } from "react-native";
import { clamp } from "../utils/gameHelpers";
import type { Category } from "../utils/types";

interface CategoriesGridProps {
  categories: Category[];
}

export function CategoriesGrid({ categories }: CategoriesGridProps) {
  return (
    <View style={styles.grid}>
      {categories.map((c) => {
        const pct = clamp(c.xp / c.xpToNext, 0, 1);
        return (
          <View key={c.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{c.name}</Text>
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
