// src/components/PaymentShiftRow.tsx
//
// Linha de plantão usada nas telas de pagamento (plantões do local e
// atrasados): data, subtítulo, valor e um botão redondo pra marcar como
// pago / desmarcar sem precisar abrir o plantão.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { formatCurrency } from '../utils/currency';
import { colors, spacing, radius, fontSize, fontWeight } from '../theme';

type Props = {
  title: string;
  subtitle: string;
  subtitleColor?: string;
  value: number;
  paid: boolean;
  onToggle: () => void;
  onPress: () => void;
};

export function PaymentShiftRow({ title, subtitle, subtitleColor, value, paid, onToggle, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.info}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.subtitle, !!subtitleColor && { color: subtitleColor }]}>{subtitle}</Text>
      </View>
      <Text style={styles.value}>{formatCurrency(value)}</Text>
      <TouchableOpacity
        style={[styles.check, paid && styles.checkActive]}
        onPress={onToggle}
        hitSlop={8}
        accessibilityLabel={paid ? 'Desmarcar como pago' : 'Marcar como pago'}
      >
        {paid && <Check size={16} color={colors.textInverse} />}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  info: { flex: 1 },
  title: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  subtitle: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  value: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.textPrimary },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});
