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
    <div className="min-h-screen bg-background">
      <TopBar title={title} showBack={showBack} right={rightSlot} />
      <main className="pt-14 pb-20">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
