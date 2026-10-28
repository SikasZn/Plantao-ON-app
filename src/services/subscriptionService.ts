// src/services/subscriptionService.ts
//
// Camada fina em cima do RevenueCat (react-native-purchases). Todo o resto do
// app fala com a assinatura só por aqui e pelo SubscriptionContext.
//
// A cobrança só liga quando existe a chave pública do RevenueCat da
// plataforma no .env (EXPO_PUBLIC_REVENUECAT_ANDROID_KEY / _IOS_KEY). Sem a
// chave — desenvolvimento, Expo Go, ou iOS enquanto a conta Apple não sai —
// o app funciona liberado, sem paywall.
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import Purchases, { type CustomerInfo, type PurchasesIntroPrice, type PurchasesPackage } from 'react-native-purchases';

// as referências a process.env.EXPO_PUBLIC_* precisam ser literais pro
// Expo substituir o valor na hora do bundle
const API_KEY = Platform.select({
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  default: undefined,
});

export const isPaywallEnabled = !!API_KEY;

let isConfigured = false;

// Entra com o usuário do Supabase como "app user id" do RevenueCat, pra
// assinatura seguir a conta (e não o aparelho) e valer em qualquer celular.
export async function signInToSubscriptions(userId: string): Promise<CustomerInfo> {
  if (!API_KEY) throw new Error('RevenueCat não configurado');
  if (!isConfigured) {
    Purchases.configure({ apiKey: API_KEY, appUserID: userId });
    isConfigured = true;
    return Purchases.getCustomerInfo();
  }
  const { customerInfo } = await Purchases.logIn(userId);
  return customerInfo;
}

export async function signOutOfSubscriptions(): Promise<void> {
  if (!isConfigured) return;
  try {
    await Purchases.logOut();
  } catch {
    // já estava anônimo — nada a fazer
  }
}

// Acesso liberado manualmente (tabela access_overrides, que só quem tem acesso
// ao banco consegue preencher — ver supabase/access_overrides.sql). Serve pra
// contas internas, demonstração e revisores da loja entrarem sem assinar.
//  - 'yes'     tem liberação válida
//  - 'no'      não tem (ou expirou)
//  - 'unknown' não deu pra consultar (sem internet etc.)
export type AccessOverride = 'yes' | 'no' | 'unknown';

export async function getAccessOverride(userId: string): Promise<AccessOverride> {
  // Função no banco: olha access_overrides (por usuário) e access_emails (por
  // e-mail, vale antes mesmo de a conta existir), respeitando expires_at.
  const { data, error } = await supabase.rpc('has_free_access');
  if (!error && typeof data === 'boolean') return data ? 'yes' : 'no';

  // Fallback (função ainda não criada no banco): só a tabela por usuário.
  const { data: row, error: rowError } = await supabase
    .from('access_overrides')
    .select('expires_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (rowError) return 'unknown';
  if (!row) return 'no';
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return 'no';
  return 'yes';
}

export function listenToCustomerInfo(callback: (info: CustomerInfo) => void): () => void {
  Purchases.addCustomerInfoUpdateListener(callback);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(callback);
  };
}

// Qualquer entitlement ativo libera o app (inclui o período de teste grátis).
// Aceitar "qualquer um" evita quebrar se o identificador no painel do
// RevenueCat for diferente do que está documentado.
export function hasActiveAccess(info: CustomerInfo): boolean {
  return Object.keys(info.entitlements.active).length > 0;
}

export interface SubscriptionSummary {
  isTrial: boolean;
  willRenew: boolean;
  // ISO — fim do teste ou do período atual
  expirationDate: string | null;
}

export function summarizeSubscription(info: CustomerInfo): SubscriptionSummary | null {
  const active = Object.values(info.entitlements.active)[0];
  if (!active) return null;
  return {
    isTrial: active.periodType === 'TRIAL',
    willRenew: active.willRenew,
    expirationDate: active.expirationDate,
  };
}

// Planos disponíveis na oferta atual, mensal primeiro e anual depois
export async function getAvailablePackages(): Promise<PurchasesPackage[]> {
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return [];
  const ordered = [current.monthly, current.annual].filter((p): p is PurchasesPackage => !!p);
  const rest = current.availablePackages.filter((p) => !ordered.some((o) => o.identifier === p.identifier));
  return [...ordered, ...rest];
}

export type PurchaseResult = { status: 'purchased'; customerInfo: CustomerInfo } | { status: 'cancelled' };

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseResult> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { status: 'purchased', customerInfo };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'userCancelled' in error && error.userCancelled) {
      return { status: 'cancelled' };
    }
    throw error;
  }
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

// Dias de teste grátis do plano (ex.: 30), ou null se o plano não tem teste
export function getFreeTrialDays(pkg: PurchasesPackage): number | null {
  const intro: PurchasesIntroPrice | null = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const unitDays: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };
  const perUnit = unitDays[intro.periodUnit];
  if (!perUnit) return null;
  return perUnit * intro.periodNumberOfUnits * Math.max(intro.cycles, 1);
}

// Economia do plano anual frente a 12 meses do mensal, em % (ex.: 33)
export function getAnnualSavingsPercent(monthly: PurchasesPackage, annual: PurchasesPackage): number | null {
  const yearAtMonthlyPrice = monthly.product.price * 12;
  if (yearAtMonthlyPrice <= 0) return null;
  const percent = Math.round((1 - annual.product.price / yearAtMonthlyPrice) * 100);
  return percent > 0 ? percent : null;
}
