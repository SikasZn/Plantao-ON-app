// src/screens/settings/ImportScreen.tsx
//
// Importa plantões de outros apps: a pessoa exporta o arquivo do app que usa
// hoje (planilha CSV ou calendário .ics), escolhe aqui, confere a prévia e
// importa tudo de uma vez — sem digitar plantão por plantão.
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Check, ChevronDown, FileUp } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { useAuth } from '../../contexts/AuthContext';
import { useHospitals } from '../../contexts/HospitalsContext';
import { useShifts } from '../../hooks/useShifts';
import { Button } from '../../components/ui/Button';
import { parseImportFile, type ParseResult } from '../../utils/importParser';
import { groupParsedShifts, importShifts, type ImportGroup } from '../../services/importService';
import { formatCurrency } from '../../utils/currency';
import { colors, spacing, radius, fontSize, fontWeight } from '../../theme';

type Props = NativeStackScreenProps<MainStackParamList, 'Import'>;

export function ImportScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { hospitals, refetch: refetchHospitals } = useHospitals();
  const { shifts, refetch: refetchShifts } = useShifts();

  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [groups, setGroups] = useState<ImportGroup[]>([]);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [markPastAsPaid, setMarkPastAsPaid] = useState(true);

  const totalToImport = useMemo(() => groups.reduce((sum, g) => sum + g.shifts.length, 0), [groups]);

  async function handlePick() {
    setIsReading(true);
    try {
      const picked = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (picked.canceled || !picked.assets?.[0]) return;
      const asset = picked.assets[0];
      const text = await new File(asset.uri).text();
      const parsed = parseImportFile(text);
      setFileName(asset.name);
      setResult(parsed);
      setGroups(groupParsedShifts(parsed.shifts, hospitals));
      setOpenGroup(null);
    } catch (error) {
      Alert.alert('Não foi possível ler o arquivo', (error as Error).message);
    } finally {
      setIsReading(false);
    }
  }

  function setTarget(key: string, target: 'new' | string) {
    setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, target } : g)));
    setOpenGroup(null);
  }

  async function handleImport() {
    if (!user || totalToImport === 0) return;
    setIsImporting(true);
    try {
      const summary = await importShifts(user.id, groups, hospitals, shifts, { markPastAsPaid });
      await Promise.all([refetchHospitals(), refetchShifts()]);
      const parts = [`${summary.imported} ${summary.imported === 1 ? 'plantão importado' : 'plantões importados'}.`];
      if (summary.hospitalsCreated) parts.push(`${summary.hospitalsCreated} local(is) de trabalho criado(s).`);
      if (summary.duplicates) parts.push(`${summary.duplicates} já existiam e foram ignorados.`);
      Alert.alert('Importação concluída', parts.join('\n'), [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (error) {
      Alert.alert('Não foi possível importar', (error as Error).message);
    } finally {
      setIsImporting(false);
    }
  }

  const hospitalName = (id: string) => hospitals.find((h) => h.id === id)?.name ?? 'Local removido';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Importar plantões</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
        {!result && (
          <>
            <Text style={styles.paragraph}>
              Traga seus plantões de outro aplicativo ou planilha, sem cadastrar um por um. Exporte do app que você
              usa hoje e escolha o arquivo aqui.
            </Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>Formatos aceitos</Text>
              <Text style={styles.infoText}>
                • Calendário (.ics): Google Agenda, Apple Calendário, Outlook e apps de escala que exportam calendário.
              </Text>
              <Text style={styles.infoText}>
                • Planilha (.csv): com colunas Data, Início, Fim, Local e Valor (separador vírgula ou ponto e vírgula).
                O relatório CSV do próprio Plantão ON também funciona.
              </Text>
              <Text style={styles.infoText}>
                Planilha do Excel (.xlsx)? Salve como CSV antes de importar.
              </Text>
            </View>
            <Button
              label="Escolher arquivo"
              onPress={handlePick}
              loading={isReading}
              style={styles.pickButton}
            />
          </>
        )}

        {result && (
          <>
            <View style={styles.fileRow}>
              <FileUp size={20} color={colors.primary} />
              <Text style={styles.fileName} numberOfLines={1}>
                {fileName}
              </Text>
              <TouchableOpacity onPress={handlePick} hitSlop={8}>
                <Text style={styles.changeText}>Trocar</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.summary}>
              {totalToImport} {totalToImport === 1 ? 'plantão encontrado' : 'plantões encontrados'}
              {result.skipped > 0 ? ` · ${result.skipped} linha(s) ignorada(s) por falta de data/horário` : ''}
            </Text>
            {result.warnings.map((w) => (
              <Text key={w} style={styles.warning}>
                {w}
              </Text>
            ))}

            {groups.length > 0 && <Text style={styles.sectionTitle}>Em qual local de trabalho cada um entra?</Text>}
            {groups.map((group) => {
              const isOpen = openGroup === group.key;
              const total = group.shifts.reduce((sum, s) => sum + (s.value ?? 0), 0);
              return (
                <View key={group.key || 'sem-nome'} style={styles.groupCard}>
                  <TouchableOpacity style={styles.groupHeader} onPress={() => setOpenGroup(isOpen ? null : group.key)}>
                    <View style={styles.groupInfo}>
                      <Text style={styles.groupTitle}>{group.title}</Text>
                      <Text style={styles.groupSub}>
                        {group.shifts.length} {group.shifts.length === 1 ? 'plantão' : 'plantões'}
                        {total > 0 ? ` · ${formatCurrency(total)}` : ''}
                      </Text>
                      <Text style={styles.groupTarget}>
                        {group.target === 'new' ? `Criar novo local “${group.title}”` : `Usar: ${hospitalName(group.target)}`}
                      </Text>
                    </View>
                    <ChevronDown size={18} color={colors.textSecondary} />
                  </TouchableOpacity>

                  {isOpen && (
                    <View style={styles.options}>
                      <TouchableOpacity style={styles.option} onPress={() => setTarget(group.key, 'new')}>
                        <Text style={styles.optionText}>Criar novo local “{group.title}”</Text>
                        {group.target === 'new' && <Check size={16} color={colors.primary} />}
                      </TouchableOpacity>
                      {hospitals.map((h) => (
                        <TouchableOpacity key={h.id} style={styles.option} onPress={() => setTarget(group.key, h.id)}>
                          <View style={[styles.dot, { backgroundColor: h.color }]} />
                          <Text style={styles.optionText}>{h.name}</Text>
                          {group.target === h.id && <Check size={16} color={colors.primary} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {totalToImport > 0 && (
              <>
                <View style={styles.switchRow}>
                  <View style={styles.switchInfo}>
                    <Text style={styles.switchLabel}>Marcar plantões passados como pagos</Text>
                    <Text style={styles.switchHint}>
                      Desligado, todos os plantões antigos entram como “a receber” e aparecem como atrasados.
                    </Text>
                  </View>
                  <Switch
                    value={markPastAsPaid}
                    onValueChange={setMarkPastAsPaid}
                    trackColor={{ true: colors.primary, false: colors.border }}
                  />
                </View>
                <Text style={styles.hint}>
                  Plantões sem valor no arquivo usam o valor do local de trabalho (por hora ou fixo). Plantões que já
                  existem no app (mesmo local e horário) não são duplicados.
                </Text>
                <Button
                  label={`Importar ${totalToImport} ${totalToImport === 1 ? 'plantão' : 'plantões'}`}
                  onPress={handleImport}
                  loading={isImporting}
                  style={styles.importButton}
                />
              </>
            )}
          </>
        )}

        {isReading && <ActivityIndicator style={{ marginTop: spacing.lg }} color={colors.primary} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  content: { paddingHorizontal: spacing.lg },
  paragraph: { fontSize: fontSize.base, color: colors.textPrimary, lineHeight: 22, marginBottom: spacing.lg },
  infoBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  infoTitle: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  infoText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  pickButton: { marginTop: spacing.sm },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  fileName: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary },
  changeText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.primary },
  summary: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.sm },
  warning: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: spacing.xs },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  groupHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  groupInfo: { flex: 1 },
  groupTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  groupSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  groupTarget: { fontSize: fontSize.xs, color: colors.primary, marginTop: 4 },
  options: { borderTopWidth: 1, borderTopColor: colors.border },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  optionText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary },
  dot: { width: 10, height: 10, borderRadius: 5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  switchInfo: { flex: 1 },
  switchLabel: { fontSize: fontSize.base, fontWeight: fontWeight.medium, color: colors.textPrimary },
  switchHint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  hint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.md },
  importButton: { marginTop: spacing.lg },
});
