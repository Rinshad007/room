import React, { useState, useEffect } from 'react';
import {
  getPlatform,
  buildUpiUri,
  generateQrCodeDataUrl,
  triggerUpiPayment,
  UpiAppChoice,
  PlatformType,
} from '../utils/upiUtils';

export interface UpiPaymentFlowProps {
  upiId: string;
  payeeName: string;
  amount: number;
  note?: string;
  onClose?: () => void;
}

export const UpiPaymentFlow: React.FC<UpiPaymentFlowProps> = ({
  upiId,
  payeeName,
  amount,
  note = 'Payment',
  onClose,
}) => {
  const [platform, setPlatform] = useState<PlatformType>('desktop');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    const currentPlatform = getPlatform();
    setPlatform(currentPlatform);

    // Generate QR Code data URL for Desktop view
    generateQrCodeDataUrl({ upiId, payeeName, amount, note })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code:', err));
  }, [upiId, payeeName, amount, note]);

  const handlePayClick = (app: UpiAppChoice) => {
    const result = triggerUpiPayment({ upiId, payeeName, amount, note }, app);
    if (result === 'copied') {
      setCopied(true);
      setStatusMessage('UPI ID copied to clipboard! Open your UPI app to pay.');
      setTimeout(() => setCopied(false), 4000);
    } else {
      setStatusMessage(`Launching ${app.toUpperCase()} payment...`);
    }
  };

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <div className="glass-panel p-6 rounded-2xl max-w-md w-full mx-auto space-y-5 text-center shadow-xl border border-outline-variant/20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-outline-variant/10 pb-3">
        <h3 className="font-bold text-lg text-primary">Pay via UPI</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-on-surface-variant/60 hover:text-primary font-bold text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {/* Payment Details Card */}
      <div className="bg-surface-container rounded-xl p-4 space-y-1">
        <p className="text-xs text-on-surface-variant/70">Paying to</p>
        <p className="font-bold text-base text-primary truncate">{payeeName}</p>
        <p className="text-2xl font-bold text-primary mt-1">
          ₹{Number(amount).toFixed(2)}
        </p>
        <p className="text-xs text-on-surface-variant/60">{note}</p>
      </div>

      {/* Platform Dependent View */}
      {platform === 'desktop' ? (
        /* Desktop: Render QR Code */
        <div className="space-y-4 flex flex-col items-center">
          <p className="text-xs text-on-surface-variant/80 font-medium">
            Scan QR code with GPay, PhonePe, or any UPI app
          </p>

          {qrCodeDataUrl ? (
            <div className="p-3 bg-white rounded-xl shadow-md border border-outline-variant/20">
              <img
                src={qrCodeDataUrl}
                alt="UPI QR Code"
                className="w-48 h-48 object-contain"
              />
            </div>
          ) : (
            <div className="w-48 h-48 bg-surface-container rounded-xl animate-pulse flex items-center justify-center">
              <span className="text-xs text-on-surface-variant/60">
                Generating QR...
              </span>
            </div>
          )}

          {/* Copy UPI ID alternative */}
          <div className="w-full pt-2">
            <button
              onClick={handleCopyUpi}
              className="w-full py-2.5 px-4 bg-surface-container hover:bg-surface-container-high rounded-xl text-xs font-semibold text-primary flex items-center justify-center gap-2 border border-outline-variant/20 transition-colors"
            >
              <span>{copied ? '✓ UPI ID Copied!' : `Copy UPI ID: ${upiId}`}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Mobile: Render Direct Trigger Buttons */
        <div className="space-y-3 pt-1">
          <p className="text-xs text-on-surface-variant/80 font-medium">
            Tap your preferred app to pay:
          </p>

          {/* GPay Button */}
          <button
            onClick={() => handlePayClick('gpay')}
            className="w-full py-3 px-4 bg-primary text-on-primary font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-[0.98] transition-transform"
          >
            <span>Pay with Google Pay</span>
          </button>

          {/* PhonePe / Generic Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handlePayClick('phonepe')}
              className="py-2.5 px-3 bg-surface-container hover:bg-surface-container-high text-primary font-semibold text-xs rounded-xl border border-outline-variant/20 active:scale-[0.98] transition-transform"
            >
              PhonePe
            </button>
            <button
              onClick={() => handlePayClick('generic')}
              className="py-2.5 px-3 bg-surface-container hover:bg-surface-container-high text-primary font-semibold text-xs rounded-xl border border-outline-variant/20 active:scale-[0.98] transition-transform"
            >
              Other UPI Apps
            </button>
          </div>
        </div>
      )}

      {/* Status Feedback */}
      {statusMessage && (
        <p className="text-xs font-medium text-secondary animate-fade-in pt-1">
          {statusMessage}
        </p>
      )}
    </div>
  );
};

export default UpiPaymentFlow;
