import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { HOME_GOLD } from './_styles';
import { withAlpha } from './_utils/designSystem';
import { useTheme } from './_utils/themeContext';

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const safeBottomInset = insets.bottom;
  const navBottomOffset = 14;
  const navBottomPadding = Math.max(safeBottomInset, 5);
  const navHeight = 54 + safeBottomInset;
  const sceneBottomInset = navHeight + navBottomOffset + 8;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: HOME_GOLD,
        tabBarInactiveTintColor: colors.textSecondary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelPosition: 'below-icon',
        sceneStyle: {
          paddingBottom: sceneBottomInset,
          backgroundColor: colors.bg,
        },
        tabBarBackground: () => <View style={{ flex: 1, backgroundColor: colors.surface }} />,
        tabBarStyle: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: navBottomOffset,
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: withAlpha(HOME_GOLD, 0.18),
          borderRadius: 12,
          paddingBottom: navBottomPadding,
          paddingTop: 2,
          height: navHeight,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.18,
          shadowRadius: 10,
          elevation: 5,
          overflow: 'hidden',
        },
        tabBarItemStyle: {
          paddingTop: 0,
          paddingBottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarIconStyle: {
          marginBottom: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 1,
          lineHeight: 14,
          letterSpacing: 0,
          textAlign: 'center',
          alignSelf: 'center',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="checkmark.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="achievements"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="focus"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="guide"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="ellipsis.circle.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
