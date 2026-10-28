// src/screens/financial/OverdueScreen.tsx
//
// Pagamentos em atraso: plantões cujo dia já passou e que ainda não foram
// marcados como pagos (por esquecimento ou porque o pagamento realmente não
// caiu). Agrupado por local de trabalho.
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { useShifts } from '../../hooks/useShifts';
import { useHospitals } from '../../contexts/HospitalsContext';
import { PaymentShiftRow } from '../../components/PaymentShiftRow';
import { formatCurrency } from '../../utils/currency';
import { formatDate, formatDateTimeRange } from '../../utils/date';
import { dueDateOf, daysOverdue, formatDaysOverdue, isOverdue } from '../../utils/payments';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';
import type { Shift } from '../../types/domain';

type Props = NativeStackScreenProps<MainStackParamList, 'Overdue'>;

export function OverdueScreen({ navigation }: Props) {
  const { shifts, setStatus } = useShifts();
  const { hospitals } = useHospitals();
  // ids marcados nesta sessão: a linha continua visível (com o check) até
  // sair da tela, pra dar pra desfazer um toque sem querer
  const [justPaid, setJustPaid] = useState<Set<string>>(new Set());

  const hospitalsById = useMemo(() => new Map(hospitals.map((h) => [h.id, h])), [hospitals]);

  const overdue = useMemo(
    () =>
      shifts
        .filter((s) => justPaid.has(s.id) || isOverdue(s, s.hospital_id ? hospitalsById.get(s.hospital_id) : null))
        .sort(
          (a, b) =>
            dueDateOf(a, a.hospital_id ? hospitalsById.get(a.hospital_id) : null).valueOf() -
            dueDateOf(b, b.hospital_id ? hospitalsById.get(b.hospital_id) : null).valueOf()
        ),
    [shifts, justPaid, hospitalsById]
  );

  const groups = useMemo(() => {
    const map = new Map<string, Shift[]>();
    overdue.forEach((s) => {
      const key = s.hospital_id ?? '';
      map.set(key, [...(map.get(key) ?? []), s]);
    });
    return Array.from(map.entries()).map(([hospitalId, list]) => ({
      hospital: hospitals.find((h) => h.id === hospitalId),
      list,
      total: list.reduce((sum, s) => sum + (s.total_value ?? 0), 0),
    }));
  }, [overdue, hospitals]);

  const stillOverdue = overdue.filter((s) => s.status === 'pending');
  const total = stillOverdue.reduce((sum, s) => sum + (s.total_value ?? 0), 0);

  async function run(ids: string[], status: 'pending' | 'paid') {
    try {
      await setStatus(ids, status);
      setJustPaid((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => (status === 'paid' ? next.add(id) : next.delete(id)));
        return next;
      });
    } catch (error) {
      Alert.alert('Não foi possível atualizar', (error as Error).message);
    }
  }

  function markGroupPaid(name: string, list: Shift[]) {
    const ids = list.filter((s) => s.status === 'pending').map((s) => s.id);
    if (ids.length === 0) return;
    Alert.alert('Marcar todos como pagos', `Marcar os ${ids.length} plantões de ${name} como pagos?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Confirmar', onPress: () => run(ids, 'paid') },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Pagamentos atrasados</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.totalCard}>
          <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          <Text style={styles.totalLabel}>
            {stillOverdue.length} {stillOverdue.length === 1 ? 'plantão' : 'plantões'} não pagos após a data do
            plantão
          </Text>
        </View>

        {groups.length === 0 ? (
          <Text style={styles.empty}>Nenhum pagamento atrasado. Tudo em dia!</Text>
        ) : (
          groups.map(({ hospital, list, total: groupTotal }) => (
            <View key={hospital?.id ?? 'sem-local'} style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={[styles.dot, { backgroundColor: hospital?.color ?? colors.textSecondary }]} />
                <Text style={styles.groupName} numberOfLines={1}>
                  {hospital?.name ?? 'Local removido'}
                </Text>
                <Text style={styles.groupTotal}>{formatCurrency(groupTotal)}</Text>
              </View>
              {list.map((shift) => (
                <PaymentShiftRow
                  key={shift.id}
                  title={`${formatDate(shift.start_at, 'ddd, DD/MM')} · ${formatDateTimeRange(shift.start_at, shift.end_at)}`}
                  subtitle={
                    shift.status === 'paid'
                      ? 'Marcado como pago'
                      : `Venceu em ${dueDateOf(shift, hospital).format('DD/MM')} · ${formatDaysOverdue(daysOverdue(shift, hospital))}`
                  }
                  subtitleColor={shift.status === 'paid' ? colors.primary : colors.danger}
                  value={shift.total_value ?? 0}
                  paid={shift.status === 'paid'}
                  onToggle={() => run([shift.id], shift.status === 'paid' ? 'pending' : 'paid')}
                  onPress={() => navigation.navigate('ShiftForm', { shift })}
                />
              ))}
              {list.some((s) => s.status === 'pending') && (
                <TouchableOpacity onPress={() => markGroupPaid(hospital?.name ?? 'este local', list)}>
                  <Text style={styles.markAll}>Marcar todos de {hospital?.name ?? 'este local'} como pagos</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
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
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  totalCard: {
    backgroundColor: colors.danger,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  totalValue: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textInverse },
  totalLabel: { fontSize: fontSize.sm, color: colors.textInverse, marginTop: spacing.xs },
  empty: { fontSize: fontSize.sm, color: colors.textSecondary },
  group: { marginBottom: spacing.lg },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  groupName: { flex: 1, fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  groupTotal: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.danger },
  markAll: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
});
