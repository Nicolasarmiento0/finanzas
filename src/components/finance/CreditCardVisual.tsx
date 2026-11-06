import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { CardBrand } from '@/lib/api';

// Imagen oficial de la Santander WorldMember LATAM Pass subida por el usuario
const SANTANDER_CARD_IMAGE = require('../../../assets/cards/santander-worldmember.jpg');

export interface CardDesignOption {
  id: CardBrand;
  label: string;
  subtitle: string;
  suggestedName: string;
  accentColor: string;
}

export const CARD_DESIGN_OPTIONS: CardDesignOption[] = [
  {
    id: 'santander',
    label: 'Santander',
    subtitle: 'WorldMember LATAM Pass',
    suggestedName: 'Tarjeta Santander',
    accentColor: '#7C3AED',
  },
  {
    id: 'falabella',
    label: 'CMR Falabella',
    subtitle: 'Banco Falabella Mastercard',
    suggestedName: 'CMR Falabella',
    accentColor: '#64BE51',
  },
  {
    id: 'other',
    label: 'Otra Tarjeta',
    subtitle: 'Diseño Minimalista Default',
    suggestedName: 'Tarjeta de Crédito',
    accentColor: '#A1A1AA',
  },
];

/**
 * Detecta el diseño de la tarjeta:
 * 1. Si tiene `card_brand` guardado en la base de datos, usa ese valor.
 * 2. Si no lo tiene (tarjetas ya creadas antes), lo infiere por el nombre ("Santander", "CMR", "Falabella").
 */
export function resolveCardBrand(card: {
  name?: string;
  card_brand?: CardBrand | null;
}): CardBrand {
  if (
    card.card_brand === 'santander' ||
    card.card_brand === 'falabella' ||
    card.card_brand === 'other'
  ) {
    return card.card_brand;
  }

  const lower = (card.name || '').toLowerCase();
  if (
    lower.includes('santander') ||
    lower.includes('worldmember') ||
    lower.includes('latam')
  ) {
    return 'santander';
  }
  if (lower.includes('falabella') || lower.includes('cmr')) {
    return 'falabella';
  }
  return 'other';
}

interface CreditCardVisualProps {
  brand: CardBrand;
  cardName?: string;
  compact?: boolean;
}

