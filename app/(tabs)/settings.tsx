import { IconSymbol } from "@/components/ui/icon-symbol";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Footer } from "./components/Footer";
import { createStyles } from "./styles";
import { useTheme } from "./utils/themeContext";

export default function SettingsScreen() {
  const { theme, toggleTheme, colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <IconSymbol name="gearshape.fill" size={36} color={colors.accentPrimary} />
          <Text style={styles.title}>⚙️ Settings</Text>
        </View>

        {/* Theme Section */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.cardTop}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Theme
            </Text>
            <Pressable
              onPress={toggleTheme}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.accentPrimary,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 8,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "900", fontSize: 12 }}>
                {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.questMeta, { color: colors.textSecondary }]}>
            Current: <Text style={{ fontWeight: "700" }}>{theme === "dark" ? "Dark Mode" : "Light Mode"}</Text>
          </Text>
        </View>

        {/* About Section */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              marginTop: 16,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            About
          </Text>
          <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 10 }]}>
            StatLife v1.0
          </Text>
          <Text style={[styles.questMeta, { color: colors.textSecondary, marginTop: 8 }]}>
            Gamify your life and build better habits through quests and progression.
          </Text>
        </View>
        <Footer />
      </ScrollView>
    </SafeAreaView>
  );
}
