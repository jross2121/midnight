import { IconSymbol } from "@/components/ui/icon-symbol";
import { withAlpha } from "@/app/(tabs)/_utils/designSystem";
import { formatSignedDelta } from "@/app/(tabs)/_utils/discipline";
import { useTheme, type ThemeColors } from "@/app/(tabs)/_utils/themeContext";
import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G } from "react-native-svg";

import { CONTRACT_BLUE, HOME_GOLD } from "../_styles";
import type { MidnightEvaluationData } from "../_utils/midnightEvaluation";
import type { NextDayPlan } from "../_utils/planning";

const CTA_FOREGROUND = "#101722";
const MIDNIGHT_ICON = require("../../../assets/images/midnight-icon.png");

type MidnightEvaluationModalProps = {
  evaluation: MidnightEvaluationData;
  currentRank: string;
  nextDayPlan: NextDayPlan;
  onStartNewDay: () => void;
  isSaving: boolean;
};

type ResultOverviewProps = {
  evaluation: MidnightEvaluationData;
  message: string;
  isPositiveDelta: boolean;
  isCompact: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
};

type EvaluationHeaderProps = {
  evaluation: MidnightEvaluationData;
  isPositiveDelta: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
};

type ScoreRingProps = {
  completionPercent: number;
  completedCount: number;
  totalCount: number;
  isCompact: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
};

type ProgressRowProps = {
  label: string;
  value: string;
  percent: number;
  color: string;
  styles: ReturnType<typeof makeStyles>;
};

type ScoreDetailsProps = {
  evaluation: MidnightEvaluationData;
  styles: ReturnType<typeof makeStyles>;
};

type SignalPanelProps = {
  rank: string;
  insight: string;
  styles: ReturnType<typeof makeStyles>;
};

type NextDayPlanPanelProps = {
  plan: NextDayPlan;
  styles: ReturnType<typeof makeStyles>;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatEvaluationDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day, 12));
}

function ScoreRing({
  completionPercent,
  completedCount,
  totalCount,
  isCompact,
  styles,
  colors,
}: ScoreRingProps) {
  const size = isCompact ? 108 : 124;
  const strokeWidth = isCompact ? 9 : 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = clampPercent(completionPercent);
  const strokeDashoffset = circumference * (1 - percent / 100);

  return (
    <View style={[styles.scoreRingFrame, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={withAlpha(colors.textPrimary, 0.12)}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={HOME_GOLD}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            fill="transparent"
          />
        </G>
      </Svg>
      <View style={styles.scoreRingCenter}>
        <Text style={styles.scoreRingLabel}>Score</Text>
        <Text style={styles.scoreRingValue}>{percent}%</Text>
        <Text style={styles.scoreRingMeta}>
          {totalCount > 0 ? `${completedCount}/${totalCount}` : "0/0"}
        </Text>
      </View>
    </View>
  );
}

function EvaluationHeader({ evaluation, isPositiveDelta, styles, colors }: EvaluationHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.sealShadow}>
        <View style={styles.sealFrame}>
          <Image source={MIDNIGHT_ICON} style={styles.sealImage} resizeMode="cover" />
        </View>
      </View>

      <View style={styles.headerCopy}>
        <View style={styles.headerMetaRow}>
          <Text style={styles.eyebrow}>Daily evaluation</Text>
          <Text style={styles.evaluationDate}>{formatEvaluationDate(evaluation.date)}</Text>
        </View>
        <Text style={styles.title}>Midnight Evaluation</Text>
        <View style={styles.headerStatusRow}>
          <View style={styles.runBadge}>
            <IconSymbol
              name={isPositiveDelta ? "checkmark.circle.fill" : "flag.fill"}
              size={14}
              color={isPositiveDelta ? HOME_GOLD : colors.negative}
            />
            <Text
              style={[
                styles.runBadgeText,
                isPositiveDelta ? styles.runBadgeTextPositive : styles.runBadgeTextNegative,
              ]}
              numberOfLines={1}
            >
              {evaluation.runTitle}
            </Text>
          </View>
          <Text style={styles.subtitle}>Board scored</Text>
        </View>
      </View>
    </View>
  );
}

