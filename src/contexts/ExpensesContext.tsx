// src/contexts/ExpensesContext.tsx
//
// Gastos mensais do usuário, compartilhados entre a tela Financeiro, a lista
// de gastos e o formulário.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  type ExpenseInput,
} from '../services/expensesService';
import type { Expense } from '../types/domain';
import { addMonthsToKey, monthKeyToDate } from '../utils/expenses';
import { withTimeout } from '../utils/withTimeout';

interface ExpensesContextValue {
  expenses: Expense[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  add: (input: ExpenseInput) => Promise<Expense>;
  // altera o gasto inteiro (vale para todos os meses em que ele aparece)
  edit: (id: string, input: Partial<ExpenseInput>) => Promise<void>;
  // Gasto mensal alterado só "a partir de" um mês: encerra o antigo no mês
  // anterior e cria um novo já com os valores editados. Meses passados
  // continuam com o valor que tinham.
  editFromMonth: (expense: Expense, monthKey: string, input: ExpenseInput) => Promise<void>;
  // Para de cobrar o gasto mensal a partir de um mês (o mês escolhido já não conta)
  endFromMonth: (expense: Expense, monthKey: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const ExpensesContext = createContext<ExpensesContextValue | undefined>(undefined);

export function ExpensesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setExpenses(await fetchExpenses());
      setError(null);
    } catch (err) {
      // ex.: tabela ainda não criada no banco — o app segue funcionando sem gastos
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchExpenses()
      .then((data) => {
        if (cancelled) return;
        setExpenses(data);
        setError(null);
      })
      .catch((err: Error) => {
        // ex.: tabela ainda não criada no banco — o app segue sem gastos
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function add(input: ExpenseInput) {
    if (!user) throw new Error('Usuário não autenticado.');
    const created = await withTimeout(createExpense(user.id, input));
    setExpenses((prev) => [...prev, created]);
    return created;
  }

  async function edit(id: string, input: Partial<ExpenseInput>) {
    const updated = await withTimeout(updateExpense(id, input));
    setExpenses((prev) => prev.map((e) => (e.id === id ? updated : e)));
  }

  async function endFromMonth(expense: Expense, monthKey: string) {
    const lastMonth = addMonthsToKey(monthKey, -1);
    if (lastMonth < expense.start_month.slice(0, 7)) {
      // o gasto nem chegou a valer antes desse mês: some por completo
      await remove(expense.id);
      return;
    }
    await edit(expense.id, { end_month: monthKeyToDate(lastMonth) });
  }

  async function editFromMonth(expense: Expense, monthKey: string, input: ExpenseInput) {
    if (!user) throw new Error('Usuário não autenticado.');
    // cria primeiro o novo: se falhar, nada do antigo foi mexido
    await add({ ...input, recurrence: 'monthly', start_month: monthKeyToDate(monthKey), end_month: null });
    await endFromMonth(expense, monthKey);
  }

  async function remove(id: string) {
    await withTimeout(deleteExpense(id));
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  return (
    <ExpensesContext.Provider value={{ expenses, isLoading, error, refetch, add, edit, editFromMonth, endFromMonth, remove }}>
      {children}
    </ExpensesContext.Provider>
  );
}

export function useExpenses() {
  const context = useContext(ExpensesContext);
  if (!context) throw new Error('useExpenses precisa ser usado dentro de um <ExpensesProvider>.');
  return context;
}
