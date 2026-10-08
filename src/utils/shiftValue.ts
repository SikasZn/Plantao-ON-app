// src/utils/shiftValue.ts
//
// Cálculo do valor de um plantão a partir do valor/hora do hospital —
// centralizado aqui pra ser a MESMA lógica usada em todo lugar que precisa
// disso (ShiftFormScreen ao editar/criar um plantão avulso, e o motor de
// recorrência ao materializar cada ocorrência de uma série). Antes desse
// arquivo existir, essa conta só vivia dentro do ShiftFormScreen — o que já
// tinha causado um bug (ver histórico do isValueComputed) e exigiria
// duplicar a mesma fórmula na materialização de recorrência.
import type { Hospital } from '../types/domain';

/**
 * true quando o hospital tem valor/hora cadastrado — nesse caso o valor do
 * plantão é sempre calculado, nunca digitado à mão (mesma regra em toda
 * tela que lida com plantão).
 */
export function hasComputedRate(hospital: Hospital | undefined | null): boolean {
  return !!hospital?.default_hourly_rate;
}

/**
 * Valor do plantão em reais (não centavos) a partir do hospital e do
 * intervalo de horário. Retorna null quando o hospital não tem valor/hora
 * cadastrado (nesse caso o valor é digitado à mão, fora daqui) ou quando o
 * intervalo é inválido (fim antes do início).
 */
export function computeShiftValue(hospital: Hospital | undefined | null, startAt: Date, endAt: Date): number | null {
  if (!hasComputedRate(hospital)) return null;
  const hours = (endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60);
  if (hours <= 0) return null;
  // arredonda em centavos (2 casas) pra nunca guardar dízima de ponto
  // flutuante (ex.: 3 * 33.333... horas) como valor monetário
  return Math.round(hours * hospital!.default_hourly_rate! * 100) / 100;
}