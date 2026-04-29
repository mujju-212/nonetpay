import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge } from "./ui/Badge";

export type TxnType = "credit" | "debit";
export type TxnStatus = "synced" | "pending" | "offline" | "expired";

export interface TransactionItemData {
  id: string;
  type: TxnType;
  amount: number;
  description: string;
  timestamp: string;
  status?: TxnStatus;
  merchantName?: string;
}

interface TransactionItemProps {
  item: TransactionItemData;
  onPress?: (item: TransactionItemData) => void;
  showDivider?: boolean;
}

function formatDate(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TransactionItem({ item, onPress, showDivider = false }: TransactionItemProps) {
  const isCredit = item.type === "credit";
  const amtStr = Math.abs(item.amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <Pressable
      onPress={() => onPress?.(item)}
      style={({ pressed }) => [
        styles.row,
        showDivider && styles.divider,
        pressed && styles.pressed,
      ]}
    >
      {/* Icon */}
      <View style={[styles.iconWrap, isCredit ? styles.iconWrapCredit : styles.iconWrapDebit]}>
        <Ionicons
          name={isCredit ? "arrow-down" : "arrow-up"}
          size={14}
          color={isCredit ? "#16a34a" : "#dc2626"}
        />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.desc} numberOfLines={1}>
          {item.description || (isCredit ? "Money received" : "Payment sent")}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.time}>{formatDate(item.timestamp)}</Text>
          {item.status && item.status !== "synced" && (
            <Badge variant={item.status} style={styles.badge} />
          )}
        </View>
      </View>

      {/* Amount */}
      <Text style={[styles.amount, isCredit ? styles.amountCredit : styles.amountDebit]}>
        {isCredit ? "+" : "-"}₹{amtStr}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 2,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: "#f3f0f9",
  },
  pressed: {
    opacity: 0.75,
    backgroundColor: "#fafafe",
    borderRadius: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconWrapCredit: { backgroundColor: "#dcfce7" },
  iconWrapDebit: { backgroundColor: "#fee2e2" },
  info: { flex: 1 },
  desc: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2433",
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  time: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "500",
  },
  badge: { transform: [{ scale: 0.9 }] },
  amount: {
    fontSize: 15,
    fontWeight: "800",
    marginLeft: 8,
  },
  amountCredit: { color: "#16a34a" },
  amountDebit: { color: "#dc2626" },
});
