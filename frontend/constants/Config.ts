// ─── App-wide constants ───────────────────────────────────────────────────────
// Single source of truth — import from here instead of hardcoding values.

// Backend URL — production Render deployment
// Landing page:  https://nonetpay.onrender.com/
// API base:      https://nonetpay.onrender.com/api/...
// Admin panel:   https://nonetpay.onrender.com/admin
export const API_BASE_URL = "https://nonetpay.onrender.com";

// ─── Payment limits ───────────────────────────────────────────────────────────
/** Maximum amount per single top-up transaction (₹) */
export const MAX_SINGLE_AMOUNT = 1000;

/** Total wallet balance ceiling (₹) */
export const MAX_WALLET_BALANCE = 5000;

/** Days before an unused offline voucher expires and can be refunded */
export const VOUCHER_EXPIRY_DAYS = 7;

// ─── AsyncStorage keys ────────────────────────────────────────────────────────
export const STORAGE_KEYS = {
  // Auth
  AUTH_TOKEN:          "@auth_token",
  USER_DATA:           "@user_data",
  MERCHANT_DATA:       "@merchant_data",

  // Wallet
  WALLET_BALANCE:      "@walletBalance",

  // Offline payment queue
  OFFLINE_TRANSACTIONS: "@offlineTransactions",
  USED_VOUCHER_IDS:    "@usedVoucherIds",
  GENERATED_VOUCHERS:  "@generatedVouchers",

  // Crypto identity
  USER_ID:             "@user_id",
  USER_PUBLIC_KEY:     "@user_public_key",
} as const;

// ─── App metadata ─────────────────────────────────────────────────────────────
export const APP_VERSION = "1.0.0";
export const APP_NAME    = "Offline Pay";
