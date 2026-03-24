import { withAlpha } from "@/app/(tabs)/_utils/designSystem";
import { formatSignedDelta } from "@/app/(tabs)/_utils/discipline";
import { useTheme } from "@/app/(tabs)/_utils/themeContext";
import React from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
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
  styles: ReturnType<typeof makeStyles>;
};

type JudgmentHeroProps = {
  delta: number;
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
  styles,
}: EvaluationSummaryCardProps) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryLabel}>Yesterday&apos;s Result</Text>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryCount}>
          {completedCount} / {totalCount}
        </Text>
        <View style={styles.summaryPercentWrap}>
          <Text style={styles.summaryPercent}>{completionPercent}%</Text>
          <Text style={styles.summaryMeta}>completion</Text>
        </View>
      </View>
    </View>
  );
}

function JudgmentHero({ delta, message, isPositiveDelta, styles }: JudgmentHeroProps) {
  return (
    <View style={[styles.judgmentHero, isPositiveDelta ? styles.judgmentHeroPositive : styles.judgmentHeroNegative]}>
      <Text style={styles.judgmentLabel}>Judgment</Text>
      <Text style={[styles.deltaValue, isPositiveDelta ? styles.deltaPositive : styles.deltaNegative]}>
        {formatSignedDelta(delta)}
      </Text>
      <Text style={styles.judgmentSupport}>{message}</Text>
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
      <Text style={styles.insightLabel}>Insight</Text>
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
  accentPrimary: string,
  isPositiveDelta: boolean
) {
  const sectionGap = isCompact ? 22 : 26;

  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: "#050B11",
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: isCompact ? 12 : 16,
      paddingBottom: 0,
    },
    main: {
      gap: sectionGap,
    },
    header: {
      gap: 3,
      marginBottom: isCompact ? 4 : 6,
    },
    title: {
      color: "#EAF7FF",
      fontSize: isCompact ? 30 : 34,
      lineHeight: isCompact ? 34 : 38,
      fontWeight: "900",
      letterSpacing: 0.35,
    },
    subtitle: {
      color: withAlpha("#D4E9F5", 0.62),
      fontSize: isCompact ? 12 : 13,
      lineHeight: isCompact ? 16 : 18,
      fontWeight: "600",
      letterSpacing: 0.42,
      textTransform: "uppercase",
    },

    summaryCard: {
      backgroundColor: withAlpha("#0C1922", 0.9),
      borderWidth: 0,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: isCompact ? 10 : 11,
      gap: 4,
      shadowColor: accentPrimary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.04,
      shadowRadius: 7,
      elevation: 1,
    },
    summaryLabel: {
      color: withAlpha("#CDE2EE", 0.58),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "700",
      letterSpacing: 0.72,
      textTransform: "uppercase",
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    summaryCount: {
      color: "#E8FAFF",
      fontSize: isCompact ? 30 : 34,
      lineHeight: isCompact ? 34 : 38,
      fontWeight: "900",
      letterSpacing: -0.35,
    },
    summaryPercentWrap: {
      alignItems: "flex-end",
      justifyContent: "center",
    },
    summaryPercent: {
      color: withAlpha("#E1F3FC", 0.9),
      fontSize: isCompact ? 18 : 20,
      lineHeight: isCompact ? 20 : 22,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    summaryMeta: {
      color: withAlpha("#BCD1DE", 0.62),
      fontSize: 10,
      lineHeight: 12,
      fontWeight: "700",
      letterSpacing: 0.6,
      marginTop: 1,
    },

    judgmentHero: {
      borderRadius: 18,
      borderWidth: 0,
      paddingHorizontal: 18,
      paddingVertical: isCompact ? 22 : 26,
      minHeight: isCompact ? 174 : 190,
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      marginVertical: isCompact ? 12 : 18,
    },
    judgmentHeroPositive: {
      backgroundColor: withAlpha("#10212B", 0.78),
      shadowColor: accentPrimary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.03,
      shadowRadius: 8,
      elevation: 1,
    },
    judgmentHeroNegative: {
      backgroundColor: withAlpha("#15131A", 0.78),
      shadowColor: "#9C616C",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.025,
      shadowRadius: 6,
      elevation: 1,
    },
    judgmentLabel: {
      color: withAlpha("#D8ECF7", 0.64),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "700",
      letterSpacing: 0.68,
      textTransform: "uppercase",
    },
    deltaValue: {
      fontSize: isCompact ? 68 : 76,
      lineHeight: isCompact ? 72 : 80,
      fontWeight: "900",
      letterSpacing: -1.1,
      textAlign: "center",
    },
    deltaPositive: {
      color: withAlpha("#44E4D0", 0.98),
      textShadowColor: withAlpha(accentPrimary, 0.2),
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
    deltaNegative: {
      color: "#C97A84",
      textShadowColor: withAlpha("#9C616C", 0.12),
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 7,
    },
    judgmentSupport: {
      color: withAlpha("#D3E6F2", 0.72),
      fontSize: isCompact ? 12 : 13,
      lineHeight: isCompact ? 17 : 18,
      fontWeight: "500",
      textAlign: "center",
      maxWidth: 290,
    },

    statusPanel: {
      backgroundColor: "transparent",
      borderWidth: 0,
      borderRadius: 0,
      paddingHorizontal: 2,
      paddingVertical: 0,
      gap: 3,
    },
    statusTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    statusLabel: {
      color: withAlpha("#CDE2EE", 0.44),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "700",
      letterSpacing: 0.72,
      textTransform: "uppercase",
    },
    rankValue: {
      color: withAlpha("#DDF4FF", 0.8),
      fontSize: isCompact ? 18 : 20,
      lineHeight: isCompact ? 22 : 24,
      fontWeight: "800",
      letterSpacing: 0.08,
      flexShrink: 1,
      textAlign: "right",
    },
    insightLabel: {
      color: withAlpha("#CDE2EE", 0.44),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "700",
      letterSpacing: 0.68,
      textTransform: "uppercase",
    },
    insightText: {
      color: withAlpha("#E3F2FB", 0.72),
      fontSize: isCompact ? 12 : 13,
      lineHeight: isCompact ? 17 : 18,
      fontWeight: "500",
    },

    footer: {
      marginTop: "auto",
      paddingTop: isCompact ? 26 : 32,
      paddingBottom: bottomClearance,
    },
    ctaShell: {
      marginHorizontal: 10,
      borderRadius: 12,
      overflow: "hidden",
    },
    cta: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 58,
      backgroundColor: "#176D77",
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
      color: "#EAF7FF",
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
    () => makeStyles(isCompact, bottomClearance, colors.accentPrimary, isPositiveDelta),
    [bottomClearance, colors.accentPrimary, isCompact, isPositiveDelta]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={styles.content}>
        <View style={styles.main}>
          <View style={styles.header}>
            <Text style={styles.title}>Midnight Evaluation</Text>
            <Text style={styles.subtitle}>Yesterday&apos;s Performance</Text>
          </View>

          <EvaluationSummaryCard
            completedCount={evaluation.completedCount}
            totalCount={evaluation.totalCount}
            completionPercent={evaluation.completionPercent}
            styles={styles}
          />

          <JudgmentHero
            delta={evaluation.drDelta}
            message={judgmentMessage}
            isPositiveDelta={isPositiveDelta}
            styles={styles}
          />

          <StatusInsightPanel rank={currentRank} insight={evaluation.insight} styles={styles} />
        </View>

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