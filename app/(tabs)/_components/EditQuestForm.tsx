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
import { createStyles } from "../_styles";
import { withAlpha } from "../_utils/designSystem";
import { useTheme } from "../_utils/themeContext";
import type { Category, Quest } from "../_utils/types";

interface EditQuestFormProps {
  quest: Quest;
  categories: Category[];
  onSave: (
    questId: string,
    title: string,
    categoryId: string,
    xp: number,
    difficulty: "easy" | "medium" | "hard",
    target: string
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
            style={[
              styles.editSheetChip,
              isSelected
                ? { backgroundColor: colors.accentPrimary }
                : { backgroundColor: colors.surface, borderColor: "transparent" },
            ]}
          >
            <Text
              style={[
                styles.editSheetChipText,
                isSelected ? { color: colors.bg } : { color: colors.textSecondary },
              ]}
            >
              {category.name}
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
            style={[
              styles.editSheetDifficultyChip,
              isSelected
                ? { backgroundColor: colors.accentPrimary }
                : { backgroundColor: colors.surface, borderColor: "transparent" },
            ]}
          >
            <Text
              style={[
                styles.editSheetChipText,
                isSelected ? { color: colors.bg } : { color: colors.textSecondary },
              ]}
            >
              {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [savePressed, setSavePressed] = useState(false);
  const [actionBarHeight, setActionBarHeight] = useState(0);

  useEffect(() => {
    setEditTitle(quest.title);
    setEditCategory(quest.categoryId);
    setEditTarget(quest.target ?? "");
    setEditDifficulty((quest.difficulty as "easy" | "medium" | "hard") ?? "easy");
  }, [quest]);

  const handleSave = () => {
    const title = editTitle.trim();
    if (!title) return;

    const normalizedTarget = editTarget.trim();
    const targetDigits = normalizedTarget.replace(/[^0-9]/g, "");
    const xpNum = Number(targetDigits);
    const safeXP = Number.isFinite(xpNum) && xpNum > 0 ? Math.floor(xpNum) : quest.xp;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSave(quest.id, title, editCategory, safeXP, editDifficulty, normalizedTarget);
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
                backgroundColor: colors.surface2,
                borderColor: withAlpha(colors.border, 0.3),
                paddingBottom: insets.bottom,
              },
            ]}
          >
            <View
              style={[
                styles.editSheetHeader,
                { borderBottomColor: withAlpha(colors.border, 0.24) },
              ]}
            >
              <Text style={[styles.editSheetTitle, { color: colors.textPrimary }]}>Edit Quest</Text>
              <Pressable
                style={[styles.editSheetCloseButton, { backgroundColor: colors.surface }]}
                onPress={handleClose}
                accessibilityRole="button"
                accessibilityLabel="Close edit quest"
              >
                <Text style={[styles.editSheetCloseText, { color: colors.textSecondary }]}>×</Text>
              </Pressable>
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
              <View style={styles.editSheetFieldBlock}>
                <Text style={[styles.editSheetLabel, { color: colors.textSecondary }]}>Title</Text>
                <TextInput
                  placeholder="Quest title"
                  placeholderTextColor={colors.textSecondary}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  onFocus={() => setFocusedInput("title")}
                  onBlur={() => setFocusedInput(null)}
                  style={[
                    styles.editSheetInput,
                    {
                      backgroundColor: colors.surface,
                      color: colors.textPrimary,
                    },
                    focusedInput === "title" && {
                      borderColor: withAlpha(colors.accentPrimary, 0.6),
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

              <View style={styles.editSheetFieldBlock}>
                <Text style={[styles.editSheetLabel, { color: colors.textSecondary }]}>Target (optional)</Text>
                <TextInput
                  placeholder="20 min, 8 cups, $0"
                  placeholderTextColor={colors.textSecondary}
                  value={editTarget}
                  onChangeText={setEditTarget}
                  onFocus={() => setFocusedInput("target")}
                  onBlur={() => setFocusedInput(null)}
                  style={[
                    styles.editSheetInput,
                    {
                      backgroundColor: colors.surface,
                      color: colors.textPrimary,
                    },
                    focusedInput === "target" && {
                      borderColor: withAlpha(colors.accentPrimary, 0.6),
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
                  { backgroundColor: colors.accentPrimary },
                  savePressed && styles.btnPressed,
                ]}
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
