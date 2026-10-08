// src/components/ui/BirthDateAndSexFields.tsx
//
// Campos de data de nascimento e sexo, reaproveitados nos 3 lugares que
// pedem esses dados (item 17 do documento, estendido): cadastro por e-mail
// (SignUpScreen), completar perfil no primeiro login via Google/Apple
// (CompleteProfileScreen) e edição posterior (ProfileScreen). Os dois campos
// são opcionais em todo lugar — 'unspecified' é uma escolha explícita de
// "prefiro não informar", diferente de deixar em branco (null).
//
// O seletor de data no iOS usa Modal (não um container posicionado como
// "irmão" da tela, como no resto do app) de propósito: esse componente é
// montado dentro do ScrollView do formulário de cada tela que o usa, então
// `position: absolute` aqui ficaria preso ao scroll em vez de fixo na tela.
import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate, calculateAge, toLocalDateKey } from '../../utils/date';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';
import type { ProfileSex } from '../../types/domain';

const SEX_OPTIONS: { value: ProfileSex; label: string }[] = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Feminino' },
  { value: 'unspecified', label: 'Prefiro não informar' },
];

interface BirthDateAndSexFieldsProps {
  birthDate: Date | null;
  onBirthDateChange: (date: Date) => void;
  birthDateError?: string;
  sex: ProfileSex | null;
  onSexChange: (sex: ProfileSex | null) => void;
}

export function BirthDateAndSexFields({
  birthDate,
  onBirthDateChange,
  birthDateError,
  sex,
  onSexChange,
}: BirthDateAndSexFieldsProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const picker = (
    <DateTimePicker
      value={birthDate ?? new Date(1990, 0, 1)}
      mode="date"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      maximumDate={new Date()}
      onValueChange={(_event, selected) => {
        if (Platform.OS !== 'ios') setIsPickerOpen(false);
        if (selected) onBirthDateChange(selected);
      }}
      onDismiss={() => setIsPickerOpen(false)}
    />
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Data de nascimento (opcional)</Text>
      <Pressable style={styles.selectField} onPress={() => setIsPickerOpen(true)}>
        <Text style={birthDate ? styles.selectFieldText : styles.selectPlaceholder}>
          {birthDate ? formatDate(birthDate.toISOString()) : 'Selecionar data'}
        </Text>
        {birthDate && <Text style={styles.ageHint}>{calculateAge(toLocalDateKey(birthDate))} anos</Text>}
      </Pressable>
      {!!birthDateError && <Text style={styles.error}>{birthDateError}</Text>}

      <Text style={styles.label}>Sexo (opcional)</Text>
      <View style={styles.sexRow}>
        {SEX_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.sexChip, sex === option.value && styles.sexChipActive]}
            onPress={() => onSexChange(sex === option.value ? null : option.value)}
          >
            <Text style={[styles.sexChipText, sex === option.value && styles.sexChipTextActive]}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {Platform.OS === 'ios' ? (
        <Modal visible={isPickerOpen} transparent animationType="slide" onRequestClose={() => setIsPickerOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setIsPickerOpen(false)}>
            {/* Pressable sem onPress aqui dentro só pra "absorver" o toque — sem
                isso, tocar em qualquer área vazia da folha (fora dos filhos
                tocáveis) fecharia o modal junto, por estar dentro da área do
                Pressable de fundo */}
            <Pressable style={styles.pickerSheet}>
              <View style={styles.pickerDoneRow}>
                <TouchableOpacity onPress={() => setIsPickerOpen(false)}>
                  <Text style={styles.pickerDoneText}>Concluído</Text>
                </TouchableOpacity>
              </View>
              {picker}
            </Pressable>
          </Pressable>
        </Modal>
      ) : (
        isPickerOpen && picker
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  selectFieldText: { fontSize: fontSize.base, color: colors.textPrimary },
  selectPlaceholder: { fontSize: fontSize.base, color: colors.textSecondary },
  ageHint: { fontSize: fontSize.sm, color: colors.textSecondary },
  error: { fontSize: fontSize.xs, color: colors.danger, marginTop: -spacing.sm, marginBottom: spacing.md },
  sexRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sexChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sexChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sexChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  sexChipTextActive: { color: colors.textInverse },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  pickerDoneRow: { alignItems: 'flex-end', padding: spacing.sm },
  pickerDoneText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.base },
});