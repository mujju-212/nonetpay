import express from "express";
import { getDB } from "../db/index.js";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

const HF_API_KEY = process.env.HF_API_KEY || "";
const HF_MODEL = process.env.HF_MODEL || "meta-llama/Llama-3.1-8B-Instruct";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const SUPPORT_SUGGESTIONS = [
  "Why was my payment rejected?",
  "How do offline payments work?",
  "Why is my offline balance different?",
  "What should I do next?",
];

const CATEGORY_PATTERNS = [
  { key: "food", label: "Food", patterns: ["canteen", "grocery", "restaurant", "food", "cafe", "tea", "snack", "mess", "kitchen"] },
  { key: "office", label: "Office", patterns: ["xerox", "print", "stationery", "office", "copy", "books", "notebook"] },
  { key: "health", label: "Health", patterns: ["pharmacy", "medical", "clinic", "hospital", "chemist", "health"] },
  { key: "travel", label: "Travel", patterns: ["bus", "metro", "cab", "auto", "uber", "ola", "fuel", "petrol"] },
  { key: "shopping", label: "Shopping", patterns: ["store", "mart", "shop", "fashion", "cloth", "electronics", "mobile"] },
  { key: "education", label: "Education", patterns: ["college", "campus", "library", "lab", "tuition", "course"] },
];

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAmount(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function categorizeMerchant(name) {
  const value = sanitizeText(name).toLowerCase();
  for (const category of CATEGORY_PATTERNS) {
    if (category.patterns.some((pattern) => value.includes(pattern))) {
      return category;
    }
  }
  return { key: "general", label: "General" };
}

function describeFailureReason(reason) {
  const map = {
    "Wrong merchantId": "the scanned merchant QR did not match the voucher merchant ID",
    "Voucher expired": "the voucher expired before it was redeemed",
    "Insufficient balance": "your online wallet balance was not enough at sync time",
    "Bad signature": "the voucher signature could not be verified",
    "Duplicate voucherId": "the voucher had already been processed",
    "Missing public key": "the public key needed for verification was missing",
    "Invalid format": "the voucher data was incomplete",
  };

  return map[reason] || "the payment could not be verified by the server";
}

function buildServerTransactions(user, serverVouchers, clientContext) {
  const generatedById = new Map(
    (clientContext.generatedVouchers || []).map((voucher) => [voucher.voucherId, voucher])
  );
  const merchantNameById = new Map();

  for (const voucher of clientContext.generatedVouchers || []) {
    if (voucher.merchantId && voucher.merchantName) {
      merchantNameById.set(voucher.merchantId, voucher.merchantName);
    }
  }

  const history = Array.isArray(user.balanceHistory) ? user.balanceHistory : [];
  const transactions = [];

  for (const item of history) {
    if (item.type === "add") {
      transactions.push({
        id: `bal_${item.timestamp}`,
        type: "credit",
        category: "wallet_load",
        amount: normalizeAmount(item.amount),
        description: "Added to wallet",
        timestamp: item.timestamp,
        balance: normalizeAmount(item.newBalance),
        source: "server",
      });
    } else if (item.type === "refund") {
      transactions.push({
        id: `refund_${item.voucherId || item.timestamp}`,
        type: "credit",
        category: "voucher_refund",
        amount: normalizeAmount(item.amount),
        description: "Voucher expired - refund",
        timestamp: item.timestamp,
        balance: normalizeAmount(item.newBalance),
        voucherId: item.voucherId || null,
        source: "server",
      });
    }
  }

  for (const voucher of serverVouchers) {
    const localVoucher = generatedById.get(voucher.voucherId);
    const merchantName =
      sanitizeText(voucher.merchantName) ||
      sanitizeText(localVoucher && localVoucher.merchantName) ||
      sanitizeText(merchantNameById.get(voucher.merchantId)) ||
      sanitizeText(voucher.merchantId);

    transactions.push({
      id: voucher.voucherId,
      type: "debit",
      category: "payment",
      amount: normalizeAmount(voucher.amount),
      description: `Paid to ${merchantName}`,
      merchantId: voucher.merchantId,
      merchantName,
      timestamp: voucher.createdAt || voucher.syncedAt || new Date().toISOString(),
      status: voucher.status || "synced",
      voucherId: voucher.voucherId,
      source: "server",
    });
  }

  const serverIds = new Set(transactions.map((transaction) => transaction.id));

  for (const localTx of clientContext.offlineTransactions || []) {
    if (serverIds.has(localTx.voucherId) || localTx.status === "synced") {
      continue;
    }

    const localVoucher = generatedById.get(localTx.voucherId);
    const merchantName =
      sanitizeText(localTx.merchantName) ||
      sanitizeText(localVoucher && localVoucher.merchantName) ||
      sanitizeText(localTx.merchantId);

    transactions.push({
      id: localTx.voucherId,
      type: "debit",
      category: "payment",
      amount: normalizeAmount(localTx.amount),
      description: `Paid to ${merchantName}`,
      merchantId: localTx.merchantId,
      merchantName,
      timestamp: localTx.timestamp,
      status: localTx.status || "pending",
      voucherId: localTx.voucherId,
      failureReason: localTx.failureReason,
      source: "local",
    });
  }

  transactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return transactions;
}

function findRelevantTransaction(message, transactions) {
  const text = sanitizeText(message).toLowerCase();
  const amountMatch = text.match(/(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)/i);
  const amount = amountMatch ? Number(amountMatch[1]) : null;

  const words = text
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3);

  for (const transaction of transactions) {
    const merchantHaystack = `${transaction.merchantName || ""} ${transaction.description || ""} ${transaction.merchantId || ""}`.toLowerCase();
    const merchantMatched = words.some((word) => merchantHaystack.includes(word));
    const amountMatched = amount === null || Math.abs(transaction.amount - amount) < 0.01;

    if (merchantMatched && amountMatched) {
      return transaction;
    }
  }

  if (amount !== null) {
    return transactions.find((transaction) => Math.abs(transaction.amount - amount) < 0.01) || null;
  }

  return null;
}

