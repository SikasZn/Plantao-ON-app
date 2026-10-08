// src/services/avatarService.ts
//
// Escolhe a foto (câmera ou galeria) e sobe pro Supabase Storage. Fica
// separado do authService porque fala com um SDK diferente (expo-image-picker)
// antes de chegar no Supabase — o authService só cuida da tabela profiles.
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { supabase } from '../lib/supabase';

export type AvatarSource = 'camera' | 'library';

/**
 * Abre a câmera ou a galeria, já recortando em quadrado. Devolve o URI local
 * da foto escolhida, ou null se a pessoa cancelou ou negou a permissão.
 */
export async function pickAvatarImage(source: AvatarSource): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    throw new Error(
      source === 'camera'
        ? 'Permissão de câmera negada. Ative nas configurações do celular para tirar uma foto.'
        : 'Permissão de galeria negada. Ative nas configurações do celular para escolher uma foto.'
    );
  }

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
        });

  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0].uri;
}

/**
 * Sobe a foto pro bucket "avatars", sempre no mesmo caminho por usuário
 * (upsert) — assim não sobra lixo de fotos antigas. Devolve a URL pública já
 * com um carimbo de tempo, pra forçar o <Image> a recarregar (senão a URL
 * fica idêntica à anterior e o RN continua mostrando a versão em cache).
 */
export async function uploadAvatar(userId: string, localUri: string): Promise<string> {
  const file = new File(localUri);
  const bytes = await file.bytes();

  const path = `${userId}/avatar.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}