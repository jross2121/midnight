import { useTheme } from "@/app/(tabs)/utils/themeContext";
import React from "react";
import { Text, View } from "react-native";

export function Footer() {
  const { colors } = useTheme();
  
  return (
    <View
      style={{
        paddingVertical: 16,
        paddingHorizontal: 16,
        alignItems: "center",
        marginTop: 24,
        borderTopWidth: 1.5,
        borderTopColor: colors.border,
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: "900", color: colors.accent, marginBottom: 4 }}>
        ⚔️ StatLife
      </Text>
      <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: "600" }}>
        Gamify Your Life • Level Up Daily
      </Text>
    </View>
  );
}
