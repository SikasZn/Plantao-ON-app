// src/navigation/MainNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { MainStackParamList } from './types';
import { MainTabNavigator } from './MainTabNavigator';
import { HospitalFormScreen } from '../screens/hospitals/HospitalFormScreen';
import { ShiftFormScreen } from '../screens/shifts/ShiftFormScreen';
import { HospitalShiftsScreen } from '../screens/financial/HospitalShiftsScreen';
import { OverdueScreen } from '../screens/financial/OverdueScreen';
import { ReportsScreen } from '../screens/reports/ReportsScreen';
import { ProfileScreen } from '../screens/settings/ProfileScreen';
import { GoogleCalendarScreen } from '../screens/settings/GoogleCalendarScreen';
import { BackupScreen } from '../screens/settings/BackupScreen';
import { SubscriptionScreen } from '../screens/settings/SubscriptionScreen';

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabNavigator} />
      <Stack.Screen
        name="HospitalForm"
        component={HospitalFormScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="ShiftForm"
        component={ShiftFormScreen}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen name="HospitalShifts" component={HospitalShiftsScreen} />
      <Stack.Screen name="Overdue" component={OverdueScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="GoogleCalendar" component={GoogleCalendarScreen} />
      <Stack.Screen name="Backup" component={BackupScreen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
    </Stack.Navigator>
  );
}