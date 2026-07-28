/**
 * SplashScreen — animated app launch screen
 * Displays the Budget Buddy logo with a smooth zoom-in + fade-in animation
 * then calls onFinish() to transition to the main app.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  StatusBar,
  Text,
} from 'react-native';
import { colors } from '../theme';

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const scale = useRef(new Animated.Value(0.35)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Phase 1 — zoom in + fade in logo
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Phase 2 — fade in tagline text after logo lands
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 380,
        delay: 80,
        useNativeDriver: true,
      }).start(() => {
        // Phase 3 — hold briefly then fade out the whole splash
        Animated.timing(screenOpacity, {
          toValue: 0,
          duration: 420,
          delay: 700,
          useNativeDriver: true,
        }).start(() => {
          onFinish();
        });
      });
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            transform: [{ scale }],
            opacity,
          },
        ]}
      >
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* App Name + Tagline */}
      <Animated.View style={[styles.textWrapper, { opacity: textOpacity }]}>
        <Text style={styles.appName}>Budget Buddy</Text>
        <Text style={styles.tagline}>Split expenses, stay friends</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  logoWrapper: {
    // Shadow so the logo pops during animation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  logo: {
    width: 120,
    height: 120,
  },
  textWrapper: {
    alignItems: 'center',
    gap: 6,
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
    letterSpacing: 0.1,
  },
});
