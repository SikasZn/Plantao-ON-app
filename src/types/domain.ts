// src/types/domain.ts
//
// Tipos de conveniência construídos em cima do database.ts gerado pelo CLI
// (npx supabase gen types typescript --linked). Ficam separados do
// database.ts de propósito: assim, rodar o gen types de novo no futuro só
// sobrescreve o arquivo gerado, sem apagar nada daqui.
import type { Tables } from './database';

export type Hospital = Tables<'hospitals'>;
export type Shift = Tables<'shifts'>;
export type Profile = Tables<'profiles'>;
export type RecurrenceRule = Tables<'recurrence_rules'>;
export type Expense = Tables<'expenses'>;

// 'recurrence' é texto + CHECK no banco (ver migration_payment_day_and_expenses.sql)
export type ExpenseRecurrence = 'monthly' | 'once';

// 'status' e 'plan' são texto livre com CHECK constraint no banco, não um
// enum nativo do Postgres — por isso o gerador não capta os valores
// possíveis automaticamente. Mantemos essas uniões à mão, em sincronia
// com os CHECKs do schema.sql (ver migration_shift_status_passed.sql pro
// 'passed').
export type ShiftStatus = 'pending' | 'paid' | 'passed';
export type UserPlan = 'free' | 'pro';

// Mesmo caso: 'frequency' e 'end_type' são texto + CHECK no banco (ver
// migration_recurrence_rules.sql), não enum nativo.
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';
export type RecurrenceEndType = 'never' | 'on_date';

// Mesmo caso: 'sex' é texto + CHECK (ver migration_profile_birth_date_sex.sql).
// 'unspecified' é "prefiro não informar", escolhido à mão — diferente de
// null, que é "ainda não preencheu esse campo".
export type ProfileSex = 'male' | 'female' | 'unspecified';