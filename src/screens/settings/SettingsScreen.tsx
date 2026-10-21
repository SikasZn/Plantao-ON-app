// src/screens/settings/SettingsScreen.tsx
import React, { useCallback, useState } from 'react';
import { Alert, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, type CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BarChart3, Bell, Calendar, ChevronRight, CreditCard, Database, LogOut, UserCircle } from 'lucide-react-native';
import type { MainTabParamList, MainStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { getOwnProfile, type OwnProfile } from '../../services/authService';
import { getInitials } from '../../utils/initials';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Settings'>,
  NativeStackScreenProps<MainStackParamList>
>;

export function SettingsScreen({ navigation }: Props) {
  const { signOut, user } = useAuth();
  const { enabled: subscriptionsEnabled } = useSubscription();
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  // true até a primeira resposta do perfil (sucesso ou falha). Enquanto isso
  // não mostramos o e-mail da conta Google no lugar do nome — ele só entra
  // como último recurso, se o perfil realmente não puder ser carregado.
  const [profileLoaded, setProfileLoaded] = useState(false);

  // useEffect (só no mount) não bastava aqui: essa tela fica montada por
  // baixo das abas o tempo todo, então voltar da tela de Perfil depois de
  // trocar a foto não disparava um novo fetch — o avatar antigo continuava
  // em memória. useFocusEffect busca de novo toda vez que a aba "Mais" volta
  // a ficar em foco, o que cobre exatamente esse caso.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getOwnProfile(user.id)
        .then(setProfile)
        .catch(() => {})
        .finally(() => setProfileLoaded(true));
    }, [user])
  );

  function handleSignOut() {
    Alert.alert('Sair', 'Deseja realmente sair da sua conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Mais</Text>

      <View style={styles.profileHeader}>
        <View style={styles.avatar}>
          {profile?.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>
              {profileLoaded ? getInitials(profile?.fullName || user?.email || '') : ''}
            </Text>
          )}
        </View>
        {profileLoaded ? (
          <Text style={styles.profileName}>{profile?.fullName || user?.email}</Text>
        ) : (
          <View style={styles.nameSkeleton} />
        )}
        {!!profile?.specialty && <Text style={styles.profileSpecialty}>{profile.specialty}</Text>}
      </View>

      <MenuRow
        icon={<UserCircle size={20} color={colors.textPrimary} />}
        label="Perfil"
        onPress={() => navigation.navigate('Profile')}
      />
      <MenuRow
        icon={<BarChart3 size={20} color={colors.textPrimary} />}
        label="Relatórios"
        onPress={() => navigation.navigate('Reports')}
      />
      <MenuRow
        icon={<Bell size={20} color={colors.textPrimary} />}
        label="Notificações"
        onPress={() => Linking.openSettings()}
      />
      <MenuRow
        icon={<Calendar size={20} color={colors.textPrimary} />}
        label="Google Agenda"
        onPress={() => navigation.navigate('GoogleCalendar')}
      />
      <MenuRow
        icon={<Database size={20} color={colors.textPrimary} />}
        label="Backup e sincronização"
        onPress={() => navigation.navigate('Backup')}
      />

      {subscriptionsEnabled && (
        <MenuRow
          icon={<CreditCard size={20} color={colors.textPrimary} />}
          label="Assinatura"
          onPress={() => navigation.navigate('Subscription')}
        />
      )}

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <LogOut size={20} color={colors.danger} />
        <Text style={styles.signOutText}>Sair</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function MenuRow({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuRow} onPress={onPress}>
      {icon}
      <Text style={styles.menuRowLabel}>{label}</Text>
      <ChevronRight size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  profileHeader: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  avatarImage: { width: 88, height: 88 },
  avatarInitials: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.primary },
  nameSkeleton: { width: 140, height: 20, borderRadius: radius.md, backgroundColor: colors.border },
  profileName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  profileSpecialty: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuRowLabel: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary, fontWeight: fontWeight.medium },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  signOutText: { color: colors.danger, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
});