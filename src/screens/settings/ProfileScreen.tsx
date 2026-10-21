// src/screens/settings/ProfileScreen.tsx
//
// Tela de perfil da conta, acessada pelo menu "Mais" (os 3 pontinhos).
// Mostra e permite editar o nome completo, a especialização, a data de
// nascimento e o sexo gravados em profiles — os mesmos dados pedidos no
// cadastro (ou na tela de completar perfil, pra quem entrou via Google/Apple).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Trash2, User } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { getOwnProfile, updateOwnProfile } from '../../services/authService';
import { getInitials } from '../../utils/initials';
import { toLocalDateKey } from '../../utils/date';
import { TextField } from '../../components/ui/TextField';
import { SpecialtySelectField } from '../../components/ui/SpecialtySelectField';
import { AvatarPicker } from '../../components/ui/AvatarPicker';
import { BirthDateAndSexFields } from '../../components/ui/BirthDateAndSexFields';
import { Button } from '../../components/ui/Button';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';

const schema = z.object({
  fullName: z.string().min(2, 'Informe seu nome completo'),
  specialty: z.string().min(2, 'Selecione sua especialização'),
  // Nenhum dos dois é obrigatório — quem já tinha conta antes do item 17 do
  // documento fica com os dois em branco até preencher aqui.
  birthDate: z
    .date()
    .nullable()
    .refine((d) => !d || d.getTime() <= Date.now(), 'A data de nascimento não pode ser no futuro'),
  sex: z.enum(['male', 'female', 'unspecified']).nullable(),
});

type FormData = z.infer<typeof schema>;

type Props = NativeStackScreenProps<MainStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const { user, deleteAccount } = useAuth();
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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

  const fullName = watch('fullName');
  const birthDate = watch('birthDate');
  const sex = watch('sex');

  useEffect(() => {
    if (!user) return;
    getOwnProfile(user.id)
      .then((profile) => {
        setValue('fullName', profile.fullName);
        setValue('specialty', profile.specialty);
        setValue('birthDate', profile.birthDate ? new Date(`${profile.birthDate}T00:00:00`) : null);
        setValue('sex', profile.sex);
        setAvatarUrl(profile.avatarUrl);
      })
      .finally(() => setIsLoadingProfile(false));
  }, [user, setValue]);

  async function handleAvatarChange(url: string) {
    if (!user) return;
    setAvatarUrl(url);
    try {
      await updateOwnProfile(user.id, { avatarUrl: url });
    } catch (error) {
      Alert.alert('Não foi possível salvar a foto', (error as Error).message);
    }
  }

  async function onSubmit(data: FormData) {
    if (!user) return;
    setIsSaving(true);
    try {
      await updateOwnProfile(user.id, {
        fullName: data.fullName,
        specialty: data.specialty,
        birthDate: data.birthDate ? toLocalDateKey(data.birthDate) : null,
        sex: data.sex,
      });
      Alert.alert('Perfil atualizado', 'Suas informações foram salvas.');
    } catch (error) {
      Alert.alert('Não foi possível salvar', (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Excluir conta',
      'Sua conta e todos os seus dados (perfil, locais de trabalho, plantões e relatórios) serão apagados de forma definitiva. Essa ação não pode ser desfeita.\n\nSe você tem uma assinatura, ela NÃO é cancelada automaticamente: cancele antes na App Store ou no Google Play.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Tem certeza?', 'Todos os seus dados serão apagados agora e não poderão ser recuperados.', [
              { text: 'Voltar', style: 'cancel' },
              { text: 'Excluir definitivamente', style: 'destructive', onPress: handleDeleteAccount },
            ]),
        },
      ]
    );
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      // depois de apagar, a sessão some e o RootNavigator volta sozinho
      // para a tela de login
      await deleteAccount();
    } catch (error) {
      setIsDeleting(false);
      Alert.alert('Não foi possível excluir a conta', (error as Error).message);
    }
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Perfil</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoadingProfile ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <View style={styles.avatarWrapper}>
              {user && (
                <AvatarPicker
                  userId={user.id}
                  value={avatarUrl}
                  fallbackText={getInitials(fullName)}
                  onChange={handleAvatarChange}
                />
              )}
            </View>

            <View style={styles.emailRow}>
              <Text style={styles.emailLabel}>E-mail</Text>
              <Text style={styles.emailValue}>{user?.email}</Text>
            </View>

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

            <Button label="Salvar alterações" onPress={handleSubmit(onSubmit)} loading={isSaving} />

            <TouchableOpacity
              style={styles.deleteButton}
              onPress={confirmDeleteAccount}
              disabled={isDeleting}
              accessibilityRole="button"
            >
              {isDeleting ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <>
                  <Trash2 size={18} color={colors.danger} />
                  <Text style={styles.deleteText}>Excluir conta</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  headerSpacer: { width: 24 },
  loading: { marginTop: spacing.xl },
  container: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.sm },
  avatarWrapper: { alignItems: 'center', marginBottom: spacing.xl },
  emailRow: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteText: { color: colors.danger, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  emailLabel: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: 2 },
  emailValue: { fontSize: fontSize.base, color: colors.textPrimary, fontWeight: fontWeight.medium },
});
