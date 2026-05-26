import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CONTRACT_GOLD, HOME_GOLD, createStyles } from "../_styles";
import { getCategoryDisplayName } from "../_utils/categoryLabels";
import { withAlpha } from "../_utils/designSystem";
import { getQuestXpForDifficulty } from "../_utils/questXp";
import {
  getQuestRepeatLabel,
  normalizeQuestRepeat,
  normalizeScheduledWeekday,
  QUEST_REPEAT_OPTIONS,
  WEEKDAY_LABELS,
} from "../_utils/recurrence";
import { useTheme } from "../_utils/themeContext";
import type { Category, Quest, QuestRepeat } from "../_utils/types";

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
}

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
        return (
          <Pressable
            key={category.id}
            onPress={() => onSelect(category.id)}
            accessibilityRole="button"
            accessibilityLabel={`Set quest area to ${getCategoryDisplayName(category)}`}
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
            ]}
          >
            <Text
              style={[
                styles.editSheetChipText,
                isSelected ? { color: colors.textPrimary } : { color: colors.textSecondary },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {getCategoryDisplayName(category)}
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
        return (
          <Pressable
            key={difficulty}
            onPress={() => onSelect(difficulty)}
            accessibilityRole="button"
            accessibilityLabel={`Set quest intensity to ${difficulty}`}
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
            ]}
          >
            <Text
              style={[
                styles.editSheetChipText,
                isSelected ? { color: colors.textPrimary } : { color: colors.textSecondary },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
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
              onPress={() => onRepeatSelect(repeat)}
              accessibilityRole="button"
              accessibilityLabel={`Set quest repeat to ${label}`}
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
              ]}
            >
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

export function EditQuestSheet({ quest, categories, onSave, onCancel }: EditQuestFormProps) {
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
  const [actionBarHeight, setActionBarHeight] = useState(0);
  const selectedCategory = categories.find((category) => category.id === editCategory);
  const selectedCategoryName = selectedCategory ? getCategoryDisplayName(selectedCategory) : editCategory;
  const repeatSummary = getQuestRepeatLabel({
    repeat: editRepeat,
    scheduledWeekday: editScheduledWeekday,
  });
  const automaticXp = getQuestXpForDifficulty(editDifficulty);
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

  const handleActionBarLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    if (nextHeight !== actionBarHeight) {
      setActionBarHeight(nextHeight);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
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
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={[
              styles.editSheetContainer,
              {
                backgroundColor: colors.surface,
                borderColor: withAlpha(colors.border, 0.3),
                paddingBottom: insets.bottom,
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
              <View style={styles.editSheetTitleGroup}>
                <Text style={[styles.editSheetKicker, { color: HOME_GOLD }]}>Quest Editor</Text>
                <Text
                  style={[styles.editSheetTitle, { color: colors.textPrimary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  Edit Quest
                </Text>
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
              >
                <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>
            <View
              style={[
                styles.editSheetSummaryRow,
                { borderBottomColor: withAlpha(colors.border, 0.18) },
              ]}
            >
              {[selectedCategoryName, `${automaticXp} XP`, repeatSummary].map((item) => (
                <View
                  key={item}
                  style={[
                    styles.editSheetMetaPill,
                    {
                      backgroundColor: withAlpha(colors.bg, 0.38),
                      borderColor: withAlpha(colors.border, 0.22),
                    },
                  ]}
                >
                  <Text
                    style={[styles.editSheetMetaPillText, { color: colors.textSecondary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {item}
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
                { paddingBottom: actionBarHeight + insets.bottom },
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
                <Text style={[styles.editSheetSectionTitle, { color: colors.textPrimary }]}>Basics</Text>
                <View style={styles.editSheetFieldBlock}>
                  <Text style={[styles.editSheetLabel, { color: colors.textSecondary }]}>Title</Text>
                  <TextInput
                    placeholder="Quest title"
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
                <Text style={[styles.editSheetSectionTitle, { color: colors.textPrimary }]}>Details</Text>
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
                <Text style={[styles.editSheetSectionTitle, { color: colors.textPrimary }]}>Schedule</Text>
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
                  borderTopColor: withAlpha(colors.border, 0.24),
                  paddingBottom: insets.bottom,
                },
              ]}
              onLayout={handleActionBarLayout}
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
                <Text style={[styles.editSheetPrimaryButtonText, { color: colors.bg }]}>Save Changes</Text>
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
