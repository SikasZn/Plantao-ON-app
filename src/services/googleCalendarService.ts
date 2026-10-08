// src/services/googleCalendarService.ts
//
// Sincronização unidirecional: Plantão ON → Google Agenda. Cada plantão ou
// compromisso vira um evento; editar ou excluir aqui atualiza/remove o
// evento lá. O caminho inverso (editar na Agenda e refletir aqui) não
// existe de propósito — exigiria polling ou webhook do Google, muito mais
// complexo pro ganho real nesse app.
//
// Usa o módulo nativo do @react-native-google-signin/google-signin que já
// está no projeto (login social) — só pedimos o escopo extra de Agenda via
// addScopes, sem precisar de nenhuma lib nova. Isso só funciona se a versão
// instalada da lib já tiver addScopes (versões atuais têm); se não tiver,
// é preciso atualizar o pacote e gerar build nova, porque aí é código nativo
// novo mesmo.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { configureGoogleSignIn } from './socialAuthService';
import { formatCurrency } from '../utils/currency';
import type { Shift } from '../types/domain';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const CONNECTED_KEY_PREFIX = 'plantao-on:google-calendar-connected:';
const CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export async function isGoogleCalendarConnected(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(`${CONNECTED_KEY_PREFIX}${userId}`);
  return value === '1';
}

// Pede a permissão de Agenda numa conta Google — funciona tanto pra quem já
// logou no app via Google (só adiciona o escopo) quanto pra quem se
// cadastrou por e-mail/senha (nesse caso conecta uma conta Google à parte,
// só pra isso, sem mexer no login do app no Supabase).
export async function connectGoogleCalendar(userId: string): Promise<void> {
  configureGoogleSignIn();
  await GoogleSignin.hasPlayServices();

  const hasCurrentUser = GoogleSignin.hasPreviousSignIn();
  if (!hasCurrentUser) {
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      throw new Error('Conexão cancelada.');
    }
  }

  await GoogleSignin.addScopes({ scopes: [CALENDAR_SCOPE] });
  await AsyncStorage.setItem(`${CONNECTED_KEY_PREFIX}${userId}`, '1');
}

export async function disconnectGoogleCalendar(userId: string): Promise<void> {
  await AsyncStorage.removeItem(`${CONNECTED_KEY_PREFIX}${userId}`);
}

async function getAccessToken(): Promise<string> {
  // getTokens() sempre devolve um accessToken válido — o SDK nativo renova
  // sozinho por baixo dos panos quando precisa, então não gerenciamos
  // refresh token manualmente aqui
  const { accessToken } = await GoogleSignin.getTokens();
  return accessToken;
}

function buildEventPayload(shift: Shift, hospitalName: string) {
  const descriptionLines = [
    shift.total_value !== null ? `Valor: ${formatCurrency(shift.total_value)}` : null,
    shift.passed_to ? `Repassado para: ${shift.passed_to}` : null,
    shift.notes,
  ].filter((line): line is string => !!line);

  return {
    summary: shift.shift_type ? `Plantão — ${hospitalName} (${shift.shift_type})` : `Plantão — ${hospitalName}`,
    description: descriptionLines.join('\n') || undefined,
    // start_at/end_at já são ISO com offset (timestamptz do Postgres) — o
    // Google aceita o offset direto no dateTime, sem precisar mandar timeZone
    start: { dateTime: shift.start_at },
    end: { dateTime: shift.end_at },
  };
}

/**
 * Cria (se google_calendar_event_id ainda for null) ou atualiza o evento na
 * Agenda. Devolve o id do evento — quem chama é responsável por gravar esse
 * id de volta no plantão (setShiftGoogleEventId).
 */
export async function syncShiftToGoogleCalendar(shift: Shift, hospitalName: string): Promise<string> {
  const accessToken = await getAccessToken();
  const payload = buildEventPayload(shift, hospitalName);

  const isUpdate = !!shift.google_calendar_event_id;
  const url = isUpdate ? `${CALENDAR_EVENTS_URL}/${shift.google_calendar_event_id}` : CALENDAR_EVENTS_URL;

  const response = await fetch(url, {
    method: isUpdate ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // o evento pode ter sido apagado manualmente na Agenda — se o PATCH
    // falhar com 404/410, tenta criar um novo em vez de propagar o erro
    if (isUpdate && (response.status === 404 || response.status === 410)) {
      return syncShiftToGoogleCalendar({ ...shift, google_calendar_event_id: null }, hospitalName);
    }
    throw new Error('Não foi possível sincronizar com o Google Agenda.');
  }

  const data = await response.json();
  return data.id as string;
}

export async function deleteShiftFromGoogleCalendar(eventId: string): Promise<void> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${CALENDAR_EVENTS_URL}/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 404/410 = o evento já não existe mais lá — é o resultado que a gente queria de qualquer forma
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error('Não foi possível remover o evento do Google Agenda.');
  }
}