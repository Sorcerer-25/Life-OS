import React, { createContext, useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, LayoutAnimation, TouchableOpacity, TouchableOpacityProps, ViewStyle } from 'react-native';

let reduceMotion = true;
const MotionContext = createContext(true);
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let mounted = true;
    const update = (value: boolean) => { reduceMotion = value; if (mounted) setReduced(value); };
    AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return <MotionContext.Provider value={reduced}>{children}</MotionContext.Provider>;
}
export function useReducedMotion() { return useContext(MotionContext); }

export function animateLayout() {
  if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

const AnimatedTouch = Animated.createAnimatedComponent(TouchableOpacity);

/** Shared press feedback preserves layout and nested button handling. */
export function ScalePressable({ children, style, onPressIn, onPressOut, ...props }: TouchableOpacityProps) {
  const [scale] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  return <AnimatedTouch {...props} style={[style, { transform: [{ scale }] }]}
    onPressIn={(event: Parameters<NonNullable<TouchableOpacityProps['onPressIn']>>[0]) => {
      if (!reduced) Animated.spring(scale, { toValue: 0.97, speed: 30, useNativeDriver: true }).start();
      onPressIn?.(event);
    }}
    onPressOut={(event: Parameters<NonNullable<TouchableOpacityProps['onPressOut']>>[0]) => {
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
      onPressOut?.(event);
    }}>{children}</AnimatedTouch>;
}

export function Entrance({ children, index = 0, style }: { children: React.ReactNode; index?: number; style?: ViewStyle }) {
  const [progress] = useState(() => new Animated.Value(1));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, { toValue: 1, duration: 180, delay: Math.min(index, 12) * 40, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [index, reduced, progress]);
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>{children}</Animated.View>;
}
