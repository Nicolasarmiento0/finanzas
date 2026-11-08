import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Href, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LayoutDashboard,
  Lightbulb,
  LogOut,
  LucideIcon,
  User,
} from 'lucide-react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { FinanzAIAssistantModal } from '@/components/finance/FinanzAIAssistantModal';
import { FinanzAITriggerButton } from '@/components/ui/FinanzAITriggerButton';
import { PrivacyToggleButton } from '@/components/ui/PrivacyToggleButton';
import { usePrivacy } from '@/context/PrivacyContext';
import { logoutUser } from '@/lib/api';
import { colors, radius } from '@/theme/tokens';

export interface NavItem {
  key: string;
  label: string;
  href: Href;
  matchPath: string;
  icon: LucideIcon;
}

// Lista extensible de secciones principales
export const NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/(main)/dashboard',
    matchPath: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    key: 'tips',
    label: 'Consejos',
    href: '/(main)/tips',
    matchPath: '/tips',
    icon: Lightbulb,
  },
  {
    key: 'profile',
    label: 'Perfil',
    href: '/(main)/profile',
    matchPath: '/profile',
    icon: User,
  },
];

interface AdaptiveNavigationProps {
  children: React.ReactNode;
}

export function AdaptiveNavigation({ children }: AdaptiveNavigationProps) {
  const { isDesktop } = useResponsive();
  const { isPrivacyEnabled } = usePrivacy();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    await logoutUser();
    router.replace('/');
  };

  if (isDesktop) {
    return (
      <View style={styles.desktopRoot}>
        {/* Sidebar izquierdo estilo Consola Tesla + Liquid Glass */}
        <View style={styles.sidebarWrapper}>
          <BlurView intensity={35} tint="dark" style={styles.sidebarBlur}>
            <View style={styles.sidebarInner}>
              {/* Cabecera de Marca */}
              <View style={styles.brandSection}>
                <Text style={styles.brandTitle}>FinanzApp</Text>
                <View style={styles.brandBadge}>
                  <Text style={styles.brandBadgeText}>CLP</Text>
                </View>
              </View>

              <View style={styles.sidebarDivider} />

              {/* Secciones de Navegación */}
              <View style={styles.navList}>
                <Text style={styles.navSectionLabel}>MENÚ</Text>
                {NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.matchPath || pathname.startsWith(item.matchPath);
                  const IconComponent = item.icon;

                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => router.push(item.href)}
                      style={({ pressed }) => [
                        styles.sidebarItem,
                        isActive && styles.sidebarItemActive,
                        pressed && styles.itemPressed,
                      ]}
                    >
                      <IconComponent
                        size={18}
                        color={isActive ? colors.buttonPrimaryText : colors.textSecondary}
                        strokeWidth={2}
                      />
                      <Text
                        style={[
                          styles.sidebarItemText,
                          isActive && styles.sidebarItemTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}

                {/* Acceso Directo al Asistente Cuantitativo */}
                <FinanzAITriggerButton variant="sidebar" />
              </View>

              {/* Pie del Sidebar: Modo Privado y Cerrar sesión */}
              <View style={styles.sidebarFooter}>
                <View style={styles.sidebarDivider} />
                <PrivacyToggleButton style={{ marginBottom: 12, width: '100%', justifyContent: 'center' }} />
                <Pressable
                  onPress={handleLogout}
                  style={({ pressed }) => [
                    styles.sidebarLogoutButton,
                    pressed && styles.itemPressed,
                  ]}
                >
                  <LogOut size={18} color={colors.textSecondary} strokeWidth={2} />
                  <Text style={styles.sidebarLogoutText}>Cerrar sesión</Text>
                </Pressable>
              </View>
            </View>
          </BlurView>
        </View>

        {/* Área de Contenido Principal */}
        <View style={styles.desktopContent}>{children}</View>

        {/* Modal Universal Asistente Rápido FinanzAI */}
        <FinanzAIAssistantModal />
      </View>
    );
  }

  // Vista Móvil (Android / iOS / Web pequeña): Barra inferior flotante estilo iOS Liquid Glass
  return (
    <View style={styles.mobileRoot}>
      <View style={styles.mobileContent}>{children}</View>

      {/* Botón Flotante Global Asistente FinanzAI */}
      <FinanzAITriggerButton variant="fab" />

      {/* Modal Universal Asistente Rápido FinanzAI */}
      <FinanzAIAssistantModal />

      <View
        style={[
          styles.bottomBarContainer,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <View style={styles.bottomBarOuter}>
          <BlurView intensity={45} tint="dark" style={styles.bottomBarBlur}>
            <View style={styles.bottomBarInner}>
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.matchPath || pathname.startsWith(item.matchPath);
                const IconComponent = item.icon;

                return (
                  <Pressable
                    key={item.key}
                    onPress={() => router.push(item.href)}
                    style={({ pressed }) => [
                      styles.bottomBarItem,
                      isActive && styles.bottomBarItemActive,
                      pressed && styles.itemPressed,
                    ]}
                  >
                    <IconComponent
                      size={17}
                      color={isActive ? colors.buttonPrimaryText : colors.textSecondary}
                      strokeWidth={2}
                    />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.bottomBarText,
                        isActive && styles.bottomBarTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </BlurView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Desktop / Tablet (Tesla Console Sidebar)
  desktopRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  sidebarWrapper: {
    width: 260,
    borderRightWidth: 1,
    borderRightColor: colors.glassBorder,
    backgroundColor: colors.glassSurface,
  },
  sidebarBlur: {
    flex: 1,
  },
  sidebarInner: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 28,
    justifyContent: 'space-between',
  },
  brandSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  brandTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  brandBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  brandBadgeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 20,
  },
  navList: {
    flex: 1,
    gap: 6,
  },
  navSectionLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: radius.md,
  },
  sidebarItemActive: {
    backgroundColor: colors.buttonPrimaryBg,
  },
  sidebarItemText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  sidebarItemTextActive: {
    color: colors.buttonPrimaryText,
  },
  sidebarFooter: {
    width: '100%',
  },
  sidebarLogoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  sidebarLogoutText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  desktopContent: {
    flex: 1,
    width: '100%',
    height: '100%',
  },

  // Mobile (iOS Liquid Glass Floating Bottom Bar)
  mobileRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: colors.background,
  },
  mobileContent: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  bottomBarContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  bottomBarOuter: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'rgba(12, 12, 14, 0.72)',
  },
  bottomBarBlur: {
    width: '100%',
  },
  bottomBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 6,
  },
  bottomBarItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
  },
  bottomBarItemActive: {
    backgroundColor: colors.buttonPrimaryBg,
  },
  bottomBarText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  bottomBarTextActive: {
    color: colors.buttonPrimaryText,
  },
  bottomBarVerticalDivider: {
    width: 1,
    height: 22,
    backgroundColor: colors.divider,
    marginHorizontal: 6,
  },
  itemPressed: {
    opacity: 0.8,
  },
});
