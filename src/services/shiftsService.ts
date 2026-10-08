// src/services/shiftsService.ts
import { supabase } from '../lib/supabase';
import type { TablesInsert } from '../types/database';
import type { Shift, ShiftStatus } from '../types/domain';

// 'status' vem como string genérica do tipo gerado (é texto + CHECK no
// banco, não enum nativo) — aqui reforçamos pro literal
// 'pending' | 'paid' | 'passed' pra não deixar passar um valor errado sem
// querer.
export type ShiftInput = Omit<TablesInsert<'shifts'>, 'user_id' | 'status'> & { status: ShiftStatus };

export async function fetchShifts(): Promise<Shift[]> {
  const { data, error } = await supabase.from('shifts').select('*').order('start_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createShift(userId: string, input: ShiftInput): Promise<Shift> {
  const { data, error } = await supabase
    .from('shifts')
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// cria vários plantões de uma vez (recorrência) — todos compartilham o mesmo recurrence_group_id
export async function createShiftsBatch(userId: string, inputs: ShiftInput[]): Promise<Shift[]> {
  const rows = inputs.map((input) => ({ ...input, user_id: userId }));
  const { data, error } = await supabase.from('shifts').insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

export async function updateShift(id: string, input: ShiftInput): Promise<Shift> {
  const { data, error } = await supabase.from('shifts').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteShift(id: string): Promise<void> {
  const { error } = await supabase.from('shifts').delete().eq('id', id);
  if (error) throw error;
}

// update "fino" — só a coluna do evento vinculado na Google Agenda, sem
// passar pelo ShiftInput inteiro (evita sobrescrever outros campos à toa
// depois que o evento já foi criado/atualizado do lado do Google)
export async function setShiftGoogleEventId(id: string, googleEventId: string | null): Promise<void> {
  const { error } = await supabase.from('shifts').update({ google_calendar_event_id: googleEventId }).eq('id', id);
  if (error) throw error;
}