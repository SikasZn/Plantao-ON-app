// src/components/ui/TextField.tsx
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View, Pressable } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, radius, spacing, fontSize } from '../../theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  icon?: React.ReactNode;
  isPassword?: boolean;
}

export function TextField({ label, error, icon, isPassword, multiline, ...inputProps }: TextFieldProps) {
  const [hidden, setHidden] = useState(!!isPassword);
  // editable={false} (ex.: campo de valor calculado automaticamente) ganha
  // um fundo diferente pra ficar visualmente claro que não aceita digitação
  const isDisabled = inputProps.editable === false;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          multiline && styles.inputWrapperMultiline,
          !!error && styles.inputWrapperError,
          isDisabled && styles.inputWrapperDisabled,
        ]}
      >
        {icon}
        <TextInput
          {...inputProps}
          multiline={multiline}
          secureTextEntry={hidden}
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, multiline && styles.inputMultiline]}
        />
        {isPassword && (
          <Pressable onPress={() => setHidden((prev) => !prev)} hitSlop={12}>
            {hidden ? (
              <EyeOff size={20} color={colors.textSecondary} />
            ) : (
              <Eye size={20} color={colors.textSecondary} />
            )}
          </Pressable>
        )}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  inputWrapperMultiline: {
    height: undefined,
    minHeight: 90,
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  inputWrapperError: {
    borderColor: colors.danger,
  },
  inputWrapperDisabled: {
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  inputMultiline: {
    height: '100%',
    textAlignVertical: 'top',
  },
  error: {
    fontSize: fontSize.xs,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});