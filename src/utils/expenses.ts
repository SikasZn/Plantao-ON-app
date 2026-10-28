// src/utils/expenses.ts
//
// Regras dos gastos mensais. Um gasto 'monthly' vale em todo mês de
// start_month até end_month (sem end_month = sem fim) — então "todo mês ele
// entra sozinho", sem nenhuma linha nova no banco. Um gasto 'once' vale só no
// mês de start_month. Os meses são comparados como 'YYYY-MM'.
import type { Expense } from '../types/domain';

export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// 'YYYY-MM' -> 'YYYY-MM-01' (formato da coluna date)
export function monthKeyToDate(key: string): string {
  return `${key}-01`;
}

export function addMonthsToKey(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyOf(d);
}

export function monthKeyToLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const text = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function expenseAppliesToMonth(expense: Expense, key: string): boolean {
  const start = expense.start_month.slice(0, 7);
  if (expense.recurrence === 'once') return start === key;
  if (start > key) return false;
  if (expense.end_month && expense.end_month.slice(0, 7) < key) return false;
  return true;
}

export function expensesForMonth(expenses: Expense[], key: string): Expense[] {
  return expenses.filter((e) => expenseAppliesToMonth(e, key));
}

export function totalForMonth(expenses: Expense[], key: string): number {
  return expensesForMonth(expenses, key).reduce((sum, e) => sum + e.amount, 0);
}

// soma dos 12 meses do ano de referência
export function totalForYear(expenses: Expense[], year: number): number {
  let total = 0;
  for (let m = 1; m <= 12; m++) total += totalForMonth(expenses, `${year}-${String(m).padStart(2, '0')}`);
  return total;
}
