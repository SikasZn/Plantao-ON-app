// src/navigation/RootNavigator.tsx
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { HospitalsProvider } from '../contexts/HospitalsContext';
import { ShiftsProvider } from '../contexts/ShiftsContext';
import { ExpensesProvider } from '../contexts/ExpensesContext';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { SplashScreen } from '../screens/splash/SplashScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { CompleteProfileScreen } from '../screens/onboarding/CompleteProfileScreen';
import { SubscriptionGate } from '../screens/subscription/SubscriptionGate';

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
          // o app só abre pra quem tem assinatura (ou teste grátis); sem
          // chave do RevenueCat o gate libera tudo
          <SubscriptionGate>
            <HospitalsProvider>
              <ShiftsProvider>
                <ExpensesProvider>
                  <MainNavigator />
                </ExpensesProvider>
              </ShiftsProvider>
            </HospitalsProvider>
          </SubscriptionGate>
        )
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
}