// src/lib/supabase.ts
//
// Esses dois imports precisam vir ANTES de qualquer outra coisa nesse arquivo:
// - react-native-get-random-values: dá ao Hermes um crypto.getRandomValues()
//   de verdade, que o aes-js precisa pra gerar a chave de criptografia.
// - react-native-url-polyfill/auto: o supabase-js usa a API URL internamente,
//   que não existe completa no runtime do React Native sem esse polyfill.
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no arquivo .env, na raiz do projeto.'
  );
}

/**
 * O expo-secure-store só guarda até ~2KB por chave — e uma sessão do
 * Supabase (access_token + refresh_token + dados do usuário) costuma
 * passar disso fácil. A solução: gerar uma chave AES-256 por sessão e
 * guardar SÓ a chave (pequena) no SecureStore, enquanto o conteúdo
 * criptografado de fato fica no AsyncStorage (sem limite de tamanho,
 * mas ilegível sem a chave que está no SecureStore).
 */
class EncryptedSessionStorage {
  private async encrypt(storageKey: string, plainText: string): Promise<string> {
    const aesKey = crypto.getRandomValues(new Uint8Array(32)); // 256 bits
    const cipher = new aesjs.ModeOfOperation.ctr(aesKey, new aesjs.Counter(1));
    const cipherBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(plainText));

    await SecureStore.setItemAsync(storageKey, aesjs.utils.hex.fromBytes(aesKey));

    return aesjs.utils.hex.fromBytes(cipherBytes);
  }

  private async decrypt(storageKey: string, cipherHex: string): Promise<string | null> {
    const aesKeyHex = await SecureStore.getItemAsync(storageKey);
    if (!aesKeyHex) return null;

    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(aesKeyHex),
      new aesjs.Counter(1)
    );
    const plainBytes = cipher.decrypt(aesjs.utils.hex.toBytes(cipherHex));

    return aesjs.utils.utf8.fromBytes(plainBytes);
  }

  async getItem(storageKey: string): Promise<string | null> {
    const cipherHex = await AsyncStorage.getItem(storageKey);
    if (!cipherHex) return null;
    return this.decrypt(storageKey, cipherHex);
  }

  async setItem(storageKey: string, plainText: string): Promise<void> {
    const cipherHex = await this.encrypt(storageKey, plainText);
    await AsyncStorage.setItem(storageKey, cipherHex);
  }

  async removeItem(storageKey: string): Promise<void> {
    await AsyncStorage.removeItem(storageKey);
    await SecureStore.deleteItemAsync(storageKey);
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new EncryptedSessionStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Liga/desliga o auto-refresh do token conforme o app entra/sai de segundo
// plano — evita chamadas de rede à toa e um "token travado" comum quando
// o app volta do background depois de muito tempo fechado.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});