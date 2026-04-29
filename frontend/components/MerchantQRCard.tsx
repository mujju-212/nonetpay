import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import QRCode from "react-native-qrcode-svg";

interface MerchantQRCardProps {
  merchantId: string;
  businessName: string;
  style?: ViewStyle;
  size?: number;
}

export function MerchantQRCard({
  merchantId,
  businessName,
  style,
  size = 200,
}: MerchantQRCardProps) {
  // Payload that user's camera will scan
  const qrPayload = JSON.stringify({ merchantId, name: businessName });

  return (
    <LinearGradient
      colors={["rgba(255,255,255,0.97)", "rgba(248,246,255,0.97)"]}
      style={[styles.card, style]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Text style={styles.icon}>🏪</Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.businessName} numberOfLines={1}>
            {businessName}
          </Text>
          <Text style={styles.idLabel}>Merchant QR Code</Text>
        </View>
      </View>

      {/* QR */}
      <View style={styles.qrWrap}>
        <QRCode
          value={qrPayload}
          size={size}
          color="#1f2433"
          backgroundColor="transparent"
          logo={undefined}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerLabel}>ID</Text>
        <Text style={styles.footerId} numberOfLines={1}>
          {merchantId}
        </Text>
      </View>

      <Text style={styles.hint}>Ask customer to scan this QR to pay</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    shadowColor: "#b8aef0",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginBottom: 20,
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f0edff",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 22 },
  headerText: { flex: 1 },
  businessName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2433",
  },
  idLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "600",
    marginTop: 2,
  },
  qrWrap: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 18,
    shadowColor: "#c6bff3",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 18,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    alignSelf: "stretch",
    marginBottom: 12,
  },
  footerLabel: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  footerId: {
    flex: 1,
    fontSize: 12,
    color: "#4f46e5",
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  hint: {
    fontSize: 12,
    color: "#9ca3af",
    fontWeight: "500",
    textAlign: "center",
  },
});
