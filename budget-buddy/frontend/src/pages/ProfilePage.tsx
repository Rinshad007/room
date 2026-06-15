import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { usersAPI } from '../api/services';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
    }
  }, [user]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    try {
      setSaving(true);
      const res = await usersAPI.update({ name, email });
      setUser(res.data);
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  if (!user) return null;

  return (
    <Layout>
      <div className="page-container page-enter pb-24">
        <h1 className="text-headline-lg font-bold text-primary px-1">Profile</h1>

        {/* User Card */}
        <section className="glass-panel rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-3xl shadow-md">
            {user.name[0].toUpperCase()}
          </div>
          <div>
            <h2 className="font-bold text-headline-lg-mobile text-primary">{user.name}</h2>
            <p className="text-body-md text-on-surface-variant">{user.email}</p>
          </div>
        </section>

        {/* Form Card */}
        <section className="glass-panel rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-monetary-md text-primary">Edit details</h3>
          
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-label-caps text-on-surface-variant uppercase ml-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field h-12 text-sm bg-surface-container-low"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-label-caps text-on-surface-variant uppercase ml-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field h-12 text-sm bg-surface-container-low"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full h-12 text-sm shadow-none mt-2"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </section>

        {/* Action Button */}
        <button
          onClick={handleLogout}
          className="btn-secondary w-full h-12 text-sm text-error border-error/20 hover:bg-error/5"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          Sign Out
        </button>

      </div>
    </Layout>
  );
}
