// src/utils/responsive.ts
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Largura de referência usada como base do design (mockup pensado pra um iPhone padrão)
const BASE_WIDTH = 390;

export const screenWidth = width;
export const screenHeight = height;

// true a partir de ~768px de largura (iPads em retrato, tablets Android grandes)
export const isTablet = width >= 768;

/**
 * Escala um tamanho (fonte, ícone, espaçamento) proporcionalmente à largura
 * da tela atual, com um fator de moderação pra não ficar gigante em tablet
 * nem minúsculo em telas pequenas. factor 0 = tamanho fixo, 1 = escala total.
 */
export function moderateScale(size: number, factor = 0.5): number {
  const scale = width / BASE_WIDTH;
  return size + (size * scale - size) * factor;
}