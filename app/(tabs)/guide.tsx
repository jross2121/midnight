import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CONTRACT_BLUE, HOME_GOLD } from "./_styles";
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

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: "Daily Run",
    label: "Home",
    body: "Home is the live board for the current day. Finish quests before midnight, then the day gets judged.",
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
    body: "DR is the long-term score. Rank, insights, awards, and the player card come from finished days.",
    icon: "trophy.fill",
    summary: "Rank follows DR. Equip badges from Awards.",
  },
];

const GLOSSARY: GlossaryItem[] = [
  { term: "DR", definition: "Discipline Rating. The long-term score behind rank." },
  { term: "Daily Standard", definition: "The completion target that makes the day count as stable." },
  { term: "Resting", definition: "A quest removed from the active board until resumed." },
  { term: "Evaluation", definition: "The midnight judgment that turns the day into DR movement." },
];

export default function GuideScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createGuideStyles(colors), [colors]);

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.pageHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to More"
            onPress={() => router.push("/(tabs)/more")}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <IconSymbol name="chevron.left" size={19} color={HOME_GOLD} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>How Midnight Works</Text>
            <Text style={styles.subtitle}>Rules, terms, and flow</Text>
          </View>
        </View>

        <View style={styles.introCard}>
          <Text style={styles.introLabel}>Core loop</Text>
          <Text style={styles.introTitle}>Choose the day. Protect what matters. Review at midnight.</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Main Rules</Text>
          <View style={styles.ruleList}>
            {GUIDE_SECTIONS.map((section) => {
              const isContractSection = section.title === "Contracts";
              const tone = isContractSection ? CONTRACT_BLUE : HOME_GOLD;
              return (
                <View key={section.title} style={styles.ruleRow}>
                  <View
                    style={[
                      styles.ruleIcon,
                      isContractSection && {
                        borderColor: withAlpha(CONTRACT_BLUE, 0.3),
                        backgroundColor: withAlpha(CONTRACT_BLUE, 0.09),
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
    pageHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(colors.divider, 0.72),
    },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.34),
      backgroundColor: withAlpha(HOME_GOLD, 0.1),
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: {
      opacity: 0.76,
      transform: [{ scale: 0.992 }],
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 23,
      lineHeight: 27,
      fontWeight: "900",
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700",
      marginTop: 2,
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
