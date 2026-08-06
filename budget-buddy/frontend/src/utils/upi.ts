/**
 * upi.ts — Bridge file re-exporting upiUtils to ensure complete backwards compatibility
 * across all existing imports in SettlementsPage.tsx and other web pages.
 */
import {
  buildRawUpiUrl as buildRawUpiUrlUtil,
  triggerUpiPayment as triggerUpiPaymentUtil,
  getPlatform,
} from './upiUtils';
import type { UpiAppChoice } from './upiUtils';

export interface UpiPaymentParams {
  upiId: string;
  name: string;
  amount: number;
  note?: string;
  tr?: string;
}

export type UpiApp = UpiAppChoice;

export function buildRawUpiUrl(params: UpiPaymentParams): string {
  return buildRawUpiUrlUtil({
    upiId: params.upiId,
    payeeName: params.name,
    amount: params.amount,
    note: params.note,
    tr: params.tr,
  });
}

export function getUpiQrCodeUrl(params: UpiPaymentParams, _size = 200): string {
  const rawUpi = buildRawUpiUrl(params);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${_size}x${_size}&data=${encodeURIComponent(rawUpi)}`;
}

export function isAndroid(): boolean {
  return getPlatform() === 'android';
}

export function launchUpiPayment(params: UpiPaymentParams, app: UpiApp = 'gpay'): 'launched' | 'copied' {
  return triggerUpiPaymentUtil(
    {
      upiId: params.upiId,
      payeeName: params.name,
      amount: params.amount,
      note: params.note,
      tr: params.tr,
    },
    app
  );
}

export * from './upiUtils';