function ResultOverview({
  evaluation,
  message,
  isPositiveDelta,
  isCompact,
  styles,
  colors,
}: ResultOverviewProps) {
  return (
    <View style={styles.overviewShadow}>
      <View style={styles.overviewPanel}>
        <View style={styles.verdictRail}>
          <Text style={styles.verdictRailText}>Judgment</Text>
        </View>

        <View style={styles.overviewBody}>
          <View style={styles.deltaBlock}>
            <Text style={styles.deltaLabel}>Discipline Rating</Text>
            <View style={styles.deltaLine}>
              <Text style={[styles.deltaValue, isPositiveDelta ? styles.deltaPositive : styles.deltaNegative]}>
                {formatSignedDelta(evaluation.drDelta)}
              </Text>
              <Text style={styles.deltaUnit}>DR</Text>
            </View>
            <Text style={styles.judgmentMessage}>{message}</Text>
          </View>

          <ScoreRing
            completionPercent={evaluation.completionPercent}
            completedCount={evaluation.completedCount}
            totalCount={evaluation.totalCount}
            isCompact={isCompact}
            styles={styles}
            colors={colors}
          />
        </View>

        <View style={styles.statGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Quests</Text>
            <Text style={styles.statValue}>
              {evaluation.completedCount}/{evaluation.totalCount}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Contract</Text>
            <Text style={styles.statValue}>
              {evaluation.contractTotalCount > 0
                ? `${evaluation.contractCompletedCount}/${evaluation.contractTotalCount}`
                : "None"}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>Recovery</Text>
            <Text style={styles.statValue}>
              {evaluation.comebackBonus > 0 ? formatSignedDelta(evaluation.comebackBonus) : "0"}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function ProgressRow({ label, value, percent, color, styles }: ProgressRowProps) {
  const safePercent = clampPercent(percent);

  return (
    <View style={styles.progressRow}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{value}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${safePercent}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ScoreDetails({ evaluation, styles }: ScoreDetailsProps) {
  const contractPercent =
    evaluation.contractTotalCount > 0
      ? (evaluation.contractCompletedCount / evaluation.contractTotalCount) * 100
      : 0;

  return (
    <View style={styles.detailsPanel}>
      <View style={styles.panelTitleRow}>
        <IconSymbol name="chart.bar.fill" size={18} color={HOME_GOLD} />
        <Text style={styles.panelTitle}>Score Breakdown</Text>
      </View>

      <ProgressRow
        label="Daily quests"
        value={
          evaluation.totalCount > 0
            ? `${evaluation.completedCount} of ${evaluation.totalCount}`
            : "No quests scheduled"
        }
        percent={evaluation.completionPercent}
        color={HOME_GOLD}
        styles={styles}
      />

      <ProgressRow
        label="Midnight contract"
        value={
          evaluation.contractTotalCount > 0
            ? `${evaluation.contractCompletedCount} of ${evaluation.contractTotalCount}`
            : "No contract set"
        }
        percent={contractPercent}
        color={CONTRACT_BLUE}
        styles={styles}
      />

      <View style={styles.deltaMathRow}>
        <View style={styles.deltaMathItem}>
          <Text style={styles.deltaMathLabel}>Base score</Text>
          <Text style={styles.deltaMathValue}>{formatSignedDelta(evaluation.baseDrDelta)}</Text>
        </View>
        <View style={styles.deltaMathDivider} />
        <View style={styles.deltaMathItem}>
          <Text style={styles.deltaMathLabel}>Recovery</Text>
          <Text style={styles.deltaMathValue}>
            {evaluation.comebackBonus > 0 ? formatSignedDelta(evaluation.comebackBonus) : "0"}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SignalPanel({ rank, insight, styles }: SignalPanelProps) {
  return (
    <View style={styles.signalPanel}>
      <View style={styles.panelTitleRow}>
        <IconSymbol name="shield.fill" size={18} color={CONTRACT_BLUE} />
        <Text style={styles.panelTitle}>Signal</Text>
      </View>
      <View style={styles.signalContent}>
        <Text style={styles.signalRank} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>
          {rank}
        </Text>
        <Text style={styles.signalText}>{insight}</Text>
      </View>
    </View>
  );
}

function NextDayPlanPanel({ plan, styles }: NextDayPlanPanelProps) {
  return (
    <View style={styles.planPanel}>
      <View style={styles.panelTitleRow}>
        <IconSymbol name="calendar" size={18} color={HOME_GOLD} />
        <Text style={styles.panelTitle}>Today&apos;s Plan</Text>
      </View>

      <Text style={styles.planTitle}>{plan.title}</Text>
      <Text style={styles.planBody}>{plan.body}</Text>

      <View style={styles.planSteps}>
        {plan.steps.map((step, index) => (
          <View key={`${step}-${index}`} style={styles.planStep}>
            <Text style={styles.planStepNumber}>{index + 1}</Text>
            <Text style={styles.planStepText}>{step}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function getJudgmentMessage(delta: number): string {
  if (delta >= 8) return "Strong execution. Keep the standard today.";
  if (delta >= 3) return "Good discipline signal. Protect the momentum.";
  if (delta >= 0) return "Stable result. Make the next board cleaner.";
  return "The standard slipped. Start with the smallest win.";
}

function makeStyles(
  isCompact: boolean,
  bottomClearance: number,
  colors: ThemeColors,
  isPositiveDelta: boolean
) {
  const accentPrimary = HOME_GOLD;
  const judgmentColor = isPositiveDelta ? HOME_GOLD : colors.negative;
  const sectionGap = isCompact ? 10 : 12;

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
      height: isCompact ? 220 : 280,
      backgroundColor: withAlpha(judgmentColor, isPositiveDelta ? 0.1 : 0.07),
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(judgmentColor, 0.12),
    },
    backdropRule: {
      position: "absolute",
      top: isCompact ? 220 : 280,
      left: 18,
      right: 18,
      height: 1,
      backgroundColor: withAlpha(colors.textPrimary, 0.06),
    },
    content: {
      flex: 1,
      paddingHorizontal: 18,
      paddingTop: isCompact ? 8 : 14,
      paddingBottom: 0,
    },
    scrollContent: {
      paddingBottom: isCompact ? 6 : 8,
    },
    main: {
      gap: sectionGap,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      marginBottom: isCompact ? 1 : 4,
      minHeight: isCompact ? 86 : 96,
    },
    sealShadow: {
      width: isCompact ? 76 : 86,
      height: isCompact ? 76 : 86,
      borderRadius: isCompact ? 22 : 25,
      shadowColor: judgmentColor,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
      elevation: 5,
      backgroundColor: colors.bg,
    },
    sealFrame: {
      flex: 1,
      borderRadius: isCompact ? 22 : 25,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: withAlpha(judgmentColor, 0.42),
      backgroundColor: withAlpha(colors.surface2, 0.98),
    },
    sealImage: {
      width: "100%",
      height: "100%",
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
      gap: 5,
    },
    headerMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    headerStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    eyebrow: {
      color: withAlpha(judgmentColor, 0.92),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    title: {
      color: colors.textPrimary,
      fontSize: isCompact ? 28 : 32,
      lineHeight: isCompact ? 32 : 36,
      fontWeight: "900",
      letterSpacing: 0,
    },
    subtitle: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: isCompact ? 13 : 14,
      lineHeight: isCompact ? 18 : 20,
      fontWeight: "600",
      letterSpacing: 0,
    },

    overviewShadow: {
      borderRadius: 22,
      shadowColor: judgmentColor,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
      elevation: 4,
      backgroundColor: colors.bg,
    },
    overviewPanel: {
      position: "relative",
      overflow: "hidden",
      borderRadius: 22,
      borderWidth: 1,
      borderColor: withAlpha(judgmentColor, 0.24),
      backgroundColor: withAlpha(colors.surface2, 0.96),
      paddingTop: isCompact ? 14 : 16,
      paddingRight: isCompact ? 14 : 16,
      paddingBottom: isCompact ? 14 : 16,
      paddingLeft: isCompact ? 46 : 50,
      gap: isCompact ? 14 : 16,
    },
    verdictRail: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      width: isCompact ? 32 : 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(judgmentColor, isPositiveDelta ? 0.13 : 0.1),
      borderRightWidth: 1,
      borderRightColor: withAlpha(judgmentColor, 0.22),
    },
    verdictRailText: {
      position: "absolute",
      top: isCompact ? 74 : 82,
      left: isCompact ? -27 : -25,
      width: 88,
      color: withAlpha(judgmentColor, 0.9),
      fontSize: 10,
      lineHeight: 12,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "center",
      textTransform: "uppercase",
      transform: [{ rotate: "-90deg" }],
    },
    overviewHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    runBadge: {
      minHeight: 30,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(judgmentColor, 0.28),
      backgroundColor: withAlpha(judgmentColor, 0.1),
      paddingHorizontal: 10,
      paddingVertical: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      maxWidth: "72%",
    },
    runBadgeText: {
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
      flexShrink: 1,
    },
    runBadgeTextPositive: {
      color: HOME_GOLD,
    },
    runBadgeTextNegative: {
      color: colors.negative,
    },
    evaluationDate: {
      color: withAlpha(colors.textSecondary, 0.8),
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    overviewBody: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
    },
    deltaBlock: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    deltaLabel: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    deltaLine: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 6,
      minHeight: isCompact ? 70 : 78,
    },
    deltaValue: {
      fontSize: isCompact ? 66 : 76,
      lineHeight: isCompact ? 70 : 80,
      fontWeight: "900",
      letterSpacing: 0,
    },
    deltaUnit: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 14,
      lineHeight: isCompact ? 26 : 30,
      fontWeight: "900",
      letterSpacing: 0,
    },
    deltaPositive: {
      color: HOME_GOLD,
      textShadowColor: withAlpha(HOME_GOLD, 0.18),
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 12,
    },
    deltaNegative: {
      color: colors.negative,
      textShadowColor: withAlpha(colors.negative, 0.14),
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 10,
    },
    judgmentMessage: {
      color: withAlpha(colors.textPrimary, 0.78),
      fontSize: isCompact ? 12 : 13,
      lineHeight: isCompact ? 17 : 18,
      fontWeight: "600",
      maxWidth: 230,
    },
    scoreRingFrame: {
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    scoreRingCenter: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
      width: 82,
      gap: 0,
    },
    scoreRingLabel: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    scoreRingValue: {
      color: colors.textPrimary,
      fontSize: isCompact ? 25 : 29,
      lineHeight: isCompact ? 29 : 32,
      fontWeight: "900",
      letterSpacing: 0,
    },
    scoreRingMeta: {
      color: withAlpha(colors.textSecondary, 0.72),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "800",
      letterSpacing: 0,
    },
    statGrid: {
      minHeight: 54,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.2),
      backgroundColor: withAlpha(colors.bg, 0.24),
      flexDirection: "row",
      alignItems: "stretch",
      overflow: "hidden",
    },
    statCell: {
      flex: 1,
      paddingHorizontal: 10,
      paddingVertical: 9,
      justifyContent: "center",
      gap: 3,
    },
    statDivider: {
      width: 1,
      backgroundColor: withAlpha(colors.border, 0.22),
    },
    statLabel: {
      color: withAlpha(colors.textSecondary, 0.7),
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: isCompact ? 16 : 17,
      lineHeight: isCompact ? 19 : 20,
      fontWeight: "900",
      letterSpacing: 0,
    },
    rankStrip: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.26),
      backgroundColor: withAlpha(colors.bg, 0.28),
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    rankStripLabel: {
      color: withAlpha(colors.textSecondary, 0.72),
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    rankStripValue: {
      color: colors.textPrimary,
      fontSize: isCompact ? 15 : 16,
      lineHeight: isCompact ? 19 : 20,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "right",
      flexShrink: 1,
    },

    detailsPanel: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.28),
      backgroundColor: withAlpha(colors.surface2, 0.58),
      padding: isCompact ? 12 : 14,
      gap: 11,
    },
    panelTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    panelTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    progressRow: {
      gap: 7,
    },
    progressHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    progressLabel: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    progressValue: {
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "right",
      flexShrink: 1,
    },
    progressTrack: {
      height: 10,
      borderRadius: 999,
      overflow: "hidden",
      backgroundColor: withAlpha(colors.bg, 0.7),
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.3),
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
    },
    deltaMathRow: {
      minHeight: 56,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.22),
      backgroundColor: withAlpha(colors.bg, 0.22),
      flexDirection: "row",
      alignItems: "stretch",
    },
    deltaMathItem: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      justifyContent: "center",
      gap: 3,
    },
    deltaMathDivider: {
      width: 1,
      backgroundColor: withAlpha(colors.border, 0.24),
    },
    deltaMathLabel: {
      color: withAlpha(colors.textSecondary, 0.72),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "800",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    deltaMathValue: {
      color: colors.textPrimary,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
      letterSpacing: 0,
    },

    signalPanel: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: withAlpha(CONTRACT_BLUE, 0.2),
      backgroundColor: withAlpha(CONTRACT_BLUE, 0.055),
      padding: isCompact ? 12 : 14,
      gap: 8,
    },
    signalContent: {
      gap: 5,
    },
    signalRank: {
      color: colors.textPrimary,
      fontSize: isCompact ? 17 : 18,
      lineHeight: isCompact ? 21 : 22,
      fontWeight: "900",
      letterSpacing: 0,
    },
    signalText: {
      color: withAlpha(colors.textPrimary, 0.76),
      fontSize: isCompact ? 12 : 13,
      lineHeight: isCompact ? 17 : 19,
      fontWeight: "600",
      letterSpacing: 0,
    },

    planPanel: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: withAlpha(accentPrimary, 0.18),
      backgroundColor: withAlpha(accentPrimary, 0.075),
      padding: isCompact ? 12 : 14,
      gap: 8,
    },
    planTitle: {
      color: colors.textPrimary,
      fontSize: isCompact ? 18 : 19,
      lineHeight: isCompact ? 22 : 23,
      fontWeight: "900",
      letterSpacing: 0,
    },
    planBody: {
      color: withAlpha(colors.textPrimary, 0.76),
      fontSize: isCompact ? 12 : 13,
      lineHeight: isCompact ? 17 : 19,
      fontWeight: "600",
      letterSpacing: 0,
    },
    planSteps: {
      gap: 6,
      marginTop: 1,
    },
    planStep: {
      minHeight: 34,
      borderRadius: 12,
      backgroundColor: withAlpha(colors.bg, 0.24),
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.18),
      paddingHorizontal: 9,
      paddingVertical: 7,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    planStepNumber: {
      width: 22,
      height: 22,
      borderRadius: 11,
      overflow: "hidden",
      textAlign: "center",
      textAlignVertical: "center",
      backgroundColor: withAlpha(accentPrimary, 0.18),
      color: accentPrimary,
      fontSize: 11,
      lineHeight: 22,
      fontWeight: "900",
      flexShrink: 0,
    },
    planStepText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: isCompact ? 12 : 13,
      lineHeight: isCompact ? 17 : 18,
      fontWeight: "800",
      letterSpacing: 0,
    },

    footer: {
      paddingTop: isCompact ? 8 : 10,
      paddingBottom: bottomClearance,
      backgroundColor: colors.bg,
    },
    ctaShadow: {
      borderRadius: 16,
      shadowColor: accentPrimary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 9,
      elevation: 3,
      backgroundColor: colors.bg,
    },
    cta: {
      minHeight: 56,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: withAlpha(accentPrimary, 0.28),
      backgroundColor: accentPrimary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    ctaPressed: {
      opacity: 0.94,
      transform: [{ scale: 0.985 }],
    },
    ctaDisabled: {
      opacity: 0.56,
    },
    ctaLabel: {
      color: CTA_FOREGROUND,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "900",
      letterSpacing: 0,
    },
  });
}

