// src/utils/importParser.ts
//
// Lê plantões de arquivos de outros apps / planilhas:
//  - CSV/TSV (separador , ; ou tab) com colunas como Data, Início, Fim, Local, Valor
//  - ICS (iCalendar): o formato de calendário que Google Agenda, Apple
//    Calendário, Outlook e a maioria dos apps de escala exportam
// Tudo é tolerante: nomes de coluna em pt/en, datas dd/mm/aaaa ou aaaa-mm-dd,
// horas 07:00 / 7h / 07h30, valores "R$ 1.800,00" ou 1800.50.

export interface ParsedShift {
  title: string;
  start: Date;
  end: Date;
  value: number | null;
  notes: string | null;
}

export interface ParseResult {
  shifts: ParsedShift[];
  skipped: number; // linhas/eventos que não deu para entender
  warnings: string[];
}

export function parseImportFile(text: string): ParseResult {
  const clean = text.replace(/^﻿/, '');
  if (/BEGIN:VCALENDAR/i.test(clean)) return parseIcs(clean);
  return parseCsv(clean);
}

// ---------- valores e datas ----------

export function parseMoney(raw: string | undefined): number | null {
  if (!raw) return null;
  let s = raw.replace(/R\$/gi, '').replace(/\s/g, '');
  if (!/\d/.test(s)) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function parseDatePart(raw: string): { y: number; m: number; d: number } | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return { y, m: Number(m[2]), d: Number(m[1]) };
  }
  return null;
}

function parseTimePart(raw: string): { h: number; min: number } | null {
  const s = raw.trim().toLowerCase();
  let m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) m = s.match(/(\d{1,2})\s*h\s*(\d{2})?/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (h > 23 || min > 59) return null;
  return { h, min };
}

function buildDate(date: { y: number; m: number; d: number }, time: { h: number; min: number }): Date | null {
  const result = new Date(date.y, date.m - 1, date.d, time.h, time.min, 0, 0);
  return Number.isNaN(result.getTime()) || result.getMonth() !== date.m - 1 ? null : result;
}

