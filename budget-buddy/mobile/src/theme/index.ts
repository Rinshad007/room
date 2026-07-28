/**
 * Budget Buddy — Mobile Theme
 * Mirrors the web app's design tokens exactly.
 * Light mode, Material Design 3 inspired, green primary.
 */
import { Platform } from 'react-native';

// ─── Colors (exact match to web's Tailwind config) ────────────────────────────
export const colors = {
  // Backgrounds
  bg: '#f8f9fa',
  bgCard: '#ffffff',
  bgSurface: '#f8f9fa',
  bgSurfaceContainer: '#edeeef',
  bgSurfaceContainerLow: '#f3f4f5',
  bgSurfaceContainerHigh: '#e7e8e9',
  bgSurfaceContainerHighest: '#e1e3e4',

  // Primary (web uses black #000000)
  primary: '#000000',
  primaryContainer: '#1a1c1f',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#838487',

  // Secondary (web uses green #006e2a)
  secondary: '#006e2a',
  secondaryContainer: '#5cfd80',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#00732c',

  // Error / Danger
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',

  // Surface & text
  surface: '#f8f9fa',
  surfaceVariant: '#e1e3e4',
  onSurface: '#191c1d',
  onSurfaceVariant: '#45474a',
  outline: '#76777b',
  outlineVariant: '#c6c6ca',

  // Nav shadow
  shadow: 'rgba(0,0,0,0.04)',
};

// ─── Spacing ──────────────────────────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  // page padding matching web's `px-container-padding`
  pagePadding: 16,
};

// ─── Border Radius ────────────────────────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

// ─── Font Sizes (matching web CSS utilities) ──────────────────────────────────
export const fontSizes = {
  xs: 11,   // label-caps
  sm: 13,
  md: 15,   // body-md ≈ 16px
  lg: 18,   // monetary-md
  xl: 24,   // headline-lg-mobile
  xxl: 28,  // headline-lg
  xxxl: 40, // display-currency
};

// ─── Font Weights ─────────────────────────────────────────────────────────────
export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// ─── Shadows (web's shadow-float, shadow-nav) ─────────────────────────────────
export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  float: {
    shadowColor: '#006e2a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  nav: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
};

// ─── Glass Panel style (web's .glass-panel) ───────────────────────────────────
export const glassPanel = {
  backgroundColor: Platform.OS === 'android' ? '#ffffff' : 'rgba(255,255,255,0.78)',
  borderWidth: 1,
  borderColor: Platform.OS === 'android' ? 'rgba(198,198,202,0.6)' : 'rgba(198,198,202,0.4)',
  ...shadows.card,
};

// ─── Category Colors (matching AnalyticsPage CATEGORY_COLORS) ────────────────
export const categoryColors: Record<string, string> = {
  Food: '#F97316',
  Travel: '#3B82F6',
  Shopping: '#A855F7',
  Rent: '#EF4444',
  Entertainment: '#EC4899',
  Others: '#6B7280',
};

// Chart palette (indigo accent for charts, matching web)
export const chartColors = {
  primary: '#6366f1',
  primaryLight: '#818cf8',
  accent: '#F97316',
  gradient: ['#6366f1', '#818cf8'],
};
