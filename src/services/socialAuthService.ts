// src/services/socialAuthService.ts
//
// Fala diretamente com os SDKs nativos do Google e da Apple. Cada função
// devolve só o que o authService precisa pra trocar com o Supabase
// (idToken + nonce quando aplicável) — a UI (LoginScreen) só chama essas
// funções e trata erro/cancelamento, sem conhecer os detalhes de cada SDK.
//
// Os dois SDKs são módulos nativos de verdade: só funcionam num development
// build (ou build de produção), nunca no Expo Go.
import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { generateUUID } from '../utils/uuid';

let googleConfigured = false;

export function configureGoogleSignIn() {
  if (googleConfigured) return;

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    // Não derruba o app — só avisa no console. Se o botão for tocado sem essa
    // variável configurada, o erro abaixo (em googleSignIn) fica bem claro.
    console.warn(
      'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID não está definido no .env — o login com Google vai falhar.'
    );
    return;
  }

  GoogleSignin.configure({ webClientId });
  googleConfigured = true;
}

/** Resultado do login com Google, ou null se o usuário cancelou o seletor de conta. */
export async function googleSignIn(): Promise<{ idToken: string } | null> {
  configureGoogleSignIn();

  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      // usuário fechou o seletor de conta — não é um erro de verdade
      return null;
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      throw new Error('O Google não retornou um token válido. Tente novamente.');
    }
    return { idToken };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
      return null;
    }
    throw error;
  }
}

interface AppleSignInResult {
  idToken: string;
  // "cru" (não tratado) — é ele que vai pro Supabase; a Apple recebe a versão em hash
  rawNonce: string;
  fullName: { givenName?: string | null; familyName?: string | null } | null;
}

/**
 * Resultado do login com Apple, ou null se o usuário cancelou.
 * O nome completo só vem preenchido na PRIMEIRA vez que a pessoa autoriza o
 * app — em logins seguintes a Apple manda esses campos vazios de propósito.
 */
export async function appleSignIn(): Promise<AppleSignInResult | null> {
  if (Platform.OS !== 'ios') {
    // o botão só é exibido no iOS (ver isAppleSignInAvailable) — isso aqui é
    // só uma proteção extra caso a função seja chamada de outro lugar
    throw new Error('Login com Apple só está disponível no iOS.');
  }

  const rawNonce = generateUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      throw new Error('A Apple não retornou um token válido. Tente novamente.');
    }

    return {
      idToken: credential.identityToken,
      rawNonce,
      fullName: credential.fullName,
    };
  } catch (error) {
    if (isAppleCancelError(error)) {
      return null;
    }
    throw error;
  }
}

function isAppleCancelError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ERR_REQUEST_CANCELED'
  );
}

/** Usado pra decidir se o botão da Apple deve aparecer na tela. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}