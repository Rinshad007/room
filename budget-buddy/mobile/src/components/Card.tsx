/**
 * Card — updated with BlurView glass panel variant matching premium iOS glass style
 */
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, shadows } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: any;
  glass?: boolean;
}

export default function Card({ children, style, glass = false }: CardProps) {
  // On Android, translucent backgrounds with elevation shadows create dark/grey outlines
  // and double-bordered artifacts. Fall back to a solid white card layout.
  if (glass && Platform.OS !== 'android') {
    return (
      <View style={[styles.card, styles.glassContainer, style]}>
        <BlurView intensity={70} tint="light" style={styles.blurStyle}>
          {children}
        </BlurView>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.white, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20, // iOS-style round corners
    ...shadows.card,
    overflow: 'hidden',
  },
  glassContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.50)', // translucent background tint
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)', // white glass highlight border
  },
  blurStyle: {
    padding: 20,
  },
  white: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '24',
    padding: 20,
  },
});
