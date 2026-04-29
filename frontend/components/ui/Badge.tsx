import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type BadgeVariant =
  | "synced"
  | "offline"
  | "expired"
  | "pending"
  | "credit"
  | "debit"
  | "verified"
  | "unverified";

interface BadgeProps {
  variant: BadgeVariant;
  label?: string;   // override the default label
  style?: ViewStyle;
}

const CONFIG: Record<
  BadgeVariant,
  { icon: keyof typeof Ionicons.glyphMap; label: string; bg: string; color: string }
> = {
  synced:     { icon: "checkmark-circle",      label: "Synced",      bg: "#dcfce7", color: "#16a34a" },
  offline:    { icon: "cloud-offline-outline", label: "Offline",     bg: "#fef3c7", color: "#d97706" },
  expired:    { icon: "time-outline",          label: "Expired",     bg: "#fee2e2", color: "#dc2626" },
  pending:    { icon: "hourglass-outline",     label: "Pending",     bg: "#fef9c3", color: "#ca8a04" },
  credit:     { icon: "arrow-down",            label: "Credit",      bg: "#dcfce7", color: "#16a34a" },
  debit:      { icon: "arrow-up",              label: "Debit",       bg: "#fee2e2", color: "#dc2626" },
  verified:   { icon: "shield-checkmark",      label: "Verified",    bg: "#e0f2fe", color: "#0284c7" },
  unverified: { icon: "shield-outline",        label: "Unverified",  bg: "#f3f4f6", color: "#6b7280" },
};

export function Badge({ variant, label, style }: BadgeProps) {
  const cfg = CONFIG[variant];
  const text = label ?? cfg.label;

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, style]}>
      <Ionicons name={cfg.icon} size={11} color={cfg.color} />
      <Text style={[styles.text, { color: cfg.color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
  },
});
