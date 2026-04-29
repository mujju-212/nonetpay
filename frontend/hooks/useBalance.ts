import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { API_BASE_URL, saveLocalBalance, getLocalBalance, syncOfflineTransactions } from "../lib/api";
import { STORAGE_KEYS } from "../constants/Config";

export function useBalance(autoFetch = true) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (!token) { setBalance(0); setLoading(false); return; }

      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 4000);

      const resp = await fetch(`${API_BASE_URL}/api/balance`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(tid);

      if (resp.ok) {
        const data = await resp.json();
        setBalance(data.balance);
        setIsOffline(false);
        await saveLocalBalance(data.balance);

        // Sync offline queue and re-fetch if anything was synced
        const synced = await syncOfflineTransactions(token).catch(() => 0);
        if (synced > 0) {
          const ctrl2 = new AbortController();
          const tid2 = setTimeout(() => ctrl2.abort(), 4000);
          const resp2 = await fetch(`${API_BASE_URL}/api/balance`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: ctrl2.signal,
          });
          clearTimeout(tid2);
          if (resp2.ok) {
            const d2 = await resp2.json();
            setBalance(d2.balance);
            await saveLocalBalance(d2.balance);
          }
        }
      } else {
        const cached = await getLocalBalance();
        setBalance(cached ?? 0);
        setIsOffline(cached !== null);
      }
    } catch {
      const cached = await getLocalBalance();
      setBalance(cached ?? 0);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (autoFetch) fetchBalance();
    }, [autoFetch, fetchBalance])
  );

  return { balance, loading, isOffline, fetchBalance, setBalance };
}
