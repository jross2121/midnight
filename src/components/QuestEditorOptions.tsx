import { IconSymbol } from "@/components/ui/icon-symbol";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { HOME_GOLD, createStyles } from "@/src/styles";
import { getCategoryArtById } from "@/src/utils/categoryArt";
import { getCategoryDisplayName } from "@/src/utils/categoryLabels";
import { withAlpha } from "@/src/utils/designSystem";
import { getQuestXpForDifficulty } from "@/src/utils/questXp";
import { QUEST_REPEAT_OPTIONS, WEEKDAY_LABELS } from "@/src/utils/recurrence";
import { useTheme } from "@/src/utils/themeContext";
import type { Category, QuestRepeat } from "@/src/utils/types";

type QuestDifficulty = "easy" | "medium" | "hard";

const DIFFICULTY_LABELS: Record<QuestDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const REPEAT_META: Record<QuestRepeat, { label: string; detail: string }> = {
  once: { label: "Once", detail: "One day" },
  daily: { label: "Daily", detail: "Every day" },
  weekdays: { label: "Weekdays", detail: "Monday–Friday" },
  weekly: { label: "Weekly", detail: "Choose a day" },
};

function SelectionMark({ selected }: { selected: boolean }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View
      style={[
        styles.editorSelectionMark,
        {
          backgroundColor: selected ? HOME_GOLD : "transparent",
          borderColor: selected ? HOME_GOLD : withAlpha(colors.border, 0.42),
        },
      ]}
    >
      {selected ? <IconSymbol name="checkmark" size={10} color={colors.bg} /> : null}
    </View>
  );
}

export function QuestCategoryOptions({
  categories,
  selectedCategory,
  onSelect,
}: {
  categories: Category[];
  selectedCategory: string;
  onSelect: (categoryId: string) => void;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.editorCategoryGrid}>
      {categories.map((category) => {
        const selected = selectedCategory === category.id;
        const label = getCategoryDisplayName(category);
        const art = getCategoryArtById(category.id);

        return (
          <Pressable
            key={category.id}
            onPress={() => onSelect(category.id)}
            accessibilityRole="button"
            accessibilityLabel={`Set quest area to ${label}`}
            accessibilityState={{ selected }}
            style={[
              styles.editorCategoryOption,
              {
                backgroundColor: selected
                  ? withAlpha(art.color, 0.12)
                  : withAlpha(colors.bg, 0.36),
                borderColor: selected
                  ? withAlpha(art.color, 0.48)
                  : withAlpha(colors.border, 0.24),
              },
            ]}
          >
            <View style={[styles.editorCategoryDot, { backgroundColor: art.color }]} />
            <Text
              style={[
                styles.editorOptionTitle,
                { color: selected ? colors.textPrimary : colors.textSecondary },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {label}
            </Text>
            <SelectionMark selected={selected} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function QuestDifficultyOptions({
  selectedDifficulty,
  onSelect,
}: {
  selectedDifficulty: QuestDifficulty;
  onSelect: (difficulty: QuestDifficulty) => void;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.editorThreeColumnRow}>
      {(["easy", "medium", "hard"] as const).map((difficulty, index) => {
        const selected = selectedDifficulty === difficulty;

        return (
          <Pressable
            key={difficulty}
            onPress={() => onSelect(difficulty)}
            accessibilityRole="button"
            accessibilityLabel={`Set quest intensity to ${difficulty}`}
            accessibilityState={{ selected }}
            style={[
              styles.editorDetailOption,
              {
                backgroundColor: selected
                  ? withAlpha(HOME_GOLD, 0.12)
                  : withAlpha(colors.bg, 0.36),
                borderColor: selected
                  ? withAlpha(HOME_GOLD, 0.48)
                  : withAlpha(colors.border, 0.24),
              },
            ]}
          >
            <View style={styles.editorOptionTopRow}>
              <View style={styles.editorIntensityMarks}>
                {[0, 1, 2].map((mark) => (
                  <View
                    key={mark}
                    style={[
                      styles.editorIntensityMark,
                      {
                        backgroundColor:
                          mark <= index
                            ? HOME_GOLD
                            : withAlpha(colors.textSecondary, 0.2),
                      },
                    ]}
                  />
                ))}
              </View>
              <SelectionMark selected={selected} />
            </View>
            <Text style={[styles.editorOptionTitle, { color: colors.textPrimary }]}>
              {DIFFICULTY_LABELS[difficulty]}
            </Text>
            <Text style={[styles.editorOptionDetail, { color: colors.textSecondary }]}>
              {getQuestXpForDifficulty(difficulty)} XP
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function QuestRepeatOptions({
  selectedRepeat,
  selectedWeekday,
  onRepeatSelect,
  onWeekdaySelect,
}: {
  selectedRepeat: QuestRepeat;
  selectedWeekday: number;
  onRepeatSelect: (repeat: QuestRepeat) => void;
  onWeekdaySelect: (weekday: number) => void;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <>
      <View style={styles.editorRepeatGrid}>
        {QUEST_REPEAT_OPTIONS.map((repeat) => {
          const selected = selectedRepeat === repeat;
          const meta = REPEAT_META[repeat];

          return (
            <Pressable
              key={repeat}
              onPress={() => onRepeatSelect(repeat)}
              accessibilityRole="button"
              accessibilityLabel={`Set quest repeat to ${meta.label}`}
              accessibilityState={{ selected }}
              style={[
                styles.editorRepeatOption,
                {
                  backgroundColor: selected
                    ? withAlpha(HOME_GOLD, 0.12)
                    : withAlpha(colors.bg, 0.36),
                  borderColor: selected
                    ? withAlpha(HOME_GOLD, 0.48)
                    : withAlpha(colors.border, 0.24),
                },
              ]}
            >
              <View style={styles.editorOptionTopRow}>
                <IconSymbol
                  name={repeat === "once" ? "flag.fill" : "calendar"}
                  size={14}
                  color={selected ? HOME_GOLD : colors.textSecondary}
                />
                <SelectionMark selected={selected} />
              </View>
              <Text style={[styles.editorOptionTitle, { color: colors.textPrimary }]}>
                {meta.label}
              </Text>
              <Text style={[styles.editorOptionDetail, { color: colors.textSecondary }]}>
                {meta.detail}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedRepeat === "weekly" ? (
        <View style={styles.editorWeekdayRow}>
          {WEEKDAY_LABELS.map((label, weekday) => {
            const selected = selectedWeekday === weekday;
            return (
              <Pressable
                key={label}
                onPress={() => onWeekdaySelect(weekday)}
                accessibilityRole="button"
                accessibilityLabel={`Schedule quest on ${label}`}
                accessibilityState={{ selected }}
                style={[
                  styles.editorWeekdayOption,
                  {
                    backgroundColor: selected
                      ? withAlpha(HOME_GOLD, 0.14)
                      : withAlpha(colors.bg, 0.36),
                    borderColor: selected
                      ? withAlpha(HOME_GOLD, 0.48)
                      : withAlpha(colors.border, 0.24),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.editorWeekdayText,
                    { color: selected ? colors.textPrimary : colors.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </>
  );
}
