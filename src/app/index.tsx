import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import { TeslaButton } from '@/components/ui/TeslaButton';
import { colors } from '@/theme/tokens';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <GlassCard style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>PERSONAL FINANCE</Text>
        </View>

        <Text style={styles.title}>FinanzApp</Text>
        <Text style={styles.subtitle}>
          Claridad y control absoluto sobre tus finanzas personales.
        </Text>

        <View style={styles.divider} />

        <TeslaButton
          title="Comenzar"
          onPress={() => router.push('/(auth)/login')}
          style={styles.button}
        />
      </GlassCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 24,
  },
  badgeText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.6,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 28,
  },
  button: {
    width: '100%',
  },
});