export function MidnightEvaluationModal({
  evaluation,
  currentRank,
  nextDayPlan,
  onStartNewDay,
  isSaving,
}: MidnightEvaluationModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isPositiveDelta = evaluation.drDelta >= 0;
  const { height } = useWindowDimensions();
  const isCompact = height < 760;
  const bottomClearance = Math.max(insets.bottom, 10);
  const judgmentMessage = React.useMemo(() => getJudgmentMessage(evaluation.drDelta), [evaluation.drDelta]);

  const styles = React.useMemo(
    () => makeStyles(isCompact, bottomClearance, colors, isPositiveDelta),
    [bottomClearance, colors, isCompact, isPositiveDelta]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View pointerEvents="none" style={styles.backdrop}>
        <View style={styles.backdropTopBand} />
        <View style={styles.backdropRule} />
      </View>

      <View style={styles.content}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.main}>
            <EvaluationHeader
              evaluation={evaluation}
              isPositiveDelta={isPositiveDelta}
              styles={styles}
              colors={colors}
            />

            <ResultOverview
              evaluation={evaluation}
              message={judgmentMessage}
              isPositiveDelta={isPositiveDelta}
              isCompact={isCompact}
              styles={styles}
              colors={colors}
            />

            <ScoreDetails evaluation={evaluation} styles={styles} />
            <SignalPanel rank={currentRank} insight={evaluation.insight} styles={styles} />
            <NextDayPlanPanel plan={nextDayPlan} styles={styles} />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.ctaShadow}>
            <Pressable
              onPress={onStartNewDay}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.cta,
                pressed && styles.ctaPressed,
                isSaving && styles.ctaDisabled,
              ]}
            >
              <Text style={styles.ctaLabel}>{isSaving ? "Saving..." : "Start Today"}</Text>
              <IconSymbol name="chevron.right" size={20} color={CTA_FOREGROUND} />
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
