import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { colors, radius } from '@/theme/tokens';

interface AccordionToggleProps {
  expanded: boolean;
  onPress: () => void;
  count?: number;
  label?: string;
  accessibilityLabel?: string;
}

export function triggerAccordionAnimation(): void {
  if (Platform.OS === 'ios') {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }
}

export function AccordionToggle({
  expanded,
  onPress,
  count,
  label,
  accessibilityLabel,
}: AccordionToggleProps) {
  const rotateAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [expanded, rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Pressable
      onPress={() => {
        triggerAccordionAnimation();
        onPress();
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={
        accessibilityLabel || (expanded ? 'Contraer sección' : 'Expandir sección')
      }
      style={({ pressed }) => [
        styles.pill,
        expanded && styles.pillExpanded,
        count === undefined && !label && styles.pillIconOnly,
        pressed && styles.pressed,
      ]}
    >
      {typeof count === 'number' ? (
        <View style={[styles.countBadge, expanded && styles.countBadgeExpanded]}>
          <Text style={[styles.countText, expanded && styles.countTextExpanded]}>
            {count}
          </Text>
        </View>
      ) : null}

      {label ? (
        <Text style={[styles.labelText, expanded && styles.labelTextExpanded]}>
          {label}
        </Text>
      ) : null}

      <Animated.View style={{ transform: [{ rotate: rotation }] }}>
        <ChevronDown
          size={15}
          color={expanded ? '#38BDF8' : colors.textSecondary}
          strokeWidth={2.2}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.bentoBorderStrong,
    backgroundColor: colors.bentoCardElevated,
  },
  pillIconOnly: {
    width: 32,
    paddingHorizontal: 0,
  },
  pillExpanded: {
    borderColor: 'rgba(56, 189, 248, 0.42)',
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
  },
  countBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  countBadgeExpanded: {
    backgroundColor: 'rgba(56, 189, 248, 0.22)',
  },
  countText: {
    color: colors.textSecondary,
    fontSize: 10.5,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  countTextExpanded: {
    color: '#38BDF8',
  },
  labelText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  labelTextExpanded: {
    color: colors.textPrimary,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
});
