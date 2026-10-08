// src/utils/profileCompletion.ts
//
// Mesma ideia do onboarding-pending: controla se a tela de "complete seu
// perfil" ainda precisa ser mostrada. Só é marcada pra contas criadas via
// login social (Google/Apple) — quem se cadastra por e-mail já preenche
// nome e especialização no próprio formulário de cadastro.
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'plantao-on:profile-pending:';

export async function markProfileCompletionPending(userId: string): Promise<void> {
  await AsyncStorage.setItem(`${KEY_PREFIX}${userId}`, '1');
}

export async function hasProfileCompletionPending(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(`${KEY_PREFIX}${userId}`);
  return value === '1';
}

export async function clearProfileCompletionPending(userId: string): Promise<void> {
  await AsyncStorage.removeItem(`${KEY_PREFIX}${userId}`);
}