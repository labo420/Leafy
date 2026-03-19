import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  delaySeconds = 0,
): Promise<void> {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: delaySeconds > 0 ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delaySeconds } : null,
    });
  } catch {
  }
}

export async function sendWalkinRewardNotification(locationName: string, xp: number): Promise<void> {
  await scheduleLocalNotification(
    "🏪 Walk-in completato!",
    `Hai guadagnato ${xp} XP visitando ${locationName}. Continua così!`,
  );
}

export async function sendDiscoveryRewardNotification(productName: string, xp: number): Promise<void> {
  await scheduleLocalNotification(
    "🔍 Scoperta completata!",
    `Hai guadagnato ${xp} XP scansionando "${productName}"!`,
  );
}
