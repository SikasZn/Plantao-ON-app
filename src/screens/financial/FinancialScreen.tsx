// src/screens/financial/FinancialScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useShifts } from '../../hooks/useShifts';
import { useHospitals } from '../../contexts/HospitalsContext';
import { formatCurrency } from '../../utils/currency';
import { formatMonthYear, formatYearOnly, durationInHours } from '../../utils/date';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';
import type { Hospital } from '../../types/domain';

type Period = 'month' | 'year' | 'all';

export function FinancialScreen() {
  const { shifts, refetch } = useShifts();
  const { hospitals } = useHospitals();

  const [period, setPeriod] = useState<Period>('month');
  const [referenceDate, setReferenceDate] = useState(new Date());

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const hospitalsById = useMemo(() => {
    const map = new Map<string, Hospital>();
    hospitals.forEach((h) => map.set(h.id, h));
    return map;
  }, [hospitals]);

  function goToPrevious() {
    setReferenceDate((prev) => {
      const next = new Date(prev);
      if (period === 'month') next.setMonth(next.getMonth() - 1);
      else next.setFullYear(next.getFullYear() - 1);
      return next;
    });
  }

  function goToNext() {
    setReferenceDate((prev) => {
      const next = new Date(prev);
      if (period === 'month') next.setMonth(next.getMonth() + 1);
      else next.setFullYear(next.getFullYear() + 1);
      return next;
    });
  }

  const filteredShifts = useMemo(() => {
    if (period === 'all') return shifts;
    return shifts.filter((shift) => {
      const d = new Date(shift.start_at);
      if (period === 'month') {
        return d.getMonth() === referenceDate.getMonth() && d.getFullYear() === referenceDate.getFullYear();
      }
      return d.getFullYear() === referenceDate.getFullYear();
    });
  }, [shifts, period, referenceDate]);

  // plantão repassado (status 'passed') não conta em nenhum total financeiro
  // — o dinheiro não é mais do usuário, então fica de fora daqui, mesmo
  // continuando visível normalmente na lista/calendário
  // total_value é nullable (Compromisso usa null) — '?? 0' trata isso como
  // "não soma nada", igual o resto do app já fazia antes disso virar erro de TS
  const totalValue = filteredShifts
    .filter((s) => s.status !== 'passed')
    .reduce((sum, s) => sum + (s.total_value ?? 0), 0);
  const receivedValue = filteredShifts
    .filter((s) => s.status === 'paid')
    .reduce((sum, s) => sum + (s.total_value ?? 0), 0);
  const pendingValue = filteredShifts
    .filter((s) => s.status === 'pending')
    .reduce((sum, s) => sum + (s.total_value ?? 0), 0);

  // Quantidade de plantões e horas no período — mesmo critério de "plantão
  // de verdade" usado em todo o resto da tela (sem hospital = Compromisso,
  // fora da conta; 'passed' = repassado a um colega, as horas não foram
  // trabalhadas pelo usuário, também fora).
  const realFilteredShifts = useMemo(
    () => filteredShifts.filter((s) => s.status !== 'passed' && !!s.hospital_id),
    [filteredShifts]
  );
  const shiftsCount = realFilteredShifts.length;
  const totalHours = useMemo(
    () => realFilteredShifts.reduce((sum, s) => sum + durationInHours(s.start_at, s.end_at), 0),
    [realFilteredShifts]
  );

  const byHospital = useMemo(() => {
    const map = new Map<string, { hospital?: Hospital; total: number; count: number; hours: number }>();
    filteredShifts.forEach((shift) => {
      if (shift.status === 'passed') return;
      // Compromisso não tem hospital nem valor — não faz sentido entrar numa
      // quebra "por hospital"
      if (!shift.hospital_id) return;
      const entry = map.get(shift.hospital_id) ?? {
        hospital: hospitalsById.get(shift.hospital_id),
        total: 0,
        count: 0,
        hours: 0,
      };
      entry.total += shift.total_value ?? 0;
      entry.count += 1;
      entry.hours += durationInHours(shift.start_at, shift.end_at);
      map.set(shift.hospital_id, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredShifts, hospitalsById]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Financeiro</Text>
      </View>

      <View style={styles.periodTabs}>
        <PeriodTab label="Mês" active={period === 'month'} onPress={() => setPeriod('month')} />
        <PeriodTab label="Ano" active={period === 'year'} onPress={() => setPeriod('year')} />
        <PeriodTab label="Todos" active={period === 'all'} onPress={() => setPeriod('all')} />
      </View>

      {period !== 'all' && (
        <View style={styles.periodNav}>
          <TouchableOpacity onPress={goToPrevious} hitSlop={12}>
            <ChevronLeft size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.periodLabel}>
            {period === 'month'
              ? formatMonthYear(referenceDate.toISOString())
              : formatYearOnly(referenceDate.toISOString())}
          </Text>
          <TouchableOpacity onPress={goToNext} hitSlop={12}>
            <ChevronRight size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatCurrency(totalValue)}</Text>
          <Text style={styles.summaryLabel}>Ganhos no período</Text>
          <View style={styles.summarySplit}>
            <View style={styles.summarySplitItem}>
              <Text style={styles.summarySplitValue}>{formatCurrency(receivedValue)}</Text>
              <Text style={styles.summarySplitLabel}>Recebido</Text>
            </View>
            <View style={styles.summarySplitDivider} />
            <View style={styles.summarySplitItem}>
              <Text style={styles.summarySplitValue}>{formatCurrency(pendingValue)}</Text>
              <Text style={styles.summarySplitLabel}>A receber</Text>
            </View>
          </View>
        </View>

        <View style={styles.periodStatsRow}>
          <View style={styles.periodStatBox}>
            <Text style={styles.periodStatValue}>{shiftsCount}</Text>
            <Text style={styles.periodStatLabel}>{shiftsCount === 1 ? 'Plantão no período' : 'Plantões no período'}</Text>
          </View>
          <View style={styles.periodStatBox}>
            <Text style={styles.periodStatValue}>{totalHours.toFixed(0)}h</Text>
            <Text style={styles.periodStatLabel}>Horas no período</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Por hospital</Text>
        {byHospital.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum plantão nesse período.</Text>
        ) : (
          byHospital.map(({ hospital, total, count, hours }) => (
            <View key={hospital?.id ?? 'sem-hospital'} style={styles.hospitalRow}>
              <View style={[styles.dot, { backgroundColor: hospital?.color ?? colors.textSecondary }]} />
              <View style={styles.hospitalInfo}>
                <Text style={styles.hospitalName}>{hospital?.name ?? 'Hospital removido'}</Text>
                <Text style={styles.hospitalCount}>
                  {count} {count === 1 ? 'plantão' : 'plantões'} · {hours.toFixed(0)}h
                </Text>
              </View>
              <Text style={styles.hospitalTotal}>{formatCurrency(total)}</Text>
            </View>
          ))
        )}
      </ScrollView>
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
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  periodTabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  periodTab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  periodTabActive: { backgroundColor: colors.primary },
  periodTabText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  periodTabTextActive: { color: colors.textInverse },
  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  periodLabel: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  summaryCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryValue: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textInverse },
  summaryLabel: { fontSize: fontSize.sm, color: colors.primaryLight, marginTop: spacing.xs, marginBottom: spacing.md },
  summarySplit: { flexDirection: 'row', alignItems: 'center' },
  summarySplitItem: { flex: 1 },
  summarySplitDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: spacing.md },
  summarySplitValue: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textInverse },
  summarySplitLabel: { fontSize: fontSize.xs, color: colors.primaryLight, marginTop: 2 },
  periodStatsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  periodStatBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  periodStatValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  periodStatLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary },
  hospitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  hospitalInfo: { flex: 1 },
  hospitalName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  hospitalCount: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  hospitalTotal: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
});