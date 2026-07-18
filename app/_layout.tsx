import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { HOME_GOLD } from '@/src/styles';
import { configureNotificationHandler } from '@/src/utils/reminders';
import { getReminderDestinationFromData } from '@/src/utils/reminderLogic';
import { ThemeProvider as CustomThemeProvider, useTheme } from '@/src/utils/themeContext';
import { ONBOARDING_STORAGE_KEY } from '@/src/utils/types';

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
        primary: HOME_GOLD,
        background: colors.bg,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: HOME_GOLD,
      },
    };
  }, [colors, theme]);

  return <ThemeProvider value={navigationTheme}>{children}</ThemeProvider>;
}

function NotificationResponseRouter() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const handledIds = new Set<string>();

    const handleResponse = async (response: Notifications.NotificationResponse) => {
      if (!active) return;
      const identifier = response.notification.request.identifier;
      if (handledIds.has(identifier)) return;

      const data = response.notification.request.content.data;
      const hasSafeRoute = getReminderDestinationFromData(data, true);
      if (!hasSafeRoute) return;
      handledIds.add(identifier);

      let hasCompletedOnboarding = false;
      try {
        hasCompletedOnboarding =
          (await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)) === 'true';
      } catch {
        hasCompletedOnboarding = false;
      }
      if (!active) return;

      const destination = getReminderDestinationFromData(data, hasCompletedOnboarding);
      if (!destination) return;
      if (destination === '/onboarding') router.replace(destination);
      else router.push(destination);
    };

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleResponse(response);
    });
    Notifications.getLastNotificationResponseAsync()
      .then(async (response) => {
        if (response) await handleResponse(response);
        if (response) await Notifications.clearLastNotificationResponseAsync();
      })
      .catch(() => undefined);

    return () => {
      active = false;
      subscription.remove();
    };
  }, [router]);

  return null;
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
        if (__DEV__) console.warn('Failed to load onboarding status:', error);
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
    return (
      <View style={launchStyles.screen} accessibilityRole="progressbar" accessibilityLabel="Opening Midnight">
        <Text style={launchStyles.brand}>MIDNIGHT</Text>
        <ActivityIndicator size="small" color={HOME_GOLD} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <CustomThemeProvider>
        <NavigationThemeBridge>
          <Stack initialRouteName={hasSeenOnboarding ? '(tabs)' : 'onboarding'}>
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <NotificationResponseRouter />
          <StatusBar style="auto" />
        </NavigationThemeBridge>
      </CustomThemeProvider>
    </SafeAreaProvider>
  );
}

const launchStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0A0F14',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  brand: {
    color: HOME_GOLD,
    fontSize: 26,
    lineHeight: 31,
    fontWeight: '900',
  },
});
