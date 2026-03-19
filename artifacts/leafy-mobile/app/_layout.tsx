import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DevConnect } from "@/components/DevConnect";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WelcomeTutorial } from "@/components/WelcomeTutorial";
import { AuthProvider, useAuth } from "@/context/auth";
import { LevelUpProvider } from "@/context/level-up";
import { NotificationsProvider } from "@/context/notifications";
import { ScanResetProvider } from "@/context/scan-reset";
import { ThemeProvider } from "@/context/theme";
import { useOnboardingTutorial } from "@/hooks/useOnboardingTutorial";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function TutorialGate() {
  const { user } = useAuth();
  const { shouldShow, dismiss } = useOnboardingTutorial(!!user);
  return <WelcomeTutorial visible={shouldShow} onDismiss={dismiss} />;
}

function RootLayoutNav() {
  return (
    <>
      <Stack screenOptions={{ headerBackTitle: "Indietro" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="barcode-scanner" options={{ headerShown: false, presentation: "fullScreenModal" }} />
        <Stack.Screen name="shopping-scanner" options={{ headerShown: false, presentation: "fullScreenModal" }} />
        <Stack.Screen name="support" options={{ headerShown: false }} />
      </Stack>
      <TutorialGate />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <ThemeProvider>
              <AuthProvider>
                <NotificationsProvider>
                  <LevelUpProvider>
                    <ScanResetProvider>
                      <RootLayoutNav />
                      <DevConnect />
                    </ScanResetProvider>
                  </LevelUpProvider>
                </NotificationsProvider>
              </AuthProvider>
              </ThemeProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
