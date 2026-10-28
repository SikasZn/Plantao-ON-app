// src/screens/financial/ExpensesScreen.tsx
//
// Gastos do mês escolhido: os mensais (que entram sozinhos todo mês) e os
// avulsos daquele mês. Toque num gasto para editar/excluir.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronLeft, ChevronRight, Repeat } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { useExpenses } from '../../contexts/ExpensesContext';
import { Button } from '../../components/ui/Button';
import { formatCurrency } from '../../utils/currency';
import { addMonthsToKey, expensesForMonth, monthKeyToLabel } from '../../utils/expenses';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';

type Props = NativeStackScreenProps<MainStackParamList, 'Expenses'>;

export function ExpensesScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { expenses, error } = useExpenses();
  const [monthKey, setMonthKey] = useState(route.params.monthKey);

  const list = useMemo(
    () => expensesForMonth(expenses, monthKey).sort((a, b) => b.amount - a.amount),
    [expenses, monthKey]
  );
  const total = list.reduce((sum, e) => sum + e.amount, 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Gastos mensais</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.monthNav}>
        <TouchableOpacity onPress={() => setMonthKey((k) => addMonthsToKey(k, -1))} hitSlop={12}>
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthKeyToLabel(monthKey)}</Text>
        <TouchableOpacity onPress={() => setMonthKey((k) => addMonthsToKey(k, 1))} hitSlop={12}>
          <ChevronRight size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.totalCard}>
          <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
          <Text style={styles.totalLabel}>
            {list.length} {list.length === 1 ? 'gasto' : 'gastos'} em {monthKeyToLabel(monthKey)}
          </Text>
        </View>

        {!!error && (
          <Text style={styles.errorText}>
            Não foi possível carregar os gastos. Verifique sua conexão e tente novamente.
          </Text>
        )}

        {list.length === 0 ? (
          <Text style={styles.empty}>
            Nenhum gasto neste mês. Cadastre os gastos fixos (aluguel, plano de saúde...) como “Todo mês” e eles
            entram sozinhos em cada mês.
          </Text>
        ) : (
          list.map((expense) => (
            <TouchableOpacity
              key={expense.id}
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ExpenseForm', { monthKey, expense })}
            >
              <View style={styles.rowInfo}>
                <Text style={styles.rowName}>{expense.name}</Text>
                <View style={styles.rowTag}>
                  {expense.recurrence === 'monthly' && <Repeat size={12} color={colors.textSecondary} />}
                  <Text style={styles.rowTagText}>{expense.recurrence === 'monthly' ? 'Todo mês' : 'Só neste mês'}</Text>
                </View>
              </View>
              <Text style={styles.rowValue}>{formatCurrency(expense.amount)}</Text>
              <ChevronRight size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing.md + insets.bottom }]}>
        <Button label="Adicionar gasto" onPress={() => navigation.navigate('ExpenseForm', { monthKey })} />
      </View>
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
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  monthLabel: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  totalCard: {
    backgroundColor: colors.danger,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  totalValue: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textInverse },
  totalLabel: { fontSize: fontSize.sm, color: colors.textInverse, marginTop: spacing.xs },
  errorText: { fontSize: fontSize.sm, color: colors.danger, marginBottom: spacing.md },
  empty: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  row: {
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
  rowInfo: { flex: 1 },
  rowName: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  rowTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rowTagText: { fontSize: fontSize.xs, color: colors.textSecondary },
  rowValue: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
