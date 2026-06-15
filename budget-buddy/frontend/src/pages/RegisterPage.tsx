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
      const { access_token, refresh_token, user } = res.data;
      setAuth(user, access_token, refresh_token);
      toast.success('Welcome to Budget Buddy!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Registration failed');
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
          {[
            { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Rahul Sharma', auto: 'name' },
            { label: 'Email', key: 'email', type: 'email', placeholder: 'you@example.com', auto: 'email' },
            { label: 'Password', key: 'password', type: 'password', placeholder: 'Min. 8 characters', auto: 'new-password' },
            { label: 'Confirm Password', key: 'confirm', type: 'password', placeholder: 'Repeat password', auto: 'new-password' },
          ].map(({ label, key, type, placeholder, auto }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="font-label-caps text-label-caps text-on-surface-variant uppercase">{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                value={form[key as keyof typeof form]}
                onChange={e => setForm({ ...form, [key]: e.target.value })}
                className="input-field"
                autoComplete={auto}
                required
              />
            </div>
          ))}

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
