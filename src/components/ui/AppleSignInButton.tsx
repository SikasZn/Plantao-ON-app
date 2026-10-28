// src/components/ui/AppleSignInButton.tsx
//
// Botão "Continuar com a Apple" no mesmo padrão visual do botão do Google
// (mesma altura, borda, raio e fonte), em vez do botão nativo da Apple, cuja
// fonte cresce junto com a altura e ficava maior que a do Google. Segue as
// diretrizes da Apple para botões próprios: logo oficial, fundo branco com
// contorno e texto "Continuar com a Apple".
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius, spacing, fontSize, fontWeight } from '../../theme';

interface AppleSignInButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label?: string;
  style?: ViewStyle;
}

function AppleGlyph({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#000000"
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </Svg>
  );
}

export function AppleSignInButton({
  onPress,
  loading = false,
  disabled = false,
  label = 'Continuar com a Apple',
  style,
}: AppleSignInButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.textPrimary} />
      ) : (
        <>
          <AppleGlyph size={20} />
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
  },
  pressed: { opacity: 0.85, backgroundColor: colors.background },
  disabled: { opacity: 0.5 },
  label: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
});
