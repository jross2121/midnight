import { styles } from "@/app/(tabs)/styles";
import { useTheme } from "@/app/(tabs)/utils/themeContext";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { Quest } from "../utils/types";

interface QuestCardProps {
  quest: Quest;
  categoryName: string;
  onComplete: (questId: string) => void;
  onEdit: (questId: string) => void;
  onPin: (questId: string) => void;
  onDelete: (questId: string) => void;
}

export function QuestCard({ quest, categoryName, onComplete, onEdit, onPin, onDelete }: QuestCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
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
    setExpanded((prev) => !prev);
  };

  const getDifficultyStyle = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return styles.difficultyEasy;
      case "medium":
        return styles.difficultyMedium;
      case "hard":
        return styles.difficultyHard;
      default:
        return styles.difficultyEasy;
    }
  };

  return (
    <View style={[styles.questCard, { backgroundColor: colors.bgCard, borderColor: colors.border }, quest.done && { backgroundColor: colors.bgInput, opacity: 0.5 }]}>
      <Pressable style={styles.questHeader} onPress={handleToggleExpanded}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.questTitle, { color: colors.textPrimary }, quest.done && styles.questTitleDone]}>
            {quest.title}
          </Text>
          <View style={styles.questMetaRow}>
            {/* Safely handle missing difficulty values */}
            {(() => {
              const diff = typeof quest.difficulty === "string" ? quest.difficulty : "easy";
              const label = diff.charAt(0).toUpperCase() + diff.slice(1);
              return (
                <View style={getDifficultyStyle(diff)}>
                  <Text style={styles.difficultyText}>{label}</Text>
                </View>
              );
            })()}
            <Text style={[styles.questMeta, { color: colors.textSecondary }]}> {categoryName} • +{quest.xp} XP</Text>
          </View>
        </View>
        <View style={styles.questStatusStack}>
          {quest.pinned && (
            <View style={[styles.statusPillIcon, { backgroundColor: colors.accentDim }]}>
              <IconSymbol name="pin.fill" size={12} color={colors.accent} />
            </View>
          )}
          {quest.done && (
            <Text style={[styles.statusPill, { backgroundColor: colors.accent + "20", color: colors.accent }]}>Done</Text>
          )}
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.questActionsRow}>
          {!quest.done && (
            <Pressable
              style={[styles.questActionBtn, { backgroundColor: colors.accent, borderColor: colors.accent }, completePressed && styles.btnPressed]}
              onPress={handleComplete}
              onPressIn={() => setCompletePressed(true)}
              onPressOut={() => setCompletePressed(false)}
            >
              <Text style={[styles.questActionText, { color: "#ffffff" }]}>Complete</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.questActionBtn, { backgroundColor: colors.bgInput, borderColor: colors.border }, editPressed && styles.btnPressed]}
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
                ? { backgroundColor: colors.accent, borderColor: colors.accent }
                : { backgroundColor: colors.bgInput, borderColor: colors.border },
              pinPressed && styles.btnPressed,
            ]}
            onPress={handlePin}
            onPressIn={() => setPinPressed(true)}
            onPressOut={() => setPinPressed(false)}
          >
            {quest.pinned ? (
              <IconSymbol name="pin.fill" size={14} color="#ffffff" />
            ) : (
              <Text style={[styles.questActionText, { color: colors.textSecondary }]}>Pin</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.questActionBtn, { backgroundColor: "#ff3b3020", borderColor: "#ff3b30" }, deletePressed && styles.btnPressed]}
            onPress={handleDelete}
            onPressIn={() => setDeletePressed(true)}
            onPressOut={() => setDeletePressed(false)}
          >
            <Text style={[styles.questActionText, { color: "#ff3b30" }]}>Delete</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
