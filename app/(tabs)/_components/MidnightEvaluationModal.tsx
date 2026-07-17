import { IconSymbol } from "@/components/ui/icon-symbol";
import { ui, withAlpha } from "@/app/(tabs)/_utils/designSystem";
import { formatSignedDelta } from "@/app/(tabs)/_utils/discipline";
import { useTheme, type ThemeColors } from "@/app/(tabs)/_utils/themeContext";
import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, G } from "react-native-svg";

import { CONTRACT_GOLD, HOME_GOLD } from "../_styles";
import type { MidnightEvaluationData } from "../_utils/midnightEvaluation";

const CTA_FOREGROUND = "#101722";
const MIDNIGHT_ICON = require("../../../assets/images/midnight-icon.png");

type MidnightEvaluationModalProps = {
  evaluation: MidnightEvaluationData;
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

type EvaluationSupportPanelProps = {
  insight: string;
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
  const size = isCompact ? 102 : 116;
  const strokeWidth = isCompact ? 8 : 9;
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
          <Text style={styles.verdictRailText}>Result</Text>
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
        </View>
      </View>
    </View>
  );
}

function EvaluationSupportPanel({ insight, styles }: EvaluationSupportPanelProps) {
  return (
    <View style={styles.supportPanel}>
      <View style={styles.supportSection}>
        <View style={styles.panelTitleRow}>
          <IconSymbol name="shield.fill" size={17} color={CONTRACT_GOLD} />
          <Text style={styles.panelTitle}>Readout</Text>
        </View>
        <Text style={styles.signalText}>{insight}</Text>
      </View>
    </View>
  );
}

function getJudgmentMessage(delta: number): string {
  if (delta >= 8) return "Strong execution. Keep the standard today.";
  if (delta >= 3) return "Good discipline signal. Protect the momentum.";
  if (delta >= 0) return "Stable result. Make today's board cleaner.";
  return "Yesterday slipped. Start with the smallest win.";
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
      flexGrow: 1,
      justifyContent: "center",
      paddingHorizontal: isCompact ? 12 : 16,
      paddingTop: isCompact ? 10 : 14,
      paddingBottom: bottomClearance,
    },
    scroll: {
      flex: 1,
    },
    sheet: {
      borderRadius: ui.radius.xl,
      borderWidth: 1,
      borderColor: withAlpha(judgmentColor, 0.2),
      backgroundColor: withAlpha(colors.surface, 0.96),
      padding: isCompact ? 14 : 18,
      gap: sectionGap,
      shadowColor: judgmentColor,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.12,
      shadowRadius: 20,
      elevation: 5,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: isCompact ? 64 : 74,
    },
    sealShadow: {
      width: isCompact ? 54 : 64,
      height: isCompact ? 54 : 64,
      borderRadius: ui.radius.lg,
      shadowColor: judgmentColor,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
      elevation: 5,
      backgroundColor: colors.bg,
    },
    sealFrame: {
      flex: 1,
      borderRadius: ui.radius.lg,
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
      fontSize: isCompact ? 24 : 28,
      lineHeight: isCompact ? 28 : 32,
      fontWeight: "900",
      letterSpacing: 0,
    },
    overviewShadow: {
      borderRadius: ui.radius.card,
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
      borderRadius: ui.radius.card,
      borderWidth: 1,
      borderColor: withAlpha(judgmentColor, 0.24),
      backgroundColor: withAlpha(colors.surface2, 0.96),
      paddingTop: isCompact ? 10 : 12,
      paddingRight: isCompact ? 12 : 14,
      paddingBottom: isCompact ? 10 : 12,
      paddingLeft: isCompact ? 38 : 42,
      gap: isCompact ? 10 : 12,
    },
    verdictRail: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      width: isCompact ? 30 : 34,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(judgmentColor, isPositiveDelta ? 0.13 : 0.1),
      borderRightWidth: 1,
      borderRightColor: withAlpha(judgmentColor, 0.22),
    },
    verdictRailText: {
      position: "absolute",
      top: isCompact ? 62 : 70,
      left: isCompact ? -29 : -27,
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
      minHeight: 28,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(judgmentColor, 0.28),
      backgroundColor: withAlpha(judgmentColor, 0.1),
      paddingHorizontal: 9,
      paddingVertical: 5,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      alignSelf: "flex-start",
      maxWidth: "100%",
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
      gap: 10,
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
      minHeight: isCompact ? 56 : 64,
    },
    deltaValue: {
      fontSize: isCompact ? 50 : 58,
      lineHeight: isCompact ? 54 : 62,
      fontWeight: "900",
      letterSpacing: 0,
    },
    deltaUnit: {
      color: withAlpha(colors.textSecondary, 0.78),
      fontSize: 13,
      lineHeight: isCompact ? 22 : 25,
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
      fontSize: isCompact ? 11 : 12,
      lineHeight: isCompact ? 16 : 17,
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
      width: 78,
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
      fontSize: isCompact ? 23 : 27,
      lineHeight: isCompact ? 27 : 30,
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
      minHeight: isCompact ? 48 : 52,
      borderRadius: ui.radius.card,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.2),
      backgroundColor: withAlpha(colors.bg, 0.24),
      flexDirection: "row",
      alignItems: "stretch",
      overflow: "hidden",
    },
    statCell: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 8,
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
      textAlign: "center",
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: isCompact ? 15 : 16,
      lineHeight: isCompact ? 18 : 19,
      fontWeight: "900",
      letterSpacing: 0,
      textAlign: "center",
    },
    panelTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    panelTitle: {
      color: colors.textPrimary,
      fontSize: isCompact ? 12 : 13,
      lineHeight: isCompact ? 16 : 17,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    supportPanel: {
      borderRadius: ui.radius.card,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.24),
      backgroundColor: withAlpha(colors.surface2, 0.5),
      paddingHorizontal: isCompact ? 12 : 14,
      paddingVertical: isCompact ? 11 : 13,
    },
    supportSection: {
      gap: isCompact ? 5 : 6,
      minHeight: 0,
    },
    signalText: {
      color: withAlpha(colors.textPrimary, 0.76),
      fontSize: isCompact ? 12 : 13,
      lineHeight: isCompact ? 17 : 19,
      fontWeight: "600",
      letterSpacing: 0,
    },

    ctaShadow: {
      borderRadius: ui.radius.button,
      shadowColor: accentPrimary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 9,
      elevation: 3,
      backgroundColor: colors.bg,
    },
    cta: {
      minHeight: isCompact ? 48 : 52,
      borderRadius: ui.radius.button,
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
      fontSize: 15,
      lineHeight: 19,
      fontWeight: "900",
      letterSpacing: 0,
    },
  });
}

export function MidnightEvaluationModal({
  evaluation,
  onStartNewDay,
  isSaving,
}: MidnightEvaluationModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isPositiveDelta = evaluation.drDelta >= 0;
  const { height, width } = useWindowDimensions();
  const isCompact = height < 760 || width < 360;
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.sheet}>
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

          <EvaluationSupportPanel
            insight={evaluation.insight}
            styles={styles}
          />

          <View style={styles.ctaShadow}>
            <Pressable
              onPress={onStartNewDay}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel={isSaving ? "Saving midnight evaluation" : "Continue after midnight evaluation"}
              style={({ pressed }) => [
                styles.cta,
                pressed && styles.ctaPressed,
                isSaving && styles.ctaDisabled,
              ]}
            >
              <Text style={styles.ctaLabel}>{isSaving ? "Saving..." : "Continue"}</Text>
              <IconSymbol name="chevron.right" size={20} color={CTA_FOREGROUND} />
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
