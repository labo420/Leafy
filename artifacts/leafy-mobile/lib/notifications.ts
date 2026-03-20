import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";

function isExpoGo(): boolean {
  return (Constants as any).appOwnership === "expo";
}

if (!isExpoGo()) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (isExpoGo()) return null;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;
    const tokenData = await Notifications.getExpoPushTokenAsync();
    return tokenData.data;
  } catch {
    return null;
  }
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  options: { delaySeconds?: number; silent?: boolean } = {},
): Promise<void> {
  if (Platform.OS === "web") return;
  if (isExpoGo()) return;
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;
    const { delaySeconds = 0, silent = false } = options;
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: !silent },
      trigger:
        delaySeconds > 0
          ? {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds: delaySeconds,
            }
          : null,
    });
  } catch {
  }
}

export async function sendWalkinRewardNotification(
  locationName: string,
  xp: number,
): Promise<void> {
  await scheduleLocalNotification(
    `Benvenuto in ${locationName}!`,
    `+${xp} XP`,
  );
}

export async function sendDiscoveryRewardNotification(
  productName: string,
  xp: number,
): Promise<void> {
  await scheduleLocalNotification(
    "Scoperta completata!",
    `Hai guadagnato ${xp} XP scansionando "${productName}"!`,
  );
}
