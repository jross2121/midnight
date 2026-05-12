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
import { getLatestCategoriesFromHistory } from "./_utils/evaluationAnalytics";
import { readEvaluationHistory, type DailyEvaluationHistoryItem } from "./_utils/evaluationHistory";
import { buildStreakSummary } from "./_utils/planning";
import { DR_RANK_THRESHOLDS, getNextRank, getRankFromDR, getRankMeta } from "./_utils/rank";
import { useTheme, type ThemeColors } from "./_utils/themeContext";
import type { DrHistoryEntry, StoredState } from "./_utils/types";
import { STORAGE_KEY } from "./_utils/types";

const RANK_CONSOLE_TONE = "#F5B84B";
const RANK_CONSOLE_MUTED = "#8EA0B2";

function getRankTone(tier: number): string {
  return tier >= 7 ? "#FFE19A" : RANK_CONSOLE_TONE;
}

export default function StatsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createDisciplineStyles(colors), [colors]);
  const [disciplineRating, setDisciplineRating] = useState<number>(0);
  const [drHistory, setDrHistory] = useState<DrHistoryEntry[]>(defaultDrHistory);
  const [evaluationHistory, setEvaluationHistory] = useState<DailyEvaluationHistoryItem[]>([]);
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
      const loadedEvaluationHistory = await readEvaluationHistory();
      setEvaluationHistory(loadedEvaluationHistory);

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
  const rankTone = getRankTone(rankMeta.tier);
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
  const solidDays14d = recent14.filter((entry) => entry.pct >= 60).length;
  const contractProtected14d = recent14.filter(
    (entry) =>
      typeof entry.contractTotalCount === "number" &&
      entry.contractTotalCount > 0 &&
      entry.contractCompletedCount === entry.contractTotalCount
  ).length;
  const categorySignal = getLatestCategoriesFromHistory(evaluationHistory);
  const weakestCategory = categorySignal.weakestCategory ?? "Needs more data";
  const weakestCategoryPhrase = categorySignal.weakestCategory ?? "your weakest lane";
  const strongestCategory = categorySignal.strongestCategory ?? "Signal building";
  const visibleRankPath = DR_RANK_THRESHOLDS;
  const disciplineMode = (() => {
    if (recent14.length === 0) return "Calibration";
    if (avgChange7d < 0 || latestDelta < 0) return "Recovery";
    if (nextRank && nextRank.remainingDr <= Math.max(30, Math.round(tierSpan * 0.25))) return "Promotion";
    if (streakSummary.solidDayStreak >= 3) return "Expansion";
    return "Build";
  })();
  const modeColor = rankTone;
  const nextRankLabel = nextRank?.name ?? "Top rank";
  const nextRankDistance = nextRank ? `${nextRank.remainingDr} DR` : "Max";
  const rankProgressPercent = Math.round(rankProgress * 100);
  const pressureBrief = (() => {
    if (disciplineMode === "Calibration") {
      return {
        title: "Set a baseline",
        body: "Finish a simple board today so midnight has a real first judgment.",
        primaryLabel: "Target",
        primaryValue: "60%",
        secondaryLabel: "Strength",
        secondaryValue: strongestCategory,
        steps: ["One contract", "Three small quests", "Midnight score"],
      };
    }

    if (disciplineMode === "Recovery") {
      return {
        title: "Protect the floor",
        body: "Recent DR is sliding. One contract plus 60% keeps the day from getting worse.",
        primaryLabel: "Target",
        primaryValue: "60%",
        secondaryLabel: "Watch",
        secondaryValue: weakestCategory,
        steps: ["Contract first", "Smallest quest", "Hold 60%"],
      };
    }

    if (disciplineMode === "Promotion") {
      return {
        title: "Finish clean",
        body: `${nextRankLabel} is close. A clean 85%+ day matters more than adding extra noise.`,
        primaryLabel: "Gap",
        primaryValue: nextRank ? `${nextRank.remainingDr} DR` : "Top",
        secondaryLabel: "Pace",
        secondaryValue: formatDelta(avgChange7d),
        steps: ["Protect contracts", "Push 85%+", "Avoid zero"],
      };
    }

    if (disciplineMode === "Expansion") {
      return {
        title: "Add pressure carefully",
        body: `The streak is holding. Add one harder rep in ${weakestCategoryPhrase} without risking the floor.`,
        primaryLabel: "Streak",
        primaryValue: `${streakSummary.solidDayStreak}`,
        secondaryLabel: "Watch",
        secondaryValue: weakestCategory,
        steps: ["First win early", "One hard rep", "Protect streak"],
      };
    }

    return {
      title: "Build the floor",
      body: "Get to 60%, then push one category. The win condition is repeatable momentum.",
      primaryLabel: "Solid",
      primaryValue: `${solidDays14d}/${recent14.length || 0}`,
      secondaryLabel: "Strength",
      secondaryValue: strongestCategory,
      steps: ["Hit 60%", "Pinned quest", "Repeat"],
    };
  })();
  const momentumSignals = [
    {
      label: "Avg finish",
      value: `${completion14d}%`,
      foot: `${solidDays14d} of ${recent14.length || 0} solid`,
      color: rankTone,
    },
    {
      label: "Recent DR",
      value: formatDelta(avgChange7d),
      foot: `${positiveDays14d} positive days`,
      color: avgChange7d > 0 ? rankTone : RANK_CONSOLE_MUTED,
    },
    {
      label: "Streak",
      value: `${streakSummary.solidDayStreak}`,
      foot: `best ${streakSummary.bestSolidDayStreak}`,
      color: rankTone,
    },
    {
      label: "Contracts",
      value: `${streakSummary.contractStreak}`,
      foot: `${contractProtected14d} protected`,
      color: rankTone,
    },
  ];
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.pageHeader}>
          <View
            style={[
              styles.headerIcon,
              {
                borderColor: withAlpha(rankTone, 0.34),
                backgroundColor: withAlpha(rankTone, 0.1),
              },
            ]}
          >
            <IconSymbol name="star.fill" size={18} color={rankTone} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Rank Console</Text>
            <Text style={styles.subtitle}>Rank, momentum, and what to do next</Text>
          </View>
        </View>

        <View
          style={[
            styles.heroPanel,
            {
              borderColor: withAlpha(RANK_CONSOLE_TONE, 0.3),
              backgroundColor: withAlpha(colors.surface2, 0.88),
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View style={[styles.rankMark, { borderColor: withAlpha(modeColor, 0.3) }]}>
              <RankBadge rankTier={rankMeta.tier} size={38} active />
            </View>
            <View style={styles.heroTitleBlock}>
              <View style={styles.heroLabelRow}>
                <Text style={styles.eyebrow}>Current Rank</Text>
                <View
                  style={[
                    styles.modePill,
                    {
                      borderColor: withAlpha(modeColor, 0.42),
                      backgroundColor: withAlpha(modeColor, 0.1),
                    },
                  ]}
                >
                  <Text style={[styles.modePillText, { color: modeColor }]}>{disciplineMode}</Text>
                </View>
              </View>
              <Text style={styles.rankName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
                {rankName}
              </Text>
              <Text style={styles.rankMeta} numberOfLines={1}>
                Tier {rankMeta.tier} / {DR_RANK_THRESHOLDS.length} - Next: {nextRankLabel}
              </Text>
            </View>
          </View>

          <View style={styles.heroScoreRow}>
            <View style={styles.heroScoreBlock}>
              <Text style={styles.heroScoreLabel}>DR Score</Text>
              <Text style={[styles.heroScoreValue, { color: rankTone }]}>{disciplineRating}</Text>
            </View>
            <View style={styles.heroMiniStack}>
              <View style={styles.heroMiniMetric}>
                <Text style={styles.heroMiniLabel}>To next</Text>
                <Text style={styles.heroMiniValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
                  {nextRankDistance}
                </Text>
              </View>
              <View style={styles.heroMiniMetric}>
                <Text style={styles.heroMiniLabel}>Last change</Text>
                <Text
                  style={[
                    styles.heroMiniValue,
                    { color: latestDelta > 0 ? rankTone : RANK_CONSOLE_MUTED },
                  ]}
                >
                  {formatDelta(latestDelta)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.heroProgressHeader}>
            <Text style={styles.heroProgressLabel}>Tier progress</Text>
            <Text style={[styles.heroProgressValue, { color: rankTone }]}>{rankProgressPercent}%</Text>
          </View>
          <View style={styles.rankProgressTrack}>
            <View style={[styles.rankProgressFill, { width: `${rankProgressPercent}%`, backgroundColor: rankTone }]} />
          </View>
          <View style={styles.rankProgressLabels}>
            <Text style={styles.rankProgressText}>{rankMeta.minDr} DR</Text>
            <Text style={styles.rankProgressText}>
              {nextRankMeta ? `${nextRankMeta.minDr} DR` : "Top rank"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.briefPanel,
            {
              borderColor: withAlpha(modeColor, 0.22),
              backgroundColor: withAlpha(modeColor, 0.045),
            },
          ]}
        >
          <View style={styles.briefTopRow}>
            <View style={styles.briefMain}>
              <Text style={styles.eyebrow}>Today&apos;s Focus</Text>
              <Text style={styles.briefTitle}>{pressureBrief.title}</Text>
              <Text style={styles.briefBody}>{pressureBrief.body}</Text>
            </View>
            <View style={styles.briefGauge}>
              <Text style={styles.briefGaugeLabel}>{pressureBrief.primaryLabel}</Text>
              <Text
                style={[styles.briefGaugeValue, { color: modeColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {pressureBrief.primaryValue}
              </Text>
            </View>
          </View>
          <View style={styles.briefDivider} />
          <View style={styles.protocolList}>
            {pressureBrief.steps.map((step, idx) => (
              <View key={step} style={styles.protocolStep}>
                <Text
                  style={[
                    styles.protocolIndex,
                    {
                      color: modeColor,
                      borderColor: withAlpha(modeColor, 0.34),
                    },
                  ]}
                >
                  {idx + 1}
                </Text>
                <Text style={styles.protocolText}>{step}</Text>
              </View>
            ))}
          </View>
          <View style={styles.briefFooter}>
            <Text style={styles.briefFooterLabel}>{pressureBrief.secondaryLabel}</Text>
            <Text style={styles.briefFooterValue} numberOfLines={1}>
              {pressureBrief.secondaryValue}
            </Text>
          </View>
        </View>

        <View style={styles.momentumGrid}>
          {momentumSignals.map((signal) => (
            <View key={signal.label} style={styles.momentumTile}>
              <Text style={styles.momentumLabel}>{signal.label}</Text>
              <Text style={[styles.momentumValue, { color: signal.color }]}>{signal.value}</Text>
              <Text style={styles.momentumFoot}>{signal.foot}</Text>
            </View>
          ))}
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
                    ? rankTone
                    : entry.delta < 0
                    ? RANK_CONSOLE_MUTED
                    : rankTone;
                return (
                  <View key={`${value}-${idx}`} style={styles.chartColumn}>
                    <View style={[styles.chartBar, { height, backgroundColor: tone }]} />
                    <Text style={styles.chartLabel} numberOfLines={1}>
                      {entry.date.slice(8, 10)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>Complete a midnight judgment to start the trend.</Text>
          )}
        </View>

        <View style={styles.rankPathPanel}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.eyebrow}>Rank Path</Text>
              <Text style={styles.sectionTitle}>
                {nextRank ? `${nextRank.remainingDr} DR to ${nextRank.name}` : "Top rank secured"}
              </Text>
            </View>
            <Text style={styles.miniMeta}>All {DR_RANK_THRESHOLDS.length}</Text>
          </View>
          <View style={styles.rankPathList}>
            {visibleRankPath.map((rank) => {
              const isCurrent = rank.name === rankName;
              const isNext = nextRank?.name === rank.name;
              const isUnlocked = disciplineRating >= rank.minDr;
              const rowTone = getRankTone(rank.tier);
              const maxLabel = Number.isFinite(rank.maxDr) ? `${rank.maxDr} DR` : "No cap";

              return (
                <View
                  key={rank.name}
                  style={[
                    styles.rankPathRow,
                    isCurrent && {
                      borderColor: withAlpha(rowTone, 0.58),
                      backgroundColor: withAlpha(rowTone, 0.1),
                    },
                    isNext && styles.rankPathRowNext,
                    isNext && {
                      borderColor: withAlpha(rowTone, 0.42),
                      backgroundColor: withAlpha(rowTone, 0.028),
                    },
                    isUnlocked && !isCurrent && {
                      borderColor: withAlpha(rowTone, 0.2),
                      backgroundColor: withAlpha(rowTone, 0.025),
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.rankPathStateRail,
                      {
                        backgroundColor: isCurrent
                          ? rowTone
                          : isNext
                            ? "transparent"
                            : isUnlocked
                              ? withAlpha(rowTone, 0.42)
                              : withAlpha(colors.border, 0.42),
                        borderColor: isNext ? withAlpha(rowTone, 0.44) : "transparent",
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.rankPathMark,
                      {
                        borderColor: withAlpha(isCurrent ? rowTone : isNext ? rowTone : colors.border, isCurrent ? 0.7 : 0.42),
                        backgroundColor: withAlpha(rowTone, isCurrent ? 0.15 : isNext ? 0.055 : 0.025),
                      },
                    ]}
                  >
                    <RankBadge
                      rank={rank.name}
                      size={24}
                      active={isUnlocked || isNext}
                      color={isUnlocked || isNext ? rowTone : colors.textSecondary}
                    />
                  </View>
                  <View style={styles.rankPathCopy}>
                    <Text style={styles.rankPathName}>{rank.name}</Text>
                    <Text style={styles.rankPathRange}>
                      {rank.minDr} DR - {maxLabel}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.rankPathStatusPill,
                      isCurrent && {
                        borderColor: withAlpha(rowTone, 0.5),
                        backgroundColor: withAlpha(rowTone, 0.14),
                      },
                      isNext && {
                        borderColor: withAlpha(rowTone, 0.36),
                        backgroundColor: withAlpha(colors.bg, 0.36),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rankPathStatus,
                        (isCurrent || isNext || isUnlocked) && { color: rowTone },
                      ]}
                    >
                      {isCurrent ? "Current" : isNext ? "Target" : isUnlocked ? "Cleared" : "Locked"}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
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
                entry.delta > 0 ? rankTone : entry.delta < 0 ? RANK_CONSOLE_MUTED : colors.textSecondary;

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
      gap: ui.spacing.sm,
    },
    pageHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
      paddingBottom: ui.spacing.lg,
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
      borderColor: withAlpha(RANK_CONSOLE_TONE, 0.26),
      backgroundColor: withAlpha(RANK_CONSOLE_TONE, 0.08),
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 24,
      lineHeight: 28,
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
      paddingHorizontal: ui.spacing.md,
      paddingVertical: ui.spacing.md,
      overflow: "hidden",
    },
    heroTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: ui.spacing.sm,
    },
    rankMark: {
      width: 50,
      height: 50,
      borderRadius: ui.radius.md,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      backgroundColor: withAlpha(colors.bg, 0.26),
    },
    heroTitleBlock: {
      flex: 1,
      minWidth: 0,
    },
    heroLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.xs,
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
      fontSize: 24,
      lineHeight: 28,
      fontWeight: "900",
      marginTop: 3,
    },
    rankMeta: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "800",
      marginTop: 2,
      textTransform: "uppercase",
    },
    modePill: {
      flexShrink: 0,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    modePillText: {
      fontSize: 9,
      lineHeight: 11,
      fontWeight: "900",
      letterSpacing: 0.55,
      textTransform: "uppercase",
    },
    heroScoreRow: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: ui.spacing.sm,
    },
    heroScoreBlock: {
      flex: 1,
      minWidth: 0,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.22),
      borderRadius: ui.radius.md,
      backgroundColor: withAlpha(colors.bg, 0.24),
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.sm,
    },
    heroScoreLabel: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0.55,
      textTransform: "uppercase",
    },
    heroScoreValue: {
      color: colors.textPrimary,
      fontSize: 46,
      lineHeight: 50,
      fontWeight: "900",
      marginTop: 2,
    },
    heroMiniStack: {
      width: 128,
      gap: ui.spacing.xs,
    },
    heroMiniMetric: {
      flex: 1,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.2),
      borderRadius: ui.radius.md,
      backgroundColor: withAlpha(colors.bg, 0.18),
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: 7,
      justifyContent: "center",
    },
    heroMiniLabel: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 9,
      lineHeight: 11,
      fontWeight: "900",
      letterSpacing: 0.45,
      textTransform: "uppercase",
    },
    heroMiniValue: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 17,
      fontWeight: "900",
      marginTop: 2,
    },
    heroProgressHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: ui.spacing.xxs,
    },
    heroProgressLabel: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    heroProgressValue: {
      color: colors.textPrimary,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
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
      backgroundColor: RANK_CONSOLE_TONE,
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
    briefPanel: {
      ...cardSurface,
      gap: ui.spacing.sm,
      borderColor: withAlpha(RANK_CONSOLE_TONE, 0.18),
      backgroundColor: withAlpha(colors.surface2, 0.74),
      paddingHorizontal: ui.spacing.md,
      paddingVertical: ui.spacing.md,
      overflow: "hidden",
    },
    briefTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: ui.spacing.sm,
    },
    briefMain: {
      flex: 1,
      minWidth: 0,
    },
    briefTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      lineHeight: 24,
      fontWeight: "900",
      marginTop: 2,
    },
    briefBody: {
      color: withAlpha(colors.textSecondary, 0.9),
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
      marginTop: 5,
    },
    briefGauge: {
      minWidth: 72,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.22),
      borderRadius: ui.radius.md,
      backgroundColor: withAlpha(colors.bg, 0.24),
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: ui.spacing.xs,
    },
    briefGaugeLabel: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 9,
      lineHeight: 11,
      fontWeight: "900",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      textAlign: "center",
    },
    briefGaugeValue: {
      fontSize: 20,
      lineHeight: 24,
      fontWeight: "900",
      marginTop: 2,
      textAlign: "center",
    },
    briefDivider: {
      height: 1,
      backgroundColor: withAlpha(colors.border, 0.3),
    },
    protocolList: {
      gap: ui.spacing.xs,
    },
    protocolStep: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.xs,
    },
    protocolIndex: {
      width: 20,
      height: 20,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(RANK_CONSOLE_TONE, 0.3),
      textAlign: "center",
      lineHeight: 18,
      fontSize: 10,
      fontWeight: "900",
      overflow: "hidden",
    },
    protocolText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "900",
      minWidth: 0,
    },
    briefFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.26),
      paddingTop: ui.spacing.xs,
    },
    briefFooterLabel: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0.55,
      textTransform: "uppercase",
    },
    briefFooterValue: {
      color: colors.textPrimary,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "900",
      flexShrink: 1,
      textAlign: "right",
    },
    momentumGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: ui.spacing.xs,
      rowGap: ui.spacing.xs,
    },
    momentumTile: {
      ...tileSurface,
      width: "48.8%",
      minWidth: 0,
      paddingHorizontal: ui.spacing.sm,
      paddingVertical: ui.spacing.sm,
      gap: 4,
    },
    momentumLabel: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0.5,
      textTransform: "uppercase",
    },
    momentumValue: {
      fontSize: 24,
      lineHeight: 28,
      fontWeight: "900",
    },
    momentumFoot: {
      color: withAlpha(colors.textSecondary, 0.74),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "700",
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
      fontSize: 9,
      lineHeight: 11,
      fontWeight: "900",
      textAlign: "center",
    },
    rankPathPanel: {
      ...cardSurface,
      gap: ui.spacing.sm,
    },
    rankPathList: {
      gap: ui.spacing.xs,
    },
    rankPathRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.xs,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.2),
      borderRadius: ui.radius.md,
      backgroundColor: withAlpha(colors.bg, 0.18),
      paddingHorizontal: ui.spacing.xs,
      paddingVertical: ui.spacing.xs,
    },
    rankPathRowNext: {
      borderStyle: "dashed",
    },
    rankPathStateRail: {
      width: 5,
      alignSelf: "stretch",
      borderRadius: 999,
      borderWidth: 1,
      minHeight: 34,
    },
    rankPathMark: {
      width: 36,
      height: 36,
      borderRadius: ui.radius.sm,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(colors.bg, 0.28),
    },
    rankPathCopy: {
      flex: 1,
      minWidth: 0,
    },
    rankPathName: {
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "900",
    },
    rankPathRange: {
      color: withAlpha(colors.textSecondary, 0.72),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "800",
      marginTop: 1,
    },
    rankPathStatus: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0.35,
      textTransform: "uppercase",
    },
    rankPathStatusPill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "transparent",
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignItems: "center",
      justifyContent: "center",
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
    emptyText: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "700",
    },
  });
}
