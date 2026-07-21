import { IconSymbol } from "@/components/ui/icon-symbol";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { CONTRACT_GOLD, HOME_GOLD } from "@/src/styles";
import { createCardSurface, createTileSurface, ui, withAlpha } from "@/src/utils/designSystem";
import { useTheme, type ThemeColors } from "@/src/utils/themeContext";

type IconName = React.ComponentProps<typeof IconSymbol>["name"];

type GuideSection = {
  title: string;
  label: string;
  body: string;
  icon: IconName;
  summary: string;
  tone: string;
};

type GlossaryItem = {
  term: string;
  definition: string;
};

type FirstDayStep = {
  title: string;
  body: string;
  icon: IconName;
};

type LoopStage = {
  label: string;
  meta: string;
  icon: IconName;
};

const GUIDE_MINT = "#34D399";
const GUIDE_BLUE = "#60A5FA";
const GUIDE_VIOLET = "#A78BFA";
const GUIDE_ROSE = "#F472B6";

const LOOP_STAGES: LoopStage[] = [
  { label: "Plan", meta: "Choose", icon: "calendar" },
  { label: "Today", meta: "Execute", icon: "checkmark.circle.fill" },
  { label: "Midnight", meta: "Review", icon: "moon.fill" },
];

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: "Today",
    label: "Do",
    body: "Today is your live board. Finish its quests before midnight; Midnight records the result after the day ends.",
    icon: "house.fill",
    summary: "Finish before midnight. Contracts first, then open quests.",
    tone: GUIDE_MINT,
  },
  {
    title: "Contracts",
    label: "Pressure",
    body: "Contracts are quests you choose to protect. They highlight must-do work and build contract streaks and awards; they do not add a separate DR penalty.",
    icon: "shield.fill",
    summary: "Three active max. Protect only work that truly matters.",
    tone: CONTRACT_GOLD,
  },
  {
    title: "Plan",
    label: "Shape",
    body: "Plan decides what belongs on the board. It shows today, week load, and quests waiting outside today.",
    icon: "calendar",
    summary: "Quick add, week load, and resting quests.",
    tone: GUIDE_BLUE,
  },
  {
    title: "Progress",
    label: "Climb",
    body: "DR is Discipline Rating, the long-term consistency score. Each Midnight Evaluation moves DR; rank follows its current tier, while awards mark milestones.",
    icon: "chart.bar.fill",
    summary: "Progress explains performance. Player Card and Awards show what you have earned.",
    tone: GUIDE_ROSE,
  },
  {
    title: "Recovery Day",
    label: "Reset",
    body: "A Recovery Day freezes DR and both streaks for one day. Quest XP still counts, but rank and streaks do not advance, and awards do not unlock. It is available once every seven days from Plan.",
    icon: "moon.fill",
    summary: "Arm it before midnight. It protects the score; it never improves it.",
    tone: GUIDE_VIOLET,
  },
];

const FIRST_DAY_STEPS: FirstDayStep[] = [
  {
    title: "Build a small board",
    body: "Start with one easy win, one useful task, and one contract only if it truly matters.",
    icon: "calendar",
  },
  {
    title: "Clear the important work",
    body: "Tap Complete as you finish. Handle contracts before optional quests.",
    icon: "checkmark",
  },
  {
    title: "Read the signal",
    body: "After midnight, the completed board becomes DR movement, rank progress, streaks, and awards.",
    icon: "chart.bar.fill",
  },
];

const GLOSSARY: GlossaryItem[] = [
  { term: "DR", definition: "Discipline Rating. The long-term score that moves after each Midnight Evaluation and determines rank." },
  { term: "Daily Standard", definition: "Midnight scores up to seven scheduled quests. Completing seven can earn a perfect score even when the board is larger." },
  { term: "Resting", definition: "A paused quest. It stays in Plan but does not count on today's board." },
  { term: "Evaluation", definition: "The review shown after a day ends. It scores yesterday's scheduled quests and records DR movement; an empty scheduled day scores zero." },
  { term: "Rank", definition: "The tier linked to your current DR. It changes only when DR crosses a rank threshold." },
  { term: "Awards", definition: "Milestones unlocked by quest totals, strong days, contracts, streaks, category levels, and ranks." },
];

