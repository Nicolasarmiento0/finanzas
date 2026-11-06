import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useResponsive } from '@/hooks/useResponsive';
import { colors, radius } from '@/theme/tokens';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}

export function GlassCard({ children, style, intensity = 30 }: GlassCardProps) {
  const { isDesktop } = useResponsive();

  return (
    <View style={[styles.outer, style]}>
      <BlurView intensity={intensity} tint="dark" style={styles.blur}>
        <View style={[styles.inner, !isDesktop && styles.innerMobile]}>
          {children}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassSurface,
  },
  blur: {
    width: '100%',
    alignSelf: 'stretch',
  },
  inner: {
    width: '100%',
    padding: 26,
  },
  innerMobile: {
    width: '100%',
    padding: 16,
  },
});
