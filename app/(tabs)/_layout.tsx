import { Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useTheme } from './_utils/themeContext';

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const safeBottomInset = insets.bottom;
  const navBottomOffset = 14;
  const navBottomPadding = Math.max(safeBottomInset, 5);
  const navHeight = 48 + safeBottomInset;
  const sceneBottomInset = navHeight + navBottomOffset + 8;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accentPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelPosition: 'below-icon',
        sceneStyle: {
          paddingBottom: sceneBottomInset,
          backgroundColor: colors.bg,
        },
        tabBarBackground: () => <View style={{ flex: 1, backgroundColor: '#070E15' }} />,
        tabBarStyle: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: navBottomOffset,
          backgroundColor: '#070E15',
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: `${colors.accentPrimary}16`,
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
          marginBottom: -2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 1,
          lineHeight: 12,
          letterSpacing: 0.3,
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
