import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { GlassInput } from '@/components/ui/GlassInput';
import { TeslaButton } from '@/components/ui/TeslaButton';
import { loginUser } from '@/lib/api';
import { colors, radius } from '@/theme/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      await loginUser(email, password);
      router.replace('/(main)/dashboard');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'No se pudo iniciar sesión.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer maxWidth={440}>
      <View style={styles.heroShell}>
        <View style={styles.backdropSvgWrap} pointerEvents="none">
          <Svg width="100%" height="100%" viewBox="0 0 400 320" preserveAspectRatio="none">
            <Defs>
              <RadialGradient id="loginBlueGlow" cx="55%" cy="28%" rx="62%" ry="58%">
                <Stop offset="0%" stopColor="#3B82F6" stopOpacity="0.30" />
                <Stop offset="50%" stopColor="#2563EB" stopOpacity="0.12" />
                <Stop offset="100%" stopColor="#090D16" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="loginEmeraldGlow" cx="18%" cy="18%" rx="48%" ry="45%">
                <Stop offset="0%" stopColor="#10B981" stopOpacity="0.16" />
                <Stop offset="100%" stopColor="#090D16" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="400" height="320" fill="url(#loginBlueGlow)" />
            <Rect x="0" y="0" width="400" height="320" fill="url(#loginEmeraldGlow)" />
          </Svg>
        </View>

        <View style={styles.brandPill}>
          <Text style={styles.brand}>FinanzApp</Text>
        </View>
        <Text style={styles.title}>Iniciar sesión</Text>
        <Text style={styles.subtitle}>
          Ingresa tus credenciales para acceder a tu panel financiero.
        </Text>

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <GlassInput
          label="Correo electrónico"
          placeholder="tu@correo.cl"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />

        <GlassInput
          label="Contraseña"
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={handleLogin}
        />

        <TeslaButton
          title="Iniciar sesión"
          onPress={handleLogin}
          loading={loading}
          style={styles.loginButton}
        />

        <View style={styles.divider} />

        <Text style={styles.createAccountPrompt}>¿Aún no tienes una cuenta?</Text>
        <TeslaButton
          title="Crear cuenta"
          variant="secondary"
          onPress={() => router.push('/(auth)/register')}
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: colors.obsidianHero,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  backdropSvgWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  brandPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 14,
  },
  brand: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  errorBox: {
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  errorText: {
    color: colors.textPrimary,
    fontSize: 13,
  },
  loginButton: {
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 24,
  },
  createAccountPrompt: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
  },
});
