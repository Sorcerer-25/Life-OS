import React, { useEffect, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { IconTile } from './IconTile';
import { useReducedMotion } from './Motion';

export function SuccessFeedback({ label }: { label: string }) {
  const { theme } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    scale.setValue(0.6);
    const animation = Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [reduced, scale]);
  return <View accessibilityRole="status" accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 }}>
    <Animated.View style={{ transform: [{ scale }] }}><IconTile name="check" color={theme.colors.success} /></Animated.View>
    <Text style={[theme.typography.bodyMedium, { color: theme.colors.textPrimary, flex: 1 }]}>{label}</Text>
  </View>;
}
