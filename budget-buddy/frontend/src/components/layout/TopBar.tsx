import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import { useState, useEffect } from 'react';
import { notificationsAPI } from '../../api/services';
import type { Notification } from '../../types';

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  showNotifications?: boolean;
  right?: React.ReactNode;
}

export default function TopBar({ title = 'Budget Buddy', showBack, showNotifications = true, right }: TopBarProps) {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (showNotifications) {
      notificationsAPI.list().then(r => setNotifications(r.data.notifications)).catch(() => {});
    }
  }, [showNotifications]);

  const unread = notifications.filter(n => !n.is_read).length;

  const handleMarkAll = () => {
    notificationsAPI.readAll().then(() => {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    });
  };

  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'BB';

  return (
    <>
      <header className="fixed top-0 w-full z-50 border-b border-outline-variant/30 shadow-sm bg-surface/80 backdrop-blur-md h-14">
        <div className="flex items-center justify-between px-container-padding h-full w-full max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            {showBack ? (
              <button
                onClick={() => navigate(-1)}
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
        <div className="fixed top-14 right-4 z-50 w-80 glass-panel rounded-2xl overflow-hidden shadow-float max-h-96 overflow-y-auto hide-scrollbar page-enter">
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
