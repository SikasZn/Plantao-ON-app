// src/hooks/useShifts.ts
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchShifts, createShift, updateShift, deleteShift, type ShiftInput } from '../services/shiftsService';
import {
  createRecurringSeries,
  topUpRecurrenceMaterialization,
  deleteFutureOccurrences,
  editFutureOccurrences,
  type RecurrenceRuleInput,
  type RecurringEditableFields,
} from '../services/recurrenceRulesService';
import type { Shift } from '../types/domain';

export function useShifts() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let data = await fetchShifts();
      // Estende séries recorrentes "Nunca termina" (ou com término distante)
      // cuja janela já materializada está acabando — best-effort: se isso
      // falhar por qualquer motivo, os plantões já existentes continuam
      // carregando normalmente, só a extensão fica pra próxima vez.
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

  useEffect(() => {
    load();
  }, [load]);

  async function add(input: ShiftInput) {
    if (!user) throw new Error('Usuário não autenticado.');
    const created = await createShift(user.id, input);
    setShifts((prev) => [...prev, created].sort((a, b) => a.start_at.localeCompare(b.start_at)));
    return created;
  }

  // Cria uma série recorrente (motor novo, iOS-Calendar-like): grava a
  // regra e já materializa a primeira janela de ocorrências — substitui o
  // antigo "repetir N vezes" com offset fixo. Ver recurrenceRulesService.ts.
  async function addRecurringSeries(ruleInput: RecurrenceRuleInput) {
    if (!user) throw new Error('Usuário não autenticado.');
    const { shifts: created } = await createRecurringSeries(user.id, ruleInput);
    setShifts((prev) => [...prev, ...created].sort((a, b) => a.start_at.localeCompare(b.start_at)));
    return created;
  }

  async function edit(id: string, input: ShiftInput) {
    const updated = await updateShift(id, input);
    setShifts((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
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

  return {
    shifts,
    isLoading,
    error,
    refetch: load,
    add,
    addRecurringSeries,
    edit,
    remove,
    removeFutureOccurrences,
    editAndFutureOccurrences,
  };
}