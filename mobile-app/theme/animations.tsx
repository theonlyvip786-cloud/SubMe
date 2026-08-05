// ============================================================
// Shared Animation Utilities
// Hooks and components for consistent micro-interactions
// ============================================================

import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, Easing, View, StyleSheet } from 'react-native';
import { animation } from './designSystem';

// ------------------------------------------------------------
// useFadeSlideEntrance — fade + slide-up entrance animation
// ------------------------------------------------------------
export function useFadeSlideEntrance(config?: {
  duration?: number;
  slideDistance?: number;
  delay?: number;
  easing?: (value: number) => number;
  deps?: any[];
}) {
  const {
    duration = animation.duration.slow,
    slideDistance = 24,
    delay = 0,
    easing = Easing.out(Easing.ease),
    deps = [],
  } = config || {};

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(slideDistance)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration,
        delay,
        easing,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration,
        delay,
        easing,
        useNativeDriver: true,
      }),
    ]).start();
  }, deps);

  return { fadeAnim, slideAnim };
}

// ------------------------------------------------------------
// useStaggeredEntrance — for lists of items
// ------------------------------------------------------------
export function useStaggeredEntrance(itemCount: number, config?: {
  staggerDelay?: number;
  duration?: number;
  slideDistance?: number;
}) {
  const {
    staggerDelay = animation.stagger.normal,
    duration = animation.duration.slow,
    slideDistance = 30,
  } = config || {};

  const fadeAnims = useRef<Animated.Value[]>([]).current;
  const slideAnims = useRef<Animated.Value[]>([]).current;

  while (fadeAnims.length < itemCount) {
    fadeAnims.push(new Animated.Value(0));
    slideAnims.push(new Animated.Value(slideDistance));
  }

  useEffect(() => {
    const animations: Animated.CompositeAnimation[] = [];

    for (let i = 0; i < itemCount; i++) {
      animations.push(
        Animated.parallel([
          Animated.timing(fadeAnims[i], {
            toValue: 1,
            duration,
            delay: i * staggerDelay,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.spring(slideAnims[i], {
            toValue: 0,
            ...animation.spring.soft,
            delay: i * staggerDelay,
            useNativeDriver: true,
          }),
        ])
      );
    }

    Animated.parallel(animations).start();
  }, [itemCount]);

  const getItemStyle = (index: number) => ({
    opacity: fadeAnims[index] || new Animated.Value(1),
    transform: [{ translateY: slideAnims[index] || new Animated.Value(0) }],
  });

  return { getItemStyle };
}

// ------------------------------------------------------------
// StaggeredItem — wrap list items for staggered entrance
// ------------------------------------------------------------
export function StaggeredItem({ index, children, style }: {
  index: number;
  children: React.ReactNode;
  style?: any;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: animation.duration.normal,
        delay: index * animation.stagger.fast,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        ...animation.spring.soft,
        delay: index * animation.stagger.fast,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {children}
    </Animated.View>
  );
}

// ------------------------------------------------------------
// Card Animation wrapper — fade + scale entrance for cards
// ------------------------------------------------------------
export function AnimatedCard({ children, style, delay = 0 }: any) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: animation.duration.normal,
        delay,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        ...animation.spring.medium,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        ...animation.spring.soft,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ------------------------------------------------------------
// AnimatedPressable — press-to-scale wrapper
// Replaces TouchableOpacity with spring feedback
// ------------------------------------------------------------
interface AnimatedPressableProps {
  onPress?: () => void;
  onPressIn?: () => void;
  onPressOut?: () => void;
  scaleTo?: number;
  style?: any;
  children: React.ReactNode;
  activeOpacity?: number;
  disabled?: boolean;
}

export function AnimatedPressable({
  onPress,
  onPressIn,
  onPressOut,
  scaleTo = 0.95,
  style,
  children,
  disabled = false,
}: AnimatedPressableProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: scaleTo,
      ...animation.spring.medium,
      useNativeDriver: true,
    }).start();
    onPressIn?.();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...animation.spring.stiff,
      useNativeDriver: true,
    }).start();
    onPressOut?.();
  };

  // Flatten and forward layout constraints exclusively to the outer Animated.View to prevent margin-stacking and clipping conflicts
  const innerStyle: any = style ? { ...StyleSheet.flatten(style) } : {};
  const containerStyle: any = {};
  const layoutKeys = [
    'flex', 'margin', 'marginHorizontal', 'marginVertical', 'marginTop',
    'marginBottom', 'marginLeft', 'marginRight', 'position', 'top',
    'bottom', 'left', 'right', 'alignSelf', 'width', 'height'
  ];

  layoutKeys.forEach(key => {
    if (innerStyle[key] !== undefined) {
      containerStyle[key] = innerStyle[key];
      delete innerStyle[key];
    }
  });

  return (
    <Animated.View style={[containerStyle, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={disabled ? undefined : handlePressIn}
        onPressOut={disabled ? undefined : handlePressOut}
        activeOpacity={0.85}
        disabled={disabled}
        style={[
          innerStyle,
          (innerStyle.width !== undefined || containerStyle.width !== undefined) ? { width: '100%' } : {},
          (innerStyle.height !== undefined || containerStyle.height !== undefined) ? { height: '100%' } : {}
        ]}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ------------------------------------------------------------
// Floating Animation — gentle floating effect for decorative elements
// ------------------------------------------------------------
export function FloatingView({ children, style, amplitude = 5, duration = 3000 }: any) {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: amplitude,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: -amplitude,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[{ transform: [{ translateY: floatAnim }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ------------------------------------------------------------
// Pulse Animation — for notification badges or highlights
// ------------------------------------------------------------
export function PulseBadge({ children, color = '#FF8BA7' }: any) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 600,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        transform: [{ scale: pulseAnim }],
        backgroundColor: color,
        borderRadius: 8,
        width: 8,
        height: 8,
      }}
    />
  );
}
