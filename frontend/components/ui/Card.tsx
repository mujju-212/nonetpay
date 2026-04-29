import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  gradient?: boolean;
  gradientColors?: readonly [string, string, ...string[]];
  padding?: number;
}

export function Card({
  children,
  style,
  gradient = false,
  gradientColors = ["rgba(255,255,255,0.95)", "rgba(248,246,255,0.95)"],
  padding = 20,
}: CardProps) {
  if (gradient) {
    return (
      <LinearGradient
        colors={gradientColors}
        style={[styles.card, { padding }, style]}
      >
        {children}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.card, { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 20,
    shadowColor: "#b8aef0",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },
});
