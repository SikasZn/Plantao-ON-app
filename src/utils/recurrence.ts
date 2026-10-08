// src/utils/recurrence.ts
//
// Motor de recorrência — puramente cálculo de datas, sem saber nada de
// Supabase nem de shifts. Dada uma regra (RecurrenceRuleConfig), calcula em
// quais datas a série "dispara" dentro de uma janela [rangeStart, rangeEnd].
// Isso é o que permite a série "Nunca termina" existir sem gerar infinitas
// linhas: quem chama decide até quando materializar agora (ver
// recurrenceRulesService.ts), e pode chamar de novo mais pra frente pra
// estender a janela.
//
// Estilo Agenda do iOS: Diariamente (a cada N dias), Semanalmente (dias da
// semana escolhidos, a cada N semanas) ou Mensalmente (dias do mês
// escolhidos, a cada N meses). O quarto modo da tela ("Outros") não é um
// motor à parte — é um atalho de UI que pré-configura Semanalmente
// (quinzenal) ou Mensalmente (no dia de início) sem o usuário precisar
// escolher nada à mão; ver ShiftFormScreen.tsx.
import dayjs, { Dayjs } from 'dayjs';
import type { RecurrenceEndType, RecurrenceFrequency } from '../types/domain';

export interface RecurrenceRuleConfig {
  frequency: RecurrenceFrequency;
  intervalCount: number; // a cada N dias/semanas/meses — sempre >= 1
  weekdays: number[]; // 0 (domingo) a 6 (sábado) — só usado quando frequency === 'weekly'
  monthDays: number[]; // 1 a 31 — só usado quando frequency === 'monthly'
  startDate: string; // 'YYYY-MM-DD' — data da 1ª ocorrência da série
  endType: RecurrenceEndType;
  endDate: string | null; // 'YYYY-MM-DD' — obrigatório quando endType === 'on_date'
}

export const WEEKDAY_LABELS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
export const WEEKDAY_LABELS_FULL = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

function minDate(a: Dayjs, b: Dayjs): Dayjs {
  return a.isBefore(b) ? a : b;
}
function maxDate(a: Dayjs, b: Dayjs): Dayjs {
  return a.isAfter(b) ? a : b;
}

/**
 * Lista as datas ('YYYY-MM-DD') em que a regra dispara dentro de
 * [rangeStart, rangeEnd] (inclusive dos dois lados), nunca além da data de
 * término da própria regra quando houver uma.
 */
export function generateOccurrenceDates(rule: RecurrenceRuleConfig, rangeStart: string, rangeEnd: string): string[] {
  const seriesStart = dayjs(rule.startDate);
  const cappedRangeEnd =
    rule.endType === 'on_date' && rule.endDate ? minDate(dayjs(rangeEnd), dayjs(rule.endDate)) : dayjs(rangeEnd);
  const from = maxDate(dayjs(rangeStart), seriesStart);
  const intervalCount = Math.max(1, rule.intervalCount);

  if (cappedRangeEnd.isBefore(from, 'day')) return [];

  switch (rule.frequency) {
    case 'daily':
      return generateDaily(seriesStart, from, cappedRangeEnd, intervalCount);
    case 'weekly':
      return generateWeekly(seriesStart, from, cappedRangeEnd, intervalCount, rule.weekdays);
    case 'monthly':
      return generateMonthly(seriesStart, from, cappedRangeEnd, intervalCount, rule.monthDays);
    default:
      return [];
  }
}

function generateDaily(seriesStart: Dayjs, from: Dayjs, to: Dayjs, intervalDays: number): string[] {
  const dates: string[] = [];
  // primeiro múltiplo de intervalDays a partir de seriesStart que cai
  // dentro (ou depois) de `from`, pra não perder o alinhamento da série
  // quando a janela pedida começa bem depois do início dela
  const daysSinceStart = from.diff(seriesStart, 'day');
  const stepsToSkip = Math.max(0, Math.ceil(daysSinceStart / intervalDays));
  let cursor = seriesStart.add(stepsToSkip * intervalDays, 'day');

  while (!cursor.isAfter(to, 'day')) {
    if (!cursor.isBefore(from, 'day')) dates.push(cursor.format('YYYY-MM-DD'));
    cursor = cursor.add(intervalDays, 'day');
  }
  return dates;
}

