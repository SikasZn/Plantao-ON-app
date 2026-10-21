// src/services/hospitalsService.ts
import { supabase } from '../lib/supabase';
import type { TablesInsert } from '../types/database';
import type { Hospital } from '../types/domain';

export type HospitalInput = Omit<TablesInsert<'hospitals'>, 'user_id'>;

export async function fetchHospitals(): Promise<Hospital[]> {
  const { data, error } = await supabase.from('hospitals').select('*').order('name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createHospital(userId: string, input: HospitalInput): Promise<Hospital> {
  const { data, error } = await supabase
    .from('hospitals')
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateHospital(id: string, input: HospitalInput): Promise<Hospital> {
  const { data, error } = await supabase.from('hospitals').update(input).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteHospital(id: string): Promise<void> {
  const { error } = await supabase.from('hospitals').delete().eq('id', id);
  if (error) {
    // 23503 = violação de foreign key: existem plantões apontando pra esse hospital
    if (error.code === '23503') {
      throw new Error('Não é possível excluir: existem plantões vinculados a este local de trabalho.');
    }
    throw error;
  }
}