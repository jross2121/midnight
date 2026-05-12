import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { configureNotificationHandler } from './(tabs)/_utils/reminders';
import { ThemeProvider as CustomThemeProvider, useTheme } from './(tabs)/_utils/themeContext';
import { ONBOARDING_STORAGE_KEY } from './(tabs)/_utils/types';

configureNotificationHandler();

export const unstable_settings = {
  anchor: '(tabs)',
};

function NavigationThemeBridge({ children }: { children: ReactNode }) {
  const { theme, colors } = useTheme();

  const navigationTheme = useMemo(() => {
    const baseTheme = theme === 'dark' ? DarkTheme : DefaultTheme;

    return {
      ...baseTheme,
      dark: theme === 'dark',
      colors: {
        ...baseTheme.colors,
        primary: colors.accentPrimary,
        background: colors.bg,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.accentPrimary,
      },
    };
  }, [colors, theme]);

  return <ThemeProvider value={navigationTheme}>{children}</ThemeProvider>;
}

export default function RootLayout() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const saved = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (isMounted) {
          setHasSeenOnboarding(saved === 'true');
        }
      } catch (error) {
        console.log('Failed to load onboarding status:', error);
        if (isMounted) {
          setHasSeenOnboarding(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  if (hasSeenOnboarding === null) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <CustomThemeProvider>
        <NavigationThemeBridge>
          <Stack initialRouteName={hasSeenOnboarding ? '(tabs)' : 'onboarding'}>
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </NavigationThemeBridge>
      </CustomThemeProvider>
    </SafeAreaProvider>
  );
}
