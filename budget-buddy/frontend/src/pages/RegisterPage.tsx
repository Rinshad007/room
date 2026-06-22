import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../api/services';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const res = await authAPI.register({ name: form.name, email: form.email, password: form.password });
      const { access_token, refresh_token } = res.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      const meRes = await authAPI.me();
      setAuth(meRes.data, access_token, refresh_token);
      toast.success('Welcome to Budget Buddy!');
      navigate('/dashboard');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        // Extract message from Pydantic validation error array
        toast.error(detail[0]?.msg || 'Registration failed');
      } else if (typeof detail === 'string') {
        toast.error(detail);
      } else {
        toast.error('Registration failed');
      }
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
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-primary">Create Account</h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Full Name */}
          <div className="flex flex-col gap-1.5">
            <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">Full Name</label>
            <input
              type="text"
              placeholder="Rahul Sharma"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
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
                placeholder="Min. 8 chars (1 letter, 1 digit)"
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
            className="btn-primary w-full mt-2 h-14 disabled:opacity-50"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin">refresh</span>
            ) : (
              'Create Account'
            )}
          </button>
        </form>
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
