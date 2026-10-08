// src/components/ui/ColorPickerModal.tsx
//
// Seletor de cor com 3 abas (Grade / Espectro / Controles), no espírito do
// seletor nativo do iOS. Não existe componente pronto pra isso no Expo, então
// é construído do zero com react-native-svg (gradiente do espectro) e
// @react-native-community/slider (sliders de RGB).
import React, { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Modal, PanResponder, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Slider from '@react-native-community/slider';
import { Check, X } from 'lucide-react-native';
import { colors, radius, spacing, fontSize, fontWeight } from '../../theme';
import {
  clamp01,
  hexToRgb,
  hslToHex,
  hsvToRgb,
  isValidHex,
  lerpRgb,
  rgbToHex,
  rgbToHsv,
  type RGB,
} from '../../utils/color';

type Tab = 'grid' | 'spectrum' | 'controls';

interface ColorPickerModalProps {
  visible: boolean;
  initialColor: string;
  onClose: () => void;
  onConfirm: (hex: string) => void;
}

const GRID_COLUMNS = 9;
const GRID_ROWS = 8;
const SPECTRUM_HEIGHT = 220;
const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };

export function ColorPickerModal({ visible, initialColor, onClose, onConfirm }: ColorPickerModalProps) {
  const [tab, setTab] = useState<Tab>('grid');
  const [draftHex, setDraftHex] = useState(isValidHex(initialColor) ? initialColor : '#16A34A');
  const [hexInput, setHexInput] = useState(draftHex.replace('#', ''));
  const [spectrumBoxWidth, setSpectrumBoxWidth] = useState(0);
  // O PanResponder abaixo é criado UMA vez (via useRef) e nunca mais recriado,
  // então seus handlers ficam "presos" nos valores de fechamento do primeiro
  // render (spectrumBoxWidth = 0 nesse momento). Por isso a leitura de largura
  // dentro do gesto precisa vir de uma ref sempre atualizada, não do state.
  const spectrumBoxWidthRef = useRef(0);

  // reabre sempre sincronizado com a cor atual do hospital, não com o que
  // sobrou de uma sessão anterior do modal
  const lastVisible = useRef(visible);
  if (visible && !lastVisible.current) {
    const startColor = isValidHex(initialColor) ? initialColor : '#16A34A';
    if (startColor !== draftHex) {
      setDraftHex(startColor);
      setHexInput(startColor.replace('#', ''));
    }
  }
  lastVisible.current = visible;

  const rgb = useMemo(() => hexToRgb(draftHex) ?? { r: 22, g: 163, b: 74 }, [draftHex]);
  const hsv = useMemo(() => rgbToHsv(rgb), [rgb]);

  function applyColor(hex: string) {
    setDraftHex(hex);
    setHexInput(hex.replace('#', ''));
  }

  function updateFromRgb(nextRgb: RGB) {
    applyColor(rgbToHex(nextRgb));
  }

  function handleHexInputChange(text: string) {
    const cleaned = text.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
    setHexInput(cleaned);
    const candidate = `#${cleaned}`;
    if (isValidHex(candidate)) {
      setDraftHex(candidate.toUpperCase());
    }
  }

  // ---- Grade: linha de cinzas + grade de matizes em várias luminosidades ----
  const grayscaleRow = useMemo(() => {
    const steps = 9;
    return Array.from({ length: steps }, (_, i) => {
      const l = 1 - i / (steps - 1);
      const v = Math.round(l * 255);
      return rgbToHex({ r: v, g: v, b: v });
    });
  }, []);

  const hueGrid = useMemo(() => {
    return Array.from({ length: GRID_ROWS }, (_, row) => {
      const lightness = 0.85 - row * (0.65 / (GRID_ROWS - 1));
      return Array.from({ length: GRID_COLUMNS }, (_, col) => {
        const hue = (col / GRID_COLUMNS) * 360;
        return hslToHex(hue, 0.65, lightness);
      });
    });
  }, []);

  // ---- Espectro: matiz no eixo vertical, branco→cor→preto no horizontal ----
  function handleSpectrumTouch(localX: number, localY: number) {
    const width = spectrumBoxWidthRef.current;
    if (width === 0) return;
    const x = clamp01(localX / width);
    const y = clamp01(localY / SPECTRUM_HEIGHT);

    const hue = y * 360;
    const pure = hsvToRgb({ h: hue, s: 1, v: 1 });
    const nextRgb = x <= 0.5 ? lerpRgb(WHITE, pure, x / 0.5) : lerpRgb(pure, BLACK, (x - 0.5) / 0.5);
    updateFromRgb(nextRgb);
  }

  // guarda sempre a versão mais recente da função — o PanResponder criado
  // logo abaixo só existe uma vez, então chama sempre pela ref pra nunca
  // executar uma cópia "congelada" de um render antigo
  const handleSpectrumTouchRef = useRef(handleSpectrumTouch);
  handleSpectrumTouchRef.current = handleSpectrumTouch;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) =>
        handleSpectrumTouchRef.current(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
      onPanResponderMove: (evt) =>
        handleSpectrumTouchRef.current(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
    })
  ).current;

  function handleSpectrumLayout(e: LayoutChangeEvent) {
    spectrumBoxWidthRef.current = e.nativeEvent.layout.width;
    setSpectrumBoxWidth(e.nativeEvent.layout.width);
  }

  // posição do indicador na tela — aproximação: matiz atual define y; s/v
  // atuais definem de qual lado do centro (branco↔cor↔preto) o x cai
  const indicatorX = hsv.v >= 0.999 ? (hsv.s / 2) * spectrumBoxWidth : (0.5 + (1 - hsv.v) / 2) * spectrumBoxWidth;
  const indicatorY = (hsv.h / 360) * SPECTRUM_HEIGHT;

  function handleConfirm() {
    onConfirm(draftHex);
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.title}>Cores</Text>
            <TouchableOpacity onPress={handleConfirm} style={styles.confirmButton} hitSlop={8}>
              <Check size={18} color={colors.textInverse} />
            </TouchableOpacity>
          </View>

          <View style={styles.previewRow}>
            <View style={[styles.previewSwatch, { backgroundColor: draftHex }]} />
            <Text style={styles.previewHex}>{draftHex}</Text>
          </View>

          <View style={styles.tabs}>
            <TabButton label="Grade" active={tab === 'grid'} onPress={() => setTab('grid')} />
            <TabButton label="Espectro" active={tab === 'spectrum'} onPress={() => setTab('spectrum')} />
            <TabButton label="Controles" active={tab === 'controls'} onPress={() => setTab('controls')} />
          </View>

          {tab === 'grid' && (
            <View>
              <View style={styles.gridRow}>
                {grayscaleRow.map((hex) => (
                  <Swatch key={hex} hex={hex} selected={hex === draftHex} onPress={() => applyColor(hex)} />
                ))}
              </View>
              {hueGrid.map((row, i) => (
                <View key={i} style={styles.gridRow}>
                  {row.map((hex, j) => (
                    <Swatch key={`${i}-${j}`} hex={hex} selected={hex === draftHex} onPress={() => applyColor(hex)} />
                  ))}
                </View>
              ))}
            </View>
          )}

          {tab === 'spectrum' && (
            <View
              style={styles.spectrumBox}
              onLayout={handleSpectrumLayout}
              {...panResponder.panHandlers}
            >
              {spectrumBoxWidth > 0 && (
                <Svg width={spectrumBoxWidth} height={SPECTRUM_HEIGHT} style={StyleSheet.absoluteFill}>
                  <Defs>
                    <LinearGradient id="hueGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#FF0000" />
                      <Stop offset="0.1667" stopColor="#FFFF00" />
                      <Stop offset="0.3333" stopColor="#00FF00" />
                      <Stop offset="0.5" stopColor="#00FFFF" />
                      <Stop offset="0.6667" stopColor="#0000FF" />
                      <Stop offset="0.8333" stopColor="#FF00FF" />
                      <Stop offset="1" stopColor="#FF0000" />
                    </LinearGradient>
                    <LinearGradient id="shadeGrad" x1="0" y1="0" x2="1" y2="0">
                      <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
                      <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
                      <Stop offset="1" stopColor="#000000" stopOpacity={1} />
                    </LinearGradient>
                  </Defs>
                  <Rect x={0} y={0} width={spectrumBoxWidth} height={SPECTRUM_HEIGHT} fill="url(#hueGrad)" />
                  <Rect x={0} y={0} width={spectrumBoxWidth} height={SPECTRUM_HEIGHT} fill="url(#shadeGrad)" />
                </Svg>
              )}
              <View
                pointerEvents="none"
                style={[
                  styles.spectrumIndicator,
                  { left: indicatorX - 12, top: indicatorY - 12, backgroundColor: draftHex },
                ]}
              />
            </View>
          )}

          {tab === 'controls' && (
            <View style={styles.controlsBox}>
              <RgbSlider
                label="VERMELHO"
                value={rgb.r}
                trackColor={colors.danger}
                onValueChange={(v) => updateFromRgb({ ...rgb, r: v })}
              />
              <RgbSlider
                label="VERDE"
                value={rgb.g}
                trackColor={colors.success}
                onValueChange={(v) => updateFromRgb({ ...rgb, g: v })}
              />
              <RgbSlider
                label="AZUL"
                value={rgb.b}
                trackColor={colors.info}
                onValueChange={(v) => updateFromRgb({ ...rgb, b: v })}
              />

              <Text style={styles.hexLabel}>Código hexadecimal</Text>
              <View style={styles.hexInputRow}>
                <Text style={styles.hexHash}>#</Text>
                <TextInput
                  value={hexInput}
                  onChangeText={handleHexInputChange}
                  placeholder="16A34A"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  style={styles.hexInput}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Text style={[styles.tabButtonText, active && styles.tabButtonTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Swatch({ hex, selected, onPress }: { hex: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.swatch, { backgroundColor: hex }]} onPress={onPress}>
      {selected && <Check size={14} color={isLightColor(hex) ? colors.textPrimary : colors.textInverse} />}
    </TouchableOpacity>
  );
}

function RgbSlider({
  label,
  value,
  trackColor,
  onValueChange,
}: {
  label: string;
  value: number;
  trackColor: string;
  onValueChange: (value: number) => void;
}) {
  return (
    <View style={styles.sliderGroup}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{Math.round(value)}</Text>
      </View>
      <Slider
        minimumValue={0}
        maximumValue={255}
        step={1}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor={trackColor}
        maximumTrackTintColor={colors.border}
        thumbTintColor={trackColor}
      />
    </View>
  );
}

function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  // luminância perceptual aproximada — decide se o check precisa ser escuro
  // ou claro pra continuar legível em cima da cor do swatch
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 170;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '85%',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  confirmButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRow: { alignItems: 'center', marginBottom: spacing.lg },
  previewSwatch: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  previewHex: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.semibold },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: spacing.lg,
  },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  tabButtonActive: { backgroundColor: colors.primary },
  tabButtonText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  tabButtonTextActive: { color: colors.textInverse },
  gridRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  swatch: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  spectrumBox: {
    height: SPECTRUM_HEIGHT,
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  spectrumIndicator: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  controlsBox: { paddingTop: spacing.xs },
  sliderGroup: { marginBottom: spacing.md },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  sliderLabel: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: fontWeight.semibold },
  sliderValue: { fontSize: fontSize.xs, color: colors.textPrimary, fontWeight: fontWeight.semibold },
  hexLabel: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.sm },
  hexInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
  },
  hexHash: { fontSize: fontSize.base, color: colors.textSecondary, marginRight: 2 },
  hexInput: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary, letterSpacing: 1 },
});