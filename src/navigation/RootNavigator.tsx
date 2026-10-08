// src/navigation/RootNavigator.tsx
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { HospitalsProvider } from '../contexts/HospitalsContext';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { SplashScreen } from '../screens/splash/SplashScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { CompleteProfileScreen } from '../screens/onboarding/CompleteProfileScreen';

// Tempo mínimo que a tela de carregamento fica visível, em ms. A checagem de
// sessão salva (SecureStore/AsyncStorage) costuma ser quase instantânea, e
// sem esse piso a splash apareceria só como um "pisca" — o pedido era pra
// ela aparecer de verdade toda vez que o app abre.
const MIN_SPLASH_DURATION = 2200;

export function RootNavigator() {
  const {
    session,
    isLoading,
    pendingOnboarding,
    completeOnboarding,
    pendingProfileCompletion,
  } = useAuth();
  const [minDurationElapsed, setMinDurationElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinDurationElapsed(true), MIN_SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading || !minDurationElapsed) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      {session ? (
        pendingProfileCompletion ? (
          // primeiro completa os dados básicos (nome/especialização) de quem
          // entrou via Google/Apple, só depois mostra o tour do onboarding
          <CompleteProfileScreen />
        ) : pendingOnboarding ? (
          <OnboardingScreen onFinish={completeOnboarding} />
        ) : (
          <HospitalsProvider>
            <MainNavigator />
          </HospitalsProvider>
        )
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}