import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { ui, withAlpha } from "../_utils/designSystem";
import type { ThemeColors } from "../_utils/themeContext";

type DayScoreRingProps = {
  completionPercent: number;
  completedCount: number;
  totalCount: number;
  colors: ThemeColors;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function DayScoreRing({
  completionPercent,
  completedCount,
  totalCount,
  colors,
}: DayScoreRingProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const [animatedPercent, setAnimatedPercent] = useState(0);

  const size = 172;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const listenerId = progressAnim.addListener(({ value }) => {
      setAnimatedPercent(value);
    });
    return () => {
      progressAnim.removeListener(listenerId);
    };
  }, [progressAnim]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: clampPercent(completionPercent),
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [completionPercent, progressAnim]);

  const percentRounded = Math.round(clampPercent(animatedPercent));
  const strokeDashoffset = circumference * (1 - clampPercent(animatedPercent) / 100);

  return (
    <View style={styles.wrap}>
      <View style={styles.ringFrame}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={withAlpha(colors.textPrimary, 0.14)}
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={withAlpha(colors.accentPrimary, 0.98)}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              fill="transparent"
            />
          </G>
        </Svg>

        <View style={styles.centerContent}>
          <Text style={styles.label}>Day Score</Text>
          <Text style={styles.percent}>{percentRounded}%</Text>
          <Text style={styles.subtitle}>Today's discipline performance</Text>
        </View>
      </View>

      <Text style={styles.meta}>
        {completedCount} / {totalCount} quests completed
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      alignItems: "center",
      gap: ui.spacing.xs,
    },
    ringFrame: {
      width: 172,
      height: 172,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: colors.accentPrimary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.14,
      shadowRadius: 10,
      elevation: 3,
    },
    centerContent: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
      width: 116,
    },
    label: {
      ...ui.typography.caption,
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.55,
      textTransform: "uppercase",
    },
    percent: {
      ...ui.typography.drHero,
      color: colors.textPrimary,
      fontSize: 36,
      lineHeight: 40,
      fontWeight: "900",
      letterSpacing: -0.4,
    },
    subtitle: {
      ...ui.typography.caption,
      color: withAlpha(colors.textSecondary, 0.72),
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "600",
      letterSpacing: 0.15,
      textAlign: "center",
      marginTop: 1,
    },
    meta: {
      ...ui.typography.caption,
      color: withAlpha(colors.textSecondary, 0.86),
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.15,
      marginTop: 2,
    },
  });
}
