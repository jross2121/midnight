import { IconSymbol } from "@/components/ui/icon-symbol";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Footer } from "./components/Footer";
import { styles } from "./styles";
import { useTheme } from "./utils/themeContext";

export default function SettingsScreen() {
  const { theme, toggleTheme } = useTheme();

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: useTheme().colors.bg }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <IconSymbol name="gearshape.fill" size={36} color="#00d9ff" />
          <Text style={styles.title}>⚙️ Settings</Text>
        </View>

        {/* Theme Section */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: useTheme().colors.bgCard,
              borderColor: useTheme().colors.border,
            },
          ]}
        >
          <View style={styles.cardTop}>
            <Text style={[styles.cardTitle, { color: useTheme().colors.textPrimary }]}>
              Theme
            </Text>
            <Pressable
              onPress={toggleTheme}
              style={({ pressed }) => [
                {
                  backgroundColor: useTheme().colors.accent,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 8,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={{ color: "#0a0e14", fontWeight: "900", fontSize: 12 }}>
                {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.questMeta, { color: useTheme().colors.textSecondary }]}>
            Current: <Text style={{ fontWeight: "700" }}>{theme === "dark" ? "Dark Mode" : "Light Mode"}</Text>
          </Text>
        </View>

        {/* About Section */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: useTheme().colors.bgCard,
              borderColor: useTheme().colors.border,
              marginTop: 16,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: useTheme().colors.textPrimary }]}>
            About
          </Text>
          <Text style={[styles.questMeta, { color: useTheme().colors.textSecondary, marginTop: 10 }]}>
            StatLife v1.0
          </Text>
          <Text style={[styles.questMeta, { color: useTheme().colors.textSecondary, marginTop: 8 }]}>
            Gamify your life and build better habits through quests and progression.
          </Text>
        </View>
        <Footer />
      </ScrollView>
    </SafeAreaView>
  );
}
