import React, { useEffect, useState } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import AuthNavigator from './AuthNavigator';
import TabNavigator from './TabNavigator';
import LoadingSpinner from '../components/LoadingSpinner';
import { colors } from '../theme';

export default function AppNavigator() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <NavigationContainer
      theme={{
        ...DarkTheme,
        dark: true,
        colors: {
          ...DarkTheme.colors,
          primary: colors.primary,
          background: colors.bg,
          card: colors.bgCard,
          text: colors.textPrimary,
          border: colors.border,
          notification: colors.primary,
        },
      }}
    >
      {user ? <TabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
