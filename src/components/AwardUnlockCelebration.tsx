import React from "react";
import { Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { HOME_GOLD } from "@/src/styles";
import { useReducedMotion } from "@/src/utils/accessibility";
import { ui, withAlpha } from "@/src/utils/designSystem";
import { useTheme, type ThemeColors } from "@/src/utils/themeContext";

type AwardUnlockCelebrationProps = {
  visible: boolean;
  awardName: string;
  onViewAward: () => void;
  onClose: () => void;
};

export function AwardUnlockCelebration({
  visible,
  awardName,
  onViewAward,
  onClose,
}: AwardUnlockCelebrationProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const styles = createStyles(colors);
  const reveal = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!visible) {
      reveal.setValue(0);
      return;
    }
    if (reducedMotion) {
      reveal.setValue(1);
      return;
    }
    Animated.spring(reveal, {
      toValue: 1,
      damping: 12,
      stiffness: 150,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [reducedMotion, reveal, visible]);

  const scale = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });
  const translateY = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [28, 0],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.root}>
        <View style={styles.backdrop} />
        <Animated.View
          style={[
            styles.card,
            {
              opacity: reveal,
              transform: [{ scale }, { translateY }],
            },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.glow} />
          <View style={styles.trophyPlate}>
            <IconSymbol name="trophy.fill" size={42} color={HOME_GOLD} />
          </View>
          <Text style={styles.eyebrow}>Milestone unlocked</Text>
          <Text accessibilityRole="header" style={styles.title}>{awardName}</Text>
          <Text style={styles.body}>Your consistency earned a permanent place in the collection.</Text>

          <Pressable
            onPress={onViewAward}
            accessibilityRole="button"
            accessibilityLabel={`View ${awardName} in Awards`}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>View Award</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryButtonText}>Keep going</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: ui.spacing.lg,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 4, 9, 0.86)",
    },
    card: {
      width: "100%",
      maxWidth: 420,
      alignItems: "center",
      overflow: "hidden",
      borderRadius: ui.radius.xl,
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.46),
      backgroundColor: colors.surface,
      padding: ui.spacing.lg,
      shadowColor: HOME_GOLD,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.22,
      shadowRadius: 28,
      elevation: 14,
    },
    glow: {
      position: "absolute",
      top: -90,
      width: 260,
      height: 190,
      borderRadius: 999,
      backgroundColor: withAlpha(HOME_GOLD, 0.09),
    },
    trophyPlate: {
      width: 86,
      height: 86,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.48),
      backgroundColor: withAlpha(HOME_GOLD, 0.11),
    },
    eyebrow: {
      color: HOME_GOLD,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "900",
      letterSpacing: 1.6,
      textTransform: "uppercase",
      marginTop: ui.spacing.md,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 27,
      lineHeight: 32,
      fontWeight: "900",
      textAlign: "center",
      marginTop: 4,
    },
    body: {
      color: withAlpha(colors.textSecondary, 0.86),
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "700",
      textAlign: "center",
      marginTop: 8,
      marginBottom: ui.spacing.lg,
    },
    primaryButton: {
      width: "100%",
      minHeight: 50,
      borderRadius: ui.radius.button,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: HOME_GOLD,
    },
    primaryButtonText: {
      color: "#101722",
      fontSize: 14,
      fontWeight: "900",
    },
    secondaryButton: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: ui.spacing.lg,
      marginTop: 5,
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "900",
    },
    pressed: {
      opacity: 0.78,
      transform: [{ scale: 0.992 }],
    },
  });
}
