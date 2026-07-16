import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateEmail, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth, db } from '../firebase';
import { ref, onValue } from 'firebase/database';
import Layout from '../components/layout/Layout';
import { usersAPI, telegramAPI } from '../api/services';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [upiId, setUpiId] = useState('');
  const [saving, setSaving] = useState(false);

  // BUG-006: Reauthentication state for email change security gate
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [password, setPassword] = useState('');
  const [reauthenticating, setReauthenticating] = useState(false);

  // Telegram Integration State
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState('');
  const [linkingCode, setLinkingCode] = useState('');
  const [expiresIn, setExpiresIn] = useState(0);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [unlinkingTelegram, setUnlinkingTelegram] = useState(false);

  // Sync Telegram connection status in real-time
  useEffect(() => {
    if (!user) return;
    const dbRef = ref(db, `users/${user.id}/telegramLink`);
    const unsubscribe = onValue(dbRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setTelegramLinked(true);
        setTelegramUsername(data.username || '');
      } else {
        setTelegramLinked(false);
        setTelegramUsername('');
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Countdown timer for one-time linking code
  useEffect(() => {
    if (expiresIn <= 0) return;
    const timer = setInterval(() => {
      setExpiresIn((prev) => {
        if (prev <= 1) {
          setLinkingCode('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresIn]);

  const handleConnectTelegram = async () => {
    setGeneratingCode(true);
    try {
      const res = await telegramAPI.generateCode();
      setLinkingCode(res.code);
      setExpiresIn(res.expires_in_seconds || 600);
      toast.success('Linking code generated successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to generate linking code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Telegram account?')) return;
    setUnlinkingTelegram(true);
    try {
      await telegramAPI.unlink();
      toast.success('Telegram disconnected successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to disconnect Telegram');
    } finally {
      setUnlinkingTelegram(false);
    }
  };

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setUpiId(user.upi_id || '');
    }
  }, [user]);

  const handleUpdate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user || !name.trim() || !email.trim()) return;

    setSaving(true);
    try {
      if (email.trim().toLowerCase() !== user.email.toLowerCase()) {
        if (!showReauthModal) {
          setShowReauthModal(true);
          setSaving(false);
          return;
        }

        setReauthenticating(true);
        const credential = EmailAuthProvider.credential(user.email, password);
        if (auth.currentUser) {
          await reauthenticateWithCredential(auth.currentUser, credential);
          await updateEmail(auth.currentUser, email.trim());
        }
      }

      const res = await usersAPI.update({ name, email: email.trim(), upi_id: upiId });
      setUser(res.data);
      toast.success('Profile updated successfully!');
      setShowReauthModal(false);
      setPassword('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
      setReauthenticating(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  if (!user) return null;

  return (
    <Layout showBack title="Profile" hideBottomNav>
      <div className="page-container page-enter">
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

            <div className="flex flex-col gap-1.5">
              <label className="text-label-caps text-on-surface-variant uppercase ml-1">UPI ID</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. username@bank"
                className="input-field h-12 text-sm bg-surface-container-low"
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

        {/* Telegram Integration Card */}
        <section className="glass-panel rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">telegram</span>
            <h3 className="font-semibold text-monetary-md text-primary">Telegram Integration</h3>
          </div>

          {telegramLinked ? (
            <div className="space-y-3">
              <div className="bg-success/5 border border-success/20 rounded-xl p-3 flex items-center justify-between">
                <div className="text-left">
                  <p className="text-xs text-on-surface-variant font-medium">Status</p>
                  <p className="text-sm font-bold text-success flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-success inline-block"></span>
                    Connected
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-on-surface-variant font-medium">Telegram User</p>
                  <p className="text-sm font-semibold text-primary">@{telegramUsername || 'Connected'}</p>
                </div>
              </div>
              <button
                onClick={handleUnlinkTelegram}
                disabled={unlinkingTelegram}
                className="btn-secondary w-full h-12 text-sm text-error border-error/20 hover:bg-error/5 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">link_off</span>
                {unlinkingTelegram ? 'Disconnecting...' : 'Disconnect Telegram'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-on-surface-variant leading-relaxed text-left">
                Connect your Telegram account to log expenses, check budgets, and receive instant alerts via Telegram.
              </p>
              
              {linkingCode ? (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center space-y-2">
                  <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wider">Your One-Time Linking Code</p>
                  <p className="text-2xl font-mono font-bold text-primary tracking-widest">{linkingCode}</p>
                  <p className="text-[10px] text-on-surface-variant">
                    Expires in {Math.floor(expiresIn / 60)}m {expiresIn % 60}s
                  </p>
                  <div className="text-xs text-on-surface-variant text-left pt-2 border-t border-outline-variant/30 space-y-1">
                    <p className="font-semibold">Steps to link:</p>
                    <p>1. Open our bot <a href={`https://t.me/BudgetBuddyAIBot?start=${linkingCode}`} target="_blank" rel="noreferrer" className="text-primary hover:underline font-bold">@BudgetBuddyAIBot</a></p>
                    <p>2. Send the command: <code className="font-bold bg-surface-container-low px-1 rounded">/link {linkingCode}</code></p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleConnectTelegram}
                  disabled={generatingCode}
                  className="btn-primary w-full h-12 text-sm flex items-center justify-center gap-2 shadow-none"
                >
                  <span className="material-symbols-outlined text-[18px]">telegram</span>
                  {generatingCode ? 'Generating Code...' : 'Connect Telegram'}
                </button>
              )}
            </div>
          )}
        </section>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/friends')}
            className="btn-secondary w-full h-12 text-sm text-primary border-primary/20 hover:bg-primary/5 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">group</span>
            Manage Friends
          </button>

          <button
            onClick={handleLogout}
            className="btn-secondary w-full h-12 text-sm text-error border-error/20 hover:bg-error/5 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Sign Out
          </button>
        </div>

        {/* Reauthentication Modal */}
        {showReauthModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-xl border border-outline-variant/30">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-headline-lg-mobile text-primary">Confirm Password</h3>
                <button
                  onClick={() => {
                    setShowReauthModal(false);
                    setPassword('');
                  }}
                  className="text-on-surface-variant"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <p className="text-xs text-on-surface-variant">
                To update your email address, you must verify your identity by entering your current password.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUpdate();
                }}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-caps text-on-surface-variant uppercase">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter current password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field h-12 text-sm"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReauthModal(false);
                      setPassword('');
                    }}
                    className="flex-1 h-12 border border-outline-variant/40 rounded-xl text-sm font-semibold text-on-surface-variant"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reauthenticating}
                    className="flex-1 btn-primary h-12 text-sm shadow-none"
                  >
                    {reauthenticating ? 'Verifying...' : 'Confirm'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
