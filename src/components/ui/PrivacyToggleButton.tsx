import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { usePrivacy } from '@/context/PrivacyContext';
import { colors, radius } from '@/theme/tokens';

interface PrivacyToggleButtonProps {
  /**
   * 'pill': Botón con icono + texto ("Ocultar" / "Privado") + indicador luminoso.
   * 'icon': Botón compacto solo con el icono (para cabeceras estrechas o móviles).
   */
  variant?: 'pill' | 'icon';
  style?: ViewStyle;
}

export function PrivacyToggleButton({ variant = 'pill', style }: PrivacyToggleButtonProps) {
  const { isPrivacyEnabled, togglePrivacy } = usePrivacy();

  if (variant === 'icon') {
    return (
      <Pressable
        onPress={togglePrivacy}
        style={({ pressed }) => [
          styles.iconBtn,
          isPrivacyEnabled && styles.iconBtnActive,
          pressed && styles.btnPressed,
          style,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          isPrivacyEnabled
            ? 'Modo Privado activado. Presiona para mostrar montos en pantalla'
            : 'Modo Privado desactivado. Presiona para ocultar montos y activar Camouflage'
        }
      >
        {isPrivacyEnabled ? (
          <EyeOff size={15} color="#34D399" />
        ) : (
          <Eye size={15} color={colors.textSecondary} />
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={togglePrivacy}
      style={({ pressed }) => [
        styles.pillBtn,
        isPrivacyEnabled && styles.pillBtnActive,
        pressed && styles.btnPressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={
        isPrivacyEnabled
          ? 'Modo Privado activado. Presiona para mostrar montos'
          : 'Modo Privado desactivado. Presiona para ocultar montos'
      }
    >
      <View style={styles.iconWrap}>
        {isPrivacyEnabled ? (
          <EyeOff size={14} color="#34D399" />
        ) : (
          <Eye size={14} color={colors.textSecondary} />
        )}
      </View>
      <Text
        style={[
          styles.pillText,
          isPrivacyEnabled && styles.pillTextActive,
        ]}
      >
        {isPrivacyEnabled ? 'Privado' : 'Ocultar'}
      </Text>
      {isPrivacyEnabled ? <View style={styles.activeDot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pillBtnActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderColor: 'rgba(52, 211, 153, 0.38)',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  iconBtnActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderColor: 'rgba(52, 211, 153, 0.38)',
  },
  btnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  pillTextActive: {
    color: '#34D399',
    fontWeight: '700',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
});
