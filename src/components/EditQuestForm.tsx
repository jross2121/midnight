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
import {
  QuestCategoryOptions,
  QuestDifficultyOptions,
  QuestRepeatOptions,
} from "@/src/components/QuestEditorOptions";
import { CONTRACT_GOLD, HOME_GOLD, createStyles } from "@/src/styles";
import { getCategoryArtById } from "@/src/utils/categoryArt";
import { getCategoryDisplayName } from "@/src/utils/categoryLabels";
import { withAlpha } from "@/src/utils/designSystem";
import { getQuestXpForDifficulty } from "@/src/utils/questXp";
import {
  getQuestRepeatLabel,
  normalizeQuestRepeat,
  normalizeScheduledWeekday,
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
  const selectedCategoryColor = getCategoryArtById(editCategory).color;
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
                  <IconSymbol name="pencil" size={18} color={HOME_GOLD} />
                </View>
                <View style={styles.editSheetTitleGroup}>
                  <Text style={[styles.editSheetKicker, { color: HOME_GOLD }]}>Edit quest</Text>
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
              <View
                style={[
                  styles.editSheetMetaPill,
                  {
                    backgroundColor: withAlpha(selectedCategoryColor, 0.1),
                    borderColor: withAlpha(selectedCategoryColor, 0.3),
                  },
                ]}
              >
                <View style={[styles.editorMetaDot, { backgroundColor: selectedCategoryColor }]} />
                <Text style={[styles.editSheetMetaPillText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {selectedCategoryName}
                </Text>
              </View>
              <View
                style={[
                  styles.editSheetMetaPill,
                  {
                    backgroundColor: withAlpha(colors.bg, 0.38),
                    borderColor: withAlpha(colors.border, 0.22),
                  },
                ]}
              >
                <IconSymbol name="star.fill" size={12} color={HOME_GOLD} />
                <Text style={[styles.editSheetMetaPillText, { color: colors.textSecondary }]}>
                  {automaticXp} XP
                </Text>
              </View>
              <View
                style={[
                  styles.editSheetMetaPill,
                  {
                    backgroundColor: withAlpha(colors.bg, 0.38),
                    borderColor: withAlpha(colors.border, 0.22),
                  },
                ]}
              >
                <IconSymbol name="calendar" size={12} color={colors.textSecondary} />
                <Text style={[styles.editSheetMetaPillText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {repeatSummary}
                </Text>
              </View>
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
                  <IconSymbol name="shield.fill" size={12} color={CONTRACT_GOLD} />
                  <Text style={[styles.editSheetMetaPillText, { color: CONTRACT_GOLD }]}>
                    Contract
                  </Text>
                </View>
              ) : null}
            </View>

            <ScrollView
              style={styles.editSheetScroll}
              contentContainerStyle={[styles.editSheetFormContent, { paddingBottom: 8 }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.editorIntroText, { color: colors.textSecondary }]}>
                Refine the mission without changing its progress.
              </Text>
              <View
                style={[
                  styles.editorFormSurface,
                  {
                    backgroundColor: withAlpha(colors.surface2, 0.58),
                    borderColor: withAlpha(colors.border, 0.2),
                  },
                ]}
              >
                <View style={styles.editorFieldBlock}>
                  <View style={styles.editorFieldHeader}>
                    <Text style={[styles.editSheetLabel, { color: colors.textSecondary }]}>Quest name</Text>
                    <Text style={[styles.editorFieldHint, { color: colors.textSecondary }]}>Required</Text>
                  </View>
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
                      focusedInput === "title" && { borderColor: withAlpha(HOME_GOLD, 0.6) },
                    ]}
                  />
                </View>

                <View style={styles.editorFieldBlock}>
                  <View style={styles.editorFieldHeader}>
                    <Text style={[styles.editSheetLabel, { color: colors.textSecondary }]}>Target</Text>
                    <Text style={[styles.editorFieldHint, { color: colors.textSecondary }]}>Optional</Text>
                  </View>
                  <TextInput
                    placeholder="20 min, 8 cups, $25"
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
                      focusedInput === "target" && { borderColor: withAlpha(HOME_GOLD, 0.6) },
                    ]}
                  />
                </View>

                <View style={styles.editorFieldBlock}>
                  <View style={styles.editorFieldHeader}>
                    <Text style={[styles.editSheetLabel, { color: colors.textSecondary }]}>Area</Text>
                    <Text style={[styles.editorFieldHint, { color: colors.textSecondary }]}>Where it counts</Text>
                  </View>
                  <QuestCategoryOptions
                    categories={categories}
                    selectedCategory={editCategory}
                    onSelect={handleCategoryChange}
                  />
                </View>

                <View style={styles.editorFieldBlock}>
                  <View style={styles.editorFieldHeader}>
                    <Text style={[styles.editSheetLabel, { color: colors.textSecondary }]}>Intensity</Text>
                    <Text style={[styles.editorFieldHint, { color: HOME_GOLD }]}>{automaticXp} XP</Text>
                  </View>
                  <QuestDifficultyOptions
                    selectedDifficulty={editDifficulty}
                    onSelect={handleDifficultyChange}
                  />
                </View>

                <View style={styles.editorFieldBlock}>
                  <View style={styles.editorFieldHeader}>
                    <Text style={[styles.editSheetLabel, { color: colors.textSecondary }]}>Schedule</Text>
                    <Text style={[styles.editorFieldHint, { color: colors.textSecondary }]}>How often</Text>
                  </View>
                  <QuestRepeatOptions
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
                <View style={styles.editorButtonContent}>
                  <IconSymbol name="checkmark" size={17} color={colors.bg} />
                  <Text style={[styles.editSheetPrimaryButtonText, { color: colors.bg }]}>Save changes</Text>
                </View>
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
