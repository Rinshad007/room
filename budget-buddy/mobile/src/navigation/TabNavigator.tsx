import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme';

import DashboardScreen from '../screens/DashboardScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import GroupsScreen from '../screens/GroupsScreen';
import FriendsScreen from '../screens/FriendsScreen';
import SettlementsScreen from '../screens/SettlementsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import BudgetScreen from '../screens/BudgetScreen';
import ProfileScreen from '../screens/ProfileScreen';

export type TabParamList = {
  Dashboard: undefined;
  AddExpense: undefined;
  Groups: undefined;
  Friends: undefined;
  Settlements: undefined;
  History: undefined;
  Analytics: undefined;
  Budget: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const tabItems = [
  { name: 'Dashboard', icon: 'home', label: 'Home' },
  { name: 'History', icon: 'receipt-outline', label: 'History' },
  { name: 'AddExpense', icon: 'add-circle', label: 'Add', isFab: true },
  { name: 'Friends', icon: 'people-outline', label: 'Friends' },
  { name: 'Profile', icon: 'person-outline', label: 'Profile' },
] as const;

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color, size }) => {
          const found = tabItems.find(t => t.name === route.name);
          if (!found) return null;
          if ((found as any).isFab) {
            return (
              <View style={styles.fab}>
                <Ionicons name="add" size={30} color="#fff" />
              </View>
            );
          }
          const icon = (found.icon + (focused ? '' : '')) as keyof typeof Ionicons.glyphMap;
          return <Ionicons name={icon} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: 'History' }} />
      <Tab.Screen name="AddExpense" component={AddExpenseScreen} options={{ tabBarLabel: '' }} />
      <Tab.Screen name="Friends" component={FriendsScreen} options={{ tabBarLabel: 'Friends' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarLabel: 'Profile' }} />
      {/* Hidden tabs accessible via navigation */}
      <Tab.Screen name="Groups" component={GroupsScreen} options={{ tabBarButton: () => null, tabBarLabel: '' }} />
      <Tab.Screen name="Settlements" component={SettlementsScreen} options={{ tabBarButton: () => null, tabBarLabel: '' }} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} options={{ tabBarButton: () => null, tabBarLabel: '' }} />
      <Tab.Screen name="Budget" component={BudgetScreen} options={{ tabBarButton: () => null, tabBarLabel: '' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bgCard,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 64,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
  },
  tabLabel: { fontSize: 11, fontWeight: '500' },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
