// src/screens/subscription/PaywallScreen.tsx
//
// Tela de assinatura. Aparece no lugar do app enquanto a pessoa não tem
// assinatura ativa nem teste grátis. Os preços e o teste grátis vêm da própria
// loja (via RevenueCat), então o texto sempre bate com o que será cobrado.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { Logo } from '../../components/ui/Logo';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { getAnnualSavingsPercent, getAvailablePackages, getFreeTrialDays } from '../../services/subscriptionService';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';

const TERMS_URL = 'https://plantaoon.imtmed.com.br/termos.html';
const PRIVACY_URL = 'https://plantaoon.imtmed.com.br/privacidade.html';

const BENEFITS = [
  'Calendário e controle de todos os seus plantões',
  'Ganhos, horas e financeiro por local de trabalho',
  'Relatórios em PDF e CSV, também por e-mail',
  'Lembretes e sincronização com a Google Agenda',
];

function periodLabel(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case 'MONTHLY':
      return 'por mês';
    case 'ANNUAL':
      return 'por ano';
    default:
      return '';
  }
}

function planName(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case 'MONTHLY':
      return 'Mensal';
    case 'ANNUAL':
      return 'Anual';
    default:
      return pkg.product.title;
  }
}

export function PaywallScreen() {
  const { signOut } = useAuth();
  const { purchase, restore } = useSubscription();
  const [packages, setPackages] = useState<PurchasesPackage[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getAvailablePackages()
      .then((list) => {
        if (cancelled) return;
        setPackages(list);
        // o plano anual vem pré-selecionado (melhor valor)
        const preferred = list.find((p) => p.packageType === 'ANNUAL') ?? list[0];
        setSelectedId(preferred?.identifier ?? null);
        if (list.length === 0) setLoadFailed(true);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function retryLoadPackages() {
    setLoadFailed(false);
    setPackages(null);
    setReloadKey((k) => k + 1);
  }

  const selected = packages?.find((p) => p.identifier === selectedId) ?? null;
  const monthly = packages?.find((p) => p.packageType === 'MONTHLY') ?? null;
  const annual = packages?.find((p) => p.packageType === 'ANNUAL') ?? null;
  const savings = monthly && annual ? getAnnualSavingsPercent(monthly, annual) : null;
  const trialDays = selected ? getFreeTrialDays(selected) : null;

  async function handlePurchase() {
    if (!selected) return;
    setIsBusy(true);
    try {
      await purchase(selected);
      // se concluiu, o contexto já liberou o app — a tela some sozinha
    } catch {
      Alert.alert('Não foi possível concluir', 'A compra não foi finalizada. Tente novamente em instantes.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRestore() {
    setIsBusy(true);
    try {
      const found = await restore();
      if (!found) {
        Alert.alert('Nenhuma assinatura encontrada', 'Não encontramos uma assinatura ativa nesta conta do Google Play.');
      }
    } catch {
      Alert.alert('Não foi possível restaurar', 'Verifique sua conexão e tente novamente.');
    } finally {
      setIsBusy(false);
    }
  }

  function handleSignOut() {
    Alert.alert('Sair', 'Deseja sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.logoWrapper}>
          <Logo size={72} />
        </View>
        <Text style={styles.title}>Assine o Plantão ON</Text>
        <Text style={styles.subtitle}>
          {trialDays ? `Experimente ${trialDays} dias grátis. Cancele quando quiser.` : 'Escolha o plano que combina com você.'}
        </Text>

        <View style={styles.benefits}>
          {BENEFITS.map((text) => (
            <View key={text} style={styles.benefitRow}>
              <View style={styles.benefitIcon}>
                <Check size={14} color={colors.primary} />
              </View>
              <Text style={styles.benefitText}>{text}</Text>
            </View>
          ))}
        </View>

        {packages === null && !loadFailed && <ActivityIndicator color={colors.primary} style={styles.loader} />}

        {loadFailed && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>Não foi possível carregar os planos agora.</Text>
            <Button label="Tentar de novo" variant="outline" onPress={retryLoadPackages} />
          </View>
        )}

        {packages?.map((pkg) => {
          const isSelected = pkg.identifier === selectedId;
          const pkgTrial = getFreeTrialDays(pkg);
          return (
            <Pressable
              key={pkg.identifier}
              style={[styles.plan, isSelected && styles.planSelected]}
              onPress={() => setSelectedId(pkg.identifier)}
            >
              <View style={[styles.radio, isSelected && styles.radioSelected]}>
                {isSelected && <View style={styles.radioDot} />}
              </View>
              <View style={styles.planInfo}>
                <View style={styles.planTitleRow}>
                  <Text style={styles.planName}>{planName(pkg)}</Text>
                  {pkg.packageType === 'ANNUAL' && savings ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Economize {savings}%</Text>
                    </View>
                  ) : null}
                </View>
                {pkgTrial ? <Text style={styles.planTrial}>{pkgTrial} dias grátis</Text> : null}
              </View>
              <View style={styles.planPrice}>
                <Text style={styles.priceText}>{pkg.product.priceString}</Text>
                <Text style={styles.priceUnit}>{periodLabel(pkg)}</Text>
              </View>
            </Pressable>
          );
        })}

        <Button
          label={trialDays ? `Começar ${trialDays} dias grátis` : 'Assinar'}
          onPress={handlePurchase}
          loading={isBusy}
          disabled={!selected}
          style={styles.cta}
        />

        {selected && (
          <Text style={styles.legal}>
            {trialDays
              ? `Depois do teste grátis, ${selected.product.priceString} ${periodLabel(selected)}. `
              : `${selected.product.priceString} ${periodLabel(selected)}. `}
            A assinatura é renovada automaticamente e cobrada na sua conta do Google Play, até você cancelar. Você pode
            cancelar a qualquer momento em Play Store &gt; Pagamentos e assinaturas &gt; Assinaturas.
          </Text>
        )}

        <TouchableOpacity onPress={handleRestore} disabled={isBusy} style={styles.linkButton}>
          <Text style={styles.link}>Restaurar compras</Text>
        </TouchableOpacity>

        <View style={styles.linksRow}>
          <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)}>
            <Text style={styles.linkSmall}>Termos de uso</Text>
          </TouchableOpacity>
          <Text style={styles.linkSmall}> · </Text>
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Text style={styles.linkSmall}>Privacidade</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handleSignOut} style={styles.linkButton}>
          <Text style={styles.linkMuted}>Sair da conta</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  logoWrapper: { alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.md },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  benefits: { gap: spacing.sm, marginBottom: spacing.lg },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  benefitIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary },
  loader: { marginVertical: spacing.lg },
  errorBox: { gap: spacing.md, marginBottom: spacing.md },
  errorText: { textAlign: 'center', color: colors.textSecondary, fontSize: fontSize.sm },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  planSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  planInfo: { flex: 1 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  planName: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  planTrial: { fontSize: fontSize.xs, color: colors.primary, fontWeight: fontWeight.semibold, marginTop: 2 },
  badge: { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { color: colors.textInverse, fontSize: 11, fontWeight: fontWeight.bold },
  planPrice: { alignItems: 'flex-end' },
  priceText: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  priceUnit: { fontSize: fontSize.xs, color: colors.textSecondary },
  cta: { marginTop: spacing.md },
  legal: { fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md, lineHeight: 17 },
  linkButton: { alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.xs },
  link: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  linksRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  linkSmall: { color: colors.textSecondary, fontSize: fontSize.xs },
  linkMuted: { color: colors.textSecondary, fontSize: fontSize.sm },
});
