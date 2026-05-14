import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { HOME_GOLD } from '@/app/(tabs)/_styles';
import { withAlpha } from '@/app/(tabs)/_utils/designSystem';

export function HapticTab(props: BottomTabBarButtonProps) {
  const isActive = !!props.accessibilityState?.selected;

  return (
    <PlatformPressable
      {...props}
      style={[
        props.style,
        styles.button,
        {
          backgroundColor: isActive ? withAlpha(HOME_GOLD, 0.05) : 'transparent',
          borderColor: isActive ? withAlpha(HOME_GOLD, 0.16) : 'transparent',
          borderWidth: isActive ? 0.8 : 0,
          shadowColor: HOME_GOLD,
          shadowOpacity: isActive ? 0.06 : 0,
          shadowRadius: isActive ? 8 : 0,
          elevation: isActive ? 1 : 0,
          transform: [{ scale: isActive ? 1.03 : 1 }],
        },
      ]}
      onPressIn={(ev) => {
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}>
      {isActive ? <View pointerEvents="none" style={[styles.activeIndicator, { backgroundColor: HOME_GOLD }]} /> : null}
      {props.children}
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    marginHorizontal: 4,
    marginVertical: 0,
    borderRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    elevation: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    overflow: 'hidden',
  },
  activeIndicator: {
    position: 'absolute',
    top: 2,
    width: 12,
    height: 2,
    borderRadius: 999,
    opacity: 0.95,
  },
});
