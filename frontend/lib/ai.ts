import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL, getGeneratedVouchers, getLocalBalance, getOfflineTransactions } from "./api";
import type { AiClientContext, AiSupportResponse, MerchantInsights, SpendingAnalytics } from "../types";

const DEFAULT_PROMPTS = [
  "Why was my payment rejected?",
  "How do offline payments work?",
  "Why is my balance different offline?",
  "What should I do next?",
];

const MERCHANT_DEFAULT_PROMPTS = [
  "Any failed vouchers today?",
  "How many payments are pending sync?",
  "Show this week's received amount",
  "What should I do next?",
];

function buildFaqSupportReply(
  text: string,
  pendingCount: number,
  pendingAmount: number,
  failedCount: number,
  latestFailed: AiClientContext["offlineTransactions"][number] | null
): string | null {
  const hasAny = (...words: string[]) => words.some((word) => text.includes(word));

  if (hasAny("how do offline", "offline payment", "offline voucher")) {
    return (
      "Offline payments create a signed voucher on your phone with merchant ID, amount, and timestamp. " +
      "The merchant can scan it without internet, and the server verifies the signature during sync."
    );
  }

  if (hasAny("rejected", "failed", "failing", "fail", "declined")) {
    if (latestFailed) {
      return (
        `Your last failed payment was Rs ${normalizeAmount(latestFailed.amount)} to ${latestFailed.merchantName || latestFailed.merchantId}. ` +
        `Reason: ${latestFailed.failureReason || "verification failed"}. ` +
        "Please re-scan the correct merchant QR and sync again."
      );
    }
    return (
      "Payments are usually rejected due to wrong merchant QR, invalid signature, duplicate voucher, or low balance at sync time. " +
      "Open History, check failed voucher reason, then retry payment with correct merchant QR."
    );
  }

  if (hasAny("balance different", "balance mismatch", "wallet different", "wallet mismatch")) {
    if (pendingCount > 0) {
      return (
        `Your wallet difference is likely from ${pendingCount} pending voucher${pendingCount === 1 ? "" : "s"} worth Rs ${pendingAmount}. ` +
        "Go to History and tap Sync Now when internet is available."
      );
    }
    return "Your wallet is likely already in sync. If you paid recently offline, the difference clears automatically after next sync.";
  }

  if (hasAny("what should i do next", "next step", "what next", "what should i do")) {
    if (failedCount > 0) {
      return (
        `You have ${failedCount} failed voucher${failedCount === 1 ? "" : "s"}. ` +
        "Open History, check failure reason, then re-pay to the correct merchant QR."
      );
    }
    if (pendingCount > 0) {
      return (
        `You have ${pendingCount} pending voucher${pendingCount === 1 ? "" : "s"} worth Rs ${pendingAmount}. ` +
        "Keep internet on and tap Sync Now in History."
      );
    }
    return "No failed or pending vouchers found. Your wallet looks healthy. You can continue making payments normally.";
  }

  if (hasAny("hasn't scanned", "hasnt scanned", "not scanned", "merchant not scanned")) {
    return "Your voucher stays valid until merchant scans it. Keep the voucher QR ready and ask merchant to scan from Receive Payment screen.";
  }

  if (hasAny("sync now", "how to sync", "sync voucher", "sync payment")) {
    return "Open History and tap Sync Now while online. Pending vouchers are uploaded and wallet differences are reconciled.";
  }

  if (hasAny("same voucher", "twice", "double spend", "reused")) {
    return "No, same voucher cannot be used twice. Each voucher has a unique ID and duplicates are rejected during verification.";
  }

  if (hasAny("lost phone", "uninstall", "reinstall", "new phone")) {
    return "Server balance is safe, but unsynced offline vouchers on old device may be lost. Always sync pending vouchers before uninstalling or changing phone.";
  }

  return null;
}

