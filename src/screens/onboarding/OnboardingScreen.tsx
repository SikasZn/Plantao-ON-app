// src/screens/onboarding/OnboardingScreen.tsx
//
// Mostrada uma única vez, na primeira sessão ativa de um usuário recém
// cadastrado (ver src/utils/onboarding.ts e o AuthContext). Tanto "Pular"
// quanto "Começar agora" chamam onFinish, que apaga a flag pendente e libera
// o RootNavigator pra seguir direto pro app.
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, DollarSign, Building2, BarChart3, Cloud } from 'lucide-react-native';
import { Button } from '../../components/ui/Button';
import { colors, spacing, fontSize, fontWeight } from '../../theme';

interface OnboardingScreenProps {
  onFinish: () => void | Promise<void>;
}

const FEATURES = [
  {
    icon: Calendar,
    color: colors.primaryDark,
    title: 'Sua escala sempre à mão',
    description: 'Visualize seus plantões de forma simples e intuitiva.',
  },
  {
    icon: DollarSign,
    color: colors.success,
    title: 'Controle seus ganhos',
    description: 'Saiba quanto já faturou e o que ainda vai receber.',
  },
  {
    icon: Building2,
    color: colors.primaryDark,
    title: 'Hospitais por cores',
    description: 'Identifique seus locais de trabalho com facilidade.',
  },
  {
    icon: BarChart3,
    color: colors.primaryDark,
    title: 'Relatórios completos',
    description: 'Exporte seus dados para sua contabilidade.',
  },
  {
    icon: Cloud,
    color: colors.primaryDark,
    title: 'Seus dados sempre seguros',
    description: 'Backup na nuvem e sincronização entre dispositivos.',
  },
];

export function OnboardingScreen({ onFinish }: OnboardingScreenProps) {
  const [isFinishing, setIsFinishing] = useState(false);

  async function handleFinish() {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      await onFinish();
    } finally {
      setIsFinishing(false);
    }
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleFinish} hitSlop={12} disabled={isFinishing}>
          <Text style={styles.skipText}>Pular</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Organize seus plantões,{'\n'}conquiste seus objetivos.</Text>

        <View style={styles.featureList}>
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <View key={feature.title} style={styles.featureRow}>
                <Icon size={26} color={feature.color} strokeWidth={2.2} />
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
        </View>

        <Button label="Começar agora" onPress={handleFinish} loading={isFinishing} style={styles.startButton} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  skipText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.semibold },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: fontSize.xxl * 1.3,
    marginBottom: spacing.xl,
  },
  featureList: { gap: spacing.lg },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  featureText: { flex: 1 },
  featureTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  featureDescription: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: fontSize.sm * 1.4,
  },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: spacing.lg },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { width: 20, backgroundColor: colors.primary },
  // navy pra bater com o mockup — os outros CTAs "confirmar" do app usam
  // verde, mas este segue o design de referência à risca
  startButton: { marginBottom: 0, backgroundColor: colors.primaryDark },
});