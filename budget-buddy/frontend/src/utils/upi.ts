export interface UpiPaymentParams {
  upiId: string;
  name: string;
  amount: number;
  note?: string;
}

export type UpiApp = 'gpay' | 'phonepe' | 'bhim' | 'generic';

/**
 * Builds a standard upi://pay URI query string.
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
 * Generates Android intent:// links for specific UPI apps to avoid
 * Chrome "Not secure" or unhandled scheme errors.
 */
export function buildUpiIntentUrl(params: UpiPaymentParams, app: UpiApp = 'gpay'): string {
  const rawUpi = buildRawUpiUrl(params);
  const isAndroid = /android/i.test(navigator.userAgent);

  if (!isAndroid || app === 'generic') {
    return rawUpi;
  }

  const schemeAndQuery = rawUpi.replace(/^upi:\/\//, '');

  let packageName = '';
  switch (app) {
    case 'gpay':
      packageName = 'com.google.android.apps.nbu.paisa.user';
      break;
    case 'phonepe':
      packageName = 'com.phonepe.app';
      break;
    case 'bhim':
      packageName = 'in.org.npci.upiapp';
      break;
  }

  if (packageName) {
    return `intent://${schemeAndQuery}#Intent;scheme=upi;package=${packageName};end;`;
  }

  return rawUpi;
}

/**
 * Generates a QR Code image URL using QR Server API.
 */
export function getUpiQrCodeUrl(params: UpiPaymentParams, size = 200): string {
  const rawUpi = buildRawUpiUrl(params);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(rawUpi)}`;
}

/**
 * Returns true when running on an Android device.
 */
export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

/**
 * Launches the UPI payment intent.
 * On Android: opens the intent:// or upi:// URL via window.open (preserves gesture, avoids share dialog).
 * On non-Android (desktop / iOS): copies the UPI ID and shows a toast — no deep-link attempt.
 */
export function launchUpiPayment(params: UpiPaymentParams, app: UpiApp = 'gpay'): 'launched' | 'copied' {
  if (isAndroid()) {
    const url = buildUpiIntentUrl(params, app);
    // window.open avoids the browser's "share" overlay that window.location.href triggers
    window.open(url, '_blank');
    return 'launched';
  }
  // Desktop / iOS: deep-links don't work reliably — copy UPI ID instead
  navigator.clipboard.writeText(params.upiId).catch(() => {});
  return 'copied';
}
