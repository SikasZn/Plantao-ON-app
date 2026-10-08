// src/screens/settings/BackupScreen.tsx
//
// "Backup" aqui não é sincronização entre aparelhos — os dados já ficam
// salvos na nuvem (Supabase) assim que a pessoa salva qualquer coisa no
// app, então não existe risco de perda ao trocar de celular ou desinstalar
// o app (basta entrar de novo com a mesma conta). Essa tela serve pra
// exportar uma cópia própria dos dados: útil pra guardar por conta própria,
// levar pra outro sistema, ou mandar pro contador/financeiro.
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Download, Mail } from 'lucide-react-native';
import type { MainStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { useShifts } from '../../hooks/useShifts';
import { useHospitals } from '../../contexts/HospitalsContext';
import { getOwnProfile } from '../../services/authService';
import { exportBackup, emailBackup, type BackupData } from '../../services/backupService';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';

type Props = NativeStackScreenProps<MainStackParamList, 'Backup'>;
type BusyAction = 'share' | 'email' | null;

export function BackupScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { shifts } = useShifts();
  const { hospitals } = useHospitals();
  const [busyAction, setBusyAction] = useState<BusyAction>(null);

  async function buildData(): Promise<BackupData> {
    const profile = user
      ? await getOwnProfile(user.id)
      : { fullName: '', specialty: '', avatarUrl: null };
    return {
      exportedAt: new Date().toISOString(),
      profile: { email: user?.email ?? '', fullName: profile.fullName, specialty: profile.specialty },
      hospitals,
      shifts,
    };
  }

  async function handleExport() {
    setBusyAction('share');
    try {
      const data = await buildData();
      await exportBackup(data);
    } catch (error) {
      Alert.alert('Não foi possível exportar', (error as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleEmail() {
    setBusyAction('email');
    try {
      const data = await buildData();
      await emailBackup(data);
    } catch (error) {
      Alert.alert('Não foi possível enviar', (error as Error).message);
    } finally {
      setBusyAction(null);
    }
  }

  const isBusy = busyAction !== null;
  const isEmpty = shifts.length === 0 && hospitals.length === 0;

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Backup e sincronização</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Seus dados já estão salvos na nuvem</Text>
          <Text style={styles.infoText}>
            Tudo que você cadastra no Plantão ON é salvo automaticamente nos nossos servidores assim que você salva
            — não existe risco de perder nada ao trocar de celular ou desinstalar o app. É só entrar de novo com a
            mesma conta que todos os seus plantões e hospitais aparecem de volta.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>Exportar meus dados</Text>
        <Text style={styles.sectionText}>
          Gera um arquivo com uma cópia de todos os seus hospitais, plantões e dados de perfil — útil pra guardar
          por conta própria, levar pra outro sistema ou mandar pro seu contador.
        </Text>

        <TouchableOpacity style={styles.actionRow} onPress={handleExport} disabled={isBusy || isEmpty}>
          {busyAction === 'share' ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Download size={22} color={colors.primary} />
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Baixar / compartilhar</Text>
                <Text style={styles.actionSubtitle}>Salva um arquivo .json com todos os seus dados</Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionRow} onPress={handleEmail} disabled={isBusy || isEmpty}>
          {busyAction === 'email' ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Mail size={22} color={colors.primary} />
              <View style={styles.actionText}>
                <Text style={styles.actionTitle}>Enviar por e-mail</Text>
                <Text style={styles.actionSubtitle}>Abre seu app de e-mail com o arquivo já anexado</Text>
              </View>
            </>
          )}
        </TouchableOpacity>

        {isEmpty && (
          <Text style={styles.emptyText}>Cadastre ao menos um hospital ou plantão pra poder exportar.</Text>
        )}
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
  container: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  infoCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  infoTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  infoText: { fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 20 },
  sectionLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionText: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 18 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 64,
  },
  actionText: { flex: 1 },
  actionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  actionSubtitle: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.lg },
});