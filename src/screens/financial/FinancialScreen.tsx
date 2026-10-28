// src/screens/financial/FinancialScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AlertCircle, ChevronLeft, ChevronRight, Wallet } from 'lucide-react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { isOverdue } from '../../utils/payments';
import { useExpenses } from '../../contexts/ExpensesContext';
import { monthKeyOf, totalForMonth, totalForYear } from '../../utils/expenses';
import { useShifts } from '../../hooks/useShifts';
import { useHospitals } from '../../contexts/HospitalsContext';
import { formatCurrency } from '../../utils/currency';
import { formatMonthYear, formatYearOnly, durationInHours } from '../../utils/date';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';
import type { Hospital } from '../../types/domain';

type Period = 'month' | 'year';

export function FinancialScreen() {
  const { shifts, refetch } = useShifts();
  const { hospitals } = useHospitals();
  const { expenses } = useExpenses();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();

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

  // Gastos do período: no mês, os gastos que valem naquele mês (os mensais
  // entram sozinhos); no ano, a soma dos 12 meses.
  const expensesTotal =
    period === 'month'
      ? totalForMonth(expenses, monthKeyOf(referenceDate))
      : totalForYear(expenses, referenceDate.getFullYear());
  // Saldo = tudo que o período rende (recebido + a receber) menos os gastos
  const balance = totalValue - expensesTotal;
  const chartMax = Math.max(totalValue, expensesTotal, 1);

  // Atrasados: de todos os tempos (não só do período filtrado) — um
  // pagamento esquecido de meses atrás continua devendo.
  const overdueShifts = useMemo(
    () => shifts.filter((s) => isOverdue(s, s.hospital_id ? hospitalsById.get(s.hospital_id) : null)),
    [shifts, hospitalsById]
  );
  const overdueTotal = overdueShifts.reduce((sum, s) => sum + (s.total_value ?? 0), 0);

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
      </View>

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
            <View style={styles.summarySplitDivider} />
            <View style={styles.summarySplitItem}>
              <Text style={styles.summarySplitValue}>{formatCurrency(expensesTotal)}</Text>
              <Text style={styles.summarySplitLabel}>Gastos</Text>
            </View>
          </View>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceTitle}>Saldo do período</Text>
            <Text style={[styles.balanceValue, balance < 0 && styles.balanceNegative]}>{formatCurrency(balance)}</Text>
          </View>
          <View style={styles.barRow}>
            <Text style={styles.barLabel}>Ganhos</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${(totalValue / chartMax) * 100}%`, backgroundColor: colors.primary }]} />
            </View>
            <Text style={styles.barValue}>{formatCurrency(totalValue)}</Text>
          </View>
          <View style={styles.barRow}>
            <Text style={styles.barLabel}>Gastos</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${(expensesTotal / chartMax) * 100}%`, backgroundColor: colors.danger }]} />
            </View>
            <Text style={styles.barValue}>{formatCurrency(expensesTotal)}</Text>
          </View>
          <TouchableOpacity
            style={styles.manageExpenses}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Expenses', { monthKey: monthKeyOf(referenceDate) })}
          >
            <Wallet size={18} color={colors.primary} />
            <Text style={styles.manageExpensesText}>Gerenciar gastos mensais</Text>
            <ChevronRight size={16} color={colors.primary} />
          </TouchableOpacity>
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

        {overdueShifts.length > 0 && (
          <TouchableOpacity style={styles.overdueCard} onPress={() => navigation.navigate('Overdue')} activeOpacity={0.8}>
            <AlertCircle size={22} color={colors.danger} />
            <View style={styles.overdueInfo}>
              <Text style={styles.overdueTitle}>Pagamentos atrasados</Text>
              <Text style={styles.overdueSub}>
                {overdueShifts.length} {overdueShifts.length === 1 ? 'plantão' : 'plantões'} sem marcar como pago
              </Text>
            </View>
            <Text style={styles.overdueValue}>{formatCurrency(overdueTotal)}</Text>
            <ChevronRight size={18} color={colors.danger} />
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Por local de trabalho</Text>
        {byHospital.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum plantão nesse período.</Text>
        ) : (
          byHospital.map(({ hospital, total, count, hours }) => (
            <TouchableOpacity
              key={hospital?.id ?? 'sem-hospital'}
              style={styles.hospitalRow}
              disabled={!hospital}
              activeOpacity={0.7}
              onPress={() =>
                hospital &&
                navigation.navigate('HospitalShifts', {
                  hospitalId: hospital.id,
                  period,
                  referenceDate: referenceDate.toISOString(),
                })
              }
            >
              <View style={[styles.dot, { backgroundColor: hospital?.color ?? colors.textSecondary }]} />
              <View style={styles.hospitalInfo}>
                <Text style={styles.hospitalName}>{hospital?.name ?? 'Local removido'}</Text>
                <Text style={styles.hospitalCount}>
                  {count} {count === 1 ? 'plantão' : 'plantões'} · {hours.toFixed(0)}h
                </Text>
              </View>
              <Text style={styles.hospitalTotal}>{formatCurrency(total)}</Text>
              {!!hospital && <ChevronRight size={16} color={colors.textSecondary} />}
            </TouchableOpacity>
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
  balanceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  balanceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  balanceTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  balanceValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },
  balanceNegative: { color: colors.danger },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  barLabel: { width: 52, fontSize: fontSize.xs, color: colors.textSecondary },
  barTrack: { flex: 1, height: 12, borderRadius: 6, backgroundColor: colors.background, overflow: 'hidden' },
  barFill: { height: 12, borderRadius: 6 },
  barValue: { width: 92, textAlign: 'right', fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  manageExpenses: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  manageExpensesText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary },
  overdueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  overdueInfo: { flex: 1 },
  overdueTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.danger },
  overdueSub: { fontSize: fontSize.xs, color: colors.danger, marginTop: 2 },
  overdueValue: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.danger },
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