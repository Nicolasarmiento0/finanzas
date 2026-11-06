import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme/tokens';

interface ScreenContainerProps {
  children: React.ReactNode;
  centered?: boolean;
  maxWidth?: number;
  contentStyle?: ViewStyle;
}

export function ScreenContainer({
  children,
  centered = true,
  maxWidth = 440,
  contentStyle,
}: ScreenContainerProps) {
  const { isDesktop } = useResponsive();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Luz ambiental monocromática sutil estilo iOS Liquid Glass + Tesla */}
      <View pointerEvents="none" style={styles.ambientGlowTop} />
      <View pointerEvents="none" style={styles.ambientGlowBottom} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            !isDesktop && styles.scrollContentMobile,
            centered && styles.centeredContent,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.innerContainer, { maxWidth }, contentStyle]}>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -140,
    alignSelf: 'center',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -180,
    alignSelf: 'center',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: 'rgba(255, 255, 255, 0.025)',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  scrollContentMobile: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 120,
  },
  centeredContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerContainer: {
    width: '100%',
    alignSelf: 'center',
  },
});
