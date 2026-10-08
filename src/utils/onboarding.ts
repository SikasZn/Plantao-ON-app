// src/utils/onboarding.ts
//
// Controla se o onboarding (as 5 telinhas de "Organize seus plantões...")
// ainda precisa ser mostrado pra um usuário específico. A flag é gravada no
// momento do cadastro e só é consumida na primeira vez que aquele usuário
// tiver uma sessão ativa de verdade — o que cobre tanto o caso de
// confirmação de e-mail desligada (sessão nasce na hora) quanto ligada
// (usuário confirma o e-mail depois e só ganha sessão ao fazer login,
// possivelmente já em uma nova abertura do app).
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'plantao-on:onboarding-pending:';

export async function markOnboardingPending(userId: string): Promise<void> {
  await AsyncStorage.setItem(`${KEY_PREFIX}${userId}`, '1');
}

export async function hasOnboardingPending(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(`${KEY_PREFIX}${userId}`);
  return value === '1';
}

export async function clearOnboardingPending(userId: string): Promise<void> {
  await AsyncStorage.removeItem(`${KEY_PREFIX}${userId}`);
}