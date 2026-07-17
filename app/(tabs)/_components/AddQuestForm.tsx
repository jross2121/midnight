import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { HOME_GOLD, createStyles } from "../_styles";
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
  onClose: () => void;
}

const DIFFICULTY_LABELS: Record<"easy" | "medium" | "hard", string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const REPEAT_LABELS: Record<QuestRepeat, string> = {
  once: "Once",
  daily: "Daily",
  weekdays: "Weekdays",
  weekly: "Weekly",
};

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
  onClose,
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

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <View style={[styles.addBox, { backgroundColor: withAlpha(colors.surface2, 0.68), borderColor: withAlpha(colors.border, 0.22) }]}>
      <View style={styles.addFormHeader}>
        <View style={styles.editorTitleRow}>
          <View
            style={[
              styles.editorHeroMark,
              {
                backgroundColor: withAlpha(HOME_GOLD, 0.12),
                borderColor: withAlpha(HOME_GOLD, 0.3),
              },
            ]}
          >
            <IconSymbol name="plus" size={21} color={HOME_GOLD} />
          </View>
          <View style={styles.addFormTitleWrap}>
            <Text style={[styles.addFormKicker, { color: HOME_GOLD }]}>New Quest</Text>
            <Text style={[styles.addFormTitle, { color: colors.textPrimary }]}>Build the mission</Text>
          </View>
        </View>
        <View style={styles.addFormHeaderActions}>
          <View
            style={[
              styles.addFormBadge,
              {
                backgroundColor: withAlpha(HOME_GOLD, 0.1),
                borderColor: withAlpha(HOME_GOLD, 0.26),
              },
            ]}
          >
            <Text style={[styles.addFormBadgeText, { color: HOME_GOLD }]}>
              {automaticXp} XP
            </Text>
          </View>
          <Pressable
            style={[
              styles.addFormCloseButton,
              {
                backgroundColor: withAlpha(colors.bg, 0.44),
                borderColor: withAlpha(colors.border, 0.22),
              },
            ]}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close new quest menu"
            hitSlop={8}
          >
            <IconSymbol name="xmark" size={17} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={styles.addFormField}>
        <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Title</Text>
        <TextInput
          placeholder="Example: Clean 10 minutes"
          placeholderTextColor={withAlpha(colors.textSecondary, 0.72)}
          value={newTitle}
          onChangeText={onTitleChange}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
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
            focusedInput === "title" && { borderColor: withAlpha(HOME_GOLD, 0.55) },
          ]}
        />
      </View>

      <View style={styles.addFormSectionHeader}>
        <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Category</Text>
      </View>
      <View style={styles.pickerRow}>
        {categories.map((c) => {
          const active = newCategory === c.id;
          const label = getCategoryDisplayName(c);
          return (
            <Pressable
              key={c.id}
              onPress={() => handleCategoryChange(c.id)}
              accessibilityRole="button"
              accessibilityLabel={`Set quest category to ${label}`}
              accessibilityState={{ selected: active }}
              style={[
                styles.pillPick,
                {
                  backgroundColor: active
                    ? withAlpha(HOME_GOLD, 0.14)
                    : withAlpha(colors.bg, 0.34),
                  borderColor: active
                    ? withAlpha(HOME_GOLD, 0.42)
                    : withAlpha(colors.border, 0.22),
                },
                active && styles.editorChipSelected,
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
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.addFormSectionHeader}>
        <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Difficulty</Text>
      </View>
      <View style={styles.pickerRow}>
        {(["easy", "medium", "hard"] as const).map((diff) => {
          const active = newDifficulty === diff;
          const label = DIFFICULTY_LABELS[diff];
          return (
            <Pressable
              key={diff}
              onPress={() => handleDifficultyChange(diff)}
              accessibilityRole="button"
              accessibilityLabel={`Set quest difficulty to ${diff}`}
              accessibilityState={{ selected: active }}
              style={[
                styles.pillPick,
                {
                  backgroundColor: active
                    ? withAlpha(HOME_GOLD, 0.14)
                    : withAlpha(colors.bg, 0.34),
                  borderColor: active
                    ? withAlpha(HOME_GOLD, 0.42)
                    : withAlpha(colors.border, 0.22),
                },
                active && styles.editorChipSelected,
              ]}
            >
              <Text style={[styles.pillPickText, { color: active ? colors.textPrimary : colors.textSecondary }]}>
                {label}
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
          const label = REPEAT_LABELS[repeat];

          return (
            <Pressable
              key={repeat}
              onPress={() => handleRepeatChange(repeat)}
              accessibilityRole="button"
              accessibilityLabel={`Set quest repeat to ${label}`}
              accessibilityState={{ selected: active }}
              style={[
                styles.pillPick,
                {
                  backgroundColor: active
                    ? withAlpha(HOME_GOLD, 0.14)
                    : withAlpha(colors.bg, 0.34),
                  borderColor: active
                    ? withAlpha(HOME_GOLD, 0.42)
                    : withAlpha(colors.border, 0.22),
                },
                active && styles.editorChipSelected,
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
                accessibilityState={{ selected: active }}
                style={[
                  styles.pillPick,
                  styles.weekdayPick,
                  {
                    backgroundColor: active
                      ? withAlpha(HOME_GOLD, 0.14)
                      : withAlpha(colors.bg, 0.34),
                    borderColor: active
                      ? withAlpha(HOME_GOLD, 0.42)
                      : withAlpha(colors.border, 0.22),
                  },
                  active && styles.editorChipSelected,
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
        accessibilityState={{ disabled: !canAdd }}
        style={[
          styles.addBtn,
          { backgroundColor: HOME_GOLD, borderColor: withAlpha(HOME_GOLD, 0.4) },
          !canAdd && { opacity: 0.5 },
          addPressed && styles.btnPressed,
        ]}
      >
        <Text style={[styles.addBtnText, { color: colors.bg }]}>Add Quest</Text>
      </Pressable>
    </View>
  );
}
