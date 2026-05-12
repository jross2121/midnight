import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { createStyles } from "../_styles";
import { getCategoryDisplayName } from "../_utils/categoryLabels";
import { withAlpha } from "../_utils/designSystem";
import { getQuestXpForDifficulty } from "../_utils/questXp";
import { getTodayWeekday, QUEST_REPEAT_OPTIONS, WEEKDAY_LABELS } from "../_utils/recurrence";
import { useTheme } from "../_utils/themeContext";
import type { Category, QuestRepeat } from "../_utils/types";

interface AddQuestFormProps {
  categories: Category[];
  newTitle: string;
  newCategory: string;
  newDifficulty: "easy" | "medium" | "hard";
  newRepeat: QuestRepeat;
  newScheduledWeekday: number;
  onTitleChange: (text: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onDifficultyChange: (difficulty: "easy" | "medium" | "hard") => void;
  onRepeatChange: (repeat: QuestRepeat) => void;
  onScheduledWeekdayChange: (weekday: number) => void;
  onAdd: () => void;
}

export function AddQuestForm({
  categories,
  newTitle,
  newCategory,
  newDifficulty,
  newRepeat,
  newScheduledWeekday,
  onTitleChange,
  onCategoryChange,
  onDifficultyChange,
  onRepeatChange,
  onScheduledWeekdayChange,
  onAdd,
}: AddQuestFormProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [addPressed, setAddPressed] = useState(false);
  const canAdd = newTitle.trim().length > 0;
  const automaticXp = getQuestXpForDifficulty(newDifficulty);

  const handleAdd = () => {
    if (!canAdd) return;
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

  const handleRepeatChange = (repeat: QuestRepeat) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRepeatChange(repeat);
    if (repeat === "weekly") {
      onScheduledWeekdayChange(newScheduledWeekday ?? getTodayWeekday());
    }
  };

  const handleWeekdayChange = (weekday: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onScheduledWeekdayChange(weekday);
  };

  return (
    <View style={[styles.addBox, { backgroundColor: withAlpha(colors.surface2, 0.68), borderColor: withAlpha(colors.border, 0.22) }]}>
      <View style={styles.addFormHeader}>
        <View style={styles.addFormTitleWrap}>
          <Text style={[styles.addFormKicker, { color: colors.accentPrimary }]}>New Quest</Text>
          <Text style={[styles.addFormTitle, { color: colors.textPrimary }]}>Build today&apos;s move</Text>
        </View>
        <View
          style={[
            styles.addFormBadge,
            {
              backgroundColor: withAlpha(colors.accentPrimary, 0.1),
              borderColor: withAlpha(colors.accentPrimary, 0.26),
            },
          ]}
        >
          <Text style={[styles.addFormBadgeText, { color: colors.accentPrimary }]}>
            {automaticXp} XP
          </Text>
        </View>
      </View>

      <View style={styles.addFormField}>
        <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Title</Text>
        <TextInput
          placeholder="Clean 10 minutes"
          placeholderTextColor={withAlpha(colors.textSecondary, 0.72)}
          value={newTitle}
          onChangeText={onTitleChange}
          onFocus={() => setFocusedInput("title")}
          onBlur={() => setFocusedInput(null)}
          accessibilityLabel="Quest title"
          style={[
            styles.input,
            {
              backgroundColor: withAlpha(colors.bg, 0.42),
              color: colors.textPrimary,
              borderColor: withAlpha(colors.border, 0.26),
            },
            focusedInput === "title" && { borderColor: withAlpha(colors.accentPrimary, 0.55) },
          ]}
        />
      </View>

      <View style={styles.addFormSectionHeader}>
        <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Category</Text>
        <Text style={[styles.addFormHint, { color: colors.textSecondary }]}>Choose an area</Text>
      </View>
      <View style={styles.pickerRow}>
        {categories.map((c) => {
          const active = newCategory === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => handleCategoryChange(c.id)}
              accessibilityRole="button"
              accessibilityLabel={`Set quest category to ${getCategoryDisplayName(c)}`}
              style={[
                styles.pillPick,
                {
                  backgroundColor: active
                    ? withAlpha(colors.accentPrimary, 0.14)
                    : withAlpha(colors.bg, 0.34),
                  borderColor: active
                    ? withAlpha(colors.accentPrimary, 0.42)
                    : withAlpha(colors.border, 0.22),
                },
              ]}
            >
              <Text
                style={[
                  styles.pillPickText,
                  { color: active ? colors.textPrimary : colors.textSecondary },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                {getCategoryDisplayName(c)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.addFormSectionHeader}>
        <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Difficulty</Text>
        <Text style={[styles.addFormHint, { color: colors.textSecondary }]}>
          Sets XP automatically
        </Text>
      </View>
      <View style={styles.pickerRow}>
        {(["easy", "medium", "hard"] as const).map((diff) => {
          const active = newDifficulty === diff;
          return (
            <Pressable
              key={diff}
              onPress={() => handleDifficultyChange(diff)}
              accessibilityRole="button"
              accessibilityLabel={`Set quest difficulty to ${diff}`}
              style={[
                styles.pillPick,
                {
                  backgroundColor: active
                    ? withAlpha(colors.accentPrimary, 0.14)
                    : withAlpha(colors.bg, 0.34),
                  borderColor: active
                    ? withAlpha(colors.accentPrimary, 0.42)
                    : withAlpha(colors.border, 0.22),
                },
              ]}
            >
              <Text style={[styles.pillPickText, { color: active ? colors.textPrimary : colors.textSecondary }]}>
                {diff.charAt(0).toUpperCase() + diff.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.addFormSectionHeader}>
        <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Repeat</Text>
      </View>
      <View style={styles.pickerRow}>
        {QUEST_REPEAT_OPTIONS.map((repeat) => {
          const active = newRepeat === repeat;
          const label =
            repeat === "once"
              ? "Once"
              : repeat === "weekdays"
              ? "Weekdays"
              : repeat === "weekly"
              ? "Weekly"
              : "Daily";

          return (
            <Pressable
              key={repeat}
              onPress={() => handleRepeatChange(repeat)}
              accessibilityRole="button"
              accessibilityLabel={`Set quest repeat to ${label}`}
              style={[
                styles.pillPick,
                {
                  backgroundColor: active
                    ? withAlpha(colors.accentPrimary, 0.14)
                    : withAlpha(colors.bg, 0.34),
                  borderColor: active
                    ? withAlpha(colors.accentPrimary, 0.42)
                    : withAlpha(colors.border, 0.22),
                },
              ]}
            >
              <Text
                style={[styles.pillPickText, { color: active ? colors.textPrimary : colors.textSecondary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {newRepeat === "weekly" ? (
        <View style={styles.pickerRow}>
          {WEEKDAY_LABELS.map((label, weekday) => {
            const active = newScheduledWeekday === weekday;
            return (
              <Pressable
                key={label}
                onPress={() => handleWeekdayChange(weekday)}
                accessibilityRole="button"
                accessibilityLabel={`Schedule weekly quest on ${label}`}
                style={[
                  styles.pillPick,
                  styles.weekdayPick,
                  {
                    backgroundColor: active
                      ? withAlpha(colors.accentPrimary, 0.14)
                      : withAlpha(colors.bg, 0.34),
                    borderColor: active
                      ? withAlpha(colors.accentPrimary, 0.42)
                      : withAlpha(colors.border, 0.22),
                  },
                ]}
              >
                <Text style={[styles.pillPickText, { color: active ? colors.textPrimary : colors.textSecondary }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable
        onPress={handleAdd}
        onPressIn={() => setAddPressed(true)}
        onPressOut={() => setAddPressed(false)}
        disabled={!canAdd}
        accessibilityRole="button"
        accessibilityLabel="Add quest"
        style={[
          styles.addBtn,
          { backgroundColor: colors.accentPrimary, borderColor: withAlpha(colors.accentPrimary, 0.4) },
          !canAdd && { opacity: 0.5 },
          addPressed && styles.btnPressed,
        ]}
      >
        <Text style={[styles.addBtnText, { color: colors.bg }]}>Add Quest</Text>
      </Pressable>
    </View>
  );
}
