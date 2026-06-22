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
      toast.error(err.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-container-padding">
      {/* Logo area */}
      <div className="flex flex-col items-center gap-4 mb-10">
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
        <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-primary">Sign In</h2>
        
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
            className="btn-primary w-full mt-2 h-14 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin">refresh</span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>


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
