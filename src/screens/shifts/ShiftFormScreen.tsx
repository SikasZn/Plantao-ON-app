// src/screens/shifts/ShiftFormScreen.tsx
import React, { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ArrowLeft, Check, ChevronDown, Plus, Trash2 } from 'lucide-react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../../navigation/types';
import { useShifts } from '../../hooks/useShifts';
import { useHospitals } from '../../contexts/HospitalsContext';
import { useAuth } from '../../contexts/AuthContext';
import { CurrencyField } from '../../components/ui/CurrencyField';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { ColorPickerModal } from '../../components/ui/ColorPickerModal';
import { formatDate, formatTime, toLocalDateKey } from '../../utils/date';
import {
  describeRecurrenceRule,
  WEEKDAY_LABELS_FULL,
  WEEKDAY_LABELS_SHORT,
  type RecurrenceRuleConfig,
} from '../../utils/recurrence';
import { hasComputedRate, computeShiftValue } from '../../utils/shiftValue';
import { requestNotificationPermissions, scheduleShiftReminder, cancelShiftReminder } from '../../services/notificationsService';
import {
  isGoogleCalendarConnected,
  syncShiftToGoogleCalendar,
  deleteShiftFromGoogleCalendar,
} from '../../services/googleCalendarService';
import type { RecurrenceRuleInput } from '../../services/recurrenceRulesService';
import { colors, spacing, radius, fontSize, fontWeight, hospitalColorPalette } from '../../theme';
import type { Shift, ShiftStatus } from '../../types/domain';
import { setShiftGoogleEventId, type ShiftInput } from '../../services/shiftsService';

type Props = NativeStackScreenProps<MainStackParamList, 'ShiftForm'>;
type PickerTarget = null | 'startDate' | 'startTime' | 'endDate' | 'endTime' | 'recurrenceEndDate';
type RecurrenceTab = 'daily' | 'weekly' | 'monthly' | 'other';
type OtherPreset = 'biweekly' | 'monthly';

function combineDateAndTime(base: Date, datePart?: Date, timePart?: Date) {
  const result = new Date(base);
  if (datePart) result.setFullYear(datePart.getFullYear(), datePart.getMonth(), datePart.getDate());
  if (timePart) result.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return result;
}

// Tarefas "nice to have" depois de salvar (lembrete local, Google Agenda):
// rodam por trás, sem bloquear a tela, e nunca derrubam nada se falharem.
function runInBackground(task: () => Promise<unknown>) {
  void task().catch(() => {});
}

