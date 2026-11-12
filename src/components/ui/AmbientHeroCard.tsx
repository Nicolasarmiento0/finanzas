import React, { useId } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme/tokens';

// ============================================================================
// ICONOS VECTORIALES FINTECH A MEDIDA (ESTILO DUOTONO / SQUIRCLE FINO)
// ============================================================================

interface FintechIconProps {
  active?: boolean;
  size?: number;
}

/** Icono "+" de trazo geométrico fino (como "Add" en la referencia) */
export function FintechAddIcon({ active = false, size = 19 }: FintechIconProps) {
  const stroke = active ? '#0F172A' : '#FFFFFF';
  const glow = active ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.14)';
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Circle cx="10" cy="10" r="7.5" fill={glow} />
      <Line
        x1="10"
        y1="5.2"
        x2="10"
        y2="14.8"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Line
        x1="5.2"
        y1="10"
        x2="14.8"
        y2="10"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Icono de Banderín / Meta ("Goals" en la referencia) */
export function FintechGoalsIcon({ active = false, size = 19 }: FintechIconProps) {
  const stroke = active ? '#0F172A' : '#FFFFFF';
  const fill = active ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.18)';
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M5.5 4.2H14.8L12.7 7.6L14.8 11H5.5V4.2Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="5.5"
        y1="3.6"
        x2="5.5"
        y2="16.4"
        stroke={stroke}
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Icono Squircle con Barras de Analítica ("Analytics" en la referencia) */
export function FintechAnalyticsIcon({
  active = false,
  size = 19,
}: FintechIconProps) {
  const stroke = active ? '#0F172A' : '#FFFFFF';
  const fill = active ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.15)';
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Rect
        x="3.2"
        y="3.2"
        width="13.6"
        height="13.6"
        rx="4.2"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.6"
      />
      <Line
        x1="7.2"
        y1="12.8"
        x2="7.2"
        y2="9.6"
        stroke={stroke}
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <Line
        x1="10"
        y1="12.8"
        x2="10"
        y2="7.2"
        stroke={stroke}
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <Line
        x1="12.8"
        y1="12.8"
        x2="12.8"
        y2="10.6"
        stroke={stroke}
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Icono Destello IA / Consejos / Optimización */
export function FintechSparklesIcon({
  active = false,
  size = 19,
}: FintechIconProps) {
  const stroke = active ? '#0F172A' : '#FFFFFF';
  const fill = active ? 'rgba(15,23,42,0.16)' : 'rgba(255,255,255,0.2)';
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M9.5 3.2L11.1 7.6L15.5 9.2L11.1 10.8L9.5 15.2L7.9 10.8L3.5 9.2L7.9 7.6L9.5 3.2Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <Path
        d="M15.4 13.2L16.1 15L17.9 15.7L16.1 16.4L15.4 18.2L14.7 16.4L12.9 15.7L14.7 15L15.4 13.2Z"
        fill={stroke}
      />
    </Svg>
  );
}

/** Icono Reporte / Exportar Hoja Financiera (Squircle con flecha fina) */
export function FintechExportIcon({
  active = false,
  size = 19,
}: FintechIconProps) {
  const stroke = active ? '#0F172A' : '#FFFFFF';
  const fill = active ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.15)';
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Rect
        x="3.2"
        y="3.2"
        width="13.6"
        height="13.6"
        rx="4.2"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.6"
      />
      <Path
        d="M10 6.5V11.8M10 11.8L7.6 9.5M10 11.8L12.4 9.5"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1="6.8"
        y1="13.8"
        x2="13.2"
        y2="13.8"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Icono Perfil / Cuenta en Squircle Duotono */
export function FintechProfileIcon({
  active = false,
  size = 19,
}: FintechIconProps) {
  const stroke = active ? '#0F172A' : '#FFFFFF';
  const fill = active ? 'rgba(15,23,42,0.15)' : 'rgba(255,255,255,0.16)';
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Rect
        x="3.2"
        y="3.2"
        width="13.6"
        height="13.6"
        rx="4.5"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.55"
      />
      <Circle
        cx="10"
        cy="8.2"
        r="2.2"
        stroke={stroke}
        strokeWidth="1.5"
      />
      <Path
        d="M6.3 14.3C6.9 12.6 8.3 11.8 10 11.8C11.7 11.8 13.1 12.6 13.7 14.3"
        stroke={stroke}
        strokeWidth="1.55"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Icono Billetera / Cuentas en Duotono */
export function FintechWalletIcon({
  active = false,
  size = 19,
}: FintechIconProps) {
  const stroke = active ? '#0F172A' : '#FFFFFF';
  const fill = active ? 'rgba(15,23,42,0.15)' : 'rgba(255,255,255,0.16)';
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Rect
        x="3"
        y="4.8"
        width="14"
        height="11"
        rx="3.2"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.6"
      />
      <Path
        d="M12.5 8.8H17V11.8H12.5C11.67 11.8 11 11.13 11 10.3C11 9.47 11.67 8.8 12.5 8.8Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.5"
      />
      <Circle cx="13.2" cy="10.3" r="0.8" fill={stroke} />
    </Svg>
  );
}

