// src/screens/financial/HospitalShiftsScreen.tsx
//
// Plantões de um local de trabalho dentro do período escolhido na tela
// Financeiro (mês ou ano), com marcação individual de pago e o botão
// "Marcar todos como pagos".
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { useShifts } from '../../hooks/useShifts';
import { useHospitals } from '../../contexts/HospitalsContext';
import { PaymentShiftRow } from '../../components/PaymentShiftRow';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../utils/currency';
import { formatDate, formatDateTimeRange, formatMonthYear, formatYearOnly } from '../../utils/date';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';

type Props = NativeStackScreenProps<MainStackParamList, 'HospitalShifts'>;

export function HospitalShiftsScreen({ navigation, route }: Props) {
  const { hospitalId, period, referenceDate } = route.params;
  const insets = useSafeAreaInsets();
  const { shifts, setStatus } = useShifts();
  const { hospitals } = useHospitals();
  const [isSaving, setIsSaving] = useState(false);

  const hospital = hospitals.find((h) => h.id === hospitalId);
  const reference = useMemo(() => new Date(referenceDate), [referenceDate]);

  // mesmo critério da tela Financeiro: período pelo início do plantão e
  // repassados ('passed') fora da conta
  const list = useMemo(
    () =>
      shifts
        .filter((s) => {
          if (s.hospital_id !== hospitalId || s.status === 'passed') return false;
          const d = new Date(s.start_at);
          if (period === 'month') {
            return d.getMonth() === reference.getMonth() && d.getFullYear() === reference.getFullYear();
          }
          return d.getFullYear() === reference.getFullYear();
        })
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [shifts, hospitalId, period, reference]
  );

  const total = list.reduce((sum, s) => sum + (s.total_value ?? 0), 0);
  const received = list.filter((s) => s.status === 'paid').reduce((sum, s) => sum + (s.total_value ?? 0), 0);
  const pendingList = list.filter((s) => s.status === 'pending');
  const pending = pendingList.reduce((sum, s) => sum + (s.total_value ?? 0), 0);

  const periodLabel = period === 'month' ? formatMonthYear(referenceDate) : formatYearOnly(referenceDate);

  async function run(ids: string[], status: 'pending' | 'paid') {
    setIsSaving(true);
    try {
      await setStatus(ids, status);
    } catch (error) {
      Alert.alert('Não foi possível atualizar', (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleMarkAll() {
    Alert.alert(
      'Marcar todos como pagos',
      `${pendingList.length} ${pendingList.length === 1 ? 'plantão' : 'plantões'} de ${hospital?.name ?? 'este local'} em ${periodLabel} (${formatCurrency(pending)}) ${pendingList.length === 1 ? 'será marcado' : 'serão marcados'} como pago${pendingList.length === 1 ? '' : 's'}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => run(pendingList.map((s) => s.id), 'paid') },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={1}>
            {hospital?.name ?? 'Local removido'}
          </Text>
          <Text style={styles.periodText}>
            {periodLabel}
            {hospital?.payment_day ? ` · paga todo dia ${hospital.payment_day}` : ''}
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <SummaryItem label="Total" value={formatCurrency(total)} />
          <SummaryItem label="Recebido" value={formatCurrency(received)} />
          <SummaryItem label="A receber" value={formatCurrency(pending)} />
        </View>

        {list.length === 0 ? (
          <Text style={styles.empty}>Nenhum plantão desse local nesse período.</Text>
        ) : (
          list.map((shift) => (
            <PaymentShiftRow
              key={shift.id}
              title={formatDate(shift.start_at, 'ddd, DD/MM')}
              subtitle={formatDateTimeRange(shift.start_at, shift.end_at)}
              value={shift.total_value ?? 0}
              paid={shift.status === 'paid'}
              onToggle={() => run([shift.id], shift.status === 'paid' ? 'pending' : 'paid')}
              onPress={() => navigation.navigate('ShiftForm', { shift })}
            />
          ))
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
        <Button
          label="Marcar todos como pagos"
          onPress={handleMarkAll}
          loading={isSaving}
          disabled={pendingList.length === 0}
        />
      </View>
    </SafeAreaView>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.md },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  periodText: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  summary: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryItem: { flex: 1, minWidth: 0, alignItems: 'center' },
  summaryValue: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  summaryLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  empty: { fontSize: fontSize.sm, color: colors.textSecondary },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
