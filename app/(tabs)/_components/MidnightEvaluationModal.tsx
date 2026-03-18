import { withAlpha } from "@/app/(tabs)/_utils/designSystem";
import { formatSignedDelta } from "@/app/(tabs)/_utils/discipline";
import { useTheme } from "@/app/(tabs)/_utils/themeContext";
import React from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { MidnightEvaluationData } from "../_utils/midnightEvaluation";

type MidnightEvaluationModalProps = {
  evaluation: MidnightEvaluationData;
  currentRank: string;
  onStartNewDay: () => void;
  isSaving: boolean;
};

export function MidnightEvaluationModal({
  evaluation,
  currentRank,
  onStartNewDay,
  isSaving,
}: MidnightEvaluationModalProps) {
  const { colors } = useTheme();
  const isPositiveDelta = evaluation.drDelta >= 0;
  const { height } = useWindowDimensions();
  const isCompact = height < 760;
  const bottomClearance = 8;

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: "#040A0F",
        },
        content: {
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: isCompact ? 10 : 14,
          paddingBottom: 10,
        },
        main: {
          gap: isCompact ? 8 : 10,
        },
        header: {
          paddingTop: isCompact ? 2 : 4,
          paddingBottom: isCompact ? 8 : 10,
          gap: isCompact ? 4 : 6,
        },
        title: {
          color: "#EAF7FF",
          fontSize: isCompact ? 30 : 34,
          lineHeight: isCompact ? 34 : 38,
          fontWeight: "900",
          letterSpacing: 0.4,
        },
        subtitle: {
          color: withAlpha("#D4E9F5", 0.62),
          fontSize: isCompact ? 12 : 13,
          lineHeight: isCompact ? 16 : 18,
          fontWeight: "600",
          letterSpacing: 0.4,
          textTransform: "uppercase",
        },
        completionPanel: {
          backgroundColor: withAlpha("#0C1820", 0.92),
          borderWidth: 1,
          borderColor: withAlpha(colors.accentPrimary, 0.22),
          borderRadius: 14,
          paddingHorizontal: 16,
          paddingVertical: isCompact ? 12 : 14,
          gap: isCompact ? 8 : 10,
        },
        panelLabel: {
          color: withAlpha("#CDE2EE", 0.52),
          fontSize: 10,
          lineHeight: 13,
          fontWeight: "700",
          letterSpacing: 0.75,
          textTransform: "uppercase",
        },
        completionRow: {
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
        },
        completionMain: {
          color: "#E8FAFF",
          fontSize: isCompact ? 42 : 48,
          lineHeight: isCompact ? 46 : 52,
          fontWeight: "900",
          letterSpacing: -0.8,
        },
        completionPercentWrap: {
          alignItems: "flex-end",
          paddingBottom: 6,
        },
        completionPercent: {
          color: withAlpha("#E1F3FC", 0.9),
          fontSize: isCompact ? 22 : 26,
          lineHeight: isCompact ? 24 : 28,
          fontWeight: "800",
          letterSpacing: -0.2,
        },
        completionPercentMeta: {
          color: withAlpha("#BCD1DE", 0.6),
          fontSize: 10,
          lineHeight: 12,
          fontWeight: "700",
          letterSpacing: 0.65,
          textTransform: "uppercase",
          marginTop: 2,
        },
        judgmentSection: {},
        judgmentPanel: {
          backgroundColor: withAlpha("#0B141A", 0.7),
          borderWidth: 1,
          borderColor: isPositiveDelta
            ? withAlpha("#1BDDC9", 0.3)
            : withAlpha("#F56E86", 0.36),
          borderRadius: 16,
          paddingVertical: isCompact ? 14 : 18,
          paddingHorizontal: 16,
          alignItems: "center",
          gap: 4,
        },
        judgmentLabel: {
          color: withAlpha("#D8ECF7", 0.56),
          fontSize: 11,
          lineHeight: 14,
          fontWeight: "700",
          letterSpacing: 0.7,
          textTransform: "uppercase",
        },
        deltaValue: {
          color: isPositiveDelta ? "#1EE7D2" : "#FF7A93",
          fontSize: isCompact ? 64 : 76,
          lineHeight: isCompact ? 68 : 80,
          fontWeight: "900",
          letterSpacing: -1.6,
          textAlign: "center",
          textShadowColor: isPositiveDelta
            ? withAlpha("#1EE7D2", 0.38)
            : withAlpha("#FF7A93", 0.34),
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 18,
        },
        deltaCaption: {
          color: withAlpha("#CFE2EE", 0.58),
          fontSize: 10,
          lineHeight: 13,
          fontWeight: "700",
          letterSpacing: 0.75,
          textTransform: "uppercase",
        },
        lowerSection: {
          gap: 8,
        },
        rankPanel: {
          backgroundColor: withAlpha("#0C1A22", 0.88),
          borderWidth: 1,
          borderColor: withAlpha(colors.accentPrimary, 0.2),
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: isCompact ? 11 : 14,
          gap: 6,
        },
        rankValue: {
          color: "#DDF4FF",
          fontSize: isCompact ? 28 : 31,
          lineHeight: isCompact ? 32 : 35,
          fontWeight: "800",
          letterSpacing: 0.2,
          flexShrink: 0,
        },
        insightPanel: {
          backgroundColor: withAlpha("#101E26", 0.82),
          borderWidth: 1,
          borderColor: withAlpha("#7CA2B8", 0.24),
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: isCompact ? 9 : 10,
          gap: 4,
        },
        insightText: {
          color: withAlpha("#DDEFF9", 0.94),
          fontSize: isCompact ? 12 : 13,
          lineHeight: isCompact ? 17 : 18,
          fontWeight: "500",
        },
        footer: {
          marginTop: "auto",
          paddingTop: isCompact ? 10 : 14,
          paddingBottom: bottomClearance,
        },
        cta: {
          alignItems: "center",
          justifyContent: "center",
          minHeight: 60,
          backgroundColor: withAlpha(colors.accentPrimary, 0.24),
          borderColor: withAlpha(colors.accentPrimary, 0.64),
          borderWidth: 1,
          borderRadius: 12,
          shadowColor: colors.accentPrimary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 1,
        },
        ctaPressed: {
          opacity: 0.92,
        },
        ctaDisabled: {
          opacity: 0.56,
        },
        ctaLabel: {
          color: "#EAF7FF",
          fontSize: 16,
          lineHeight: 20,
          fontWeight: "800",
          letterSpacing: 0.2,
        },
      }),
    [bottomClearance, colors.accentPrimary, isCompact, isPositiveDelta]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.main}>
          <View style={styles.header}>
            <Text style={styles.title}>Midnight Evaluation</Text>
            <Text style={styles.subtitle}>Yesterday&apos;s Performance</Text>
          </View>

          <View style={styles.completionPanel}>
            <Text style={styles.panelLabel}>Completion</Text>
            <View style={styles.completionRow}>
              <Text style={styles.completionMain}>
                {evaluation.completedCount} / {evaluation.totalCount}
              </Text>
              <View style={styles.completionPercentWrap}>
                <Text style={styles.completionPercent}>{evaluation.completionPercent}%</Text>
                <Text style={styles.completionPercentMeta}>Completion</Text>
              </View>
            </View>
          </View>

          <View style={styles.judgmentSection}>
            <View style={styles.judgmentPanel}>
              <Text style={styles.judgmentLabel}>Judgment</Text>
              <Text style={styles.deltaValue}>{formatSignedDelta(evaluation.drDelta)}</Text>
              <Text style={styles.deltaCaption}>DR Change</Text>
            </View>
          </View>

          <View style={styles.lowerSection}>
            <View style={styles.rankPanel}>
              <Text style={styles.panelLabel}>Current Rank</Text>
              <Text style={styles.rankValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.88}>
                {currentRank}
              </Text>
            </View>

            <View style={styles.insightPanel}>
              <Text style={styles.panelLabel}>Insight</Text>
              <Text style={styles.insightText}>{evaluation.insight}</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
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
    </SafeAreaView>
  );
}