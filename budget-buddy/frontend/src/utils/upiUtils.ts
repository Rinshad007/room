import QRCode from 'qrcode';

export interface UpiPaymentParams {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
  tr?: string;
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
 * Formats raw 10-digit phone numbers into valid VPA addresses if missing bank handle (@handle).
 */
export function formatUpiHandle(rawId: string, app: UpiAppChoice = 'generic'): string {
  const trimmed = (rawId || '').trim();
  if (!trimmed) return '';

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length === 10 && !trimmed.includes('@')) {
    switch (app) {
      case 'gpay':
        return `${digitsOnly}@okaxis`;
      case 'phonepe':
        return `${digitsOnly}@ybl`;
      case 'bhim':
        return `${digitsOnly}@upi`;
      default:
        return `${digitsOnly}@okaxis`;
    }
  }
  return trimmed;
}

/**
 * Constructs raw upi://pay URI query string with strict 2-decimal amount formatting, valid VPA, and unique `tr`.
 */
export function buildRawUpiUrl({
  upiId,
  payeeName,
  amount,
  note = 'Payment',
  tr = generateTransactionRef(),
}: UpiPaymentParams): string {
  const formattedPa = formatUpiHandle(upiId);
  const formattedAmount = Number(amount).toFixed(2);
  const pa = encodeURIComponent(formattedPa);
  const pn = encodeURIComponent((payeeName || 'Payee').trim());
  const am = encodeURIComponent(formattedAmount);
  const tn = encodeURIComponent((note || 'Payment').trim());
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
  const formattedPa = formatUpiHandle(params.upiId, app);
  const formattedAmount = Number(params.amount).toFixed(2);
  const tr = params.tr || generateTransactionRef();

  const pa = encodeURIComponent(formattedPa);
  const pn = encodeURIComponent((params.payeeName || 'Payee').trim());
  const am = encodeURIComponent(formattedAmount);
  const tn = encodeURIComponent((params.note || 'Payment').trim());
  const trRef = encodeURIComponent(tr.trim());

  const query = `pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}&tr=${trRef}`;

  if (platform === 'android' || platform === 'ios') {
    switch (app) {
      case 'gpay':
        return platform === 'android' ? `tez://upi/pay?${query}` : `gpay://upi/pay?${query}`;
      case 'phonepe':
        return `phonepe://pay?${query}`;
      case 'bhim':
        return `upi://pay?${query}`;
      default:
        return `upi://pay?${query}`;
    }
  }

  return `upi://pay?${query}`;
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
 * Trigger payment or fallback copy. Uses native DOM element click for bypass of mobile popup blockers.
 */
export function triggerUpiPayment(
  params: UpiPaymentParams,
  app: UpiAppChoice = 'gpay'
): 'launched' | 'copied' {
  const platform = getPlatform();

  if (!params.upiId || !params.upiId.trim()) {
    return 'copied';
  }

  if (platform === 'android' || platform === 'ios') {
    const primaryUrl = buildUpiUri(params, app, platform);
    const genericUrl = buildRawUpiUrl(params);

    try {
      // 1. Create native hidden anchor and click it to bypass popup blockers
      const a = document.createElement('a');
      a.href = primaryUrl;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // 2. Fallback to generic upi:// scheme after 400ms if primary scheme app is not installed
      setTimeout(() => {
        try {
          const fallbackAnchor = document.createElement('a');
          fallbackAnchor.href = genericUrl;
          fallbackAnchor.style.display = 'none';
          document.body.appendChild(fallbackAnchor);
          fallbackAnchor.click();
          document.body.removeChild(fallbackAnchor);
        } catch {
          window.location.href = genericUrl;
        }
      }, 400);

      return 'launched';
    } catch {
      window.location.href = genericUrl;
      return 'launched';
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(params.upiId).catch(() => {});
  }
  return 'copied';
}
