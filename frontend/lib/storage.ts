import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Typed AsyncStorage wrappers ─────────────────────────────────────────────

/** Read and JSON-parse a stored value. Returns null if missing or parse fails. */
export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const val = await AsyncStorage.getItem(key);
    if (val === null) return null;
    return JSON.parse(val) as T;
  } catch {
    return null;
  }
}

/** JSON-stringify and store a value. */
export async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

/** Remove a single key. */
export async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {}
}

/** Remove multiple keys atomically. */
export async function removeItems(keys: string[]): Promise<void> {
  try {
    await AsyncStorage.multiRemove(keys);
  } catch {}
}

/** Read a raw string (no JSON parsing). */
export async function getString(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Store a raw string. */
export async function setString(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {}
}

/** Clear ALL AsyncStorage data — use with caution. */
export async function clearAll(): Promise<void> {
  try {
    await AsyncStorage.clear();
  } catch {}
}
