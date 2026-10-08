// src/components/ui/Logo.tsx
//
// Marca do app: quadrado navy arredondado + "P" branco + a "chavinha" verde
// (toggle ligado) encaixada no miolo do P, remetendo ao "ON" de Plantão ON.
// Construída só com Views/Text + um toque de react-native-svg (sem imagem),
// então fica nítida em qualquer tamanho/resolução.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../../theme';

interface LogoProps {
  size?: number;
  // brilho suave por trás do badge — usado na Splash pra dar mais profundidade
  glow?: boolean;
}

export function Logo({ size = 96, glow = false }: LogoProps) {
  const cornerRadius = size * 0.24;
  const glowSize = size * 2.6;

  return (
    <View style={styles.wrapper}>
      {glow && (
        <Svg width={glowSize} height={glowSize} style={[styles.glow, { marginLeft: -glowSize / 2, marginTop: -glowSize / 2 }]}>
          <Defs>
            <RadialGradient id="logoGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.4} />
              <Stop offset="60%" stopColor={colors.primary} stopOpacity={0.12} />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={glowSize} height={glowSize} fill="url(#logoGlow)" />
        </Svg>
      )}

      <View style={[styles.shadowWrapper, { borderRadius: cornerRadius }]}>
        <View style={[styles.badge, { width: size, height: size, borderRadius: cornerRadius }]}>
          {/* brilho diagonal suave no topo — dá um acabamento "glass" no ícone */}
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="sheen" x1="0%" y1="0%" x2="55%" y2="100%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.18} />
                <Stop offset="50%" stopColor="#FFFFFF" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={size} height={size} fill="url(#sheen)" />
          </Svg>

          <Text style={[styles.letter, { fontSize: size * 0.64, lineHeight: size * 0.78 }]}>P</Text>

          <View
            style={[
              styles.toggle,
              {
                top: size * 0.245,
                left: size * 0.315,
                width: size * 0.34,
                height: size * 0.155,
                borderRadius: size * 0.08,
              },
            ]}
          >
            <View
              style={[
                styles.toggleKnob,
                { width: size * 0.115, height: size * 0.115, borderRadius: size * 0.06 },
              ]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  shadowWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  badge: {
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  letter: {
    color: colors.textInverse,
    fontWeight: '800',
  },
  toggle: {
    position: 'absolute',
    backgroundColor: colors.primary,
    justifyContent: 'center',
    paddingHorizontal: 2,
    alignItems: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
  toggleKnob: {
    backgroundColor: colors.textInverse,
  },
});