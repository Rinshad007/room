import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/dashboard',   icon: 'dashboard',       label: 'Home'      },
  { to: '/add-expense', icon: 'add_circle',       label: 'Expense'   },
  { to: '/settlements', icon: 'payments',         label: 'Settle Up' },
  { to: '/analytics',   icon: 'bar_chart_4_bars', label: 'Analytics' },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    /* Outer wrapper — centres the pill and provides safe-area clearance */
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 10px) + 10px)' }}
    >
      {/* iOS 27–style floating pill */}
      <nav
        className="pointer-events-auto flex items-center gap-1 px-3 py-2 rounded-[28px]"
        style={{
          background: 'rgba(255, 255, 255, 0.72)',
          backdropFilter: 'blur(28px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.8)',
          border: '1px solid rgba(255, 255, 255, 0.55)',
          boxShadow:
            '0 4px 32px rgba(0,0,0,0.10), 0 1.5px 6px rgba(0,0,0,0.07), inset 0 1px 0 rgba(255,255,255,0.8)',
        }}
      >
        {navItems.map(({ to, icon, label }) => {
          const active = pathname === to || (to !== '/dashboard' && pathname.startsWith(to));

          return (
            <NavLink
              key={to}
              to={to}
              className="relative flex flex-col items-center justify-center rounded-[22px] transition-all duration-300 select-none"
              style={{
                minWidth: active ? 80 : 60,
                height: 52,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Active background bubble */}
              {active && (
                <span
                  className="absolute inset-0 rounded-[22px]"
                  style={{
                    background: 'rgba(0,0,0,0.08)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)',
                  }}
                />
              )}

              {/* Icon */}
              <span
                className="material-symbols-outlined relative z-10 transition-all duration-300"
                style={{
                  fontSize: 24,
                  color: active ? '#000000' : 'rgba(0,0,0,0.38)',
                  fontVariationSettings: active ? "'FILL' 1, 'wght' 600" : "'FILL' 0, 'wght' 400",
                  transform: active ? 'scale(1.08)' : 'scale(1)',
                }}
              >
                {icon}
              </span>

              {/* Label — only visible when active */}
              <span
                className="relative z-10 font-semibold overflow-hidden whitespace-nowrap transition-all duration-300"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.02em',
                  color: active ? '#000000' : 'transparent',
                  maxHeight: active ? 14 : 0,
                  opacity: active ? 1 : 0,
                  marginTop: active ? 1 : 0,
                  lineHeight: '14px',
                }}
              >
                {label}
              </span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
