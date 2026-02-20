import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RankBadge } from "./_components/RankBadge";
import { createStyles } from "./_styles";
import { defaultDrHistory } from "./_utils/defaultData";
import { ui } from "./_utils/designSystem";
import { formatDelta } from "./_utils/discipline";
import { getNextRank, getRankFromDR, getRankMeta } from "./_utils/rank";
import { useTheme } from "./_utils/themeContext";
import type { DrHistoryEntry, StoredState } from "./_utils/types";
import { STORAGE_KEY } from "./_utils/types";

export default function StatsScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
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
      const loadedDR = typeof parsed.disciplineRating === "number" ? parsed.disciplineRating : 0;
      const loadedHistory = Array.isArray(parsed.drHistory)
        ? parsed.drHistory.filter((entry): entry is DrHistoryEntry => isDrHistoryEntry(entry)).slice(-30)
        : defaultDrHistory;
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
  const rankMeta = getRankMeta(rankName);
  const nextRank = getNextRank(disciplineRating);
  const latestHistory = drHistory.slice(-14).reverse();
  const recent14 = drHistory.slice(-14);
  const recent7 = drHistory.slice(-7);
  const completion14d = recent14.length
    ? Math.round(recent14.reduce((sum, entry) => sum + entry.pct, 0) / recent14.length)
    : 0;
  const avgChange7d = recent7.length
    ? Number((recent7.reduce((sum, entry) => sum + entry.delta, 0) / recent7.length).toFixed(1))
    : 0;
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
        <View style={styles.homeTopBar}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: ui.spacing.xs }}>
            <IconSymbol name="chart.bar.fill" size={24} color={colors.accentPrimary} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>DISCIPLINE</Text>
          </View>
        </View>

        <View style={styles.statusHeader}>
          <View style={styles.statusHeaderTop}>
            <View style={styles.rankBadgeRail}>
              <RankBadge rankTier={rankMeta.tier} size={34} active />
            </View>
            <View style={styles.statusHeaderMain}>
              <Text style={styles.statusLabel}>DISCIPLINE RATING</Text>
              <Text style={[styles.statusDrValue, { color: colors.textPrimary }]}>{disciplineRating}</Text>
              <Text style={styles.statusRankName}>{rankName.toUpperCase()}</Text>
              <Text style={styles.statusRankNext}>
                {nextRank ? `${nextRank.remainingDr} DR TO ${nextRank.name.toUpperCase()}` : "TOP RANK"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.analyticsRow}>
          <View style={styles.analyticsTile}>
            <Text style={styles.analyticsLabel}>14D Completion</Text>
            <Text style={styles.analyticsValue}>{completion14d}%</Text>
          </View>
          <View style={styles.analyticsTile}>
            <Text style={styles.analyticsLabel}>7D Avg Change</Text>
            <Text
              style={[
                styles.analyticsValue,
                {
                  color:
                    avgChange7d > 0
                      ? colors.positive
                      : avgChange7d < 0
                      ? colors.negative
                      : colors.textSecondary,
                },
              ]}
            >
              {formatDelta(avgChange7d)}
            </Text>
          </View>
          <View style={styles.analyticsTile}>
            <Text style={styles.analyticsLabel}>14D Evaluations</Text>
            <Text style={styles.analyticsValue}>{recent14.length}</Text>
          </View>
        </View>

        <View style={styles.statsSectionFlat}>
          <Text style={[styles.sectionSecondary, { marginBottom: ui.spacing.xs }]}>Recent Judgments</Text>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>DATE</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>COMP%</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>DELTA</Text>
            <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right" }]}>DR</Text>
          </View>
          {latestHistory.length ? (
            latestHistory.map((entry) => {
              const deltaColor =
                entry.delta > 0 ? colors.positive : entry.delta < 0 ? colors.negative : colors.textSecondary;

              return (
                <View key={entry.date} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 1.5 }]}>{entry.date.slice(5)}</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>{entry.pct}%</Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: "right", color: deltaColor }]}>
                    {formatDelta(entry.delta)}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>{entry.dr}</Text>
                </View>
              );
            })
          ) : (
            <Text style={[styles.questMeta, { color: colors.textSecondary }]}>No judgments yet.</Text>
          )}
        </View>

        <View style={[styles.statsSectionFlat, { marginTop: ui.spacing.md }]}> 
          <Text style={[styles.sectionSecondary, { marginBottom: ui.spacing.xs }]}>Judgment Rules</Text>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderText, { flex: 1.8 }]}>COMPLETION</Text>
            <Text style={[styles.tableHeaderText, { flex: 0.8, textAlign: "right" }]}>DELTA</Text>
          </View>
          {drRules.map((rule) => (
            <View key={rule.label} style={styles.tableRow}>
              <Text style={[styles.tableCell, { flex: 1.8 }]}>{rule.label}</Text>
              <Text
                style={[
                  styles.tableCell,
                  {
                    flex: 0.8,
                    textAlign: "right",
                    color:
                      rule.tone === "pos"
                        ? colors.positive
                        : rule.tone === "neg"
                        ? colors.negative
                        : colors.textSecondary,
                  },
                ]}
              >
                {rule.delta}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.statsSectionDivider} />
      </ScrollView>
    </SafeAreaView>
  );
}
