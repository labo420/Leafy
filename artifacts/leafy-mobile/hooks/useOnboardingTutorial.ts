import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "leafy_tutorial_count";

export function useOnboardingTutorial(isLoggedIn: boolean) {
  const [shouldShow, setShouldShow] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      setReady(true);
      return;
    }
    AsyncStorage.getItem(KEY).then((val) => {
      const count = val ? parseInt(val, 10) : 0;
      if (count < 3) {
        AsyncStorage.setItem(KEY, String(count + 1));
        setShouldShow(true);
      }
      setReady(true);
    });
  }, [isLoggedIn]);

  const dismiss = () => setShouldShow(false);

  return { shouldShow: ready && shouldShow, dismiss };
}
