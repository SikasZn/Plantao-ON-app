// src/screens/dashboard/DashboardScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Bell, Plus } from 'lucide-react-native';
import type { MainTabParamList, MainStackParamList } from '../../navigation/types';
import { useShifts } from '../../hooks/useShifts';
import { useHospitals } from '../../contexts/HospitalsContext';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { getOwnProfile } from '../../services/authService';
import { formatCurrency } from '../../utils/currency';
import { formatDateTimeRange, durationInHours, formatDayNumber, formatMonthAbbrev } from '../../utils/date';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';
import type { Shift, Hospital, ProfileSex } from '../../types/domain';

// Item 17 do documento: o perfil agora tem sexo, então dá pra tratar
// "Dr./Dra." direito aqui em vez de usar "Dr." fixo pra todo mundo. Sem sexo
// informado (null ou 'unspecified'), fica só o primeiro nome, sem título.
function greetingTitle(sex: ProfileSex | null): string {
  if (sex === 'male') return 'Dr. ';
  if (sex === 'female') return 'Dra. ';
  return '';
}

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Dashboard'>,
  NativeStackScreenProps<MainStackParamList>
>;

export function DashboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { shifts, refetch } = useShifts();
  const { hospitals } = useHospitals();
  const [sex, setSex] = useState<ProfileSex | null>(null);

  // recarrega sempre que a aba ganha foco (ex.: voltando do formulário de plantão)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // só pro "Dr./Dra." do cumprimento — sem problema recarregar isso pouco
  // (é 1 linha por chave primária), não precisa de refetch no foco como os
  // plantões
  useEffect(() => {
    if (!user) return;
    getOwnProfile(user.id)
      .then((profile) => setSex(profile.sex))
      .catch(() => {
        // silenciosamente ignora — o cumprimento só fica sem título, nada quebra
      });
  }, [user]);

  const hospitalsById = useMemo(() => {
    const map = new Map<string, Hospital>();
    hospitals.forEach((h) => map.set(h.id, h));
    return map;
  }, [hospitals]);

  const monthShifts = useMemo(() => {
    const now = new Date();
    return shifts.filter((shift) => {
      const d = new Date(shift.start_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [shifts]);

  // total_value é nullable (Compromisso usa null) — '?? 0' trata isso como
  // "não soma nada"
  const paidThisMonth = monthShifts
    .filter((s) => s.status === 'paid')
    .reduce((sum, s) => sum + (s.total_value ?? 0), 0);
  const pendingThisMonth = monthShifts
    .filter((s) => s.status === 'pending')
    .reduce((sum, s) => sum + (s.total_value ?? 0), 0);

  // Totais gerais (todo o histórico, não só o mês) — só conta plantões de
  // verdade, não Compromisso (total_value null), já que "horas trabalhadas"
  // não inclui um compromisso como uma reunião
  const realShifts = useMemo(() => shifts.filter((s) => s.total_value !== null), [shifts]);
  const totalShiftsCount = realShifts.length;
  const totalHoursWorked = useMemo(
    () => realShifts.reduce((sum, s) => sum + durationInHours(s.start_at, s.end_at), 0),
    [realShifts]
  );

  // pendente de meses futuros (não conta o mês atual, que já está em pendingThisMonth)
  const pendingFutureMonths = useMemo(() => {
    const now = new Date();
    const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return shifts
      .filter(
        (shift) => shift.status === 'pending' && new Date(shift.start_at).getTime() > endOfCurrentMonth.getTime()
      )
      .reduce((sum, s) => sum + (s.total_value ?? 0), 0);
  }, [shifts]);

  const upcomingShifts = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return shifts
      .filter((shift) => new Date(shift.end_at).getTime() >= todayStart.getTime())
      .sort((a, b) => a.start_at.localeCompare(b.start_at))
      .slice(0, 3);
  }, [shifts]);

  const firstName: string | undefined = user?.user_metadata?.full_name?.split(' ')?.[0];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{firstName ? `Olá, ${greetingTitle(sex)}${firstName}!` : 'Olá!'}</Text>
            <Text style={styles.subGreeting}>Sua semana em resumo</Text>
          </View>
          {/* decorativo por enquanto — liga com notificações reais no Passo 5 */}
          <Bell size={22} color={colors.textSecondary} />
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard label="Plantões neste mês" value={String(monthShifts.length)} />
            <StatCard label="Pagos do mês" value={formatCurrency(paidThisMonth)} />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="A receber (mês atual)" value={formatCurrency(pendingThisMonth)} />
            <StatCard label="A receber (próx. meses)" value={formatCurrency(pendingFutureMonths)} />
          </View>
          <View style={styles.statsRow}>
            <StatCard label="Total de plantões" value={String(totalShiftsCount)} />
            <StatCard label="Total de horas trabalhadas" value={`${totalHoursWorked.toFixed(0)}h`} />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Próximos plantões</Text>
          <Pressable onPress={() => navigation.navigate('Shifts')}>
            <Text style={styles.sectionLink}>Ver todos</Text>
          </Pressable>
        </View>

        {upcomingShifts.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum plantão agendado.</Text>
        ) : (
          upcomingShifts.map((shift) => (
            <UpcomingShiftRow
              key={shift.id}
              shift={shift}
              hospital={shift.hospital_id ? hospitalsById.get(shift.hospital_id) : undefined}
              onPress={() => navigation.navigate('ShiftForm', { shift })}
            />
          ))
        )}

        <Button
          label="Novo plantão"
          icon={<Plus size={20} color={colors.textInverse} />}
          onPress={() => navigation.navigate('ShiftForm')}
          style={styles.newShiftButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function UpcomingShiftRow({
  shift,
  hospital,
  onPress,
}: {
  shift: Shift;
  hospital?: Hospital;
  onPress: () => void;
}) {
  const hours = durationInHours(shift.start_at, shift.end_at);
  const isPassed = !!shift.passed_to;
  // Compromisso não tem hospital — mostra o nome digitado e a cor própria
  // escolhida em vez da cor (inexistente) de um hospital.
  const isCommitment = !shift.hospital_id;
  const dotColor = isPassed
    ? colors.passed
    : isCommitment
      ? shift.color ?? colors.textSecondary
      : hospital?.color ?? colors.textSecondary;
  const title = isCommitment ? shift.shift_type?.trim() || 'Compromisso' : hospital?.name ?? 'Local removido';

  return (
    <Pressable style={styles.upcomingRow} onPress={onPress}>
      <View style={styles.dateBadge}>
        <Text style={styles.dateBadgeDay}>{formatDayNumber(shift.start_at)}</Text>
        <Text style={styles.dateBadgeMonth}>{formatMonthAbbrev(shift.start_at)}</Text>
      </View>
      <View style={styles.upcomingContent}>
        <View style={styles.upcomingTitleRow}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={styles.upcomingTitle}>{title}</Text>
        </View>
        <Text style={styles.upcomingSubtitle}>
          {/* pra Compromisso, shift_type já é o título acima — não repete aqui */}
          {!isCommitment && shift.shift_type ? `${shift.shift_type} · ` : ''}
          {formatDateTimeRange(shift.start_at, shift.end_at)} · {hours.toFixed(0)}h
        </Text>
        {isPassed && <Text style={styles.upcomingPassed}>Repassado para {shift.passed_to}</Text>}
      </View>
      <View style={styles.upcomingRight}>
        <Text style={styles.upcomingValue}>
          {shift.total_value !== null ? formatCurrency(shift.total_value) : 'Compromisso'}
        </Text>
        {isPassed && (
          <View style={styles.passedBadge}>
            <Text style={styles.passedBadgeText}>Passado</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  greeting: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  subGreeting: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  statsGrid: { gap: spacing.sm, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: spacing.xs },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  sectionLink: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.semibold },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.lg },
  upcomingRow: {
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
  dateBadge: {
    width: 48,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
  },
  dateBadgeDay: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  dateBadgeMonth: { fontSize: 10, color: colors.textSecondary, fontWeight: fontWeight.semibold },
  upcomingContent: { flex: 1, gap: 2 },
  upcomingTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  upcomingTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  upcomingSubtitle: { fontSize: fontSize.xs, color: colors.textSecondary },
  upcomingPassed: { fontSize: fontSize.xs, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 },
  upcomingRight: { alignItems: 'flex-end', gap: spacing.xs },
  upcomingValue: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  passedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.passedLight,
  },
  passedBadgeText: { fontSize: 10, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  newShiftButton: { marginTop: spacing.md },
});