export function ShiftFormScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const existing = route.params?.shift;
  const isEditing = !!existing;
  const initialDate = route.params?.initialDate;

  const { hospitals } = useHospitals();
  const {
    add,
    addRecurringSeries,
    edit,
    setStatus: setShiftsStatus,
    remove,
    removeFutureOccurrences,
    editAndFutureOccurrences,
  } = useShifts();
  const { user } = useAuth();

  const [entryType, setEntryType] = useState<'shift' | 'commitment'>(
    existing && existing.total_value === null ? 'commitment' : 'shift'
  );
  const [hospitalId, setHospitalId] = useState(existing?.hospital_id ?? '');
  // Cor livre do Compromisso (sem hospital) — só usada quando entryType é
  // 'commitment'. Parte da paleta padrão, igual a de hospitais, pra manter o
  // mesmo estilo visual no app inteiro.
  const [commitmentColor, setCommitmentColor] = useState(existing?.color ?? hospitalColorPalette[0]);
  const [isCommitmentColorPickerOpen, setIsCommitmentColorPickerOpen] = useState(false);
  const [shiftType, setShiftType] = useState(existing?.shift_type ?? '');
  const [startAt, setStartAt] = useState<Date>(() => {
    if (existing) return new Date(existing.start_at);
    if (initialDate) return new Date(`${initialDate}T07:00:00`);
    return new Date();
  });
  const [endAt, setEndAt] = useState<Date>(() => {
    if (existing) return new Date(existing.end_at);
    if (initialDate) return new Date(`${initialDate}T19:00:00`);
    const fallback = new Date();
    fallback.setHours(fallback.getHours() + 12);
    return fallback;
  });
  const [valueCents, setValueCents] = useState(
    existing && existing.total_value !== null ? String(Math.round(existing.total_value * 100)) : ''
  );
  // 'passed' nunca é uma escolha manual nos chips — só existe como
  // consequência automática de marcar "Plantão passado" mais abaixo. Se o
  // plantão já estiver com esse status ao abrir a tela, o chip cai de volta
  // pra 'pending' (o status real volta a ser 'passed' no save se isPassed
  // continuar marcado — ver baseInput.status em handleSave).
  const [status, setStatus] = useState<ShiftStatus>(
    existing && existing.status !== 'passed' ? (existing.status as ShiftStatus) : 'pending'
  );
  const [isRecurring, setIsRecurring] = useState(existing?.is_recurring ?? false);
  // Motor de recorrência novo (estilo Agenda do iOS) — só existe pra criar
  // um plantão/compromisso novo (isEditing já desliga esse bloco inteiro
  // mais abaixo). Editar uma ocorrência já existente não deixa trocar a
  // periodicidade da série em si — só os campos do plantão (hospital, cor,
  // horário, valor etc.), com a escolha de escopo "apenas este" / "este e
  // os próximos" feita em handleSave/handleDelete.
  const [recurrenceTab, setRecurrenceTab] = useState<RecurrenceTab>('weekly');
  const [dailyInterval, setDailyInterval] = useState(1);
  const [weeklyInterval, setWeeklyInterval] = useState(1);
  const [weeklyDays, setWeeklyDays] = useState<number[]>([]);
  const [monthlyInterval, setMonthlyInterval] = useState(1);
  const [monthlyDays, setMonthlyDays] = useState<number[]>([]);
  const [otherPreset, setOtherPreset] = useState<OtherPreset | null>(null);
  const [recurrenceEndType, setRecurrenceEndType] = useState<'never' | 'on_date'>('never');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);
  const [isPassed, setIsPassed] = useState(!!existing?.passed_to);
  const [passedToName, setPassedToName] = useState(existing?.passed_to ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');

  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [isHospitalPickerOpen, setIsHospitalPickerOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedHospital = hospitals.find((h) => h.id === hospitalId);

  // Quando o hospital tem valor/hora cadastrado, o valor do plantão é
  // sempre calculado — nunca digitado à mão, nem ao editar um plantão já
  // existente. Antes disso ficava "travado" assim que a tela abria pra
  // editar (valueEditedManually nascia true), então mudar as horas de um
  // plantão existente nunca recalculava nada — esse era o bug relatado.
  // A conta em si mora em utils/shiftValue.ts — centralizada pra ser a
  // mesma usada aqui e na materialização de séries recorrentes.
  // "Já recebi": ao editar um plantão que já existe, o toggle grava na hora
  // (sem precisar apertar Salvar); ao criar, só muda o estado e vai junto no
  // Salvar. Se a gravação falhar, volta pro valor anterior.
  async function handlePaidToggle(value: boolean) {
    const previous = status;
    const next: ShiftStatus = value ? 'paid' : 'pending';
    setStatus(next);
    if (!existing) return;
    try {
      await setShiftsStatus([existing.id], next);
    } catch (error) {
      setStatus(previous);
      Alert.alert('Não foi possível atualizar o pagamento', (error as Error).message);
    }
  }

  const isValueComputed = entryType === 'shift' && hasComputedRate(selectedHospital);

  useEffect(() => {
    if (!isValueComputed) return;
    const value = computeShiftValue(selectedHospital, startAt, endAt);
    if (value === null) return;
    setValueCents(String(Math.round(value * 100)));
  }, [isValueComputed, selectedHospital, startAt, endAt]);

  function selectRecurrenceTab(tab: RecurrenceTab) {
    setRecurrenceTab(tab);
    // ao abrir Semanalmente/Mensalmente pela 1ª vez, pré-seleciona o dia da
    // semana/mês do próprio início do plantão — igual a Agenda do iOS, que
    // já abre com "hoje" marcado em vez de uma grade em branco
    if (tab === 'weekly' && weeklyDays.length === 0) setWeeklyDays([startAt.getDay()]);
    if (tab === 'monthly' && monthlyDays.length === 0) setMonthlyDays([startAt.getDate()]);
  }

  function toggleWeeklyDay(day: number) {
    setWeeklyDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)));
  }

  function toggleMonthlyDay(day: number) {
    setMonthlyDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)));
  }

  // Monta a regra de recorrência a partir do estado da tela — null quando
  // ainda falta escolher algo (nenhum dia marcado em Semanal/Mensal, ou
  // nenhuma opção escolhida em Outros). "Outros" não é um motor à parte:
  // os dois atalhos dele só pré-configuram Semanal (quinzenal) ou Mensal
  // (no dia de início) sem o usuário precisar mexer nos seletores manuais.
  function buildRuleConfig(): RecurrenceRuleConfig | null {
    const startDate = toLocalDateKey(startAt);
    const endDate = recurrenceEndDate ? toLocalDateKey(recurrenceEndDate) : null;
    const base = { startDate, endType: recurrenceEndType, endDate };

    if (recurrenceTab === 'daily') {
      return { frequency: 'daily', intervalCount: dailyInterval, weekdays: [], monthDays: [], ...base };
    }
    if (recurrenceTab === 'weekly') {
      if (weeklyDays.length === 0) return null;
      return { frequency: 'weekly', intervalCount: weeklyInterval, weekdays: weeklyDays, monthDays: [], ...base };
    }
    if (recurrenceTab === 'monthly') {
      if (monthlyDays.length === 0) return null;
      return { frequency: 'monthly', intervalCount: monthlyInterval, weekdays: [], monthDays: monthlyDays, ...base };
    }
    // 'other'
    if (otherPreset === 'biweekly') {
      return { frequency: 'weekly', intervalCount: 2, weekdays: [startAt.getDay()], monthDays: [], ...base };
    }
    if (otherPreset === 'monthly') {
      return { frequency: 'monthly', intervalCount: 1, weekdays: [], monthDays: [startAt.getDate()], ...base };
    }
    return null;
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    if (entryType === 'shift' && !hospitalId) nextErrors.hospital = 'Escolha um local de trabalho';
    if (entryType === 'commitment' && !shiftType.trim()) nextErrors.shiftType = 'Informe o nome do compromisso';
    if (endAt.getTime() <= startAt.getTime()) nextErrors.end = 'O fim precisa ser depois do início';
    if (entryType === 'shift' && (!valueCents || Number(valueCents) <= 0)) {
      nextErrors.value = 'Informe o valor do plantão';
    }
    if (isEditing && isPassed && !passedToName.trim()) {
      nextErrors.passedTo = 'Informe o nome do colega';
    }
    if (!isEditing && isRecurring) {
      if (!buildRuleConfig()) {
        nextErrors.recurrenceDays = recurrenceTab === 'other' ? 'Escolha uma das opções' : 'Escolha pelo menos um dia';
      }
      if (recurrenceEndType === 'on_date') {
        if (!recurrenceEndDate) {
          nextErrors.recurrenceEndDate = 'Escolha a data de término';
        } else if (recurrenceEndDate.getTime() < startAt.getTime()) {
          nextErrors.recurrenceEndDate = 'A data de término deve ser depois do início';
        }
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;

    // Um Compromisso não tem hospital — manda null (a coluna aceita, desde a
    // migration que tirou o NOT NULL) e leva a cor escolhida à mão em vez da
    // cor do hospital. Um plantão de verdade continua exatamente como antes.
    const baseInput: ShiftInput = {
      hospital_id: entryType === 'shift' ? hospitalId : null,
      color: entryType === 'commitment' ? commitmentColor : null,
      shift_type: shiftType.trim() || null,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      total_value: entryType === 'shift' ? Number(valueCents) / 100 : null,
      // repassar o plantão sobrepõe o status escolhido nos chips — não faz
      // sentido continuar "Pago"/"A receber" pra um plantão que não é mais
      // do usuário
      status: isEditing && isPassed ? 'passed' : status,
      is_recurring: isRecurring,
      // Preserva o vínculo com a série ao editar uma ocorrência — mandar
      // null aqui sempre (como era antes) desvinculava silenciosamente
      // qualquer ocorrência editada da sua série, o que quebraria "editar
      // este e os próximos" assim que o usuário editasse qualquer coisa num
      // plantão recorrente, nem que fosse só marcar como pago.
      recurrence_group_id: isEditing && existing ? existing.recurrence_group_id : null,
      passed_to: isEditing && isPassed ? passedToName.trim() : null,
      notes: notes.trim() || null,
    };

    // nome usado no lembrete e no evento da Google Agenda — pra um
    // Compromisso não existe hospital, então usa o próprio nome digitado
    const entryLabel =
      entryType === 'shift' ? selectedHospital?.name ?? 'Local' : shiftType.trim() || 'Compromisso';

    // Ocorrência de uma série recorrente — pergunta o escopo antes de
    // aplicar a edição (item 3 do documento: "editar somente aquele" vs
    // "alterar este e os próximos"), nunca mexendo no passado.
    if (isEditing && existing && existing.recurrence_group_id) {
      Alert.alert('Editar plantão recorrente', 'Esse plantão faz parte de uma série. O que você quer alterar?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apenas este', onPress: () => void saveSingleOccurrence(existing, baseInput, entryLabel) },
        {
          text: 'Este e os próximos',
          onPress: () => void saveThisAndFutureOccurrences(existing, baseInput, entryLabel),
        },
      ]);
      return;
    }

    if (isEditing && existing) {
      await saveSingleOccurrence(existing, baseInput, entryLabel);
      return;
    }

    await saveNewEntry(baseInput, entryLabel);
  }

  async function saveSingleOccurrence(target: Shift, input: ShiftInput, entryLabel: string) {
    setIsSubmitting(true);
    try {
      const updated = await edit(target.id, input);
      // o plantão já está salvo: volta pra lista na hora e deixa lembrete e
      // Google Agenda (que dependem de permissão do sistema / internet)
      // rodando por trás, sem segurar o botão em "carregando"
      navigation.goBack();
      runInBackground(async () => {
        await scheduleReminderSafely(updated, entryLabel);
        await syncToGoogleCalendarSafely(updated, entryLabel);
      });
    } catch (error) {
      Alert.alert('Não foi possível salvar', (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // "Este e os próximos": aplica os campos editados a essa ocorrência e a
  // todas as futuras da série (nunca às passadas) — por baixo, fecha a série
  // antiga nessa data e abre uma nova já com os valores editados (ver
  // editFutureOccurrences em recurrenceRulesService.ts).
  async function saveThisAndFutureOccurrences(target: Shift, input: ShiftInput, entryLabel: string) {
    setIsSubmitting(true);
    try {
      const { updated, created, removedOld } = await editAndFutureOccurrences(target, {
        hospital_id: input.hospital_id,
        color: input.color,
        shift_type: input.shift_type,
        total_value: input.total_value,
        notes: input.notes,
        status: input.status,
        passed_to: input.passed_to,
        start_at: input.start_at,
        end_at: input.end_at,
      });
      // as ocorrências futuras antigas somem (a série nova as substitui) —
      // cancela o lembrete e o evento da Google Agenda de cada uma antes
      // delas serem esquecidas
      navigation.goBack();
      runInBackground(async () => {
        await Promise.all(removedOld.map((shift) => cleanupShiftSideEffects(shift)));
        await scheduleReminderSafely(updated, entryLabel);
        await syncToGoogleCalendarSafely(updated, entryLabel);
        await Promise.all(created.map((shift) => scheduleReminderSafely(shift, entryLabel)));
        await Promise.all(created.map((shift) => syncToGoogleCalendarSafely(shift, entryLabel)));
      });
    } catch (error) {
      Alert.alert('Não foi possível salvar', (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function saveNewEntry(baseInput: ShiftInput, entryLabel: string) {
    setIsSubmitting(true);
    try {
      if (isRecurring) {
        // validate() já garantiu que buildRuleConfig() não é null aqui
        const ruleConfig = buildRuleConfig()!;
        const ruleInput: RecurrenceRuleInput = {
          frequency: ruleConfig.frequency,
          interval_count: ruleConfig.intervalCount,
          weekdays: ruleConfig.frequency === 'weekly' ? ruleConfig.weekdays : null,
          month_days: ruleConfig.frequency === 'monthly' ? ruleConfig.monthDays : null,
          start_date: ruleConfig.startDate,
          start_time_minutes: startAt.getHours() * 60 + startAt.getMinutes(),
          duration_minutes: Math.round((endAt.getTime() - startAt.getTime()) / 60000),
          end_type: ruleConfig.endType,
          end_date: ruleConfig.endDate,
          hospital_id: baseInput.hospital_id,
          color: baseInput.color,
          shift_type: baseInput.shift_type,
          total_value: baseInput.total_value,
          status: baseInput.status,
          notes: baseInput.notes,
        };
        const created = await addRecurringSeries(ruleInput);
        navigation.goBack();
        runInBackground(async () => {
          await Promise.all(created.map((shift) => scheduleReminderSafely(shift, entryLabel)));
          await Promise.all(created.map((shift) => syncToGoogleCalendarSafely(shift, entryLabel)));
        });
      } else {
        const created = await add(baseInput);
        navigation.goBack();
        runInBackground(async () => {
          await scheduleReminderSafely(created, entryLabel);
          await syncToGoogleCalendarSafely(created, entryLabel);
        });
      }
    } catch (error) {
      Alert.alert('Não foi possível salvar', (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Agendar lembrete é um "nice to have" — se a permissão for negada ou algo
  // falhar aqui, o plantão já foi salvo com sucesso e não deve ser desfeito.
  async function scheduleReminderSafely(shift: Parameters<typeof scheduleShiftReminder>[0], hospitalName: string) {
    try {
      const granted = await requestNotificationPermissions();
      if (granted) {
        await scheduleShiftReminder(shift, hospitalName);
      }
    } catch {
      // silenciosamente ignora — não impede o plantão de ter sido salvo
    }
  }

  // Mesma lógica: se a Google Agenda não estiver conectada, ou a sincronização
  // falhar por qualquer motivo (sem internet, token expirado), o plantão já
  // foi salvo com sucesso e isso não deve travar nem desfazer o save.
  async function syncToGoogleCalendarSafely(shift: Shift, hospitalName: string) {
    if (!user) return;
    try {
      const connected = await isGoogleCalendarConnected(user.id);
      if (!connected) return;
      const eventId = await syncShiftToGoogleCalendar(shift, hospitalName);
      if (eventId !== shift.google_calendar_event_id) {
        await setShiftGoogleEventId(shift.id, eventId);
      }
    } catch {
      // silenciosamente ignora — não impede o plantão de ter sido salvo
    }
  }

  function handleDelete() {
    if (!existing) return;

    // Ocorrência de uma série recorrente — pergunta o escopo antes de
    // excluir (item 3 do documento: "excluir os próximos" nunca mexe em
    // ocorrências passadas, só nessa e nas depois dela).
    if (existing.recurrence_group_id) {
      Alert.alert('Excluir plantão recorrente', 'Esse plantão faz parte de uma série. O que você quer excluir?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apenas este', style: 'destructive', onPress: () => void deleteSingleOccurrence(existing) },
        {
          text: 'Este e os próximos',
          style: 'destructive',
          onPress: () => void deleteThisAndFutureOccurrences(existing),
        },
      ]);
      return;
    }

    Alert.alert('Excluir plantão', 'Tem certeza que deseja excluir este plantão?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => void deleteSingleOccurrence(existing) },
    ]);
  }

  async function deleteSingleOccurrence(shift: Shift) {
    try {
      await remove(shift.id);
      await cleanupShiftSideEffects(shift);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Não foi possível excluir', (error as Error).message);
    }
  }

  // "Este e os próximos": termina a série nessa ocorrência e apaga ela e
  // todas as depois dela — nunca as de antes (ver deleteFutureOccurrences em
  // recurrenceRulesService.ts, que já filtra por start_at).
  async function deleteThisAndFutureOccurrences(shift: Shift) {
    try {
      const removed = await removeFutureOccurrences(shift);
      await Promise.all(removed.map((s) => cleanupShiftSideEffects(s)));
      navigation.goBack();
    } catch (error) {
      Alert.alert('Não foi possível excluir', (error as Error).message);
    }
  }

  // Limpeza "best-effort" de uma ocorrência já excluída (avulsa ou em lote,
  // numa série): cancela o lembrete local e remove o evento vinculado da
  // Google Agenda, sem fazer a exclusão em si parecer ter falhado por causa
  // disso — o plantão já saiu do banco quando isso roda.
  async function cleanupShiftSideEffects(shift: Shift) {
    try {
      await cancelShiftReminder(shift.id);
    } catch {
      // silenciosamente ignora — a exclusão já aconteceu de verdade
    }
    if (shift.google_calendar_event_id) {
      // não bloqueia a navegação de volta esperando a Calendar API — é
      // limpeza best-effort, o plantão já foi excluído de verdade
      deleteShiftFromGoogleCalendar(shift.google_calendar_event_id).catch(() => {});
    }
  }

  // O tipo do evento não é exportado publicamente pela lib pro onValueChange
  // novo — deixamos o TypeScript inferir pelo próprio prop em vez de arriscar
  // um nome de tipo errado.
  function handlePickerChange(_event: unknown, selected?: Date) {
    const target = pickerTarget;
    if (Platform.OS !== 'ios') setPickerTarget(null);
    if (!selected || !target) return;

    if (target === 'startDate') setStartAt((prev) => combineDateAndTime(prev, selected, undefined));
    if (target === 'startTime') setStartAt((prev) => combineDateAndTime(prev, undefined, selected));
    if (target === 'endDate') setEndAt((prev) => combineDateAndTime(prev, selected, undefined));
    if (target === 'endTime') setEndAt((prev) => combineDateAndTime(prev, undefined, selected));
    if (target === 'recurrenceEndDate') setRecurrenceEndDate(selected);
  }

  function handlePickerDismiss() {
    setPickerTarget(null);
  }

  const isStartPicker = pickerTarget === 'startDate' || pickerTarget === 'startTime';
  const pickerValue =
    pickerTarget === 'recurrenceEndDate' ? recurrenceEndDate ?? startAt : isStartPicker ? startAt : endAt;
  const pickerMode =
    pickerTarget === 'startDate' || pickerTarget === 'endDate' || pickerTarget === 'recurrenceEndDate'
      ? 'date'
      : 'time';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? undefined : 'padding'}>
      <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={[styles.container, { paddingBottom: spacing.xl + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{isEditing ? 'Editar plantão' : 'Novo plantão'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.entryTypeTabs}>
          <TouchableOpacity
            style={[styles.entryTypeTab, entryType === 'shift' && styles.entryTypeTabActive]}
            onPress={() => setEntryType('shift')}
          >
            <Text style={[styles.entryTypeTabText, entryType === 'shift' && styles.entryTypeTabTextActive]}>
              Plantão
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.entryTypeTab, entryType === 'commitment' && styles.entryTypeTabActive]}
            onPress={() => setEntryType('commitment')}
          >
            <Text style={[styles.entryTypeTabText, entryType === 'commitment' && styles.entryTypeTabTextActive]}>
              Compromisso
            </Text>
          </TouchableOpacity>
        </View>

        {entryType === 'shift' ? (
          <>
            <Text style={styles.label}>Local de trabalho</Text>
            <Pressable style={styles.selectField} onPress={() => setIsHospitalPickerOpen(true)}>
              {selectedHospital ? (
                <View style={styles.selectedHospital}>
                  <View style={[styles.dot, { backgroundColor: selectedHospital.color }]} />
                  <Text style={styles.selectFieldText}>{selectedHospital.name}</Text>
                </View>
              ) : (
                <Text style={styles.selectPlaceholder}>Selecione um local de trabalho</Text>
              )}
              <ChevronDown size={18} color={colors.textSecondary} />
            </Pressable>
            {!!errors.hospital && <Text style={styles.error}>{errors.hospital}</Text>}

            <TextField
              label="Tipo de plantão (opcional)"
              placeholder="Ex.: UTI"
              value={shiftType}
              onChangeText={setShiftType}
            />
          </>
        ) : (
          <>
            <TextField
              label="Nome do compromisso"
              placeholder="Ex.: Reunião de equipe"
              value={shiftType}
              onChangeText={setShiftType}
              error={errors.shiftType}
            />

            <Text style={styles.label}>Cor</Text>
            <View style={styles.colorRow}>
              {hospitalColorPalette.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setCommitmentColor(color)}
                  style={[styles.colorSwatch, { backgroundColor: color }]}
                >
                  {commitmentColor === color && <Check size={18} color={colors.textInverse} />}
                </TouchableOpacity>
              ))}

              {!hospitalColorPalette.includes(commitmentColor) && !!commitmentColor && (
                <TouchableOpacity
                  style={[styles.colorSwatch, { backgroundColor: commitmentColor }]}
                  onPress={() => setIsCommitmentColorPickerOpen(true)}
                >
                  <Check size={18} color={colors.textInverse} />
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.addColorSwatch} onPress={() => setIsCommitmentColorPickerOpen(true)}>
                <Plus size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Data de início</Text>
            <Pressable style={styles.selectField} onPress={() => setPickerTarget('startDate')}>
              <Text style={styles.selectFieldText}>{formatDate(startAt.toISOString())}</Text>
            </Pressable>
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Hora de início</Text>
            <Pressable style={styles.selectField} onPress={() => setPickerTarget('startTime')}>
              <Text style={styles.selectFieldText}>{formatTime(startAt.toISOString())}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Data de término</Text>
            <Pressable style={styles.selectField} onPress={() => setPickerTarget('endDate')}>
              <Text style={styles.selectFieldText}>{formatDate(endAt.toISOString())}</Text>
            </Pressable>
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Hora de término</Text>
            <Pressable style={styles.selectField} onPress={() => setPickerTarget('endTime')}>
              <Text style={styles.selectFieldText}>{formatTime(endAt.toISOString())}</Text>
            </Pressable>
          </View>
        </View>
        {!!errors.end && <Text style={styles.error}>{errors.end}</Text>}

        {entryType === 'shift' && (
          <>
            <CurrencyField
              label="Valor do plantão"
              value={valueCents}
              onChangeText={setValueCents}
              error={errors.value}
              editable={!isValueComputed}
            />
            {isValueComputed && (
              <Text style={styles.hint}>
                {selectedHospital?.default_shift_value
                  ? 'Valor fixo do plantão definido no local de trabalho'
                  : 'Calculado automaticamente pelo valor/hora do local de trabalho'}
              </Text>
            )}

            {isPassed ? (
              <>
                <Text style={styles.label}>Status</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.chip, styles.chipActive]}>
                    <Text style={[styles.chipText, styles.chipTextActive]}>Passado</Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Já recebi</Text>
                <Switch
                  value={status === 'paid'}
                  onValueChange={handlePaidToggle}
                  trackColor={{ true: colors.primary, false: colors.border }}
                />
              </View>
            )}
          </>
        )}

        {!isEditing && (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Repetir</Text>
            <Switch
              value={isRecurring}
              onValueChange={(value) => {
                setIsRecurring(value);
                // mesma ideia de selectRecurrenceTab: já abre com o dia de
                // hoje marcado em vez de uma grade em branco
                if (value && weeklyDays.length === 0) setWeeklyDays([startAt.getDay()]);
              }}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        )}

        {!isEditing && isRecurring && (
          <View style={styles.recurringConfig}>
            <Text style={styles.label}>Repetir</Text>
            <View style={styles.patternWrap}>
              <TouchableOpacity
                style={[styles.patternChip, recurrenceTab === 'daily' && styles.patternChipActive]}
                onPress={() => selectRecurrenceTab('daily')}
              >
                <Text style={[styles.patternChipText, recurrenceTab === 'daily' && styles.patternChipTextActive]}>
                  Diariamente
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.patternChip, recurrenceTab === 'weekly' && styles.patternChipActive]}
                onPress={() => selectRecurrenceTab('weekly')}
              >
                <Text style={[styles.patternChipText, recurrenceTab === 'weekly' && styles.patternChipTextActive]}>
                  Semanalmente
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.patternChip, recurrenceTab === 'monthly' && styles.patternChipActive]}
                onPress={() => selectRecurrenceTab('monthly')}
              >
                <Text style={[styles.patternChipText, recurrenceTab === 'monthly' && styles.patternChipTextActive]}>
                  Mensalmente
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.patternChip, recurrenceTab === 'other' && styles.patternChipActive]}
                onPress={() => selectRecurrenceTab('other')}
              >
                <Text style={[styles.patternChipText, recurrenceTab === 'other' && styles.patternChipTextActive]}>
                  Outros
                </Text>
              </TouchableOpacity>
            </View>

            {recurrenceTab === 'daily' && (
              <View style={styles.intervalRow}>
                <Text style={styles.intervalLabel}>A cada</Text>
                <View style={styles.compactStepper}>
                  <TouchableOpacity onPress={() => setDailyInterval((n) => Math.max(1, n - 1))} style={styles.stepperButton}>
                    <Text style={styles.stepperButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{dailyInterval}</Text>
                  <TouchableOpacity onPress={() => setDailyInterval((n) => Math.min(365, n + 1))} style={styles.stepperButton}>
                    <Text style={styles.stepperButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.intervalLabel}>dia(s)</Text>
              </View>
            )}

            {recurrenceTab === 'weekly' && (
              <>
                <View style={styles.weekdayRow}>
                  {WEEKDAY_LABELS_SHORT.map((label, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.weekdayChip, weeklyDays.includes(index) && styles.weekdayChipActive]}
                      onPress={() => toggleWeeklyDay(index)}
                    >
                      <Text style={[styles.weekdayChipText, weeklyDays.includes(index) && styles.weekdayChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.intervalRow}>
                  <Text style={styles.intervalLabel}>A cada</Text>
                  <View style={styles.compactStepper}>
                    <TouchableOpacity onPress={() => setWeeklyInterval((n) => Math.max(1, n - 1))} style={styles.stepperButton}>
                      <Text style={styles.stepperButtonText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{weeklyInterval}</Text>
                    <TouchableOpacity onPress={() => setWeeklyInterval((n) => Math.min(52, n + 1))} style={styles.stepperButton}>
                      <Text style={styles.stepperButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.intervalLabel}>semana(s)</Text>
                </View>
              </>
            )}

            {recurrenceTab === 'monthly' && (
              <>
                <View style={styles.monthDayGrid}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.monthDayChip, monthlyDays.includes(day) && styles.monthDayChipActive]}
                      onPress={() => toggleMonthlyDay(day)}
                    >
                      <Text style={[styles.monthDayChipText, monthlyDays.includes(day) && styles.monthDayChipTextActive]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.intervalRow}>
                  <Text style={styles.intervalLabel}>A cada</Text>
                  <View style={styles.compactStepper}>
                    <TouchableOpacity onPress={() => setMonthlyInterval((n) => Math.max(1, n - 1))} style={styles.stepperButton}>
                      <Text style={styles.stepperButtonText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{monthlyInterval}</Text>
                    <TouchableOpacity onPress={() => setMonthlyInterval((n) => Math.min(24, n + 1))} style={styles.stepperButton}>
                      <Text style={styles.stepperButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.intervalLabel}>mês(es)</Text>
                </View>
              </>
            )}

            {recurrenceTab === 'other' && (
              <View style={styles.otherPresetWrap}>
                <TouchableOpacity
                  style={[styles.otherPresetCard, otherPreset === 'biweekly' && styles.otherPresetCardActive]}
                  onPress={() => setOtherPreset('biweekly')}
                >
                  <Text style={[styles.otherPresetTitle, otherPreset === 'biweekly' && styles.otherPresetTitleActive]}>
                    Quinzenalmente
                  </Text>
                  <Text style={[styles.otherPresetSubtitle, otherPreset === 'biweekly' && styles.otherPresetTitleActive]}>
                    A cada 2 semanas, {WEEKDAY_LABELS_FULL[startAt.getDay()].toLowerCase()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.otherPresetCard, otherPreset === 'monthly' && styles.otherPresetCardActive]}
                  onPress={() => setOtherPreset('monthly')}
                >
                  <Text style={[styles.otherPresetTitle, otherPreset === 'monthly' && styles.otherPresetTitleActive]}>
                    Mensalmente
                  </Text>
                  <Text style={[styles.otherPresetSubtitle, otherPreset === 'monthly' && styles.otherPresetTitleActive]}>
                    Todo dia {startAt.getDate()}, a partir desta data
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {!!errors.recurrenceDays && <Text style={styles.error}>{errors.recurrenceDays}</Text>}

            <Text style={[styles.label, styles.repeatCountLabel]}>Terminar repetição</Text>
            <View style={styles.statusRow}>
              <StatusChip label="Nunca" active={recurrenceEndType === 'never'} onPress={() => setRecurrenceEndType('never')} />
              <StatusChip
                label="Em uma data"
                active={recurrenceEndType === 'on_date'}
                onPress={() => setRecurrenceEndType('on_date')}
              />
            </View>
            {recurrenceEndType === 'on_date' && (
              <Pressable style={styles.selectField} onPress={() => setPickerTarget('recurrenceEndDate')}>
                <Text style={styles.selectFieldText}>
                  {recurrenceEndDate ? formatDate(recurrenceEndDate.toISOString()) : 'Escolher data'}
                </Text>
              </Pressable>
            )}
            {!!errors.recurrenceEndDate && <Text style={styles.error}>{errors.recurrenceEndDate}</Text>}

            {(() => {
              const ruleConfig = buildRuleConfig();
              return ruleConfig ? (
                <Text style={styles.recurrenceHint}>{describeRecurrenceRule(ruleConfig)}</Text>
              ) : null;
            })()}
          </View>
        )}

        {isEditing && entryType === 'shift' && (
          <>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Plantão passado</Text>
              <Switch
                value={isPassed}
                onValueChange={setIsPassed}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            {isPassed && (
              <Text style={styles.hint}>O status muda automaticamente para "Passado" ao salvar.</Text>
            )}

            {isPassed && (
              <TextField
                label="Nome do colega"
                placeholder="Ex.: Fulano"
                value={passedToName}
                onChangeText={setPassedToName}
                error={errors.passedTo}
              />
            )}
          </>
        )}

        <TextField
          label="Observações (opcional)"
          placeholder="Ex.: escala mensal, colega..."
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        <Button label="Salvar" onPress={handleSave} loading={isSubmitting} style={styles.saveButton} />

        {isEditing && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Trash2 size={18} color={colors.danger} />
            <Text style={styles.deleteText}>Excluir plantão</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {pickerTarget && (
        <View style={Platform.OS === 'ios' ? styles.iosPickerContainer : undefined}>
          {Platform.OS === 'ios' && (
            <View style={styles.pickerDoneRow}>
              <TouchableOpacity onPress={() => setPickerTarget(null)}>
                <Text style={styles.pickerDoneText}>Concluído</Text>
              </TouchableOpacity>
            </View>
          )}
          <DateTimePicker
            value={pickerValue}
            mode={pickerMode}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onValueChange={handlePickerChange}
            onDismiss={handlePickerDismiss}
          />
        </View>
      )}

      <Modal
        visible={isHospitalPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsHospitalPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setIsHospitalPickerOpen(false)}>
          <View style={[styles.modalSheet, { paddingBottom: spacing.lg + insets.bottom }]}>
            <Text style={styles.modalTitle}>Selecione um local de trabalho</Text>
            <ScrollView>
              {hospitals.map((hospital) => (
                <TouchableOpacity
                  key={hospital.id}
                  style={styles.modalRow}
                  onPress={() => {
                    setHospitalId(hospital.id);
                    setIsHospitalPickerOpen(false);
                  }}
                >
                  <View style={[styles.dot, { backgroundColor: hospital.color }]} />
                  <Text style={styles.modalRowText}>{hospital.name}</Text>
                  {hospital.id === hospitalId && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
              {hospitals.length === 0 && (
                <Text style={styles.emptyHospitals}>Cadastre um local de trabalho primeiro na aba Locais.</Text>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <ColorPickerModal
        visible={isCommitmentColorPickerOpen}
        initialColor={commitmentColor || hospitalColorPalette[0]}
        onClose={() => setIsCommitmentColorPickerOpen(false)}
        onConfirm={(hex) => {
          setCommitmentColor(hex);
          setIsCommitmentColorPickerOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function StatusChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  container: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },
  entryTypeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: spacing.lg,
  },
  entryTypeTab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  entryTypeTabActive: { backgroundColor: colors.primary },
  entryTypeTabText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  entryTypeTabTextActive: { color: colors.textInverse },
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
  selectedHospital: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  selectFieldText: { fontSize: fontSize.base, color: colors.textPrimary },
  selectPlaceholder: { fontSize: fontSize.base, color: colors.textSecondary },
  dot: { width: 12, height: 12, borderRadius: 6 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
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
  error: { fontSize: fontSize.xs, color: colors.danger, marginTop: -spacing.sm, marginBottom: spacing.md },
  hint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: -spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  rowItem: { flex: 1 },
  statusRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  chipTextActive: { color: colors.textInverse },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  switchLabel: { fontSize: fontSize.base, color: colors.textPrimary, fontWeight: fontWeight.medium },
  recurringConfig: { marginBottom: spacing.md },
  patternWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  patternChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  patternChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  patternChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  patternChipTextActive: { color: colors.textInverse },
  repeatCountLabel: { marginTop: spacing.sm },
  recurrenceHint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.sm },
  intervalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  intervalLabel: { fontSize: fontSize.sm, color: colors.textPrimary },
  compactStepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weekdayRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  weekdayChip: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  weekdayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  weekdayChipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  weekdayChipTextActive: { color: colors.textInverse },
  monthDayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  monthDayChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  monthDayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  monthDayChipText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  monthDayChipTextActive: { color: colors.textInverse },
  otherPresetWrap: { gap: spacing.sm, marginBottom: spacing.sm },
  otherPresetCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  otherPresetCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  otherPresetTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  otherPresetSubtitle: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  otherPresetTitleActive: { color: colors.textInverse },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: { fontSize: fontSize.lg, color: colors.textPrimary, fontWeight: fontWeight.bold },
  stepperValue: { fontSize: fontSize.base, color: colors.textPrimary, fontWeight: fontWeight.semibold },
  saveButton: { marginTop: spacing.md },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  deleteText: { color: colors.danger, fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  iosPickerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pickerDoneRow: { alignItems: 'flex-end', padding: spacing.sm },
  pickerDoneText: { color: colors.primary, fontWeight: fontWeight.semibold, fontSize: fontSize.base },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '70%',
    padding: spacing.lg,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.md },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalRowText: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary },
  emptyHospitals: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
