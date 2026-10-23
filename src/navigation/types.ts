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
  // plantões de um local no período escolhido na tela Financeiro
  // (referenceDate = ISO da data de referência do filtro)
  HospitalShifts: { hospitalId: string; period: 'month' | 'year'; referenceDate: string };
  Overdue: undefined;
  Reports: undefined;
  Profile: undefined;
  GoogleCalendar: undefined;
  Backup: undefined;
  Subscription: undefined;
};