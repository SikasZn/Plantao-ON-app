// src/screens/auth/LoginScreen.tsx
import React, { useEffect, useState } from 'react';
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
import { Mail, Lock } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { isAppleSignInAvailable } from '../../services/socialAuthService';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { GoogleSignInButton } from '../../components/ui/GoogleSignInButton';
import { AppleSignInButton } from '../../components/ui/AppleSignInButton';
import { colors, spacing, fontSize, fontWeight } from '../../theme';

const loginSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail').email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    // a Apple exige que o botão só apareça onde o recurso realmente funciona
    // (nunca no Android) — por isso a checagem em vez de só olhar Platform.OS
    isAppleSignInAvailable().then(setIsAppleAvailable);
  }, []);

  async function onSubmit(data: LoginFormData) {
    setIsSubmitting(true);
    try {
      await signIn(data.email, data.password);
      // a navegação acontece sozinha: o RootNavigator troca de stack assim
      // que o AuthContext detecta a sessão via onAuthStateChange
    } catch (error) {
      Alert.alert('Não foi possível entrar', (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      Alert.alert('Não foi possível entrar com o Google', (error as Error).message);
    } finally {
      setIsGoogleLoading(false);
    }
  }

  async function handleAppleSignIn() {
    setIsAppleLoading(true);
    try {
      await signInWithApple();
    } catch (error) {
      Alert.alert('Não foi possível entrar com a Apple', (error as Error).message);
    } finally {
      setIsAppleLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? undefined : 'padding'}>
      <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={[styles.container, { paddingBottom: spacing.lg + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={styles.logoWrapper}>
          <Logo size={88} />
        </View>
        <Text style={styles.title}>Plantão ON</Text>
        <Text style={styles.subtitle}>Escala de Plantões & Ganhos</Text>

        <View style={styles.form}>
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

          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotLink}>
            <Text style={styles.linkText}>Esqueci minha senha</Text>
          </TouchableOpacity>

          <Button label="Entrar" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          <GoogleSignInButton
            onPress={handleGoogleSignIn}
            loading={isGoogleLoading}
            style={styles.googleButton}
          />

          {isAppleAvailable && <AppleSignInButton onPress={handleAppleSignIn} loading={isAppleLoading} />}

          <View style={styles.signUpRow}>
            <Text style={styles.footerText}>Ainda não tem conta? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
              <Text style={styles.linkText}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  container: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center' },
  logoWrapper: { alignItems: 'center', marginBottom: spacing.lg },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  form: { marginTop: spacing.lg },
  forgotLink: { alignSelf: 'flex-end', marginBottom: spacing.lg },
  linkText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg, gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textSecondary, fontSize: fontSize.xs },
  googleButton: { width: '100%', marginBottom: spacing.sm },
  footerText: { fontSize: fontSize.sm, color: colors.textSecondary },
  signUpRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
});