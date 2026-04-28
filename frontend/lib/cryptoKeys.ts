import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import "react-native-get-random-values";
// @ts-ignore
import { ec as EC } from "elliptic";

const EC_CURVE = "secp256k1";
const PRIV_KEY_KEY = "user_private_key";
const PUB_KEY_KEY = "@user_public_key";
const USER_ID_KEY = "@user_id";
const FALLBACK_PREFIX = "@secure_fallback_";
const ec = new EC(EC_CURVE);

async function isSecureStoreAvailable(): Promise<boolean> {
  try {
    if (typeof SecureStore.isAvailableAsync !== "function") return false;
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function getSecureItem(key: string): Promise<string | null> {
  const fallbackKey = `${FALLBACK_PREFIX}${key}`;
  if (!(await isSecureStoreAvailable())) {
    return AsyncStorage.getItem(fallbackKey);
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return AsyncStorage.getItem(fallbackKey);
  }
}

async function setSecureItem(key: string, value: string): Promise<void> {
  const fallbackKey = `${FALLBACK_PREFIX}${key}`;
  if (!(await isSecureStoreAvailable())) {
    await AsyncStorage.setItem(fallbackKey, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    await AsyncStorage.setItem(fallbackKey, value);
  }
}

export async function ensureUserKeypairAndId() {
  let userId = await AsyncStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = `user_${Date.now()}`;
    await AsyncStorage.setItem(USER_ID_KEY, userId);
  }
  let priv = await getSecureItem(PRIV_KEY_KEY);
  let pub = await AsyncStorage.getItem(PUB_KEY_KEY);
  if (!priv || !pub) {
    const pair = ec.genKeyPair();
    const privHex = pair.getPrivate("hex");
    const pubHex = pair.getPublic("hex");
    await setSecureItem(PRIV_KEY_KEY, privHex);
    await AsyncStorage.setItem(PUB_KEY_KEY, pubHex);
    priv = privHex;
    pub = pubHex;
  }
  return { userId, privateKeyHex: priv, publicKeyHex: pub };
}

export async function getUserId() {
  return await AsyncStorage.getItem(USER_ID_KEY);
}

export async function getPublicKeyHex() {
  return await AsyncStorage.getItem(PUB_KEY_KEY);
}

export async function signPayloadHex(payloadObj: object) {
  const privHex = await getSecureItem(PRIV_KEY_KEY);
  if (!privHex) throw new Error("Private key missing. Call ensureUserKeypairAndId() first.");
  const pair = ec.keyFromPrivate(privHex, "hex");
  const payloadStr = JSON.stringify(payloadObj);
  const msgHashHex = await hashSha256Hex(payloadStr);
  const sig = pair.sign(msgHashHex, { canonical: true });
  const derHex = sig.toDER("hex");
  return { signatureHex: derHex, messageHashHex: msgHashHex };
}

export async function hashSha256Hex(message: string) {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, message);
}

/**
 * Verify an ECDSA signature for a voucher payload — works fully OFFLINE.
 * The merchant uses this to confirm the voucher was signed by the user's private key.
 *
 * @param payload   - The exact object that was signed (voucherId, merchantId, amount, createdAt, issuedTo)
 * @param signatureHex - DER-encoded hex signature from the voucher
 * @param publicKeyHex - User's public key embedded in the voucher
 * @returns true if valid, false if tampered or invalid
 */
export async function verifyVoucherSignature(
  payload: object,
  signatureHex: string,
  publicKeyHex: string
): Promise<boolean> {
  try {
    const payloadStr = JSON.stringify(payload);
    const msgHashHex = await hashSha256Hex(payloadStr);
    const key = ec.keyFromPublic(publicKeyHex, "hex");
    return key.verify(msgHashHex, signatureHex);
  } catch {
    return false;
  }
}
