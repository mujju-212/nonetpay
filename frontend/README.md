# 💸 Offline Pay — Offline Digital Payment System

A prototype mobile payment system that enables users to perform **secure offline transactions** using **cryptographically signed vouchers**, with automatic synchronization when internet connectivity is restored.

---

## 🚀 Overview

Offline Pay is an **offline-first fintech prototype** designed to simulate how digital payments can work in environments with **limited or no internet connectivity**.

Users can:

* Load money online
* Store wallet balance locally on the device
* Perform offline QR-based payments
* Use cryptographic signatures to secure transactions
* Sync transactions with backend when internet is available

---

## 🧠 Key Concept

This project demonstrates a **stored-value offline wallet architecture**:

```text
Online → Load money → Cache locally  
Offline → Use local balance → Generate signed voucher  
Sync → Send transactions → Update server balance
```

---

## 🏗️ System Architecture

### 🔹 Online Phase

* User loads money via backend
* Wallet balance stored in:

  * MongoDB (server)
  * AsyncStorage (local device)

### 🔹 Offline Phase

* App reads balance from local storage
* User generates a **signed payment voucher**
* Merchant scans QR and verifies transaction

### 🔹 Sync Phase

* Internet restored
* Offline transactions sent to backend
* Server updates wallet balance

---

## 🔐 Security Features

* ✅ **Cryptographic Signatures**
  Ensures vouchers cannot be tampered

* ✅ **Unique Voucher ID**
  Prevents replay attacks

* ✅ **Double-Spending Prevention**
  Local balance deduction ensures funds cannot be reused

* ✅ **Offline Transaction Queue**
  Transactions stored and synced later

---

## 📱 Features

* User & Merchant authentication
* Wallet balance management
* QR-based payment system
* Offline voucher generation
* Transaction history
* Backend synchronization
* Secure key handling (private/public key model)

---

## 🛠️ Tech Stack

### Frontend

* React Native (Expo)
* AsyncStorage (local data storage)

### Backend

* Node.js (Express)
* MongoDB Atlas

### Security

* Cryptographic signing (public/private key)
* Voucher-based transaction validation

---

## ⚙️ How It Works

1. User loads money (online)
2. Balance stored in server + device
3. User goes offline
4. Creates signed payment voucher
5. Merchant scans and verifies voucher
6. Balance updated locally
7. When online, transactions sync with backend

---

## 📌 Use Cases

* Low network areas
* Rural payments
* Events / festivals
* Campus payment systems
* Temporary offline transactions

---

## ⚠️ Limitations

* This is a **prototype system**, not a production fintech platform
* Real-world deployment requires:

  * Payment gateway integration
  * Banking partnerships
  * Regulatory compliance (e.g., RBI)
  * Advanced fraud detection

---

## 🎯 Learning Outcomes

This project demonstrates:

* Offline-first system design
* Distributed transaction handling
* Cryptographic security in payments
* Mobile + backend integration
* Real-world fintech architecture concepts

---

## 🧑‍💻 Author

**Offline Pay Project**
Developed as a learning-focused fintech system prototype.

---

## ⭐ Final Note

This project is a **technical exploration of offline payment architecture**, focusing on how secure transactions can be performed without continuous internet connectivity.

---
