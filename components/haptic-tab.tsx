import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { HOME_GOLD } from '@/src/styles';
import { withAlpha } from '@/src/utils/designSystem';

export function HapticTab(props: BottomTabBarButtonProps) {
  const isActive = !!props.accessibilityState?.selected;

  return (
    <PlatformPressable
      {...props}
      style={[
        props.style,
        styles.button,
        {
          backgroundColor: isActive ? withAlpha(HOME_GOLD, 0.07) : 'transparent',
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
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
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
