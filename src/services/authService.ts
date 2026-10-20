// src/services/authService.ts
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { TablesUpdate } from '../types/database';
import type { ProfileSex } from '../types/domain';

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string,
  specialty: string,
  // 'YYYY-MM-DD' ou null — os dois são opcionais no cadastro (dá pra
  // preencher depois no Perfil)
  birthDate: string | null,
  sex: ProfileSex | null
) {
  // full_name, specialty, birth_date e sex vão como metadata do próprio
  // signUp — é o trigger handle_new_user() (security definer) que grava a
  // linha em profiles, e ele roda mesmo sem sessão ativa ainda (ex.:
  // confirmação de e-mail pendente). Um update feito pelo cliente logo em
  // seguida dependeria de auth.uid(), que só existe depois que a sessão
  // nasce de verdade (ver migration_signup_birth_date_sex.sql).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName, specialty, birth_date: birthDate, sex } },
  });
  if (error) throw error;
  return data;
}

/**
 * Troca o idToken de um provedor social (Google/Apple) por uma sessão do
 * Supabase. Se a conta ainda não existia, o Supabase já cria o usuário na
 * hora — é o mesmo trigger handle_new_user() do cadastro por e-mail que cria
 * a linha em profiles automaticamente.
 */
export async function signInWithIdToken(provider: 'google' | 'apple', token: string, nonce?: string) {
  const { data, error } = await supabase.auth.signInWithIdToken({ provider, token, nonce });
  if (error) throw error;
  return data;
}

export interface ProfileUpdate {
  fullName?: string;
  specialty?: string;
  avatarUrl?: string;
  // 'YYYY-MM-DD' (ou null pra apagar) — item 17 do documento
  birthDate?: string | null;
  sex?: ProfileSex | null;
}

export async function updateOwnProfile(userId: string, updates: ProfileUpdate) {
  // precisa ser o tipo gerado pelo Supabase (TablesUpdate<'profiles'>), não
  // um Record<string, string> genérico — um índice genérico não bate com o
  // formato exato que o .update() tipado espera, mesmo com as chaves certas
  const payload: TablesUpdate<'profiles'> = {};
  if (updates.fullName !== undefined) payload.full_name = updates.fullName;
  if (updates.specialty !== undefined) payload.specialty = updates.specialty;
  if (updates.avatarUrl !== undefined) payload.avatar_url = updates.avatarUrl;
  if (updates.birthDate !== undefined) payload.birth_date = updates.birthDate;
  if (updates.sex !== undefined) payload.sex = updates.sex;
  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
  if (error) throw error;
}

export interface OwnProfile {
  fullName: string;
  specialty: string;
  avatarUrl: string | null;
  // null = ainda não preencheu — diferente de sex: 'unspecified', que é uma
  // escolha explícita de "prefiro não informar"
  birthDate: string | null;
  sex: ProfileSex | null;
}

export async function getOwnProfile(userId: string): Promise<OwnProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, specialty, avatar_url, birth_date, sex')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return {
    fullName: data.full_name ?? '',
    specialty: data.specialty ?? '',
    avatarUrl: data.avatar_url,
    birthDate: data.birth_date,
    sex: data.sex as ProfileSex | null,
  };
}

/**
 * true quando a conta acabou de ser criada agora mesmo (created_at e
 * last_sign_in_at praticamente coincidem) — usado pra decidir se mostra o
 * onboarding também pra quem entrou pela primeira vez via Google/Apple.
 */
export function isBrandNewUser(user: { created_at: string; last_sign_in_at?: string | null }): boolean {
  if (!user.last_sign_in_at) return true;
  const created = new Date(user.created_at).getTime();
  const lastSignIn = new Date(user.last_sign_in_at).getTime();
  return Math.abs(lastSignIn - created) < 5000;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Exclui a conta e todos os dados do usuário logado. Quem faz o trabalho
 * pesado é a Edge Function "delete-account" (precisa da service role pra
 * apagar o usuário do Auth, o que o app nunca pode fazer sozinho). Depois
 * disso a sessão local já não vale mais, então só limpamos o que ficou no
 * aparelho.
 */
export async function deleteOwnAccount() {
  const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  // o usuário não existe mais no servidor: encerra só a sessão local
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
}

export async function sendPasswordResetEmail(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function subscribeToAuthChanges(callback: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}