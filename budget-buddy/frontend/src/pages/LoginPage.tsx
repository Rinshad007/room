import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/services';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const loginRes = await authAPI.login(form);
      const { access_token, refresh_token } = loginRes.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      const meRes = await authAPI.me();
      setAuth(meRes.data, access_token, refresh_token);
      toast.success('Welcome back!');
      navigate('/add-expense');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const res = await authAPI.googleLogin();
      const { access_token, refresh_token } = res.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      setAuth(res.data.user, access_token, refresh_token);
      toast.success('Welcome back!');
      navigate('/add-expense');
    } catch (err: any) {
      toast.error(err.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-container-padding py-8">
      {/* Logo area */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-float">
          <span className="material-symbols-outlined text-on-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            account_balance_wallet
          </span>
        </div>
        <div className="text-center">
          <h1 className="font-headline-lg text-headline-lg text-primary">Budget Buddy</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Smart expense splitting</p>
        </div>
      </div>

      {/* Form card */}
      <div className="glass-panel rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-primary border-b border-border/40 pb-2">Sign In</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="input-field"
              required
              autoComplete="email"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Password</label>
            <div className="relative w-full">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="input-field pr-12"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-primary active:scale-95 transition-all duration-200 flex items-center justify-center cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <span className="material-symbols-outlined select-none text-[20px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2 h-14 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin">refresh</span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-[1px] bg-border/40" />
          <span className="text-xs text-on-surface-variant/60 font-semibold uppercase">or</span>
          <div className="flex-1 h-[1px] bg-border/40" />
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex items-center justify-center gap-3 border border-border/60 hover:border-primary/80 bg-surface-container-high rounded-xl h-14 w-full cursor-pointer hover:bg-surface-container-highest transition-all active:scale-[0.98]"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 14.98 1 12 1 7.35 1 3.37 3.65 1.42 7.54l3.9 3.02C6.24 7.65 8.92 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.76 2.91c2.2-2.02 3.67-5 3.67-8.64z"
            />
            <path
              fill="#FBBC05"
              d="M5.32 14.78c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.42 7.4C.51 9.21 0 11.24 0 13.35s.51 4.14 1.42 5.95l3.9-3.52z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.76-2.91c-1.05.7-2.4 1.12-4.2 1.12-3.08 0-5.76-2.61-6.68-5.52l-3.9 3.02C3.37 20.35 7.35 23 12 23z"
            />
          </svg>
          <span className="font-semibold text-on-surface">Continue with Google</span>
        </button>
      </div>

      <p className="mt-6 text-body-md text-on-surface-variant">
        No account?{' '}
        <Link to="/register" className="text-primary font-semibold hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
