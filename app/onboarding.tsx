import { PrimaryButton, SecondaryButton } from "@/components/ui/app-buttons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createCardSurface, ui, withAlpha } from "./(tabs)/_utils/designSystem";
import { useTheme } from "./(tabs)/_utils/themeContext";
import { ONBOARDING_STORAGE_KEY } from "./(tabs)/_utils/types";

type Slide = {
  title: string;
  text?: string;
};

const slides: Slide[] = [
  {
    title: "Build Real Discipline",
    text: "Discipline isn’t motivation.\nIt’s what you do when you don’t feel like it.",
  },
  {
    title: "Discipline Has Consequences",
    text: "Show up → It rises.\nSkip → It drops.\nNo gimmicks. Just results.",
  },
  {
    title: "Every Day Is A Test",
    text: "At midnight, your discipline is judged.\nYou either built it… or you didn’t.",
  },
  {
    title: "Ready To Begin?",
    text: "Discipline starts at 0.\nWhat it becomes is up to you.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const slideAnim = useRef(new Animated.Value(1)).current;

  const isLastSlide = index === slides.length - 1;
  const activeSlide = slides[index];

  useEffect(() => {
    slideAnim.setValue(0);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: ui.motion.standard,
      useNativeDriver: true,
    }).start();
  }, [index, slideAnim]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: colors.bg,
        },
        container: {
          flex: 1,
          paddingHorizontal: ui.spacing.lg,
          paddingTop: ui.spacing.sm,
          paddingBottom: ui.spacing.lg,
          justifyContent: "center",
        },
        progressRow: {
          flexDirection: "row",
          gap: 8,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: ui.spacing.lg,
        },
        dot: {
          width: 9,
          height: 9,
          borderRadius: 999,
          backgroundColor: colors.border,
        },
        dotActive: {
          backgroundColor: colors.accentPrimary,
          width: 20,
        },
        card: {
          ...createCardSurface(colors, {
            padding: ui.spacing.lg,
            radius: ui.radius.xl,
            glowOpacity: 0.12,
          }),
          borderColor: withAlpha(colors.border, ui.border.opacityCard),
          borderWidth: ui.border.widthStrong,
          paddingVertical: 30,
          paddingHorizontal: ui.spacing.lg,
          minHeight: 232,
          justifyContent: "center",
          marginBottom: 28,
        },
        title: {
          ...ui.typography.title,
          fontSize: 34,
          lineHeight: 38,
          color: colors.accentPrimary,
          textAlign: "center",
          marginBottom: ui.spacing.md,
        },
        text: {
          color: withAlpha(colors.textPrimary, 0.9),
          fontSize: ui.typography.body.fontSize,
          lineHeight: 24,
          textAlign: "center",
        },
        footer: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        footerSingle: {
          alignItems: "center",
          justifyContent: "center",
        },
        navButton: {
          minHeight: 52,
          borderRadius: ui.radius.button,
          alignItems: "center",
          justifyContent: "center",
        },
        navButtonSingle: {
          flex: 0,
          width: "62%",
          maxWidth: 240,
          minWidth: 160,
        },
        footerSlot: {
          flex: 1,
        },
        navButtonFill: {
          width: "100%",
        },
        buttonSpacer: {
          width: 12,
        },
        buttonText: {
          color: colors.textPrimary,
          fontSize: ui.typography.body.fontSize,
          fontWeight: "800",
          letterSpacing: 0.2,
          textAlign: "center",
        },
        ctaText: {
          fontSize: 12,
          letterSpacing: 0,
        },
      }),
    [colors]
  );

  const handleNext = async () => {
    if (!isLastSlide) {
      setIndex((prev) => prev + 1);
      return;
    }

    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    } catch (error) {
      console.log("Failed to persist onboarding status:", error);
    } finally {
      router.replace("/(tabs)");
    }
  };

  const handleBack = () => {
    if (index > 0) {
      setIndex((prev) => prev - 1);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.progressRow}>
          {slides.map((_, dotIndex) => (
            <View
              key={dotIndex}
              style={[styles.dot, dotIndex === index ? styles.dotActive : null]}
            />
          ))}
        </View>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: slideAnim,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.title}>{activeSlide.title}</Text>
          {activeSlide.text ? <Text style={styles.text}>{activeSlide.text}</Text> : null}
        </Animated.View>

        {index === 0 ? (
          <View style={[styles.footer, styles.footerSingle]}>
            <PrimaryButton style={[styles.navButton, styles.navButtonSingle]} label="Next" onPress={handleNext} />
          </View>
        ) : (
          <View style={styles.footer}>
            <View style={styles.footerSlot}>
              <SecondaryButton style={[styles.navButton, styles.navButtonFill]} label="Back" onPress={handleBack} />
            </View>

            <View style={styles.buttonSpacer} />

            <View style={styles.footerSlot}>
              <PrimaryButton
                style={[styles.navButton, styles.navButtonFill]}
                label={isLastSlide ? "Start My First Day" : "Next"}
                onPress={handleNext}
              />
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
