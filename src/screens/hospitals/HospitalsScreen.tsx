// src/screens/hospitals/HospitalsScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronRight, Plus, Search } from 'lucide-react-native';
import type { MainTabParamList, MainStackParamList } from '../../navigation/types';
import { useHospitals } from '../../contexts/HospitalsContext';
import { Button } from '../../components/ui/Button';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';
import type { Hospital } from '../../types/domain';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Hospitals'>,
  NativeStackScreenProps<MainStackParamList>
>;

export function HospitalsScreen({ navigation }: Props) {
  const { hospitals, isLoading, error, refetch } = useHospitals();
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return hospitals;
    return hospitals.filter((h) => h.name.toLowerCase().includes(term));
  }, [hospitals, search]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Meus Locais de Trabalho</Text>
      </View>

      <View style={styles.searchWrapper}>
        <Search size={18} color={colors.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar local de trabalho..."
          placeholderTextColor={colors.textSecondary}
          style={styles.searchInput}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {search ? 'Nenhum local de trabalho encontrado.' : 'Você ainda não cadastrou nenhum local de trabalho.'}
            </Text>
          }
          renderItem={({ item }) => (
            <HospitalRow hospital={item} onPress={() => navigation.navigate('HospitalForm', { hospital: item })} />
          )}
        />
      )}

      <Button
        label="Adicionar local de trabalho"
        icon={<Plus size={20} color={colors.textInverse} />}
        onPress={() => navigation.navigate('HospitalForm')}
        style={styles.addButton}
      />
    </SafeAreaView>
  );
}

function HospitalRow({ hospital, onPress }: { hospital: Hospital; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.dot, { backgroundColor: hospital.color }]} />
      <Text style={styles.rowText}>{hospital.name}</Text>
      <ChevronRight size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold, color: colors.textPrimary },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary },
  loading: { marginTop: spacing.xl },
  errorText: { color: colors.danger, textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xl,
    fontSize: fontSize.sm,
    paddingHorizontal: spacing.lg,
  },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: {
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
  dot: { width: 14, height: 14, borderRadius: 7 },
  rowText: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary, fontWeight: fontWeight.medium },
  addButton: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
});