function buildBalanceGapSummary(user, clientContext) {
  const onlineBalance = normalizeAmount(user.balance);
  const cachedBalance =
    clientContext.cachedBalance === null || clientContext.cachedBalance === undefined
      ? null
      : normalizeAmount(clientContext.cachedBalance);
  const pendingTransactions = (clientContext.offlineTransactions || []).filter(
    (transaction) => transaction.status === "pending"
  );
  const pendingAmount = pendingTransactions.reduce(
    (sum, transaction) => sum + normalizeAmount(transaction.amount),
    0
  );

  return {
    onlineBalance,
    cachedBalance,
    pendingAmount,
    pendingCount: pendingTransactions.length,
    balanceGap: cachedBalance === null ? 0 : cachedBalance - onlineBalance,
  };
}

function buildSupportFallback(message, user, transactions, clientContext) {
  const text = sanitizeText(message).toLowerCase();
  const relevant = findRelevantTransaction(message, transactions);
  const gap = buildBalanceGapSummary(user, clientContext);

  if (relevant && relevant.status === "failed") {
    const merchantName = relevant.merchantName || relevant.merchantId || "that merchant";
    const reasonText = describeFailureReason(relevant.failureReason || "");
    return {
      reply:
        `Your payment of Rs ${relevant.amount} to ${merchantName} was rejected because ${reasonText}. ` +
        `Voucher ID: ${relevant.voucherId || relevant.id}. ` +
        "Check the merchant QR and sync again after correcting the issue.",
      matchedTransaction: {
        voucherId: relevant.voucherId || relevant.id,
        amount: relevant.amount,
        merchantName,
        status: String(relevant.status || "failed"),
        failureReason: relevant.failureReason,
      },
    };
  }

  if (text.includes("offline") && text.includes("how")) {
    return {
      reply:
        "Offline payments work by creating a signed voucher on your phone. " +
        "The voucher includes the merchant ID, amount, time, and your user ID, then your device signs it with ECDSA secp256k1. " +
        "The merchant can scan it offline, and the server verifies the signature when either side comes online.",
      matchedTransaction: null,
    };
  }

  if (text.includes("balance") || text.includes("wallet")) {
    if (gap.cachedBalance !== null && gap.balanceGap !== 0) {
      return {
        reply:
          `Your online balance is Rs ${gap.onlineBalance}, while your cached offline balance is Rs ${gap.cachedBalance}. ` +
          `The difference is Rs ${Math.abs(gap.balanceGap)} and usually comes from ${gap.pendingCount} pending voucher` +
          `${gap.pendingCount === 1 ? "" : "s"} worth Rs ${gap.pendingAmount}. ` +
          "Open History and tap Sync Now when you are connected.",
        matchedTransaction: null,
      };
    }

    return {
      reply:
        `Your wallet looks in sync right now. Online balance: Rs ${gap.onlineBalance}. ` +
        "If it changes after an offline payment, the difference will clear automatically when vouchers sync.",
      matchedTransaction: null,
    };
  }

  if (relevant) {
    const merchantName = relevant.merchantName || relevant.merchantId || "the merchant";
    const statusText =
      relevant.status === "failed"
        ? "failed verification"
        : relevant.status === "pending"
        ? "is still pending sync"
        : "has been backed up and is ready for merchant redemption";

    return {
      reply:
        `I found your payment of Rs ${relevant.amount} to ${merchantName}. ` +
        `Its current status is: ${statusText}. ` +
        `Voucher ID: ${relevant.voucherId || relevant.id}.`,
      matchedTransaction: {
        voucherId: relevant.voucherId || relevant.id,
        amount: relevant.amount,
        merchantName,
        status: String(relevant.status || "synced"),
        failureReason: relevant.failureReason,
      },
    };
  }

  return {
    reply:
      "I can help with offline payment issues, sync delays, voucher status, and wallet balance differences. " +
      "Ask about a payment amount, a merchant name, or why a balance changed, and I will check your transaction context.",
    matchedTransaction: null,
  };
}

