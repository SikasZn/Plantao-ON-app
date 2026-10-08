// src/screens/reports/ReportsScreen.tsx
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, ChevronDown, FileSpreadsheet, FileText, Mail } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { useShifts } from '../../hooks/useShifts';
import { useHospitals } from '../../contexts/HospitalsContext';
import {
  emailShiftsAsCSV,
  emailShiftsAsPDF,
  exportShiftsAsCSV,
  exportShiftsAsPDF,
} from '../../services/reportsService';
import { formatCurrency } from '../../utils/currency';
import { formatMonthYear, formatYearOnly, durationInHours } from '../../utils/date';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';
import type { Hospital } from '../../types/domain';

type Props = NativeStackScreenProps<MainStackParamList, 'Reports'>;
type Period = 'month' | 'year' | 'all';
type BusyAction = 'csv-share' | 'csv-email' | 'pdf-share' | 'pdf-email' | null;

export function ReportsScreen({ navigation }: Props) {
  const { shifts } = useShifts();
  const { hospitals } = useHospitals();
  const [period, setPeriod] = useState<Period>('month');
  const [hospitalFilter, setHospitalFilter] = useState<string | null>(null);
  const [isHospitalPickerOpen, setIsHospitalPickerOpen] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

  const hospitalsById = useMemo(() => {
    const map = new Map<string, Hospital>();
    hospitals.forEach((h) => map.set(h.id, h));
    return map;
  }, [hospitals]);

  const selectedHospital = hospitalFilter ? hospitalsById.get(hospitalFilter) : undefined;

  const now = useMemo(() => new Date(), []);

  const filteredShifts = useMemo(() => {
    let list = shifts;
    if (period !== 'all') {
      list = list.filter((shift) => {
        const d = new Date(shift.start_at);
        if (period === 'month') {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        return d.getFullYear() === now.getFullYear();
      });
    }
    if (hospitalFilter) {
      list = list.filter((shift) => shift.hospital_id === hospitalFilter);
    }
    return list;
  }, [shifts, period, now, hospitalFilter]);

  const periodLabel =
    period === 'all'
      ? 'Todos os períodos'
      : period === 'year'
        ? formatYearOnly(now.toISOString())
        : formatMonthYear(now.toISOString());

  // título usado no preview, no nome do arquivo e no cabeçalho do PDF —
  // com hospital filtrado, deixa explícito que o relatório é só daquele
  // hospital (ex.: pra mandar pro financeiro de um hospital específico)
  const reportLabel = selectedHospital ? `${selectedHospital.name} — ${periodLabel}` : periodLabel;

  const totals = useMemo(() => {
    // Mesmo critério de "plantão de verdade" da tela Financeiro: Compromisso
    // (sem hospital) e repassado ('passed') ficam fora da contagem de
    // plantões/horas — as horas não foram trabalhadas pelo usuário, ou nem
    // são um plantão de verdade.
    const realShifts = filteredShifts.filter((s) => s.status !== 'passed' && !!s.hospital_id);

    return {
      // plantão repassado (status 'passed') fica de fora do total — não é
      // mais dinheiro do usuário, mesmo continuando listado no export.
      // total_value é nullable (Compromisso usa null) — '?? 0' trata isso
      // como "não soma nada".
      total: filteredShifts
        .filter((s) => s.status !== 'passed')
        .reduce((sum, s) => sum + (s.total_value ?? 0), 0),
      received: filteredShifts
        .filter((s) => s.status === 'paid')
        .reduce((sum, s) => sum + (s.total_value ?? 0), 0),
      pending: filteredShifts
        .filter((s) => s.status === 'pending')
        .reduce((sum, s) => sum + (s.total_value ?? 0), 0),
      shiftsCount: realShifts.length,
      totalHours: realShifts.reduce((sum, s) => sum + durationInHours(s.start_at, s.end_at), 0),
    };
  }, [filteredShifts]);

  async function runAction(action: BusyAction, task: () => Promise<void>, failTitle: string) {
    setBusyAction(action);
    try {
      await task();
    } catch (error) {
      Alert.alert(failTitle, (error as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  // Pop-up de confirmação pedido explicitamente pro envio por e-mail — o
  // compartilhar (share sheet do SO) já tem sua própria confirmação visual,
  // então esse alerta extra fica só nas duas ações de e-mail.
  function confirmEmailSent() {
    Alert.alert('Enviado!', 'Relatório enviado com sucesso para o seu e-mail.');
  }

  const handleExportCSV = () =>
    runAction('csv-share', () => exportShiftsAsCSV(filteredShifts, hospitalsById, reportLabel), 'Não foi possível exportar');
  const handleEmailCSV = () =>
    runAction(
      'csv-email',
      async () => {
        await emailShiftsAsCSV(filteredShifts, hospitalsById, reportLabel);
        confirmEmailSent();
      },
      'Não foi possível enviar'
    );
  const handleExportPDF = () =>
    runAction(
      'pdf-share',
      () => exportShiftsAsPDF(filteredShifts, hospitalsById, reportLabel, totals),
      'Não foi possível exportar'
    );
  const handleEmailPDF = () =>
    runAction(
      'pdf-email',
      async () => {
        await emailShiftsAsPDF(filteredShifts, hospitalsById, reportLabel, totals);
        confirmEmailSent();
      },
      'Não foi possível enviar'
    );

  const isBusy = busyAction !== null;
  const isEmpty = filteredShifts.length === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Relatórios</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>Período</Text>
        <View style={styles.periodTabs}>
          <PeriodTab label="Mês atual" active={period === 'month'} onPress={() => setPeriod('month')} />
          <PeriodTab label="Ano atual" active={period === 'year'} onPress={() => setPeriod('year')} />
          <PeriodTab label="Todos" active={period === 'all'} onPress={() => setPeriod('all')} />
        </View>

        <Text style={styles.label}>Hospital</Text>
        <Pressable style={styles.hospitalField} onPress={() => setIsHospitalPickerOpen(true)}>
          {selectedHospital ? (
            <View style={styles.selectedHospital}>
              <View style={[styles.dot, { backgroundColor: selectedHospital.color }]} />
              <Text style={styles.hospitalFieldText}>{selectedHospital.name}</Text>
            </View>
          ) : (
            <Text style={styles.hospitalFieldText}>Todos os hospitais</Text>
          )}
          <ChevronDown size={18} color={colors.textSecondary} />
        </Pressable>

        <View style={styles.previewCard}>
          <Text style={styles.previewTitle}>{reportLabel}</Text>
          <Text style={styles.previewValue}>{formatCurrency(totals.total)}</Text>
          <Text style={styles.previewSubtitle}>
            {totals.shiftsCount} {totals.shiftsCount === 1 ? 'plantão' : 'plantões'} · {totals.totalHours.toFixed(0)}h
            · Recebido {formatCurrency(totals.received)} · A receber {formatCurrency(totals.pending)}
          </Text>
        </View>

        <View style={styles.exportRow}>
          <TouchableOpacity style={styles.exportMain} onPress={handleExportCSV} disabled={isBusy || isEmpty}>
            {busyAction === 'csv-share' ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <FileSpreadsheet size={22} color={colors.primary} />
                <View style={styles.exportButtonText}>
                  <Text style={styles.exportButtonTitle}>Exportar CSV</Text>
                  <Text style={styles.exportButtonSubtitle}>Abre no Excel, Google Sheets e afins</Text>
                </View>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.emailButton} onPress={handleEmailCSV} disabled={isBusy || isEmpty}>
            {busyAction === 'csv-email' ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Mail size={18} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.exportRow}>
          <TouchableOpacity style={styles.exportMain} onPress={handleExportPDF} disabled={isBusy || isEmpty}>
            {busyAction === 'pdf-share' ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <FileText size={22} color={colors.primary} />
                <View style={styles.exportButtonText}>
                  <Text style={styles.exportButtonTitle}>Exportar PDF</Text>
                  <Text style={styles.exportButtonSubtitle}>Relatório formatado, pronto pra imprimir ou enviar</Text>
                </View>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.emailButton} onPress={handleEmailPDF} disabled={isBusy || isEmpty}>
            {busyAction === 'pdf-email' ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Mail size={18} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.emailHint}>
          Toque no ícone de e-mail pra receber o relatório automaticamente no e-mail cadastrado na sua conta — sem
          precisar abrir nenhum app de e-mail.
        </Text>

        {isEmpty && <Text style={styles.emptyText}>Nenhum plantão nesse período pra exportar.</Text>}
      </ScrollView>

      <Modal
        visible={isHospitalPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsHospitalPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsHospitalPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Filtrar por hospital</Text>
            <ScrollView>
              <TouchableOpacity
                style={styles.modalRow}
                onPress={() => {
                  setHospitalFilter(null);
                  setIsHospitalPickerOpen(false);
                }}
              >
                <Text style={styles.modalRowText}>Todos os hospitais</Text>
                {!hospitalFilter && <Check size={18} color={colors.primary} />}
              </TouchableOpacity>
              {hospitals.map((hospital) => (
                <TouchableOpacity
                  key={hospital.id}
                  style={styles.modalRow}
                  onPress={() => {
                    setHospitalFilter(hospital.id);
                    setIsHospitalPickerOpen(false);
                  }}
                >
                  <View style={[styles.dot, { backgroundColor: hospital.color }]} />
                  <Text style={styles.modalRowText}>{hospital.name}</Text>
                  {hospitalFilter === hospital.id && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
              {hospitals.length === 0 && (
                <Text style={styles.emptyHospitals}>Cadastre um hospital primeiro na aba Hospitais.</Text>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function PeriodTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.periodTab, active && styles.periodTabActive]} onPress={onPress}>
      <Text style={[styles.periodTabText, active && styles.periodTabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: spacing.lg,
  },
  periodTab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  periodTabActive: { backgroundColor: colors.primary },
  periodTabText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  periodTabTextActive: { color: colors.textInverse },
  hospitalField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  selectedHospital: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hospitalFieldText: { fontSize: fontSize.base, color: colors.textPrimary },
  dot: { width: 12, height: 12, borderRadius: 6 },
  previewCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  previewTitle: { fontSize: fontSize.sm, color: colors.textSecondary },
  previewValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  previewSubtitle: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.sm },
  exportRow: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm, marginBottom: spacing.sm },
  exportMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 64,
  },
  exportButtonText: { flex: 1 },
  exportButtonTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  exportButtonSubtitle: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  emailButton: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  emailHint: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '70%',
    padding: spacing.lg,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.md },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalRowText: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary },
  emptyHospitals: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});