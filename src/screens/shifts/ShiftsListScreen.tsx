// src/screens/shifts/ShiftsListScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Plus } from 'lucide-react-native';
import type { MainTabParamList, MainStackParamList } from '../../navigation/types';
import { useShifts } from '../../hooks/useShifts';
import { useHospitals } from '../../contexts/HospitalsContext';
import { formatCurrency } from '../../utils/currency';
import { formatDateTimeRange, durationInHours, formatFullDate, toDateKey, todayKey, eachDateKeyInRange } from '../../utils/date';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';
import type { Shift, Hospital } from '../../types/domain';

LocaleConfig.locales['pt-br'] = {
  monthNames: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  dayNamesShort: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
};
LocaleConfig.defaultLocale = 'pt-br';

// ---- dia do calendário: número sempre visível + marcadores de cor abaixo ----
//
// Antes a cor do hospital preenchia o círculo do dia (escondendo o número
// atrás de texto branco). Agora o número fica sempre normal, e a(s) cor(es)
// do(s) hospital(is) com plantão naquele dia aparecem como pequenas barras
// abaixo — até 4 (mais que isso vira ilegível nesse espaço).

// A lib não exporta publicamente o tipo exato de props do dayComponent —
// mesmo caso do onValueChange do DateTimePicker. Tipamos frouxo de
// propósito em vez de arriscar um formato que não bate com o real.
function CustomDay(props: any) {
  const { date, state, marking, onPress } = props as {
    date?: { day: number; dateString: string };
    state?: string;
    marking?: { customColors?: string[]; selected?: boolean };
    onPress?: (date?: { dateString: string }) => void;
  };
  const colorList = marking?.customColors ?? [];
  const isSelected = !!marking?.selected;
  const isDisabled = state === 'disabled';
  const isToday = state === 'today';

  return (
    <Pressable onPress={() => date && onPress?.(date)} style={dayStyles.cell}>
      <View style={[dayStyles.circle, isSelected && dayStyles.circleSelected]}>
        <Text
          style={[
            dayStyles.dayText,
            isDisabled && dayStyles.dayTextDisabled,
            !isDisabled && isToday && dayStyles.dayTextToday,
          ]}
        >
          {date?.day}
        </Text>
      </View>
      <View style={dayStyles.markersRow}>
        {colorList.slice(0, 4).map((color, i) => (
          <View key={i} style={[dayStyles.marker, { backgroundColor: color }]} />
        ))}
      </View>
    </Pressable>
  );
}

const dayStyles = StyleSheet.create({
  cell: { width: 34, height: 44, alignItems: 'center', paddingTop: 2 },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelected: { borderWidth: 2, borderColor: colors.textPrimary },
  dayText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  dayTextDisabled: { color: colors.border },
  dayTextToday: { color: colors.primary, fontWeight: 'bold' },
  markersRow: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 6, marginTop: 3 },
  marker: { width: 6, height: 5, borderRadius: 1.5 },
});

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Shifts'>,
  NativeStackScreenProps<MainStackParamList>
>;