function buildSpendingAnalytics(user, transactions, clientContext) {
  const weekStart = startOfWeek(new Date());
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const debitTransactions = transactions.filter((transaction) => transaction.type === "debit");
  const thisWeek = debitTransactions.filter((transaction) => {
    const ts = new Date(transaction.timestamp);
    return ts >= weekStart;
  });
  const lastWeek = debitTransactions.filter((transaction) => {
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

  const categoryMap = new Map();
  for (const transaction of thisWeek) {
    const category = categorizeMerchant(transaction.merchantName || transaction.description);
    const current = categoryMap.get(category.key) || {
      key: category.key,
      label: category.label,
      amount: 0,
      count: 0,
      share: 0,
    };
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

  const biggestPaymentTx = thisWeek.reduce((current, transaction) => {
    if (!current || normalizeAmount(transaction.amount) > normalizeAmount(current.amount)) {
      return transaction;
    }
    return current;
  }, null);

  const pendingTransactions = (clientContext.offlineTransactions || []).filter(
    (transaction) => transaction.status === "pending"
  );
  const pendingAmount = pendingTransactions.reduce(
    (sum, transaction) => sum + normalizeAmount(transaction.amount),
    0
  );
  const cachedBalance =
    clientContext.cachedBalance === null || clientContext.cachedBalance === undefined
      ? null
      : normalizeAmount(clientContext.cachedBalance);
  const onlineBalance = normalizeAmount(user.balance);
  const balanceGap = cachedBalance === null ? 0 : cachedBalance - onlineBalance;

  const topCategory = categories[0];
  const savingTip =
    topCategory && topCategory.amount > 0
      ? `Reducing ${topCategory.label.toLowerCase()} spend by 20% could save about Rs ${Math.round(topCategory.amount * 0.2)} next week.`
      : "Your spending is light this week. Keep using the app to unlock trend-based suggestions.";

  return {
    totalSpentWeek,
    totalSpentLastWeek,
    weekChangePct,
    pendingAmount,
    pendingCount: pendingTransactions.length,
    onlineBalance,
    cachedBalance,
    balanceGap,
    biggestPayment: biggestPaymentTx
      ? {
          amount: normalizeAmount(biggestPaymentTx.amount),
          merchantName: biggestPaymentTx.merchantName || biggestPaymentTx.merchantId || "Merchant",
          timestamp: biggestPaymentTx.timestamp,
        }
      : null,
    categories,
    topCategoryLabel: topCategory ? topCategory.label : "General",
    savingTip,
  };
}

function buildAnalyticsFallbackNarrative(analytics) {
  const trendText =
    analytics.weekChangePct > 0
      ? `up ${analytics.weekChangePct}% from last week`
      : analytics.weekChangePct < 0
      ? `down ${Math.abs(analytics.weekChangePct)}% from last week`
      : "the same as last week";
  const categoryText = analytics.categories[0]
    ? `${analytics.categories[0].label} is your top category at ${analytics.categories[0].share}% of this week's spending.`
    : "You have not made any debits this week yet.";
  const pendingText =
    analytics.pendingCount > 0
      ? ` You also have ${analytics.pendingCount} pending payment${analytics.pendingCount === 1 ? "" : "s"} worth Rs ${analytics.pendingAmount} waiting to sync.`
      : "";

  return `You spent Rs ${analytics.totalSpentWeek} this week, ${trendText}. ${categoryText}${pendingText}`;
}

async function generateHuggingFaceText(prompt) {
  if (!HF_API_KEY) {
    throw new Error("Missing Hugging Face API key");
  }

  const response = await fetch(`https://api-inference.huggingface.co/models/${HF_MODEL}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HF_API_KEY}`,
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 280,
        temperature: 0.4,
        top_p: 0.9,
        return_full_text: false,
      },
      options: {
        wait_for_model: true,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Hugging Face request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  if (Array.isArray(data) && data[0]?.generated_text) {
    const text = String(data[0].generated_text).trim();
    if (text) return text;
  }

  if (typeof data?.generated_text === "string" && data.generated_text.trim()) {
    return data.generated_text.trim();
  }

  throw new Error("Hugging Face returned an empty response");
}

async function generateGeminiText(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("Missing Gemini API key");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          topP: 0.9,
          maxOutputTokens: 300,
        },
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text;
}

async function generateLlmText(prompt) {
  if (HF_API_KEY) {
    return generateHuggingFaceText(prompt);
  }

  if (GEMINI_API_KEY) {
    return generateGeminiText(prompt);
  }

  throw new Error("No AI provider configured");
}

router.post("/ai/support", authMiddleware, async (req, res) => {
  try {
    const message = sanitizeText(req.body?.message);
    const clientContext = req.body?.clientContext || {};
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const db = getDB();
    const user = await db.collection("users").findOne({ userId: req.user.userId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const serverVouchers = await db
      .collection("vouchers")
      .find({ issuedTo: user.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    const transactions = buildServerTransactions(user, serverVouchers, clientContext);
    const fallback = buildSupportFallback(message, user, transactions, clientContext);
    const balanceGap = buildBalanceGapSummary(user, clientContext);

    let reply = fallback.reply;
    let usedAi = false;

    try {
      const recentTransactions = transactions.slice(0, 12).map((transaction) => ({
        amount: transaction.amount,
        merchantName: transaction.merchantName || transaction.merchantId || transaction.description,
        timestamp: transaction.timestamp,
        status: transaction.status || "synced",
        voucherId: transaction.voucherId || transaction.id,
        failureReason: transaction.failureReason || null,
      }));

      const prompt =
        "You are the Offline Pay in-app support assistant. " +
        "Answer in 3 short sentences max, be specific, calm, and actionable. " +
        "Never invent data outside the provided context.\n\n" +
        `User name: ${user.name || "Customer"}\n` +
        `Online balance: Rs ${balanceGap.onlineBalance}\n` +
        `Cached offline balance: ${balanceGap.cachedBalance === null ? "unknown" : `Rs ${balanceGap.cachedBalance}`}\n` +
        `Pending offline amount: Rs ${balanceGap.pendingAmount}\n` +
        `Recent transactions: ${JSON.stringify(recentTransactions)}\n` +
        `Fallback answer: ${fallback.reply}\n` +
        `User question: ${message}\n\n` +
        "Respond with plain text only.";

      reply = await generateLlmText(prompt);
      usedAi = true;
    } catch (error) {
      console.log("AI support fallback:", error.message);
    }

    return res.json({
      success: true,
      reply,
      suggestions: SUPPORT_SUGGESTIONS,
      usedAi,
      matchedTransaction: fallback.matchedTransaction || null,
    });
  } catch (error) {
    console.error("AI support error:", error);
    return res.status(500).json({ error: "Failed to generate support response" });
  }
});

router.post("/ai/insights", authMiddleware, async (req, res) => {
  try {
    const clientContext = req.body?.clientContext || {};

    const db = getDB();
    const user = await db.collection("users").findOne({ userId: req.user.userId });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const serverVouchers = await db
      .collection("vouchers")
      .find({ issuedTo: user.userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    const transactions = buildServerTransactions(user, serverVouchers, clientContext);
    const analytics = buildSpendingAnalytics(user, transactions, clientContext);

    let narrative = buildAnalyticsFallbackNarrative(analytics);
    let usedAi = false;

    try {
      const prompt =
        "You are a fintech spending coach for the Offline Pay app. " +
        "Write exactly 3 concise lines. " +
        "Line 1: weekly summary. " +
        "Line 2: top category and biggest payment. " +
        "Line 3: one savings tip. " +
        "Use plain text only.\n\n" +
        `Analytics: ${JSON.stringify(analytics)}\n`;

      narrative = await generateLlmText(prompt);
      usedAi = true;
    } catch (error) {
      console.log("AI insights fallback:", error.message);
    }

    return res.json({
      success: true,
      analytics: {
        totalSpentWeek: analytics.totalSpentWeek,
        totalSpentLastWeek: analytics.totalSpentLastWeek,
        weekChangePct: analytics.weekChangePct,
        pendingAmount: analytics.pendingAmount,
        pendingCount: analytics.pendingCount,
        onlineBalance: analytics.onlineBalance,
        cachedBalance: analytics.cachedBalance,
        balanceGap: analytics.balanceGap,
        biggestPayment: analytics.biggestPayment,
        categories: analytics.categories,
        narrative,
        savingTip: analytics.savingTip,
      },
      usedAi,
    });
  } catch (error) {
    console.error("AI insights error:", error);
    return res.status(500).json({ error: "Failed to generate insights" });
  }
});

export default router;
