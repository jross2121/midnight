import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import { Alert, Animated, Easing, Pressable, Text, View } from "react-native";
import { CONTRACT_GOLD, HOME_GOLD, createStyles } from "../_styles";
import { getCategoryArtById } from "../_utils/categoryArt";
import { withAlpha } from "../_utils/designSystem";
import { getQuestRepeatLabel } from "../_utils/recurrence";
import { useTheme } from "../_utils/themeContext";
import type { Quest } from "../_utils/types";

interface QuestCardProps {
  quest: Quest;
  categoryName: string;
  isOpen: boolean;
  onToggle: (questId: string) => void;
  onComplete: (questId: string) => void;
  onEdit: (questId: string) => void;
  onContract: (questId: string) => void;
  onDelete: (questId: string) => void;
}

export const QuestCard = React.memo(function QuestCard({
  quest,
  categoryName,
  isOpen,
  onToggle,
  onComplete,
  onEdit,
  onContract,
  onDelete,
}: QuestCardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [editPressed, setEditPressed] = useState(false);
  const [contractPressed, setContractPressed] = useState(false);
  const [deletePressed, setDeletePressed] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const categoryArt = getCategoryArtById(quest.categoryId);
  const questAccent = quest.contract ? CONTRACT_GOLD : categoryArt.color;

  const flashOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardTranslateY = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0.4)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;

  const handleComplete = () => {
    if (quest.done || isCompleting) return;

    setIsCompleting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const duration = 340;
    Animated.parallel([
      Animated.sequence([
        Animated.timing(flashOpacity, {
          toValue: 0.42,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(flashOpacity, {
          toValue: 0,
          duration: 230,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.parallel([
          Animated.timing(checkScale, {
            toValue: 1.12,
            duration: 150,
            easing: Easing.out(Easing.back(1.4)),
            useNativeDriver: true,
          }),
          Animated.timing(checkOpacity, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(checkScale, {
          toValue: 1,
          duration: 120,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 0.96,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(cardTranslateY, {
        toValue: -8,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onComplete(quest.id);

      requestAnimationFrame(() => {
        setIsCompleting(false);
        flashOpacity.setValue(0);
        cardOpacity.setValue(1);
        cardScale.setValue(1);
        cardTranslateY.setValue(0);
        checkScale.setValue(0.4);
        checkOpacity.setValue(0);
      });
    });
  };

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEdit(quest.id);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete quest?",
      `"${quest.title}" will move out of today's queue. You can restore it later from Settings.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onDelete(quest.id);
          },
        },
      ]
    );
  };

  const handleContract = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onContract(quest.id);
  };

  const handleToggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(quest.id);
  };

  return (
    <Animated.View
      style={[
        styles.questCard,
        { borderColor: withAlpha(colors.border, 0.28) },
        quest.contract && !quest.done && styles.questContract,
        quest.done && styles.questDone,
        {
          opacity: cardOpacity,
          transform: [{ scale: cardScale }, { translateY: cardTranslateY }],
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.questCompletionFlashOverlay,
          { backgroundColor: HOME_GOLD, opacity: flashOpacity },
        ]}
      />
      {quest.contract && !quest.done ? <View pointerEvents="none" style={styles.questContractRail} /> : null}

      <View style={styles.questHeader}>
        <Pressable
          style={({ pressed }) => [
            styles.questCompleteToggle,
            pressed && styles.questHeaderPressed,
            isCompleting && styles.questHeaderPressed,
          ]}
          onPress={handleComplete}
          hitSlop={8}
          disabled={isCompleting}
          accessibilityRole="button"
          accessibilityLabel={
            quest.done ? `${quest.title} is complete` : `Complete ${quest.title}`
          }
          accessibilityState={{ checked: quest.done, disabled: isCompleting }}
          accessibilityHint={quest.done ? undefined : "Marks this quest complete"}
        >
          <View
            style={[
              styles.questCheckBox,
              {
                backgroundColor: quest.done ? HOME_GOLD : withAlpha(questAccent, 0.06),
                borderColor: quest.done ? HOME_GOLD : withAlpha(questAccent, 0.62),
              },
            ]}
          >
            {quest.done ? <IconSymbol name="checkmark" size={19} color={colors.bg} /> : null}
            {!quest.done && (
              <Animated.View
                style={[
                  styles.questCompleteAnimatedCheck,
                  { opacity: checkOpacity, transform: [{ scale: checkScale }] },
                ]}
              >
                <IconSymbol name="checkmark" size={18} color={HOME_GOLD} />
              </Animated.View>
            )}
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.questHeaderMain, pressed && styles.questHeaderPressed]}
          onPress={handleToggleExpanded}
          accessibilityRole="button"
          accessibilityLabel={`${isOpen ? "Collapse" : "Expand"} actions for ${quest.title}`}
          accessibilityHint="Shows edit, contract, and delete actions"
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.questTitle, { color: colors.textPrimary }, quest.done && styles.questTitleDone]}>
              {quest.title}
            </Text>
            <Text
              style={[
                styles.questMetaSingleLine,
                { color: colors.textSecondary },
                quest.done && styles.questMetaDone,
              ]}
            >
              {getQuestRepeatLabel(quest)} / {`${quest.difficulty.charAt(0).toUpperCase()}${quest.difficulty.slice(1)}`} / {categoryName} / {quest.xp} XP
            </Text>
          </View>

          <View style={styles.questStatusStack}>
            {!quest.done && quest.contract ? (
              <Text
                style={[
                  styles.statusPill,
                  { color: CONTRACT_GOLD, backgroundColor: withAlpha(CONTRACT_GOLD, 0.1) },
                ]}
              >
                CONTRACT
              </Text>
            ) : null}
            <IconSymbol
              name="chevron.right"
              size={18}
              color={colors.textSecondary}
              style={[styles.questChevron, isOpen && styles.questChevronOpen]}
            />
          </View>
        </Pressable>
      </View>

      {isOpen && !isCompleting && (
        <>
          <View style={styles.questDivider} />
          <View style={styles.questActionsRow}>
            {!quest.done && (
              <Pressable
                style={[
                  styles.questActionBtnPrimary,
                  { backgroundColor: withAlpha(HOME_GOLD, 0.12), borderColor: withAlpha(HOME_GOLD, 0.38) },
                ]}
                onPress={handleComplete}
                accessibilityRole="button"
                accessibilityLabel={`Complete ${quest.title}`}
              >
                <Text style={[styles.questActionTextPrimary, { color: HOME_GOLD }]}>Complete</Text>
              </Pressable>
            )}

            <Pressable
              style={[
                styles.questActionToolBtn,
                { backgroundColor: withAlpha(colors.bg, 0.35), borderColor: withAlpha(colors.border, 0.28) },
                editPressed && styles.btnPressed,
              ]}
              onPress={handleEdit}
              onPressIn={() => setEditPressed(true)}
              onPressOut={() => setEditPressed(false)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${quest.title}`}
            >
              <IconSymbol name="pencil" size={17} color={colors.textSecondary} />
            </Pressable>

            <Pressable
              style={[
                styles.questActionToolBtn,
                quest.contract
                  ? { backgroundColor: withAlpha(CONTRACT_GOLD, 0.1), borderColor: withAlpha(CONTRACT_GOLD, 0.38) }
                  : { backgroundColor: withAlpha(colors.bg, 0.35), borderColor: withAlpha(colors.border, 0.28) },
                contractPressed && styles.btnPressed,
              ]}
              onPress={handleContract}
              onPressIn={() => setContractPressed(true)}
              onPressOut={() => setContractPressed(false)}
              accessibilityRole="button"
              accessibilityLabel={`${quest.contract ? "Remove contract from" : "Make contract"} ${quest.title}`}
            >
              <IconSymbol name="shield.fill" size={17} color={quest.contract ? CONTRACT_GOLD : colors.textSecondary} />
            </Pressable>

            <Pressable
              style={[
                styles.questActionToolBtn,
                { backgroundColor: withAlpha(colors.negative, 0.1), borderColor: withAlpha(colors.negative, 0.32) },
                deletePressed && styles.btnPressed,
              ]}
              onPress={handleDelete}
              onPressIn={() => setDeletePressed(true)}
              onPressOut={() => setDeletePressed(false)}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${quest.title}`}
            >
              <IconSymbol name="trash.fill" size={17} color={colors.negative} />
            </Pressable>
          </View>
        </>
      )}
    </Animated.View>
  );
});
