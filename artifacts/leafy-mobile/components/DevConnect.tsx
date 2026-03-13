import React, { useEffect, useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";

export function DevConnect() {
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || !__DEV__) return;
    const domain = process.env.EXPO_PUBLIC_DOMAIN;
    const base = domain ? `https://${domain}` : "";
    const poll = async () => {
      try {
        const res = await fetch(`${base}/api/expo-tunnel`);
        const data = await res.json();
        if (data.url) setTunnelUrl(data.url);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  if (Platform.OS !== "web" || !__DEV__ || !tunnelUrl) return null;

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(tunnelUrl)}`;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scansiona con Expo Go</Text>
      <Image source={{ uri: qrSrc }} style={styles.qr} />
      <Text style={styles.url} selectable>{tunnelUrl}</Text>
      <Text style={styles.hint}>oppure in Expo Go → "Enter URL manually"</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
    maxWidth: 220,
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1B4332",
    marginBottom: 10,
    textAlign: "center",
  },
  qr: {
    width: 180,
    height: 180,
    marginBottom: 8,
  },
  url: {
    fontSize: 9,
    color: "#40916C",
    textAlign: "center",
    marginBottom: 4,
    fontFamily: "monospace",
  },
  hint: {
    fontSize: 9,
    color: "#999",
    textAlign: "center",
  },
});
