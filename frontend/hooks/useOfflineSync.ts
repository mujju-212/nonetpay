import { useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { syncOfflineTransactions, getOfflineTransactions } from "../lib/api";
import { STORAGE_KEYS } from "../constants/Config";

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedCount, setLastSyncedCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    try {
      const txns = await getOfflineTransactions();
      const pending = txns.filter((t) => t.status === "pending").length;
      setPendingCount(pending);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const sync = useCallback(async (): Promise<number> => {
    if (syncing) return 0;
    try {
      setSyncing(true);
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (!token) return 0;

      const count = await syncOfflineTransactions(token).catch(() => 0);
      setLastSyncedCount(count);
      await refreshPendingCount();
      return count;
    } catch {
      return 0;
    } finally {
      setSyncing(false);
    }
  }, [syncing, refreshPendingCount]);

  // Run on every screen focus
  useFocusEffect(
    useCallback(() => {
      refreshPendingCount();
      sync();
    }, [refreshPendingCount, sync])
  );

  return { pendingCount, syncing, lastSyncedCount, sync, refreshPendingCount };
}
