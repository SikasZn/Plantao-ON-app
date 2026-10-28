// src/screens/financial/ExpenseFormScreen.tsx
//
// Criar / editar / excluir um gasto. "Todo mês" = gasto fixo que entra
// sozinho em cada mês; "Só neste mês" = gasto avulso.
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { useExpenses } from '../../contexts/ExpensesContext';
import { TextField } from '../../components/ui/TextField';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { Button } from '../../components/ui/Button';
import { addMonthsToKey, monthKeyToDate, monthKeyToLabel } from '../../utils/expenses';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';
import type { ExpenseRecurrence } from '../../types/domain';

type Props = NativeStackScreenProps<MainStackParamList, 'ExpenseForm'>;

export function ExpenseFormScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { monthKey: viewedMonth, expense } = route.params;
  const isEditing = !!expense;
  const { add, edit, editFromMonth, endFromMonth, remove } = useExpenses();

  const [name, setName] = useState(expense?.name ?? '');
  const [amountCents, setAmountCents] = useState(expense ? String(Math.round(expense.amount * 100)) : '');
  const [recurrence, setRecurrence] = useState<ExpenseRecurrence>((expense?.recurrence as ExpenseRecurrence) ?? 'monthly');
  const [startMonth, setStartMonth] = useState(expense ? expense.start_month.slice(0, 7) : viewedMonth);
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  // o mês pode ser escolhido ao criar um gasto ou editar um gasto avulso;
  // num gasto mensal já existente o início é fixo (a edição "a partir de um
  // mês" é tratada à parte, ao salvar)
  const canPickMonth = !isEditing || recurrence === 'once';

  function validate() {
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = 'Informe o nome do gasto';
    if (!amountCents || Number(amountCents) <= 0) next.amount = 'Informe o valor';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function run(action: () => Promise<void>) {
    setIsSaving(true);
    try {
      await action();
      navigation.goBack();
    } catch (error) {
      Alert.alert('Não foi possível salvar', (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSave() {
    if (!validate()) return;
    const fields = {
      name: name.trim(),
      amount: Number(amountCents) / 100,
    };

    if (!expense) {
      void run(async () => {
        await add({
          ...fields,
          recurrence,
          start_month: monthKeyToDate(startMonth),
          end_month: null,
        });
      });
      return;
    }

    if (expense.recurrence === 'once') {
      void run(() => edit(expense.id, { ...fields, start_month: monthKeyToDate(startMonth) }));
      return;
    }

    // gasto mensal: se está vendo o mês em que ele começou, não há "passado"
    // pra preservar — altera direto
    if (expense.start_month.slice(0, 7) >= viewedMonth) {
      void run(() => edit(expense.id, fields));
      return;
    }

    Alert.alert('Alterar gasto mensal', `Essa alteração vale para quais meses?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Todos os meses', onPress: () => void run(() => edit(expense.id, fields)) },
      {
        text: `A partir de ${monthKeyToLabel(viewedMonth)}`,
        onPress: () =>
          void run(() =>
            editFromMonth(expense, viewedMonth, {
              ...fields,
              recurrence: 'monthly',
              start_month: monthKeyToDate(viewedMonth),
            })
          ),
      },
    ]);
  }

  function handleDelete() {
    if (!expense) return;
    if (expense.recurrence === 'once') {
      Alert.alert('Excluir gasto', 'Tem certeza que deseja excluir este gasto?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => void run(() => remove(expense.id)) },
      ]);
      return;
    }
    Alert.alert('Excluir gasto mensal', 'O que você quer fazer?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: `Parar a partir de ${monthKeyToLabel(viewedMonth)}`,
        onPress: () => void run(() => endFromMonth(expense, viewedMonth)),
      },
      { text: 'Excluir de todos os meses', style: 'destructive', onPress: () => void run(() => remove(expense.id)) },
    ]);
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? undefined : 'padding'}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        style={styles.flex}
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
            <ArrowLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{isEditing ? 'Editar gasto' : 'Novo gasto'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <TextField
          label="Nome do gasto"
          placeholder="Ex.: Aluguel, plano de saúde"
          value={name}
          onChangeText={setName}
          error={errors.name}
        />

        <CurrencyField label="Valor" value={amountCents} onChangeText={setAmountCents} error={errors.amount} />

        {!isEditing && (
          <>
            <Text style={styles.label}>Frequência</Text>
            <View style={styles.modeRow}>
              {([
                ['monthly', 'Todo mês'],
                ['once', 'Só neste mês'],
              ] as const).map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.modeOption, recurrence === value && styles.modeOptionActive]}
                  onPress={() => setRecurrence(value)}
                >
                  <Text style={[styles.modeText, recurrence === value && styles.modeTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>{recurrence === 'monthly' ? 'Começa em' : 'Mês do gasto'}</Text>
        <View style={styles.monthPicker}>
          <TouchableOpacity
            disabled={!canPickMonth}
            onPress={() => setStartMonth((k) => addMonthsToKey(k, -1))}
            hitSlop={12}
          >
            <ChevronLeft size={22} color={canPickMonth ? colors.textPrimary : colors.border} />
          </TouchableOpacity>
          <Text style={styles.monthText}>{monthKeyToLabel(startMonth)}</Text>
          <TouchableOpacity
            disabled={!canPickMonth}
            onPress={() => setStartMonth((k) => addMonthsToKey(k, 1))}
            hitSlop={12}
          >
            <ChevronRight size={22} color={canPickMonth ? colors.textPrimary : colors.border} />
          </TouchableOpacity>
        </View>
        {recurrence === 'monthly' && (
          <Text style={styles.hint}>Entra automaticamente em todo mês a partir daqui, até você parar o gasto.</Text>
        )}

        <Button label="Salvar" onPress={handleSave} loading={isSaving} style={styles.saveButton} />

        {isEditing && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Trash2 size={18} color={colors.danger} />
            <Text style={styles.deleteText}>Excluir gasto</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  container: { padding: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: 3,
    marginBottom: spacing.md,
  },
  modeOption: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md - 2 },
  modeOptionActive: { backgroundColor: colors.primary },
  modeText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  modeTextActive: { color: colors.textInverse },
  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  monthText: { fontSize: fontSize.base, color: colors.textPrimary },
  hint: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.md },
  saveButton: { marginTop: spacing.lg },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  deleteText: { color: colors.danger, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
});
