// src/services/recurrenceRulesService.ts
//
// Série recorrente = uma linha em recurrence_rules (a regra) + N linhas em
// shifts (as ocorrências já "materializadas", geradas a partir da regra).
// Nunca materializamos tudo de uma vez: só uma janela de MATERIALIZATION_
// WINDOW_DAYS à frente, marcada em rule.materialized_until. Isso é o que
// permite uma série "Nunca termina" existir sem precisar de infinitas
// linhas em shifts — ver migration_recurrence_rules.sql pro raciocínio
// completo e utils/recurrence.ts pelo cálculo das datas em si.
import dayjs from 'dayjs';
import { supabase } from '../lib/supabase';
import { generateOccurrenceDates, type RecurrenceRuleConfig } from '../utils/recurrence';
import { createShiftsBatch, type ShiftInput } from './shiftsService';
import type { TablesInsert } from '../types/database';
import type { RecurrenceFrequency, RecurrenceEndType, RecurrenceRule, Shift, ShiftStatus } from '../types/domain';

// Até quantos dias à frente materializamos de uma vez — cobre bastante
// margem de uso normal do app sem gerar uma quantidade grande de linhas à
// toa numa série "Nunca termina".
export const MATERIALIZATION_WINDOW_DAYS = 180;
// Quando a janela já materializada estiver a menos desse tanto de dias de
// "acabar", estendemos mais MATERIALIZATION_WINDOW_DAYS pra frente — mantém
// uma folga confortável sem precisar checar a cada poucos dias.
const MATERIALIZATION_TOPUP_MARGIN_DAYS = 60;

type RecurrenceRuleRow = TablesInsert<'recurrence_rules'>;
// O que quem cria uma série precisa informar — materialized_until fica de
// fora de propósito: é calculado aqui dentro a partir da janela e da data
// de término da própria regra, nunca escolhido por quem chama.
export type RecurrenceRuleInput = Omit<RecurrenceRuleRow, 'user_id' | 'materialized_until'>;

