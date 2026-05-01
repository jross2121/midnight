import { withAlpha } from "@/app/(tabs)/_utils/designSystem";
import { formatSignedDelta } from "@/app/(tabs)/_utils/discipline";
import { useTheme, type ThemeColors } from "@/app/(tabs)/_utils/themeContext";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import type { MidnightEvaluationData } from "../_utils/midnightEvaluation";

type MidnightEvaluationModalProps = {
  evaluation: MidnightEvaluationData;
  currentRank: string;
  onStartNewDay: () => void;
  isSaving: boolean;
};

type EvaluationSummaryCardProps = {
  completedCount: number;
  totalCount: number;
  completionPercent: number;
  contractCompletedCount: number;
  contractTotalCount: number;
  comebackBonus: number;
  styles: ReturnType<typeof makeStyles>;
};

type JudgmentHeroProps = {
  delta: number;
  baseDelta: number;
  comebackBonus: number;
  message: string;
  isPositiveDelta: boolean;
  styles: ReturnType<typeof makeStyles>;
};

type StatusInsightPanelProps = {
  rank: string;
  insight: string;
  styles: ReturnType<typeof makeStyles>;
};

function EvaluationSummaryCard({
  completedCount,
  totalCount,
  completionPercent,
  contractCompletedCount,
  contractTotalCount,
  comebackBonus,
  styles,
}: EvaluationSummaryCardProps) {
  const contractPercent =
    contractTotalCount > 0 ? Math.round((contractCompletedCount / contractTotalCount) * 100) : 0;

  return (
    <View style={styles.resultBlock}>
      <View style={styles.resultTiles}>
        <View style={styles.resultTile}>
          <Text style={styles.resultTileLabel}>Quests</Text>
          <Text style={styles.resultTileValue}>{completedCount}/{totalCount}</Text>
        </View>
        <View style={styles.resultTile}>
          <Text style={styles.resultTileLabel}>Completion</Text>
          <Text style={styles.resultTileValue}>{completionPercent}%</Text>
        </View>
        <View style={styles.resultTile}>
          <Text style={styles.resultTileLabel}>Recovery</Text>
          <Text style={styles.resultTileValue}>{comebackBonus > 0 ? `+${comebackBonus}` : "0"}</Text>
        </View>
      </View>

      <View style={styles.contractCard}>
        <View style={styles.contractTopRow}>
          <View>
            <Text style={styles.contractLabel}>Midnight Contract</Text>
            <Text style={styles.contractValue}>
              {contractTotalCount > 0
                ? `${contractCompletedCount} / ${contractTotalCount} protected`
                : "No contract set"}
            </Text>
          </View>
          <Text style={styles.contractPercent}>{contractPercent}%</Text>
        </View>
        <View style={styles.contractTrack}>
          <View style={[styles.contractFill, { width: `${contractPercent}%` }]} />
        </View>
      </View>
    </View>
  );
}

function JudgmentHero({
  delta,
  baseDelta,
  comebackBonus,
  message,
  isPositiveDelta,
  styles,
}: JudgmentHeroProps) {
  return (
    <View style={[styles.judgmentHero, isPositiveDelta ? styles.judgmentHeroPositive : styles.judgmentHeroNegative]}>
      <Text style={styles.judgmentLabel}>Discipline Rating</Text>
      <View style={styles.deltaRow}>
        <Text style={[styles.deltaValue, isPositiveDelta ? styles.deltaPositive : styles.deltaNegative]}>
          {formatSignedDelta(delta)}
        </Text>
        <Text style={styles.deltaUnit}>DR</Text>
      </View>
      <Text style={styles.judgmentSupport}>{message}</Text>
      {comebackBonus > 0 ? (
        <Text style={styles.deltaBreakdown}>
          Base {formatSignedDelta(baseDelta)} + comeback {formatSignedDelta(comebackBonus)}
        </Text>
      ) : null}
    </View>
  );
}

