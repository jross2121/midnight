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

  return (
    <View style={{ marginBottom: 0 }}>
      <View style={styles.focusList}>
        {categories.map((category, index) => (
          <React.Fragment key={category.id}>
            <View style={styles.focusRow}>
              <Text style={styles.focusLabel}>{category.name}</Text>
              <Text style={styles.focusMeta}>Lv {category.level}</Text>
            </View>
            {index < categories.length - 1 ? <View style={styles.focusDivider} /> : null}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}
