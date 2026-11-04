// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  getCurrentSession,
  isBrandNewUser,
  signInWithEmail,
  signInWithIdToken,
  signOut as signOutService,
  deleteOwnAccount,
  signUpWithEmail,
  sendPasswordResetEmail,
  subscribeToAuthChanges,
  updateOwnProfile,
} from '../services/authService';
import { appleSignIn, googleSignIn } from '../services/socialAuthService';
import { clearOnboardingPending, hasOnboardingPending, markOnboardingPending } from '../utils/onboarding';
import {
  clearProfileCompletionPending,
  hasProfileCompletionPending,
  markProfileCompletionPending,
} from '../utils/profileCompletion';
import type { ProfileSex } from '../types/domain';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  // true só na primeira sessão ativa de um usuário que acabou de se
  // cadastrar — cobre tanto o caso de a sessão nascer na hora do signUp
  // quanto o de precisar confirmar o e-mail antes de logar de fato
  pendingOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
  // true só pra quem entrou pela primeira vez via Google/Apple — esses
  // fluxos pulam o formulário de cadastro, então faltam dados básicos
  // (nome confirmado, especialização) que o cadastro por e-mail já pede
  pendingProfileCompletion: boolean;
  completeProfileCompletion: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    specialty: string,
    birthDate: string | null,
    sex: ProfileSex | null
  ) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  // exclui a conta e os dados no servidor e encerra a sessão
  deleteAccount: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingOnboarding, setPendingOnboarding] = useState(false);
  const [pendingProfileCompletion, setPendingProfileCompletion] = useState(false);

  useEffect(() => {
    getCurrentSession()
      .then(async (initialSession) => {
        setSession(initialSession);
        if (initialSession?.user) {
          setPendingOnboarding(await hasOnboardingPending(initialSession.user.id));
          setPendingProfileCompletion(await hasProfileCompletionPending(initialSession.user.id));
        }
      })
      .finally(() => setIsLoading(false));

    const unsubscribe = subscribeToAuthChanges((newSession) => {
      setSession(newSession);
      setIsLoading(false);
      if (newSession?.user) {
        hasOnboardingPending(newSession.user.id).then(setPendingOnboarding);
        hasProfileCompletionPending(newSession.user.id).then(setPendingProfileCompletion);
      } else {
        setPendingOnboarding(false);
        setPendingProfileCompletion(false);
      }
    });

    return unsubscribe;
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    isLoading,
    pendingOnboarding,
    completeOnboarding: async () => {
      if (session?.user) {
        await clearOnboardingPending(session.user.id);
      }
      setPendingOnboarding(false);
    },
    pendingProfileCompletion,
    completeProfileCompletion: async () => {
      if (session?.user) {
        await clearProfileCompletionPending(session.user.id);
      }
      setPendingProfileCompletion(false);
    },
    signIn: async (email, password) => {
      await signInWithEmail(email, password);
    },
    signUp: async (email, password, fullName, specialty, birthDate, sex) => {
      // full_name, specialty, birth_date e sex vão direto no metadata do
      // signUp — é o trigger do banco que grava o profile (ver
      // signUpWithEmail), então funciona mesmo sem sessão ativa ainda
      // (confirmação de e-mail pendente)
      const data = await signUpWithEmail(email, password, fullName, specialty, birthDate, sex);
      // marca a flag já aqui, usando o id retornado pelo próprio cadastro —
      // ela só vai virar "pendingOnboarding" quando essa conta tiver uma
      // sessão ativa de verdade (imediata ou só depois de confirmar o e-mail)
      if (data.user) {
        await markOnboardingPending(data.user.id);
      }
    },
    signInWithGoogle: async () => {
      const result = await googleSignIn();
      if (!result) return; // usuário cancelou o seletor de conta

      const data = await signInWithIdToken('google', result.idToken);
      if (data.user && isBrandNewUser(data.user)) {
        await markOnboardingPending(data.user.id);
        await markProfileCompletionPending(data.user.id);
        setPendingOnboarding(true);
        setPendingProfileCompletion(true);
      }
    },
    signInWithApple: async () => {
      const result = await appleSignIn();
      if (!result) return; // usuário cancelou

      const data = await signInWithIdToken('apple', result.idToken, result.rawNonce);
      if (!data.user) return;

      // a Apple só manda o nome na primeira autorização — se veio, gravamos
      // no profile na mão, porque não existe outro jeito de recuperar depois;
      // mesmo assim a pessoa passa pela tela de completar perfil, pra
      // confirmar o nome e informar a especialização (que a Apple não manda)
      const givenName = result.fullName?.givenName ?? '';
      const familyName = result.fullName?.familyName ?? '';
      const fullName = `${givenName} ${familyName}`.trim();
      if (fullName) {
        // tenta de novo uma vez: logo após criar a conta, a linha do profile
        // (criada por trigger no banco) pode demorar um instante a existir
        const userId = data.user.id;
        await updateOwnProfile(userId, { fullName }).catch(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1200));
          await updateOwnProfile(userId, { fullName }).catch(() => {
            // não trava o login por causa disso — o nome pode ser editado
            // depois em Perfil
          });
        });
      }

      if (isBrandNewUser(data.user)) {
        await markOnboardingPending(data.user.id);
        await markProfileCompletionPending(data.user.id);
        setPendingOnboarding(true);
        setPendingProfileCompletion(true);
      }
    },
    signOut: async () => {
      await signOutService();
    },
    deleteAccount: async () => {
      await deleteOwnAccount();
    },
    resetPassword: async (email) => {
      await sendPasswordResetEmail(email);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth precisa ser usado dentro de um <AuthProvider>.');
  }
  return context;
}