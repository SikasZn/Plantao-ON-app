// src/screens/splash/SplashScreen.tsx
//
// Tela de carregamento de marca — aparece toda vez que o app é aberto,
// enquanto o RootNavigator checa se já existe uma sessão salva. Ver o
// controle do tempo mínimo de exibição em RootNavigator.tsx.
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Logo } from '../../components/ui/Logo';
import { colors, spacing, fontSize, fontWeight } from '../../theme';

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* manchas suaves de fundo — só profundidade, nada chamativo */}
      <View style={[styles.blob, styles.blobTopRight]} />
      <View style={[styles.blob, styles.blobBottomLeft]} />

      <View style={styles.center}>
        <Logo size={112} glow />
        <Text style={styles.title}>Plantão ON</Text>
        <Text style={styles.subtitle}>Escala de Plantões & Ganhos</Text>
      </View>

      <View style={styles.bottom}>
        <View style={styles.divider} />
        <Text style={styles.tagline}>Mais que escalas.</Text>
        <Text style={styles.tagline}>Mais liberdade.</Text>
        <ActivityIndicator color="rgba(255,255,255,0.55)" style={styles.spinner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    justifyContent: 'space-between',
    paddingVertical: spacing.xxl * 1.4,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 9999,
  },
  blobTopRight: {
    width: 260,
    height: 260,
    top: -90,
    right: -70,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
  },
  blobBottomLeft: {
    width: 220,
    height: 220,
    bottom: -80,
    left: -60,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: spacing.lg,
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  bottom: {
    alignItems: 'center',
  },
  divider: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  tagline: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  spinner: {
    marginTop: spacing.lg,
  },
});