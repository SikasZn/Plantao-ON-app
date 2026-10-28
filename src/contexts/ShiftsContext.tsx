// src/contexts/ShiftsContext.tsx
//
// Estado ÚNICO dos plantões, compartilhado por todas as telas. Antes cada
// tela chamava useShifts() com estado próprio: abrir o formulário de plantão
// disparava uma busca completa (mais a extensão das séries recorrentes) só
// para abrir, e cada tela tinha uma cópia diferente dos dados. Agora a lista
// é carregada uma vez e todas as telas leem e atualizam a mesma.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  fetchShifts,
  createShift,
  updateShift,
  deleteShift,
  updateShiftsStatus,
  type ShiftInput,
} from '../services/shiftsService';
import {
  createRecurringSeries,
  topUpRecurrenceMaterialization,
  deleteFutureOccurrences,
  editFutureOccurrences,
  type RecurrenceRuleInput,
  type RecurringEditableFields,
} from '../services/recurrenceRulesService';
import type { Shift } from '../types/domain';
import { withTimeout } from '../utils/withTimeout';

interface ShiftsContextValue {
  shifts: Shift[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  add: (input: ShiftInput) => Promise<Shift>;
  addRecurringSeries: (ruleInput: RecurrenceRuleInput) => Promise<Shift[]>;
  edit: (id: string, input: ShiftInput) => Promise<Shift>;
  setStatus: (ids: string[], status: 'pending' | 'paid') => Promise<void>;
  remove: (id: string) => Promise<void>;
  removeFutureOccurrences: (fromShift: Shift) => Promise<Shift[]>;
  editAndFutureOccurrences: (
    fromShift: Shift,
    editedFields: RecurringEditableFields
  ) => Promise<{ updated: Shift; created: Shift[]; removedOld: Shift[] }>;
}

const ShiftsContext = createContext<ShiftsContextValue | undefined>(undefined);

export function ShiftsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // carga inicial: estende as séries recorrentes e mostra "carregando"
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let data = await fetchShifts();
      // Estende séries recorrentes "Nunca termina" (ou com término distante)
      // cuja janela já materializada está acabando — best-effort.
      if (user) {
        try {
          const extended = await topUpRecurrenceMaterialization(user.id);
          if (extended) data = await fetchShifts();
        } catch {
          // silenciosamente ignora — não impede o carregamento dos plantões
        }
      }
      setShifts(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // recarga silenciosa (ao voltar o foco para uma aba): só busca a lista, sem
  // piscar a tela de carregamento e sem refazer a extensão das séries
  const refetch = useCallback(async () => {
    try {
      const data = await fetchShifts();
      setShifts(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function add(input: ShiftInput) {
    if (!user) throw new Error('Usuário não autenticado.');
    const created = await withTimeout(createShift(user.id, input));
    setShifts((prev) => [...prev, created].sort((a, b) => a.start_at.localeCompare(b.start_at)));
    return created;
  }

  // Cria uma série recorrente (motor novo, iOS-Calendar-like): grava a
  // regra e já materializa a primeira janela de ocorrências — substitui o
  // antigo "repetir N vezes" com offset fixo. Ver recurrenceRulesService.ts.
  async function addRecurringSeries(ruleInput: RecurrenceRuleInput) {
    if (!user) throw new Error('Usuário não autenticado.');
    const { shifts: created } = await withTimeout(createRecurringSeries(user.id, ruleInput), 45000);
    setShifts((prev) => [...prev, ...created].sort((a, b) => a.start_at.localeCompare(b.start_at)));
    return created;
  }

  async function edit(id: string, input: ShiftInput) {
    const updated = await withTimeout(updateShift(id, input));
    setShifts((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }

  // Marca um ou vários plantões como pagos / a receber (só o status — não mexe
  // em mais nada do plantão). Atualiza a lista local na hora.
  async function setStatus(ids: string[], status: 'pending' | 'paid') {
    if (ids.length === 0) return;
    await withTimeout(updateShiftsStatus(ids, status));
    const idSet = new Set(ids);
    setShifts((prev) => prev.map((s) => (idSet.has(s.id) ? { ...s, status } : s)));
  }

  async function remove(id: string) {
    await deleteShift(id);
    setShifts((prev) => prev.filter((s) => s.id !== id));
  }

  // "Excluir este e os próximos" (item 3 do documento) — termina a série
  // nessa ocorrência e apaga ela e todas as futuras. Retorna os ids
  // apagados pra quem chamou cancelar lembrete/evento da Google Agenda de
  // cada um (mesma limpeza do delete avulso).
  async function removeFutureOccurrences(fromShift: Shift) {
    const removed = await deleteFutureOccurrences(fromShift);
    const removedIds = new Set(removed.map((s) => s.id));
    setShifts((prev) => prev.filter((s) => !removedIds.has(s.id)));
    return removed;
  }

  // "Editar este e os próximos" (item 3 do documento) — aplica os campos
  // editados a essa ocorrência e a todas as futuras da série (nunca às
  // passadas). Por baixo, fecha a série antiga nessa data e abre uma nova
  // com os valores editados — ver editFutureOccurrences no serviço.
  async function editAndFutureOccurrences(fromShift: Shift, editedFields: RecurringEditableFields) {
    const { updated, created, removedOld } = await editFutureOccurrences(fromShift, editedFields);
    const removedIds = new Set(removedOld.map((s) => s.id));
    setShifts((prev) =>
      [...prev.filter((s) => s.id !== updated.id && !removedIds.has(s.id)), updated, ...created].sort((a, b) =>
        a.start_at.localeCompare(b.start_at)
      )
    );
    return { updated, created, removedOld };
  }

  const value = {
    shifts,
    isLoading,
    error,
    refetch,
    add,
    addRecurringSeries,
    edit,
    setStatus,
    remove,
    removeFutureOccurrences,
    editAndFutureOccurrences,
  };

  return <ShiftsContext.Provider value={value}>{children}</ShiftsContext.Provider>;
}

export function useShifts() {
  const context = useContext(ShiftsContext);
  if (!context) throw new Error('useShifts precisa ser usado dentro de um <ShiftsProvider>.');
  return context;
}
