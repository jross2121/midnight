import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { createStyles } from "../_styles";
import { useTheme } from "../_utils/themeContext";
import type { Quest } from "../_utils/types";

interface QuestCardProps {
  quest: Quest;
  categoryName: string;
  isOpen: boolean;
  onToggle: (questId: string) => void;
  onComplete: (questId: string) => void;
  onEdit: (questId: string) => void;
  onPin: (questId: string) => void;
  onDelete: (questId: string) => void;
}

export const QuestCard = React.memo(function QuestCard({
  quest,
  categoryName,
  isOpen,
  onToggle,
  onComplete,
  onEdit,
  onPin,
  onDelete,
}: QuestCardProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [editPressed, setEditPressed] = useState(false);
  const [pinPressed, setPinPressed] = useState(false);
  const [deletePressed, setDeletePressed] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

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
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDelete(quest.id);
  };

  const handlePin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPin(quest.id);
  };

  const handleToggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(quest.id);
  };

  return (
    <Animated.View
      style={[
        styles.questCard,
        { borderColor: colors.border },
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
          { backgroundColor: colors.accentPrimary, opacity: flashOpacity },
        ]}
      />

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
        >
          <View style={styles.questCompleteIconWrap}>
            <IconSymbol
              name={quest.done ? "checkmark.circle.fill" : "circle"}
              size={19}
              color={quest.done ? colors.accentPrimary : colors.textSecondary}
            />
            {!quest.done && (
              <Animated.View
                style={[
                  styles.questCompleteAnimatedCheck,
                  { opacity: checkOpacity, transform: [{ scale: checkScale }] },
                ]}
              >
                <IconSymbol name="checkmark.circle.fill" size={19} color={colors.accentPrimary} />
              </Animated.View>
            )}
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.questHeaderMain, pressed && styles.questHeaderPressed]}
          onPress={handleToggleExpanded}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.questTitle, { color: colors.textPrimary }, quest.done && styles.questTitleDone]}>
              {quest.title}
            </Text>
            <Text style={[styles.questMetaSingleLine, { color: colors.textSecondary }]}>
              {categoryName} • {`${quest.difficulty.charAt(0).toUpperCase()}${quest.difficulty.slice(1)}`}
            </Text>
          </View>

          <View style={styles.questStatusStack}>
            {quest.pinned && (
              <View style={[styles.statusPillIcon, { backgroundColor: `${colors.accentPrimary}1A` }]}>
                <IconSymbol name="pin.fill" size={12} color={colors.accentPrimary} />
              </View>
            )}
            {quest.done && (
              <Text style={[styles.statusPill, { color: colors.accentPrimary }]}>DONE</Text>
            )}
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
                  { backgroundColor: `${colors.accentPrimary}20`, borderColor: colors.accentPrimary },
                ]}
                onPress={handleComplete}
              >
                <Text style={[styles.questActionTextPrimary, { color: colors.accentPrimary }]}>Complete</Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.questActionBtnSubtle, { backgroundColor: colors.bg, borderColor: colors.border }, editPressed && styles.btnPressed]}
              onPress={handleEdit}
              onPressIn={() => setEditPressed(true)}
              onPressOut={() => setEditPressed(false)}
            >
              <Text style={[styles.questActionTextSubtle, { color: colors.textSecondary }]}>Edit</Text>
            </Pressable>

            <Pressable
              style={[
                styles.questActionBtnSubtle,
                quest.pinned
                  ? { backgroundColor: `${colors.accentPrimary}1A`, borderColor: colors.accentPrimary }
                  : { backgroundColor: colors.bg, borderColor: colors.border },
                pinPressed && styles.btnPressed,
              ]}
              onPress={handlePin}
              onPressIn={() => setPinPressed(true)}
              onPressOut={() => setPinPressed(false)}
            >
              <Text style={[styles.questActionTextSubtle, { color: quest.pinned ? colors.accentPrimary : colors.textSecondary }]}>
                {quest.pinned ? "Pinned" : "Pin"}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.questActionBtnSubtle, { backgroundColor: colors.bg, borderColor: colors.accentPrimary }, deletePressed && styles.btnPressed]}
              onPress={handleDelete}
              onPressIn={() => setDeletePressed(true)}
              onPressOut={() => setDeletePressed(false)}
            >
              <Text style={[styles.questActionTextSubtle, { color: colors.accentPrimary }]}>Delete</Text>
            </Pressable>
          </View>
        </>
      )}
    </Animated.View>
  );
});
