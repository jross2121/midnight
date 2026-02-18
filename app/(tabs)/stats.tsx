import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatsOverview } from "./_components/StatsOverview";
import { createStyles } from "./_styles";
import { defaultCategories, defaultDrHistory } from "./_utils/defaultData";
import { ui } from "./_utils/designSystem";
import { DR_RANK_THRESHOLDS, getNextRank, getRankEmoji, getRankFromDR } from "./_utils/rank";
import { useTheme } from "./_utils/themeContext";
import type { Category, DrHistoryEntry, StoredState } from "./_utils/types";
import { STORAGE_KEY } from "./_utils/types";

export default function StatsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [disciplineRating, setDisciplineRating] = useState<number>(0);
  const [drHistory, setDrHistory] = useState<DrHistoryEntry[]>(defaultDrHistory);
  const [hydrated, setHydrated] = useState(false);

  const isDrHistoryEntry = (value: unknown): value is DrHistoryEntry => {
    if (typeof value !== "object" || value === null) return false;
    const candidate = value as Partial<DrHistoryEntry>;
    return (
      typeof candidate.date === "string" &&
      typeof candidate.dr === "number" &&
      typeof candidate.delta === "number" &&
      typeof candidate.pct === "number"
    );
  };

  const loadData = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<StoredState>;
      const loadedCategories =
        Array.isArray(parsed.categories) && parsed.categories.length
          ? parsed.categories
          : defaultCategories;
      const loadedDR = typeof parsed.disciplineRating === "number" ? parsed.disciplineRating : 0;
      const loadedHistory = Array.isArray(parsed.drHistory)
        ? parsed.drHistory.filter((entry): entry is DrHistoryEntry => isDrHistoryEntry(entry)).slice(-30)
        : defaultDrHistory;
      setCategories(loadedCategories);
      setDisciplineRating(loadedDR);
      setDrHistory(loadedHistory);
      setHydrated(true);
    } catch (e) {
      console.log("Failed to load storage:", e);
      setHydrated(true);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reload data whenever this tab is focused
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (!hydrated) {
    return null;
  }

  const rankName = getRankFromDR(disciplineRating);
  const nextRank = getNextRank(disciplineRating);
  const latestHistory = drHistory.slice(-7).reverse();
  const drRules: { label: string; delta: string; tone: "pos" | "neu" | "neg" }[] = [
    { label: "100% completion", delta: "+10", tone: "pos" },
    { label: "85-99%", delta: "+7", tone: "pos" },
    { label: "60-84%", delta: "+4", tone: "pos" },
    { label: "30-59%", delta: "0", tone: "neu" },
    { label: "1-29%", delta: "-4", tone: "neg" },
    { label: "0% or no quests", delta: "-8", tone: "neg" },
  ];
  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: ui.spacing.sm }}>
          <IconSymbol name="chart.bar.fill" size={36} color={colors.accentPrimary} />
          <Text style={styles.title}>🧭 Discipline</Text>
        </View>

        <View
          style={[
            styles.card,
            {
              marginBottom: ui.spacing.xl,
              paddingTop: ui.spacing.md,
              shadowOpacity: 0,
              shadowRadius: 0,
              elevation: 0,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { marginBottom: ui.spacing.sm }]}>Discipline Overview</Text>
          <Text
            style={[
              styles.pillValue,
              styles.drPrimaryValue,
              {
                color: colors.accentPrimary,
                fontSize: 62,
                lineHeight: 66,
                marginTop: ui.spacing.md,
                marginBottom: ui.spacing.md,
              },
            ]}
          >
            {disciplineRating}
          </Text>
          <Text
            style={[
              styles.drRankText,
              { color: colors.textSecondary, marginTop: ui.spacing.sm, fontWeight: "900" },
            ]}
          >
            {getRankEmoji(rankName)} Current Rank: {rankName}
          </Text>
          <View style={[styles.drSystemTopRow, { marginTop: ui.spacing.sm, marginBottom: 0 }]}>
            {nextRank ? (
              <Text style={styles.drSystemTopText}>
                Next Rank: <Text style={{ color: colors.accentPrimary, fontWeight: "900" }}>{nextRank.name}</Text> • {nextRank.remainingDr} DR needed
              </Text>
            ) : (
              <Text style={styles.drSystemTopText}>Top Rank reached: Grand Discipline</Text>
            )}
          </View>
        </View>

        <View style={styles.statsSectionFlat}>
          <Text style={[styles.cardTitle, { marginBottom: ui.spacing.xs }]}>Rank Thresholds</Text>
          {DR_RANK_THRESHOLDS.map((rank, idx) => {
            const next = DR_RANK_THRESHOLDS[idx + 1];
            const min = rank.minDr;
            const maxLabel = next ? `${next.minDr - 1}` : "INF";
            const isCurrent = rank.name === rankName;
            return (
              <View
                key={rank.name}
                style={[
                  styles.drRankRow,
                  isCurrent && styles.drRankRowActive,
                ]}
              >
                {isCurrent ? <View style={styles.drRankAccentBar} /> : null}
                <View style={styles.drRankRowContent}>
                  <Text
                    style={[
                      styles.drSystemRankName,
                      isCurrent && { color: colors.accentPrimary, fontWeight: "900" },
                    ]}
                  >
                    {rank.name}
                  </Text>
                  <Text style={styles.drSystemRankRange}>
                    {min}-{maxLabel}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.statsSectionDivider} />

        <View style={[styles.card, { marginBottom: ui.spacing.xl, paddingTop: ui.spacing.md }]}>
          <Text style={[styles.cardTitle, { marginBottom: ui.spacing.xs }]}>Daily Change Rules</Text>
          {drRules.map((rule) => (
            <View key={rule.label} style={styles.drSystemRow}>
              <Text style={styles.drSystemRuleLabel}>{rule.label}</Text>
              <Text
                style={[
                  styles.drSystemRuleDelta,
                  {
                    color:
                      rule.tone === "pos"
                        ? colors.accentSecondary
                        : rule.tone === "neg"
                        ? colors.accentPrimary
                        : colors.textSecondary,
                  },
                ]}
              >
                {rule.delta}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.statsSectionFlat}>
          <Text style={[styles.cardTitle, { marginBottom: ui.spacing.xs }]}>Recent DR History</Text>
          {latestHistory.length ? (
            latestHistory.map((entry) => (
              <Text key={entry.date} style={[styles.questMeta, { marginTop: 4 }]}>
                {entry.date} • {entry.pct}% • {entry.delta >= 0 ? `+${entry.delta}` : entry.delta} • DR {entry.dr}
              </Text>
            ))
          ) : (
            <Text style={[styles.questMeta, { color: colors.textSecondary }]}>
              No DR history yet. Complete quests and roll to the next day.
            </Text>
          )}
        </View>

        <View style={styles.statsSectionDivider} />

        <View style={[styles.statsSectionFlat, { marginBottom: ui.spacing.sm }]}>
          <Text style={styles.sectionSecondary}>Areas of Focus</Text>
          <StatsOverview categories={categories} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
