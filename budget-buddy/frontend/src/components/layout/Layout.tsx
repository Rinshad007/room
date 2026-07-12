import TopBar from './TopBar';
import BottomNav from './BottomNav';
import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  showBack?: boolean;
  rightSlot?: ReactNode;
}

export default function Layout({ children, title, showBack, rightSlot }: LayoutProps) {
  return (
    /* min-h-dvh: collapses correctly when iOS Safari shows/hides address bar */
    <div className="min-h-[100dvh] bg-background">
      <TopBar title={title} showBack={showBack} right={rightSlot} />
      {/* Dynamic paddingTop accounts for TopBar + notch; pb clears floating pill nav + home indicator */}
      <main
        style={{ 
          paddingTop: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(4.75rem + env(safe-area-inset-bottom, 16px))' 
        }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