async function insertRecurrenceRule(userId: string, input: Omit<RecurrenceRuleRow, 'user_id'>): Promise<RecurrenceRule> {
  const { data, error } = await supabase
    .from('recurrence_rules')
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function fetchRecurrenceRules(): Promise<RecurrenceRule[]> {
  const { data, error } = await supabase.from('recurrence_rules').select('*');
  if (error) throw error;
  return data ?? [];
}

async function setMaterializedUntil(ruleId: string, date: string): Promise<void> {
  const { error } = await supabase.from('recurrence_rules').update({ materialized_until: date }).eq('id', ruleId);
  if (error) throw error;
}

function ruleConfigFrom(rule: RecurrenceRule): RecurrenceRuleConfig {
  return {
    frequency: rule.frequency as RecurrenceFrequency,
    intervalCount: rule.interval_count,
    weekdays: rule.weekdays ?? [],
    monthDays: rule.month_days ?? [],
    startDate: rule.start_date,
    endType: rule.end_type as RecurrenceEndType,
    endDate: rule.end_date,
  };
}

// Mesma lógica de horário em toda ocorrência: a hora do dia (start_time_
// minutes) e a duração (duration_minutes) vêm da regra, a data vem do motor
// de recorrência. duration_minutes (em vez de guardar hora de início/fim
// separadas) cobre plantão que passa da meia-noite sem ambiguidade — a
// ocorrência sempre dura exatamente o mesmo tanto de tempo da original,
// não importa se atravessa o dia ou não.
function buildOccurrenceInputs(rule: RecurrenceRule, fromDate: string, untilDate: string): ShiftInput[] {
  const dates = generateOccurrenceDates(ruleConfigFrom(rule), fromDate, untilDate);

  return dates.map((date) => {
    const startAt = dayjs(date).startOf('day').add(rule.start_time_minutes, 'minute');
    const endAt = startAt.add(rule.duration_minutes, 'minute');

    return {
      hospital_id: rule.hospital_id,
      color: rule.color,
      shift_type: rule.shift_type,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      total_value: rule.total_value,
      status: rule.status as ShiftStatus,
      is_recurring: true,
      recurrence_group_id: rule.id,
      passed_to: null,
      notes: rule.notes,
    };
  });
}

/**
 * Cria uma série recorrente nova: grava a regra e já materializa a primeira
 * janela de ocorrências (até MATERIALIZATION_WINDOW_DAYS à frente, ou até a
 * data de término da série, o que vier primeiro).
 */
export async function createRecurringSeries(
  userId: string,
  ruleInput: RecurrenceRuleInput
): Promise<{ rule: RecurrenceRule; shifts: Shift[] }> {
  const windowEnd = dayjs(ruleInput.start_date).add(MATERIALIZATION_WINDOW_DAYS, 'day').format('YYYY-MM-DD');
  const materializedUntil =
    ruleInput.end_type === 'on_date' && ruleInput.end_date && ruleInput.end_date < windowEnd
      ? ruleInput.end_date
      : windowEnd;

  const rule = await insertRecurrenceRule(userId, { ...ruleInput, materialized_until: materializedUntil });
  const inputs = buildOccurrenceInputs(rule, rule.start_date, materializedUntil);
  const shifts = inputs.length > 0 ? await createShiftsBatch(userId, inputs) : [];

  return { rule, shifts };
}

// Dashboard, Calendário e Financeiro cada um tem sua própria instância de
// useShifts(), e todas chamam topUpRecurrenceMaterialization ao carregar —
// sem isso, duas telas carregando ao mesmo tempo poderiam materializar a
// mesma ocorrência duas vezes. Esse cache de "chamada em andamento" faz a
// segunda chamada simplesmente esperar o resultado da primeira em vez de
// repetir o trabalho. Isso cobre o caso comum (telas montando no mesmo
// instante); a defesa de verdade contra duplicata é a constraint única em
// shifts (recurrence_group_id, start_at) — ver migration_shifts_recurrence_
// unique_occurrence.sql — que faz um insert duplicado falhar em vez de
// corromper os dados, mesmo numa corrida que esse cache não pegasse.
let inFlightTopUp: Promise<boolean> | null = null;

/**
 * Estende séries cuja janela materializada está acabando (pensado
 * principalmente pra "Nunca termina", mas também cobre término distante).
 * Chamada sempre que os plantões são recarregados (useShifts) — é uma
 * consulta barata (tabela pequena) e só grava algo quando realmente precisa
 * estender. Retorna true quando alguma série foi estendida, pra quem chamou
 * saber que precisa buscar os plantões de novo.
 */
export async function topUpRecurrenceMaterialization(userId: string): Promise<boolean> {
  if (inFlightTopUp) return inFlightTopUp;
  inFlightTopUp = runTopUp(userId).finally(() => {
    inFlightTopUp = null;
  });
  return inFlightTopUp;
}

async function fetchRecurrenceRuleById(ruleId: string): Promise<RecurrenceRule> {
  const { data, error } = await supabase.from('recurrence_rules').select('*').eq('id', ruleId).single();
  if (error) throw error;
  return data;
}

// Termina a regra no dia anterior a `fromDateKey` — depois disso ela nunca
// mais materializa nada a partir dali. Usada tanto por "excluir este e os
// próximos" (a série simplesmente encurta) quanto por "editar este e os
// próximos" (a série antiga encurta e uma nova assume dali em diante — ver
// editFutureOccurrences).
async function truncateRuleBefore(ruleId: string, fromDateKey: string): Promise<void> {
  const endDate = dayjs(fromDateKey).subtract(1, 'day').format('YYYY-MM-DD');
  const { error } = await supabase.from('recurrence_rules').update({ end_type: 'on_date', end_date: endDate }).eq('id', ruleId);
  if (error) throw error;
}

/**
 * "Excluir este e os próximos" (item 3 do documento): termina a série no dia
 * anterior à ocorrência escolhida e apaga essa ocorrência e todas as
 * depois dela. Nunca mexe em ocorrências passadas — a busca e o delete são
 * sempre "start_at >= a desta ocorrência", nunca a série inteira.
 * Retorna as ocorrências apagadas pra quem chamou cancelar o lembrete e o
 * evento da Google Agenda de cada uma (mesma limpeza que já acontece ao
 * excluir uma ocorrência avulsa).
 */
export async function deleteFutureOccurrences(fromShift: Shift): Promise<Shift[]> {
  if (!fromShift.recurrence_group_id) throw new Error('Esse plantão não faz parte de uma série.');
  const fromDateKey = dayjs(fromShift.start_at).format('YYYY-MM-DD');

  await truncateRuleBefore(fromShift.recurrence_group_id, fromDateKey);

  const { data: toDelete, error: fetchError } = await supabase
    .from('shifts')
    .select('*')
    .eq('recurrence_group_id', fromShift.recurrence_group_id)
    .gte('start_at', fromShift.start_at);
  if (fetchError) throw fetchError;

  const { error: deleteError } = await supabase
    .from('shifts')
    .delete()
    .eq('recurrence_group_id', fromShift.recurrence_group_id)
    .gte('start_at', fromShift.start_at);
  if (deleteError) throw deleteError;

  return toDelete ?? [];
}

/**
 * "Editar este e os próximos" (item 3 do documento): a série antiga termina
 * no dia anterior à ocorrência escolhida, e uma série nova nasce a partir
 * dela — mesma periodicidade (frequência/intervalo/dias) da antiga, mas já
 * com os campos editados (hospital, cor, valor, horário etc.), e com o
 * mesmo término que a série antiga tinha. As ocorrências futuras antigas são
 * apagadas e substituídas pelas materializadas da série nova — sempre com
 * status "a receber" (nunca herdam o status/repasse da ocorrência que foi
 * editada, que é um dado daquele dia específico, não da série). A própria
 * ocorrência escolhida só é atualizada (não recriada), já migrada pra série
 * nova.
 *
 * Ocorrências passadas nunca são tocadas: a série antiga continua existindo
 * exatamente como estava até o dia anterior a `editedFields.start_at`.
 */
export type RecurringEditableFields = Pick<
  ShiftInput,
  'hospital_id' | 'color' | 'shift_type' | 'total_value' | 'notes' | 'status' | 'passed_to' | 'start_at' | 'end_at'
>;

export async function editFutureOccurrences(
  fromShift: Shift,
  editedFields: RecurringEditableFields
): Promise<{ updated: Shift; created: Shift[]; removedOld: Shift[] }> {
  if (!fromShift.recurrence_group_id) throw new Error('Esse plantão não faz parte de uma série.');
  const oldRule = await fetchRecurrenceRuleById(fromShift.recurrence_group_id);
  const fromDateKey = dayjs(editedFields.start_at).format('YYYY-MM-DD');
  const startAt = dayjs(editedFields.start_at);

  await truncateRuleBefore(oldRule.id, fromDateKey);

  // ocorrências futuras da série antiga (a escolhida em si fica de fora —
  // ela é atualizada diretamente logo abaixo, não apagada/recriada)
  const { data: removedOld, error: fetchError } = await supabase
    .from('shifts')
    .select('*')
    .eq('recurrence_group_id', oldRule.id)
    .gt('start_at', fromShift.start_at);
  if (fetchError) throw fetchError;

  if (removedOld && removedOld.length > 0) {
    const { error: deleteError } = await supabase
      .from('shifts')
      .delete()
      .eq('recurrence_group_id', oldRule.id)
      .gt('start_at', fromShift.start_at);
    if (deleteError) throw deleteError;
  }

  const windowEnd = dayjs(fromDateKey).add(MATERIALIZATION_WINDOW_DAYS, 'day').format('YYYY-MM-DD');
  const endType = oldRule.end_type as RecurrenceEndType;
  const endDate = endType === 'on_date' ? oldRule.end_date : null;
  const materializedUntil = endType === 'on_date' && endDate && endDate < windowEnd ? endDate : windowEnd;

  const newRule = await insertRecurrenceRule(oldRule.user_id, {
    frequency: oldRule.frequency,
    interval_count: oldRule.interval_count,
    weekdays: oldRule.weekdays,
    month_days: oldRule.month_days,
    start_date: fromDateKey,
    start_time_minutes: startAt.hour() * 60 + startAt.minute(),
    duration_minutes: Math.round((dayjs(editedFields.end_at).valueOf() - startAt.valueOf()) / 60000),
    end_type: endType,
    end_date: endDate,
    hospital_id: editedFields.hospital_id,
    color: editedFields.color,
    shift_type: editedFields.shift_type,
    total_value: editedFields.total_value,
    status: 'pending',
    notes: editedFields.notes,
    materialized_until: materializedUntil,
  });

  const { data: updatedShift, error: updateError } = await supabase
    .from('shifts')
    .update({
      hospital_id: editedFields.hospital_id,
      color: editedFields.color,
      shift_type: editedFields.shift_type,
      start_at: editedFields.start_at,
      end_at: editedFields.end_at,
      total_value: editedFields.total_value,
      status: editedFields.status,
      passed_to: editedFields.passed_to,
      notes: editedFields.notes,
      recurrence_group_id: newRule.id,
    })
    .eq('id', fromShift.id)
    .select()
    .single();
  if (updateError) throw updateError;

  // o resto da série nova (a ocorrência escolhida já foi atualizada acima,
  // não precisa ser gerada de novo)
  const nextDate = dayjs(fromDateKey).add(1, 'day').format('YYYY-MM-DD');
  const futureInputs = buildOccurrenceInputs(newRule, nextDate, materializedUntil);
  const created = futureInputs.length > 0 ? await createShiftsBatch(oldRule.user_id, futureInputs) : [];

  return { updated: updatedShift, created, removedOld: removedOld ?? [] };
}

async function runTopUp(userId: string): Promise<boolean> {
  const rules = await fetchRecurrenceRules();
  const today = dayjs();
  const topUpThreshold = today.add(MATERIALIZATION_TOPUP_MARGIN_DAYS, 'day');

  const pending = rules.filter((rule) => {
    const alreadyFullyMaterialized =
      rule.end_type === 'on_date' && rule.end_date !== null && rule.materialized_until >= rule.end_date;
    if (alreadyFullyMaterialized) return false;
    return dayjs(rule.materialized_until).isBefore(topUpThreshold, 'day');
  });

  if (pending.length === 0) return false;

  let anySucceeded = false;
  for (const rule of pending) {
    try {
      const newWindowEnd = today.add(MATERIALIZATION_WINDOW_DAYS, 'day').format('YYYY-MM-DD');
      const newMaterializedUntil =
        rule.end_type === 'on_date' && rule.end_date && rule.end_date < newWindowEnd ? rule.end_date : newWindowEnd;

      if (newMaterializedUntil <= rule.materialized_until) continue;

      const fromDate = dayjs(rule.materialized_until).add(1, 'day').format('YYYY-MM-DD');
      const inputs = buildOccurrenceInputs(rule, fromDate, newMaterializedUntil);
      if (inputs.length > 0) {
        await createShiftsBatch(userId, inputs);
      }
      await setMaterializedUntil(rule.id, newMaterializedUntil);
      anySucceeded = true;
    } catch {
      // Uma série por vez: se essa falhar (ex.: colidiu com outra sessão
      // estendendo a mesma série ao mesmo tempo — ver a constraint única em
      // shifts), as outras da lista continuam sendo processadas
      // normalmente. Essa série em específico só tenta de novo na próxima
      // vez que os plantões forem recarregados.
    }
  }

  return anySucceeded;
}