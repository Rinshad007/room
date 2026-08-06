/**
 * upi.ts — React Native port of web's utils/upi.ts
 *
 * Uses React Native's Linking API instead of window.open/navigator.clipboard.
 * Clipboard uses @react-native-async-storage/async-storage is NOT needed here;
 * we use React Native's Clipboard from react-native.
 */
import { Linking, Platform } from 'react-native';
import { Clipboard } from 'react-native';

export interface UpiPaymentParams {
  upiId: string;
  name: string;
  amount: number;
  note?: string;
}

export type UpiApp = 'gpay' | 'phonepe' | 'bhim' | 'generic';

/**
 * Builds standard upi://pay URI.
 */
export function buildRawUpiUrl({ upiId, name, amount, note = 'BudgetBuddy Settlement' }: UpiPaymentParams): string {
  const formattedAmount = Number(amount).toFixed(2);
  const pa = encodeURIComponent(upiId.trim());
  const pn = encodeURIComponent(name.trim());
  const am = encodeURIComponent(formattedAmount);
  const tn = encodeURIComponent(note);
  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`;
}

/**
 * Builds Android intent:// URLs for specific UPI apps.
 * On iOS or web falls back to raw upi:// URI.
 */
export function buildUpiIntentUrl(params: UpiPaymentParams, app: UpiApp = 'gpay'): string {
  const rawUpi = buildRawUpiUrl(params);
  if (Platform.OS !== 'android' || app === 'generic') return rawUpi;

  const schemeAndQuery = rawUpi.replace(/^upi:\/\//, '');
  let packageName = '';
  switch (app) {
    case 'gpay':    packageName = 'com.google.android.apps.nbu.paisa.user'; break;
    case 'phonepe': packageName = 'com.phonepe.app'; break;
    case 'bhim':    packageName = 'in.org.npci.upiapp'; break;
  }
  if (packageName) {
    return `intent://${schemeAndQuery}#Intent;scheme=upi;package=${packageName};end;`;
  }
  return rawUpi;
}

/**
 * QR code image URL via QR Server API (public, no auth).
 */
export function getUpiQrCodeUrl(params: UpiPaymentParams, size = 200): string {
  const rawUpi = buildRawUpiUrl(params);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(rawUpi)}`;
}

/**
 * Launches the UPI payment intent via React Native Linking.
 * Returns 'launched' if deep-link opened, 'copied' if UPI ID was copied to clipboard.
 */
export async function launchUpiPayment(
  params: UpiPaymentParams,
  app: UpiApp = 'gpay'
): Promise<'launched' | 'copied'> {
  const rawUrl = buildRawUpiUrl(params);
  const intentUrl = buildUpiIntentUrl(params, app);

  // Try intent URL first
  try {
    await Linking.openURL(intentUrl);
    return 'launched';
  } catch {
    // Try raw upi:// scheme
    try {
      await Linking.openURL(rawUrl);
      return 'launched';
    } catch {
      // Final fallback: copy UPI ID to clipboard
      Clipboard.setString(params.upiId);
      return 'copied';
    }
  }
}
