import React from "react";
import { View, Text, Pressable, StyleSheet, SafeAreaView, StatusBar } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

export default function RoleSelectScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#6d7ef6', '#6b62d8', '#6b57c9']}
        style={styles.container}
      >
        <View style={styles.headerSection}>
          <Text style={styles.logoIcon}>💳</Text>
          <Text style={styles.title}>Offline Pay</Text>
          <Text style={styles.subtitle}>Secure • Fast • Offline Payments</Text>
          <View style={styles.featureRow}>
            <View style={styles.featurePill}><Text style={styles.featureText}>🔒 Encrypted</Text></View>
            <View style={styles.featurePill}><Text style={styles.featureText}>⚡ Instant</Text></View>
            <View style={styles.featurePill}><Text style={styles.featureText}>📱 Mobile</Text></View>
          </View>
        </View>

        <View style={styles.cardsSection}>
          <Pressable
            style={[styles.card, styles.userCard]}
            onPress={() => router.push('/login')}
          >
            <View style={[styles.cardIconWrap, styles.userIconWrap]}>
              <Text style={styles.cardIcon}>👤</Text>
            </View>
            <Text style={styles.cardTitle}>Customer Login</Text>
            <Text style={styles.cardSubtitle}>Pay merchants & manage wallet</Text>
          </Pressable>

          <Pressable
            style={[styles.card, styles.merchantCard]}
            onPress={() => router.push('/merchant-login')}
          >
            <View style={[styles.cardIconWrap, styles.merchantIconWrap]}>
              <Text style={styles.cardIcon}>🏪</Text>
            </View>
            <Text style={styles.cardTitle}>Merchant Login</Text>
            <Text style={styles.cardSubtitle}>Accept payments & view sales</Text>
          </Pressable>

          <Pressable
            style={styles.signupRow}
            onPress={() => router.push('/register')}
          >
            <Text style={styles.signupText}>New user? Create account</Text>
            <Text style={styles.signupArrow}>→</Text>
          </Pressable>

          <Pressable
            style={styles.testButton}
            onPress={() => router.push('/test-connection')}
          >
            <Text style={styles.testText}>🔧 Connection Test</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#6d7ef6' },
  container: {
    flex: 1,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  headerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoIcon: { fontSize: 32, marginBottom: 10 },
  title: { 
    fontSize: 34,
    fontWeight: "800",
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: 14,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 10,
  },
  featurePill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  featureText: { fontSize: 12, color: '#ffffff', fontWeight: '600' },
  cardsSection: {
    flex: 1.2,
    justifyContent: 'flex-start',
    width: '100%',
    gap: 14,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#3f3b8c',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  userCard: { borderLeftWidth: 4, borderLeftColor: '#52c27a' },
  merchantCard: { borderLeftWidth: 4, borderLeftColor: '#f6b04a' },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  userIconWrap: { backgroundColor: '#e7f7ee' },
  merchantIconWrap: { backgroundColor: '#fff2df' },
  cardIcon: { fontSize: 22 },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2433',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#7c7f95',
    textAlign: 'center',
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 6,
  },
  signupText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  signupArrow: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  testButton: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    marginTop: 4,
  },
  testText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
});
