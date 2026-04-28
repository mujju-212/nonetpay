import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { fetchSpendingInsights } from "../../lib/ai";
import type { SpendingAnalytics, SpendingCategory } from "../../types";

function formatCurrency(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function formatChange(value: number | null): string {
  if (value === null) return "New this week";
  if (value === 0) return "No change";
  return value > 0 ? `+${value}%` : `${value}%`;
}

function getChangeTone(value: number | null) {
  if (value === null || value === 0) return "#6f63ff";
  return value > 0 ? "#e14c4c" : "#16a34a";
}

export default function UserInsightsScreen() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<SpendingAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchSpendingInsights();
      setAnalytics(data);
    } catch (err: any) {
      setError(err?.message || "Could not load spending insights");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const topCategory = useMemo(() => analytics?.categories?.[0] || null, [analytics]);

  if (loading) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient colors={["#f7f3ff", "#f9f7ff", "#f3f1ff"]} style={styles.background} />
        <View style={styles.glowTop} />
        <View style={styles.glowRight} />
        <View style={styles.glowBottom} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6f63ff" />
          <Text style={styles.loadingText}>Loading your AI insights...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={["#f7f3ff", "#f9f7ff", "#f3f1ff"]} style={styles.background} />
      <View style={styles.glowTop} />
      <View style={styles.glowRight} />
      <View style={styles.glowBottom} />

      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Spending Insights</Text>
          <Text style={styles.headerSub}>Weekly analytics with AI tips</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadInsights();
            }}
            tintColor="#6f63ff"
          />
        }
      >
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Insights unavailable</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={loadInsights}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </Pressable>
          </View>
        ) : null}

        {analytics ? (
          <>
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>THIS WEEK</Text>
              <Text style={styles.heroAmount}>{formatCurrency(analytics.totalSpentWeek)}</Text>
              <Text style={styles.heroBody}>
                {topCategory
                  ? `${topCategory.label} leads with ${topCategory.share}% of your weekly spend`
                  : "Make a payment this week to unlock category trends"}
              </Text>
              <View style={styles.heroFooter}>
                <Text style={styles.heroFooterLabel}>vs last week</Text>
                <Text style={[styles.heroFooterValue, { color: getChangeTone(analytics.weekChangePct) }]}>
                  {formatChange(analytics.weekChangePct)}
                </Text>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <StatCard
                label="Top Category"
                value={topCategory ? topCategory.label : "No data"}
                hint={topCategory ? formatCurrency(topCategory.amount) : "Start spending"}
              />
              <StatCard
                label="Biggest Payment"
                value={analytics.biggestPayment ? formatCurrency(analytics.biggestPayment.amount) : "No data"}
                hint={analytics.biggestPayment ? analytics.biggestPayment.merchantName : "No payments yet"}
              />
              <StatCard
                label="Pending Sync"
                value={`${analytics.pendingCount}`}
                hint={analytics.pendingCount > 0 ? formatCurrency(analytics.pendingAmount) : "All clear"}
              />
              <StatCard
                label="Balance Gap"
                value={formatCurrency(Math.abs(analytics.balanceGap))}
                hint={analytics.balanceGap === 0 ? "Offline and online match" : "Offline cache differs"}
              />
            </View>

            <View style={styles.aiCard}>
              <Text style={styles.aiTitle}>AI Weekly Report</Text>
              <Text style={styles.aiBody}>{analytics.narrative}</Text>
            </View>

            <View style={styles.tipCard}>
              <Text style={styles.tipTitle}>Smart Tip</Text>
              <Text style={styles.tipBody}>{analytics.savingTip}</Text>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Category Breakdown</Text>
            </View>
            <View style={styles.card}>
              {analytics.categories.length === 0 ? (
                <Text style={styles.emptyText}>No spending categories yet for this week.</Text>
              ) : (
                analytics.categories.map((category) => (
                  <CategoryRow key={category.key} category={category} />
                ))
              )}
            </View>

            <View style={styles.balanceCard}>
              <Text style={styles.balanceTitle}>Wallet Snapshot</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Online balance</Text>
                <Text style={styles.balanceValue}>{formatCurrency(analytics.onlineBalance)}</Text>
              </View>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Offline cached balance</Text>
                <Text style={styles.balanceValue}>
                  {analytics.cachedBalance === null ? "Not available" : formatCurrency(analytics.cachedBalance)}
                </Text>
              </View>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Gap to reconcile</Text>
                <Text style={[styles.balanceValue, analytics.balanceGap !== 0 && styles.balanceValueWarn]}>
                  {formatCurrency(Math.abs(analytics.balanceGap))}
                </Text>
              </View>
            </View>
          </>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statHint}>{hint}</Text>
    </View>
  );
}