export default function GuideScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createGuideStyles(colors), [colors]);
  const [openTerm, setOpenTerm] = useState<string | null>("DR");
  const navigateBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/more");
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenHeader
          title="Guide"
          subtitle="The rules, without the noise"
          icon="chevron.left"
          onIconPress={navigateBack}
          iconAccessibilityLabel="Go back"
        />

        <View style={styles.introCard}>
          <View style={styles.introTopRow}>
            <View style={styles.introCopy}>
              <Text style={styles.introLabel}>The Midnight loop</Text>
              <Text style={styles.introTitle}>Choose clearly. Execute calmly. Learn at midnight.</Text>
              <Text style={styles.introBody}>
                One board turns daily actions into a long-term discipline signal.
              </Text>
            </View>
            <View style={styles.introIcon}>
              <IconSymbol name="moon.fill" size={27} color={HOME_GOLD} />
            </View>
          </View>

          <View style={styles.loopTrack}>
            {LOOP_STAGES.map((stage, index) => (
              <React.Fragment key={stage.label}>
                <View style={styles.loopStage}>
                  <View style={styles.loopStageIcon}>
                    <IconSymbol name={stage.icon} size={15} color={HOME_GOLD} />
                  </View>
                  <Text style={styles.loopStageLabel}>{stage.label}</Text>
                  <Text style={styles.loopStageMeta}>{stage.meta}</Text>
                </View>
                {index < LOOP_STAGES.length - 1 ? (
                  <IconSymbol name="chevron.right" size={16} color={withAlpha(HOME_GOLD, 0.48)} />
                ) : null}
              </React.Fragment>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Quick start</Text>
              <Text style={styles.sectionTitle}>Your first clean run</Text>
            </View>
            <Text style={styles.sectionMeta}>3 steps</Text>
          </View>

          <View style={styles.timelineCard}>
            {FIRST_DAY_STEPS.map((step, index) => (
              <View key={step.title} style={styles.stepRow}>
                <View style={styles.stepRail}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepNumber}>{index + 1}</Text>
                  </View>
                  {index < FIRST_DAY_STEPS.length - 1 ? <View style={styles.stepLine} /> : null}
                </View>
                <View style={[styles.stepCopy, index < FIRST_DAY_STEPS.length - 1 && styles.stepCopySpaced]}>
                  <View style={styles.stepTitleRow}>
                    <IconSymbol name={step.icon} size={15} color={HOME_GOLD} />
                    <Text style={styles.stepTitle}>{step.title}</Text>
                  </View>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>System map</Text>
              <Text style={styles.sectionTitle}>Five rules that matter</Text>
            </View>
            <Text style={styles.sectionMeta}>Essentials</Text>
          </View>

          <View style={styles.ruleList}>
            {GUIDE_SECTIONS.map((section) => (
              <View
                key={section.title}
                style={[
                  styles.ruleRow,
                  {
                    borderColor: withAlpha(section.tone, 0.24),
                    backgroundColor: withAlpha(section.tone, 0.045),
                  },
                ]}
              >
                <View
                  style={[
                    styles.ruleIcon,
                    {
                      borderColor: withAlpha(section.tone, 0.38),
                      backgroundColor: withAlpha(section.tone, 0.11),
                    },
                  ]}
                >
                  <IconSymbol name={section.icon} size={19} color={section.tone} />
                </View>
                <View style={styles.ruleCopy}>
                  <View style={styles.ruleTitleRow}>
                    <Text style={styles.ruleTitle}>{section.title}</Text>
                    <View style={[styles.ruleLabelPill, { backgroundColor: withAlpha(section.tone, 0.12) }]}>
                      <Text style={[styles.ruleLabel, { color: section.tone }]}>{section.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.ruleBody}>{section.body}</Text>
                  <View style={styles.ruleSummaryRow}>
                    <IconSymbol name="checkmark" size={13} color={section.tone} />
                    <Text style={[styles.ruleSummary, { color: section.tone }]}>{section.summary}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Reference</Text>
              <Text style={styles.sectionTitle}>Midnight glossary</Text>
            </View>
            <Text style={styles.sectionMeta}>Tap a term</Text>
          </View>

          <View style={styles.glossaryCard}>
            {GLOSSARY.map((item, index) => {
              const expanded = openTerm === item.term;
              return (
                <Pressable
                  key={item.term}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.term}. ${expanded ? "Collapse definition" : "Expand definition"}`}
                  accessibilityState={{ expanded }}
                  onPress={() => setOpenTerm((current) => current === item.term ? null : item.term)}
                  style={({ pressed }) => [
                    styles.glossaryRow,
                    index > 0 && styles.glossaryRowBorder,
                    expanded && styles.glossaryRowExpanded,
                    pressed && styles.glossaryRowPressed,
                  ]}
                >
                  <View style={styles.glossaryTitleRow}>
                    <Text style={[styles.glossaryTerm, expanded && styles.glossaryTermExpanded]}>{item.term}</Text>
                    <IconSymbol
                      name="chevron.right"
                      size={18}
                      color={expanded ? HOME_GOLD : colors.textSecondary}
                      style={[styles.glossaryChevron, expanded && styles.glossaryChevronExpanded]}
                    />
                  </View>
                  {expanded ? <Text style={styles.glossaryDefinition}>{item.definition}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.footerNote}>
          <View style={styles.footerIcon}>
            <IconSymbol name="sparkles" size={17} color={HOME_GOLD} />
          </View>
          <View style={styles.footerCopy}>
            <Text style={styles.footerTitle}>Start smaller than you think.</Text>
            <Text style={styles.footerBody}>A board you can repeat beats one impressive day you cannot sustain.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createGuideStyles(colors: ThemeColors) {
  const heroSurface = createCardSurface(colors, {
    padding: ui.spacing.md,
    radius: ui.radius.card,
    borderOpacity: 0.26,
    backgroundColor: withAlpha(colors.surface2, 0.88),
  });
  const cardSurface = createCardSurface(colors, {
    padding: ui.spacing.md,
    radius: ui.radius.card,
    borderOpacity: 0.2,
    backgroundColor: withAlpha(colors.surface2, 0.72),
  });
  const rowSurface = createTileSurface(colors, {
    padding: ui.spacing.sm,
    radius: ui.radius.md,
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
      paddingTop: ui.spacing.md,
      paddingBottom: 0,
      gap: ui.spacing.md,
    },
    introCard: {
      ...heroSurface,
      gap: ui.spacing.md,
      borderColor: withAlpha(HOME_GOLD, 0.32),
      backgroundColor: withAlpha(colors.surface2, 0.92),
      overflow: "hidden",
    },
    introTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: ui.spacing.sm,
    },
    introCopy: {
      flex: 1,
      minWidth: 0,
    },
    introLabel: {
      color: HOME_GOLD,
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    introTitle: {
      color: colors.textPrimary,
      fontSize: 23,
      lineHeight: 28,
      fontWeight: "900",
      marginTop: 4,
    },
    introBody: {
      color: withAlpha(colors.textSecondary, 0.9),
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "700",
      marginTop: 7,
    },
    introIcon: {
      width: 54,
      height: 54,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.4),
      backgroundColor: withAlpha(HOME_GOLD, 0.11),
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    loopTrack: {
      flexDirection: "row",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: withAlpha(HOME_GOLD, 0.18),
      paddingTop: ui.spacing.sm,
      gap: 4,
    },
    loopStage: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      gap: 2,
    },
    loopStageIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(HOME_GOLD, 0.1),
      marginBottom: 2,
    },
    loopStageLabel: {
      color: colors.textPrimary,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "900",
      textAlign: "center",
    },
    loopStageMeta: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 9,
      lineHeight: 13,
      fontWeight: "800",
      textAlign: "center",
      textTransform: "uppercase",
    },
    section: {
      gap: ui.spacing.xs,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: ui.spacing.sm,
      paddingHorizontal: 2,
    },
    sectionEyebrow: {
      color: withAlpha(colors.textSecondary, 0.76),
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 19,
      lineHeight: 23,
      fontWeight: "900",
      marginTop: 2,
    },
    sectionMeta: {
      color: HOME_GOLD,
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "900",
      textTransform: "uppercase",
      textAlign: "right",
    },
    timelineCard: {
      ...cardSurface,
      paddingVertical: ui.spacing.sm,
      gap: 0,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: ui.spacing.sm,
    },
    stepRail: {
      width: 32,
      alignItems: "center",
    },
    stepBadge: {
      width: 30,
      height: 30,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: withAlpha(HOME_GOLD, 0.42),
      backgroundColor: withAlpha(HOME_GOLD, 0.12),
      alignItems: "center",
      justifyContent: "center",
    },
    stepNumber: {
      color: HOME_GOLD,
      fontSize: 12,
      lineHeight: 15,
      fontWeight: "900",
    },
    stepLine: {
      width: 1,
      flex: 1,
      minHeight: 42,
      backgroundColor: withAlpha(HOME_GOLD, 0.25),
      marginVertical: 4,
    },
    stepCopy: {
      flex: 1,
      minWidth: 0,
      paddingTop: 4,
    },
    stepCopySpaced: {
      paddingBottom: ui.spacing.md,
    },
    stepTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    stepTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 19,
      fontWeight: "900",
    },
    stepBody: {
      color: withAlpha(colors.textSecondary, 0.88),
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      marginTop: 4,
    },
    ruleList: {
      gap: ui.spacing.xs,
    },
    ruleRow: {
      ...rowSurface,
      flexDirection: "row",
      gap: ui.spacing.sm,
      alignItems: "flex-start",
      padding: ui.spacing.sm,
    },
    ruleIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      borderWidth: 1,
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
      gap: ui.spacing.xs,
    },
    ruleTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      lineHeight: 20,
      fontWeight: "900",
      flex: 1,
      minWidth: 0,
    },
    ruleLabelPill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    ruleLabel: {
      fontSize: 9,
      lineHeight: 12,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    ruleBody: {
      color: withAlpha(colors.textSecondary, 0.88),
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      marginTop: 5,
    },
    ruleSummaryRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      marginTop: 7,
    },
    ruleSummary: {
      flex: 1,
      minWidth: 0,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "900",
    },
    glossaryCard: {
      ...cardSurface,
      padding: 0,
      overflow: "hidden",
    },
    glossaryRow: {
      paddingHorizontal: ui.spacing.md,
      paddingVertical: ui.spacing.sm,
    },
    glossaryRowBorder: {
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.18),
    },
    glossaryRowExpanded: {
      backgroundColor: withAlpha(HOME_GOLD, 0.055),
    },
    glossaryRowPressed: {
      opacity: 0.74,
    },
    glossaryTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: ui.spacing.sm,
      minHeight: 28,
    },
    glossaryTerm: {
      color: colors.textPrimary,
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "900",
    },
    glossaryTermExpanded: {
      color: HOME_GOLD,
    },
    glossaryChevron: {
      transform: [{ rotate: "0deg" }],
    },
    glossaryChevronExpanded: {
      transform: [{ rotate: "90deg" }],
    },
    glossaryDefinition: {
      color: withAlpha(colors.textSecondary, 0.9),
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      marginTop: 6,
      paddingRight: ui.spacing.md,
    },
    footerNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: ui.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: withAlpha(HOME_GOLD, 0.22),
      paddingHorizontal: 2,
      paddingTop: ui.spacing.sm,
    },
    footerIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(HOME_GOLD, 0.09),
    },
    footerCopy: {
      flex: 1,
      minWidth: 0,
    },
    footerTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 17,
      fontWeight: "900",
    },
    footerBody: {
      color: withAlpha(colors.textSecondary, 0.82),
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700",
      marginTop: 2,
    },
  });
}
