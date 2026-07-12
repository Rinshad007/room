import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/services';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [name, setName] = useState('');
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Full Name is required');
      return;
    }
    if (form.password !== form.confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.register({ name: name.trim(), email: form.email, password: form.password });
      const { access_token, refresh_token } = res.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      const meRes = await authAPI.me();
      setAuth(meRes.data, access_token, refresh_token);
      toast.success('Welcome to Budget Buddy!');
      navigate('/add-expense');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        toast.error(detail[0]?.msg || 'Registration failed');
      } else if (typeof detail === 'string') {
        toast.error(detail);
      } else {
        toast.error(err.message || 'Registration failed');
      }
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
      toast.success('Welcome to Budget Buddy!');
      navigate('/add-expense');
    } catch (err: any) {
      toast.error(err.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-container-padding py-8">
      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-float">
          <span className="material-symbols-outlined text-on-primary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            account_balance_wallet
          </span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Budget Buddy</h1>
      </div>

      <div className="glass-panel rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4">
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-primary border-b border-outline-variant/40 pb-2">Create Account</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Full Name</label>
            <input
              type="text"
              placeholder="Rahul Sharma"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input-field"
              autoComplete="name"
              required
            />
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              className="input-field"
              autoComplete="email"
              required
            />
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Password</label>
            <div className="relative w-full">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 chars"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="input-field pr-12"
                autoComplete="new-password"
                required
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

          {/* Confirm Password */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Confirm Password</label>
            <div className="relative w-full">
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repeat password"
                value={form.confirm}
                onChange={e => setForm({ ...form, confirm: e.target.value })}
                className="input-field pr-12"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/60 hover:text-primary active:scale-95 transition-all duration-200 flex items-center justify-center cursor-pointer"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                <span className="material-symbols-outlined select-none text-[20px]">
                  {showConfirm ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2 h-14 disabled:opacity-50 cursor-pointer"
          >
            {loading ? <span className="spinner" /> : 'Create Account'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-[1px] bg-outline-variant/40" />
          <span className="text-xs text-on-surface-variant/60 font-semibold uppercase">or</span>
          <div className="flex-1 h-[1px] bg-outline-variant/40" />
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex items-center justify-center gap-3 border border-outline-variant/60 hover:border-primary/80 bg-surface-container-high rounded-xl h-14 w-full cursor-pointer hover:bg-surface-container-highest transition-all active:scale-[0.98]"
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
        Already have an account?{' '}
        <Link to="/login" className="text-primary font-semibold hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
