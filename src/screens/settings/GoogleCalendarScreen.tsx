// src/screens/settings/GoogleCalendarScreen.tsx
//
// Conecta uma conta Google (a mesma do login, ou uma separada) pra criar um
// evento na Agenda automaticamente pra cada plantão ou compromisso novo.
// Sincronização só nesse sentido (app → Agenda) — ver nota em
// googleCalendarService.ts sobre por que o caminho inverso não existe.
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Calendar, CheckCircle2 } from 'lucide-react-native';
import type { MainStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { useShifts } from '../../hooks/useShifts';
import { useHospitals } from '../../contexts/HospitalsContext';
import {
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  isGoogleCalendarConnected,
  syncShiftToGoogleCalendar,
} from '../../services/googleCalendarService';
import { setShiftGoogleEventId } from '../../services/shiftsService';
import { Button } from '../../components/ui/Button';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';
import type { Hospital } from '../../types/domain';

type Props = NativeStackScreenProps<MainStackParamList, 'GoogleCalendar'>;

export function GoogleCalendarScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { shifts, refetch } = useShifts();
  const { hospitals } = useHospitals();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ done: number; total: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      isGoogleCalendarConnected(user.id).then(setIsConnected);
    }, [user])
  );

  const hospitalsById = useMemo(() => {
    const map = new Map<string, Hospital>();
    hospitals.forEach((h) => map.set(h.id, h));
    return map;
  }, [hospitals]);

  const pendingCount = shifts.filter((s) => !s.google_calendar_event_id).length;

  async function handleConnect() {
    if (!user) return;
    setIsConnecting(true);
    try {
      await connectGoogleCalendar(user.id);
      setIsConnected(true);
      Alert.alert('Conectado', 'Sua conta Google Agenda foi conectada.');
    } catch (error) {
      Alert.alert('Não foi possível conectar', (error as Error).message);
    } finally {
      setIsConnecting(false);
    }
  }

  function handleDisconnect() {
    if (!user) return;
    Alert.alert(
      'Desconectar Google Agenda',
      'Plantões já sincronizados continuam na sua Agenda, mas novos plantões deixam de ser criados lá automaticamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar',
          style: 'destructive',
          onPress: async () => {
            await disconnectGoogleCalendar(user.id);
            setIsConnected(false);
          },
        },
      ]
    );
  }

  async function handleSyncExisting() {
    const pending = shifts.filter((s) => !s.google_calendar_event_id);
    if (pending.length === 0) return;

    setIsSyncing(true);
    setSyncProgress({ done: 0, total: pending.length });
    let failed = 0;

    // um de cada vez (não em paralelo) pra não estourar o limite de
    // requisições da Calendar API e pra poder mostrar progresso real
    for (let i = 0; i < pending.length; i++) {
      const shift = pending[i];
      try {
        // Compromisso não tem hospital — usa o nome digitado nele
        const hospitalName = shift.hospital_id
          ? hospitalsById.get(shift.hospital_id)?.name ?? 'Hospital removido'
          : shift.shift_type?.trim() || 'Compromisso';
        const eventId = await syncShiftToGoogleCalendar(shift, hospitalName);
        await setShiftGoogleEventId(shift.id, eventId);
      } catch {
        failed += 1;
      }
      setSyncProgress({ done: i + 1, total: pending.length });
    }

    setIsSyncing(false);
    setSyncProgress(null);
    await refetch();

    const succeeded = pending.length - failed;
    Alert.alert(
      'Sincronização concluída',
      failed === 0
        ? `${succeeded} ${succeeded === 1 ? 'plantão sincronizado' : 'plantões sincronizados'} com a Google Agenda.`
        : `${succeeded} sincronizados, ${failed} falharam. Você pode tentar de novo depois.`
    );
  }

  if (isConnected === null) {
    return (
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Google Agenda</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.statusCard}>
          {isConnected ? (
            <CheckCircle2 size={28} color={colors.primary} />
          ) : (
            <Calendar size={28} color={colors.textSecondary} />
          )}
          <View style={styles.statusText}>
            <Text style={styles.statusTitle}>{isConnected ? 'Conectado' : 'Não conectado'}</Text>
            <Text style={styles.statusSubtitle}>
              {isConnected
                ? 'Todo plantão ou compromisso novo vira um evento automaticamente na sua Google Agenda.'
                : 'Conecte sua conta Google pra ver seus plantões direto na Agenda do seu celular.'}
            </Text>
          </View>
        </View>

        {isConnected ? (
          <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
            <Text style={styles.disconnectText}>Desconectar</Text>
          </TouchableOpacity>
        ) : (
          <Button label="Conectar com Google Agenda" onPress={handleConnect} loading={isConnecting} />
        )}

        {isConnected && (
          <View style={styles.syncSection}>
            <Text style={styles.syncLabel}>
              {pendingCount === 0
                ? 'Todos os seus plantões já estão sincronizados.'
                : `${pendingCount} ${
                    pendingCount === 1 ? 'plantão ainda não está' : 'plantões ainda não estão'
                  } na Agenda.`}
            </Text>
            <Button
              label={
                isSyncing && syncProgress
                  ? `Sincronizando ${syncProgress.done}/${syncProgress.total}...`
                  : 'Sincronizar plantões existentes agora'
              }
              variant="outline"
              onPress={handleSyncExisting}
              loading={isSyncing}
              disabled={pendingCount === 0}
            />
          </View>
        )}

        <Text style={styles.footnote}>
          A sincronização é só num sentido: mudanças feitas aqui no app atualizam a Agenda, mas editar ou apagar o
          evento direto na Google Agenda não muda nada aqui no Plantão ON.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  headerSpacer: { width: 24 },
  loading: { marginTop: spacing.xl },
  container: { padding: spacing.lg, paddingTop: spacing.sm },
  statusCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  statusText: { flex: 1 },
  statusTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  statusSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  disconnectButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    marginBottom: spacing.lg,
  },
  disconnectText: { color: colors.danger, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  syncSection: { marginBottom: spacing.lg, gap: spacing.sm },
  syncLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  footnote: { fontSize: fontSize.xs, color: colors.textSecondary, lineHeight: 16 },
});