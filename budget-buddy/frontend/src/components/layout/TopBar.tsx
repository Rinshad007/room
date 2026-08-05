import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { useState, useEffect } from 'react';
import { ref, onValue, update } from 'firebase/database';
import { db } from '../../firebase';
import type { Notification } from '../../types';

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  showNotifications?: boolean;
  right?: React.ReactNode;
  onBack?: () => void;
}

export default function TopBar({ title = 'Budget Buddy', showBack, showNotifications = true, right, onBack }: TopBarProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  const [pendingSettlementsCount, setPendingSettlementsCount] = useState(0);

  // Real-time Firebase listener for notifications & pending settlements
  useEffect(() => {
    if (!showNotifications || !user?.id) return;

    const notifRef = ref(db, 'notifications');
    const unsubNotifs = onValue(notifRef, (snapshot) => {
      if (!snapshot.exists()) {
        setNotifications([]);
        return;
      }
      const all = snapshot.val();
      const userNotifs: Notification[] = [];
      Object.values(all).forEach((n: any) => {
        if (n.user_id === user.id) {
          userNotifs.push(n as Notification);
        }
      });
      userNotifs.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setNotifications(userNotifs);
    });

    const settleRef = ref(db, 'settlements');
    const unsubSettles = onValue(settleRef, (snapshot) => {
      if (!snapshot.exists()) {
        setPendingSettlementsCount(0);
        return;
      }
      const all = snapshot.val();
      let pendingCount = 0;
      Object.values(all).forEach((s: any) => {
        if (s.receiver_id === user.id && s.status === 'pending') {
          pendingCount++;
        }
      });
      setPendingSettlementsCount(pendingCount);
    });

    return () => {
      unsubNotifs();
      unsubSettles();
    };
  }, [showNotifications, user?.id]);

  const unreadNotifs = notifications.filter(n => !n.is_read).length;
  const unread = unreadNotifs + pendingSettlementsCount;

  const handleMarkAll = async () => {
    if (!user?.id) return;
    try {
      // Build updates for all unread notifications belonging to this user
      const notifRef = ref(db, 'notifications');
      const { get: fbGet } = await import('firebase/database');
      const snapshot = await fbGet(notifRef);
      if (snapshot.exists()) {
        const updates: Record<string, any> = {};
        Object.entries(snapshot.val()).forEach(([key, n]: [string, any]) => {
          if (n.user_id === user.id && !n.is_read) {
            updates[`notifications/${key}/is_read`] = true;
          }
        });
        if (Object.keys(updates).length > 0) {
          await update(ref(db), updates);
        }
      }
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    }
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'BB';

  return (
    <>
      <header
        className="fixed top-0 w-full z-50 border-b border-outline-variant/30 shadow-sm bg-surface/80 backdrop-blur-md"
        /* pt accounts for iPhone Dynamic Island / notch */
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex items-center justify-between px-container-padding h-14 w-full max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            {showBack ? (
              <button
                onClick={
                  onBack ||
                  (() => {
                    if (window.history.length > 1 && window.history.state?.idx > 0) {
                      navigate(-1);
                    } else {
                      navigate('/add-expense');
                    }
                  })
                }
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high/50 transition-colors active:scale-95"
              >
                <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/profile')}
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs hover:opacity-90 active:scale-95 transition-all"
              >
                {initials}
              </button>
            )}
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-primary">{title}</h1>
          </div>

          <div className="flex items-center gap-2">
            {right}
            <button
              onClick={() => navigate('/friends')}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high/50 transition-colors active:scale-95"
              title="Friends"
            >
              <span className="material-symbols-outlined text-on-surface-variant">group</span>
            </button>
            {showNotifications && (
              <button
                className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high/50 transition-colors active:scale-95"
                onClick={() => setShowPanel(!showPanel)}
              >
                <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
                {unread > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-error text-on-error rounded-full flex items-center justify-center text-[10px] font-bold">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Notification dropdown panel */}
      {showPanel && (
        <div
          className="fixed right-4 z-50 w-80 glass-panel rounded-2xl overflow-hidden shadow-float max-h-96 overflow-y-auto hide-scrollbar page-enter"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3.75rem)' }}
        >
          <div className="flex items-center justify-between p-4 border-b border-outline-variant/30">
            <span className="font-monetary-md text-monetary-md text-primary">Notifications</span>
            {unread > 0 && (
              <button onClick={handleMarkAll} className="text-label-caps text-secondary font-semibold text-xs">
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-on-surface-variant text-sm">No notifications yet</div>
          ) : (
            notifications.slice(0, 10).map(n => (
              <div key={n.id} className={`p-4 border-b border-outline-variant/20 ${!n.is_read ? 'bg-secondary/5' : ''}`}>
                <p className="font-semibold text-sm text-on-surface">{n.title}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{n.message}</p>
                <p className="text-[10px] text-on-surface-variant/60 mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
              </div>
            ))
          )}
        </div>
      )}

      {showPanel && (
        <div className="fixed inset-0 z-40" onClick={() => setShowPanel(false)} />
      )}
    </>
  );
}