// ---------- CSV ----------

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function splitCsvRecords(text: string): string[] {
  // junta linhas quebradas dentro de aspas
  const records: string[] = [];
  let cur = '';
  let quotes = 0;
  for (const line of text.split(/\r?\n/)) {
    cur = cur ? `${cur}\n${line}` : line;
    quotes += (line.match(/"/g) ?? []).length;
    if (quotes % 2 === 0) {
      if (cur.trim()) records.push(cur);
      cur = '';
      quotes = 0;
    }
  }
  if (cur.trim()) records.push(cur);
  return records;
}

function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

const COLUMN_ALIASES: Record<'date' | 'start' | 'end' | 'title' | 'value' | 'notes', string[]> = {
  date: ['data', 'date', 'dia'],
  start: ['inicio', 'hora inicio', 'hora inicial', 'start', 'start time', 'entrada', 'comeco', 'de'],
  end: ['fim', 'termino', 'hora fim', 'hora final', 'end', 'end time', 'saida', 'ate'],
  title: ['local', 'local de trabalho', 'hospital', 'titulo', 'title', 'nome', 'evento', 'plantao', 'instituicao', 'clinica', 'unidade', 'descricao'],
  value: ['valor', 'value', 'preco', 'total', 'ganho', 'pagamento', 'valor total'],
  notes: ['observacao', 'observacoes', 'obs', 'notas', 'notes', 'anotacoes'],
};

function findColumn(headers: string[], key: keyof typeof COLUMN_ALIASES): number {
  for (const alias of COLUMN_ALIASES[key]) {
    const idx = headers.indexOf(alias);
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseCsv(text: string): ParseResult {
  const records = splitCsvRecords(text);
  const warnings: string[] = [];
  if (records.length < 2) return { shifts: [], skipped: 0, warnings: ['O arquivo está vazio ou não tem linhas de dados.'] };

  const first = records[0];
  const delimiter = [';', '\t', ','].sort(
    (a, b) => (first.split(b).length - 1) - (first.split(a).length - 1)
  )[0];
  const headers = splitCsvLine(first, delimiter).map(normalizeHeader);

  const col = {
    date: findColumn(headers, 'date'),
    start: findColumn(headers, 'start'),
    end: findColumn(headers, 'end'),
    title: findColumn(headers, 'title'),
    value: findColumn(headers, 'value'),
    notes: findColumn(headers, 'notes'),
  };
  if (col.start < 0 && col.date < 0) {
    return {
      shifts: [],
      skipped: records.length - 1,
      warnings: ['Não encontrei as colunas de data e horário. Use cabeçalhos como Data, Início, Fim, Local e Valor.'],
    };
  }

  const shifts: ParsedShift[] = [];
  let skipped = 0;

  for (const record of records.slice(1)) {
    const cells = splitCsvLine(record, delimiter);
    const get = (i: number) => (i >= 0 ? cells[i] ?? '' : '');

    const dateRaw = get(col.date);
    const startRaw = get(col.start);
    const endRaw = get(col.end);

    // data pode vir em coluna própria ou junto do horário ("05/01/2026 07:00")
    const startDate = parseDatePart(dateRaw) ?? parseDatePart(startRaw);
    const startTime = parseTimePart(startRaw);
    if (!startDate || !startTime) {
      skipped++;
      continue;
    }
    const start = buildDate(startDate, startTime);
    if (!start) {
      skipped++;
      continue;
    }

    let end: Date | null = null;
    const endTime = parseTimePart(endRaw);
    if (endTime) {
      const endDate = parseDatePart(endRaw) ?? startDate;
      end = buildDate(endDate, endTime);
      if (end && end.getTime() <= start.getTime()) end = new Date(end.getTime() + 24 * 3600 * 1000); // virou a noite
    }
    if (!end) {
      skipped++;
      continue;
    }

    shifts.push({
      title: get(col.title).trim(),
      start,
      end,
      value: parseMoney(get(col.value)),
      notes: get(col.notes).trim() || null,
    });
  }

  if (col.title < 0) warnings.push('Não encontrei uma coluna de local — os plantões serão agrupados em "Sem nome".');
  return { shifts, skipped, warnings };
}

// ---------- ICS ----------

function unfoldIcs(text: string): string[] {
  return text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
}

function unescapeIcs(s: string): string {
  return s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\;/g, ';').replace(/\\\\/g, '\\');
}

function parseIcsDate(value: string): { date: Date | null; allDay: boolean } {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return { date: null, allDay: false };
  if (!m[4]) return { date: null, allDay: true };
  const [y, mo, d, h, mi, s] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '0'].map(Number);
  const date = m[7] ? new Date(Date.UTC(y, mo - 1, d, h, mi, s)) : new Date(y, mo - 1, d, h, mi, s);
  return { date, allDay: false };
}

function parseIcs(text: string): ParseResult {
  const lines = unfoldIcs(text);
  const shifts: ParsedShift[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  let recurringCount = 0;
  let allDayCount = 0;
  let event: Record<string, string> | null = null;

  for (const line of lines) {
    if (/^BEGIN:VEVENT/i.test(line)) {
      event = {};
      continue;
    }
    if (/^END:VEVENT/i.test(line)) {
      if (event) {
        const start = event.DTSTART ? parseIcsDate(event.DTSTART) : null;
        const end = event.DTEND ? parseIcsDate(event.DTEND) : null;
        if (event.RRULE) recurringCount++;
        if (start?.allDay) allDayCount++;
        if (!start?.date || !end?.date || end.date.getTime() <= start.date.getTime()) {
          skipped++;
        } else {
          const description = unescapeIcs(event.DESCRIPTION ?? '');
          const summary = unescapeIcs(event.SUMMARY ?? '').trim();
          const money = parseMoney(
            (summary + ' ' + description).match(/R\$\s*[\d.]+(?:,\d{2})?/i)?.[0]
          );
          shifts.push({
            title: summary || unescapeIcs(event.LOCATION ?? '').trim(),
            start: start.date,
            end: end.date,
            value: money,
            notes: description.trim() || null,
          });
        }
      }
      event = null;
      continue;
    }
    if (!event) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const name = line.slice(0, idx).split(';')[0].toUpperCase();
    // guarda só a primeira ocorrência de cada campo
    if (!(name in event)) event[name] = line.slice(idx + 1);
  }

  if (allDayCount) warnings.push(`${allDayCount} evento(s) de dia inteiro foram ignorados (sem horário de início/fim).`);
  if (recurringCount)
    warnings.push(`${recurringCount} evento(s) se repetem no calendário original; só a primeira data de cada um foi lida.`);
  return { shifts, skipped, warnings };
}
