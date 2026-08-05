import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from './designSystem';

interface Y2KCoinProps {
  size?: number;
  style?: any;
}

export default function Y2KCoin({ size = 20, style }: Y2KCoinProps) {
  // Compute nested dimensions based on the main size
  const borderWidth = Math.max(1.5, size * 0.08);
  const shadowOffset = Math.max(1.5, size * 0.08);
  const innerRingSize = size - borderWidth * 2;
  const starFontSize = size * 0.45;

  return (
    <View style={[styles.coinContainer, { width: size + shadowOffset, height: size + shadowOffset }, style]}>
      {/* Neobrutalist Shadow Backdrop */}
      <View
        style={[
          styles.coinShadow,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            bottom: 0,
            right: 0,
          },
        ]}
      />

      {/* Main Gold Coin Surface */}
      <View
        style={[
          styles.coinFace,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            backgroundColor: colors.yellow,
            top: 0,
            left: 0,
          },
        ]}
      >
        {/* Inner Shiny Ring */}
        <View
          style={[
            styles.coinInnerRing,
            {
              width: innerRingSize * 0.85,
              height: innerRingSize * 0.85,
              borderRadius: (innerRingSize * 0.85) / 2,
              borderWidth: borderWidth * 0.5,
              borderColor: 'rgba(255, 255, 255, 0.45)',
            },
          ]}
        >
          {/* Engraved Star Icon */}
          <Text
            style={[
              styles.coinStar,
              {
                fontSize: starFontSize,
                lineHeight: starFontSize + 2,
              },
            ]}
          >
            ★
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  coinContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinShadow: {
    position: 'absolute',
    backgroundColor: '#16120F',
  },
  coinFace: {
    position: 'absolute',
    borderColor: '#16120F',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  coinInnerRing: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  coinStar: {
    fontWeight: '900',
    color: '#16120F',
    textAlign: 'center',
  },
});
