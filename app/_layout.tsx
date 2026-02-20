import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeProvider as CustomThemeProvider } from './(tabs)/_utils/themeContext';
import { ONBOARDING_STORAGE_KEY } from './(tabs)/_utils/types';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
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
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack initialRouteName={hasSeenOnboarding ? '(tabs)' : 'onboarding'}>
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </CustomThemeProvider>
    </SafeAreaProvider>
  );
}
