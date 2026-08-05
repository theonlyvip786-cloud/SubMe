import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { colors, fontFamily } from './designSystem';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Y2KCelebrationOverlayProps {
  active: boolean;
  type?: 'falling' | 'explode';
  showText?: boolean;
}

// Pastel Y2K Celebration Colors
const CONFETTI_COLORS = [
  '#FFB7D5', // Pink
  '#C2F687', // Lime
  '#e0aaff', // Lavender
  '#fed9b7', // Peach
  '#7CB3FF', // Soft Y2K Blue
  '#FF9F1C', // Bright Orange
  '#FFD166', // Bright Yellow
];

const SYMBOLS = ['✦', '★', '●', '✦', '★', '✿', '♦'];

export default function Y2KCelebrationOverlay({ active, type = 'falling', showText = true }: Y2KCelebrationOverlayProps) {
  // Generate configuration for 80 particles (doubled for denser effect)
  const numParticles = 80;
  const particles = useRef(
    Array.from({ length: numParticles }).map(() => ({
      animProgress: new Animated.Value(0),
      size: Math.random() * 24 + 16, // Larger size: between 16 and 40
      left: `${Math.random() * 100}%`, // random horizontal position
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      speed: Math.random() * 1500 + 2500, // speed between 2.5s and 4s
      delay: Math.random() * 1000, // random staggered delays
      drift: Math.random() * 120 - 60, // horizontal drift offset
      rotation: Math.random() > 0.5 ? '1080deg' : '-1080deg',
      // Explosion configuration
      angle: Math.random() * Math.PI * 2,
      distance: Math.random() * 300 + 100, // distance between 100px and 400px
    }))
  ).current;

  // Animation for the "Congratulations" text
  const textScale = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) return;

    // Reset values
    textScale.setValue(0);
    textOpacity.setValue(0);

    const animations = particles.map((p) => {
      p.animProgress.setValue(0);
      const duration = type === 'explode' ? Math.random() * 600 + 800 : p.speed;
      const delay = type === 'explode' ? Math.random() * 100 : p.delay;
      return Animated.timing(p.animProgress, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.quad),
      });
    });

    // Text Animation Sequence
    const textAnim = Animated.sequence([
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(textScale, {
          toValue: 1,
          friction: 4,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(2000), // Hold for 2 seconds
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]);

    Animated.parallel([...animations, textAnim]).start();
  }, [active, type]);

  if (!active) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Particles */}
      {particles.map((p, i) => {
        let translateY;
        let translateX;
        let left;
        let top;

        if (type === 'explode') {
          // Centered around the screen
          left = SCREEN_W / 2;
          top = SCREEN_H / 2;

          translateY = p.animProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, Math.sin(p.angle) * p.distance + (Math.random() * 100 + 50)], // Add gravity drop
          });

          translateX = p.animProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, Math.cos(p.angle) * p.distance],
          });
        } else {
          left = p.left as any;
          top = -50;

          translateY = p.animProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, SCREEN_H + 100],
          });

          translateX = p.animProgress.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0, p.drift, p.drift * 1.5],
          });
        }

        // Smooth rotation
        const rotate = p.animProgress.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', p.rotation],
        });

        // Scale pop in, then scale down slightly near the end
        const scale = p.animProgress.interpolate({
          inputRange: [0, 0.1, 0.8, 1],
          outputRange: [0, 1.2, 1, 0],
        });

        // Fade out near the end
        const opacity = p.animProgress.interpolate({
          inputRange: [0, 0.7, 1],
          outputRange: [1, 1, 0],
        });

        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                left: left as any,
                top: top as any,
                opacity,
                transform: [{ translateY }, { translateX }, { rotate }, { scale }],
              },
            ]}
          >
            {p.symbol === '●' ? (
              <View
                style={{
                  width: p.size * 0.8,
                  height: p.size * 0.8,
                  borderRadius: p.size * 0.4,
                  backgroundColor: p.color,
                  borderWidth: 2,
                  borderColor: '#16120F',
                }}
              />
            ) : (
              <Text
                style={{
                  fontSize: p.size,
                  color: p.color,
                  textShadowColor: '#16120F',
                  textShadowOffset: { width: 2, height: 2 },
                  textShadowRadius: 0,
                  fontWeight: '900',
                }}
              >
                {p.symbol}
              </Text>
            )}
          </Animated.View>
        );
      })}

      {/* Congratulations Text */}
      {showText && (
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textOpacity,
              transform: [{ scale: textScale }, { rotate: '-3deg' }],
            },
          ]}
        >
          <View style={styles.textBadge}>
            <Text style={styles.congratsText}>CONGRATULATIONS!</Text>
          </View>
          <View style={[styles.textBadgeShadow, { zIndex: -1 }]} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999, // Ensure it's above everything
    justifyContent: 'center',
    alignItems: 'center',
  },
  particle: {
    position: 'absolute',
    top: 0,
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBadge: {
    backgroundColor: '#C2F687', // Lime Y2K
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#16120F',
  },
  textBadgeShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: '#FFB7D5', // Pink Y2K
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#16120F',
  },
  congratsText: {
    fontFamily,
    fontSize: 28,
    fontWeight: '900',
    color: '#16120F',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
