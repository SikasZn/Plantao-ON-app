// src/services/importService.ts
//
// Grava no banco os plantões lidos de um arquivo: cria os locais novos e
// insere os plantões em lotes, pulando os que já existem (mesmo local e
// mesmo horário de início) — assim importar o mesmo arquivo duas vezes não
// duplica nada.
import { createHospital } from './hospitalsService';
import { createShiftsBatch, type ShiftInput } from './shiftsService';
import type { Hospital, Shift } from '../types/domain';
import type { ParsedShift } from '../utils/importParser';
import { computeShiftValue } from '../utils/shiftValue';
import { hospitalColorPalette } from '../theme';
import { withTimeout } from '../utils/withTimeout';

export interface ImportGroup {
  key: string; // título normalizado
  title: string;
  shifts: ParsedShift[];
  // 'new' cria um local com o nome do grupo; senão, id de um local existente
  target: 'new' | string;
}

export interface ImportOptions {
  markPastAsPaid: boolean;
}

export interface ImportSummary {
  imported: number;
  duplicates: number;
  hospitalsCreated: number;
  newHospitals: Hospital[];
}

const BATCH_SIZE = 100;

export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function groupParsedShifts(parsed: ParsedShift[], hospitals: Hospital[]): ImportGroup[] {
  const map = new Map<string, ImportGroup>();
  for (const shift of parsed) {
    const key = normalizeTitle(shift.title);
    const group = map.get(key) ?? { key, title: shift.title.trim() || 'Sem nome', shifts: [], target: 'new' as const };
    group.shifts.push(shift);
    map.set(key, group);
  }
  // sugere um local já cadastrado quando o nome bate (igual ou um contém o outro)
  return Array.from(map.values()).map((group) => {
    const match = hospitals.find((h) => {
      const name = normalizeTitle(h.name);
      return !!group.key && (name === group.key || name.includes(group.key) || group.key.includes(name));
    });
    return { ...group, target: match ? match.id : 'new' };
  });
}

export async function importShifts(
  userId: string,
  groups: ImportGroup[],
  hospitals: Hospital[],
  existingShifts: Shift[],
  options: ImportOptions
): Promise<ImportSummary> {
  const hospitalsById = new Map(hospitals.map((h) => [h.id, h]));
  const existingKeys = new Set(existingShifts.map((s) => `${s.hospital_id}|${new Date(s.start_at).getTime()}`));
  const newHospitals: Hospital[] = [];
  const inputs: ShiftInput[] = [];
  let duplicates = 0;
  const now = Date.now();

  let colorIndex = hospitals.length;
  for (const group of groups) {
    let hospital: Hospital | undefined;
    if (group.target === 'new') {
      hospital = await withTimeout(
        createHospital(userId, {
          name: group.title,
          color: hospitalColorPalette[colorIndex % hospitalColorPalette.length],
        })
      );
      colorIndex++;
      newHospitals.push(hospital);
      hospitalsById.set(hospital.id, hospital);
    } else {
      hospital = hospitalsById.get(group.target);
    }
    if (!hospital) continue;

    for (const item of group.shifts) {
      const key = `${hospital.id}|${item.start.getTime()}`;
      if (existingKeys.has(key)) {
        duplicates++;
        continue;
      }
      existingKeys.add(key);

      // valor do arquivo; se não vier, usa a regra do local (hora ou fixo)
      const value = item.value ?? computeShiftValue(hospital, item.start, item.end) ?? 0;
      inputs.push({
        hospital_id: hospital.id,
        color: hospital.color,
        shift_type: null,
        start_at: item.start.toISOString(),
        end_at: item.end.toISOString(),
        total_value: value,
        status: options.markPastAsPaid && item.end.getTime() < now ? 'paid' : 'pending',
        is_recurring: false,
        recurrence_group_id: null,
        passed_to: null,
        notes: item.notes,
      });
    }
  }

  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    await withTimeout(createShiftsBatch(userId, inputs.slice(i, i + BATCH_SIZE)), 45000);
  }

  return { imported: inputs.length, duplicates, hospitalsCreated: newHospitals.length, newHospitals };
}
