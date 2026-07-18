import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import { Alert, Animated, Easing, Pressable, Text, View } from "react-native";
import { CONTRACT_GOLD, HOME_GOLD, createStyles } from "@/src/styles";
import { getCategoryArtById } from "@/src/utils/categoryArt";
import { withAlpha } from "@/src/utils/designSystem";
import { getQuestRepeatLabel } from "@/src/utils/recurrence";
import { useTheme } from "@/src/utils/themeContext";
import type { Quest } from "@/src/utils/types";

interface QuestCardProps {
  quest: Quest;
  categoryName: string;
  isOpen: boolean;
  onToggle: (questId: string) => void;
  onComplete: (questId: string) => void;
  onUncomplete: (questId: string) => void;
  onEdit: (questId: string) => void;
  onContract: (questId: string) => void;
  onDelete: (questId: string) => void;
  onPrioritize: (questId: string) => void;
  onDuplicate: (questId: string) => void;
  onDoTomorrow: (questId: string) => void;
  reducedMotion: boolean;
}

export const QuestCard = React.memo(function QuestCard({
  quest,
  categoryName,
  isOpen,
  onToggle,
  onComplete,
  onUncomplete,
  onEdit,
  onContract,
  onDelete,
  onPrioritize,
  onDuplicate,
  onDoTomorrow,
  reducedMotion,
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
    if (isCompleting) return;
    if (quest.done) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onUncomplete(quest.id);
      return;
    }

    setIsCompleting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (reducedMotion) {
      onComplete(quest.id);
      setIsCompleting(false);
      return;
    }

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
      "Archive quest?",
      `“${quest.title}” will leave your active plan and move to the archive in Settings. Its earned history will remain.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
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
          accessibilityRole="checkbox"
          accessibilityLabel={
            quest.done ? `Reopen ${quest.title}` : `Complete ${quest.title}`
          }
          accessibilityState={{ checked: quest.done, disabled: isCompleting }}
          accessibilityHint={quest.done ? "Reverses today's completion and earned rewards" : "Marks this quest complete"}
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
          accessibilityHint="Shows priority, edit, contract, scheduling, duplicate, and archive actions"
          accessibilityState={{ expanded: isOpen }}
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
            {!quest.done && quest.pinned ? (
              <Text
                style={[
                  styles.statusPill,
                  { color: HOME_GOLD, backgroundColor: withAlpha(HOME_GOLD, 0.1) },
                ]}
              >
                NEXT
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
            {quest.done ? (
              <Pressable
                style={[
                  styles.questActionBtnPrimary,
                  { backgroundColor: withAlpha(HOME_GOLD, 0.12), borderColor: withAlpha(HOME_GOLD, 0.38) },
                ]}
                onPress={handleComplete}
                accessibilityRole="button"
                accessibilityLabel={`Reopen ${quest.title}`}
              >
                <Text style={[styles.questActionTextPrimary, { color: HOME_GOLD }]}>Reopen</Text>
              </Pressable>
            ) : (
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

            {!quest.done ? (
              <Pressable
                style={[
                  styles.questActionToolBtn,
                  quest.pinned
                    ? { backgroundColor: withAlpha(HOME_GOLD, 0.1), borderColor: withAlpha(HOME_GOLD, 0.38) }
                    : { backgroundColor: withAlpha(colors.bg, 0.35), borderColor: withAlpha(colors.border, 0.28) },
                ]}
                onPress={() => onPrioritize(quest.id)}
                accessibilityRole="button"
                accessibilityLabel={quest.pinned ? `Remove ${quest.title} as next quest` : `Make ${quest.title} the next quest`}
                accessibilityState={{ selected: Boolean(quest.pinned) }}
              >
                <IconSymbol name="flag.fill" size={17} color={quest.pinned ? HOME_GOLD : colors.textSecondary} />
              </Pressable>
            ) : null}

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
                { backgroundColor: withAlpha(colors.bg, 0.35), borderColor: withAlpha(colors.border, 0.28) },
                deletePressed && styles.btnPressed,
              ]}
              onPress={handleDelete}
              onPressIn={() => setDeletePressed(true)}
              onPressOut={() => setDeletePressed(false)}
              accessibilityRole="button"
              accessibilityLabel={`Archive ${quest.title}`}
            >
              <IconSymbol name="archivebox.fill" size={17} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.questSecondaryActionsRow}>
            <Pressable
              style={[styles.questActionBtnSubtle, { borderColor: withAlpha(colors.border, 0.3) }]}
              onPress={() => onDuplicate(quest.id)}
              accessibilityRole="button"
              accessibilityLabel={`Duplicate ${quest.title}`}
            >
              <Text style={[styles.questActionTextSubtle, { color: colors.textSecondary }]}>Duplicate</Text>
            </Pressable>
            <Pressable
              style={[styles.questActionBtnSubtle, { borderColor: withAlpha(HOME_GOLD, 0.34) }]}
              onPress={() => onDoTomorrow(quest.id)}
              accessibilityRole="button"
              accessibilityLabel={`Do ${quest.title} again tomorrow`}
            >
              <Text style={[styles.questActionTextSubtle, { color: HOME_GOLD }]}>Do tomorrow</Text>
            </Pressable>
          </View>
        </>
      )}
    </Animated.View>
  );
});
