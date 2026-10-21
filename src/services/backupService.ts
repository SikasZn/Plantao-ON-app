// src/services/backupService.ts
//
// Exporta uma cópia de todos os dados do usuário (locais de trabalho, plantões e
// perfil) como um arquivo .json. Isso NÃO é um mecanismo de sincronização
// entre aparelhos — os dados já vivem no Supabase e já estão disponíveis em
// qualquer dispositivo em que a pessoa faça login (ver BackupScreen pra
// explicação completa). É só uma cópia extra, portátil, que a pessoa pode
// guardar por conta própria ou levar pra outro lugar.
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import { File, Paths } from 'expo-file-system';
import type { Hospital, Shift } from '../types/domain';

export interface BackupData {
  exportedAt: string;
  profile: {
    email: string;
    fullName: string;
    specialty: string;
  };
  hospitals: Hospital[];
  shifts: Shift[];
}

function buildBackupFile(data: BackupData): string {
  const fileName = `plantao-on-backup-${Date.now()}.json`;
  const file = new File(Paths.cache, fileName);
  file.create();
  file.write(JSON.stringify(data, null, 2));
  return file.uri;
}

async function shareFile(uri: string) {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Compartilhamento não está disponível neste dispositivo.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/json' });
}

async function emailFile(uri: string) {
  const isAvailable = await MailComposer.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Nenhum app de e-mail configurado neste dispositivo.');
  }
  await MailComposer.composeAsync({
    subject: 'Backup dos meus dados — Plantão ON',
    body: 'Segue em anexo uma cópia dos seus dados do Plantão ON (locais de trabalho, plantões e perfil).',
    attachments: [uri],
  });
}

export async function exportBackup(data: BackupData): Promise<void> {
  const uri = buildBackupFile(data);
  await shareFile(uri);
}

export async function emailBackup(data: BackupData): Promise<void> {
  const uri = buildBackupFile(data);
  await emailFile(uri);
}