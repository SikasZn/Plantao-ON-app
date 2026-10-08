// src/components/ui/SpecialtySelectField.tsx
//
// Visualmente é um TextField (mesmo label, borda, altura), mas em vez de
// abrir o teclado, toca abre o SpecialtyPickerModal. Fica consistente com o
// resto dos formulários (cadastro, perfil) sem precisar duplicar estilo.
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stethoscope, ChevronDown } from 'lucide-react-native';
import { colors, radius, spacing, fontSize } from '../../theme';
import { SpecialtyPickerModal } from './SpecialtyPickerModal';

interface SpecialtySelectFieldProps {
  label?: string;
  value: string;
  onChange: (specialty: string) => void;
  error?: string;
}

export function SpecialtySelectField({
  label = 'Especialização',
  value,
  onChange,
  error,
}: SpecialtySelectFieldProps) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.inputWrapper, !!error && styles.inputWrapperError]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <Stethoscope size={20} color={colors.textSecondary} />
        <Text style={[styles.value, !value && styles.placeholder]} numberOfLines={1}>
          {value || 'Selecione sua especialização'}
        </Text>
        <ChevronDown size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <SpecialtyPickerModal
        visible={modalVisible}
        initialValue={value}
        onClose={() => setModalVisible(false)}
        onConfirm={(specialty) => {
          onChange(specialty);
          setModalVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs },
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
  inputWrapperError: { borderColor: colors.danger },
  value: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary },
  placeholder: { color: colors.textSecondary },
  error: { fontSize: fontSize.xs, color: colors.danger, marginTop: spacing.xs },
});