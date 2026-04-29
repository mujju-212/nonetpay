import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { generateReceiptPdf, shareReceiptOnWhatsApp, shareReceiptPdf } from "../lib/receipts";
import type { UserTransaction } from "../types";

type Props = {
  visible: boolean;
  onClose: () => void;
  transaction: UserTransaction | null;
  userType?: "user" | "merchant";
};

type ViewerIdentity = {
  name: string;
  userId: string;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(transaction: UserTransaction): string {
  if (transaction.status === "failed") return "Rejected by server";
  if (transaction.status === "pending") return "Pending sync";
  if (transaction.status === "synced" && transaction.voucherData?.used) return "Verified offline";
  if (transaction.status === "synced") return "Backed up to cloud";
  if (transaction.category === "voucher_refund") return "Refunded";
  if (transaction.type === "credit") return "Completed";
  return "Processed";
}

function getMerchantName(transaction: UserTransaction): string {
  return (
    transaction.merchantName ||
    transaction.merchantId ||
    transaction.description.replace(/^Paid to\s+/i, "") ||
    "Merchant"
  );
}

export default function TransactionDetailModal({
  visible,
  onClose,
  transaction,
}: Props) {
  const [viewer, setViewer] = useState<ViewerIdentity>({ name: "User", userId: "" });
  const [busyAction, setBusyAction] = useState<"pdf" | "share" | null>(null);

  useEffect(() => {
    if (!visible) return;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem("@user_data");
        if (!raw) return;
        const parsed = JSON.parse(raw);
        setViewer({
          name: parsed.name || "User",
          userId: parsed.userId || "",
        });
      } catch {
        setViewer({ name: "User", userId: "" });
      }
    })();
  }, [visible]);

  const isPayment = useMemo(() => {
    if (!transaction) return false;
    return transaction.type === "debit" || transaction.category === "payment";
  }, [transaction]);

  const statusLabel = transaction ? getStatusLabel(transaction) : "";

  const handleDownloadReceipt = async () => {
    if (!transaction) return;
    try {
      setBusyAction("pdf");
      await shareReceiptPdf({ transaction, payer: viewer });
    } catch (error: any) {
      Alert.alert("Receipt Error", error?.message || "Could not generate receipt");
    } finally {
      setBusyAction(null);
    }
  };

  const handleShareReceipt = async () => {
    if (!transaction) return;
    try {
      setBusyAction("share");
      await shareReceiptOnWhatsApp({ transaction, payer: viewer });
    } catch (error: any) {
      Alert.alert("Share Error", error?.message || "Could not share receipt");
    } finally {
      setBusyAction(null);
    }
  };

  const handlePreviewReceipt = async () => {
    if (!transaction) return;
    try {
      setBusyAction("pdf");
      await generateReceiptPdf({ transaction, payer: viewer });
      await shareReceiptPdf({ transaction, payer: viewer });
    } catch (error: any) {
      Alert.alert("Receipt Error", error?.message || "Could not open receipt");
    } finally {
      setBusyAction(null);
    }
  };

  if (!transaction) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <LinearGradient colors={["#f8f5ff", "#ffffff"]} style={styles.sheetGradient}>
            <View style={styles.handle} />

            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Transaction Details</Text>
                <Text style={styles.subtitle}>Receipt-ready payment summary</Text>
              </View>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              <View style={styles.heroCard}>
                <View style={styles.heroIcon}>
                  <Text style={styles.heroIconText}>
                    {transaction.type === "credit" ? "+" : transaction.status === "failed" ? "!" : "-"}
                  </Text>
                </View>
                <Text style={styles.heroAmount}>
                  {transaction.type === "credit" ? "+" : "-"}₹{Math.abs(transaction.amount).toLocaleString("en-IN")}
                </Text>
                <Text style={styles.heroDescription}>{transaction.description}</Text>
                <View
                  style={[
                    styles.statusPill,
                    transaction.status === "failed"
                      ? styles.statusPillFailed
                      : transaction.status === "pending"
                      ? styles.statusPillPending
                      : styles.statusPillSuccess,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      transaction.status === "failed"
                        ? styles.statusPillTextFailed
                        : transaction.status === "pending"
                        ? styles.statusPillTextPending
                        : styles.statusPillTextSuccess,
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <DetailRow label="Merchant" value={getMerchantName(transaction)} />
                <DetailRow label="Time" value={formatDate(transaction.timestamp)} />
                <DetailRow label="Voucher ID" value={transaction.voucherId || transaction.id} mono />
                {transaction.merchantId ? <DetailRow label="Merchant ID" value={transaction.merchantId} mono /> : null}
                {typeof transaction.balance === "number" ? (
                  <DetailRow label="Balance After" value={`₹${transaction.balance.toLocaleString("en-IN")}`} />
                ) : null}
                {transaction.failureReason ? (
                  <DetailRow label="Failure Reason" value={transaction.failureReason} />
                ) : null}
              </View>

              <View style={styles.noteCard}>
                <Text style={styles.noteTitle}>Security</Text>
                <Text style={styles.noteText}>
                  NONETPAY uses signed vouchers with ECDSA secp256k1. Receipts reflect the current sync status of this transaction.
                </Text>
              </View>

              {isPayment ? (
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.actionBtn, styles.primaryBtn, busyAction && styles.disabledBtn]}
                    onPress={handleDownloadReceipt}
                    disabled={Boolean(busyAction)}
                  >
                    {busyAction === "pdf" ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>PDF Receipt</Text>
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, styles.secondaryBtn, busyAction && styles.disabledBtn]}
                    onPress={handleShareReceipt}
                    disabled={Boolean(busyAction)}
                  >
                    {busyAction === "share" ? (
                      <ActivityIndicator size="small" color="#6f63ff" />
                    ) : (
                      <Text style={styles.secondaryBtnText}>WhatsApp</Text>
                    )}
                  </Pressable>
                </View>
              ) : null}

              {!isPayment ? (
                <Pressable
                  style={[styles.fullBtn, busyAction && styles.disabledBtn]}
                  onPress={handlePreviewReceipt}
                  disabled={Boolean(busyAction)}
                >
                  <Text style={styles.fullBtnText}>Export Summary</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, mono && styles.detailValueMono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(24, 21, 43, 0.48)",
    justifyContent: "flex-end",
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  sheetGradient: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  handle: {
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#ddd8ff",
    alignSelf: "center",
    marginBottom: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1f2433",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "#8b8fa6",
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#f1edff",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#4f46a5",
  },
  scroll: {
    paddingBottom: 12,
  },
  heroCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 20,
    alignItems: "center",
    shadowColor: "#c6bff3",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#efe9ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroIconText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#6f63ff",
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1f2433",
  },
  heroDescription: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#636983",
    textAlign: "center",
  },
  statusPill: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusPillSuccess: { backgroundColor: "#dcfce7" },
  statusPillPending: { backgroundColor: "#fef3c7" },
  statusPillFailed: { backgroundColor: "#fee2e2" },
  statusPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  statusPillTextSuccess: { color: "#027a48" },
  statusPillTextPending: { color: "#b45309" },
  statusPillTextFailed: { color: "#b42318" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 8,
    shadowColor: "#c6bff3",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  detailRow: {
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ece8ff",
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b8fa6",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2433",
  },
  detailValueMono: {
    fontFamily: "monospace",
    fontSize: 13,
  },
  noteCard: {
    backgroundColor: "#f3f0ff",
    borderRadius: 20,
    padding: 16,
    marginTop: 14,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#4338ca",
    marginBottom: 8,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#5f6475",
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 16,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    backgroundColor: "#6f63ff",
  },
  secondaryBtn: {
    backgroundColor: "#f2efff",
    borderWidth: 1,
    borderColor: "#ddd6fe",
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#6f63ff",
  },
  fullBtn: {
    backgroundColor: "#6f63ff",
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  fullBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
  },
  disabledBtn: {
    opacity: 0.7,
  },
});
