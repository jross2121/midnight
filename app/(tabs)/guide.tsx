import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "./_components/ScreenHeader";
import { CONTRACT_GOLD, HOME_GOLD } from "./_styles";
import { createTileSurface, ui, withAlpha } from "./_utils/designSystem";
import { useTheme, type ThemeColors } from "./_utils/themeContext";

type GuideSection = {
  title: string;
  label: string;
  body: string;
  icon: React.ComponentProps<typeof IconSymbol>["name"];
  summary: string;
};

type GlossaryItem = {
  term: string;
  definition: string;
};

type FirstDayStep = {
  title: string;
  body: string;
};

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: "Daily Run",
    label: "Home",
    body: "Home is today's board. Finish quests before midnight; Midnight evaluates the day after it ends.",
    icon: "house.fill",
    summary: "Finish before midnight. Pins and contracts first.",
  },
  {
    title: "Contracts",
    label: "Pressure",
    body: "Contracts are the quests you choose to protect. Use them for work that would actually matter if the day went badly.",
    icon: "shield.fill",
    summary: "Three active max. Misses affect evaluation.",
  },
  {
    title: "Plan",
    label: "Shape",
    body: "Plan decides what belongs on the board. It shows today, week load, and quests waiting outside today.",
    icon: "calendar",
    summary: "Quick Add, week load, and resting quests.",
  },
  {
    title: "Progress",
    label: "Climb",
    body: "DR is Discipline Rating, the long-term score. Rank, insights, awards, and the player card come from evaluated days.",
    icon: "trophy.fill",
    summary: "Rank follows DR. Equip badges from Awards.",
  },
];

const FIRST_DAY_STEPS: FirstDayStep[] = [
  {
    title: "1. Pick today's quests",
    body: "Keep the board small: one easy win, one useful task, and one contract if it truly matters.",
  },
  {
    title: "2. Finish before midnight",
    body: "Tap Complete as you finish. Contracts and pinned quests should happen before optional work.",
  },
  {
    title: "3. Review the judgment",
    body: "After midnight, Midnight turns the day into DR movement, rank progress, streaks, and awards.",
  },
];

const GLOSSARY: GlossaryItem[] = [
  { term: "DR", definition: "Discipline Rating. The long-term score that moves after each Midnight Evaluation and determines rank." },
  { term: "Daily Standard", definition: "The completion target for a stable day. You do not need a huge board to improve." },
  { term: "Resting", definition: "A paused quest. It stays in Plan but does not count on today's board." },
  { term: "Evaluation", definition: "The midnight review that scores yesterday's scheduled quests and records DR movement." },
];

export default function GuideScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createGuideStyles(colors), [colors]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="How Midnight Works"
          subtitle="Rules, terms, and flow"
          icon="chevron.left"
          onIconPress={() => router.push("/(tabs)/more")}
          iconAccessibilityLabel="Back to More"
        />

        <View style={styles.introCard}>
          <Text style={styles.introLabel}>Core loop</Text>
          <Text style={styles.introTitle}>Choose the day. Protect what matters. Review at midnight.</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>First Day</Text>
          <View style={styles.firstDayList}>
            {FIRST_DAY_STEPS.map((step) => (
              <View key={step.title} style={styles.firstDayRow}>
                <Text style={styles.firstDayTitle}>{step.title}</Text>
                <Text style={styles.firstDayBody}>{step.body}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Main Rules</Text>
          <View style={styles.ruleList}>
            {GUIDE_SECTIONS.map((section) => {
              const isContractSection = section.title === "Contracts";
              const tone = isContractSection ? CONTRACT_GOLD : HOME_GOLD;
              return (
                <View key={section.title} style={styles.ruleRow}>
                  <View
                    style={[
                      styles.ruleIcon,
                      isContractSection && {
                        borderColor: withAlpha(CONTRACT_GOLD, 0.3),
                        backgroundColor: withAlpha(CONTRACT_GOLD, 0.09),
                      },
                    ]}
                  >
                    <IconSymbol name={section.icon} size={17} color={tone} />
                  </View>
                  <View style={styles.ruleCopy}>
                    <View style={styles.ruleTitleRow}>
                      <Text style={styles.ruleTitle}>{section.title}</Text>
                      <Text style={[styles.ruleLabel, { color: tone }]}>{section.label}</Text>
                    </View>
                    <Text style={styles.ruleBody}>{section.body}</Text>
                    <Text style={[styles.ruleSummary, { color: tone }]}>{section.summary}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Glossary</Text>
          <View style={styles.glossaryList}>
            {GLOSSARY.map((item) => (
              <View key={item.term} style={styles.glossaryRow}>
                <Text style={styles.glossaryTerm}>{item.term}</Text>
                <Text style={styles.glossaryDefinition}>{item.definition}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createGuideStyles(colors: ThemeColors) {
  const rowSurface = createTileSurface(colors, {
    padding: 11,
    radius: 8,
    borderOpacity: 0.2,
    backgroundOpacity: 0.2,
  });

  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      paddingHorizontal: ui.spacing.screen,
      paddingTop: ui.spacing.screen,
      paddingBottom: ui.spacing.lg,
      gap: 12,
    },
    introCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.26),
      backgroundColor: withAlpha(colors.surface2, 0.78),
      padding: 12,
      gap: 9,
    },
    introLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    introTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      lineHeight: 22,
      fontWeight: "900",
    },
    block: {
      gap: 8,
    },
    blockTitle: {
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
      paddingHorizontal: 2,
    },
    ruleList: {
      gap: 8,
    },
    firstDayList: {
      gap: 8,
    },
    firstDayRow: {
      ...rowSurface,
      backgroundColor: withAlpha(HOME_GOLD, 0.06),
      borderColor: withAlpha(HOME_GOLD, 0.2),
    },
    firstDayTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
    },
    firstDayBody: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      marginTop: 3,
    },
    ruleRow: {
      ...rowSurface,
      flexDirection: "row",
      gap: 10,
      alignItems: "flex-start",
      backgroundColor: withAlpha(colors.surface, 0.78),
    },
    ruleIcon: {
      width: 34,
      height: 34,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.3),
      backgroundColor: withAlpha(HOME_GOLD, 0.09),
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    ruleCopy: {
      flex: 1,
      minWidth: 0,
    },
    ruleTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    ruleTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "900",
    },
    ruleLabel: {
      color: HOME_GOLD,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "900",
      letterSpacing: 0,
      textTransform: "uppercase",
    },
    ruleBody: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
      marginTop: 4,
    },
    ruleSummary: {
      color: HOME_GOLD,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "800",
      marginTop: 5,
    },
    glossaryList: {
      gap: 8,
    },
    glossaryRow: {
      ...rowSurface,
      backgroundColor: withAlpha(colors.surface, 0.7),
    },
    glossaryTerm: {
      color: HOME_GOLD,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "900",
    },
    glossaryDefinition: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
      marginTop: 2,
    },
  });
}
