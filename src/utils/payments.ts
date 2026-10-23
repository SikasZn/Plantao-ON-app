// src/utils/payments.ts
//
// Regras de "pagamento em atraso", usadas pela tela Financeiro e pela tela
// de Atrasados. Não existe uma data de pagamento separada no plantão: o
// vencimento é o dia em que o plantão terminou.
import dayjs from 'dayjs';
import type { Shift } from '../types/domain';

/**
 * Atrasado = plantão de verdade (tem local de trabalho; Compromisso fica de
 * fora), ainda "A receber", cujo dia de término já passou. Plantão que
 * terminou hoje ainda não conta — só entra no dia seguinte. Repassado
 * ('passed') nunca é atrasado: o dinheiro não é do usuário.
 */
export function isOverdue(shift: Shift, now = dayjs()): boolean {
  return shift.status === 'pending' && !!shift.hospital_id && dayjs(shift.end_at).isBefore(now.startOf('day'));
}

/** Dias corridos desde o fim do plantão (mínimo 1, pra quem está atrasado). */
export function daysOverdue(shift: Shift, now = dayjs()): number {
  return Math.max(1, now.startOf('day').diff(dayjs(shift.end_at).startOf('day'), 'day'));
}

export function formatDaysOverdue(days: number): string {
  return days === 1 ? '1 dia de atraso' : `${days} dias de atraso`;
}
