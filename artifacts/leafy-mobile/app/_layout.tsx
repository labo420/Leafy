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
import {
  Feather,
  MaterialCommunityIcons,
  FontAwesome5,
} from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
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

// Suppress fontfaceobserver timeout errors — not a real crash, app renders fine with system fonts
const _EU = (global as any).ErrorUtils;
if (_EU) {
  const prevHandler = _EU.getGlobalHandler();
  _EU.setGlobalHandler((error: Error, isFatal?: boolean) => {
    if (
      error?.message?.includes("timeout exceeded") ||
      error?.stack?.includes("fontfaceobserver")
    ) {
      return;
    }
    prevHandler(error, isFatal);
  });
}

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
    ...Feather.font,
    ...MaterialCommunityIcons.font,
    ...FontAwesome5.font,
  });

  const [forceReady, setForceReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setForceReady(true), 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || forceReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError, forceReady]);

  if (!fontsLoaded && !fontError && !forceReady) return null;

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
