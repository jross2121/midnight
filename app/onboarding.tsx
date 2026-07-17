import { PrimaryButton, SecondaryButton } from "@/components/ui/app-buttons";
import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CONTRACT_GOLD, HOME_GOLD } from "./(tabs)/_styles";
import { createCardSurface, ui, withAlpha } from "./(tabs)/_utils/designSystem";
import { useTheme } from "./(tabs)/_utils/themeContext";
import { ONBOARDING_STORAGE_KEY } from "./(tabs)/_utils/types";

type Slide = {
  eyebrow: string;
  title: string;
  text: string;
  supporting: string;
  icon: React.ComponentProps<typeof IconSymbol>["name"];
};

const slides: Slide[] = [
  {
    eyebrow: "The daily loop",
    title: "Win today before midnight",
    text: "Choose a few clear actions. Finish them from Today. After the day ends, Midnight records how consistently you followed through.",
    supporting: "Plan. Complete. Review.",
    icon: "checkmark.circle.fill",
  },
  {
    eyebrow: "Optional pressure",
    title: "Protect what cannot slip",
    text: "Turn a quest into a contract when it truly must happen. Contracts stay visible, build a protection streak, and are always optional.",
    supporting: "Up to three contracts at a time.",
    icon: "shield.fill",
  },
  {
    eyebrow: "Long-term progress",
    title: "Midnight keeps one score",
    text: "Discipline Rating, or DR, measures follow-through over time. Each daily result moves DR once, and your rank follows that score.",
    supporting: "Start with one quest. Learn the rest as you go.",
    icon: "chart.bar.fill",
  },
];

const getSlideTone = (slide: Slide) =>
  slide.icon === "shield.fill" ? CONTRACT_GOLD : HOME_GOLD;

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const slideAnim = useRef(new Animated.Value(1)).current;
  const hasRenderedInitialSlide = useRef(false);

  const isLastSlide = index === slides.length - 1;
  const activeSlide = slides[index];
  const activeTone = getSlideTone(activeSlide);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!hasRenderedInitialSlide.current) {
      hasRenderedInitialSlide.current = true;
      slideAnim.setValue(1);
      return;
    }

    if (reduceMotion) {
      slideAnim.setValue(1);
      return;
    }

    slideAnim.setValue(0);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: ui.motion.standard,
      useNativeDriver: true,
    }).start();
  }, [index, reduceMotion, slideAnim]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safe: {
          flex: 1,
          backgroundColor: colors.bg,
        },
        container: {
          flex: 1,
          paddingHorizontal: ui.spacing.md,
          paddingTop: ui.spacing.md,
          paddingBottom: ui.spacing.md,
          justifyContent: "space-between",
        },
        brandBlock: {
          paddingTop: ui.spacing.xs,
          alignItems: "center",
        },
        brand: {
          color: colors.textPrimary,
          fontSize: 24,
          lineHeight: 29,
          fontWeight: "900",
        },
        brandMeta: {
          color: withAlpha(colors.textSecondary, 0.72),
          fontSize: 10,
          lineHeight: 14,
          fontWeight: "800",
          textTransform: "uppercase",
          marginTop: 3,
        },
        content: {
          flex: 1,
        },
        contentContainer: {
          flexGrow: 1,
          justifyContent: "center",
          paddingVertical: 12,
        },
        progressRow: {
          flexDirection: "row",
          gap: 8,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: ui.spacing.md,
        },
        dot: {
          width: 9,
          height: 9,
          borderRadius: 999,
          backgroundColor: colors.border,
        },
        dotActive: {
          width: 20,
        },
        card: {
          ...createCardSurface(colors, {
            padding: ui.spacing.md,
            radius: ui.radius.xl,
            glowOpacity: 0.05,
          }),
          borderColor: withAlpha(activeTone, 0.28),
          borderWidth: ui.border.widthStrong,
          paddingVertical: ui.spacing.lg,
          paddingHorizontal: ui.spacing.md,
          minHeight: 320,
          justifyContent: "center",
        },
        iconPlate: {
          width: 52,
          height: 52,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: withAlpha(activeTone, 0.34),
          backgroundColor: withAlpha(activeTone, 0.1),
          alignItems: "center",
          justifyContent: "center",
          marginBottom: ui.spacing.md,
        },
        eyebrow: {
          color: activeTone,
          fontSize: 10,
          lineHeight: 14,
          fontWeight: "900",
          textTransform: "uppercase",
          marginBottom: 6,
        },
        title: {
          ...ui.typography.title,
          fontSize: 32,
          lineHeight: 37,
          textAlign: "left",
          marginBottom: ui.spacing.sm,
        },
        text: {
          color: withAlpha(colors.textPrimary, 0.9),
          fontSize: ui.typography.body.fontSize,
          lineHeight: 22,
          textAlign: "left",
        },
        supporting: {
          minHeight: 44,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: withAlpha(activeTone, 0.24),
          backgroundColor: withAlpha(activeTone, 0.07),
          color: colors.textPrimary,
          fontSize: 12,
          lineHeight: 17,
          fontWeight: "800",
          paddingHorizontal: 12,
          paddingVertical: 12,
          marginTop: ui.spacing.md,
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
          width: "72%",
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
          letterSpacing: 0,
          textAlign: "center",
        },
        ctaText: {
          fontSize: 12,
          letterSpacing: 0,
        },
      }),
    [activeTone, colors]
  );

  const handleNext = async () => {
    if (!isLastSlide) {
      setIndex((prev) => prev + 1);
      return;
    }

    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    } catch (error) {
      if (__DEV__) console.warn("Failed to persist onboarding status:", error);
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
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>MIDNIGHT</Text>
          <Text style={styles.brandMeta}>Daily discipline</Text>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={styles.progressRow}
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Step ${index + 1} of ${slides.length}`}
          >
            {slides.map((_, dotIndex) => (
              <View
                key={dotIndex}
                style={[
                  styles.dot,
                  dotIndex === index && styles.dotActive,
                  dotIndex === index && { backgroundColor: activeTone },
                ]}
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
            <View style={styles.iconPlate}>
              <IconSymbol name={activeSlide.icon} size={25} color={activeTone} />
            </View>
            <Text style={styles.eyebrow}>{activeSlide.eyebrow}</Text>
            <Text style={[styles.title, { color: activeTone }]}>{activeSlide.title}</Text>
            <Text style={styles.text}>{activeSlide.text}</Text>
            <Text style={styles.supporting}>{activeSlide.supporting}</Text>
          </Animated.View>
        </ScrollView>

        {index === 0 ? (
          <View style={[styles.footer, styles.footerSingle]}>
            <PrimaryButton style={[styles.navButton, styles.navButtonSingle]} label="Show me how" onPress={handleNext} />
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
                label={isLastSlide ? "Build today's board" : "Next"}
                onPress={handleNext}
              />
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
