import React from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

export function FixedPercent({
  value,
  textStyle,
  style,
  accessibilityLabel,
}: {
  value: number | string;
  textStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityLabel={accessibilityLabel ?? `${value}%`}
    >
      <Text style={textStyle} allowFontScaling={false}>{value}</Text>
      <Text style={textStyle} allowFontScaling={false}>%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "nowrap",
    flexShrink: 0,
  },
});
