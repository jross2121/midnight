import React from "react";
import { Image, Text, View } from "react-native";
import { HOME_GOLD } from "../_styles";
import { withAlpha } from "../_utils/designSystem";
import { useTheme } from "../_utils/themeContext";

const MIDNIGHT_ICON = require("../../../assets/images/midnight-icon.png");

export function Footer() {
  const { colors } = useTheme();

  return (
    <View
      style={{
        paddingVertical: 12,
        paddingHorizontal: 12,
        alignItems: "center",
        marginTop: 10,
        borderTopWidth: 1.5,
        borderTopColor: withAlpha(HOME_GOLD, 0.22),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Image
          source={MIDNIGHT_ICON}
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
          }}
        />
        <View>
          <Text style={{ fontSize: 15, lineHeight: 19, color: HOME_GOLD, fontWeight: "900", letterSpacing: 0 }}>
            MIDNIGHT
          </Text>
          <Text style={{ fontSize: 10, lineHeight: 15, color: colors.textSecondary, fontWeight: "700" }}>
            Daily discipline tracker
          </Text>
        </View>
      </View>
    </View>
  );
}
