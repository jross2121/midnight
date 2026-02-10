import { styles } from "@/app/(tabs)/styles";
import { useTheme } from "@/app/(tabs)/utils/themeContext";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import type { Category } from "../utils/types";

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
    <View style={[styles.addBox, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <TextInput
        placeholder="Quest title (e.g., Clean 10 minutes)"
        placeholderTextColor={colors.textSecondary}
        value={newTitle}
        onChangeText={onTitleChange}
        onFocus={() => setFocusedInput("title")}
        onBlur={() => setFocusedInput(null)}
        style={[styles.input, { backgroundColor: colors.bgInput, color: colors.textPrimary, borderColor: colors.border }, focusedInput === "title" && { borderColor: colors.accent }]}
      />

      <Text style={[styles.smallLabel, { color: colors.textPrimary }]}>Category</Text>
      <View style={styles.pickerRow}>
        {categories.map((c) => {
          const active = newCategory === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => handleCategoryChange(c.id)}
              style={[styles.pillPick, { backgroundColor: colors.bgInput, borderColor: colors.border }, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}
            >
              <Text style={[styles.pillPickText, { color: colors.textSecondary }, active && { color: '#ffffff' }]}>
                {c.name}
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
        style={[styles.input, { backgroundColor: colors.bgInput, color: colors.textPrimary, borderColor: colors.border }, focusedInput === "xp" && { borderColor: colors.accent }]}
      />

      <Text style={[styles.smallLabel, { color: colors.textPrimary }]}>Difficulty</Text>
      <View style={styles.pickerRow}>
        {(["easy", "medium", "hard"] as const).map((diff) => {
          const active = newDifficulty === diff;
          return (
            <Pressable
              key={diff}
              onPress={() => handleDifficultyChange(diff)}
              style={[styles.pillPick, { backgroundColor: colors.bgInput, borderColor: colors.border }, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}
            >
              <Text style={[styles.pillPickText, { color: colors.textSecondary }, active && { color: '#ffffff' }]}>
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
        style={[styles.addBtn, { backgroundColor: colors.accent, borderColor: colors.accent }, addPressed && styles.btnPressed]}
      >
        <Text style={[styles.addBtnText, { color: '#ffffff' }]}>Add Quest</Text>
      </Pressable>
    </View>
  );
}
