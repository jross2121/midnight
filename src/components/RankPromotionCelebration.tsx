import React from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { RankBadge } from "@/src/components/RankBadge";
import { FixedPercent } from "@/src/components/FixedPercent";
import { HOME_GOLD } from "@/src/styles";
import { useReducedMotion } from "@/src/utils/accessibility";
import { ui, withAlpha } from "@/src/utils/designSystem";
import { buildPromotionInsight, getRankReward } from "@/src/utils/rankRewards";
import type { DisciplineRank } from "@/src/utils/rank";
import { useTheme, type ThemeColors } from "@/src/utils/themeContext";
import type { RankPromotionRecord } from "@/src/utils/types";

export function RankPromotionCelebration({
  promotion,
  onContinue,
  onViewProgress,
}: {
  promotion: RankPromotionRecord | null;
  onContinue: () => void;
  onViewProgress: () => void;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const reveal = React.useRef(new Animated.Value(0)).current;
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const reward = promotion ? getRankReward(promotion.rank) : null;

  React.useEffect(() => {
    reveal.stopAnimation();
    if (!promotion || reducedMotion) {
      reveal.setValue(promotion ? 1 : 0);
      return;
    }
    reveal.setValue(0);
    Animated.spring(reveal, {
      toValue: 1,
      damping: 16,
      stiffness: 145,
      mass: 0.82,
      useNativeDriver: true,
    }).start();
    return () => reveal.stopAnimation();
  }, [promotion, reducedMotion, reveal]);

  if (!promotion || !reward) return null;

  const badgeScale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.64, 1] });
  const contentTranslate = reveal.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onContinue}>
      <SafeAreaView style={styles.screen}>
        <View pointerEvents="none" style={styles.glow} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: reveal,
                transform: [{ translateY: contentTranslate }],
              },
            ]}
          >
          <Text style={styles.kicker}>PROMOTED</Text>
          <Text style={styles.fromRank}>{promotion.fromRank} → {promotion.rank}</Text>

          <Animated.View style={[styles.badgeStage, { transform: [{ scale: badgeScale }] }]}>
            <View style={styles.badgeHalo} />
            <RankBadge rank={promotion.rank as DisciplineRank} size={92} color={HOME_GOLD} active />
          </Animated.View>

          <Text style={styles.rankName}>{promotion.rank}</Text>
          <Text style={styles.drLine}>{promotion.drAfter} DR</Text>

          <View style={styles.metrics}>
            <View style={styles.metric}>
              <FixedPercent
                value={promotion.dayScore}
                textStyle={styles.metricValue}
                accessibilityLabel={`${promotion.dayScore}% Day Score`}
              />
              <Text style={styles.metricLabel}>Day Score</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>
                {promotion.drGained >= 0 ? "+" : ""}{promotion.drGained}
              </Text>
              <Text style={styles.metricLabel}>DR gained</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{promotion.streak}d</Text>
              <Text style={styles.metricLabel}>Solid streak</Text>
            </View>
          </View>

          <View style={styles.insightCard}>
            <View style={styles.insightIcon}>
              <IconSymbol name="chart.bar.fill" size={17} color={HOME_GOLD} />
            </View>
            <View style={styles.insightCopy}>
              <Text style={styles.insightLabel}>Promotion insight</Text>
              <Text style={styles.insightText}>{buildPromotionInsight(promotion)}</Text>
            </View>
          </View>

          <View style={styles.rewardCard}>
            <View style={styles.rewardTopline}>
              <Text style={styles.rewardLabel}>RANK REWARD UNLOCKED</Text>
              <IconSymbol name="lock.open.fill" size={15} color={HOME_GOLD} />
            </View>
            <Text style={styles.rewardTitle}>{reward.title}</Text>
            <Text style={styles.rewardBody}>{reward.description}</Text>
          </View>

          <Pressable onPress={onViewProgress} accessibilityRole="button" style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>View Progress</Text>
          </Pressable>
          <Pressable onPress={onContinue} accessibilityRole="button" style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Continue</Text>
          </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: withAlpha(colors.bg, 0.97),
      paddingHorizontal: 18,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      paddingVertical: 18,
    },
    glow: {
      position: "absolute",
      alignSelf: "center",
      top: "16%",
      width: 300,
      height: 300,
      borderRadius: 999,
      backgroundColor: withAlpha(HOME_GOLD, 0.075),
    },
    content: {
      alignItems: "center",
    },
    kicker: {
      color: HOME_GOLD,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "900",
      letterSpacing: 3,
    },
    fromRank: {
      color: withAlpha(colors.textSecondary, 0.75),
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "800",
      marginTop: 5,
    },
    badgeStage: {
      width: 154,
      height: 154,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 18,
    },
    badgeHalo: {
      position: "absolute",
      width: 150,
      height: 150,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.34),
      backgroundColor: withAlpha(HOME_GOLD, 0.07),
    },
    rankName: {
      color: colors.textPrimary,
      fontSize: 31,
      lineHeight: 36,
      fontWeight: "900",
      textAlign: "center",
    },
    drLine: {
      color: HOME_GOLD,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "900",
      marginTop: 4,
    },
    metrics: {
      width: "100%",
      minHeight: 68,
      flexDirection: "row",
      alignItems: "stretch",
      marginTop: 17,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.25),
      borderRadius: ui.radius.md,
      backgroundColor: withAlpha(colors.surface2, 0.82),
    },
    metric: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    metricDivider: {
      width: 1,
      marginVertical: 12,
      backgroundColor: withAlpha(colors.border, 0.24),
    },
    metricValue: {
      color: colors.textPrimary,
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "900",
    },
    metricLabel: {
      color: withAlpha(colors.textSecondary, 0.72),
      fontSize: 8,
      lineHeight: 11,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    insightCard: {
      width: "100%",
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 10,
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.25),
      borderRadius: ui.radius.md,
      backgroundColor: withAlpha(HOME_GOLD, 0.055),
      padding: 12,
    },
    insightIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(HOME_GOLD, 0.11),
    },
    insightCopy: { flex: 1, minWidth: 0 },
    insightLabel: {
      color: HOME_GOLD,
      fontSize: 9,
      lineHeight: 13,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    insightText: {
      color: withAlpha(colors.textPrimary, 0.88),
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "600",
      marginTop: 2,
    },
    rewardCard: {
      width: "100%",
      marginTop: 10,
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.42),
      borderRadius: ui.radius.md,
      backgroundColor: withAlpha(colors.surface2, 0.9),
      padding: 12,
    },
    rewardTopline: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    rewardLabel: {
      color: HOME_GOLD,
      fontSize: 9,
      lineHeight: 13,
      fontWeight: "900",
      letterSpacing: 0.8,
    },
    rewardTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: "900",
      marginTop: 5,
    },
    rewardBody: {
      color: withAlpha(colors.textSecondary, 0.84),
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "600",
      marginTop: 3,
    },
    primaryButton: {
      width: "100%",
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      backgroundColor: HOME_GOLD,
      marginTop: 14,
    },
    primaryButtonText: {
      color: "#0B1118",
      fontSize: 12,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    secondaryButton: {
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
      marginTop: 4,
    },
    secondaryButtonText: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 12,
      fontWeight: "800",
    },
  });
}
