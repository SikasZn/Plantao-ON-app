// src/contexts/SubscriptionContext.tsx
//
// Estado da assinatura do usuário logado. `status`:
//  - 'loading'  checando com o RevenueCat
//  - 'active'   tem acesso (assinatura ou teste grátis) — ou a cobrança está
//               desligada (sem chave do RevenueCat), então tudo fica liberado
//  - 'inactive' sem acesso → o app mostra o paywall
//  - 'error'    não deu pra checar (sem internet, por exemplo) → tela de
//               "tentar de novo", pra não prender quem já paga no paywall
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { useAuth } from './AuthContext';
import {
  hasActiveAccess,
  isPaywallEnabled,
  getAccessOverride,
  listenToCustomerInfo,
  type AccessOverride,
  purchasePackage as purchasePackageService,
  restorePurchases as restorePurchasesService,
  signInToSubscriptions,
  signOutOfSubscriptions,
  summarizeSubscription,
  type SubscriptionSummary,
} from '../services/subscriptionService';

export type SubscriptionStatus = 'loading' | 'active' | 'inactive' | 'error';

interface SubscriptionContextValue {
  enabled: boolean;
  status: SubscriptionStatus;
  // true pra contas liberadas manualmente (sem assinatura)
  hasFreeAccess: boolean;
  summary: SubscriptionSummary | null;
  managementUrl: string | null;
  refresh: () => Promise<void>;
  // true se a compra foi concluída; false se a pessoa cancelou
  purchase: (pkg: PurchasesPackage) => Promise<boolean>;
  // true se a restauração encontrou uma assinatura ativa
  restore: () => Promise<boolean>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

interface SubscriptionResult {
  // a quem pertence o resultado — evita mostrar a assinatura de uma conta
  // anterior logo depois de trocar de usuário
  userId: string;
  status: Exclude<SubscriptionStatus, 'loading'>;
  info: CustomerInfo | null;
  // acesso liberado manualmente (access_overrides), sem assinatura
  hasFreeAccess: boolean;
}

// Junta as duas fontes de acesso: a liberação manual vale primeiro (assim
// uma conta interna entra mesmo se o RevenueCat estiver fora do ar), depois a
// assinatura. Se não deu pra consultar alguma das duas e a outra não liberou,
// o resultado é "erro" (tentar de novo) — nunca um paywall por falha de rede.
function buildResult(
  userId: string,
  override: AccessOverride,
  info: CustomerInfo | null
): SubscriptionResult {
  if (override === 'yes') return { userId, status: 'active', info, hasFreeAccess: true };
  if (info && hasActiveAccess(info)) return { userId, status: 'active', info, hasFreeAccess: false };
  if (!info || override === 'unknown') return { userId, status: 'error', info, hasFreeAccess: false };
  return { userId, status: 'inactive', info, hasFreeAccess: false };
}

async function checkAccess(userId: string): Promise<SubscriptionResult> {
  const [override, info] = await Promise.allSettled([getAccessOverride(userId), signInToSubscriptions(userId)]);
  return buildResult(
    userId,
    override.status === 'fulfilled' ? override.value : 'unknown',
    info.status === 'fulfilled' ? info.value : null
  );
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [result, setResult] = useState<SubscriptionResult | null>(null);

  // atualização vinda do RevenueCat (compra, renovação, cancelamento) — a
  // liberação manual continua valendo
  const applyInfo = useCallback((uid: string, info: CustomerInfo) => {
    setResult((previous) => {
      // ignora atualizações que chegam antes da checagem inicial terminar —
      // senão uma conta liberada manualmente piscaria o paywall
      if (!previous || previous.userId !== uid) return previous;
      return buildResult(uid, previous.hasFreeAccess ? 'yes' : 'no', info);
    });
  }, []);

  useEffect(() => {
    if (!isPaywallEnabled) return;
    if (!userId) {
      signOutOfSubscriptions();
      return;
    }
    let cancelled = false;
    checkAccess(userId).then((checked) => {
      if (!cancelled) setResult(checked);
    });
    const stopListening = listenToCustomerInfo((info) => applyInfo(userId, info));
    return () => {
      cancelled = true;
      stopListening();
    };
  }, [userId, applyInfo]);

  const refresh = useCallback(async () => {
    if (!isPaywallEnabled || !userId) return;
    setResult(null);
    setResult(await checkAccess(userId));
  }, [userId]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage) => {
      if (!userId) return false;
      const purchaseResult = await purchasePackageService(pkg);
      if (purchaseResult.status === 'cancelled') return false;
      applyInfo(userId, purchaseResult.customerInfo);
      return true;
    },
    [userId, applyInfo]
  );

  const restore = useCallback(async () => {
    if (!userId) return false;
    const info = await restorePurchasesService();
    applyInfo(userId, info);
    return hasActiveAccess(info);
  }, [userId, applyInfo]);

  const current = result && result.userId === userId ? result : null;
  const status: SubscriptionStatus = !isPaywallEnabled ? 'active' : (current?.status ?? 'loading');
  const info = current?.info ?? null;
  const hasFreeAccess = current?.hasFreeAccess ?? false;

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      enabled: isPaywallEnabled,
      status,
      hasFreeAccess,
      summary: info ? summarizeSubscription(info) : null,
      managementUrl: info?.managementURL ?? null,
      refresh,
      purchase,
      restore,
    }),
    [status, hasFreeAccess, info, refresh, purchase, restore]
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription deve ser usado dentro de SubscriptionProvider');
  return ctx;
}