function StatusInsightPanel({ rank, insight, styles }: StatusInsightPanelProps) {
  return (
    <View style={styles.statusPanel}>
      <View style={styles.statusTopRow}>
        <Text style={styles.statusLabel}>Current Rank</Text>
        <Text style={styles.rankValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
          {rank}
        </Text>
      </View>
      <Text style={styles.insightLabel}>Next Signal</Text>
      <Text style={styles.insightText} numberOfLines={2}>
        {insight}
      </Text>
    </View>
  );
}

function getJudgmentMessage(delta: number): string {
  if (delta >= 8) return "Strong execution. Keep the standard tomorrow.";
  if (delta >= 3) return "Good discipline signal. Protect this momentum.";
  if (delta >= 0) return "Stable day. Push for cleaner completion tomorrow.";
  return "Discipline slipped. Reset sharply and execute tomorrow.";
}

function makeStyles(
  isCompact: boolean,
  bottomClearance: number,
  colors: ThemeColors,
  isPositiveDelta: boolean
) {
  const accentPrimary = colors.accentPrimary;
  const judgmentColor = isPositiveDelta ? colors.accentPrimary : colors.negative;
  const sectionGap = isCompact ? 14 : 16;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.bg,
    },
    backdropTopBand: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: isCompact ? 260 : 320,
      backgroundColor: withAlpha(accentPrimary, isPositiveDelta ? 0.1 : 0.04),
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(accentPrimary, 0.08),
    },
    moonGlow: {
      position: "absolute",
      top: -74,
      right: -58,
      width: 210,
      height: 210,
      borderRadius: 105,
      borderWidth: 1,
      borderColor: withAlpha(accentPrimary, 0.13),
      backgroundColor: withAlpha(accentPrimary, 0.035),
    },
    content: {
      flex: 1,
      paddingHorizontal: 18,
      paddingTop: isCompact ? 8 : 14,
      paddingBottom: 0,
    },
    scrollContent: {
      paddingBottom: isCompact ? 18 : 24,
    },
    main: {
      gap: sectionGap,
    },
    header: {
      gap: 5,
      marginBottom: isCompact ? 0 : 2,
    },
    runTitle: {
      alignSelf: "flex-start",
      color: judgmentColor,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "900",
      letterSpacing: 0.7,
      textTransform: "uppercase",
      borderWidth: 1,
      borderColor: withAlpha(judgmentColor, 0.34),
      backgroundColor: withAlpha(judgmentColor, 0.1),
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      overflow: "hidden",
    },
    title: {
      color: colors.textPrimary,
      fontSize: isCompact ? 30 : 36,
      lineHeight: isCompact ? 34 : 40,
      fontWeight: "900",
      letterSpacing: 0.1,
    },
    subtitle: {
      color: withAlpha(colors.textSecondary, 0.72),
      fontSize: isCompact ? 12 : 13,
      lineHeight: isCompact ? 16 : 18,
      fontWeight: "600",
      letterSpacing: 0.42,
      textTransform: "uppercase",
    },

    judgmentHero: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: withAlpha(judgmentColor, 0.22),
      paddingHorizontal: 18,
      paddingVertical: isCompact ? 20 : 24,
      minHeight: isCompact ? 168 : 184,
      justifyContent: "center",
      alignItems: "center",
      gap: 7,
      marginTop: isCompact ? 2 : 4,
      shadowColor: judgmentColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 18,
      elevation: 3,
    },
    judgmentHeroPositive: {
      backgroundColor: withAlpha(colors.surface2, 0.84),
    },
    judgmentHeroNegative: {
      backgroundColor: withAlpha("#15131A", 0.86),
    },
    judgmentLabel: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "700",
      letterSpacing: 0.68,
      textTransform: "uppercase",
    },
    deltaRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "center",
      gap: 7,
    },
    deltaValue: {
      fontSize: isCompact ? 82 : 96,
      lineHeight: isCompact ? 86 : 100,
      fontWeight: "900",
      letterSpacing: -0.8,
      textAlign: "center",
    },
    deltaUnit: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 14,
      lineHeight: 25,
      fontWeight: "900",
      letterSpacing: 0.8,
    },
    deltaPositive: {
      color: withAlpha(accentPrimary, 0.98),
      textShadowColor: withAlpha(accentPrimary, 0.2),
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 12,
    },
    deltaNegative: {
      color: colors.negative,
      textShadowColor: withAlpha(colors.negative, 0.16),
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
    judgmentSupport: {
      color: withAlpha(colors.textPrimary, 0.78),
      fontSize: isCompact ? 12 : 13,
      lineHeight: isCompact ? 17 : 18,
      fontWeight: "600",
      textAlign: "center",
      maxWidth: 300,
    },
    deltaBreakdown: {
      color: withAlpha(judgmentColor, 0.8),
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "800",
      textAlign: "center",
      textTransform: "uppercase",
      letterSpacing: 0.45,
      marginTop: 2,
    },

    resultBlock: {
      gap: 10,
    },
    resultTiles: {
      flexDirection: "row",
      gap: 8,
    },
    resultTile: {
      flex: 1,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.36),
      borderRadius: 10,
      backgroundColor: withAlpha(colors.surface2, 0.5),
      paddingHorizontal: 9,
      paddingVertical: 9,
      minHeight: 62,
      justifyContent: "space-between",
    },
    resultTileLabel: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "800",
      letterSpacing: 0.55,
      textTransform: "uppercase",
    },
    resultTileValue: {
      color: colors.textPrimary,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
      marginTop: 6,
    },
    contractCard: {
      borderWidth: 1,
      borderColor: withAlpha(accentPrimary, 0.2),
      borderRadius: 12,
      backgroundColor: withAlpha(colors.surface2, 0.48),
      padding: 12,
      gap: 10,
    },
    contractTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    contractLabel: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "800",
      letterSpacing: 0.7,
      textTransform: "uppercase",
    },
    contractValue: {
      color: colors.textPrimary,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "900",
      marginTop: 3,
    },
    contractPercent: {
      color: accentPrimary,
      fontSize: 20,
      lineHeight: 24,
      fontWeight: "900",
    },
    contractTrack: {
      height: 9,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.bg, 0.78),
      overflow: "hidden",
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.36),
    },
    contractFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: accentPrimary,
    },

    statusPanel: {
      backgroundColor: withAlpha(colors.surface2, 0.28),
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.26),
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 11,
      gap: 6,
    },
    statusTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    statusLabel: {
      color: withAlpha(colors.textSecondary, 0.66),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "700",
      letterSpacing: 0.72,
      textTransform: "uppercase",
    },
    rankValue: {
      color: colors.textPrimary,
      fontSize: isCompact ? 16 : 18,
      lineHeight: isCompact ? 20 : 22,
      fontWeight: "900",
      letterSpacing: 0.08,
      flexShrink: 1,
      textAlign: "right",
    },
    insightLabel: {
      color: withAlpha(colors.textSecondary, 0.66),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "700",
      letterSpacing: 0.68,
      textTransform: "uppercase",
    },
    insightText: {
      color: withAlpha(colors.textPrimary, 0.75),
      fontSize: isCompact ? 12 : 13,
      lineHeight: isCompact ? 17 : 18,
      fontWeight: "600",
    },

    footer: {
      paddingTop: isCompact ? 10 : 12,
      paddingBottom: bottomClearance,
    },
    ctaShell: {
      borderRadius: 12,
      overflow: "hidden",
    },
    cta: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 58,
      backgroundColor: accentPrimary,
      borderColor: withAlpha(accentPrimary, 0.26),
      borderWidth: 1,
      borderRadius: 12,
      shadowColor: accentPrimary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.04,
      shadowRadius: 7,
      elevation: 1,
    },
    ctaPressed: {
      opacity: 0.95,
      transform: [{ scale: 0.985 }],
    },
    ctaDisabled: {
      opacity: 0.56,
    },
    ctaLabel: {
      color: colors.textPrimary,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "900",
      letterSpacing: 0.2,
    },
  });
}

