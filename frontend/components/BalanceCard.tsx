import React from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

interface BalanceCardProps {
  balance: number | null;
  loading?: boolean;
  isOffline?: boolean;
  onAddMoney?: () => void;
  onRefresh?: () => void;
}

export function BalanceCard({
  balance,
  loading = false,
  isOffline = false,
  onAddMoney,
  onRefresh,
}: BalanceCardProps) {
  const formatted =
    balance !== null
      ? balance.toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "0.00";

  return (
    <LinearGradient
      colors={["#7c6fff", "#4f46e5", "#3b34c4"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Top row */}
      <View style={styles.topRow}>
        <View style={styles.walletTag}>
          <Ionicons name="wallet" size={12} color="rgba(255,255,255,0.9)" />
          <Text style={styles.walletLabel}>Offline Wallet</Text>
        </View>
        {onRefresh && (
          <Pressable onPress={onRefresh} style={styles.refreshBtn}>
            <Ionicons name="refresh-outline" size={16} color="rgba(255,255,255,0.8)" />
          </Pressable>
        )}
      </View>

      {/* Balance */}
      <Text style={styles.balanceLabel}>Available Balance</Text>
      {loading ? (
        <ActivityIndicator color="#fff" size="large" style={styles.loader} />
      ) : (
        <Text style={styles.amount}>₹{formatted}</Text>
      )}

      {/* Bottom row */}
      <View style={styles.bottomRow}>
        <View style={[styles.statusPill, isOffline && styles.statusPillOffline]}>
          <View style={[styles.statusDot, isOffline && styles.statusDotOffline]} />
          <Text style={styles.statusText}>{isOffline ? "Cached" : "Live"}</Text>
        </View>

        {onAddMoney && (
          <Pressable
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
            onPress={onAddMoney}
          >
            <Ionicons name="add" size={16} color="#4f46e5" />
            <Text style={styles.addBtnText}>Add Money</Text>
          </Pressable>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 22,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  walletTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  walletLabel: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  refreshBtn: {
    padding: 4,
  },
  balanceLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    marginBottom: 6,
  },
  loader: {
    marginVertical: 12,
    alignSelf: "flex-start",
  },
  amount: {
    fontSize: 38,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -1,
    marginBottom: 20,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusPillOffline: {
    backgroundColor: "rgba(251,191,36,0.2)",
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#4ade80",
  },
  statusDotOffline: {
    backgroundColor: "#fbbf24",
  },
  statusText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "700",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: {
    color: "#4f46e5",
    fontSize: 13,
    fontWeight: "700",
  },
});
