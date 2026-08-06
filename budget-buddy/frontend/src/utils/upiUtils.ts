import QRCode from 'qrcode';

export interface UpiPaymentParams {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
  tr?: string; // Transaction reference ID
}

export type PlatformType = 'android' | 'ios' | 'desktop';
export type UpiAppChoice = 'gpay' | 'phonepe' | 'bhim' | 'generic';

/**
 * Detect client platform.
 */
export function getPlatform(): PlatformType {
  if (typeof window === 'undefined' || !navigator) return 'desktop';
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return 'ios';
  return 'desktop';
}

/**
 * Generates unique transaction reference ID (`tr`) to prevent GPay "Limit Reached" / validation errors.
 */
export function generateTransactionRef(): string {
  return `TR${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
}

/**
 * Constructs raw upi://pay URI query string with strict 2-decimal amount formatting and unique `tr`.
 */
export function buildRawUpiUrl({
  upiId,
  payeeName,
  amount,
  note = 'Payment',
  tr = generateTransactionRef(),
}: UpiPaymentParams): string {
  const formattedAmount = Number(amount).toFixed(2); // Strict 2 decimal places e.g. 100.00
  const pa = encodeURIComponent(upiId.trim());
  const pn = encodeURIComponent(payeeName.trim());
  const am = encodeURIComponent(formattedAmount);
  const tn = encodeURIComponent(note.trim());
  const trRef = encodeURIComponent(tr.trim());

  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}&tr=${trRef}`;
}

/**
 * Returns platform-specific URIs for target app & OS.
 */
export function buildUpiUri(
  params: UpiPaymentParams,
  app: UpiAppChoice = 'gpay',
  platform: PlatformType = getPlatform()
): string {
  const rawUpi = buildRawUpiUrl(params);
  const query = rawUpi.replace(/^upi:\/\//, '');

  if (platform === 'android') {
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
      return `intent://${query}#Intent;scheme=upi;package=${packageName};end;`;
    }
    return rawUpi;
  }

  if (platform === 'ios') {
    if (app === 'gpay') {
      return `gpay://upi/pay?${query.replace(/^pay\?/, '')}`;
    }
    return rawUpi;
  }

  return rawUpi;
}

/**
 * Generates Data URL image string for QR Code (used on desktop).
 */
export async function generateQrCodeDataUrl(params: UpiPaymentParams): Promise<string> {
  const upiUrl = buildRawUpiUrl(params);
  return QRCode.toDataURL(upiUrl, {
    width: 250,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

/**
 * Trigger payment or fallback copy.
 */
export function triggerUpiPayment(
  params: UpiPaymentParams,
  app: UpiAppChoice = 'gpay'
): 'launched' | 'copied' {
  const platform = getPlatform();

  if (platform === 'android' || platform === 'ios') {
    const url = buildUpiUri(params, app, platform);
    try {
      window.location.href = url;
      return 'launched';
    } catch {
      // fallback to clipboard copy
    }
  }

  if (navigator.clipboard) {
    navigator.clipboard.writeText(params.upiId).catch(() => {});
  }
  return 'copied';
}
