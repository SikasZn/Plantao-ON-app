// src/screens/onboarding/CompleteProfileScreen.tsx
//
// Mostrada uma única vez, logo após a primeira sessão ativa de quem criou
// conta via Google/Apple (ver pendingProfileCompletion no AuthContext) — o
// login social pula o formulário de cadastro, então faltam dados básicos que
// o cadastro por e-mail já pede: nome confirmado, especialização, data de
// nascimento e sexo (os dois últimos opcionais, igual no cadastro por e-mail
// e na edição posterior em Perfil).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { getOwnProfile, updateOwnProfile } from '../../services/authService';
import { TextField } from '../../components/ui/TextField';
import { SpecialtySelectField } from '../../components/ui/SpecialtySelectField';
import { BirthDateAndSexFields } from '../../components/ui/BirthDateAndSexFields';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { toLocalDateKey } from '../../utils/date';
import { colors, spacing, fontSize, fontWeight } from '../../theme';

const schema = z.object({
  fullName: z.string().min(2, 'Informe seu nome completo'),
  specialty: z.string().min(2, 'Selecione sua especialização'),
  // Nenhum dos dois é obrigatório aqui — dá pra preencher depois no Perfil
  birthDate: z
    .date()
    .nullable()
    .refine((d) => !d || d.getTime() <= Date.now(), 'A data de nascimento não pode ser no futuro'),
  sex: z.enum(['male', 'female', 'unspecified']).nullable(),
});

type FormData = z.infer<typeof schema>;

export function CompleteProfileScreen() {
  const { user, completeProfileCompletion } = useAuth();
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', specialty: '', birthDate: null, sex: null },
  });

  const birthDate = watch('birthDate');
  const sex = watch('sex');

  useEffect(() => {
    if (!user) return;
    // pré-preenche com o que já existir na linha de profiles — cobre tanto o
    // nome que a Apple manda na primeira autorização quanto qualquer coisa
    // que o próprio trigger de criação de conta já tenha gravado
    getOwnProfile(user.id)
      .then((profile) => {
        if (profile.fullName) setValue('fullName', profile.fullName);
        if (profile.specialty) setValue('specialty', profile.specialty);
        if (profile.birthDate) setValue('birthDate', new Date(`${profile.birthDate}T00:00:00`));
        if (profile.sex) setValue('sex', profile.sex);
      })
      .catch(() => {
        // sem problema — a pessoa só preenche do zero
      })
      .finally(() => setIsLoadingProfile(false));
  }, [user, setValue]);

  async function onSubmit(data: FormData) {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await updateOwnProfile(user.id, {
        fullName: data.fullName,
        specialty: data.specialty,
        birthDate: data.birthDate ? toLocalDateKey(data.birthDate) : null,
        sex: data.sex,
      });
      await completeProfileCompletion();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrapper}>
          <Logo size={72} />
        </View>
        <Text style={styles.title}>Só mais um passo</Text>
        <Text style={styles.subtitle}>Confirme seus dados básicos pra gente personalizar sua conta.</Text>

        {isLoadingProfile ? (
          <ActivityIndicator style={styles.loading} color={colors.primary} />
        ) : (
          <View style={styles.form}>
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Nome completo"
                  placeholder="José Milton"
                  icon={<User size={20} color={colors.textSecondary} />}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  error={errors.fullName?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="specialty"
              render={({ field: { onChange, value } }) => (
                <SpecialtySelectField value={value} onChange={onChange} error={errors.specialty?.message} />
              )}
            />

            <BirthDateAndSexFields
              birthDate={birthDate}
              onBirthDateChange={(date) => setValue('birthDate', date, { shouldValidate: true })}
              birthDateError={errors.birthDate?.message}
              sex={sex}
              onSexChange={(newSex) => setValue('sex', newSex)}
            />

            <Button label="Concluir cadastro" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  container: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  logoWrapper: { alignItems: 'center', marginBottom: spacing.lg },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textPrimary, textAlign: 'center' },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  form: { marginTop: spacing.md },
  loading: { marginTop: spacing.xl },
});