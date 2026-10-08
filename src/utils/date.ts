// src/utils/date.ts
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

export function formatDate(isoDate: string, pattern = 'DD/MM/YYYY'): string {
  return dayjs(isoDate).format(pattern);
}

export function formatTime(isoDate: string): string {
  return dayjs(isoDate).format('HH:mm');
}

export function formatDateTimeRange(startIso: string, endIso: string): string {
  const start = dayjs(startIso);
  const end = dayjs(endIso);

  if (start.isSame(end, 'day')) {
    return `${start.format('DD/MM')} · ${start.format('HH:mm')} – ${end.format('HH:mm')}`;
  }

  // plantão atravessa a virada do dia (ex.: 22/09 07:00 → 23/09 07:00)
  return `${start.format('DD/MM')} ${start.format('HH:mm')} → ${end.format('DD/MM')} ${end.format('HH:mm')}`;
}

export function durationInHours(startIso: string, endIso: string): number {
  return dayjs(endIso).diff(dayjs(startIso), 'hour', true);
}

// "sexta-feira, 25 de setembro"
export function formatFullDate(isoDate: string): string {
  const text = dayjs(isoDate).format('dddd, D [de] MMMM');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// chave 'YYYY-MM-DD' — usada pelo react-native-calendars e pra agrupar plantões por dia
export function toDateKey(isoDate: string): string {
  return dayjs(isoDate).format('YYYY-MM-DD');
}

export function todayKey(): string {
  return dayjs().format('YYYY-MM-DD');
}

export function formatDayNumber(isoDate: string): string {
  return dayjs(isoDate).format('DD');
}

export function formatMonthAbbrev(isoDate: string): string {
  return dayjs(isoDate).format('MMM').toUpperCase();
}

export function formatMonthYear(isoDate: string): string {
  const text = dayjs(isoDate).format('MMMM [de] YYYY');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatYearOnly(isoDate: string): string {
  return dayjs(isoDate).format('YYYY');
}

// Chave 'YYYY-MM-DD' a partir de um Date local — diferente de toDateKey
// (que recebe uma string ISO), essa pega direto os campos locais do Date
// (getFullYear/getMonth/getDate), sem passar por toISOString (que converte
// pra UTC e, perto da meia-noite, pode cair no dia errado dependendo do
// fuso). Usada pelas regras de recorrência, que guardam a data da 1ª
// ocorrência como data pura (sem hora), não como timestamp.
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Idade em anos completos a partir da data de nascimento (chave
// 'YYYY-MM-DD') — calculada localmente, descontando 1 ano se o aniversário
// deste ano ainda não chegou.
export function calculateAge(birthDateKey: string): number {
  const birth = new Date(`${birthDateKey}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

// Lista todas as chaves 'YYYY-MM-DD' entre duas datas (inclusive) — usada pra
// marcar TODOS os dias que um plantão atravessa no calendário, não só o de início
// (ex.: plantão de 22/09 07:00 até 23/09 07:00 marca 22 E 23).
export function eachDateKeyInRange(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  const cursor = new Date(`${startKey}T00:00:00`);
  const end = new Date(`${endKey}T00:00:00`);

  while (cursor.getTime() <= end.getTime()) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    keys.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}