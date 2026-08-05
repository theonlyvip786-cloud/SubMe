import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii } from './designSystem';

interface Y2KNoteProps {
  size?: number;
  style?: any;
}

export default function Y2KNote({ size = 20, style }: Y2KNoteProps) {
  // A rectangular paper bill: aspect ratio is width = size * 1.6, height = size
  const width = size * 1.6;
  const height = size;
  const borderWidth = Math.max(1.5, size * 0.08);
  const shadowOffset = Math.max(1.5, size * 0.08);
  const fontSize = size * 0.55;

  return (
    <View style={[styles.container, { width: width + shadowOffset, height: height + shadowOffset }, style]}>
      {/* Neobrutalist Shadow Backdrop */}
      <View
        style={[
          styles.shadow,
          {
            width,
            height,
            borderRadius: 4,
            bottom: 0,
            right: 0,
          },
        ]}
      />

      {/* Main Mint Green Note Surface */}
      <View
        style={[
          styles.face,
          {
            width,
            height,
            borderRadius: 4,
            borderWidth,
            backgroundColor: '#C2F687', // Pastel Y2K Lime Green
            top: 0,
            left: 0,
          },
        ]}
      >
        {/* Note Border/Margin Accent lines */}
        <View style={[styles.innerBorder, { borderWidth: borderWidth * 0.3, borderRadius: 2 }]}>
          {/* Centered Monogram */}
          <Text style={[styles.monogram, { fontSize, lineHeight: fontSize + 1 }]}>
            ₹
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shadow: {
    position: 'absolute',
    backgroundColor: '#16120F',
  },
  face: {
    position: 'absolute',
    borderColor: '#16120F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  innerBorder: {
    width: '100%',
    height: '100%',
    borderColor: 'rgba(22, 18, 15, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  monogram: {
    fontWeight: '900',
    color: '#16120F',
    textAlign: 'center',
  },
});
