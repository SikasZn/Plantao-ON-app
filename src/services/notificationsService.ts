// src/services/notificationsService.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Shift } from '../types/domain';

// horas de antecedência do lembrete — ajuste aqui se quiser mudar
const REMINDER_HOURS_BEFORE = 2;
const STORAGE_PREFIX = 'shift-notification:';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Lembretes de plantão',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Usamos TIME_INTERVAL (segundos a partir de agora) em vez de um trigger de
// data absoluta — evita depender do formato exato de trigger por data, que
// muda mais entre versões da lib, e dá no mesmo resultado.
export async function scheduleShiftReminder(
  shift: Pick<Shift, 'id' | 'start_at' | 'shift_type'>,
  hospitalName: string
) {
  await cancelShiftReminder(shift.id);

  const triggerDate = new Date(new Date(shift.start_at).getTime() - REMINDER_HOURS_BEFORE * 60 * 60 * 1000);
  const secondsUntilTrigger = Math.round((triggerDate.getTime() - Date.now()) / 1000);

  if (secondsUntilTrigger <= 0) return; // já é tarde demais pra avisar com antecedência

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Plantão em breve',
      body: `${hospitalName}${shift.shift_type ? ` — ${shift.shift_type}` : ''} começa em ${REMINDER_HOURS_BEFORE}h`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntilTrigger,
    },
  });

  await AsyncStorage.setItem(`${STORAGE_PREFIX}${shift.id}`, notificationId);
}

export async function cancelShiftReminder(shiftId: string) {
  const notificationId = await AsyncStorage.getItem(`${STORAGE_PREFIX}${shiftId}`);
  if (notificationId) {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    await AsyncStorage.removeItem(`${STORAGE_PREFIX}${shiftId}`);
  }
}