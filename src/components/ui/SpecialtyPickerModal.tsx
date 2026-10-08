// src/components/ui/SpecialtyPickerModal.tsx
//
// Folha inferior com busca pra escolher a especialização médica. A lista de
// sugestões (MEDICAL_SPECIALTIES) cobre as especialidades reconhecidas pelo
// CFM/AMB, mas o campo no banco é texto livre — então, se a pessoa digitar
// algo que não está na lista, aparece uma opção "Usar ..." pra confirmar o
// valor digitado mesmo assim (cobre residentes, áreas de atuação, etc.).
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Check, Search, X } from 'lucide-react-native';
import { colors, radius, spacing, fontSize, fontWeight } from '../../theme';
import { MEDICAL_SPECIALTIES } from '../../utils/medicalSpecialties';

interface SpecialtyPickerModalProps {
  visible: boolean;
  initialValue: string;
  onClose: () => void;
  onConfirm: (specialty: string) => void;
}

export function SpecialtyPickerModal({ visible, initialValue, onClose, onConfirm }: SpecialtyPickerModalProps) {
  const [query, setQuery] = useState('');

  // reabre sempre com a busca limpa, não com o que sobrou da última vez que
  // o modal foi usado
  const lastVisible = React.useRef(visible);
  if (visible && !lastVisible.current) {
    setQuery('');
  }
  lastVisible.current = visible;

  const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR');

  const results = useMemo(() => {
    if (!normalizedQuery) return MEDICAL_SPECIALTIES;
    return MEDICAL_SPECIALTIES.filter((item) => item.toLocaleLowerCase('pt-BR').includes(normalizedQuery));
  }, [normalizedQuery]);

  const hasExactMatch = results.some((item) => item.toLocaleLowerCase('pt-BR') === normalizedQuery);
  const showCustomOption = query.trim().length > 1 && !hasExactMatch;

  function handleSelect(specialty: string) {
    onConfirm(specialty);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>Especialização</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrapper}>
            <Search size={18} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar ou digitar a sua"
              placeholderTextColor={colors.textSecondary}
              style={styles.searchInput}
              autoCapitalize="words"
              autoFocus
            />
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => item}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              showCustomOption ? (
                <TouchableOpacity style={styles.row} onPress={() => handleSelect(query.trim())}>
                  <Text style={styles.rowTextCustom}>Usar "{query.trim()}"</Text>
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => {
              const selected = item === initialValue;
              return (
                <TouchableOpacity style={styles.row} onPress={() => handleSelect(item)}>
                  <Text style={styles.rowText}>{item}</Text>
                  {selected && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              !showCustomOption ? (
                <Text style={styles.emptyText}>Nenhuma especialidade encontrada</Text>
              ) : null
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '80%',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary },
  list: { marginTop: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { fontSize: fontSize.base, color: colors.textPrimary, flex: 1 },
  rowTextCustom: { fontSize: fontSize.base, color: colors.primary, fontWeight: fontWeight.semibold, flex: 1 },
  emptyText: { textAlign: 'center', color: colors.textSecondary, paddingVertical: spacing.lg },
});