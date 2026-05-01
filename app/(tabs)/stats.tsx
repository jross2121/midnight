import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RankBadge } from "./_components/RankBadge";
import { defaultDrHistory } from "./_utils/defaultData";
import { createCardSurface, createTileSurface, ui, withAlpha } from "./_utils/designSystem";
import { formatDelta } from "./_utils/discipline";
import { buildStreakSummary } from "./_utils/planning";
import { DR_RANK_THRESHOLDS, getNextRank, getRankFromDR, getRankMeta } from "./_utils/rank";
import { useTheme, type ThemeColors } from "./_utils/themeContext";
import type { DrHistoryEntry, StoredState } from "./_utils/types";
import { STORAGE_KEY } from "./_utils/types";

export default function StatsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createDisciplineStyles(colors), [colors]);
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

  const getHistoryTitle = (entry: DrHistoryEntry): string => {
    if (entry.title) return entry.title;
    if (entry.pct >= 100) return "Perfect Day";
    if (entry.pct >= 85) return "Clean Victory";
    if (entry.pct < 30) return "Midnight Claimed";
    return "Daily Judgment";
  };

  const getContractSummary = (entry: DrHistoryEntry): string | null => {
    if (typeof entry.contractCompletedCount !== "number" || typeof entry.contractTotalCount !== "number") {
      return null;
    }
    if (entry.contractTotalCount <= 0) return "No contract";
    return `${entry.contractCompletedCount}/${entry.contractTotalCount} contract`;
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
  const nextRankMeta = nextRank ? getRankMeta(nextRank.name) : null;
  const tierSpan = nextRankMeta ? Math.max(1, nextRankMeta.minDr - rankMeta.minDr) : 1;
  const rankProgress = nextRankMeta
    ? Math.max(0, Math.min(1, (disciplineRating - rankMeta.minDr) / tierSpan))
    : 1;
  const latestHistory = drHistory.slice(-14).reverse();
  const recent14 = drHistory.slice(-14);
  const recent7 = drHistory.slice(-7);
  const streakSummary = buildStreakSummary(drHistory);
  const trendPoints = recent14.map((entry) => entry.dr);
  const trendMin = trendPoints.length ? Math.min(...trendPoints) : 0;
  const trendMax = trendPoints.length ? Math.max(...trendPoints) : 0;
  const trendRange = Math.max(1, trendMax - trendMin);
  const bestCompletion14d = recent14.length
    ? Math.max(...recent14.map((entry) => entry.pct))
    : 0;
  const lastJudgment = recent14[recent14.length - 1] ?? null;
  const trendLabel = (() => {
    if (recent14.length < 2) return "Need 2+ judgments";
    const first = recent14[0].dr;
    const last = recent14[recent14.length - 1].dr;
    if (last > first) return `+${last - first} DR over 14d`;
    if (last < first) return `${last - first} DR over 14d`;
    return "Flat over 14d";
  })();
  const completion14d = recent14.length
    ? Math.round(recent14.reduce((sum, entry) => sum + entry.pct, 0) / recent14.length)
    : 0;
  const avgChange7d = recent7.length
    ? Number((recent7.reduce((sum, entry) => sum + entry.delta, 0) / recent7.length).toFixed(1))
    : 0;
  const latestDelta = lastJudgment?.delta ?? 0;
  const positiveDays14d = recent14.filter((entry) => entry.delta > 0).length;
  const contractProtected14d = recent14.filter(
    (entry) =>
      typeof entry.contractTotalCount === "number" &&
      entry.contractTotalCount > 0 &&
      entry.contractCompletedCount === entry.contractTotalCount
  ).length;
  const drRules: { label: string; delta: string; tone: "pos" | "neu" | "neg" }[] = [
    { label: "100% completion", delta: "+10", tone: "pos" },
    { label: "85-99%", delta: "+7", tone: "pos" },
    { label: "60-84%", delta: "+4", tone: "pos" },
    { label: "30-59%", delta: "0", tone: "neu" },
    { label: "1-29%", delta: "-4", tone: "neg" },
    { label: "0% or no quests", delta: "-8", tone: "neg" },
  ];
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.pageHeader}>
          <View style={styles.headerIcon}>
            <IconSymbol name="star.fill" size={18} color={colors.accentPrimary} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Discipline Console</Text>
            <Text style={styles.subtitle}>Rank pressure, judgment history, and DR mechanics</Text>
          </View>
        </View>

        <View style={styles.heroPanel}>
          <View style={styles.heroTopRow}>
            <View style={styles.rankMark}>
              <RankBadge rankTier={rankMeta.tier} size={46} active />
            </View>
            <View style={styles.heroTitleBlock}>
              <Text style={styles.eyebrow}>Current Rank</Text>
              <Text style={styles.rankName}>{rankName}</Text>
              <Text style={styles.rankMeta}>
                Tier {rankMeta.tier} / {DR_RANK_THRESHOLDS.length}
              </Text>
            </View>
            <View style={styles.deltaCapsule}>
              <Text style={styles.deltaLabel}>Last</Text>
              <Text
                style={[
                  styles.deltaValue,
                  { color: latestDelta > 0 ? colors.positive : latestDelta < 0 ? colors.negative : colors.textSecondary },
                ]}
              >
                {formatDelta(latestDelta)}
              </Text>
            </View>
          </View>

          <View style={styles.drReadoutRow}>
            <Text style={styles.drNumber}>{disciplineRating}</Text>
            <View style={styles.drReadoutSide}>
              <Text style={styles.drLabel}>Discipline Rating</Text>
              <Text style={styles.drSupport}>
                {nextRank ? `${nextRank.remainingDr} DR until ${nextRank.name}` : "Maximum rank reached"}
              </Text>
            </View>
          </View>

          <View style={styles.rankProgressTrack}>
            <View style={[styles.rankProgressFill, { width: `${Math.round(rankProgress * 100)}%` }]} />
          </View>
          <View style={styles.rankProgressLabels}>
            <Text style={styles.rankProgressText}>{rankMeta.minDr} DR</Text>
            <Text style={styles.rankProgressText}>
              {nextRankMeta ? `${nextRankMeta.minDr} DR` : "Top rank"}
            </Text>
          </View>
        </View>

        <View style={styles.signalGrid}>
          <View style={styles.signalTile}>
            <Text style={styles.signalLabel}>14D Completion</Text>
            <Text style={styles.signalValue}>{completion14d}%</Text>
            <View style={styles.signalTrack}>
              <View style={[styles.signalFill, { width: `${completion14d}%` }]} />
            </View>
          </View>
          <View style={styles.signalTile}>
            <Text style={styles.signalLabel}>7D Avg Change</Text>
            <Text
              style={[
                styles.signalValue,
                { color: avgChange7d > 0 ? colors.positive : avgChange7d < 0 ? colors.negative : colors.textPrimary },
              ]}
            >
              {formatDelta(avgChange7d)}
            </Text>
            <Text style={styles.signalFoot}>{positiveDays14d}/{recent14.length || 0} positive judgments</Text>
          </View>
          <View style={styles.signalTile}>
            <Text style={styles.signalLabel}>Best Finish</Text>
            <Text style={styles.signalValue}>{bestCompletion14d}%</Text>
            <Text style={styles.signalFoot}>{contractProtected14d} protected contracts</Text>
          </View>
        </View>

        <View style={styles.streakBand}>
          <View style={styles.streakCell}>
            <Text style={styles.streakValue}>{streakSummary.solidDayStreak}</Text>
            <Text style={styles.streakLabel}>Solid day streak</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakCell}>
            <Text style={styles.streakValue}>{streakSummary.contractStreak}</Text>
            <Text style={styles.streakLabel}>Contract streak</Text>
          </View>
          <View style={styles.streakDivider} />
          <View style={styles.streakCell}>
            <Text style={styles.streakValue}>{streakSummary.bestSolidDayStreak}</Text>
            <Text style={styles.streakLabel}>Best solid run</Text>
          </View>
        </View>

        <View style={styles.chartPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>DR Trend</Text>
              <Text style={styles.sectionTitle}>{trendLabel}</Text>
            </View>
            <Text style={styles.miniMeta}>
              {lastJudgment ? `${lastJudgment.date.slice(5)} - ${formatDelta(lastJudgment.delta)}` : "No data"}
            </Text>
          </View>
          {trendPoints.length ? (
            <View style={styles.chartRail}>
              {trendPoints.map((value, idx) => {
                const normalized = (value - trendMin) / trendRange;
                const height = 12 + normalized * 70;
                const entry = recent14[idx];
                const tone =
                  entry.delta > 0
                    ? colors.positive
                    : entry.delta < 0
                    ? colors.negative
                    : colors.accentPrimary;
                return (
                  <View key={`${value}-${idx}`} style={styles.chartColumn}>
                    <View style={[styles.chartBar, { height, backgroundColor: tone }]} />
                    <Text style={styles.chartLabel}>{entry.date.slice(5, 10)}</Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>Complete a midnight judgment to start the trend.</Text>
          )}
        </View>

        <View style={styles.judgmentPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>History Feed</Text>
              <Text style={styles.sectionTitle}>Recent Judgments</Text>
            </View>
            <Text style={styles.miniMeta}>Latest 14</Text>
          </View>
          {latestHistory.length ? (
            latestHistory.map((entry, idx) => {
              const deltaColor =
                entry.delta > 0 ? colors.positive : entry.delta < 0 ? colors.negative : colors.textSecondary;

              return (
                <View key={`${entry.date}-${idx}`} style={styles.judgmentRow}>
                  <View style={[styles.judgmentRail, { backgroundColor: deltaColor }]} />
                  <View style={styles.judgmentMain}>
                    <Text style={styles.judgmentDate}>{entry.date.slice(5)}</Text>
                    <Text style={styles.judgmentTitle} numberOfLines={1}>
                      {getHistoryTitle(entry)}
                    </Text>
                    {getContractSummary(entry) ? (
                      <Text style={styles.judgmentMeta} numberOfLines={1}>
                        {getContractSummary(entry)}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.judgmentStats}>
                    <Text style={styles.judgmentPct}>{entry.pct}%</Text>
                    <Text style={[styles.judgmentDelta, { color: deltaColor }]}>{formatDelta(entry.delta)}</Text>
                    <Text style={styles.judgmentDr}>{entry.dr} DR</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No judgments yet.</Text>
          )}
        </View>

        <View style={styles.rulesPanel}> 
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>System Rules</Text>
              <Text style={styles.sectionTitle}>Judgment Ladder</Text>
            </View>
          </View>
          {drRules.map((rule) => (
            <View key={rule.label} style={styles.ruleRow}>
              <Text style={styles.ruleLabel}>{rule.label}</Text>
              <Text
                style={[
                  styles.ruleDelta,
                  {
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
      </ScrollView>
    </SafeAreaView>
  );
}

function createDisciplineStyles(colors: ThemeColors) {
  const cardSurface = createCardSurface(colors, {
    padding: ui.spacing.card,
    radius: ui.radius.card,
    borderOpacity: 0.24,
    glowOpacity: 0.025,
    backgroundColor: withAlpha(colors.surface2, 0.82),
  });
  const heroSurface = createCardSurface(colors, {
    padding: ui.spacing.card,
    radius: ui.radius.card,
    borderOpacity: 0.28,
    glowOpacity: 0.035,
    backgroundColor: withAlpha(colors.surface2, 0.88),
  });
  const tileSurface = createTileSurface(colors, {
    padding: ui.spacing.sm,
    radius: ui.radius.md,
    borderOpacity: 0.22,
    backgroundOpacity: 0.22,
  });

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      paddingHorizontal: ui.spacing.screen,
      paddingTop: ui.spacing.screen,
      paddingBottom: ui.spacing.xl * 3,
      gap: ui.spacing.md,
    },
    pageHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
      paddingBottom: ui.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(colors.divider, 0.72),
    },
    headerIcon: {
      width: 38,
      height: 38,
      borderRadius: ui.radius.md,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withAlpha(colors.accentPrimary, 0.26),
      backgroundColor: withAlpha(colors.accentPrimary, 0.08),
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "900",
      letterSpacing: 0.2,
    },
    subtitle: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
      marginTop: 2,
    },
    heroPanel: {
      ...heroSurface,
      gap: ui.spacing.sm,
      overflow: "hidden",
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
    },
    rankMark: {
      width: 58,
      height: 58,
      borderRadius: ui.radius.md,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.24),
      backgroundColor: withAlpha(colors.bg, 0.26),
    },
    heroTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    eyebrow: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0.75,
      textTransform: "uppercase",
    },
    rankName: {
      color: colors.textPrimary,
      fontSize: 25,
      lineHeight: 29,
      fontWeight: "900",
      marginTop: 1,
    },
    rankMeta: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "800",
      marginTop: 1,
      textTransform: "uppercase",
    },
    deltaCapsule: {
      minWidth: 58,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.24),
      borderRadius: 999,
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: 7,
      alignItems: "center",
      backgroundColor: withAlpha(colors.bg, 0.22),
    },
    deltaLabel: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 9,
      lineHeight: 11,
      fontWeight: "900",
      letterSpacing: 0.55,
      textTransform: "uppercase",
    },
    deltaValue: {
      fontSize: 17,
      lineHeight: 21,
      fontWeight: "900",
    },
    drReadoutRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: ui.spacing.sm,
    },
    drNumber: {
      ...ui.typography.drHero,
      color: colors.textPrimary,
      fontSize: 76,
      lineHeight: 78,
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    drReadoutSide: {
      flex: 1,
      paddingBottom: 10,
      minWidth: 0,
    },
    drLabel: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 0.45,
    },
    drSupport: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      marginTop: 2,
    },
    rankProgressTrack: {
      height: 12,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.bg, 0.84),
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.22),
      overflow: "hidden",
    },
    rankProgressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: colors.accentPrimary,
    },
    rankProgressLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    rankProgressText: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.35,
      textTransform: "uppercase",
    },
    signalGrid: {
      flexDirection: "row",
      gap: ui.spacing.xs,
    },
    signalTile: {
      ...tileSurface,
      flex: 1,
      minWidth: 0,
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: ui.spacing.sm,
      gap: 5,
    },
    signalLabel: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    signalValue: {
      color: colors.textPrimary,
      fontSize: 23,
      lineHeight: 27,
      fontWeight: "900",
    },
    signalFoot: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "700",
    },
    signalTrack: {
      height: 7,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.bg, 0.8),
      overflow: "hidden",
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.2),
    },
    signalFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: colors.accentPrimary,
    },
    streakBand: {
      ...cardSurface,
      flexDirection: "row",
      alignItems: "stretch",
      padding: 0,
      overflow: "hidden",
    },
    streakCell: {
      flex: 1,
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: ui.spacing.sm,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 0,
    },
    streakDivider: {
      width: 1,
      backgroundColor: withAlpha(colors.border, 0.18),
    },
    streakValue: {
      color: colors.textPrimary,
      fontSize: 27,
      lineHeight: 30,
      fontWeight: "900",
    },
    streakLabel: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      textAlign: "center",
      marginTop: 2,
    },
    chartPanel: {
      ...cardSurface,
      gap: ui.spacing.sm,
    },
    cardHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: ui.spacing.sm,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 19,
      lineHeight: 23,
      fontWeight: "900",
      marginTop: 1,
    },
    miniMeta: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0.45,
      textTransform: "uppercase",
      textAlign: "right",
    },
    chartRail: {
      height: 104,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 5,
      paddingTop: ui.spacing.sm,
    },
    chartColumn: {
      flex: 1,
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 5,
      minWidth: 0,
    },
    chartBar: {
      width: "100%",
      borderRadius: 999,
      minHeight: 8,
    },
    chartLabel: {
      color: withAlpha(colors.textSecondary, 0.68),
      fontSize: 8,
      lineHeight: 10,
      fontWeight: "800",
    },
    judgmentPanel: {
      ...cardSurface,
      gap: ui.spacing.xs,
    },
    judgmentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.xs,
      minHeight: 58,
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.22),
      paddingTop: ui.spacing.xs,
      marginTop: ui.spacing.xs,
    },
    judgmentRail: {
      width: 4,
      alignSelf: "stretch",
      borderRadius: 999,
    },
    judgmentMain: {
      flex: 1,
      minWidth: 0,
    },
    judgmentDate: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0.45,
      textTransform: "uppercase",
    },
    judgmentTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
      marginTop: 1,
    },
    judgmentMeta: {
      color: withAlpha(colors.textSecondary, 0.72),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "700",
      marginTop: 1,
    },
    judgmentStats: {
      alignItems: "flex-end",
      minWidth: 72,
    },
    judgmentPct: {
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 18,
      fontWeight: "900",
    },
    judgmentDelta: {
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "900",
      marginTop: 1,
    },
    judgmentDr: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "800",
      marginTop: 1,
    },
    rulesPanel: {
      ...cardSurface,
      gap: ui.spacing.xs,
    },
    ruleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.2),
      paddingTop: ui.spacing.xs,
      marginTop: ui.spacing.xs,
    },
    ruleLabel: {
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "800",
    },
    ruleDelta: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
    },
    emptyText: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
    },
  });
}
