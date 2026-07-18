import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CONTRACT_GOLD, HOME_GOLD, createStyles } from "@/src/styles";
import { getCategoryDisplayName, getCategoryEmoji, getCategoryEmojiById } from "@/src/utils/categoryLabels";
import { withAlpha } from "@/src/utils/designSystem";
import { getQuestXpForDifficulty } from "@/src/utils/questXp";
import {
  getQuestRepeatLabel,
  normalizeQuestRepeat,
  normalizeScheduledWeekday,
  QUEST_REPEAT_OPTIONS,
  WEEKDAY_LABELS,
} from "@/src/utils/recurrence";
import { useTheme } from "@/src/utils/themeContext";
import type { Category, Quest, QuestRepeat } from "@/src/utils/types";

interface EditQuestFormProps {
  quest: Quest;
  categories: Category[];
  onSave: (
    questId: string,
    title: string,
    categoryId: string,
    difficulty: "easy" | "medium" | "hard",
    target: string,
    repeat: QuestRepeat,
    scheduledWeekday?: number
  ) => void;
  onCancel: () => void;
  reducedMotion: boolean;
}

const DIFFICULTY_META: Record<"easy" | "medium" | "hard", { label: string; emoji: string }> = {
  easy: { label: "Easy", emoji: "🌱" },
  medium: { label: "Medium", emoji: "⚡" },
  hard: { label: "Hard", emoji: "🔥" },
};

const REPEAT_META: Record<QuestRepeat, { label: string; emoji: string }> = {
  once: { label: "Once", emoji: "☝️" },
  daily: { label: "Daily", emoji: "☀️" },
  weekdays: { label: "Weekdays", emoji: "📅" },
  weekly: { label: "Weekly", emoji: "🗓️" },
};

