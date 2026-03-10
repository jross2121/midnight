import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/app/(tabs)/_utils/themeContext';

export function HapticTab(props: BottomTabBarButtonProps) {
  const { colors } = useTheme();
  const isActive = !!props.accessibilityState?.selected;

  return (
    <PlatformPressable
      {...props}
      style={({ pressed }) => [
        props.style,
        styles.button,
        {
          backgroundColor: isActive ? `${colors.accentPrimary}14` : 'transparent',
          borderColor: isActive ? `${colors.accentPrimary}3D` : 'transparent',
          borderWidth: isActive ? 1 : 0,
          shadowColor: colors.accentPrimary,
          shadowOpacity: isActive ? 0.03 : 0,
        },
        pressed && styles.pressed,
      ]}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    marginHorizontal: 4,
    marginVertical: 0,
    borderRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4,
    elevation: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.9,
  },
});
