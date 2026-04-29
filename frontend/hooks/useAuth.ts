import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { STORAGE_KEYS } from "../constants/Config";

export type AuthUser = {
  userId: string;
  name: string;
  phone: string;
  balance?: number;
  role: "user";
};

export type AuthMerchant = {
  merchantId: string;
  businessName: string;
  phone: string;
  address?: string;
  isVerified: boolean;
  role: "merchant";
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  merchant: AuthMerchant | null;
  role: "user" | "merchant" | null;
  isLoading: boolean;
};

const SESSION_KEYS = [
  STORAGE_KEYS.AUTH_TOKEN,
  STORAGE_KEYS.USER_DATA,
  STORAGE_KEYS.MERCHANT_DATA,
  STORAGE_KEYS.WALLET_BALANCE,
  STORAGE_KEYS.OFFLINE_TRANSACTIONS,
  STORAGE_KEYS.USED_VOUCHER_IDS,
  STORAGE_KEYS.GENERATED_VOUCHERS,
];

export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    token: null,
    user: null,
    merchant: null,
    role: null,
    isLoading: true,
  });

  const reload = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const rawUser = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      const rawMerchant = await AsyncStorage.getItem(STORAGE_KEYS.MERCHANT_DATA);

      const user: AuthUser | null = rawUser ? JSON.parse(rawUser) : null;
      const merchant: AuthMerchant | null = rawMerchant ? JSON.parse(rawMerchant) : null;

      setState({
        token,
        user,
        merchant,
        role: user ? "user" : merchant ? "merchant" : null,
        isLoading: false,
      });
    } catch {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const logout = useCallback(() => {
    AsyncStorage.multiRemove(SESSION_KEYS)
      .catch(() => {})
      .finally(() => {
        setState({ token: null, user: null, merchant: null, role: null, isLoading: false });
        router.replace("/");
      });
  }, [router]);

  return { ...state, reload, logout };
}
