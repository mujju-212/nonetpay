import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { useRouter, useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function MerchantHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [merchantData, setMerchantData] = useState<any>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  // Safe logout — runs inside React lifecycle, not inside Alert callback
  useEffect(() => {
    if (!loggingOut) return;
    AsyncStorage.multiRemove(["@auth_token", "@merchant_data", "@merchant_id", "@offline_vouchers"])
      .then(() => router.replace("/merchant-login"));
  }, [loggingOut]);

  const loadMerchantData = useCallback(async () => {
    try {
      const merchantDataStr = await AsyncStorage.getItem("@merchant_data");
      const currentMerchantId = await AsyncStorage.getItem("@merchant_id");
      if (merchantDataStr && currentMerchantId) {
        setMerchantData(JSON.parse(merchantDataStr));
        setMerchantId(currentMerchantId);
      }
      const existing = await AsyncStorage.getItem("@offline_vouchers");
      if (existing) {
        const vouchers = JSON.parse(existing);
        const pending = vouchers.filter((v: any) => v.status === "offline").length;
        const total = vouchers.reduce((s: number, v: any) => s + v.amount, 0);
        setPendingCount(pending);
        setTotalEarned(total);
      }
    } catch (error) {
      console.log("Error loading merchant data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload every time this screen comes into focus so pending count stays fresh
  useFocusEffect(useCallback(() => { loadMerchantData(); }, [loadMerchantData]));

  const handleLogout = () => setLoggingOut(true);

  if (loading) {
    return (
      <View style={styles.centered}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#15803d" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!merchantId) {
    return (
      <View style={styles.centered}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.errorText}>Session expired. Please login again.</Text>
        <Pressable style={styles.outlineBtn} onPress={() => router.replace("/merchant-login")}>
          <Text style={styles.outlineBtnText}>Go to Login</Text>
        </Pressable>
      </View>
    );
  }

  const businessName = merchantData?.businessName || merchantData?.name || "Your Business";
  const merchantPayload = JSON.stringify({ merchantId, name: businessName });
  const shortId = merchantId.length > 20 ? `...${merchantId.slice(-16)}` : merchantId;

  return (
    <View style={styles.gradient}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* Stats Strip */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>₹{totalEarned}</Text>
            <Text style={styles.statLabel}>Total Earned</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending Sync</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>—</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
        </View>

        {/* QR Card */}
        <View style={styles.qrCard}>
          <View style={styles.qrHeader}>
            <Text style={styles.qrLabel}>📋 Your Payment QR Code</Text>
          </View>
          <Text style={styles.qrSub}>Show this to customers to receive payments</Text>
          <View style={styles.qrBox}>
            <QRCode value={merchantPayload} size={200} backgroundColor="#ffffff" color="#15803d" />
          </View>
          <View style={styles.idRow}>
            <Text style={styles.idLabel}>MERCHANT ID</Text>
            <Text style={styles.idValue} numberOfLines={1}>{shortId}</Text>
          </View>
        </View>

        {/* Pending sync alert */}
        {pendingCount > 0 && (
          <Pressable style={styles.syncAlert} onPress={() => router.push("/merchant/history")}>
            <Text style={styles.syncAlertText}>
              ⚠️  {pendingCount} voucher{pendingCount !== 1 ? "s" : ""} waiting to sync → Tap to go to History
            </Text>
          </Pressable>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionHeading}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.cardPressed]}
            onPress={() => router.push("/merchant/receive")}
          >
            <Text style={styles.actionEmoji}>💰</Text>
            <Text style={styles.actionTitle}>Receive Payment</Text>
            <Text style={styles.actionSub}>Scan customer QR voucher</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionCard, pressed && styles.cardPressed]}
            onPress={() => router.push("/merchant/history")}
          >
            <Text style={styles.actionEmoji}>📋</Text>
            <Text style={styles.actionTitle}>Transaction History</Text>
            <Text style={styles.actionSub}>View sales & sync to server</Text>
          </Pressable>
        </View>

        {/* Profile & Logout */}
        <View style={styles.bottomBtns}>
          <Pressable
            style={({ pressed }) => [styles.outlineBtn, styles.profileBtn, pressed && styles.btnPressed]}
            onPress={() => router.push("/merchant/profile")}
          >
            <Text style={styles.profileBtnText}>👤 My Profile</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.outlineBtn, styles.logoutBtn, pressed && styles.btnPressed]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutBtnText}>🚪 Log Out</Text>
          </Pressable>
        </View>

        <View style={{ height: insets.bottom + 16 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#f9fafb" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  loadingText: { marginTop: 12, fontSize: 15, color: "#6b7280" },
  errorText: { fontSize: 15, color: "#1f2937", marginBottom: 20, textAlign: "center" },

  statsRow: { 
    flexDirection: "row", 
    backgroundColor: "#fff", 
    borderRadius: 16, 
    paddingVertical: 18,
    marginBottom: 18,
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, 
    shadowRadius: 3, 
    elevation: 2,
  },
  statItem: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: "#e5e7eb" },
  statValue: { fontSize: 20, fontWeight: "800", color: "#1f2937", marginBottom: 4 },
  statLabel: { fontSize: 11, color: "#9ca3af", fontWeight: "500" },

  qrCard: {
    backgroundColor: "#fff", 
    borderRadius: 20, 
    padding: 22,
    alignItems: "center", 
    marginBottom: 20,
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, 
    shadowRadius: 8, 
    elevation: 3,
  },
  qrHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  qrLabel: { fontSize: 16, fontWeight: "700", color: "#1f2937" },
  qrSub: { fontSize: 12, color: "#9ca3af", marginBottom: 16, textAlign: "center" },
  qrBox: {
    padding: 12, 
    borderRadius: 12, 
    backgroundColor: "#fff",
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, 
    shadowRadius: 2, 
    elevation: 1, 
    marginBottom: 14,
  },
  idRow: { 
    backgroundColor: "#e8f5e9", 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    width: "100%", 
    alignItems: "center" 
  },
  idLabel: { fontSize: 10, color: "#6b7280", fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  idValue: { fontSize: 14, fontWeight: "700", color: "#16a34a" },

  syncAlert: { backgroundColor: "#fef3c7", borderRadius: 12, padding: 14, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: "#f59e0b" },
  syncAlertText: { fontSize: 13, color: "#92400e", fontWeight: "600", lineHeight: 20 },

  sectionHeading: { fontSize: 16, fontWeight: "700", color: "#1f2937", marginBottom: 12 },
  actionsGrid: { flexDirection: "row", gap: 12, marginBottom: 18 },
  actionCard: {
    flex: 1, 
    backgroundColor: "#fff", 
    borderRadius: 16, 
    padding: 18,
    alignItems: "center",
    shadowColor: "#000", 
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, 
    shadowRadius: 4, 
    elevation: 2,
  },
  cardPressed: { opacity: 0.75, transform: [{ scale: 0.95 }] },
  actionEmoji: { fontSize: 32, marginBottom: 10 },
  actionTitle: { fontSize: 13, fontWeight: "700", color: "#1f2937", textAlign: "center", marginBottom: 6 },
  actionSub: { fontSize: 11, color: "#9ca3af", textAlign: "center" },

  bottomBtns: { flexDirection: "row", gap: 12 },
  outlineBtn: {
    flex: 1, 
    paddingVertical: 14, 
    borderRadius: 12, 
    alignItems: "center",
    borderWidth: 1.5,
    backgroundColor: "#fff",
  },
  profileBtn: { borderColor: "#8b8bb6" },
  profileBtnText: { color: "#7c7ca8", fontSize: 14, fontWeight: "600" },
  logoutBtn: { borderColor: "#fca5a5" },
  logoutBtnText: { color: "#f97316", fontSize: 14, fontWeight: "700" },
  btnPressed: { opacity: 0.7 },
  outlineBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
