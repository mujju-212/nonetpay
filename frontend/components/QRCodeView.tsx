import React, { useRef } from "react";
import { View, Text, Pressable, StyleSheet, Share, ViewStyle } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Ionicons } from "@expo/vector-icons";

interface QRCodeViewProps {
  value: string;
  size?: number;
  label?: string;
  sublabel?: string;
  style?: ViewStyle;
  showShare?: boolean;
}

export function QRCodeView({
  value,
  size = 220,
  label,
  sublabel,
  style,
  showShare = true,
}: QRCodeViewProps) {
  const svgRef = useRef<any>(null);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Offline Pay QR\n${label ?? ""}\n\nData: ${value}`,
      });
    } catch {}
  };

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}

      {/* QR box */}
      <View style={styles.qrBox}>
        {/* Corner brackets */}
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />

        <QRCode
          value={value || "empty"}
          size={size}
          color="#1f2433"
          backgroundColor="transparent"
          getRef={(ref) => { svgRef.current = ref; }}
        />
      </View>

      {showShare && (
        <Pressable
          style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.8 }]}
          onPress={handleShare}
        >
          <Ionicons name="share-outline" size={16} color="#6f63ff" />
          <Text style={styles.shareBtnText}>Share QR</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  label: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2433",
    textAlign: "center",
    marginBottom: 4,
  },
  sublabel: {
    fontSize: 13,
    color: "#9ca3af",
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 20,
  },
  qrBox: {
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
    position: "relative",
    shadowColor: "#b8aef0",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 16,
  },
  corner: {
    position: "absolute",
    width: 22,
    height: 22,
    borderColor: "#6f63ff",
  },
  cornerTL: {
    top: 8, left: 8,
    borderTopWidth: 3, borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 8, right: 8,
    borderTopWidth: 3, borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 8, left: 8,
    borderBottomWidth: 3, borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 8, right: 8,
    borderBottomWidth: 3, borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0edff",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  shareBtnText: {
    color: "#6f63ff",
    fontSize: 14,
    fontWeight: "700",
  },
});
