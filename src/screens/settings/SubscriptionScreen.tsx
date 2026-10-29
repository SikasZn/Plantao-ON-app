// src/screens/settings/SubscriptionScreen.tsx
//
// Mais > Assinatura: situação do plano, atalho pra gerenciar/cancelar na
// Google Play e restaurar compras.
import React, { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { Button } from '../../components/ui/Button';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';

type Props = NativeStackScreenProps<MainStackParamList, 'Subscription'>;

const PLAY_SUBSCRIPTIONS_URL =
  Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions';
const STORE_NAME = Platform.OS === 'ios' ? 'na App Store' : 'no Google Play';
const STORE_ACCOUNT = Platform.OS === 'ios' ? 'da Apple' : 'do Google Play';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('pt-BR');
}

export function SubscriptionScreen({ navigation }: Props) {
  const { summary, managementUrl, restore, hasFreeAccess } = useSubscription();
  const [isRestoring, setIsRestoring] = useState(false);

  async function handleRestore() {
    setIsRestoring(true);
    try {
      const found = await restore();
      Alert.alert(
        found ? 'Assinatura restaurada' : 'Nenhuma assinatura encontrada',
        found ? 'Sua assinatura está ativa.' : `Não encontramos uma assinatura ativa nesta conta ${STORE_ACCOUNT}.`
      );
    } catch {
      Alert.alert('Não foi possível restaurar', 'Verifique sua conexão e tente novamente.');
    } finally {
      setIsRestoring(false);
    }
  }

  const expiration = formatDate(summary?.expirationDate ?? null);
  let statusTitle = 'Assinatura ativa';
  let statusText = '';
  if (hasFreeAccess && !summary) {
    statusTitle = 'Acesso liberado';
    statusText = 'Esta conta tem acesso liberado pela equipe do Plantão ON, sem precisar de assinatura.';
  } else if (summary?.isTrial) {
    statusTitle = 'Período de teste grátis';
    statusText = expiration
      ? `Seu teste vai até ${expiration}. Depois disso a assinatura é cobrada, a menos que você cancele antes.`
      : '';
  } else if (summary) {
    statusText = expiration
      ? summary.willRenew
        ? `Renova automaticamente em ${expiration}.`
        : `Cancelada. Você continua com acesso até ${expiration}.`
      : '';
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assinatura</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{statusTitle}</Text>
          {!!statusText && <Text style={styles.cardText}>{statusText}</Text>}
        </View>

        {(!hasFreeAccess || !!summary) && (
        <>
        <Button
          label="Gerenciar assinatura"
          onPress={() => Linking.openURL(managementUrl ?? PLAY_SUBSCRIPTIONS_URL)}
        />
        <Text style={styles.hint}>
          Para cancelar ou trocar de plano, abra o gerenciamento {STORE_NAME}. Cancelar não apaga seus dados.
        </Text>

        <Button label="Restaurar compras" variant="outline" onPress={handleRestore} loading={isRestoring} style={styles.restore} />
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  headerSpacer: { width: 24 },
  container: { padding: spacing.lg },
  card: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  cardText: { fontSize: fontSize.sm, color: colors.textPrimary, marginTop: spacing.xs, lineHeight: 20 },
  hint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 17 },
  restore: { marginTop: spacing.lg },
});