function generateWeekly(seriesStart: Dayjs, from: Dayjs, to: Dayjs, intervalWeeks: number, weekdays: number[]): string[] {
  if (weekdays.length === 0) return [];
  const sortedWeekdays = [...weekdays].sort((a, b) => a - b);
  // domingo da semana da 1ª ocorrência — usa .day() (0=domingo..6=sábado),
  // que é fixo e não depende de locale (diferente de startOf('week'), que
  // varia conforme a localidade configurada e desalinharia o "a cada N
  // semanas")
  let weekStart = seriesStart.subtract(seriesStart.day(), 'day');

  // avança semana a semana (de N em N, mantendo o alinhamento com a semana
  // inicial) até alcançar a primeira semana que pode ter ocorrência dentro de `from`
  while (weekStart.add(6, 'day').isBefore(from, 'day')) {
    weekStart = weekStart.add(intervalWeeks * 7, 'day');
  }

  const dates: string[] = [];
  while (!weekStart.isAfter(to, 'day')) {
    for (const weekday of sortedWeekdays) {
      const occurrence = weekStart.add(weekday, 'day');
      if (occurrence.isBefore(seriesStart, 'day')) continue; // nunca antes da 1ª ocorrência real
      if (occurrence.isBefore(from, 'day') || occurrence.isAfter(to, 'day')) continue;
      dates.push(occurrence.format('YYYY-MM-DD'));
    }
    weekStart = weekStart.add(intervalWeeks * 7, 'day');
  }

  return dates.sort();
}

function generateMonthly(seriesStart: Dayjs, from: Dayjs, to: Dayjs, intervalMonths: number, monthDays: number[]): string[] {
  if (monthDays.length === 0) return [];
  let monthCursor = seriesStart.startOf('month'); // dia 1 nunca varia por locale

  // avança mês a mês (de N em N) até alcançar o primeiro mês que pode ter
  // ocorrência dentro de `from`
  while (monthCursor.add(1, 'month').isBefore(from, 'day')) {
    monthCursor = monthCursor.add(intervalMonths, 'month');
  }

  const dates: string[] = [];
  while (!monthCursor.isAfter(to, 'day')) {
    const daysInMonth = monthCursor.daysInMonth();
    for (const day of monthDays) {
      // dia que não existe nesse mês (ex.: 31 em fevereiro) — pula esse mês
      // pra esse dia específico, em vez de estourar pro mês seguinte
      if (day > daysInMonth) continue;
      const occurrence = monthCursor.date(day);
      if (occurrence.isBefore(seriesStart, 'day')) continue;
      if (occurrence.isBefore(from, 'day') || occurrence.isAfter(to, 'day')) continue;
      dates.push(occurrence.format('YYYY-MM-DD'));
    }
    monthCursor = monthCursor.add(intervalMonths, 'month');
  }

  return dates.sort();
}

/** Resumo em português pra exibir embaixo do seletor de recorrência, ex.: "A cada 2 semanas, às terças e quintas". */
export function describeRecurrenceRule(rule: RecurrenceRuleConfig): string {
  let base: string;
  if (rule.frequency === 'daily') {
    base = rule.intervalCount === 1 ? 'Todos os dias' : `A cada ${rule.intervalCount} dias`;
  } else if (rule.frequency === 'weekly') {
    const days = [...rule.weekdays]
      .sort((a, b) => a - b)
      .map((d) => WEEKDAY_LABELS_FULL[d])
      .join(', ');
    base = rule.intervalCount === 1 ? `Toda semana (${days})` : `A cada ${rule.intervalCount} semanas (${days})`;
  } else {
    const days = [...rule.monthDays].sort((a, b) => a - b).join(', ');
    base =
      rule.intervalCount === 1
        ? `Todo mês, dia(s) ${days}`
        : `A cada ${rule.intervalCount} meses, dia(s) ${days}`;
  }

  if (rule.endType === 'never' || !rule.endDate) return base;
  return `${base} — até ${dayjs(rule.endDate).format('DD/MM/YYYY')}`;
}