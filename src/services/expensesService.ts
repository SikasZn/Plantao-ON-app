// src/services/expensesService.ts
import { supabase } from '../lib/supabase';
import type { TablesInsert, TablesUpdate } from '../types/database';
import type { Expense } from '../types/domain';

export type ExpenseInput = Omit<TablesInsert<'expenses'>, 'user_id'>;

export async function fetchExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase.from('expenses').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createExpense(userId: string, input: ExpenseInput): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateExpense(id: string, input: TablesUpdate<'expenses'>): Promise<Expense> {
  const { data, error } = await supabase.from('expenses').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}
