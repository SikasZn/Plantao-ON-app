// src/screens/auth/SignUpScreen.tsx
import React, { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Mail, Lock, User } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { TextField } from '../../components/ui/TextField';
import { SpecialtySelectField } from '../../components/ui/SpecialtySelectField';
import { BirthDateAndSexFields } from '../../components/ui/BirthDateAndSexFields';
import { Button } from '../../components/ui/Button';
import { isAdult, MIN_AGE, toLocalDateKey } from '../../utils/date';
import { colors, spacing, fontSize, fontWeight } from '../../theme';

const signUpSchema = z
  .object({
    fullName: z.string().min(2, 'Informe seu nome completo'),
    specialty: z.string().min(2, 'Selecione sua especialização'),
    email: z.string().min(1, 'Informe seu e-mail').email('E-mail inválido'),
    password: z.string().min(6, 'Mínimo de 6 caracteres'),
    confirmPassword: z.string(),
    // Obrigatórios: a data de nascimento e o sexo precisam ser informados
    birthDate: z
      .date()
      .nullable()
      .refine((d): boolean => d !== null, 'Informe sua data de nascimento')
      .refine((d): boolean => d === null || d.getTime() <= Date.now(), 'A data de nascimento não pode ser no futuro')
      .refine((d): boolean => d === null || d.getTime() > Date.now() || isAdult(d), `É necessário ter ${MIN_AGE} anos ou mais`),
    sex: z
      .enum(['male', 'female', 'unspecified'])
      .nullable()
      .refine((v): boolean => v !== null, 'Selecione uma opção'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type SignUpFormData = z.infer<typeof signUpSchema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export function SignUpScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      specialty: '',
      email: '',
      password: '',
      confirmPassword: '',
      birthDate: null,
      sex: null,
    },
  });

  const birthDate = watch('birthDate');
  const sex = watch('sex');

  async function onSubmit(data: SignUpFormData) {
    setIsSubmitting(true);
    try {
      await signUp(
        data.email,
        data.password,
        data.fullName,
        data.specialty,
        data.birthDate ? toLocalDateKey(data.birthDate) : null,
        data.sex
      );
      Alert.alert('Quase lá!', 'Enviamos um e-mail de confirmação — confirme para poder entrar no app.');
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Não foi possível cadastrar', (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? undefined : 'padding'}>
      <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={[styles.container, { paddingBottom: spacing.lg + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={styles.title}>Criar conta</Text>
        <Text style={styles.subtitle}>Leva menos de um minuto</Text>

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
            onSexChange={(newSex) => setValue('sex', newSex, { shouldValidate: true })}
            sexError={errors.sex?.message}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="E-mail"
                placeholder="seu@email.com"
                autoCapitalize="none"
                keyboardType="email-address"
                icon={<Mail size={20} color={colors.textSecondary} />}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.email?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Senha"
                placeholder="••••••••"
                isPassword
                icon={<Lock size={20} color={colors.textSecondary} />}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.password?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Confirmar senha"
                placeholder="••••••••"
                isPassword
                icon={<Lock size={20} color={colors.textSecondary} />}
                onBlur={onBlur}
                onChangeText={onChange}
                value={value}
                error={errors.confirmPassword?.message}
              />
            )}
          />

          <Button label="Cadastrar" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  container: { flexGrow: 1, padding: spacing.lg },
  backButton: { marginTop: spacing.md, marginBottom: spacing.lg },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xl },
  form: { marginTop: spacing.md },
});