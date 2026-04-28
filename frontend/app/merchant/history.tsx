import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { API_BASE_URL } from "../../lib/api";
import TransactionDetailModal from "../../components/TransactionDetailModal";

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
        const offlineTransactions = offlineVouchers.map((v: any) => ({
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
      }
    } catch (e) {
      console.log("Error reading offline vouchers:", e);
    }

    allTransactions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setTransactions(allTransactions);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

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
        <Text style={styles.arrow}>›</Text>
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
          <Text style={styles.backArrow}>‹</Text>
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
          <Text style={[styles.tabIcon, selectedTab === "transactions" && styles.tabIconActive]}>📋</Text>
          <Text style={[styles.tabLabel, selectedTab === "transactions" && styles.tabLabelActive]}>
            Transactions
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, selectedTab === "vouchers" && styles.tabActive]}
          onPress={() => setSelectedTab("vouchers")}
        >
          <Text style={[styles.tabIcon, selectedTab === "vouchers" && styles.tabIconActive]}>💳</Text>
          <Text style={[styles.tabLabel, selectedTab === "vouchers" && styles.tabLabelActive]}>
            Vouchers
          </Text>
        </Pressable>
      </View>

      {/* Completed Payments Badge */}
      <View style={styles.badgeContainer}>
        <Text style={styles.badge}>✓ Completed payments</Text>
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
  tabIcon: { fontSize: 16, marginRight: 6, color: "#6b7280" },
  tabIconActive: { color: "#7c3aed" },
  tabLabel: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabLabelActive: { color: "#7c3aed" },

  badgeContainer: { paddingHorizontal: 20, marginBottom: 12 },
  badge: { fontSize: 12, color: "#1f2937", fontWeight: "600", paddingVertical: 6, paddingHorizontal: 10 },

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
