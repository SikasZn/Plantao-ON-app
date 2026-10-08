// src/navigation/MainTabNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Calendar, Wallet, Building2, MoreHorizontal } from 'lucide-react-native';
import type { MainTabParamList } from './types';
import { colors } from '../theme';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { ShiftsListScreen } from '../screens/shifts/ShiftsListScreen';
import { FinancialScreen } from '../screens/financial/FinancialScreen';
import { HospitalsScreen } from '../screens/hospitals/HospitalsScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { height: 64, paddingBottom: 10, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Início', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Shifts"
        component={ShiftsListScreen}
        options={{ title: 'Calendário', tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Financial"
        component={FinancialScreen}
        options={{ title: 'Financeiro', tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Hospitals"
        component={HospitalsScreen}
        options={{ title: 'Hospitais', tabBarIcon: ({ color, size }) => <Building2 color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Mais', tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}