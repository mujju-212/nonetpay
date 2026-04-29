import { API_BASE_URL, STORAGE_KEYS } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

// ─────────────────────────────────────────────────────────────────────────────
// Razorpay Payment Helper
//
// Flow (works in Expo Go — no native module needed):
//  1. App calls createTopUpOrder(token, amount)
//  2. Backend creates Razorpay order → returns checkoutUrl
//  3. App opens checkoutUrl in expo-web-browser
//  4. User pays in browser → backend checkout page verifies payment
//  5. App polls backend balance on return → balance updated
// ─────────────────────────────────────────────────────────────────────────────

export type CreateOrderResult = {
  success: boolean;
  orderId?: string;
  checkoutUrl?: string;
  amount?: number;          // in paise
  error?: string;
};

export type PaymentResult = {
  opened: boolean;
  newBalance?: number;
  error?: string;
};

/**
 * Step 1: Create a Razorpay order on the backend.
 * Returns the checkout URL to open in browser.
 */
export async function createTopUpOrder(
  token: string,
  amount: number,
  returnUrl: string
): Promise<CreateOrderResult> {
  try {
    const resp = await fetch(`${API_BASE_URL}/api/payment/create-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount, returnUrl }),
    });
    const data = await resp.json();
    if (!resp.ok) return { success: false, error: data.error || "Order creation failed" };
    return {
      success: true,
      orderId: data.orderId,
      checkoutUrl: data.checkoutUrl,
      amount: data.amount,
    };
  } catch {
    return { success: false, error: "Network error. Is backend running?" };
  }
}

/**
 * Step 2: Open the Razorpay checkout page in the device browser.
 * Returns once the user closes the browser (success or cancel).
 */
export async function openRazorpayCheckout(checkoutUrl: string): Promise<PaymentResult> {
  try {
    const returnUrl = Linking.createURL("payment-callback");
    const result = await WebBrowser.openAuthSessionAsync(checkoutUrl, returnUrl);
    if (result.type !== "success" || !result.url) {
      return { opened: true, error: "Payment cancelled" };
    }
    const parsed = Linking.parse(result.url);
    const status = typeof parsed.queryParams?.status === "string" ? parsed.queryParams.status : "";
    const balanceRaw = parsed.queryParams?.balance;
    const newBalance = typeof balanceRaw === "string" ? Number(balanceRaw) : undefined;
    if (status !== "success") {
      return { opened: true, error: "Payment cancelled" };
    }
    return { opened: true, newBalance: Number.isFinite(newBalance) ? newBalance : undefined };
  } catch (error: any) {
    return { opened: false, error: error.message };
  }
}

/**
 * Step 3: After browser closes, fetch fresh balance from backend.
 * The checkout page already called /verify-from-web, so balance is updated.
 */
export async function fetchBalanceAfterPayment(token: string): Promise<number | null> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(`${API_BASE_URL}/api/balance`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!resp.ok) return null;
    const data = await resp.json();
    const balance = data.balance ?? null;
    if (balance !== null) {
      await AsyncStorage.setItem(STORAGE_KEYS.WALLET_BALANCE, String(balance));
    }
    return balance;
  } catch {
    return null;
  }
}

/**
 * Full top-up flow — call this from wallet screen "Add Money" button.
 *
 * Usage:
 *   const result = await initiateTopUp(token, 500, setBalance);
 */
export async function initiateTopUp(
  token: string,
  amount: number,
  previousBalance: number,
  onBalanceUpdate?: (balance: number) => void
): Promise<{ success: boolean; message: string }> {

  const returnUrl = Linking.createURL("payment-callback");
  // 1. Create order
  const orderResult = await createTopUpOrder(token, amount, returnUrl);
  if (!orderResult.success || !orderResult.checkoutUrl) {
    return { success: false, message: orderResult.error || "Failed to create order" };
  }

  // 2. Open in-app checkout session
  const checkout = await openRazorpayCheckout(orderResult.checkoutUrl);
  if (checkout.error === "Payment cancelled") {
    return { success: false, message: "Payment cancelled" };
  }

  // 3. Read fresh balance with retries (verification can complete slightly later)
  let newBalance = checkout.newBalance ?? null;
  if (newBalance === null || newBalance === undefined) {
    for (let i = 0; i < 6; i++) {
      const latest = await fetchBalanceAfterPayment(token);
      if (latest !== null && latest >= previousBalance + amount) {
        newBalance = latest;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
  if (newBalance === null || newBalance === undefined) {
    newBalance = await fetchBalanceAfterPayment(token);
  }

  if (newBalance !== null && onBalanceUpdate) {
    onBalanceUpdate(newBalance);
  }

  return {
    success: newBalance !== null,
    message: newBalance !== null
      ? `₹${amount} added! New balance: ₹${newBalance}`
      : "Payment is being verified. Pull to refresh in a few seconds.",
  };
}