export function CreditCardVisual({
  brand,
  cardName,
  compact = false,
}: CreditCardVisualProps) {
  const borderRadius = compact ? 10 : 18;

  if (brand === 'santander') {
    return (
      <View
        style={[
          styles.cardFrame,
          { borderRadius },
          compact && styles.cardFrameCompact,
        ]}
      >
        <Image
          source={SANTANDER_CARD_IMAGE}
          style={[styles.cardImage, { borderRadius }]}
          resizeMode="cover"
        />
        {!compact && cardName ? (
          <View style={styles.santanderBadgeWrap}>
            <Text numberOfLines={1} style={styles.santanderBadgeText}>
              {cardName}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (brand === 'falabella') {
    return (
      <View
        style={[
          styles.cardFrame,
          { borderRadius },
          compact && styles.cardFrameCompact,
        ]}
      >
        <Svg
          viewBox="0 0 380 240"
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid slice"
        >
          <Defs>
            {/* Verde característico CMR Banco Falabella */}
            <LinearGradient id="cmrGreenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#67C354" />
              <Stop offset="50%" stopColor="#58B845" />
              <Stop offset="100%" stopColor="#4CA73A" />
            </LinearGradient>

            {/* Brillo sutil diagonal */}
            <LinearGradient id="cmrSheen" x1="0%" y1="0%" x2="80%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
              <Stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.04" />
              <Stop offset="100%" stopColor="#000000" stopOpacity="0.08" />
            </LinearGradient>

            {/* Chip metálico plateado */}
            <LinearGradient id="cmrChipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#F5F6F8" />
              <Stop offset="50%" stopColor="#D5D8DC" />
              <Stop offset="100%" stopColor="#EAECEE" />
            </LinearGradient>
          </Defs>

          {/* Superficie verde CMR */}
          <Rect x="0" y="0" width="380" height="240" rx="18" fill="url(#cmrGreenGrad)" />
          <Rect x="0" y="0" width="380" height="240" rx="18" fill="url(#cmrSheen)" />

          {/* Chip EMV plateado centrado en la parte superior (fiel al diseño de la tarjeta CMR física) */}
          <G transform="translate(166, 26)">
            <Rect
              x="0"
              y="0"
              width="46"
              height="36"
              rx="7"
              fill="url(#cmrChipGrad)"
              stroke="#B0B6BE"
              strokeWidth="0.8"
            />
            {/* Grabado interno del chip */}
            <Path
              d="M0 12 H15 M31 12 H46 M0 24 H15 M31 24 H46 M23 0 V10 M23 26 V36"
              stroke="#9AA1AA"
              strokeWidth="0.9"
              fill="none"
            />
            <Rect
              x="14"
              y="9"
              width="18"
              height="18"
              rx="5"
              stroke="#9AA1AA"
              strokeWidth="0.9"
              fill="none"
            />
          </G>

          {/* Icono Contactless blanco a la derecha del chip */}
          <G
            transform="translate(226, 33)"
            stroke="#FFFFFF"
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
            opacity="0.95"
          >
            <Path d="M 0 5 A 8 8 0 0 1 0 17" />
            <Path d="M 5 2 A 13 13 0 0 1 5 20" />
            <Path d="M 10 -1 A 18 18 0 0 1 10 23" />
          </G>

          {/* Logotipo CMR Banco Falabella en blanco (lado izquierdo central) */}
          <G transform="translate(36, 122)">
            <SvgText
              x="0"
              y="0"
              fill="#FFFFFF"
              fontSize="44"
              fontWeight="900"
              letterSpacing="-1.8"
            >
              CMR
            </SvgText>
            <SvgText
              x="1"
              y="22"
              fill="#FFFFFF"
              fontSize="14"
              fontWeight="700"
              letterSpacing="-0.2"
              opacity="0.98"
            >
              Banco Falabella
            </SvgText>
          </G>

          {/* Nombre personalizado de la tarjeta en la esquina superior derecha */}
          {!compact && cardName ? (
            <SvgText
              x="346"
              y="44"
              fill="#FFFFFF"
              fontSize="11"
              fontWeight="700"
              textAnchor="end"
              opacity="0.92"
            >
              {cardName.toUpperCase()}
            </SvgText>
          ) : null}

          {/* Logo Mastercard oficial en la esquina inferior izquierda (círculos rojo y ámbar entrelazados) */}
          <G transform="translate(36, 172)">
            <Circle cx="19" cy="19" r="19" fill="#EB001B" />
            <Circle cx="41" cy="19" r="19" fill="#F79E1B" fillOpacity="0.92" />
          </G>
        </Svg>
      </View>
    );
  }

  // Diseño por Default ("Otra"): Estilo Tesla Minimalist + iOS Liquid Glass Obsidian Titanium
  return (
    <View
      style={[
        styles.cardFrame,
        styles.cardFrameDefaultBorder,
        { borderRadius },
        compact && styles.cardFrameCompact,
      ]}
    >
      <Svg
        viewBox="0 0 380 240"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="defaultDarkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#24242C" />
            <Stop offset="50%" stopColor="#121217" />
            <Stop offset="100%" stopColor="#07070A" />
          </LinearGradient>

          <LinearGradient id="defaultGlassGlow" x1="0%" y1="0%" x2="100%" y2="80%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.14" />
            <Stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.03" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </LinearGradient>

          <LinearGradient id="defaultChipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#E4E4E7" />
            <Stop offset="50%" stopColor="#A1A1AA" />
            <Stop offset="100%" stopColor="#D4D4D8" />
          </LinearGradient>
        </Defs>

        {/* Fondo Titanio Oscuro */}
        <Rect x="0" y="0" width="380" height="240" rx="18" fill="url(#defaultDarkGrad)" />

        {/* Reflejo diagonal Liquid Glass */}
        <Path d="M0 0 L250 0 L140 240 L0 240 Z" fill="url(#defaultGlassGlow)" />

        {/* Líneas geométricas sutiles */}
        <Circle
          cx="340"
          cy="30"
          r="110"
          stroke="#FFFFFF"
          strokeOpacity="0.05"
          strokeWidth="1"
          fill="none"
        />
        <Circle
          cx="340"
          cy="30"
          r="75"
          stroke="#FFFFFF"
          strokeOpacity="0.05"
          strokeWidth="1"
          fill="none"
        />

        {/* Cabecera de marca */}
        <SvgText
          x="32"
          y="40"
          fill="#A1A1AA"
          fontSize="10"
          fontWeight="700"
          letterSpacing="2"
        >
          FINANZAPP · TITANIUM
        </SvgText>

        {/* Chip EMV */}
        <G transform="translate(32, 68)">
          <Rect
            x="0"
            y="0"
            width="48"
            height="36"
            rx="6"
            fill="url(#defaultChipGrad)"
            stroke="#71717A"
            strokeWidth="1"
          />
          <Path
            d="M0 12 H16 M32 12 H48 M0 24 H16 M32 24 H48 M24 0 V36"
            stroke="#52525B"
            strokeWidth="1"
            fill="none"
          />
        </G>

        {/* Contactless */}
        <G
          transform="translate(94, 74)"
          stroke="#A1A1AA"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        >
          <Path d="M 0 6 A 8 8 0 0 1 0 16" />
          <Path d="M 5 3 A 13 13 0 0 1 5 19" />
          <Path d="M 10 0 A 18 18 0 0 1 10 22" />
        </G>

        {/* Nombre de la tarjeta */}
        <SvgText
          x="32"
          y="162"
          fill="#FFFFFF"
          fontSize="19"
          fontWeight="700"
          letterSpacing="-0.3"
        >
          {(cardName || 'Tarjeta de Crédito').slice(0, 24)}
        </SvgText>

        <SvgText
          x="32"
          y="184"
          fill="#A1A1AA"
          fontSize="11"
          fontWeight="600"
          letterSpacing="2.2"
        >
          ••••  ••••  ••••  CLP
        </SvgText>

        {/* Círculos metálicos entrelazados */}
        <G transform="translate(292, 166)">
          <Circle cx="18" cy="18" r="18" fill="#A1A1AA" fillOpacity="0.45" />
          <Circle cx="38" cy="18" r="18" fill="#FFFFFF" fillOpacity="0.55" />
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  cardFrame: {
    width: '100%',
    aspectRatio: 1.586,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0A0A0D',
  },
  cardFrameCompact: {
    aspectRatio: 1.586,
  },
  cardFrameDefaultBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  santanderBadgeWrap: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    maxWidth: '62%',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(5, 5, 8, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  santanderBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
