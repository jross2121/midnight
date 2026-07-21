import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { HOME_GOLD, createStyles } from "@/src/styles";
import {
  QuestCategoryOptions,
  QuestDifficultyOptions,
  QuestRepeatOptions,
} from "@/src/components/QuestEditorOptions";
import { withAlpha } from "@/src/utils/designSystem";
import { getQuestXpForDifficulty } from "@/src/utils/questXp";
import { getTodayWeekday } from "@/src/utils/recurrence";
import { useTheme } from "@/src/utils/themeContext";
import type { Category, QuestRepeat } from "@/src/utils/types";

interface AddQuestFormProps {
  categories: Category[];
  newTitle: string;
  newTarget: string;
  newCategory: string;
  newDifficulty: "easy" | "medium" | "hard";
  newRepeat: QuestRepeat;
  newScheduledWeekday: number;
  onTitleChange: (text: string) => void;
  onTargetChange: (text: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onDifficultyChange: (difficulty: "easy" | "medium" | "hard") => void;
  onRepeatChange: (repeat: QuestRepeat) => void;
  onScheduledWeekdayChange: (weekday: number) => void;
  onAdd: () => void;
  onClose: () => void;
}

export function AddQuestForm({
  categories,
  newTitle,
  newTarget,
  newCategory,
  newDifficulty,
  newRepeat,
  newScheduledWeekday,
  onTitleChange,
  onTargetChange,
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
    <View
      style={[
        styles.addBox,
        {
          backgroundColor: withAlpha(colors.surface2, 0.68),
          borderColor: withAlpha(colors.border, 0.22),
        },
      ]}
    >
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
            <Text style={[styles.addFormKicker, { color: HOME_GOLD }]}>New quest</Text>
            <Text style={[styles.addFormTitle, { color: colors.textPrimary }]}>Build a clear mission</Text>
          </View>
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

      <Text style={[styles.editorIntroText, { color: colors.textSecondary }]}>
        Name the outcome, choose its effort, and decide when it returns.
      </Text>

      <View
        style={[
          styles.editorFormSurface,
          {
            backgroundColor: withAlpha(colors.bg, 0.22),
            borderColor: withAlpha(colors.border, 0.18),
          },
        ]}
      >
        <View style={styles.addFormField}>
          <View style={styles.editorFieldHeader}>
            <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Quest name</Text>
            <Text style={[styles.editorFieldHint, { color: colors.textSecondary }]}>Required</Text>
          </View>
          <TextInput
            placeholder="Example: Clean for 10 minutes"
            placeholderTextColor={withAlpha(colors.textSecondary, 0.72)}
            value={newTitle}
            onChangeText={onTitleChange}
            returnKeyType="next"
            onFocus={() => setFocusedInput("title")}
            onBlur={() => setFocusedInput(null)}
            accessibilityLabel="Quest title"
            style={[
              styles.input,
              {
                backgroundColor: withAlpha(colors.surface2, 0.44),
                color: colors.textPrimary,
                borderColor: withAlpha(colors.border, 0.26),
              },
              focusedInput === "title" && { borderColor: withAlpha(HOME_GOLD, 0.55) },
            ]}
          />
        </View>

        <View style={styles.addFormField}>
          <View style={styles.editorFieldHeader}>
            <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Target</Text>
            <Text style={[styles.editorFieldHint, { color: colors.textSecondary }]}>Optional</Text>
          </View>
          <TextInput
            placeholder="20 min, 8 cups, $25"
            placeholderTextColor={withAlpha(colors.textSecondary, 0.72)}
            value={newTarget}
            onChangeText={onTargetChange}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
            onFocus={() => setFocusedInput("target")}
            onBlur={() => setFocusedInput(null)}
            accessibilityLabel="Quest target"
            style={[
              styles.input,
              {
                backgroundColor: withAlpha(colors.surface2, 0.44),
                color: colors.textPrimary,
                borderColor: withAlpha(colors.border, 0.26),
              },
              focusedInput === "target" && { borderColor: withAlpha(HOME_GOLD, 0.55) },
            ]}
          />
        </View>

        <View style={styles.editorFieldBlock}>
          <View style={styles.editorFieldHeader}>
            <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Area</Text>
            <Text style={[styles.editorFieldHint, { color: colors.textSecondary }]}>Where it counts</Text>
          </View>
          <QuestCategoryOptions
            categories={categories}
            selectedCategory={newCategory}
            onSelect={handleCategoryChange}
          />
        </View>

        <View style={styles.editorFieldBlock}>
          <View style={styles.editorFieldHeader}>
            <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Intensity</Text>
            <Text style={[styles.editorFieldHint, { color: HOME_GOLD }]}>{automaticXp} XP</Text>
          </View>
          <QuestDifficultyOptions
            selectedDifficulty={newDifficulty}
            onSelect={handleDifficultyChange}
          />
        </View>

        <View style={styles.editorFieldBlock}>
          <View style={styles.editorFieldHeader}>
            <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Schedule</Text>
            <Text style={[styles.editorFieldHint, { color: colors.textSecondary }]}>How often</Text>
          </View>
          <QuestRepeatOptions
            selectedRepeat={newRepeat}
            selectedWeekday={newScheduledWeekday}
            onRepeatSelect={handleRepeatChange}
            onWeekdaySelect={handleWeekdayChange}
          />
        </View>
      </View>

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
        <View style={styles.editorButtonContent}>
          <IconSymbol name="plus" size={17} color={colors.bg} />
          <Text style={[styles.addBtnText, { color: colors.bg }]}>Add quest</Text>
        </View>
      </Pressable>
    </View>
  );
}
