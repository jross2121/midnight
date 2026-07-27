import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { HOME_GOLD } from "@/src/styles";
import { ui, withAlpha } from "@/src/utils/designSystem";
import { useTheme, type ThemeColors } from "@/src/utils/themeContext";

type AppInfoDialogProps = {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
};

export type AppDialogAction = {
  label: string;
  onPress: () => void;
  emphasis?: "primary" | "neutral" | "danger";
};

type AppActionDialogProps = {
  visible: boolean;
  title: string;
  body: string;
  actions: AppDialogAction[];
  onClose: () => void;
};

export function AppInfoDialog({ visible, title, body, onClose }: AppInfoDialogProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close information" />
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.iconPlate}>
            <IconSymbol name="sparkles" size={22} color={HOME_GOLD} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Got it"
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Got it</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export function AppActionDialog({
  visible,
  title,
  body,
  actions,
  onClose,
}: AppActionDialogProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close dialog" />
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.iconPlate}>
            <IconSymbol name="shield.fill" size={22} color={HOME_GOLD} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actionStack}>
            {actions.map((action) => {
              const emphasis = action.emphasis ?? "neutral";
              return (
                <Pressable
                  key={action.label}
                  onPress={() => {
                    onClose();
                    action.onPress();
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.actionButton,
                    emphasis === "primary" && styles.actionButtonPrimary,
                    emphasis === "danger" && {
                      borderColor: withAlpha(colors.negative, 0.48),
                      backgroundColor: withAlpha(colors.negative, 0.09),
                    },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.actionButtonText,
                      emphasis === "primary" && styles.actionButtonTextPrimary,
                      emphasis === "danger" && { color: colors.negative },
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
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
      backgroundColor: "rgba(0, 4, 9, 0.78)",
    },
    dialog: {
      width: "100%",
      maxWidth: 420,
      borderRadius: ui.radius.xl,
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.38),
      backgroundColor: colors.surface,
      padding: ui.spacing.lg,
      shadowColor: HOME_GOLD,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
      elevation: 12,
    },
    iconPlate: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.32),
      backgroundColor: withAlpha(HOME_GOLD, 0.09),
      marginBottom: ui.spacing.md,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      lineHeight: 27,
      fontWeight: "900",
    },
    body: {
      color: withAlpha(colors.textPrimary, 0.82),
      fontSize: 14,
      lineHeight: 21,
      fontWeight: "600",
      marginTop: 8,
    },
    button: {
      minHeight: 48,
      borderRadius: ui.radius.button,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: HOME_GOLD,
      marginTop: ui.spacing.lg,
    },
    buttonPressed: { opacity: 0.82, transform: [{ scale: 0.992 }] },
    buttonText: {
      color: "#101722",
      fontSize: 14,
      fontWeight: "900",
    },
    actionStack: {
      gap: 9,
      marginTop: ui.spacing.lg,
    },
    actionButton: {
      minHeight: 48,
      borderRadius: ui.radius.button,
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.28),
      backgroundColor: withAlpha(HOME_GOLD, 0.06),
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: ui.spacing.md,
    },
    actionButtonPrimary: {
      borderColor: HOME_GOLD,
      backgroundColor: HOME_GOLD,
    },
    actionButtonText: {
      color: HOME_GOLD,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "900",
    },
    actionButtonTextPrimary: {
      color: "#101722",
    },
  });
}
