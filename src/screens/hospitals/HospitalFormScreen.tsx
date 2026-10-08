// src/screens/hospitals/HospitalFormScreen.tsx
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Check, Plus, Trash2 } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { useHospitals } from '../../contexts/HospitalsContext';
import { TextField } from '../../components/ui/TextField';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { Button } from '../../components/ui/Button';
import { ColorPickerModal } from '../../components/ui/ColorPickerModal';
import { colors, spacing, radius, fontSize, fontWeight, hospitalColorPalette } from '../../theme';

const hospitalFormSchema = z.object({
  name: z.string().min(2, 'Informe o nome do hospital'),
  color: z.string().min(1, 'Escolha uma cor'),
  defaultHourlyRate: z.string().optional(),
});

type HospitalFormData = z.infer<typeof hospitalFormSchema>;

type Props = NativeStackScreenProps<MainStackParamList, 'HospitalForm'>;

export function HospitalFormScreen({ navigation, route }: Props) {
  const existing = route.params?.hospital;
  const isEditing = !!existing;

  const { add, edit, remove } = useHospitals();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<HospitalFormData>({
    resolver: zodResolver(hospitalFormSchema),
    defaultValues: {
      name: existing?.name ?? '',
      color: existing?.color ?? hospitalColorPalette[0],
      defaultHourlyRate:
        existing?.default_hourly_rate != null ? String(Math.round(existing.default_hourly_rate * 100)) : '',
    },
  });

  const selectedColor = watch('color');

  async function onSubmit(data: HospitalFormData) {
    setIsSubmitting(true);
    try {
      const payload = {
        name: data.name.trim(),
        color: data.color,
        default_hourly_rate: data.defaultHourlyRate ? Number(data.defaultHourlyRate) / 100 : null,
      };

      if (isEditing && existing) {
        await edit(existing.id, payload);
      } else {
        await add(payload);
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Não foi possível salvar', (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDelete() {
    if (!existing) return;
    Alert.alert('Excluir hospital', 'Tem certeza que deseja excluir este hospital?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove(existing.id);
            navigation.goBack();
          } catch (error) {
            Alert.alert('Não foi possível excluir', (error as Error).message);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? 'Editar hospital' : 'Novo hospital'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label="Nome do hospital"
            placeholder="Nome do Lugar"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={errors.name?.message}
          />
        )}
      />

      <Text style={styles.label}>Cor de identificação</Text>
      <View style={styles.colorRow}>
        {hospitalColorPalette.map((color) => (
          <TouchableOpacity
            key={color}
            onPress={() => setValue('color', color, { shouldValidate: true })}
            style={[styles.colorSwatch, { backgroundColor: color }]}
          >
            {selectedColor === color && <Check size={18} color={colors.textInverse} />}
          </TouchableOpacity>
        ))}

        {!hospitalColorPalette.includes(selectedColor) && !!selectedColor && (
          <TouchableOpacity
            style={[styles.colorSwatch, { backgroundColor: selectedColor }]}
            onPress={() => setIsColorPickerOpen(true)}
          >
            <Check size={18} color={colors.textInverse} />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.addColorSwatch} onPress={() => setIsColorPickerOpen(true)}>
          <Plus size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
      {!!errors.color && <Text style={styles.error}>{errors.color.message}</Text>}

      <Controller
        control={control}
        name="defaultHourlyRate"
        render={({ field: { onChange, onBlur, value } }) => (
          <CurrencyField
            label="Valor hora padrão (opcional)"
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
          />
        )}
      />

      <Button label="Salvar" onPress={handleSubmit(onSubmit)} loading={isSubmitting} style={styles.saveButton} />

      {isEditing && (
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Trash2 size={18} color={colors.danger} />
          <Text style={styles.deleteText}>Excluir hospital</Text>
        </TouchableOpacity>
      )}

      <ColorPickerModal
        visible={isColorPickerOpen}
        initialColor={selectedColor || hospitalColorPalette[0]}
        onClose={() => setIsColorPickerOpen(false)}
        onConfirm={(hex) => {
          setValue('color', hex, { shouldValidate: true });
          setIsColorPickerOpen(false);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  container: { padding: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  label: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.sm },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xs },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addColorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  error: { fontSize: fontSize.xs, color: colors.danger, marginTop: spacing.xs, marginBottom: spacing.md },
  saveButton: { marginTop: spacing.lg },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  deleteText: { color: colors.danger, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
});