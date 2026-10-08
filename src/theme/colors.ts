// src/theme/colors.ts
export const colors = {
  // Marca
  primary: '#16A34A',
  primaryDark: '#0F1B33', // navy usado na splash e em headers escuros
  primaryLight: '#DCFCE7',

  // Superfícies
  background: '#F5F7FA',
  surface: '#FFFFFF',
  border: '#E5E7EB',

  // Texto
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textInverse: '#FFFFFF',

  // Estados
  success: '#16A34A',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  danger: '#EF4444',
  info: '#3B82F6',

  // Cinza neutro pra marcar um plantão repassado a outro colega — de
  // propósito diferente de `border`/`background`, pra não sumir no fundo
  passed: '#D1D5DB',
  passedLight: '#F3F4F6', // fundo claro do badge "Passado" (mesmo padrão de primaryLight/warningLight)
};

// Paleta sugerida para o usuário escolher a cor de cada hospital
// (mesma ideia das bolinhas coloridas na tela "Meus Hospitais")
export const hospitalColorPalette = [
  '#EF4444', // vermelho
  '#3B82F6', // azul
  '#8B5CF6', // roxo
  '#F97316', // laranja
  '#22C55E', // verde
  '#EAB308', // amarelo
  '#14B8A6', // teal
  '#6B7280', // cinza (ex.: "Extra")
];