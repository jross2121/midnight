import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
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

  const handleComplete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onComplete(quest.id);
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
    <View style={[styles.questCard, { borderColor: colors.border }, quest.done && styles.questDone]}>
      <View style={styles.questHeader}>
        <Pressable
          style={({ pressed }) => [styles.questCompleteToggle, pressed && styles.questHeaderPressed]}
          onPress={handleComplete}
          hitSlop={8}
        >
          <IconSymbol
            name={quest.done ? "checkmark.circle.fill" : "circle"}
            size={19}
            color={quest.done ? colors.accentPrimary : colors.textSecondary}
          />
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

      {isOpen && (
        <>
          <View style={styles.questDivider} />
          <View style={styles.questActionsRow}>
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
    </View>
  );
});