function CategoryChips({
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
    <View style={styles.editSheetChipRow}>
      {categories.map((category) => {
        const isSelected = selectedCategory === category.id;
        const label = getCategoryDisplayName(category);
        return (
          <Pressable
            key={category.id}
            onPress={() => onSelect(category.id)}
            accessibilityRole="button"
            accessibilityLabel={`Set quest area to ${label}`}
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.editSheetChip,
              {
                backgroundColor: isSelected
                  ? withAlpha(HOME_GOLD, 0.14)
                  : withAlpha(colors.bg, 0.36),
                borderColor: isSelected
                  ? withAlpha(HOME_GOLD, 0.42)
                  : withAlpha(colors.border, 0.24),
              },
              isSelected && styles.editorChipSelected,
            ]}
          >
            <Text style={styles.editorChipEmoji}>{getCategoryEmoji(category)}</Text>
            <Text
              style={[
                styles.editSheetChipText,
                isSelected ? { color: colors.textPrimary } : { color: colors.textSecondary },
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
  );
}

function DifficultyChips({
  selectedDifficulty,
  onSelect,
}: {
  selectedDifficulty: "easy" | "medium" | "hard";
  onSelect: (difficulty: "easy" | "medium" | "hard") => void;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.editSheetDifficultyRow}>
      {(["easy", "medium", "hard"] as const).map((difficulty) => {
        const isSelected = selectedDifficulty === difficulty;
        const meta = DIFFICULTY_META[difficulty];
        return (
          <Pressable
            key={difficulty}
            onPress={() => onSelect(difficulty)}
            accessibilityRole="button"
            accessibilityLabel={`Set quest intensity to ${difficulty}`}
            accessibilityState={{ selected: isSelected }}
            style={[
              styles.editSheetDifficultyChip,
              {
                backgroundColor: isSelected
                  ? withAlpha(HOME_GOLD, 0.14)
                  : withAlpha(colors.bg, 0.36),
                borderColor: isSelected
                  ? withAlpha(HOME_GOLD, 0.42)
                  : withAlpha(colors.border, 0.24),
              },
              isSelected && styles.editorChipSelected,
            ]}
          >
            <Text style={styles.editorChipEmoji}>{meta.emoji}</Text>
            <Text
              style={[
                styles.editSheetChipText,
                isSelected ? { color: colors.textPrimary } : { color: colors.textSecondary },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RepeatChips({
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
      <View style={styles.editSheetDifficultyRow}>
        {QUEST_REPEAT_OPTIONS.map((repeat) => {
          const isSelected = selectedRepeat === repeat;
          const meta = REPEAT_META[repeat];

          return (
            <Pressable
              key={repeat}
              onPress={() => onRepeatSelect(repeat)}
              accessibilityRole="button"
              accessibilityLabel={`Set quest repeat to ${meta.label}`}
              accessibilityState={{ selected: isSelected }}
              style={[
                styles.editSheetDifficultyChip,
                {
                  backgroundColor: isSelected
                    ? withAlpha(HOME_GOLD, 0.14)
                    : withAlpha(colors.bg, 0.36),
                  borderColor: isSelected
                    ? withAlpha(HOME_GOLD, 0.42)
                    : withAlpha(colors.border, 0.24),
                },
                isSelected && styles.editorChipSelected,
              ]}
            >
              <Text style={styles.editorChipEmoji}>{meta.emoji}</Text>
              <Text
                style={[
                  styles.editSheetChipText,
                  isSelected ? { color: colors.textPrimary } : { color: colors.textSecondary },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedRepeat === "weekly" ? (
        <View style={styles.editSheetWeekdayRow}>
          {WEEKDAY_LABELS.map((label, weekday) => {
            const isSelected = selectedWeekday === weekday;
            return (
              <Pressable
                key={label}
                onPress={() => onWeekdaySelect(weekday)}
                accessibilityRole="button"
                accessibilityLabel={`Schedule quest on ${label}`}
                accessibilityState={{ selected: isSelected }}
                style={[
                  styles.editSheetWeekdayChip,
                  {
                    backgroundColor: isSelected
                      ? withAlpha(HOME_GOLD, 0.14)
                      : withAlpha(colors.bg, 0.36),
                    borderColor: isSelected
                      ? withAlpha(HOME_GOLD, 0.42)
                      : withAlpha(colors.border, 0.24),
                  },
                  isSelected && styles.editorChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.editSheetChipText,
                    isSelected ? { color: colors.textPrimary } : { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
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

export function EditQuestSheet({ quest, categories, onSave, onCancel, reducedMotion }: EditQuestFormProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const [editTitle, setEditTitle] = React.useState(quest.title);
  const [editCategory, setEditCategory] = React.useState(quest.categoryId);
  const [editTarget, setEditTarget] = React.useState(quest.target ?? "");
  const [editDifficulty, setEditDifficulty] = React.useState<"easy" | "medium" | "hard">(
    (quest.difficulty as "easy" | "medium" | "hard") ?? "easy"
  );
  const [editRepeat, setEditRepeat] = React.useState<QuestRepeat>(
    normalizeQuestRepeat(quest.repeat)
  );
  const [editScheduledWeekday, setEditScheduledWeekday] = React.useState(
    normalizeScheduledWeekday(quest.scheduledWeekday)
  );
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [savePressed, setSavePressed] = useState(false);
  const selectedCategory = categories.find((category) => category.id === editCategory);
  const selectedCategoryName = selectedCategory ? getCategoryDisplayName(selectedCategory) : editCategory;
  const repeatSummary = getQuestRepeatLabel({
    repeat: editRepeat,
    scheduledWeekday: editScheduledWeekday,
  });
  const automaticXp = getQuestXpForDifficulty(editDifficulty);
  const titlePreview = editTitle.trim() || "Untitled quest";
  const canSave = editTitle.trim().length > 0;

  useEffect(() => {
    setEditTitle(quest.title);
    setEditCategory(quest.categoryId);
    setEditTarget(quest.target ?? "");
    setEditDifficulty((quest.difficulty as "easy" | "medium" | "hard") ?? "easy");
    setEditRepeat(normalizeQuestRepeat(quest.repeat));
    setEditScheduledWeekday(normalizeScheduledWeekday(quest.scheduledWeekday));
  }, [quest]);

  const handleSave = () => {
    const title = editTitle.trim();
    if (!title) return;

    const normalizedTarget = editTarget.trim();
    const scheduledWeekday =
      editRepeat === "weekly" ? normalizeScheduledWeekday(editScheduledWeekday) : undefined;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave(quest.id, title, editCategory, editDifficulty, normalizedTarget, editRepeat, scheduledWeekday);
  };

  const handleClose = () => {
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

  const handleRepeatChange = (repeat: QuestRepeat) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditRepeat(repeat);
  };

  const handleWeekdayChange = (weekday: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditScheduledWeekday(weekday);
  };

  return (
    <Modal
      visible
      transparent
      animationType={reducedMotion ? "none" : "slide"}
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.editSheetModalRoot}>
        <Pressable
          style={[styles.editSheetBackdrop, { backgroundColor: withAlpha(colors.bg, 0.66) }]}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Close edit quest sheet"
        />
        <KeyboardAvoidingView
          style={styles.editSheetKeyboardWrap}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View
            style={[
              styles.editSheetContainer,
              {
                backgroundColor: colors.surface,
                borderColor: withAlpha(colors.border, 0.3),
                paddingBottom: 0,
              },
            ]}
          >
            <View style={[styles.editSheetGrabber, { backgroundColor: withAlpha(colors.textSecondary, 0.32) }]} />
            <View
              style={[
                styles.editSheetHeader,
                { borderBottomColor: withAlpha(colors.border, 0.24) },
              ]}
            >
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
                  <Text style={styles.editorHeroEmoji}>{getCategoryEmojiById(editCategory)}</Text>
                </View>
                <View style={styles.editSheetTitleGroup}>
                  <Text style={[styles.editSheetKicker, { color: HOME_GOLD }]}>Quest editor</Text>
                  <Text
                    style={[styles.editSheetTitle, { color: colors.textPrimary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {titlePreview}
                  </Text>
                </View>
              </View>
              <Pressable
                style={[
                  styles.editSheetCloseButton,
                  {
                    backgroundColor: withAlpha(colors.bg, 0.44),
                    borderColor: withAlpha(colors.border, 0.22),
                  },
                ]}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close edit quest"
                hitSlop={8}
              >
                <IconSymbol name="xmark" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View
              style={[
                styles.editSheetSummaryRow,
                { borderBottomColor: withAlpha(colors.border, 0.18) },
              ]}
            >
              {[
                { label: selectedCategoryName, emoji: getCategoryEmojiById(editCategory) },
                { label: `${automaticXp} XP`, emoji: DIFFICULTY_META[editDifficulty].emoji },
                { label: repeatSummary, emoji: REPEAT_META[editRepeat].emoji },
              ].map((item) => (
                <View
                  key={item.label}
                  style={[
                    styles.editSheetMetaPill,
                    {
                      backgroundColor: withAlpha(colors.bg, 0.38),
                      borderColor: withAlpha(colors.border, 0.22),
                    },
                  ]}
                >
                  <Text style={styles.editSheetMetaEmoji}>{item.emoji}</Text>
                  <Text
                    style={[styles.editSheetMetaPillText, { color: colors.textSecondary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
              {quest.contract ? (
                <View
                  style={[
                    styles.editSheetMetaPill,
                    {
                      backgroundColor: withAlpha(CONTRACT_GOLD, 0.12),
                      borderColor: withAlpha(CONTRACT_GOLD, 0.32),
                    },
                  ]}
                >
                  <IconSymbol name="shield.fill" size={13} color={CONTRACT_GOLD} />
                  <Text
                    style={[styles.editSheetMetaPillText, { color: CONTRACT_GOLD }]}
                    numberOfLines={1}
                  >
                    Contract
                  </Text>
                </View>
              ) : null}
            </View>

            <ScrollView
              style={styles.editSheetScroll}
              contentContainerStyle={[
                styles.editSheetFormContent,
                { paddingBottom: 6 },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View
                style={[
                  styles.editSheetSectionCard,
                  {
                    backgroundColor: withAlpha(colors.surface2, 0.58),
                    borderColor: withAlpha(colors.border, 0.2),
                  },
                ]}
              >
                <View style={styles.editSheetSectionHeaderLine}>
                  <Text style={[styles.editSheetSectionTitle, { color: HOME_GOLD }]}>Basics</Text>
                  <View style={[styles.editSheetSectionRule, { backgroundColor: withAlpha(HOME_GOLD, 0.34) }]} />
                </View>
                <View style={styles.editSheetFieldBlock}>
                  <Text style={[styles.editSheetLabel, { color: colors.textSecondary }]}>Quest name</Text>
                  <TextInput
                    placeholder="What needs to get done?"
                    placeholderTextColor={withAlpha(colors.textSecondary, 0.72)}
                    value={editTitle}
                    onChangeText={setEditTitle}
                    onFocus={() => setFocusedInput("title")}
                    onBlur={() => setFocusedInput(null)}
                    accessibilityLabel="Quest title"
                    style={[
                      styles.editSheetInput,
                      {
                        backgroundColor: withAlpha(colors.bg, 0.38),
                        borderColor: withAlpha(colors.border, 0.28),
                        borderWidth: 1,
                        color: colors.textPrimary,
                      },
                      focusedInput === "title" && {
                        borderColor: withAlpha(HOME_GOLD, 0.6),
                        borderWidth: 1,
                      },
                    ]}
                  />
                </View>

                <View style={styles.editSheetFieldBlock}>
                  <Text style={[styles.editSheetLabel, { color: colors.textSecondary }]}>Area</Text>
                  <CategoryChips
                    categories={categories}
                    selectedCategory={editCategory}
                    onSelect={handleCategoryChange}
                  />
                </View>
              </View>

              <View
                style={[
                  styles.editSheetSectionCard,
                  {
                    backgroundColor: withAlpha(colors.surface2, 0.58),
                    borderColor: withAlpha(colors.border, 0.2),
                  },
                ]}
              >
                <View style={styles.editSheetSectionHeaderLine}>
                  <Text style={[styles.editSheetSectionTitle, { color: HOME_GOLD }]}>Details</Text>
                  <View style={[styles.editSheetSectionRule, { backgroundColor: withAlpha(HOME_GOLD, 0.34) }]} />
                </View>
                <View style={styles.editSheetFieldBlock}>
                  <Text style={[styles.editSheetLabel, { color: colors.textSecondary }]}>Target</Text>
                  <TextInput
                    placeholder="20 min, 8 cups, $0"
                    placeholderTextColor={withAlpha(colors.textSecondary, 0.72)}
                    value={editTarget}
                    onChangeText={setEditTarget}
                    onFocus={() => setFocusedInput("target")}
                    onBlur={() => setFocusedInput(null)}
                    accessibilityLabel="Quest target"
                    style={[
                      styles.editSheetInput,
                      {
                        backgroundColor: withAlpha(colors.bg, 0.38),
                        borderColor: withAlpha(colors.border, 0.28),
                        borderWidth: 1,
                        color: colors.textPrimary,
                      },
                      focusedInput === "target" && {
                        borderColor: withAlpha(HOME_GOLD, 0.6),
                        borderWidth: 1,
                      },
                    ]}
                  />
                </View>

                <View style={styles.editSheetFieldBlock}>
                  <Text style={[styles.editSheetLabel, { color: colors.textSecondary }]}>Intensity</Text>
                  <DifficultyChips
                    selectedDifficulty={editDifficulty}
                    onSelect={handleDifficultyChange}
                  />
                </View>
              </View>

              <View
                style={[
                  styles.editSheetSectionCard,
                  {
                    backgroundColor: withAlpha(colors.surface2, 0.58),
                    borderColor: withAlpha(colors.border, 0.2),
                  },
                ]}
              >
                <View style={styles.editSheetSectionHeaderLine}>
                  <Text style={[styles.editSheetSectionTitle, { color: HOME_GOLD }]}>Schedule</Text>
                  <View style={[styles.editSheetSectionRule, { backgroundColor: withAlpha(HOME_GOLD, 0.34) }]} />
                </View>
                <View style={styles.editSheetFieldBlock}>
                  <Text style={[styles.editSheetLabel, { color: colors.textSecondary }]}>Repeat</Text>
                  <RepeatChips
                    selectedRepeat={editRepeat}
                    selectedWeekday={editScheduledWeekday}
                    onRepeatSelect={handleRepeatChange}
                    onWeekdaySelect={handleWeekdayChange}
                  />
                </View>
              </View>
            </ScrollView>

            <View
              style={[
                styles.editSheetActionBar,
                {
                  backgroundColor: colors.surface,
                  borderTopColor: withAlpha(colors.border, 0.2),
                  paddingBottom: Math.max(insets.bottom, 22),
                },
              ]}
            >
              <Pressable
                onPress={handleSave}
                onPressIn={() => setSavePressed(true)}
                onPressOut={() => setSavePressed(false)}
                accessibilityRole="button"
                accessibilityLabel="Save quest changes"
                style={[
                  styles.editSheetPrimaryButton,
                  { backgroundColor: HOME_GOLD },
                  !canSave && { opacity: 0.48 },
                  savePressed && styles.btnPressed,
                ]}
                disabled={!canSave}
              >
                <Text style={[styles.editSheetPrimaryButtonText, { color: colors.bg }]}>Save quest</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function EditQuestForm(props: EditQuestFormProps) {
  return <EditQuestSheet {...props} />;
}
