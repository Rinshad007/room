import { NavLink, useLocation } from 'react-router-dom';

const navItems = [
  { to: '/add-expense', icon: 'add_circle', label: 'Expense' },
  { to: '/dashboard', icon: 'dashboard', label: 'Home' },
  { to: '/settlements', icon: 'payments', label: 'Settle Up' },
  { to: '/analytics', icon: 'bar_chart_4_bars', label: 'Analytics' },
];

export default function BottomNav() {
  const { pathname } = useLocation();

  return (
    <nav className="fixed bottom-0 w-full z-50 rounded-t-2xl border-t border-outline-variant/20 shadow-nav bg-surface/90 backdrop-blur-xl">
      <div className="flex justify-around items-center h-16 px-base max-w-lg mx-auto">
        {navItems.map(({ to, icon, label }) => {
          const active = pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={active ? 'nav-item-active' : 'nav-item'}
            >
              {active && (
                <div className="absolute top-1 w-12 h-8 bg-surface-container-high rounded-full -z-10" />
              )}
              <span
                className="material-symbols-outlined mb-1"
                style={active ? { fontVariationSettings: "'FILL' 1" } : {}}
              >
                {icon}
              </span>
              <span className="font-label-caps text-label-caps">{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