export function ShiftsListScreen({ navigation }: Props) {
  const { shifts, isLoading, error, refetch } = useShifts();
  const { hospitals } = useHospitals();
  const [selectedDate, setSelectedDate] = useState(todayKey());

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

  // lista as cores dos hospitais com plantão em cada dia (até 4 — mais que
  // isso vira ilegível numa fatia de 32px) pro círculo dividido em fatias
  const markedDates = useMemo(() => {
    const colorsByDay: Record<string, string[]> = {};

    shifts.forEach((shift) => {
      // Plantão repassado pra outro colega sempre aparece cinza neutro no
      // calendário, independente da cor do hospital — é um sinal visual à
      // parte, não uma cor de hospital a mais na fatia. Um Compromisso não
      // tem hospital (hospital_id null) — usa a cor própria escolhida nele.
      const color = shift.passed_to
        ? colors.passed
        : shift.hospital_id
          ? hospitalsById.get(shift.hospital_id)?.color ?? colors.textSecondary
          : shift.color ?? colors.textSecondary;
      const startDay = toDateKey(shift.start_at);
      const endDay = toDateKey(shift.end_at);

      eachDateKeyInRange(startDay, endDay).forEach((day) => {
        if (!colorsByDay[day]) colorsByDay[day] = [];
        if (!colorsByDay[day].includes(color)) colorsByDay[day].push(color);
      });
    });

    const marks: Record<string, { customColors: string[]; selected: boolean }> = {};
    Object.entries(colorsByDay).forEach(([day, dayColors]) => {
      marks[day] = { customColors: dayColors.slice(0, 4), selected: day === selectedDate };
    });

    if (!marks[selectedDate]) {
      marks[selectedDate] = { customColors: [], selected: true };
    }

    return marks;
  }, [shifts, hospitalsById, selectedDate]);

  const shiftsForSelectedDay = useMemo(
    () =>
      shifts.filter((shift) => {
        const startDay = toDateKey(shift.start_at);
        const endDay = toDateKey(shift.end_at);
        return selectedDate >= startDay && selectedDate <= endDay;
      }),
    [shifts, selectedDate]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Calendar
        onDayPress={(day) => setSelectedDate(day.dateString)}
        markedDates={markedDates}
        dayComponent={CustomDay}
        theme={{
          arrowColor: colors.primary,
          textSectionTitleColor: colors.textSecondary,
        }}
      />

      <View style={styles.dayHeader}>
        <Text style={styles.dayHeaderText}>{formatFullDate(selectedDate)}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={shiftsForSelectedDay}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhum plantão nesse dia.</Text>}
          renderItem={({ item }) => (
            <ShiftRow
              shift={item}
              hospital={item.hospital_id ? hospitalsById.get(item.hospital_id) : undefined}
              onPress={() => navigation.navigate('ShiftForm', { shift: item })}
            />
          )}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => navigation.navigate('ShiftForm', { initialDate: selectedDate })}
      >
        <Plus size={24} color={colors.textInverse} />
      </Pressable>
    </SafeAreaView>
  );
}

function ShiftRow({ shift, hospital, onPress }: { shift: Shift; hospital?: Hospital; onPress: () => void }) {
  const hours = durationInHours(shift.start_at, shift.end_at);
  // Compromisso não tem hospital — o "título" da linha vira o nome digitado
  // nele, e a bolinha usa a cor própria escolhida em vez da cor do hospital.
  const isCommitment = !shift.hospital_id;
  const dotColor = shift.passed_to
    ? colors.passed
    : isCommitment
      ? shift.color ?? colors.textSecondary
      : hospital?.color ?? colors.textSecondary;
  const title = isCommitment ? shift.shift_type?.trim() || 'Compromisso' : hospital?.name ?? 'Hospital removido';

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!isCommitment && !!shift.shift_type && <Text style={styles.rowSubtitle}>{shift.shift_type}</Text>}
        <Text style={styles.rowSubtitle}>
          {formatDateTimeRange(shift.start_at, shift.end_at)} · {hours.toFixed(0)}h
        </Text>
        {!!shift.passed_to && <Text style={styles.rowPassed}>Repassado para {shift.passed_to}</Text>}
      </View>
      <View style={styles.rowRight}>
        {shift.total_value !== null ? (
          <>
            <Text style={styles.rowValue}>{formatCurrency(shift.total_value)}</Text>
            <View
              style={[
                styles.statusBadge,
                shift.status === 'paid'
                  ? styles.statusPaid
                  : shift.status === 'passed'
                    ? styles.statusPassed
                    : styles.statusPending,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  shift.status === 'paid'
                    ? styles.statusPaidText
                    : shift.status === 'passed'
                      ? styles.statusPassedText
                      : styles.statusPendingText,
                ]}
              >
                {shift.status === 'paid' ? 'Pago' : shift.status === 'passed' ? 'Passado' : 'A receber'}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.commitmentBadge}>
            <Text style={styles.commitmentBadgeText}>Compromisso</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  dayHeader: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  dayHeaderText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  loading: { marginTop: spacing.xl },
  errorText: { color: colors.danger, textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  emptyText: { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg, fontSize: fontSize.sm },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  rowContent: { flex: 1, gap: 2 },
  rowTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  rowSubtitle: { fontSize: fontSize.xs, color: colors.textSecondary },
  rowPassed: { fontSize: fontSize.xs, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: spacing.xs },
  rowValue: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  statusPaid: { backgroundColor: colors.primaryLight },
  statusPending: { backgroundColor: colors.warningLight },
  statusPassed: { backgroundColor: colors.passedLight },
  statusText: { fontSize: 10, fontWeight: fontWeight.semibold },
  statusPaidText: { color: colors.success },
  statusPendingText: { color: colors.warning },
  statusPassedText: { color: colors.textSecondary },
  commitmentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.background,
  },
  commitmentBadgeText: { fontSize: 10, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});