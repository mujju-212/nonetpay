import type { GeneratedVoucher, OfflineTransaction } from "../lib/api";

export type UserTransaction = {
  id: string;
  type: "credit" | "debit";
  category: string;
  amount: number;
  description: string;
  timestamp: string;
  status?: "pending" | "synced" | "failed" | string;
  balance?: number;
  payerName?: string;
  merchantId?: string;
  merchantName?: string;
  voucherId?: string | null;
  failureReason?: string;
  voucherData?: GeneratedVoucher;
  source?: "server" | "local";
};

export type AiClientContext = {
  cachedBalance: number | null;
  offlineTransactions: OfflineTransaction[];
  generatedVouchers: GeneratedVoucher[];
};

export type AiSupportResponse = {
  reply: string;
  suggestions: string[];
  usedAi: boolean;
  matchedTransaction?: {
    voucherId: string;
    amount: number;
    merchantName: string;
    status: string;
    failureReason?: string;
  } | null;
};

export type SpendingCategory = {
  key: string;
  label: string;
  amount: number;
  count: number;
  share: number;
};

export type BiggestPayment = {
  amount: number;
  merchantName: string;
  timestamp: string;
};

export type SpendingAnalytics = {
  totalSpentWeek: number;
  totalSpentLastWeek: number;
  weekChangePct: number | null;
  pendingAmount: number;
  pendingCount: number;
  onlineBalance: number;
  cachedBalance: number | null;
  balanceGap: number;
  biggestPayment: BiggestPayment | null;
  categories: SpendingCategory[];
  narrative: string;
  savingTip: string;
};
