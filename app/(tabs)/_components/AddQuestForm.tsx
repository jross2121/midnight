import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { createStyles } from "../_styles";
import { getCategoryDisplayName } from "../_utils/categoryLabels";
import { withAlpha } from "../_utils/designSystem";
import { useTheme } from "../_utils/themeContext";
import type { Category } from "../_utils/types";

interface AddQuestFormProps {
  categories: Category[];
  newTitle: string;
  newCategory: string;
  newXP: string;
  newDifficulty: "easy" | "medium" | "hard";
  onTitleChange: (text: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onXPChange: (text: string) => void;
  onDifficultyChange: (difficulty: "easy" | "medium" | "hard") => void;
  onAdd: () => void;
}

export function AddQuestForm({
  categories,
  newTitle,
  newCategory,
  newXP,
  newDifficulty,
  onTitleChange,
  onCategoryChange,
  onXPChange,
  onDifficultyChange,
  onAdd,
}: AddQuestFormProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [addPressed, setAddPressed] = useState(false);

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAdd();
  };

  const handleCategoryChange = (categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCategoryChange(categoryId);
  };

  const handleDifficultyChange = (difficulty: "easy" | "medium" | "hard") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDifficultyChange(difficulty);
  };

  return (
    <View style={[styles.addBox, { backgroundColor: withAlpha(colors.surface2, 0.82), borderColor: withAlpha(colors.border, 0.24) }]}>
      <TextInput
        placeholder="Quest title (e.g., Clean 10 minutes)"
        placeholderTextColor={colors.textSecondary}
        value={newTitle}
        onChangeText={onTitleChange}
        onFocus={() => setFocusedInput("title")}
        onBlur={() => setFocusedInput(null)}
        style={[styles.input, { backgroundColor: withAlpha(colors.bg, 0.5), color: colors.textPrimary, borderColor: withAlpha(colors.border, 0.28) }, focusedInput === "title" && { borderColor: withAlpha(colors.accentPrimary, 0.55) }]}
      />

      <Text style={[styles.smallLabel, { color: colors.textPrimary }]}>Category</Text>
      <View style={styles.pickerRow}>
        {categories.map((c) => {
          const active = newCategory === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => handleCategoryChange(c.id)}
              style={[styles.pillPick, { backgroundColor: withAlpha(colors.bg, 0.35), borderColor: withAlpha(colors.border, 0.28) }, active && { backgroundColor: withAlpha(colors.accentPrimary, 0.12), borderColor: withAlpha(colors.accentPrimary, 0.38) }]}
            >
              <Text style={[styles.pillPickText, { color: colors.textSecondary }, active && { color: colors.textPrimary }]}>
                {getCategoryDisplayName(c)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        placeholder="XP (e.g., 15)"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
        value={newXP}
        onChangeText={onXPChange}
        onFocus={() => setFocusedInput("xp")}
        onBlur={() => setFocusedInput(null)}
        style={[styles.input, { backgroundColor: withAlpha(colors.bg, 0.5), color: colors.textPrimary, borderColor: withAlpha(colors.border, 0.28) }, focusedInput === "xp" && { borderColor: withAlpha(colors.accentPrimary, 0.55) }]}
      />

      <Text style={[styles.smallLabel, { color: colors.textPrimary }]}>Difficulty</Text>
      <View style={styles.pickerRow}>
        {(["easy", "medium", "hard"] as const).map((diff) => {
          const active = newDifficulty === diff;
          return (
            <Pressable
              key={diff}
              onPress={() => handleDifficultyChange(diff)}
              style={[styles.pillPick, { backgroundColor: withAlpha(colors.bg, 0.35), borderColor: withAlpha(colors.border, 0.28) }, active && { backgroundColor: withAlpha(colors.accentPrimary, 0.12), borderColor: withAlpha(colors.accentPrimary, 0.38) }]}
            >
              <Text style={[styles.pillPickText, { color: colors.textSecondary }, active && { color: colors.textPrimary }]}>
                {diff.charAt(0).toUpperCase() + diff.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={handleAdd}
        onPressIn={() => setAddPressed(true)}
        onPressOut={() => setAddPressed(false)}
        style={[styles.addBtn, { backgroundColor: colors.accentPrimary, borderColor: withAlpha(colors.accentPrimary, 0.4) }, addPressed && styles.btnPressed]}
      >
        <Text style={[styles.addBtnText, { color: colors.textPrimary }]}>Add Quest</Text>
      </Pressable>
    </View>
  );
}
