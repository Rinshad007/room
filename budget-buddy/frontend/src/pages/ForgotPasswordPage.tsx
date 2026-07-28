import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
      toast.success('Password reset email sent!');
    } catch (err: any) {
      const msg =
        err.code === 'auth/user-not-found'
          ? 'No account found with that email.'
          : err.message || 'Failed to send reset email';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-container-padding py-8">
      {/* Logo area */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-float">
          <span
            className="material-symbols-outlined text-on-primary text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            lock_reset
          </span>
        </div>
        <div className="text-center">
          <h1 className="font-headline-lg text-headline-lg text-primary">Reset Password</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            We'll send you a reset link
          </p>
        </div>
      </div>

      {/* Card */}
      <div className="glass-panel rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
        {sent ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                mark_email_read
              </span>
            </div>
            <div>
              <p className="font-semibold text-primary text-base">Check your inbox</p>
              <p className="text-sm text-on-surface-variant/70 mt-1">
                A password reset link was sent to <strong>{email}</strong>.
              </p>
            </div>
            <Link
              to="/login"
              className="btn-primary w-full text-center mt-2"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-primary border-b border-outline-variant/40 pb-2">
              Forgot Password
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="input-field"
                  required
                  autoComplete="email"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full mt-2 h-14 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <span className="spinner" /> : 'Send Reset Link'}
              </button>
            </form>

            <p className="text-center text-body-md text-on-surface-variant">
              Remember your password?{' '}
              <Link to="/login" className="text-primary font-semibold hover:underline">
                Sign In
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
