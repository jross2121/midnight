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
  const [completePressed, setCompletePressed] = useState(false);
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
      <Pressable
        style={({ pressed }) => [styles.questHeader, pressed && styles.questHeaderPressed]}
        onPress={handleToggleExpanded}
      >
        <IconSymbol
          name={quest.done ? "checkmark.circle.fill" : "circle"}
          size={18}
          color={quest.done ? colors.accentPrimary : colors.textSecondary}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.questTitle, { color: colors.textPrimary }, quest.done && styles.questTitleDone]}>
            {quest.title}
          </Text>
          <View style={styles.questMetaRow}>
            {(() => {
              const diff = typeof quest.difficulty === "string" ? quest.difficulty : "easy";
              const label = diff.charAt(0).toUpperCase();
              return (
                <Text style={[styles.questMetaDifficulty, { color: colors.textSecondary }]}>• {label}</Text>
              );
            })()}
            <Text style={[styles.questMetaCategory, { color: colors.textSecondary }]}>{categoryName}</Text>
          </View>
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

      {isOpen && (
        <>
          <View style={styles.questDivider} />
          <View style={styles.questActionsRow}>
          {!quest.done && (
            <Pressable
              style={[styles.questActionBtn, { backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary }, completePressed && styles.btnPressed]}
              onPress={handleComplete}
              onPressIn={() => setCompletePressed(true)}
              onPressOut={() => setCompletePressed(false)}
            >
              <Text style={[styles.questActionText, { color: colors.textPrimary }]}>Complete</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.questActionBtn, { backgroundColor: colors.bg, borderColor: colors.border }, editPressed && styles.btnPressed]}
            onPress={handleEdit}
            onPressIn={() => setEditPressed(true)}
            onPressOut={() => setEditPressed(false)}
          >
            <Text style={[styles.questActionText, { color: colors.textPrimary }]}>Edit</Text>
          </Pressable>
          <Pressable
            style={[
              styles.questActionBtn,
              quest.pinned
                ? { backgroundColor: colors.accentPrimary, borderColor: colors.accentPrimary }
                : { backgroundColor: colors.bg, borderColor: colors.border },
              pinPressed && styles.btnPressed,
            ]}
            onPress={handlePin}
            onPressIn={() => setPinPressed(true)}
            onPressOut={() => setPinPressed(false)}
          >
            {quest.pinned ? (
              <IconSymbol name="pin.fill" size={14} color={colors.textPrimary} />
            ) : (
              <Text style={[styles.questActionText, { color: colors.textSecondary }]}>Pin</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.questActionBtn, { backgroundColor: `${colors.accentPrimary}1A`, borderColor: colors.accentPrimary }, deletePressed && styles.btnPressed]}
            onPress={handleDelete}
            onPressIn={() => setDeletePressed(true)}
            onPressOut={() => setDeletePressed(false)}
          >
            <Text style={[styles.questActionText, { color: colors.accentPrimary }]}>Delete</Text>
          </Pressable>
          </View>
        </>
      )}
    </View>
  );
});
