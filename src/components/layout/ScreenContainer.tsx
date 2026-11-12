import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/hooks/useResponsive';
import { colors } from '@/theme/tokens';

interface ScreenContainerProps {
  children: React.ReactNode;
  centered?: boolean;
  maxWidth?: number;
  contentStyle?: ViewStyle;
  scrollRef?: React.RefObject<ScrollView>;
}

export function ScreenContainer({
  children,
  centered = true,
  maxWidth = 740,
  contentStyle,
  scrollRef,
}: ScreenContainerProps) {
  const { isDesktop } = useResponsive();
  const insets = useSafeAreaInsets();

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
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            !isDesktop && [
              styles.scrollContentMobile,
              {
                paddingTop: Math.max(insets.top, 16),
                paddingBottom: 148 + insets.bottom,
              },
            ],
            centered && styles.centeredContent,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.innerContainer,
              isDesktop
                ? { maxWidth, alignSelf: 'center' }
                : styles.innerContainerMobile,
              contentStyle,
            ]}
          >
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
    width: '100%',
    height: '100%',
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  ambientGlowTop: {
    position: 'absolute',
    top: -150,
    alignSelf: 'center',
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  ambientGlowBottom: {
    position: 'absolute',
    bottom: -190,
    alignSelf: 'center',
    width: 460,
    height: 460,
    borderRadius: 230,
    backgroundColor: 'rgba(16, 185, 129, 0.045)',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 64,
  },
  scrollContentMobile: {
    width: '100%',
    alignItems: 'stretch',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 148,
  },
  centeredContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerContainer: {
    width: '100%',
    flexGrow: 1,
  },
  innerContainerMobile: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
    flexGrow: 1,
  },
});
