import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useFinanzAI } from '@/context/FinanzAIContext';
import { colors, radius } from '@/theme/tokens';

const EMERALD = '#34D399';

interface FinanzAITriggerButtonProps {
  variant?: 'fab' | 'inline' | 'sidebar';
  style?: ViewStyle;
  label?: string;
  initialQuery?: string;
}

export function FinanzAITriggerButton({
  variant = 'fab',
  style,
  label = 'Preguntar a FinanzAI',
  initialQuery,
}: FinanzAITriggerButtonProps) {
  const { openFinanzAI } = useFinanzAI();

  const handlePress = () => {
    openFinanzAI(initialQuery);
  };

  if (variant === 'sidebar') {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.sidebarButton,
          pressed && styles.buttonPressed,
          style,
        ]}
      >
        <View style={styles.sidebarIconBox}>
          <Sparkles size={16} color={EMERALD} />
        </View>
        <View style={styles.sidebarTextCol}>
          <Text style={styles.sidebarTitle}>FinanzAI</Text>
          <Text style={styles.sidebarSub}>Asistente Cuantitativo</Text>
        </View>
      </Pressable>
    );
  }

  if (variant === 'inline') {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.inlineButton,
          pressed && styles.buttonPressed,
          style,
        ]}
      >
        <Sparkles size={14} color={EMERALD} />
        <Text style={styles.inlineText}>{label}</Text>
      </Pressable>
    );
  }

  // Variant 'fab' (Floating Action Button para móviles y pantallas táctiles)
  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.fabButton,
        pressed && styles.buttonPressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Abrir Asistente Rápido FinanzAI"
    >
      <View style={styles.fabInner}>
        <Sparkles size={18} color="#050505" strokeWidth={2.5} />
        <Text style={styles.fabText}>FinanzAI</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  // FAB
  fabButton: {
    position: 'absolute',
    bottom: 84, // Por encima de la barra inferior móvil
    right: 18,
    borderRadius: radius.pill,
    backgroundColor: EMERALD,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: EMERALD,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 99,
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fabText: {
    color: '#050505',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  // Inline
  inlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    flexShrink: 0,
  },
  inlineText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  // Sidebar
  sidebarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: 'rgba(52, 211, 153, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.22)',
    marginVertical: 8,
  },
  sidebarIconBox: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(52, 211, 153, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarTextCol: {
    flex: 1,
  },
  sidebarTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  sidebarSub: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '500',
  },
});
