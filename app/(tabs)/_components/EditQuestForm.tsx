import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { createStyles } from "../_styles";
import { useTheme } from "../_utils/themeContext";
import type { Category, Quest } from "../_utils/types";

interface EditQuestFormProps {
  quest: Quest;
  categories: Category[];
  onSave: (questId: string, title: string, categoryId: string, xp: number, difficulty: "easy" | "medium" | "hard") => void;
  onCancel: () => void;
}

export function EditQuestForm({
  quest,
  categories,
  onSave,
  onCancel,
}: EditQuestFormProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [editTitle, setEditTitle] = React.useState(quest.title);
  const [editCategory, setEditCategory] = React.useState(quest.categoryId);
  const [editXP, setEditXP] = React.useState(String(quest.xp));
  const [editDifficulty, setEditDifficulty] = React.useState<"easy" | "medium" | "hard">(
    (quest.difficulty as "easy" | "medium" | "hard") ?? "easy"
  );
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [savePressed, setSavePressed] = useState(false);
  const [cancelPressed, setCancelPressed] = useState(false);

  const handleSave = () => {
    const title = editTitle.trim();
    if (!title) return;

    const xpNum = Number(editXP);
    const safeXP = Number.isFinite(xpNum) && xpNum > 0 ? Math.floor(xpNum) : 10;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave(quest.id, title, editCategory, safeXP, editDifficulty);
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onCancel();
  };

  const handleCategoryChange = (categoryId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditCategory(categoryId);
  };

  const handleDifficultyChange = (difficulty: "easy" | "medium" | "hard") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditDifficulty(difficulty);
  };

  return (
    <View style={[styles.addBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.smallLabel, { color: colors.textPrimary }]}>Edit Quest</Text>

      <TextInput
        placeholder="Quest title"
        placeholderTextColor={colors.textSecondary}
        value={editTitle}
        onChangeText={setEditTitle}
        onFocus={() => setFocusedInput("title")}
        onBlur={() => setFocusedInput(null)}
        style={[styles.input, { backgroundColor: colors.bg, color: colors.textPrimary, borderColor: colors.border }, focusedInput === "title" && { borderColor: colors.accentPrimary }]}
      />

      <Text style={[styles.smallLabel, { color: colors.textPrimary }]}>Category</Text>
      <View style={styles.pickerRow}>
        {categories.map((c) => {
          const active = editCategory === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => handleCategoryChange(c.id)}
              style={[styles.pillPick, { backgroundColor: colors.bg, borderColor: colors.border }, active && { backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary }]}
            >
              <Text style={[styles.pillPickText, { color: colors.textSecondary }, active && { color: colors.textPrimary }]}>
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        placeholder="XP"
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
        value={editXP}
        onChangeText={setEditXP}
        onFocus={() => setFocusedInput("xp")}
        onBlur={() => setFocusedInput(null)}
        style={[styles.input, { backgroundColor: colors.bg, color: colors.textPrimary, borderColor: colors.border }, focusedInput === "xp" && { borderColor: colors.accentPrimary }]}
      />

      <Text style={[styles.smallLabel, { color: colors.textPrimary }]}>Difficulty</Text>
      <View style={styles.pickerRow}>
        {(["easy", "medium", "hard"] as const).map((diff) => {
          const active = editDifficulty === diff;
          return (
            <Pressable
              key={diff}
              onPress={() => handleDifficultyChange(diff)}
              style={[styles.pillPick, { backgroundColor: colors.bg, borderColor: colors.border }, active && { backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary }]}
            >
              <Text style={[styles.pillPickText, { color: colors.textSecondary }, active && { color: colors.textPrimary }]}>
                {diff.charAt(0).toUpperCase() + diff.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={handleSave}
          onPressIn={() => setSavePressed(true)}
          onPressOut={() => setSavePressed(false)}
          style={[styles.addBtn, { flex: 1, backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary }, savePressed && styles.btnPressed]}
        >
          <Text style={[styles.addBtnText, { color: colors.textPrimary }]}>Save</Text>
        </Pressable>
        <Pressable
          onPress={handleCancel}
          onPressIn={() => setCancelPressed(true)}
          onPressOut={() => setCancelPressed(false)}
          style={[styles.deleteBtn, { flex: 1, backgroundColor: `${colors.accentPrimary}1A`, borderColor: colors.accentPrimary }, cancelPressed && styles.btnPressed]}
        >
          <Text style={[styles.deleteText, { color: colors.accentPrimary }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
