import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TeslaButton } from '@/components/ui/TeslaButton';
import { colors } from '@/theme/tokens';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScreenContainer maxWidth={440}>
      <View style={styles.heroShell}>
        <View style={styles.backdropSvgWrap} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 400 320" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="homeBlueGlow" cx="55%" cy="32%" rx="62%" ry="58%">
                <Stop offset="0%" stopColor="#3B82F6" stopOpacity="0.34" />
                <Stop offset="50%" stopColor="#2563EB" stopOpacity="0.14" />
                <Stop offset="100%" stopColor="#090D16" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="homeEmeraldGlow" cx="20%" cy="20%" rx="48%" ry="45%">
                <Stop offset="0%" stopColor="#10B981" stopOpacity="0.18" />
                <Stop offset="100%" stopColor="#090D16" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="400" height="320" fill="url(#homeBlueGlow)" />
            <Rect x="0" y="0" width="400" height="320" fill="url(#homeEmeraldGlow)" />
          </Svg>
        </View>

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
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroShell: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: colors.obsidianHero,
    paddingHorizontal: 26,
    paddingVertical: 30,
  },
  backdropSvgWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
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
