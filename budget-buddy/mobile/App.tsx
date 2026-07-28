import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useState, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Animated, PanResponder } from 'react-native';
import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/components/SplashScreen';
import { colors } from './src/theme';

function SwipeableToastWrapper({ children }: { children: React.ReactNode }) {
  const panY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (e, gestureState) => {
        // Only allow swiping up (negative Y)
        if (gestureState.dy < 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dy < -40 || gestureState.vy < -0.4) {
          // Swipe up to hide
          Animated.timing(panY, {
            toValue: -150,
            duration: 180,
            useNativeDriver: true,
          }).start(() => {
            Toast.hide();
            panY.setValue(0);
          });
        } else {
          // Snap back
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  return (
    <Animated.View
      style={{
        transform: [{ translateY: panY }],
        width: '100%',
        alignItems: 'center',
      }}
      {...panResponder.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

const toastConfig: ToastConfig = {
  success: (props) => (
    <SwipeableToastWrapper>
      <BaseToast
        {...props}
        style={{ borderLeftColor: colors.secondary, backgroundColor: colors.bgCard }}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        text1Style={{
          fontSize: 14,
          fontWeight: '600',
          color: colors.primary,
        }}
        text2Style={{
          fontSize: 12,
          color: colors.onSurfaceVariant,
        }}
      />
    </SwipeableToastWrapper>
  ),
  error: (props) => (
    <SwipeableToastWrapper>
      <ErrorToast
        {...props}
        style={{ borderLeftColor: colors.error, backgroundColor: colors.bgCard }}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        text1Style={{
          fontSize: 14,
          fontWeight: '600',
          color: colors.primary,
        }}
        text2Style={{
          fontSize: 12,
          color: colors.onSurfaceVariant,
        }}
      />
    </SwipeableToastWrapper>
  ),
};

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  if (!splashDone) {
    return (
      <SafeAreaProvider>
        <SplashScreen onFinish={() => setSplashDone(true)} />
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppNavigator />
        <Toast config={toastConfig} autoHide={true} visibilityTime={3000} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
