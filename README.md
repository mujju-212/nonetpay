# 💳 NONETPAY — Secure Offline Digital Payment System

> A full-stack mobile payment prototype enabling **secure peer-to-merchant transactions without internet connectivity** using cryptographically signed QR vouchers.

---

## 📌 Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Security Model](#security-model)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Features](#features)
- [Use Cases](#use-cases)
- [Limitations](#limitations)

---

## Overview

**NONETPAY** is an offline-first fintech prototype that demonstrates how digital payments can be made securely in environments with **limited or no internet connectivity**.

Users load money online, store their wallet balance locally, and generate **ECDSA-signed QR vouchers** to pay merchants — all without needing an active connection. When internet is restored, all transactions automatically sync with the backend.

```
 ┌─────────────────────────────────────────────────────────┐
 │                     OFFLINE PAY FLOW                    │
 ├───────────────┬─────────────────────┬───────────────────┤
 │  ONLINE PHASE │   OFFLINE PHASE     │   SYNC PHASE      │
 │               │                     │                   │
 │  Load Money   │  Generate Voucher   │  Internet Back    │
 │  ──────────── │  ──────────────── ─ │  ──────────────── │
 │  Server + App │  Sign with ECDSA    │  Push vouchers    │
 │  both updated │  Show QR to merchant│  Update balances  │
 │               │  Merchant verifies  │  Confirm payments │
 │               │  fully offline      │                   │
 └───────────────┴─────────────────────┴───────────────────┘
```

---

## How It Works

### 🟢 Step 1 — User Loads Money (Online Required)
1. User registers and logs in
2. Tops up wallet via the app (max ₹1,000 per transaction)
3. Balance stored on MongoDB server **and** cached locally in AsyncStorage

### 🟡 Step 2 — Payment Without Internet
1. User opens the **Pay** screen → scans merchant's static QR
2. Enters payment amount
3. App builds a payload: `{ voucherId, merchantId, amount, createdAt, issuedTo }`
4. Payload is **SHA-256 hashed → ECDSA signed** using the user's secp256k1 private key
5. A voucher QR is displayed containing the signed payload + public key
6. Local balance is immediately deducted
7. Transaction queued in offline queue for later sync

### 🔵 Step 3 — Merchant Scans (Fully Offline)
1. Merchant opens the **Receive** screen → scans user's voucher QR
2. App reconstructs the payload, computes SHA-256 hash
3. **ECDSA signature is verified offline** using the embedded public key
4. Double-spend check: voucher ID is compared against local redemption list
5. Voucher saved to device storage
6. If online: immediately synced to backend server

### 🔄 Step 4 — Sync (When Internet Returns)
1. User's app automatically syncs pending transactions on next load
2. Backend verifies signatures again and checks server-side balance
3. User balance updated on server; vouchers marked `synced`
4. Notifications fired for confirmed payments

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        MOBILE APP                              │
│                   (React Native / Expo)                        │
│                                                                │
│  ┌──────────────┐          ┌──────────────────────────────┐   │
│  │  USER SIDE   │          │       MERCHANT SIDE          │   │
│  │              │  QR Code │                              │   │
│  │  wallet.tsx  │ ────────▶│  receive.tsx                 │   │
│  │  pay.tsx     │ voucher  │  - Scan QR                   │   │
│  │  history.tsx │          │  - Verify ECDSA offline      │   │
│  │  profile.tsx │          │  - Store + sync              │   │
│  └──────┬───────┘          └─────────────┬────────────────┘   │
│         │                                │                     │
│         │  lib/api.ts (REST calls)       │  lib/api.ts (sync) │
│         │  lib/cryptoKeys.ts (ECDSA)     │                     │
└─────────┼────────────────────────────────┼─────────────────────┘
          │                                │
          ▼                                ▼
┌────────────────────────────────────────────────────────────────┐
│                   EXPRESS BACKEND (Node.js)                    │
│                  Hosted on Render.com                          │
│                                                                │
│   routes/auth.js        → Register / Login (User + Merchant)  │
│   routes/balance.js     → Add / Deduct / Fetch balance         │
│   routes/vouchers.js    → Sync vouchers, Refund expired        │
│   routes/merchant.js    → Merchant profile, QR data           │
│   routes/transactions.js→ Transaction history                  │
│   routes/admin.js       → Admin views (dev only)              │
│                                                                │
│   middleware/auth.js    → JWT Bearer validation                │
│   middleware/errorHandler.js → Global error handling          │
│   utils/crypto.js       → ECDSA verification helpers          │
│   utils/dashboard.js    → HTML dashboard generator            │
│   db/index.js           → MongoDB Atlas connection            │
└────────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │    MongoDB Atlas     │
                  │                      │
                  │  collections:        │
                  │  - users             │
                  │  - merchants         │
                  │  - vouchers          │
                  └──────────────────────┘
```

---

## Project Structure

```
NONETPAY/
├── README.md                          ← You are here
├── .gitignore
│
├── frontend/                          ← React Native (Expo) App
│   ├── App.js
│   ├── app.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── metro.config.js
│   ├── eslint.config.js
│   ├── eas.json
│   │
│   ├── app/                           ← Expo Router screens
│   │   ├── _layout.tsx                ← Root navigation layout
│   │   ├── index.tsx                  ← Landing / Role selection
│   │   ├── login.tsx                  ← User login
│   │   ├── register.tsx               ← User registration
│   │   ├── forgot-password.tsx        ← User password reset
│   │   ├── merchant-login.tsx         ← Merchant login
│   │   ├── merchant-register.tsx      ← Merchant registration
│   │   ├── merchant-forgot-password.tsx
│   │   ├── modal.tsx
│   │   ├── test-connection.tsx        ← Backend connectivity test
│   │   │
│   │   ├── user/                      ← User-side tab screens
│   │   │   ├── _layout.tsx            ← User tab bar
│   │   │   ├── index.tsx
│   │   │   ├── wallet.tsx             ← Wallet dashboard + add money
│   │   │   ├── pay.tsx                ← Scan merchant → generate voucher
│   │   │   ├── history.tsx            ← Transaction history
│   │   │   ├── profile.tsx            ← User profile
│   │   │   └── settings.tsx           ← App settings
│   │   │
│   │   └── merchant/                  ← Merchant-side tab screens
│   │       ├── _layout.tsx            ← Merchant tab bar
│   │       ├── home.tsx               ← Merchant dashboard + QR display
│   │       ├── receive.tsx            ← Scan user voucher + verify
│   │       ├── history.tsx            ← Sales / redemption history
│   │       ├── profile.tsx            ← Merchant profile
│   │       └── settings.tsx           ← Settings
│   │
│   ├── components/                    ← Reusable UI components
│   │   ├── ui/                        ← Base design-system primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Badge.tsx
│   │   ├── BalanceCard.tsx            ← Wallet balance display widget
│   │   ├── TransactionItem.tsx        ← Single transaction row
│   │   ├── TransactionDetailModal.tsx ← Full transaction detail sheet
│   │   ├── OfflineBanner.tsx          ← Offline mode indicator
│   │   ├── MerchantQRCard.tsx         ← Merchant static QR display
│   │   └── QRCodeView.tsx             ← QR code renderer
│   │
│   ├── lib/                           ← Core business logic
│   │   ├── api.ts                     ← API calls, offline queue, sync logic
│   │   ├── cryptoKeys.ts              ← ECDSA key generation + signing
│   │   ├── notifications.ts           ← Push notification helpers
│   │   ├── registerKey.ts             ← Register public key with backend
│   │   └── storage.ts                 ← AsyncStorage key helpers
│   │
│   ├── constants/
│   │   ├── Colors.ts                  ← App colour palette
│   │   └── Config.ts                  ← API URLs, limits, feature flags
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                 ← Auth state + token management
│   │   ├── useBalance.ts              ← Balance fetching + caching hook
│   │   ├── useOfflineSync.ts          ← Offline sync lifecycle hook
│   │   ├── useColorScheme.ts
│   │   └── useThemeColor.ts
│   │
│   └── assets/
│       ├── fonts/
│       └── images/
│
└── backend/                           ← Node.js / Express API Server
    ├── index.js                       ← Entry point (starts server)
    ├── package.json
    ├── .env.example                   ← Environment variable template
    ├── .env                           ← Local secrets (git-ignored)
    ├── .gitignore
    ├── railway.json                   ← Railway deployment config
    ├── render.yaml                    ← Render.com deployment config
    │
    └── src/
        ├── app.js                     ← Express app setup (CORS, middleware)
        │
        ├── db/
        │   └── index.js               ← MongoDB connection + index creation
        │
        ├── middleware/
        │   ├── auth.js                ← JWT authMiddleware + optionalAuth
        │   └── errorHandler.js        ← Global error handler middleware
        │
        ├── utils/
        │   ├── crypto.js              ← ECDSA signature verification (server)
        │   └── dashboard.js           ← HTML dashboard page generator
        │
        └── routes/
            ├── auth.js                ← POST /api/auth/* (register, login, reset)
            ├── balance.js             ← GET/POST /api/balance (add, deduct, fetch)
            ├── vouchers.js            ← POST /api/vouchers/sync, /refund-expired
            ├── merchant.js            ← GET/PUT /api/merchant/* (profile, summary)
            ├── transactions.js        ← GET /api/transactions/user|merchant
            └── admin.js               ← GET /api/admin/* (users, merchants, vouchers)
```

---

## Tech Stack

### Frontend
| Tech | Purpose |
|---|---|
| React Native 0.81 + Expo SDK 54 | Cross-platform mobile framework |
| Expo Router v6 | File-based navigation |
| TypeScript | Type safety |
| `elliptic` | secp256k1 ECDSA signing |
| `expo-secure-store` | Private key storage (hardware-backed) |
| `expo-camera` | QR code scanning |
| `react-native-qrcode-svg` | QR code rendering |
| `expo-crypto` | SHA-256 hashing |
| `@react-native-async-storage` | Local balance cache + offline queue |
| `expo-notifications` | Payment confirmation alerts |
| `expo-linear-gradient` | UI gradients |

### Backend
| Tech | Purpose |
|---|---|
| Node.js + Express | REST API server |
| MongoDB Atlas | Cloud database |
| `bcryptjs` | Password hashing |
| `jsonwebtoken` | JWT auth tokens |
| `elliptic` | Server-side ECDSA verification |
| Render.com | Hosting / deployment |

---

## Security Model

### ECDSA Voucher Signing
- Curve: **secp256k1** (same as Bitcoin / Ethereum)
- Private key: generated on device, stored in **hardware-backed secure storage** (`expo-secure-store`)
- Public key: stored in AsyncStorage, also uploaded to backend and embedded in every voucher QR
- Signing: `SHA-256(JSON.stringify(payload))` → ECDSA sign → DER hex signature
- Verification: merchant app rebuilds the same payload, computes same hash, verifies signature using embedded public key — **works 100% offline**

### Anti-Fraud Protections
| Protection | Mechanism |
|---|---|
| Double-spend | Merchant checks local `@offline_vouchers` list by `voucherId` |
| Tamper detection | ECDSA signature fails if any field is modified |
| Replay attack | Each `voucherId` is unique (`V_<timestamp>`) |
| Balance inflation | Server validates backend balance at sync time |
| Voucher expiry | 7-day TTL; expired+unscanned vouchers auto-refunded |
| Idempotent deduction | `voucherId` checked in `balanceHistory` to prevent double-deduction |

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | User login |
| `POST` | `/api/auth/merchant/register` | Register merchant |
| `POST` | `/api/auth/merchant/login` | Merchant login |
| `GET` | `/api/auth/me` | Get current user/merchant info |
| `POST` | `/api/auth/forgot-password` | Reset user password |
| `POST` | `/api/auth/merchant/forgot-password` | Reset merchant password |

### Balance
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/balance` | Get user balance |
| `POST` | `/api/balance/add` | Add money (max ₹1,000) |
| `POST` | `/api/balance/deduct` | Deduct for payment (idempotent) |

### Vouchers
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/vouchers/sync` | Merchant syncs scanned vouchers |
| `POST` | `/api/vouchers/refund-expired` | Refund expired unused vouchers |
| `GET` | `/api/vouchers` | List all vouchers (admin) |

### Transactions
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/transactions/user` | User transaction history |
| `GET` | `/api/transactions/merchant` | Merchant payment history |

### Merchant
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/merchant/:id/summary` | Merchant redemption summary |
| `PUT` | `/api/merchant/profile` | Update merchant profile |
| `PUT` | `/api/merchant/change-password` | Change merchant password |

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- Expo CLI (`npm install -g expo-cli`)
- MongoDB Atlas account (or local MongoDB)
- iOS Simulator / Android Emulator / Physical device with Expo Go

### 1. Clone & Install

```bash
git clone <repo-url>
cd NONETPAY
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in MONGODB_URI, JWT_SECRET in .env
npm install
npm start
```

### 3. Frontend Setup

```bash
cd frontend
npm install
# Update lib/api.ts → API_BASE_URL to your backend URL
npx expo start
```

### 4. Environment Variables (Backend)

```env
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/offline_pay
MONGODB_DB_NAME=offline_pay
JWT_SECRET=your-super-secret-key
JWT_EXPIRE=7d
PORT=4000
NODE_ENV=development
```

---

## Features

### User
- ✅ Register / Login with phone + password
- ✅ Wallet balance (online fetch + offline cache)
- ✅ Add money to wallet (up to ₹1,000 per top-up)
- ✅ Scan merchant QR and generate signed payment voucher
- ✅ View unused vouchers with expiry countdown
- ✅ Transaction history (credits + debits)
- ✅ Automatic offline sync when internet returns
- ✅ Expired voucher auto-refund
- ✅ Push notifications for payment confirmation

### Merchant
- ✅ Register / Login with business details
- ✅ Static QR code for customers to scan
- ✅ Scan user vouchers with ECDSA verification (fully offline)
- ✅ Double-spend protection
- ✅ Auto-sync to backend when online
- ✅ Transaction history + total received
- ✅ Payment received notifications

---

## Use Cases

- 🌾 Rural payments in low-connectivity areas
- 🎪 Events, festivals, campus payment systems
- 🚉 Transit environments with spotty network
- 🛒 Temporary offline transactions
- 🧪 Fintech research & prototyping

---

## Limitations

> ⚠️ This is a **prototype** — not a production fintech system.

Real-world deployment would additionally require:
- Payment gateway integration (RazorPay, Stripe, etc.)
- Banking / regulatory compliance (RBI guidelines for India)
- KYC verification for users and merchants
- Advanced fraud detection & transaction monitoring
- Hardware Security Module (HSM) for key management
- Formal security audit

---

## Author

**NONETPAY** — Built as a learning-focused fintech prototype demonstrating offline-first architecture, distributed transaction handling, and cryptographic payment security on mobile.
