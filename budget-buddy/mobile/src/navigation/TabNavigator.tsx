import React, { useState, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Keyboard } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { colors, shadows } from '../theme';

import DashboardScreen from '../screens/DashboardScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import SettlementsScreen from '../screens/SettlementsScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import GroupsScreen from '../screens/GroupsScreen';
import FriendsScreen from '../screens/FriendsScreen';
import BudgetScreen from '../screens/BudgetScreen';
import ProfileScreen from '../screens/ProfileScreen';

// ─── Type declarations ────────────────────────────────────────────────────────
export type RootStackParamList = {
  Tabs: undefined;
  Profile: undefined;
  Friends: undefined;
  Groups: undefined;
  History: undefined;
  Budget: undefined;
};

export type TabParamList = {
  AddExpense: undefined;
  Home: undefined;
  Settlements: undefined;
  Analytics: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── Custom iOS Modern Tab Bar (Frosted Glass Capsule) ────────────────────────
function CustomTabBar({ state, descriptors, navigation }: any) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (keyboardVisible) return null;

  return (
    <View style={styles.tabContainer}>
      <BlurView
        intensity={Platform.OS === 'web' ? 25 : 75}
        tint="light"
        style={styles.tabBar}
      >
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          // Get exact Web-matching Material Icon names
          let iconName = '';
          if (route.name === 'AddExpense') {
            iconName = 'add-circle';
          } else if (route.name === 'Home') {
            iconName = 'dashboard';
          } else if (route.name === 'Settlements') {
            iconName = 'payments';
          } else if (route.name === 'Analytics') {
            iconName = 'bar-chart';
          }

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabItem}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name={iconName as any}
                size={24}
                color={isFocused ? colors.primary : colors.onSurfaceVariant + '99'}
                style={styles.icon}
              />
              
              {isFocused && (
                <Text style={[
                  styles.tabLabel,
                  {
                    color: colors.primary,
                    fontWeight: '700'
                  }
                ]}>
                  {label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </BlurView>
    </View>
  );
}

// ─── The 4-tab bar (Ordered exactly like Web BottomNav.tsx) ───────────────────
function BottomTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      initialRouteName="AddExpense"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{ tabBarLabel: 'Expense' }}
      />
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="Settlements"
        component={SettlementsScreen}
        options={{ tabBarLabel: 'Settle Up' }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ tabBarLabel: 'Analytics' }}
      />
    </Tab.Navigator>
  );
}

// ─── Root Stack (wraps tabs + modal screens) ──────────────────────────────────
export default function TabNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={BottomTabs} />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ presentation: 'card', animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Friends"
        component={FriendsScreen}
        options={{ presentation: 'card', animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Groups"
        component={GroupsScreen}
        options={{ presentation: 'card', animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="History"
        component={HistoryScreen}
        options={{ presentation: 'card', animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Budget"
        component={BudgetScreen}
        options={{ presentation: 'card', animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  tabBar: {
    flexDirection: 'row',
    width: '90%',
    maxWidth: 400,
    backgroundColor: Platform.OS === 'android' ? 'rgba(255, 255, 255, 0.88)' : 'rgba(255, 255, 255, 0.15)', // transparent glassmorphism for iOS
    borderRadius: 32,
    overflow: 'hidden', // ensures glass blur effect is clipped perfectly to the border radius
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: Platform.OS === 'android' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.35)', // white glass highlight border
    justifyContent: 'space-around',
    alignItems: 'center',
    ...shadows.float,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: 48,
    position: 'relative',
  },
  icon: {
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 9,
    letterSpacing: 0.1,
    textTransform: 'uppercase',
  },
});
