import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { ScreenHeader } from "@/src/components/ScreenHeader";
import { createTileSurface, ui, withAlpha } from "@/src/utils/designSystem";
import { useTheme, type ThemeColors } from "@/src/utils/themeContext";
import { STORAGE_KEY, type DailyReflection } from "@/src/utils/types";

const NOTES_VIOLET = "#A78BFA";

function formatReflectionDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day, 12));
}

export default function NotesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [notes, setNotes] = useState<DailyReflection[]>([]);

  const navigateBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/more");
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadNotes = async () => {
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          const parsed = raw ? JSON.parse(raw) : null;
          const savedNotes = Array.isArray(parsed?.dailyReflections)
            ? parsed.dailyReflections
                .filter(
                  (item: unknown): item is DailyReflection =>
                    typeof item === "object" &&
                    item !== null &&
                    typeof (item as DailyReflection).date === "string" &&
                    typeof (item as DailyReflection).note === "string" &&
                    (item as DailyReflection).note.trim().length > 0
                )
                .map((item: DailyReflection) => ({ ...item, note: item.note.trim() }))
                .sort((a: DailyReflection, b: DailyReflection) => b.date.localeCompare(a.date))
            : [];
          if (active) setNotes(savedNotes);
        } catch {
          if (active) setNotes([]);
        }
      };

      void loadNotes();
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <ScreenHeader
          title="Daily Notes"
          subtitle="A record of what stood out each day"
          icon="chevron.left"
          accent={NOTES_VIOLET}
          onIconPress={navigateBack}
          iconAccessibilityLabel="Go back"
        />

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <IconSymbol name="pencil" size={22} color={NOTES_VIOLET} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryEyebrow}>Reflection archive</Text>
            <Text style={styles.summaryTitle}>{notes.length === 1 ? "1 saved note" : `${notes.length} saved notes`}</Text>
          </View>
        </View>

        {notes.length > 0 ? (
          <View style={styles.notesList}>
            {notes.map((reflection) => (
              <View key={`${reflection.date}-${reflection.updatedAt}`} style={styles.noteCard}>
                <Text style={styles.noteDate}>{formatReflectionDate(reflection.date)}</Text>
                <Text style={styles.noteBody}>{reflection.note}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <IconSymbol name="pencil" size={24} color={NOTES_VIOLET} />
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.emptyBody}>Save a daily reflection on Today and it will appear here.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  const surface = createTileSurface(colors, {
    padding: ui.spacing.md,
    radius: ui.radius.md,
    borderOpacity: 0.22,
    backgroundOpacity: 0.5,
  });

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    container: {
      paddingHorizontal: ui.spacing.screen,
      paddingTop: ui.spacing.md,
      paddingBottom: ui.spacing.lg,
      gap: ui.spacing.md,
    },
    summaryCard: {
      ...surface,
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
      borderColor: withAlpha(NOTES_VIOLET, 0.28),
      backgroundColor: withAlpha(NOTES_VIOLET, 0.055),
    },
    summaryIcon: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withAlpha(NOTES_VIOLET, 0.32),
      backgroundColor: withAlpha(NOTES_VIOLET, 0.1),
    },
    summaryCopy: { flex: 1 },
    summaryEyebrow: {
      color: NOTES_VIOLET,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    summaryTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
      marginTop: 2,
    },
    notesList: { gap: ui.spacing.sm },
    noteCard: {
      ...surface,
      borderColor: withAlpha(NOTES_VIOLET, 0.2),
      backgroundColor: withAlpha(colors.surface2, 0.62),
      gap: 6,
    },
    noteDate: {
      color: NOTES_VIOLET,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    noteBody: {
      color: withAlpha(colors.textPrimary, 0.88),
      fontSize: 14,
      lineHeight: 21,
      fontWeight: "600",
    },
    emptyCard: {
      ...surface,
      minHeight: 190,
      alignItems: "center",
      justifyContent: "center",
      borderColor: withAlpha(NOTES_VIOLET, 0.2),
      backgroundColor: withAlpha(NOTES_VIOLET, 0.035),
      paddingHorizontal: ui.spacing.lg,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      lineHeight: 21,
      fontWeight: "900",
      marginTop: 10,
    },
    emptyBody: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      textAlign: "center",
      marginTop: 4,
    },
  });
}