/** Icono Check / Completado / Guardar en Squircle */
export function FintechCheckIcon({
  active = false,
  size = 19,
}: FintechIconProps) {
  const stroke = active ? '#0F172A' : '#FFFFFF';
  const fill = active ? 'rgba(15,23,42,0.15)' : 'rgba(255,255,255,0.16)';
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Rect
        x="3.2"
        y="3.2"
        width="13.6"
        height="13.6"
        rx="4.2"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.6"
      />
      <Path
        d="M7.2 10.2L9.2 12.2L13.1 8"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Icono Copiar ID / Vincular en Squircle */
export function FintechCopyIcon({
  active = false,
  size = 19,
}: FintechIconProps) {
  const stroke = active ? '#0F172A' : '#FFFFFF';
  const fill = active ? 'rgba(15,23,42,0.15)' : 'rgba(255,255,255,0.16)';
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Rect
        x="6.8"
        y="6.8"
        width="9.4"
        height="9.4"
        rx="2.8"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.55"
      />
      <Path
        d="M13.2 6.8V5.6C13.2 4.38 12.22 3.4 11 3.4H5.6C4.38 3.4 3.4 4.38 3.4 5.6V11C3.4 12.22 4.38 13.2 5.6 13.2H6.8"
        stroke={stroke}
        strokeWidth="1.55"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Icono Salir / Cerrar Sesión en Squircle */
export function FintechLogoutIcon({
  active = false,
  size = 19,
}: FintechIconProps) {
  const stroke = active ? '#0F172A' : '#FFFFFF';
  const fill = active ? 'rgba(15,23,42,0.15)' : 'rgba(255,255,255,0.14)';
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M11 4H6.5C5.12 4 4 5.12 4 6.5V13.5C4 14.88 5.12 16 6.5 16H11"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <Circle cx="11.5" cy="10" r="4.5" fill={fill} />
      <Path
        d="M8.5 10H15.8M15.8 10L13.3 7.6M15.8 10L13.3 12.4"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Icono Bolsa / Carrito de Compras Futuras */
export function FintechCartIcon({
  active = false,
  size = 19,
}: FintechIconProps) {
  const stroke = active ? '#0F172A' : '#FFFFFF';
  const fill = active ? 'rgba(15,23,42,0.15)' : 'rgba(255,255,255,0.16)';
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path
        d="M4.6 7.2H15.4L14.5 15.2C14.38 16.22 13.52 17 12.5 17H7.5C6.48 17 5.62 16.22 5.5 15.2L4.6 7.2Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <Path
        d="M7.6 7.2V5.8C7.6 4.47 8.67 3.4 10 3.4C11.33 3.4 12.4 4.47 12.4 5.8V7.2"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL AMBIENT HERO CARD
// ============================================================================

export interface AmbientHeroAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}

export interface AmbientHeroCardProps {
  capsuleLabel: string;
  capsuleIcon: React.ReactNode;
  onPressCapsule?: () => void;
  onPrevPeriod?: () => void;
  onNextPeriod?: () => void;
  flameCount?: number | string;
  flameAlert?: boolean;
  onPressFlame?: () => void;
  ringPercent: number;
  ringAlert?: boolean;
  eyebrowLabel: string;
  badgeText?: string;
  badgeArrow?: string;
  badgeNegative?: boolean;
  heroValue: string;
  subtitle: string;
  actions: AmbientHeroAction[];
  onPressOrb?: () => void;
  footerContent?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function AmbientHeroCard({
  capsuleLabel,
  capsuleIcon,
  onPressCapsule,
  onPrevPeriod,
  onNextPeriod,
  flameCount = 0,
  flameAlert = false,
  onPressFlame,
  ringPercent,
  ringAlert = false,
  eyebrowLabel,
  badgeText,
  badgeArrow = '↑',
  badgeNegative = false,
  heroValue,
  subtitle,
  actions,
  onPressOrb,
  footerContent,
  style,
}: AmbientHeroCardProps) {
  const { isDesktop } = useResponsive();
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const clampedPercent = Math.max(0, Math.min(100, Math.round(ringPercent || 0)));

  return (
    <View style={[styles.heroAmbientShell, style]}>
      {/* Halo Ambiental Azul/Esmeralda estilo Liquid Glass */}
      <View style={styles.heroBackdropSvgWrap} pointerEvents="none">
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 400 320"
          preserveAspectRatio="none"
        >
          <Defs>
            <RadialGradient
              id={`heroBlueOrbGlow-${rawId}`}
              cx="55%"
              cy="38%"
              rx="62%"
              ry="58%"
            >
              <Stop offset="0%" stopColor="#3B82F6" stopOpacity="0.34" />
              <Stop offset="50%" stopColor="#2563EB" stopOpacity="0.14" />
              <Stop offset="100%" stopColor="#090D16" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient
              id={`heroEmeraldSideGlow-${rawId}`}
              cx="20%"
              cy="20%"
              rx="48%"
              ry="45%"
            >
              <Stop offset="0%" stopColor="#10B981" stopOpacity="0.18" />
              <Stop offset="100%" stopColor="#090D16" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="400"
            height="320"
            fill={`url(#heroBlueOrbGlow-${rawId})`}
          />
          <Rect
            x="0"
            y="0"
            width="400"
            height="320"
            fill={`url(#heroEmeraldSideGlow-${rawId})`}
          />
        </Svg>
      </View>

      {/* Barra Superior: Píldora de Identidad (con selector < Mes > integrado) + Burbuja + Anillo */}
      <View style={styles.heroTopPillRow}>
        <View style={styles.personalCapsulePill}>
          {onPrevPeriod ? (
            <Pressable
              onPress={onPrevPeriod}
              hitSlop={6}
              style={({ pressed }) => [
                styles.capsuleNavMiniBtn,
                pressed && styles.pressed,
              ]}
            >
              <ChevronLeft size={14} color="#CBD5E1" />
            </Pressable>
          ) : (
            <View style={styles.personalAvatarCircle}>{capsuleIcon}</View>
          )}

          <Pressable
            onPress={onPressCapsule}
            disabled={!onPressCapsule}
            style={({ pressed }) => [
              styles.capsuleCenterPress,
              pressed && onPressCapsule ? styles.pressed : null,
            ]}
          >
            {onPrevPeriod ? (
              <View style={styles.personalAvatarCircleSmall}>{capsuleIcon}</View>
            ) : null}
            <Text numberOfLines={1} style={styles.personalCapsuleText}>
              {capsuleLabel}
            </Text>
          </Pressable>

          {onNextPeriod ? (
            <Pressable
              onPress={onNextPeriod}
              hitSlop={6}
              style={({ pressed }) => [
                styles.capsuleNavMiniBtn,
                pressed && styles.pressed,
              ]}
            >
              <ChevronRight size={14} color="#CBD5E1" />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.heroRightBadgesRow}>
          <Pressable
            onPress={onPressFlame}
            disabled={!onPressFlame}
            style={({ pressed }) => [
              styles.heroStatBubble,
              flameAlert && styles.heroStatBubbleAlert,
              pressed && onPressFlame ? styles.pressed : null,
            ]}
          >
            <Flame size={14} color={flameAlert ? '#FB923C' : '#F59E0B'} />
            <Text style={styles.heroStatBubbleText}>{flameCount}</Text>
          </Pressable>

          <View style={styles.heroRingBadge}>
            <Svg width={36} height={36} viewBox="0 0 36 36">
              <Circle
                cx="18"
                cy="18"
                r="14"
                stroke="rgba(255,255,255,0.14)"
                strokeWidth="2.5"
                fill="none"
              />
              <Circle
                cx="18"
                cy="18"
                r="14"
                stroke={ringAlert ? '#F43F5E' : '#60A5FA'}
                strokeWidth="2.5"
                strokeDasharray={`${Math.round((clampedPercent / 100) * 88)} 88`}
                strokeLinecap="round"
                fill="none"
                rotation="-90"
                origin="18, 18"
              />
            </Svg>
            <Text style={styles.heroRingBadgeText}>{clampedPercent}%</Text>
          </View>
        </View>
      </View>

      {/* Bloque Central: Eyebrow + Badge + Monto Gigante + Subtítulo */}
      <View style={styles.heroBalanceCenterBox}>
        <View style={styles.heroEyebrowRow}>
          <Text style={styles.heroEyebrowLabel}>{eyebrowLabel}</Text>
          {badgeText ? (
            <View
              style={[
                styles.heroPositiveBadge,
                badgeNegative && styles.heroNegativeBadge,
              ]}
            >
              <Text
                style={[
                  styles.heroPositiveArrow,
                  badgeNegative && styles.heroNegativeText,
                ]}
              >
                {badgeArrow}
              </Text>
              <Text
                style={[
                  styles.heroPositiveText,
                  badgeNegative && styles.heroNegativeText,
                ]}
              >
                {badgeText}
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.heroGiantBalance,
            !isDesktop && styles.heroGiantBalanceMobile,
          ]}
        >
          {heroValue}
        </Text>

        <Text style={styles.heroSubHint}>{subtitle}</Text>
      </View>

      {/* Fila Inferior: Circunferencias 52x52 de Acción Rápida + Orbe Azul 52x52 */}
      <View style={styles.heroActionRow}>
        <View style={styles.heroCircleActionsGroup}>
          {actions.map((action) => (
            <Pressable
              key={action.id}
              onPress={action.onPress}
              disabled={action.disabled}
              style={({ pressed }) => [
                styles.heroCircleActionBtn,
                action.active && styles.heroCircleActionBtnActive,
                pressed && styles.pressed,
              ]}
            >
              {action.icon}
              <Text
                numberOfLines={1}
                style={[
                  styles.heroCircleActionLabel,
                  action.active && styles.heroCircleActionLabelActive,
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={onPressOrb}
          disabled={!onPressOrb}
          style={({ pressed }) => [
            styles.heroCompanionOrbOuter,
            pressed && onPressOrb ? styles.pressed : null,
          ]}
        >
          <Svg width={52} height={52} viewBox="0 0 56 56">
            <Defs>
              <RadialGradient
                id={`companionOrbGrad-${rawId}`}
                cx="38%"
                cy="32%"
                r="60%"
              >
                <Stop offset="0%" stopColor="#93C5FD" stopOpacity="1" />
                <Stop offset="45%" stopColor="#2563EB" stopOpacity="0.95" />
                <Stop offset="85%" stopColor="#1E3A8A" stopOpacity="0.9" />
                <Stop offset="100%" stopColor="#172554" stopOpacity="0.4" />
              </RadialGradient>
            </Defs>
            <Circle
              cx="28"
              cy="28"
              r="26"
              fill="rgba(255,255,255,0.07)"
              stroke="rgba(255,255,255,0.22)"
              strokeWidth="1.2"
            />
            <Circle
              cx="28"
              cy="29"
              r="17"
              fill={`url(#companionOrbGrad-${rawId})`}
            />
            <Rect
              x="27"
              y="23"
              width="2.6"
              height="6.2"
              rx="1.3"
              fill="#FFFFFF"
            />
            <Rect
              x="32"
              y="23"
              width="2.6"
              height="6.2"
              rx="1.3"
              fill="#FFFFFF"
            />
          </Svg>
        </Pressable>
      </View>

      {footerContent ? (
        <View style={styles.footerSlotWrap}>{footerContent}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heroAmbientShell: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: '#0B101B',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
    justifyContent: 'space-between',
    gap: 22,
  },
  heroBackdropSvgWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroTopPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  personalCapsulePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    maxWidth: '68%',
  },
  capsuleCenterPress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  capsuleNavMiniBtn: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalAvatarCircle: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalAvatarCircleSmall: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personalCapsuleText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  heroRightBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroStatBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroStatBubbleAlert: {
    backgroundColor: 'rgba(249, 115, 22, 0.16)',
    borderColor: 'rgba(249, 115, 22, 0.45)',
  },
  heroStatBubbleText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  heroRingBadge: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroRingBadgeText: {
    position: 'absolute',
    color: '#E2E8F0',
    fontSize: 9,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  heroBalanceCenterBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroEyebrowLabel: {
    color: 'rgba(226, 232, 240, 0.72)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  heroPositiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  heroNegativeBadge: {
    backgroundColor: 'rgba(244, 63, 94, 0.16)',
  },
  heroPositiveArrow: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
  },
  heroPositiveText: {
    color: '#34D399',
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  heroNegativeText: {
    color: '#FB7185',
  },
  heroGiantBalance: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1.4,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    lineHeight: 56,
  },
  heroGiantBalanceMobile: {
    fontSize: 40,
    lineHeight: 46,
  },
  heroSubHint: {
    color: 'rgba(148, 163, 184, 0.85)',
    fontSize: 11.5,
    fontWeight: '500',
    textAlign: 'center',
  },
  heroActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  heroCircleActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  heroCircleActionBtn: {
    width: 52,
    height: 52,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  heroCircleActionBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  heroCircleActionLabel: {
    color: '#E2E8F0',
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  heroCircleActionLabelActive: {
    color: colors.buttonPrimaryText,
    fontWeight: '700',
  },
  heroCompanionOrbOuter: {
    width: 52,
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSlotWrap: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  pressed: {
    opacity: 0.82,
  },
});