function normalizeAmount(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function parseAmountFromMessage(message: string): number | null {
  const match = message.toLowerCase().match(/(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function categorizeMerchant(name: string): { key: string; label: string } {
  const value = (name || "").toLowerCase();
  const categoryPatterns = [
    { key: "food", label: "Food", patterns: ["canteen", "grocery", "restaurant", "food", "cafe", "tea", "snack", "mess"] },
    { key: "office", label: "Office", patterns: ["xerox", "print", "stationery", "office", "copy", "books"] },
    { key: "health", label: "Health", patterns: ["pharmacy", "medical", "clinic", "hospital", "chemist"] },
    { key: "travel", label: "Travel", patterns: ["bus", "metro", "cab", "auto", "uber", "ola", "fuel"] },
    { key: "shopping", label: "Shopping", patterns: ["store", "mart", "shop", "fashion", "electronics"] },
    { key: "education", label: "Education", patterns: ["college", "campus", "library", "tuition", "course"] },
  ];

  for (const category of categoryPatterns) {
    if (category.patterns.some((pattern) => value.includes(pattern))) {
      return category;
    }
  }
  return { key: "general", label: "General" };
}

function buildSupportFallback(message: string, context: AiClientContext): AiSupportResponse {
  const text = (message || "").trim().toLowerCase();
  const hasAny = (...words: string[]) => words.some((word) => text.includes(word));
  const amountQuery = parseAmountFromMessage(text);
  const transactions = (context.offlineTransactions || []).slice().sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  const matched =
    transactions.find((transaction) => {
      if (amountQuery !== null && Math.abs(normalizeAmount(transaction.amount) - amountQuery) > 0.01) {
        return false;
      }
      const merchant = `${transaction.merchantName || ""} ${transaction.merchantId || ""}`.toLowerCase();
      const words = text.replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length >= 3);
      if (words.length === 0) return true;
      return words.some((word) => merchant.includes(word));
    }) || null;

  const pending = transactions.filter((transaction) => transaction.status === "pending");
  const failed = transactions.filter((transaction) => transaction.status === "failed");
  const latestFailed = failed[0] || null;
  const pendingAmount = pending.reduce((sum, transaction) => sum + normalizeAmount(transaction.amount), 0);
  const onlineBalance = 0;
  const cachedBalance = context.cachedBalance === null ? null : normalizeAmount(context.cachedBalance);
  const balanceGap = cachedBalance === null ? 0 : cachedBalance - onlineBalance;

  if (matched && matched.status === "failed") {
    return {
      reply:
        `Your payment of Rs ${normalizeAmount(matched.amount)} to ${matched.merchantName || matched.merchantId} failed during verification. ` +
        `Voucher ${matched.voucherId} is marked failed. Please retry by scanning the correct merchant QR and syncing again.`,
      suggestions: DEFAULT_PROMPTS,
      usedAi: false,
      matchedTransaction: {
        voucherId: matched.voucherId,
        amount: normalizeAmount(matched.amount),
        merchantName: matched.merchantName || matched.merchantId || "Merchant",
        status: String(matched.status || "failed"),
        failureReason: matched.failureReason,
      },
    };
  }

  const faqReply = buildFaqSupportReply(
    text,
    pending.length,
    pendingAmount,
    failed.length,
    latestFailed
  );
  if (faqReply) {
    return {
      reply: faqReply,
      suggestions: DEFAULT_PROMPTS,
      usedAi: false,
      matchedTransaction: latestFailed
        ? {
            voucherId: latestFailed.voucherId,
            amount: normalizeAmount(latestFailed.amount),
            merchantName: latestFailed.merchantName || latestFailed.merchantId || "Merchant",
            status: String(latestFailed.status || "failed"),
            failureReason: latestFailed.failureReason,
          }
        : null,
    };
  }

  if (text.includes("offline") && (text.includes("how") || text.includes("work"))) {
    return {
      reply:
        "Offline payments create a signed voucher on your phone with amount, merchant ID, and timestamp. " +
        "Your private key signs it using ECDSA secp256k1. The server verifies that signature during sync to prevent tampering and double spend.",
      suggestions: DEFAULT_PROMPTS,
      usedAi: false,
      matchedTransaction: null,
    };
  }

  if (text.includes("balance") || text.includes("wallet")) {
    if (cachedBalance !== null && (pendingAmount > 0 || balanceGap !== 0)) {
      return {
        reply:
          `Your offline cached balance is Rs ${cachedBalance}. ` +
          `You currently have ${pending.length} pending voucher${pending.length === 1 ? "" : "s"} worth Rs ${pendingAmount}. ` +
          "Sync from History when online and the balance will reconcile automatically.",
        suggestions: DEFAULT_PROMPTS,
        usedAi: false,
        matchedTransaction: null,
      };
    }

    return {
      reply: "Your wallet appears in sync locally. If you just paid offline, it will reconcile after the next successful sync.",
      suggestions: DEFAULT_PROMPTS,
      usedAi: false,
      matchedTransaction: null,
    };
  }

  if (matched) {
    return {
      reply:
        `I found voucher ${matched.voucherId} for Rs ${normalizeAmount(matched.amount)} to ${matched.merchantName || matched.merchantId}. ` +
        `Current status: ${matched.status || "pending"}.`,
      suggestions: DEFAULT_PROMPTS,
      usedAi: false,
      matchedTransaction: {
        voucherId: matched.voucherId,
        amount: normalizeAmount(matched.amount),
        merchantName: matched.merchantName || matched.merchantId || "Merchant",
        status: String(matched.status || "pending"),
        failureReason: matched.failureReason,
      },
    };
  }

  if (hasAny("what can you do", "what can u do", "help", "capabilities", "how can you help")) {
    return {
      reply:
        "I can help with failed payments, pending sync, voucher status, and offline wallet mismatch. " +
        "Ask with amount (example: Rs 120) or merchant name for a precise answer.",
      suggestions: DEFAULT_PROMPTS,
      usedAi: false,
      matchedTransaction: null,
    };
  }

  if (text.length <= 3 || hasAny("ok", "okay", "hi", "hello", "hii")) {
    return {
      reply:
        "I am ready to help. Ask one of these: why payment failed, how to sync pending vouchers, or why wallet balance is different.",
      suggestions: DEFAULT_PROMPTS,
      usedAi: false,
      matchedTransaction: null,
    };
  }

  return {
    reply:
      `I could not find an exact transaction match for "${message}". ` +
      "Please include amount (example: Rs 120) or merchant name so I can give a precise answer.",
    suggestions: DEFAULT_PROMPTS,
    usedAi: false,
    matchedTransaction: null,
  };
}

function buildInsightsFallback(context: AiClientContext): SpendingAnalytics {
  const weekStart = startOfWeek(new Date());
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const txns = (context.offlineTransactions || []).filter((transaction) => normalizeAmount(transaction.amount) > 0);
  const thisWeek = txns.filter((transaction) => new Date(transaction.timestamp) >= weekStart);
  const lastWeek = txns.filter((transaction) => {
    const ts = new Date(transaction.timestamp);
    return ts >= lastWeekStart && ts < weekStart;
  });

  const totalSpentWeek = thisWeek.reduce((sum, transaction) => sum + normalizeAmount(transaction.amount), 0);
  const totalSpentLastWeek = lastWeek.reduce((sum, transaction) => sum + normalizeAmount(transaction.amount), 0);
  const weekChangePct =
    totalSpentLastWeek > 0
      ? Number((((totalSpentWeek - totalSpentLastWeek) / totalSpentLastWeek) * 100).toFixed(1))
      : totalSpentWeek > 0
      ? 100
      : 0;

  const categoryMap = new Map<
    string,
    { key: string; label: string; amount: number; count: number; share: number }
  >();
  for (const transaction of thisWeek) {
    const category = categorizeMerchant(transaction.merchantName || transaction.merchantId || "General");
    const current = categoryMap.get(category.key) || { key: category.key, label: category.label, amount: 0, count: 0, share: 0 };
    current.amount += normalizeAmount(transaction.amount);
    current.count += 1;
    categoryMap.set(category.key, current);
  }

  const categories = Array.from(categoryMap.values())
    .sort((a, b) => b.amount - a.amount)
    .map((category) => ({
      ...category,
      share: totalSpentWeek > 0 ? Number(((category.amount / totalSpentWeek) * 100).toFixed(1)) : 0,
    }));

  const biggest = thisWeek.reduce((current, transaction) => {
    if (!current || normalizeAmount(transaction.amount) > normalizeAmount(current.amount)) return transaction;
    return current;
  }, null as AiClientContext["offlineTransactions"][number] | null);

  const pending = txns.filter((transaction) => transaction.status === "pending");
  const pendingAmount = pending.reduce((sum, transaction) => sum + normalizeAmount(transaction.amount), 0);
  const cachedBalance = context.cachedBalance === null ? null : normalizeAmount(context.cachedBalance);
  const onlineBalance = 0;
  const balanceGap = cachedBalance === null ? 0 : cachedBalance - onlineBalance;

  const topCategory = categories[0];
  const narrative = topCategory
    ? `You spent Rs ${totalSpentWeek} this week. ${topCategory.label} is top at ${topCategory.share}% of spend. Biggest payment was Rs ${biggest ? normalizeAmount(biggest.amount) : 0}.`
    : "No spending data for this week yet. Make a payment to unlock analytics.";

  const savingTip = topCategory
    ? `Reducing ${topCategory.label.toLowerCase()} spend by 20% could save around Rs ${Math.round(topCategory.amount * 0.2)} next week.`
    : "Keep using NONETPAY this week to unlock category-based savings suggestions.";

  return {
    totalSpentWeek,
    totalSpentLastWeek,
    weekChangePct,
    pendingAmount,
    pendingCount: pending.length,
    onlineBalance,
    cachedBalance,
    balanceGap,
    biggestPayment: biggest
      ? {
          amount: normalizeAmount(biggest.amount),
          merchantName: biggest.merchantName || biggest.merchantId || "Merchant",
          timestamp: biggest.timestamp,
        }
      : null,
    categories,
    narrative,
    savingTip,
  };
}

async function fetchCoreTransactions(token: string): Promise<
  Array<{ amount: number; timestamp: string; merchantName?: string; merchantId?: string; type?: string; status?: string }>
> {
  const response = await fetch(`${API_BASE_URL}/api/transactions/user`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) return [];
  const parsed = await parseJsonResponse(response);
  if (!parsed.ok || !Array.isArray(parsed.json?.transactions)) return [];
  return parsed.json.transactions;
}

async function fetchOnlineBalance(token: string): Promise<number | null> {
  const response = await fetch(`${API_BASE_URL}/api/balance`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) return null;
  const parsed = await parseJsonResponse(response);
  if (!parsed.ok) return null;
  const value = Number(parsed.json?.balance);
  return Number.isFinite(value) ? value : null;
}

function buildInsightsFromServerAndLocal(
  context: AiClientContext,
  serverTransactions: Array<{ amount: number; timestamp: string; merchantName?: string; merchantId?: string; type?: string; status?: string }>,
  onlineBalance: number | null
): SpendingAnalytics {
  const weekStart = startOfWeek(new Date());
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const allDebits = serverTransactions.filter((transaction) => transaction.type === "debit");
  const thisWeek = allDebits.filter((transaction) => new Date(transaction.timestamp) >= weekStart);
  const lastWeek = allDebits.filter((transaction) => {
    const ts = new Date(transaction.timestamp);
    return ts >= lastWeekStart && ts < weekStart;
  });

  const totalSpentWeek = thisWeek.reduce((sum, transaction) => sum + normalizeAmount(transaction.amount), 0);
  const totalSpentLastWeek = lastWeek.reduce((sum, transaction) => sum + normalizeAmount(transaction.amount), 0);
  const weekChangePct =
    totalSpentLastWeek > 0
      ? Number((((totalSpentWeek - totalSpentLastWeek) / totalSpentLastWeek) * 100).toFixed(1))
      : totalSpentWeek > 0
      ? 100
      : 0;

  const categoryMap = new Map<
    string,
    { key: string; label: string; amount: number; count: number; share: number }
  >();
  for (const transaction of thisWeek) {
    const category = categorizeMerchant(transaction.merchantName || transaction.merchantId || "General");
    const current = categoryMap.get(category.key) || { key: category.key, label: category.label, amount: 0, count: 0, share: 0 };
    current.amount += normalizeAmount(transaction.amount);
    current.count += 1;
    categoryMap.set(category.key, current);
  }

  const categories = Array.from(categoryMap.values())
    .sort((a, b) => b.amount - a.amount)
    .map((category) => ({
      ...category,
      share: totalSpentWeek > 0 ? Number(((category.amount / totalSpentWeek) * 100).toFixed(1)) : 0,
    }));

  const biggest = thisWeek.reduce((current, transaction) => {
    if (!current || normalizeAmount(transaction.amount) > normalizeAmount(current.amount)) return transaction;
    return current;
  }, null as (typeof thisWeek)[number] | null);

  const pending = (context.offlineTransactions || []).filter((transaction) => transaction.status === "pending");
  const pendingAmount = pending.reduce((sum, transaction) => sum + normalizeAmount(transaction.amount), 0);
  const cachedBalance = context.cachedBalance === null ? null : normalizeAmount(context.cachedBalance);
  const online = onlineBalance === null ? 0 : normalizeAmount(onlineBalance);
  const balanceGap = cachedBalance === null ? 0 : cachedBalance - online;

  const topCategory = categories[0];
  const narrative = topCategory
    ? `You spent Rs ${totalSpentWeek} this week. ${topCategory.label} is top at ${topCategory.share}% of spend. Biggest payment was Rs ${biggest ? normalizeAmount(biggest.amount) : 0}.`
    : "No spending data for this week yet. Make a payment to unlock analytics.";

  const savingTip = topCategory
    ? `Reducing ${topCategory.label.toLowerCase()} spend by 20% could save around Rs ${Math.round(topCategory.amount * 0.2)} next week.`
    : "Keep using NONETPAY this week to unlock category-based savings suggestions.";

  return {
    totalSpentWeek,
    totalSpentLastWeek,
    weekChangePct,
    pendingAmount,
    pendingCount: pending.length,
    onlineBalance: online,
    cachedBalance,
    balanceGap,
    biggestPayment: biggest
      ? {
          amount: normalizeAmount(biggest.amount),
          merchantName: biggest.merchantName || biggest.merchantId || "Merchant",
          timestamp: biggest.timestamp,
        }
      : null,
    categories,
    narrative,
    savingTip,
  };
}

async function parseJsonResponse(response: Response): Promise<{ ok: boolean; json: any; raw: string }> {
  const raw = await response.text();
  try {
    const json = raw ? JSON.parse(raw) : {};
    return { ok: true, json, raw };
  } catch {
    return { ok: false, json: null, raw };
  }
}

function parseErrorMessage(response: Response, parsed: { ok: boolean; json: any; raw: string }, fallback: string): string {
  if (parsed.ok && parsed.json && typeof parsed.json.error === "string") {
    return parsed.json.error;
  }
  if (parsed.raw.trim().startsWith("<")) {
    return "Server returned HTML instead of JSON. Please check backend URL or AI route deployment.";
  }
  return `${fallback} (${response.status})`;
}

type MerchantLocalVoucher = {
  voucherId: string;
  amount: number;
  createdAt: string;
  issuedTo?: string;
  status?: string;
  syncError?: string | null;
};

type MerchantTransactionLike = {
  id: string;
  amount: number;
  payerName: string;
  timestamp: string;
  status: string;
  voucherId: string;
  failureReason?: string;
};

async function getMerchantLocalVouchers(): Promise<MerchantLocalVoucher[]> {
  const raw = await AsyncStorage.getItem("@offline_vouchers");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapMerchantLocalTransactions(vouchers: MerchantLocalVoucher[]): MerchantTransactionLike[] {
  return vouchers
    .filter((voucher) => voucher && normalizeAmount(voucher.amount) > 0)
    .map((voucher) => {
      const status =
        voucher.status === "offline" ? "pending" : voucher.status === "synced" ? "synced" : String(voucher.status || "pending");
      return {
        id: String(voucher.voucherId || `${voucher.createdAt}-${voucher.amount}`),
        voucherId: String(voucher.voucherId || `${voucher.createdAt}-${voucher.amount}`),
        amount: normalizeAmount(voucher.amount),
        timestamp: voucher.createdAt || new Date().toISOString(),
        payerName: voucher.issuedTo ? `User ...${String(voucher.issuedTo).slice(-6)}` : "Customer",
        status,
        failureReason: voucher.syncError || undefined,
      };
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function buildMerchantSupportFallback(message: string, transactions: MerchantTransactionLike[]): AiSupportResponse {
  const text = (message || "").trim().toLowerCase();
  const amountQuery = parseAmountFromMessage(text);
  const words = text
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3);

  const matched =
    transactions.find((transaction) => {
      if (amountQuery !== null && Math.abs(normalizeAmount(transaction.amount) - amountQuery) > 0.01) {
        return false;
      }
      if (words.length === 0) return amountQuery !== null;
      const haystack = `${transaction.payerName} ${transaction.voucherId}`.toLowerCase();
      return words.some((word) => haystack.includes(word));
    }) || null;

  const pending = transactions.filter((transaction) => transaction.status === "pending");
  const failed = transactions.filter((transaction) => transaction.status === "failed");
  const pendingAmount = pending.reduce((sum, transaction) => sum + normalizeAmount(transaction.amount), 0);
  const failedAmount = failed.reduce((sum, transaction) => sum + normalizeAmount(transaction.amount), 0);
  const weekStart = startOfWeek(new Date());
  const thisWeek = transactions.filter((transaction) => new Date(transaction.timestamp) >= weekStart);
  const receivedWeek = thisWeek.reduce((sum, transaction) => sum + normalizeAmount(transaction.amount), 0);

  if (matched && matched.status === "failed") {
    return {
      reply:
        `Voucher ${matched.voucherId} for Rs ${normalizeAmount(matched.amount)} from ${matched.payerName} failed verification. ` +
        `Reason: ${matched.failureReason || "server validation failed"}. Check voucher details and ask customer to regenerate if needed.`,
      suggestions: MERCHANT_DEFAULT_PROMPTS,
      usedAi: false,
      matchedTransaction: {
        voucherId: matched.voucherId,
        amount: normalizeAmount(matched.amount),
        merchantName: matched.payerName,
        status: "failed",
        failureReason: matched.failureReason,
      },
    };
  }

  if (text.includes("pending") || text.includes("sync")) {
    return {
      reply:
        pending.length > 0
          ? `You have ${pending.length} pending voucher${pending.length === 1 ? "" : "s"} worth Rs ${pendingAmount}. Open History and tap Sync Now while online.`
          : "No pending vouchers right now. Merchant vouchers are synced.",
      suggestions: MERCHANT_DEFAULT_PROMPTS,
      usedAi: false,
      matchedTransaction: null,
    };
  }

  if (text.includes("failed") || text.includes("reject")) {
    return {
      reply:
        failed.length > 0
          ? `You have ${failed.length} failed voucher${failed.length === 1 ? "" : "s"} worth Rs ${failedAmount}. Open History and inspect failure reasons before retry.`
          : "No failed vouchers found in your recent merchant history.",
      suggestions: MERCHANT_DEFAULT_PROMPTS,
      usedAi: false,
      matchedTransaction: null,
    };
  }

  if (text.includes("week") || text.includes("today") || text.includes("received") || text.includes("sales")) {
    return {
      reply:
        `This week you received Rs ${receivedWeek} across ${thisWeek.length} payment${thisWeek.length === 1 ? "" : "s"}. ` +
        `Pending: ${pending.length}, failed: ${failed.length}.`,
      suggestions: MERCHANT_DEFAULT_PROMPTS,
      usedAi: false,
      matchedTransaction: null,
    };
  }

  if (matched) {
    return {
      reply:
        `I found voucher ${matched.voucherId} for Rs ${normalizeAmount(matched.amount)} from ${matched.payerName}. ` +
        `Current status: ${matched.status}.`,
      suggestions: MERCHANT_DEFAULT_PROMPTS,
      usedAi: false,
      matchedTransaction: {
        voucherId: matched.voucherId,
        amount: normalizeAmount(matched.amount),
        merchantName: matched.payerName,
        status: matched.status,
        failureReason: matched.failureReason,
      },
    };
  }

  return {
    reply:
      "I can help with failed vouchers, pending sync, received amount summary, and voucher status lookup by amount or payer.",
    suggestions: MERCHANT_DEFAULT_PROMPTS,
    usedAi: false,
    matchedTransaction: null,
  };
}

function buildMerchantInsightsFallback(transactions: MerchantTransactionLike[]): MerchantInsights {
  const weekStart = startOfWeek(new Date());
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const thisWeek = transactions.filter((transaction) => new Date(transaction.timestamp) >= weekStart);
  const lastWeek = transactions.filter((transaction) => {
    const ts = new Date(transaction.timestamp);
    return ts >= lastWeekStart && ts < weekStart;
  });

  const totalReceivedWeek = thisWeek.reduce((sum, transaction) => sum + normalizeAmount(transaction.amount), 0);
  const totalReceivedLastWeek = lastWeek.reduce((sum, transaction) => sum + normalizeAmount(transaction.amount), 0);
  const weekChangePct =
    totalReceivedLastWeek > 0
      ? Number((((totalReceivedWeek - totalReceivedLastWeek) / totalReceivedLastWeek) * 100).toFixed(1))
      : totalReceivedWeek > 0
      ? 100
      : 0;

  const pending = thisWeek.filter((transaction) => transaction.status === "pending");
  const failed = thisWeek.filter((transaction) => transaction.status === "failed");
  const pendingAmount = pending.reduce((sum, transaction) => sum + normalizeAmount(transaction.amount), 0);
  const failedAmount = failed.reduce((sum, transaction) => sum + normalizeAmount(transaction.amount), 0);

  const payerMap = new Map<string, { name: string; amount: number; count: number }>();
  for (const transaction of thisWeek) {
    const key = transaction.payerName || "Customer";
    const current = payerMap.get(key) || { name: key, amount: 0, count: 0 };
    current.amount += normalizeAmount(transaction.amount);
    current.count += 1;
    payerMap.set(key, current);
  }
  const topPayer = Array.from(payerMap.values()).sort((a, b) => b.amount - a.amount)[0] || null;

  const statusMap = new Map<string, { key: string; label: string; count: number; amount: number; share: number }>();
  for (const transaction of thisWeek) {
    const key = String(transaction.status || "synced");
    const current = statusMap.get(key) || { key, label: key.toUpperCase(), count: 0, amount: 0, share: 0 };
    current.count += 1;
    current.amount += normalizeAmount(transaction.amount);
    statusMap.set(key, current);
  }
  const statusBreakdown = Array.from(statusMap.values())
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      ...item,
      share: totalReceivedWeek > 0 ? Number(((item.amount / totalReceivedWeek) * 100).toFixed(1)) : 0,
    }));

  const actionTip =
    failed.length > 0
      ? "Review failed vouchers first and ask customers to regenerate invalid vouchers."
      : pending.length > 0
      ? "Keep internet on and sync pending vouchers to settle merchant balance faster."
      : "Merchant sync is healthy. Keep checking history at closing time for clean settlement.";

  const trendText =
    weekChangePct > 0 ? `up ${weekChangePct}%` : weekChangePct < 0 ? `down ${Math.abs(weekChangePct)}%` : "flat";
  const narrative =
    `You received Rs ${totalReceivedWeek} this week (${trendText} vs last week). ` +
    `Processed ${thisWeek.length} payment${thisWeek.length === 1 ? "" : "s"}, pending ${pending.length}, failed ${failed.length}.`;

  return {
    totalReceivedWeek,
    totalReceivedLastWeek,
    weekChangePct,
    totalTransactionsWeek: thisWeek.length,
    pendingCount: pending.length,
    pendingAmount,
    failedCount: failed.length,
    failedAmount,
    topPayer,
    statusBreakdown,
    actionTip,
    narrative,
  };
}

async function fetchCoreMerchantTransactions(token: string): Promise<MerchantTransactionLike[]> {
  const response = await fetch(`${API_BASE_URL}/api/transactions/merchant`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) return [];
  const parsed = await parseJsonResponse(response);
  if (!parsed.ok || !Array.isArray(parsed.json?.transactions)) return [];

  return parsed.json.transactions
    .map((transaction: any) => ({
      id: String(transaction.id || transaction.voucherId || `${transaction.timestamp}-${transaction.amount}`),
      voucherId: String(transaction.voucherId || transaction.id || `${transaction.timestamp}-${transaction.amount}`),
      amount: normalizeAmount(transaction.amount),
      payerName: String(transaction.payerName || transaction.payerId || "Customer"),
      timestamp: transaction.timestamp || new Date().toISOString(),
      status: String(transaction.status || "synced"),
      failureReason: transaction.failureReason || undefined,
    }))
    .sort((a: MerchantTransactionLike, b: MerchantTransactionLike) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
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
  const clientContext = await buildAiClientContext();
  const token = await AsyncStorage.getItem("@auth_token");

  if (!token) {
    return buildSupportFallback(message, clientContext);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/support`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, clientContext }),
    });

    const parsed = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(parseErrorMessage(response, parsed, "Could not get support reply"));
    }

    if (!parsed.ok || !parsed.json?.reply) {
      throw new Error("Invalid AI support response");
    }

    const data = parsed.json;
    return {
      reply: data.reply,
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : DEFAULT_PROMPTS,
      usedAi: Boolean(data.usedAi),
      matchedTransaction: data.matchedTransaction || null,
    };
  } catch {
    return buildSupportFallback(message, clientContext);
  }
}

export async function fetchSpendingInsights(): Promise<SpendingAnalytics> {
  const clientContext = await buildAiClientContext();
  const token = await AsyncStorage.getItem("@auth_token");

  if (!token) {
    return buildInsightsFallback(clientContext);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/insights`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ clientContext }),
    });

    const parsed = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(parseErrorMessage(response, parsed, "Could not load spending insights"));
    }

    if (!parsed.ok || !parsed.json?.analytics) {
      throw new Error("Invalid AI insights response");
    }

    return parsed.json.analytics as SpendingAnalytics;
  } catch {
    try {
      const [transactions, onlineBalance] = await Promise.all([
        fetchCoreTransactions(token),
        fetchOnlineBalance(token),
      ]);
      if (transactions.length > 0 || onlineBalance !== null) {
        return buildInsightsFromServerAndLocal(clientContext, transactions, onlineBalance);
      }
    } catch {
      // Fallback to local-only analytics below.
    }
    return buildInsightsFallback(clientContext);
  }
}

