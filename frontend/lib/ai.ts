import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL, getGeneratedVouchers, getLocalBalance, getOfflineTransactions } from "./api";
import type { AiClientContext, AiSupportResponse, SpendingAnalytics } from "../types";

async function getAuthToken(): Promise<string> {
  const token = await AsyncStorage.getItem("@auth_token");
  if (!token) {
    throw new Error("Please log in again");
  }
  return token;
}

export async function buildAiClientContext(): Promise<AiClientContext> {
  const [cachedBalance, offlineTransactions, generatedVouchers] = await Promise.all([
    getLocalBalance(),
    getOfflineTransactions(),
    getGeneratedVouchers(),
  ]);

  return {
    cachedBalance,
    offlineTransactions,
    generatedVouchers,
  };
}

export async function fetchSupportReply(message: string): Promise<AiSupportResponse> {
  const token = await getAuthToken();
  const clientContext = await buildAiClientContext();

  const response = await fetch(`${API_BASE_URL}/api/ai/support`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ message, clientContext }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not get support reply");
  }

  return {
    reply: data.reply,
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    usedAi: Boolean(data.usedAi),
    matchedTransaction: data.matchedTransaction || null,
  };
}

export async function fetchSpendingInsights(): Promise<SpendingAnalytics> {
  const token = await getAuthToken();
  const clientContext = await buildAiClientContext();

  const response = await fetch(`${API_BASE_URL}/api/ai/insights`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ clientContext }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Could not load spending insights");
  }

  return data.analytics as SpendingAnalytics;
}
