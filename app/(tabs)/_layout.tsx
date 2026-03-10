import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from './_utils/themeContext';

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const safeBottomInset = insets.bottom;
  const navBottomPadding = Math.max(safeBottomInset, 8);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          backgroundColor: colors.surface2,
          borderTopColor: colors.divider,
          borderTopWidth: 1,
          paddingBottom: navBottomPadding,
          paddingTop: 3,
          height: 56 + safeBottomInset,
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
          lineHeight: 12,
          letterSpacing: 0.2,
          textAlign: 'center',
          alignSelf: 'center',
          includeFontPadding: false,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Discipline',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="star.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="achievements"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="gearshape.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
