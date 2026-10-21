// src/navigation/MainTabNavigator.tsx
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  // No Android com a barra de navegação de 3 botões (◀ ● ■) — ou com a
  // navegação por gestos —, o app é desenhado por baixo dela. A altura fixa
  // antiga deixava as abas escondidas atrás dos botões do sistema, então a
  // barra agora soma a margem inferior real do aparelho (insets.bottom).
  const insets = useSafeAreaInsets();
  // +10 deixa as abas um pouco acima dos botões do sistema
  const bottomPadding = Math.max(insets.bottom, 10) + 10;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { height: 54 + bottomPadding, paddingBottom: bottomPadding, paddingTop: 6 },
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
        options={{ title: 'Locais', tabBarIcon: ({ color, size }) => <Building2 color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Mais', tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}