export async function fetchMerchantSupportReply(message: string): Promise<AiSupportResponse> {
  const vouchers = await getMerchantLocalVouchers();
  const localTransactions = mapMerchantLocalTransactions(vouchers);
  const token = await AsyncStorage.getItem("@auth_token");

  if (!token) {
    return buildMerchantSupportFallback(message, localTransactions);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/merchant/support`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });

    const parsed = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(parseErrorMessage(response, parsed, "Could not get merchant support reply"));
    }

    if (!parsed.ok || !parsed.json?.reply) {
      throw new Error("Invalid merchant AI support response");
    }

    const data = parsed.json;
    return {
      reply: data.reply,
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : MERCHANT_DEFAULT_PROMPTS,
      usedAi: Boolean(data.usedAi),
      matchedTransaction: data.matchedTransaction || null,
    };
  } catch {
    return buildMerchantSupportFallback(message, localTransactions);
  }
}

export async function fetchMerchantInsights(): Promise<MerchantInsights> {
  const vouchers = await getMerchantLocalVouchers();
  const localTransactions = mapMerchantLocalTransactions(vouchers);
  const token = await AsyncStorage.getItem("@auth_token");

  if (!token) {
    return buildMerchantInsightsFallback(localTransactions);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/merchant/insights`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const parsed = await parseJsonResponse(response);
    if (!response.ok) {
      throw new Error(parseErrorMessage(response, parsed, "Could not load merchant insights"));
    }

    if (!parsed.ok || !parsed.json?.analytics) {
      throw new Error("Invalid merchant AI insights response");
    }

    return parsed.json.analytics as MerchantInsights;
  } catch {
    try {
      const serverTransactions = await fetchCoreMerchantTransactions(token);
      if (serverTransactions.length > 0) {
        return buildMerchantInsightsFallback(serverTransactions);
      }
    } catch {
      // Fallback to local analytics below.
    }
    return buildMerchantInsightsFallback(localTransactions);
  }
}
