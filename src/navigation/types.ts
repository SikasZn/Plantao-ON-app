// src/navigation/types.ts
import type { Hospital, Shift } from '../types/domain';

export type AuthStackParamList = {
  Login: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Shifts: undefined;
  Financial: undefined;
  Hospitals: undefined;
  Settings: undefined;
};

export type MainStackParamList = {
  Tabs: undefined;
  HospitalForm: { hospital?: Hospital } | undefined;
  ShiftForm: { shift?: Shift; initialDate?: string } | undefined;
  Reports: undefined;
  Profile: undefined;
  GoogleCalendar: undefined;
  Backup: undefined;
};