import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { onAuthStateChanged } from 'firebase/auth';
import { get, ref } from 'firebase/database';
import { auth, db } from './firebase';
import { useAuthStore } from './store/auth';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import FriendsPage from './pages/FriendsPage';
import GroupsPage from './pages/GroupsPage';
import AddExpensePage from './pages/AddExpensePage';
import HistoryPage from './pages/HistoryPage';
import SettlementsPage from './pages/SettlementsPage';
import BudgetPage from './pages/BudgetPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ProfilePage from './pages/ProfilePage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AnonymousRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  // UX-003: redirect authenticated users to Dashboard, not Add Expense
  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const { setAuth, logout, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const token = await fbUser.getIdToken();
          const snap = await get(ref(db, `users/${fbUser.uid}`));
          if (snap.exists()) {
            setAuth(snap.val(), token, token);
          } else {
            const fallbackUser = {
              id: fbUser.uid,
              name: fbUser.displayName || fbUser.email || 'User',
              email: fbUser.email || '',
              created_at: new Date().toISOString(),
            };
            setAuth(fallbackUser, token, token);
          }
        } catch (err) {
          console.error('Failed to sync auth user from Firebase DB:', err);
        }
      } else {
        if (isAuthenticated) {
          logout();
        }
      }
      setAuthReady(true);
    });

    return unsubscribe;
  }, [isAuthenticated, setAuth, logout]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="spinner spinner-dark w-8 h-8" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route
            path="/login"
            element={
              <AnonymousRoute>
                <LoginPage />
              </AnonymousRoute>
            }
          />
          <Route
            path="/register"
            element={
              <AnonymousRoute>
                <RegisterPage />
              </AnonymousRoute>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <AnonymousRoute>
                <ForgotPasswordPage />
              </AnonymousRoute>
            }
          />

          {/* Protected Main Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/friends"
            element={
              <ProtectedRoute>
                <FriendsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups"
            element={
              <ProtectedRoute>
                <GroupsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add-expense"
            element={
              <ProtectedRoute>
                <AddExpensePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <HistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settlements"
            element={
              <ProtectedRoute>
                <SettlementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/budget"
            element={
              <ProtectedRoute>
                <BudgetPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          className: 'glass-panel text-primary font-semibold',
          duration: 3000,
        }}
      />
    </QueryClientProvider>
  );
}
