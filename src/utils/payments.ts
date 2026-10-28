// src/utils/payments.ts
//
// Regras de "pagamento em atraso", usadas pela tela Financeiro e pela tela
// de Atrasados.
//
// Vencimento do plantão:
//  - local COM dia de pagamento: a primeira vez que esse dia chega DEPOIS do
//    fim do plantão (plantão de 22/10 num local que paga todo dia 5 vence em
//    05/11; plantão de 02/10 vence em 05/10). Em meses curtos, usa o último
//    dia do mês (dia 31 em fevereiro → 28/29).
//  - local sem dia de pagamento: o próprio dia em que o plantão terminou.
// Fica atrasado quando o vencimento já passou (a partir do dia seguinte).
import dayjs from 'dayjs';
import type { Hospital, Shift } from '../types/domain';

function dayInMonth(month: dayjs.Dayjs, day: number): dayjs.Dayjs {
  return month.date(Math.min(day, month.daysInMonth())).startOf('day');
}

export function dueDateOf(shift: Shift, hospital?: Hospital | null): dayjs.Dayjs {
  const end = dayjs(shift.end_at).startOf('day');
  const paymentDay = hospital?.payment_day;
  if (!paymentDay) return end;
  const sameMonth = dayInMonth(end, paymentDay);
  if (sameMonth.isAfter(end)) return sameMonth;
  return dayInMonth(end.add(1, 'month').startOf('month'), paymentDay);
}

/**
 * Atrasado = plantão de verdade (tem local de trabalho; Compromisso fica de
 * fora), ainda "A receber", cujo vencimento já passou. Repassado ('passed')
 * nunca é atrasado: o dinheiro não é do usuário.
 */
export function isOverdue(shift: Shift, hospital?: Hospital | null, now = dayjs()): boolean {
  if (shift.status !== 'pending' || !shift.hospital_id) return false;
  return dueDateOf(shift, hospital).isBefore(now.startOf('day'));
}

/** Dias corridos desde o vencimento (mínimo 1, pra quem está atrasado). */
export function daysOverdue(shift: Shift, hospital?: Hospital | null, now = dayjs()): number {
  return Math.max(1, now.startOf('day').diff(dueDateOf(shift, hospital), 'day'));
}

export function formatDaysOverdue(days: number): string {
  return days === 1 ? '1 dia de atraso' : `${days} dias de atraso`;
}
