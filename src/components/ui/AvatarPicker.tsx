// src/components/ui/AvatarPicker.tsx
//
// Círculo de avatar com um selo de câmera no canto — toca e abre uma folha
// com "Tirar foto" / "Escolher da galeria". Cuida de escolher a imagem, subir
// pro Storage e avisar o pai (onChange) com a URL nova; quem usa este
// componente só precisa salvar essa URL em profiles.avatar_url.
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, Image as ImageIcon, X } from 'lucide-react-native';
import { colors, radius, spacing, fontSize, fontWeight } from '../../theme';
import { pickAvatarImage, uploadAvatar, type AvatarSource } from '../../services/avatarService';

interface AvatarPickerProps {
  userId: string;
  value: string | null;
  fallbackText: string;
  size?: number;
  onChange: (url: string) => void;
}

export function AvatarPicker({ userId, value, fallbackText, size = 88, onChange }: AvatarPickerProps) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  async function handlePick(source: AvatarSource) {
    setSheetVisible(false);
    try {
      const uri = await pickAvatarImage(source);
      if (!uri) return; // cancelou

      setIsUploading(true);
      const url = await uploadAvatar(userId, uri);
      onChange(url);
    } catch (error) {
      Alert.alert('Não foi possível atualizar a foto', (error as Error).message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <View>
      <TouchableOpacity
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        onPress={() => setSheetVisible(true)}
        activeOpacity={0.8}
        disabled={isUploading}
      >
        {value ? (
          <Image source={{ uri: value }} style={{ width: size, height: size, borderRadius: size / 2 }} />
        ) : (
          <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{fallbackText}</Text>
        )}

        {isUploading && (
          <View style={[styles.loadingOverlay, { borderRadius: size / 2 }]}>
            <ActivityIndicator color={colors.textInverse} />
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.badge}>
        <Camera size={16} color={colors.textInverse} />
      </View>

      <Modal visible={sheetVisible} animationType="slide" transparent onRequestClose={() => setSheetVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSheetVisible(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.title}>Foto de perfil</Text>
              <TouchableOpacity onPress={() => setSheetVisible(false)} hitSlop={12}>
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.option} onPress={() => handlePick('camera')}>
              <Camera size={20} color={colors.textPrimary} />
              <Text style={styles.optionText}>Tirar foto</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.option} onPress={() => handlePick('library')}>
              <ImageIcon size={20} color={colors.textPrimary} />
              <Text style={styles.optionText}>Escolher da galeria</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: { fontWeight: fontWeight.bold, color: colors.primary },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { fontSize: fontSize.base, color: colors.textPrimary, fontWeight: fontWeight.medium },
});