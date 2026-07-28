import React from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HOME_GOLD } from "@/src/styles";
import { useTheme } from "@/src/utils/themeContext";
import { withAlpha } from "@/src/utils/designSystem";

export const TODAY_TOUR_STORAGE_KEY = "midnight:today-tour:v1";
export const TODAY_TOUR_ELIGIBLE_KEY = "midnight:today-tour-eligible:v1";
export const PLAN_TOUR_STORAGE_KEY = "midnight:plan-tour:v1";
export const PLAN_TOUR_ELIGIBLE_KEY = "midnight:plan-tour-eligible:v1";

type TargetRef = React.RefObject<View | null>;

export type SpotlightStep = {
  title: string;
  body: string;
  targetRef: TargetRef;
};

type TargetRect = { x: number; y: number; width: number; height: number };

export function GuidedSpotlightTour({
  visible,
  steps,
  onFinish,
  onStepChange,
}: {
  visible: boolean;
  steps: SpotlightStep[];
  onFinish: () => void;
  onStepChange?: (stepIndex: number) => void;
}) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [target, setTarget] = React.useState<TargetRect | null>(null);
  const [cardHeight, setCardHeight] = React.useState(220);
  const step = steps[stepIndex];

  React.useEffect(() => {
    if (!visible) {
      setStepIndex(0);
      setTarget(null);
      return;
    }

    const timer = setTimeout(() => {
      step?.targetRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
        const padding = 3;
        const safeWidth = Math.min(measuredWidth + padding * 2, width - 16);
        const safeX = Math.min(
          Math.max(8, x - (safeWidth - measuredWidth) / 2),
          width - safeWidth - 8
        );
        const safeHeight = Math.min(measuredHeight + padding * 2, height - 16);
        const safeY = Math.min(
          Math.max(8, y - (safeHeight - measuredHeight) / 2),
          height - safeHeight - 8
        );
        setTarget({
          x: safeX,
          y: safeY,
          width: safeWidth,
          height: safeHeight,
        });
      });
    }, 80);
    return () => clearTimeout(timer);
  }, [height, step, visible, width]);

  React.useEffect(() => {
    if (visible) onStepChange?.(stepIndex);
  }, [onStepChange, stepIndex, visible]);

  if (!step) return null;

  const targetBottom = target ? target.y + target.height : height * 0.42;
  const showCardAbove = targetBottom > height * 0.61;
  const desiredCardTop = showCardAbove
    ? (target?.y ?? height * 0.58) - cardHeight - 20
    : targetBottom + 20;
  const minimumCardTop = insets.top + 10;
  const maximumCardTop = Math.max(minimumCardTop, height - insets.bottom - cardHeight - 10);
  const cardTop = Math.min(Math.max(desiredCardTop, minimumCardTop), maximumCardTop);
  const shade = "rgba(0, 4, 10, 0.82)";

  const finish = () => {
    setStepIndex(0);
    onFinish();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={finish}>
      <View style={styles.root}>
        {target ? (
          <>
            <View style={[styles.shade, { backgroundColor: shade, left: 0, right: 0, top: 0, height: target.y }]} />
            <View style={[styles.shade, { backgroundColor: shade, left: 0, top: target.y, width: target.x, height: target.height }]} />
            <View style={[styles.shade, { backgroundColor: shade, left: target.x + target.width, right: 0, top: target.y, height: target.height }]} />
            <View style={[styles.shade, { backgroundColor: shade, left: 0, right: 0, top: targetBottom, bottom: 0 }]} />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: shade }]} />
        )}

        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          <View
            onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}
            style={[
              styles.card,
              { top: cardTop, backgroundColor: colors.surface2, borderColor: withAlpha(HOME_GOLD, 0.5) },
            ]}
          >
            <Text style={[styles.arrow, showCardAbove ? styles.arrowBelow : styles.arrowAbove]}>
              {showCardAbove ? "↓" : "↑"}
            </Text>
            <Text style={styles.stepLabel}>STEP {stepIndex + 1} OF {steps.length}</Text>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{step.title}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{step.body}</Text>
            <View style={styles.actions}>
              <Pressable onPress={finish} accessibilityRole="button" style={styles.skipButton}>
                <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip tour</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (stepIndex === steps.length - 1) finish();
                  else setStepIndex((current) => current + 1);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.nextButton, pressed && { opacity: 0.78 }]}
              >
                <Text style={styles.nextText}>{stepIndex === steps.length - 1 ? "Got it" : "Next"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  shade: { position: "absolute" },
  card: {
    position: "absolute",
    left: 16,
    right: 16,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.36,
    shadowRadius: 18,
    elevation: 20,
  },
  arrow: {
    position: "absolute",
    alignSelf: "center",
    color: HOME_GOLD,
    fontSize: 28,
    fontWeight: "900",
  },
  arrowAbove: { top: -31 },
  arrowBelow: { bottom: -31 },
  stepLabel: {
    color: HOME_GOLD,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 1.3,
  },
  title: { marginTop: 5, fontSize: 20, lineHeight: 25, fontWeight: "900" },
  body: { marginTop: 7, fontSize: 13, lineHeight: 19, fontWeight: "600" },
  actions: { marginTop: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  skipButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: 4 },
  skipText: { fontSize: 12, fontWeight: "800" },
  nextButton: {
    minHeight: 42,
    minWidth: 92,
    paddingHorizontal: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: HOME_GOLD,
  },
  nextText: { color: "#09111A", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
});
