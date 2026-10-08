// src/components/ui/CurrencyField.tsx
import React from 'react';
import { TextField } from './TextField';

interface CurrencyFieldProps {
  label: string;
  value?: string; // dígitos brutos (sem formatação) — "12000" representa R$ 120,00
  onChangeText: (digits: string) => void;
  onBlur?: () => void;
  error?: string;
  placeholder?: string;
  // false quando o valor é calculado automaticamente (horas × valor/hora do
  // hospital) — o campo vira só visualização, sem digitação manual
  editable?: boolean;
}

// Converte dígitos brutos em "R$ 1.234,56", tratando os 2 últimos dígitos
// como centavos — mesmo comportamento de campo de valor usado em apps como
// Nubank/PicPay: você digita e o valor "empurra" da direita pra esquerda.
function formatCentsToBRL(digitsOnly: string): string {
  if (!digitsOnly) return '';
  const cents = digitsOnly.padStart(3, '0');
  const reaisPart = cents.slice(0, -2);
  const centavosPart = cents.slice(-2);
  const reaisFormatted = new Intl.NumberFormat('pt-BR').format(Number(reaisPart));
  return `R$ ${reaisFormatted},${centavosPart}`;
}

export function CurrencyField({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  placeholder,
  editable = true,
}: CurrencyFieldProps) {
  return (
    <TextField
      label={label}
      placeholder={placeholder ?? 'R$ 0,00'}
      keyboardType="number-pad"
      value={formatCentsToBRL(value ?? '')}
      onChangeText={(text) => onChangeText(text.replace(/\D/g, ''))}
      onBlur={onBlur}
      error={error}
      editable={editable}
    />
  );
}