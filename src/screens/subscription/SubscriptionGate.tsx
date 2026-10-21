// src/screens/subscription/SubscriptionGate.tsx
//
// Fica entre o login e o app: libera o app pra quem tem assinatura (ou teste
// grátis), mostra o paywall pra quem não tem, e uma tela de "tentar de novo"
// quando não dá pra checar a assinatura.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { Button } from '../../components/ui/Button';
import { SplashScreen } from '../splash/SplashScreen';
import { PaywallScreen } from './PaywallScreen';
import { colors, spacing, fontSize, fontWeight } from '../../theme';

export function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { status, refresh } = useSubscription();
  const { signOut } = useAuth();

  if (status === 'active') return <>{children}</>;
  if (status === 'loading') return <SplashScreen />;
  if (status === 'inactive') return <PaywallScreen />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Não foi possível verificar sua assinatura</Text>
      <Text style={styles.text}>Confira sua conexão com a internet e tente de novo.</Text>
      <Button label="Tentar de novo" onPress={refresh} style={styles.button} />
      <Button label="Sair da conta" variant="ghost" onPress={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, alignItems: 'stretch', justifyContent: 'center', padding: spacing.lg },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary, textAlign: 'center' },
  text: { fontSize: fontSize.base, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  button: { marginBottom: spacing.sm },
});
