// src/services/reportsService.ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
// 'expo-file-system/legacy' é o caminho que o próprio Expo SDK 52+ manteve
// de propósito pra quem ainda precisa de readAsStringAsync (ler um arquivo
// já existente como base64) — a API nova (File/Paths) é voltada pra
// criar/escrever, não tem um equivalente direto documentado pra isso ainda,
// então usamos a legada só pra essa leitura pontual.
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/currency';
import { formatDate, formatTime, durationInHours } from '../utils/date';
import type { Shift, Hospital } from '../types/domain';

// Mesmo critério de "plantão de verdade" usado na tela Financeiro: Compromisso
// (sem hospital) não entra na contagem de plantões/horas, nem o repassado
// (status 'passed' — as horas não foram trabalhadas pelo usuário).
export interface ReportTotals {
  total: number;
  received: number;
  pending: number;
  shiftsCount: number;
  totalHours: number;
}

function hospitalName(shift: Shift, hospitalsById: Map<string, Hospital>): string {
  // Compromisso não tem hospital (hospital_id null) — mostra o nome digitado
  // nele em vez de "Local removido" (que soaria como um hospital
  // excluído, não como "isso nunca teve hospital")
  if (!shift.hospital_id) return shift.shift_type?.trim() || 'Compromisso';
  return hospitalsById.get(shift.hospital_id)?.name ?? 'Local removido';
}

function sanitizeFileName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

async function shareFile(uri: string, mimeType: string) {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Compartilhamento não está disponível neste dispositivo.');
  }
  await Sharing.shareAsync(uri, { mimeType });
}

// Envia o relatório automaticamente por e-mail, pelo backend — diferente do
// fluxo antigo (expo-mail-composer), que abria o app de e-mail do celular.
// Agora é uma Edge Function do Supabase (send-report-email) que: identifica
// o usuário pelo token da própria sessão, pega o e-mail cadastrado na conta
// dele (nunca um endereço vindo daqui do app) e manda pela Resend. O app
// nunca vê nem escolhe o destinatário — só o backend decide, com base em
// quem está logado.
async function emailFile(uri: string, fileName: string, mimeType: string, subject: string, html: string) {
  const base64Content = await FileSystemLegacy.readAsStringAsync(uri, { encoding: 'base64' });

  const { data, error } = await supabase.functions.invoke('send-report-email', {
    body: { subject, html, fileName, contentType: mimeType, base64Content },
  });

  if (error || !data?.ok) {
    throw new Error('Não foi possível enviar o relatório por e-mail. Tente novamente em instantes.');
  }
}

