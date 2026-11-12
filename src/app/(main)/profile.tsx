import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Share2,
  User as UserIcon,
} from 'lucide-react-native';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  AmbientHeroCard,
  FintechCheckIcon,
  FintechCopyIcon,
  FintechLogoutIcon,
} from '@/components/ui/AmbientHeroCard';
import { GlassInput } from '@/components/ui/GlassInput';
import { TeslaButton } from '@/components/ui/TeslaButton';
import { useResponsive } from '@/hooks/useResponsive';
import {
  getCurrentUser,
  logoutUser,
  updateUserProfile,
  User,
} from '@/lib/api';
import { colors, radius } from '@/theme/tokens';

export default function ProfileScreen() {
  const router = useRouter();
  const { isMobile } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Estado formulario Datos Personales (Nombre y Correo)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoSuccess, setInfoSuccess] = useState<string | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);

  // Estado formulario Contraseña
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [loggingOut, setLoggingOut] = useState(false);
  const [idCopied, setIdCopied] = useState(false);

  const handleCopyId = async () => {
    if (!user?.id) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(user.id);
      }
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2500);
    } catch {
      setIdCopied(true);
      setTimeout(() => setIdCopied(false), 2500);
    }
  };

  useEffect(() => {
    let active = true;

    getCurrentUser()
      .then((currentUser) => {
        if (!active) return;
        if (!currentUser) {
          router.replace('/(auth)/login');
          return;
        }
        setUser(currentUser);
        setName(currentUser.name);
        setEmail(currentUser.email);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  const handleSavePersonalInfo = async () => {
    setInfoError(null);
    setInfoSuccess(null);

    if (!name.trim()) {
      setInfoError('El nombre no puede estar vacío.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setInfoError('Ingresa un correo electrónico válido.');
      return;
    }

    setSavingInfo(true);
    try {
      const updated = await updateUserProfile({
        name: name.trim(),
        email: email.trim().toLowerCase(),
      });
      setUser(updated);
      setName(updated.name);
      setEmail(updated.email);
      setInfoSuccess('Nombre y correo electrónico actualizados correctamente.');
    } catch (err) {
      setInfoError(
        err instanceof Error ? err.message : 'Error al actualizar los datos.'
      );
    } finally {
      setSavingInfo(false);
    }
  };

  const handleSavePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Ingresa tu contraseña actual.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('La confirmación de contraseña no coincide.');
      return;
    }

    setSavingPassword(true);
    try {
      await updateUserProfile({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Contraseña actualizada con éxito.');
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : 'Error al cambiar la contraseña.'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
      router.replace('/');
    } finally {
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer centered={false} maxWidth={740}>
        <View style={styles.loader}>
          <ActivityIndicator color={colors.textPrimary} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  const initials = (user?.name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <ScreenContainer centered={false} maxWidth={740}>
      <View style={styles.pageStack}>
        {/* Hero Ambiental del Perfil */}
        <AmbientHeroCard
          capsuleLabel={`Configuración de Cuenta · ${user?.currency || 'CLP'}`}
          capsuleIcon={
            initials ? (
              <Text style={styles.capsuleInitials}>{initials}</Text>
            ) : (
              <UserIcon size={13} color="#FFFFFF" />
            )
          }
          flameCount={1}
          ringPercent={100}
          eyebrowLabel="Perfil sincronizado y activo"
          badgeText={`${user?.currency || 'CLP'} · Activo`}
          badgeArrow="↑"
          heroValue={user?.name || 'Usuario'}
          subtitle={`${user?.email || ''} · ID: ${(user?.id || '').slice(0, 12)}...`}
          actions={[
            {
              id: 'copy-id',
              label: idCopied ? 'Copiado' : 'Copiar ID',
              icon: <FintechCopyIcon active={idCopied} />,
              onPress: handleCopyId,
              active: idCopied,
            },
            {
              id: 'save-info',
              label: savingInfo ? 'Guardando' : 'Guardar',
              icon: <FintechCheckIcon />,
              onPress: handleSavePersonalInfo,
              disabled: savingInfo,
            },
            {
              id: 'logout',
              label: 'Salir',
              icon: <FintechLogoutIcon />,
              onPress: handleLogout,
            },
          ]}
        />

        {/* Tarjeta de ID de Usuario para Compartir */}
        <GlassCard>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBox}>
              <Share2 size={16} color="#34D399" />
            </View>
            <View style={styles.sectionTitleCol}>
              <Text style={styles.sectionTitle}>Tu ID de Usuario (Ahorro Compartido)</Text>
              <Text style={styles.sectionSubtitle}>
                Comparte este código con tu pareja para que pueda vincularte a sus cuentas de ahorro y verlas juntos en tiempo real.
              </Text>
            </View>
          </View>

          <View style={styles.userIdContainer}>
            <View style={styles.userIdBox}>
              <Text style={styles.userIdLabel}>CÓDIGO ÚNICO DE TU CUENTA</Text>
              <Text selectable style={styles.userIdValue}>
                {user?.id}
              </Text>
            </View>
            <Pressable
              onPress={handleCopyId}
              style={({ pressed }) => [
                styles.copyIdBtn,
                idCopied && styles.copyIdBtnActive,
                pressed && styles.pressed,
              ]}
            >
              {idCopied ? (
                <>
                  <Check size={14} color="#34D399" />
                  <Text style={styles.copyIdBtnTextActive}>¡Copiado!</Text>
                </>
              ) : (
                <>
                  <Copy size={14} color={colors.textPrimary} />
                  <Text style={styles.copyIdBtnText}>Copiar ID</Text>
                </>
              )}
            </Pressable>
          </View>
        </GlassCard>

        {/* Sección 1: Modificar Nombre y Correo Electrónico */}
        <GlassCard>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBox}>
              <UserIcon size={16} color={colors.textPrimary} />
            </View>
            <View style={styles.sectionTitleCol}>
              <Text style={styles.sectionTitle}>Datos Personales</Text>
              <Text style={styles.sectionSubtitle}>
                Modifica tu nombre visible y tu correo electrónico de acceso.
              </Text>
            </View>
          </View>

          <View style={[styles.formGrid, isMobile && styles.formGridMobile]}>
            <View style={styles.formCol}>
              <GlassInput
                label="Nombre Completo"
                placeholder="Tu nombre"
                value={name}
                onChangeText={setName}
              />
            </View>
            <View style={styles.formCol}>
              <GlassInput
                label="Correo Electrónico"
                placeholder="tu@correo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          {infoError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{infoError}</Text>
            </View>
          ) : null}

          {infoSuccess ? (
            <View style={styles.successBanner}>
              <CheckCircle2 size={15} color="#34D399" />
              <Text style={styles.successBannerText}>{infoSuccess}</Text>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <TeslaButton
              title="Guardar Nombre y Correo"
              onPress={handleSavePersonalInfo}
              loading={savingInfo}
            />
          </View>
        </GlassCard>

        {/* Sección 2: Modificar Contraseña */}
        <GlassCard>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBox}>
              <KeyRound size={16} color={colors.textPrimary} />
            </View>
            <View style={styles.sectionTitleCol}>
              <Text style={styles.sectionTitle}>Seguridad y Contraseña</Text>
              <Text style={styles.sectionSubtitle}>
                Actualiza tu contraseña de acceso (mínimo 6 caracteres).
              </Text>
            </View>

            <Pressable
              onPress={() => setShowPasswords((prev) => !prev)}
              style={styles.toggleVisibilityBtn}
            >
              {showPasswords ? (
                <EyeOff size={14} color={colors.textSecondary} />
              ) : (
                <Eye size={14} color={colors.textSecondary} />
              )}
              <Text style={styles.toggleVisibilityText}>
                {showPasswords ? 'Ocultar' : 'Mostrar'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.passwordFieldsStack}>
            <GlassInput
              label="Contraseña Actual"
              placeholder="Ingresa tu contraseña actual"
              secureTextEntry={!showPasswords}
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />

            <View style={[styles.formGrid, isMobile && styles.formGridMobile]}>
              <View style={styles.formCol}>
                <GlassInput
                  label="Nueva Contraseña"
                  placeholder="Mínimo 6 caracteres"
                  secureTextEntry={!showPasswords}
                  value={newPassword}
                  onChangeText={setNewPassword}
                />
              </View>
              <View style={styles.formCol}>
                <GlassInput
                  label="Confirmar Nueva Contraseña"
                  placeholder="Repite la nueva contraseña"
                  secureTextEntry={!showPasswords}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>
            </View>
          </View>

          {passwordError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{passwordError}</Text>
            </View>
          ) : null}

          {passwordSuccess ? (
            <View style={styles.successBanner}>
              <CheckCircle2 size={15} color="#34D399" />
              <Text style={styles.successBannerText}>{passwordSuccess}</Text>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <TeslaButton
              title="Actualizar Contraseña"
              onPress={handleSavePassword}
              loading={savingPassword}
            />
          </View>
        </GlassCard>

        {/* Sección 3: Cerrar Sesión */}
        <GlassCard>
          <View style={styles.logoutRow}>
            <View style={styles.logoutTextCol}>
              <View style={styles.logoutTitleRow}>
                <LogOut size={16} color={colors.textPrimary} />
                <Text style={styles.sectionTitle}>Cerrar Sesión en este Dispositivo</Text>
              </View>
              <Text style={styles.sectionSubtitle}>
                Tus cuentas, gastos fijos y pronósticos quedan respaldados de forma segura en la nube.
              </Text>
            </View>

            <TeslaButton
              title="Cerrar Sesión"
              variant="secondary"
              onPress={handleLogout}
              loading={loggingOut}
            />
          </View>
        </GlassCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loader: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  pageStack: {
    width: '100%',
    alignSelf: 'stretch',
    flexGrow: 1,
    gap: 14,
    paddingBottom: 40,
  },
  capsuleInitials: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.bentoBorder,
    backgroundColor: colors.bentoCardElevated,
  },
  sectionTitleCol: {
    flex: 1,
    gap: 3,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  toggleVisibilityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  toggleVisibilityText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  formGrid: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  formGridMobile: {
    flexDirection: 'column',
  },
  formCol: {
    flex: 1,
    width: '100%',
  },
  passwordFieldsStack: {
    width: '100%',
    gap: 12,
  },
  errorBanner: {
    width: '100%',
    marginTop: 14,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.45)',
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
  },
  errorBannerText: {
    color: '#F87171',
    fontSize: 12,
    fontWeight: '600',
  },
  successBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.45)',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  successBannerText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  actionsRow: {
    width: '100%',
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  logoutRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  logoutTextCol: {
    flex: 1,
    minWidth: 220,
    gap: 6,
  },
  logoutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userIdContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    backgroundColor: colors.bentoCard,
    marginTop: 8,
  },
  userIdBox: {
    flex: 1,
    minWidth: 200,
    gap: 4,
  },
  userIdLabel: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  userIdValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  copyIdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderFocused,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  copyIdBtnActive: {
    borderColor: 'rgba(52, 211, 153, 0.5)',
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  copyIdBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  copyIdBtnTextActive: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
});
