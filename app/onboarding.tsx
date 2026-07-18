import { PrimaryButton, SecondaryButton } from "@/components/ui/app-buttons";
import { IconSymbol } from "@/components/ui/icon-symbol";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HOME_GOLD } from "@/src/styles";
import { getCategoryDisplayNameById } from "@/src/utils/categoryLabels";
import { questTemplates } from "@/src/utils/defaultData";
import { createCardSurface, ui, withAlpha } from "@/src/utils/designSystem";
import {
  buildOnboardingStarterQuests,
  DEFAULT_ONBOARDING_STARTER_IDS,
  MAX_ONBOARDING_STARTERS,
  MIN_ONBOARDING_STARTERS,
  ONBOARDING_STARTER_IDS,
} from "@/src/utils/onboarding";
import { updateStoredState } from "@/src/utils/storedState";
import { useTheme } from "@/src/utils/themeContext";
import { ONBOARDING_STORAGE_KEY } from "@/src/utils/types";

const TERM_ROWS = [
  {
    icon: "checkmark.circle.fill" as const,
    title: "XP improves an area",
    body: "Every completed quest adds XP to Health, Career, Home, or another life area.",
  },
  {
    icon: "chart.bar.fill" as const,
    title: "DR tracks follow-through",
    body: "Discipline Rating changes once after midnight from the share of your board you completed.",
  },
  {
    icon: "shield.fill" as const,
    title: "Contracts are optional",
    body: "Protect a true must-do later. Missing it breaks the separate contract streak, but it is still scored like a normal quest.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ replay?: string }>();
  const isReplay = params.replay === "1";
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [step, setStep] = useState(0);
  const [selectedStarterIds, setSelectedStarterIds] = useState<string[]>(
    DEFAULT_ONBOARDING_STARTER_IDS
  );
  const [saving, setSaving] = useState(false);

  const starterOptions = useMemo(
    () =>
      ONBOARDING_STARTER_IDS.flatMap((id) => {
        const template = questTemplates.find((item) => item.id === id);
        return template ? [template] : [];
      }),
    []
  );
  const isStarterSelectionValid =
    selectedStarterIds.length >= MIN_ONBOARDING_STARTERS &&
    selectedStarterIds.length <= MAX_ONBOARDING_STARTERS;

  const toggleStarter = (starterId: string) => {
    if (!selectedStarterIds.includes(starterId) && selectedStarterIds.length >= MAX_ONBOARDING_STARTERS) {
      Alert.alert("Three starters selected", "Remove one starter before choosing another.");
      return;
    }
    setSelectedStarterIds((current) => {
      if (current.includes(starterId)) {
        return current.filter((id) => id !== starterId);
      }
      return [...current, starterId];
    });
  };

  const finishOnboarding = async () => {
    if (saving || (!isReplay && !isStarterSelectionValid)) return;
    setSaving(true);

    try {
      if (!isReplay) {
        const starterQuests = buildOnboardingStarterQuests(selectedStarterIds);
        await updateStoredState((current) =>
          current.quests.length > 0 ? current : { ...current, quests: starterQuests }
        );
      }
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
      if (isReplay && router.canGoBack()) router.back();
      else router.replace("/(tabs)");
    } catch (error) {
      if (__DEV__) console.warn("Failed to finish onboarding:", error);
      Alert.alert(
        "Could not save your setup",
        "Your choices are still here. Check available device storage, then try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>MIDNIGHT</Text>
          <Text style={styles.brandMeta}>{isReplay ? "Quick refresher" : "Your first day"}</Text>
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
            accessibilityLabel={`Step ${step + 1} of 2`}
          >
            {[0, 1].map((dot) => (
              <View key={dot} style={[styles.dot, dot === step && styles.dotActive]} />
            ))}
          </View>

          {step === 0 ? (
            <View style={styles.heroCard}>
              <View style={styles.iconPlate}>
                <IconSymbol name="checkmark.circle.fill" size={27} color={HOME_GOLD} />
              </View>
              <Text style={styles.eyebrow}>The whole loop</Text>
              <Text style={styles.title}>Choose a few things. Finish what matters.</Text>
              <Text style={styles.body}>
                Your board resets after midnight. Until then, tap a quest when it is done. Midnight records the day and helps you plan the next one.
              </Text>

              <View style={styles.loopRow}>
                {["Choose", "Complete", "Review"].map((label, index) => (
                  <React.Fragment key={label}>
                    {index > 0 ? <Text style={styles.loopArrow}>›</Text> : null}
                    <View style={styles.loopStep}>
                      <Text style={styles.loopNumber}>{index + 1}</Text>
                      <Text style={styles.loopLabel}>{label}</Text>
                    </View>
                  </React.Fragment>
                ))}
              </View>

              <Text style={styles.reassurance}>You do not need to learn ranks, XP, or contracts yet.</Text>
            </View>
          ) : isReplay ? (
            <View style={styles.heroCard}>
              <Text style={styles.eyebrow}>The game layer</Text>
              <Text style={styles.title}>Three terms, in plain language</Text>
              <Text style={styles.body}>These measure the work. They never replace the work.</Text>
              <View style={styles.termList}>
                {TERM_ROWS.map((item) => (
                  <View key={item.title} style={styles.termRow}>
                    <View style={styles.termIcon}>
                      <IconSymbol name={item.icon} size={19} color={HOME_GOLD} />
                    </View>
                    <View style={styles.termCopy}>
                      <Text style={styles.termTitle}>{item.title}</Text>
                      <Text style={styles.termBody}>{item.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <Text style={styles.reassurance}>Your existing board and progress will not be changed.</Text>
            </View>
          ) : (
            <View style={styles.heroCard}>
              <Text style={styles.eyebrow}>Build your first board</Text>
              <Text style={styles.title}>Pick two or three small wins</Text>
              <Text style={styles.body}>They are one-time starters. You can edit or archive them later.</Text>

              <View style={styles.selectionMetaRow}>
                <Text style={styles.selectionMeta}>Choose {MIN_ONBOARDING_STARTERS}–{MAX_ONBOARDING_STARTERS}</Text>
                <Text style={styles.selectionCount}>{selectedStarterIds.length}/{MAX_ONBOARDING_STARTERS}</Text>
              </View>
              <View style={styles.starterList}>
                {starterOptions.map((starter) => {
                  const selected = selectedStarterIds.includes(starter.id);
                  return (
                    <Pressable
                      key={starter.id}
                      onPress={() => toggleStarter(starter.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`${selected ? "Remove" : "Add"} starter quest ${starter.title}`}
                      style={({ pressed }) => [
                        styles.starterRow,
                        selected && styles.starterRowSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={[styles.checkPlate, selected && styles.checkPlateSelected]}>
                        {selected ? <IconSymbol name="checkmark" size={16} color={colors.bg} /> : null}
                      </View>
                      <View style={styles.starterCopy}>
                        <Text style={styles.starterTitle}>{starter.title}</Text>
                        <Text style={styles.starterMeta}>
                          {getCategoryDisplayNameById(starter.categoryId)} · {starter.difficulty} · {starter.xp} XP
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 ? (
            <SecondaryButton style={styles.footerButton} label="Back" onPress={() => setStep(0)} />
          ) : null}
          <PrimaryButton
            style={styles.footerButton}
            label={
              step === 0
                ? isReplay ? "Review the basics" : "Set up my day"
                : saving
                  ? "Saving…"
                  : isReplay
                    ? "Return to Midnight"
                    : "Start my first day"
            }
            disabled={saving || (step === 1 && !isReplay && !isStarterSelectionValid)}
            onPress={() => (step === 0 ? setStep(1) : finishOnboarding())}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    container: {
      flex: 1,
      paddingHorizontal: ui.spacing.md,
      paddingTop: ui.spacing.md,
      paddingBottom: ui.spacing.md,
    },
    brandBlock: { alignItems: "center", paddingTop: ui.spacing.xs },
    brand: { color: colors.textPrimary, fontSize: 24, lineHeight: 29, fontWeight: "900" },
    brandMeta: {
      color: withAlpha(colors.textSecondary, 0.72),
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "800",
      textTransform: "uppercase",
      marginTop: 3,
    },
    content: { flex: 1 },
    contentContainer: { flexGrow: 1, justifyContent: "center", paddingVertical: 12 },
    progressRow: {
      flexDirection: "row",
      gap: 8,
      justifyContent: "center",
      marginBottom: ui.spacing.sm,
    },
    dot: { width: 9, height: 9, borderRadius: 999, backgroundColor: colors.border },
    dotActive: { width: 22, backgroundColor: HOME_GOLD },
    heroCard: {
      ...createCardSurface(colors, { padding: ui.spacing.md, radius: ui.radius.xl, glowOpacity: 0.05 }),
      borderColor: withAlpha(HOME_GOLD, 0.3),
      paddingVertical: ui.spacing.lg,
    },
    iconPlate: {
      width: 54,
      height: 54,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.36),
      backgroundColor: withAlpha(HOME_GOLD, 0.1),
      alignItems: "center",
      justifyContent: "center",
      marginBottom: ui.spacing.md,
    },
    eyebrow: {
      color: HOME_GOLD,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "900",
      textTransform: "uppercase",
      marginBottom: 6,
    },
    title: { color: colors.textPrimary, fontSize: 29, lineHeight: 34, fontWeight: "900" },
    body: { color: withAlpha(colors.textPrimary, 0.88), fontSize: 14, lineHeight: 21, marginTop: 10 },
    loopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: ui.spacing.lg,
    },
    loopStep: { flex: 1, alignItems: "center", gap: 6 },
    loopNumber: {
      width: 32,
      height: 32,
      borderRadius: 999,
      textAlign: "center",
      textAlignVertical: "center",
      color: colors.bg,
      backgroundColor: HOME_GOLD,
      fontWeight: "900",
    },
    loopLabel: { color: colors.textPrimary, fontSize: 11, fontWeight: "800" },
    loopArrow: { color: withAlpha(HOME_GOLD, 0.7), fontSize: 22 },
    reassurance: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      marginTop: ui.spacing.lg,
      padding: 12,
      borderRadius: 9,
      backgroundColor: withAlpha(HOME_GOLD, 0.07),
    },
    selectionMetaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: ui.spacing.md,
    },
    selectionMeta: { color: colors.textSecondary, fontSize: 11, fontWeight: "800" },
    selectionCount: { color: HOME_GOLD, fontSize: 12, fontWeight: "900" },
    starterList: { gap: 7, marginTop: 9 },
    starterRow: {
      minHeight: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.34),
      borderRadius: 10,
      backgroundColor: withAlpha(colors.surface2, 0.55),
      paddingHorizontal: 11,
      paddingVertical: 8,
    },
    starterRowSelected: {
      borderColor: withAlpha(HOME_GOLD, 0.55),
      backgroundColor: withAlpha(HOME_GOLD, 0.09),
    },
    checkPlate: {
      width: 28,
      height: 28,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.55),
      alignItems: "center",
      justifyContent: "center",
    },
    checkPlateSelected: { backgroundColor: HOME_GOLD, borderColor: HOME_GOLD },
    starterCopy: { flex: 1, minWidth: 0 },
    starterTitle: { color: colors.textPrimary, fontSize: 13, lineHeight: 17, fontWeight: "900" },
    starterMeta: {
      color: colors.textSecondary,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "700",
      textTransform: "capitalize",
      marginTop: 2,
    },
    termList: { gap: 9, marginTop: ui.spacing.md },
    termRow: {
      flexDirection: "row",
      gap: 11,
      padding: 11,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.3),
      backgroundColor: withAlpha(colors.surface2, 0.5),
    },
    termIcon: {
      width: 36,
      height: 36,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(HOME_GOLD, 0.1),
    },
    termCopy: { flex: 1 },
    termTitle: { color: colors.textPrimary, fontSize: 13, lineHeight: 17, fontWeight: "900" },
    termBody: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 2 },
    pressed: { opacity: 0.76 },
    footer: { flexDirection: "row", gap: 10, paddingTop: 8 },
    footerButton: { flex: 1 },
  });
}