function escapeCsvField(value: string): string {
  if (value.includes(';') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function buildCsvFile(shifts: Shift[], hospitalsById: Map<string, Hospital>, periodLabel: string): string {
  const header = ['Data', 'Local', 'Tipo', 'Início', 'Fim', 'Horas', 'Valor', 'Status'];
  const lines = shifts.map((shift) => [
    formatDate(shift.start_at),
    hospitalName(shift, hospitalsById),
    shift.shift_type ?? '',
    formatTime(shift.start_at),
    formatTime(shift.end_at),
    durationInHours(shift.start_at, shift.end_at).toFixed(1).replace('.', ','),
    (shift.total_value ?? 0).toFixed(2).replace('.', ','),
    shift.status === 'paid' ? 'Pago' : shift.status === 'passed' ? 'Passado' : 'A receber',
  ]);

  // ';' como separador (não ',') porque é o padrão do Excel em pt-BR — a vírgula
  // já é usada como separador decimal nesse locale.
  const csvContent = [header, ...lines].map((line) => line.map(escapeCsvField).join(';')).join('\n');

  // nome com timestamp pra nunca colidir com um arquivo anterior
  const fileName = `plantoes-${sanitizeFileName(periodLabel)}-${Date.now()}.csv`;
  const file = new File(Paths.cache, fileName);
  file.create();
  // ﻿ (BOM) força o Excel a reconhecer UTF-8 e não corromper acentos
  file.write('﻿' + csvContent);

  return file.uri;
}

export async function exportShiftsAsCSV(
  shifts: Shift[],
  hospitalsById: Map<string, Hospital>,
  periodLabel: string
) {
  const uri = buildCsvFile(shifts, hospitalsById, periodLabel);
  await shareFile(uri, 'text/csv');
}

export async function emailShiftsAsCSV(
  shifts: Shift[],
  hospitalsById: Map<string, Hospital>,
  periodLabel: string
) {
  const uri = buildCsvFile(shifts, hospitalsById, periodLabel);
  await emailFile(
    uri,
    `plantoes-${sanitizeFileName(periodLabel)}.csv`,
    'text/csv',
    `Relatório de plantões — ${periodLabel}`,
    `<p>Segue em anexo o relatório de plantões referente a ${periodLabel}.</p>`
  );
}

async function buildPdfFile(
  shifts: Shift[],
  hospitalsById: Map<string, Hospital>,
  periodLabel: string,
  totals: ReportTotals
): Promise<string> {
  const byHospital = new Map<string, { name: string; color: string; total: number; count: number; hours: number }>();
  shifts.forEach((shift) => {
    // repassado não conta no total "Por hospital" — mesmo raciocínio dos
    // totais da tela de Relatórios, só que aqui dentro do próprio PDF
    if (shift.status === 'passed') return;
    // Compromisso não tem hospital nem valor — fora da quebra "Por hospital"
    if (!shift.hospital_id) return;
    const hospital = hospitalsById.get(shift.hospital_id);
    const entry = byHospital.get(shift.hospital_id) ?? {
      name: hospitalName(shift, hospitalsById),
      color: hospital?.color ?? '#9CA3AF',
      total: 0,
      count: 0,
      hours: 0,
    };
    entry.total += shift.total_value ?? 0;
    entry.count += 1;
    entry.hours += durationInHours(shift.start_at, shift.end_at);
    byHospital.set(shift.hospital_id, entry);
  });

  const hospitalRowsHtml = Array.from(byHospital.values())
    .sort((a, b) => b.total - a.total)
    .map(
      (h) => `
        <tr>
          <td><span class="dot" style="background:${h.color}"></span>${h.name}</td>
          <td>${h.count}</td>
          <td>${h.hours.toFixed(0)}h</td>
          <td>${formatCurrency(h.total)}</td>
        </tr>`
    )
    .join('');

  // com 1 hospital só, a seção "Por hospital" fica redundante com o resumo
  // acima — só faz sentido quando o relatório mistura mais de um
  const hospitalSectionHtml =
    byHospital.size > 1
      ? `
        <h2>Por local de trabalho</h2>
        <table>
          <tr><th>Local</th><th>Plantões</th><th>Horas</th><th>Total</th></tr>
          ${hospitalRowsHtml}
        </table>`
      : '';

  const shiftRowsHtml = shifts
    .map(
      (shift) => `
        <tr>
          <td>${formatDate(shift.start_at)}</td>
          <td>${hospitalName(shift, hospitalsById)}</td>
          <td>${shift.shift_type ?? '—'}</td>
          <td>${formatTime(shift.start_at)}–${formatTime(shift.end_at)}</td>
          <td>${durationInHours(shift.start_at, shift.end_at).toFixed(1)}h</td>
          <td>${formatCurrency(shift.total_value ?? 0)}</td>
          <td class="${
            shift.status === 'paid' ? 'status-paid' : shift.status === 'passed' ? 'status-passed' : 'status-pending'
          }">${shift.status === 'paid' ? 'Pago' : shift.status === 'passed' ? 'Passado' : 'A receber'}</td>
        </tr>`
    )
    .join('');

  const html = `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 24px; color: #111827; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .subtitle { color: #6B7280; font-size: 13px; margin-bottom: 20px; }
          .summary { display: flex; gap: 12px; margin-bottom: 24px; }
          .summary-card { flex: 1; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px; }
          .summary-value { font-size: 18px; font-weight: bold; }
          .summary-label { font-size: 11px; color: #6B7280; margin-top: 2px; }
          h2 { font-size: 15px; margin-top: 24px; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border-bottom: 1px solid #E5E7EB; padding: 6px 8px; text-align: left; }
          th { background: #F5F7FA; }
          .dot { display: inline-block; width: 8px; height: 8px; border-radius: 4px; margin-right: 6px; }
          .status-paid { color: #16A34A; font-weight: 600; }
          .status-pending { color: #F59E0B; font-weight: 600; }
          .status-passed { color: #6B7280; font-weight: 600; }
        </style>
      </head>
      <body>
        <h1>Plantão ON — Relatório de plantões</h1>
        <div class="subtitle">${periodLabel}</div>

        <div class="summary">
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(totals.total)}</div>
            <div class="summary-label">Total do período</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(totals.received)}</div>
            <div class="summary-label">Recebido</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${formatCurrency(totals.pending)}</div>
            <div class="summary-label">A receber</div>
          </div>
        </div>
        <div class="summary">
          <div class="summary-card">
            <div class="summary-value">${totals.shiftsCount}</div>
            <div class="summary-label">${totals.shiftsCount === 1 ? 'Plantão no período' : 'Plantões no período'}</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${totals.totalHours.toFixed(0)}h</div>
            <div class="summary-label">Horas no período</div>
          </div>
        </div>

        ${hospitalSectionHtml}

        <h2>Plantões detalhados</h2>
        <table>
          <tr><th>Data</th><th>Local</th><th>Tipo</th><th>Horário</th><th>Horas</th><th>Valor</th><th>Status</th></tr>
          ${shiftRowsHtml}
        </table>
      </body>
    </html>
  `;

  const { uri } = await Print.printToFileAsync({ html });
  return uri;
}

export async function exportShiftsAsPDF(
  shifts: Shift[],
  hospitalsById: Map<string, Hospital>,
  periodLabel: string,
  totals: ReportTotals
) {
  const uri = await buildPdfFile(shifts, hospitalsById, periodLabel, totals);
  await shareFile(uri, 'application/pdf');
}

export async function emailShiftsAsPDF(
  shifts: Shift[],
  hospitalsById: Map<string, Hospital>,
  periodLabel: string,
  totals: ReportTotals
) {
  const uri = await buildPdfFile(shifts, hospitalsById, periodLabel, totals);
  await emailFile(
    uri,
    `plantoes-${sanitizeFileName(periodLabel)}.pdf`,
    'application/pdf',
    `Relatório de plantões — ${periodLabel}`,
    `<p>Segue em anexo o relatório de plantões referente a ${periodLabel}.</p>`
  );
}