export function MidnightEvaluationModal({
  evaluation,
  currentRank,
  onStartNewDay,
  isSaving,
}: MidnightEvaluationModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isPositiveDelta = evaluation.drDelta >= 0;
  const { height } = useWindowDimensions();
  const isCompact = height < 760;
  const bottomClearance = insets.bottom + 34;
  const judgmentMessage = React.useMemo(() => getJudgmentMessage(evaluation.drDelta), [evaluation.drDelta]);

  const styles = React.useMemo(
    () => makeStyles(isCompact, bottomClearance, colors, isPositiveDelta),
    [bottomClearance, colors, isCompact, isPositiveDelta]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View pointerEvents="none" style={styles.backdrop}>
        <View style={styles.backdropTopBand} />
        <View style={styles.moonGlow} />
      </View>
      <View style={styles.content}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.main}>
            <View style={styles.header}>
              <Text style={styles.runTitle}>{evaluation.runTitle}</Text>
              <Text style={styles.title}>Midnight Judgment</Text>
              <Text style={styles.subtitle}>Yesterday&apos;s run has been scored</Text>
            </View>

            <JudgmentHero
              delta={evaluation.drDelta}
              baseDelta={evaluation.baseDrDelta}
              comebackBonus={evaluation.comebackBonus}
              message={judgmentMessage}
              isPositiveDelta={isPositiveDelta}
              styles={styles}
            />

            <EvaluationSummaryCard
              completedCount={evaluation.completedCount}
              totalCount={evaluation.totalCount}
              completionPercent={evaluation.completionPercent}
              contractCompletedCount={evaluation.contractCompletedCount}
              contractTotalCount={evaluation.contractTotalCount}
              comebackBonus={evaluation.comebackBonus}
              styles={styles}
            />

            <StatusInsightPanel rank={currentRank} insight={evaluation.insight} styles={styles} />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.ctaShell}>
            <Pressable
              onPress={onStartNewDay}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.cta,
                pressed && styles.ctaPressed,
                isSaving && styles.ctaDisabled,
              ]}
            >
              <Text style={styles.ctaLabel}>{isSaving ? "Saving..." : "Start New Day"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
