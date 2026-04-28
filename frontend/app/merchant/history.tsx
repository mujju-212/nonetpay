import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { API_BASE_URL } from "../../lib/api";
import TransactionDetailModal from "../../components/TransactionDetailModal";
import { Ionicons } from "@expo/vector-icons";
import { notifyMerchantSyncDone } from "../../lib/notifications";

type Transaction = {
  id: string;
  type: string;
  amount: number;
  description: string;
  payerName?: string;
  timestamp: string;
  status?: string;
  merchantId?: string;
  syncError?: string | null;
};

export default function MerchantHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [offlineCount, setOfflineCount] = useState(0);
  const [syncedCount, setSyncedCount] = useState(0);
  const [selectedTab, setSelectedTab] = useState<"transactions" | "vouchers">("vouchers");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    let allTransactions: Transaction[] = [];

    try {
      const token = await AsyncStorage.getItem("@auth_token");
      if (!token) {
        router.replace("/merchant-login");
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/transactions/merchant`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        allTransactions = (data.transactions || []).map((t: any) => ({
          ...t,
          status: t.status || "synced",
        }));
      }
    } catch (error) {
      console.error("Backend load error:", error);
    }

    // Load offline vouchers
    try {
      const existing = await AsyncStorage.getItem("@offline_vouchers");
      if (existing) {
        const offlineVouchers = JSON.parse(existing);
        const pending = offlineVouchers.filter((v: any) => v.status === "offline").length;
        const synced = offlineVouchers.filter((v: any) => v.status === "synced").length;
        setOfflineCount(pending);
        setSyncedCount(synced);
        const offlineTransactions: Transaction[] = offlineVouchers.map((v: any) => ({
          id: v.voucherId,
          type: "credit",
          amount: v.amount,
          description: v.description || "Payment received",
          payerName: v.issuedTo ? `User ...${v.issuedTo.slice(-6)}` : "Customer",
          timestamp: v.createdAt,
          status: v.status,
          syncError: v.syncError || null,
        }));
        const backendIds = new Set(allTransactions.map((t) => t.id));
        const localOnly = offlineTransactions.filter((t) => !backendIds.has(t.id));
        allTransactions = [...allTransactions, ...localOnly];
      } else {
        setOfflineCount(0);
        setSyncedCount(0);
      }
    } catch (e) {
      console.log("Error reading offline vouchers:", e);
      setOfflineCount(0);
      setSyncedCount(0);
    }

    allTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setTransactions(allTransactions);
    setLoading(false);
    setRefreshing(false);
  }, [router]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const syncOfflineVouchers = async () => {
    if (syncing) return;
    try {
      setSyncing(true);
      const existing = await AsyncStorage.getItem("@offline_vouchers");
      if (!existing) {
        Alert.alert("No Vouchers", "No offline vouchers found.");
        return;
      }
      const vouchers = JSON.parse(existing);
      const offlineVouchersToSync = vouchers.filter((v: any) => v.status === "offline");
      if (offlineVouchersToSync.length === 0) {
        Alert.alert("Already Synced", "All vouchers are already synced.");
        return;
      }
      const currentMerchantId = await AsyncStorage.getItem("@merchant_id");
      if (!currentMerchantId) {
        Alert.alert("Error", "Merchant ID not found. Please login again.");
        router.replace("/merchant-login");
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/vouchers/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId: currentMerchantId, vouchers: offlineVouchersToSync }),
      });
      const responseText = await response.text();
      if (!response.ok) throw new Error(`Sync failed: ${response.status} - ${responseText}`);
      const result = JSON.parse(responseText);

      const rejectionMap: Record<string, string> = {};
      for (const r of result.rejected || []) {
        rejectionMap[r.voucherId] = r.reason || "Rejected by server";
      }
      const updated = vouchers.map((v: any) =>
        result.syncedIds.includes(v.voucherId)
          ? { ...v, status: "synced", syncedAt: new Date().toISOString(), syncError: null }
          : rejectionMap[v.voucherId]
            ? { ...v, syncError: rejectionMap[v.voucherId] }
            : v
      );
      await AsyncStorage.setItem("@offline_vouchers", JSON.stringify(updated));

      if (result.syncedIds.length > 0) {
        await notifyMerchantSyncDone(result.syncedIds.length);
      }
      Alert.alert(
        "Sync Complete",
        `${result.syncedIds.length} voucher${result.syncedIds.length !== 1 ? "s" : ""} synced to backend${"\n"}` +
        (result.rejected?.length ? `${result.rejected.length} rejected (duplicate or invalid).` : "All accepted!")
      );
      loadTransactions();
    } catch (error) {
      console.error("Sync error:", error);
      Alert.alert("Sync Failed", `Could not sync: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const day = date.getDate();
    const month = date.toLocaleDateString("en-IN", { month: "short" });
    const year = date.getFullYear();
    const time = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    return `${day} ${month} ${year}, ${time}`;
  };

  const renderVoucher = ({ item }: { item: Transaction }) => (
    <Pressable
      style={({ pressed }) => [styles.voucherCard, pressed && styles.cardPressed]}
      onPress={() => {
        setSelectedTransaction(item);
        setDetailModalVisible(true);
      }}
    >
      <View style={styles.voucherLeft}>
        <View style={styles.statusDot} />
        <View style={styles.voucherInfo}>
          <Text style={styles.amount}>₹{item.amount}</Text>
          <Text style={styles.description}>{item.description}</Text>
          <Text style={styles.timestamp}>{formatDate(item.timestamp)}</Text>
        </View>
      </View>
      <View style={styles.voucherRight}>
        <View style={styles.usedBadge}>
          <Text style={styles.usedBadgeText}>✓ Used</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
      </View>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#15803d" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1f2937" />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.title}>My Vouchers</Text>
          <Text style={styles.subtitle}>{transactions.length} vouchers</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tab, selectedTab === "transactions" && styles.tabActive]}
          onPress={() => setSelectedTab("transactions")}
        >
          <Ionicons
            name="list-outline"
            size={16}
            color={selectedTab === "transactions" ? "#7c3aed" : "#6b7280"}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabLabel, selectedTab === "transactions" && styles.tabLabelActive]}>
            Transactions
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, selectedTab === "vouchers" && styles.tabActive]}
          onPress={() => setSelectedTab("vouchers")}
        >
          <Ionicons
            name="card-outline"
            size={16}
            color={selectedTab === "vouchers" ? "#7c3aed" : "#6b7280"}
            style={styles.tabIcon}
          />
          <Text style={[styles.tabLabel, selectedTab === "vouchers" && styles.tabLabelActive]}>
            Vouchers
          </Text>
        </Pressable>
      </View>

      {/* Completed Payments Badge */}
      <View style={styles.badgeContainer}>
        <Text style={styles.badge}>✓ Completed payments</Text>
      </View>

      <View style={styles.syncContainer}>
        <Pressable
          style={[
            styles.syncButton,
            syncing ? styles.syncButtonDisabled : undefined,
            !syncing && offlineCount === 0 ? styles.syncButtonAllSynced : undefined,
          ]}
          onPress={syncOfflineVouchers}
          disabled={syncing}
        >
          {syncing ? (
            <View style={styles.syncRow}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={[styles.syncButtonText, { marginLeft: 8 }]}>Syncing to backend...</Text>
            </View>
          ) : offlineCount > 0 ? (
            <Text style={styles.syncButtonText}>
              Sync {offlineCount} Offline Voucher{offlineCount !== 1 ? "s" : ""}
            </Text>
          ) : (
            <Text style={styles.syncButtonText}>All Synced - Tap to check again</Text>
          )}
        </Pressable>
        <Text style={styles.syncMetaText}>
          Pending: {offlineCount} | Synced: {syncedCount}
        </Text>
      </View>

      {/* Vouchers List */}
      {transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No vouchers yet</Text>
          <Text style={styles.emptySubtext}>Vouchers will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderVoucher}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          scrollEnabled={true}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      <TransactionDetailModal
        visible={detailModalVisible}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
        userType="merchant"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: "#f9fafb" },
  backButton: { marginBottom: 12 },
  backArrow: { fontSize: 28, color: "#1f2937", fontWeight: "600" },
  headerContent: {},
  title: { fontSize: 26, fontWeight: "800", color: "#1f2937", marginBottom: 2 },
  subtitle: { fontSize: 13, color: "#9ca3af" },

  tabsContainer: { flexDirection: "row", paddingHorizontal: 20, marginBottom: 12, gap: 12 },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#e5e7eb",
  },
  tabActive: { backgroundColor: "#fff", borderWidth: 2, borderColor: "#7c3aed" },
  tabIcon: { marginRight: 6 },
  tabIconActive: { color: "#7c3aed" },
  tabLabel: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabLabelActive: { color: "#7c3aed" },

  badgeContainer: { paddingHorizontal: 20, marginBottom: 12 },
  badge: { fontSize: 12, color: "#1f2937", fontWeight: "600", paddingVertical: 6, paddingHorizontal: 10 },
  syncContainer: { paddingHorizontal: 20, marginBottom: 14 },
  syncButton: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  syncButtonAllSynced: { backgroundColor: "#16a34a" },
  syncButtonDisabled: { backgroundColor: "#9ca3af" },
  syncButtonText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  syncRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  syncMetaText: { marginTop: 6, textAlign: "center", fontSize: 12, color: "#6b7280", fontWeight: "600" },

  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  voucherCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardPressed: { opacity: 0.7 },
  voucherLeft: { flex: 1, flexDirection: "row", alignItems: "center" },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#10b981", marginRight: 12 },
  voucherInfo: { flex: 1 },
  amount: { fontSize: 16, fontWeight: "700", color: "#1f2937", marginBottom: 2 },
  description: { fontSize: 13, color: "#6b7280", marginBottom: 4 },
  timestamp: { fontSize: 11, color: "#9ca3af" },
  voucherRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  usedBadge: { backgroundColor: "#d1fae5", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  usedBadgeText: { fontSize: 11, color: "#10b981", fontWeight: "600" },
  arrow: { fontSize: 20, color: "#d1d5db" },

  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#1f2937" },
  emptySubtext: { fontSize: 13, color: "#9ca3af", marginTop: 4 },
});