function CategoryRow({ category }: { category: SpendingCategory }) {
  return (
    <View style={styles.categoryRow}>
      <View style={styles.categoryHeader}>
        <View>
          <Text style={styles.categoryLabel}>{category.label}</Text>
          <Text style={styles.categoryHint}>{category.count} payment{category.count === 1 ? "" : "s"}</Text>
        </View>
        <Text style={styles.categoryAmount}>{formatCurrency(category.amount)}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(category.share, 6)}%` }]} />
      </View>
      <Text style={styles.progressText}>{category.share}% of weekly spend</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f7f3ff" },
  background: { ...StyleSheet.absoluteFillObject },
  glowTop: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "#efe9ff",
    top: -170,
    left: -100,
    opacity: 0.9,
  },
  glowRight: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "#f3eaff",
    top: 120,
    right: -120,
    opacity: 0.7,
  },
  glowBottom: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#f0f7ff",
    bottom: -160,
    left: -80,
    opacity: 0.7,
  },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: {
    marginTop: 12,
    color: "#8b8fa6",
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.88)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#c6bff3",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  backArrow: { fontSize: 20, color: "#1f2433", fontWeight: "700" },
  headerCenter: { flex: 1, alignItems: "center" },
  title: { fontSize: 22, fontWeight: "800", color: "#1f2433" },
  headerSub: { fontSize: 12, color: "#8b8fa6", marginTop: 2, fontWeight: "600" },
  headerSpacer: { width: 40 },
  scroll: {
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  errorCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#991b1b",
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: "#7f1d1d",
    fontWeight: "600",
  },
  retryBtn: {
    marginTop: 14,
    alignSelf: "flex-start",
    backgroundColor: "#6f63ff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  heroCard: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#b8aef0",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#6f63ff",
  },
  heroAmount: {
    marginTop: 8,
    fontSize: 34,
    fontWeight: "800",
    color: "#1f2433",
  },
  heroBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: "#5f6475",
    fontWeight: "600",
  },
  heroFooter: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroFooterLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b8fa6",
  },
  heroFooterValue: {
    fontSize: 14,
    fontWeight: "800",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 14,
  },
  statCard: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8b8fa6",
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2433",
  },
  statHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: "#6b7280",
    fontWeight: "600",
  },
  aiCard: {
    backgroundColor: "#6f63ff",
    borderRadius: 24,
    padding: 20,
    marginTop: 4,
  },
  aiTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 10,
  },
  aiBody: {
    fontSize: 14,
    lineHeight: 22,
    color: "#f3f0ff",
    fontWeight: "600",
  },
  tipCard: {
    backgroundColor: "#eef8f2",
    borderRadius: 22,
    padding: 18,
    marginTop: 14,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#166534",
    marginBottom: 8,
  },
  tipBody: {
    fontSize: 13,
    lineHeight: 20,
    color: "#166534",
    fontWeight: "600",
  },
  sectionHeader: {
    marginTop: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1f2433",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 22,
    padding: 16,
  },
  emptyText: {
    fontSize: 13,
    color: "#8b8fa6",
    fontWeight: "600",
  },
  categoryRow: {
    marginBottom: 14,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1f2433",
  },
  categoryHint: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#8b8fa6",
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: "#4338ca",
  },
  progressTrack: {
    marginTop: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#efe9ff",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#6f63ff",
  },
  progressText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
  balanceCard: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 22,
    padding: 18,
    marginTop: 14,
  },
  balanceTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1f2433",
    marginBottom: 12,
  },
  balanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6b7280",
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1f2433",
  },
  balanceValueWarn: {
    color: "#d97706",
  },
});
