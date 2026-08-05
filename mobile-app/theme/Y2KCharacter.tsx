import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors, shadows } from './designSystem';

export type CharacterType =
  | 'excited'
  | 'joyful'
  | 'grateful'
  | 'bored'
  | 'angry'
  | 'sensitive'
  | 'confused'
  | 'guilty';

interface Y2KCharacterProps {
  type: CharacterType;
  size?: number;
  animate?: boolean;
  caption?: string;
  style?: any;
}

export default function Y2KCharacter({
  type,
  size = 100,
  animate = true,
  caption,
  style,
}: Y2KCharacterProps) {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 6,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animate]);

  // Scale factor based on baseline size of 100
  const scale = size / 100;

  const renderShape = () => {
    switch (type) {
      case 'excited':
        return (
          <View style={[styles.excitedBase, { transform: [{ scale }] }]}>
            {/* Eyes */}
            <View style={styles.excitedEyesRow}>
              <View style={styles.excitedEye} />
              <View style={styles.excitedEye} />
            </View>
            {/* Smile */}
            <View style={styles.excitedSmile} />
          </View>
        );

      case 'joyful':
        return (
          <View style={[styles.joyfulContainer, { transform: [{ scale }] }]}>
            {/* Blobs merging into a flower shape */}
            <View style={styles.joyfulPetalN} />
            <View style={styles.joyfulPetalS} />
            <View style={styles.joyfulPetalW} />
            <View style={styles.joyfulPetalE} />
            <View style={styles.joyfulCenter} />
            {/* Face Layer */}
            <View style={styles.joyfulFaceContainer}>
              <View style={styles.excitedEyesRow}>
                <View style={styles.excitedEye} />
                <View style={styles.excitedEye} />
              </View>
              <View style={styles.excitedSmile} />
            </View>
          </View>
        );

      case 'grateful':
        return (
          <View style={[styles.joyfulContainer, { transform: [{ scale }] }]}>
            {/* Soft Lavender Clover Blobs */}
            <View style={[styles.joyfulPetalN, { backgroundColor: colors.lavender }]} />
            <View style={[styles.joyfulPetalS, { backgroundColor: colors.lavender }]} />
            <View style={[styles.joyfulPetalW, { backgroundColor: colors.lavender }]} />
            <View style={[styles.joyfulPetalE, { backgroundColor: colors.lavender }]} />
            <View style={[styles.joyfulCenter, { backgroundColor: colors.lavender, borderRadius: 20 }]} />
            {/* Face Layer */}
            <View style={styles.joyfulFaceContainer}>
              <View style={styles.gratefulEyesRow}>
                <View style={styles.gratefulEyeLeft} />
                <View style={styles.gratefulEyeRight} />
              </View>
              <View style={styles.gratefulSmile} />
            </View>
          </View>
        );

      case 'bored':
        return (
          <View style={[styles.boredBase, { transform: [{ scale }] }]}>
            {/* Big Eyes */}
            <View style={styles.boredEyesRow}>
              <View style={styles.boredEyeball}>
                <View style={styles.boredPupil} />
                <View style={styles.boredEyelid} />
              </View>
              <View style={styles.boredEyeball}>
                <View style={styles.boredPupil} />
                <View style={styles.boredEyelid} />
              </View>
            </View>
            {/* Flat Mouth */}
            <View style={styles.flatMouth} />
          </View>
        );

      case 'angry':
        return (
          <View style={[styles.angryBase, { transform: [{ scale }] }]}>
            {/* Eyebrows & Square Eyes */}
            <View style={styles.angryEyesRow}>
              <View style={styles.angryEyeballWrapper}>
                <View style={[styles.angryEyebrow, styles.eyebrowLeft]} />
                <View style={styles.angryEyeball}>
                  <View style={[styles.angryPupil, { left: 4 }]} />
                </View>
              </View>
              <View style={styles.angryEyeballWrapper}>
                <View style={[styles.angryEyebrow, styles.eyebrowRight]} />
                <View style={styles.angryEyeball}>
                  <View style={[styles.angryPupil, { right: 4 }]} />
                </View>
              </View>
            </View>
            {/* Angry Flat Mouth */}
            <View style={styles.angryMouth} />
          </View>
        );

      case 'sensitive':
        return (
          <View style={[styles.sensitiveBase, { transform: [{ scale }] }]}>
            {/* Face */}
            <View style={styles.sensitiveEyesRow}>
              <View style={styles.sensitiveEye} />
              <View style={styles.sensitiveEye} />
            </View>
            <View style={styles.sensitiveMouth}>
              <View style={styles.teardrop} />
            </View>
          </View>
        );

      case 'confused':
        return (
          <View style={[styles.confusedBase, { transform: [{ scale }] }]}>
            <View style={styles.confusedInnerFace}>
              <View style={styles.confusedEyesRow}>
                {/* Spiral/Big pupil confused eyes */}
                <View style={styles.confusedEyeBig}>
                  <View style={styles.spiralPupil} />
                </View>
                <View style={styles.confusedEyeSmall}>
                  <View style={styles.dotPupil} />
                </View>
              </View>
              {/* Squiggly mouth */}
              <View style={styles.squigglyMouth} />
            </View>
          </View>
        );

      case 'guilty':
        return (
          <View style={[styles.guiltyBase, { transform: [{ scale }] }]}>
            <View style={styles.guiltyEyesRow}>
              <View style={styles.guiltyEyeball}>
                <View style={styles.guiltyPupil} />
              </View>
              <View style={styles.guiltyEyeball}>
                <View style={styles.guiltyPupil} />
              </View>
            </View>
            <View style={styles.guiltyMouth} />
          </View>
        );

      default:
        return null;
    }
  };

  const content = (
    <View style={[styles.characterWrapper, { width: size, height: size }]}>
      {/* Neobrutalist Shadow Backdrop */}
      <View style={[styles.shadowBackdrop, { width: size - 4, height: size - 4, borderRadius: size / 2 }]} />
      {renderShape()}
    </View>
  );

  return (
    <View style={[styles.outerContainer, style]}>
      {animate ? (
        <Animated.View style={{ transform: [{ translateY: floatAnim }] }}>
          {content}
        </Animated.View>
      ) : (
        content
      )}
      {caption && <Text style={styles.captionText}>{caption}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  characterWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  shadowBackdrop: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#16120F',
    zIndex: 0,
  },
  captionText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '800',
    color: '#16120F',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // --- EXCITED CHARACTER (Pink Circle) ---
  excitedBase: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFB7D5',
    borderWidth: 2.5,
    borderColor: '#16120F',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  excitedEyesRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  excitedEye: {
    width: 14,
    height: 8,
    borderBottomWidth: 3,
    borderBottomColor: '#16120F',
    borderRadius: 7,
  },
  excitedSmile: {
    width: 32,
    height: 16,
    borderBottomWidth: 3.5,
    borderBottomColor: '#16120F',
    borderRadius: 16,
    marginTop: 2,
  },

  // --- JOYFUL CHARACTER (Pink Blob Flower) ---
  joyfulContainer: {
    width: 100,
    height: 100,
    position: 'relative',
    zIndex: 1,
  },
  joyfulPetalN: {
    position: 'absolute',
    top: 2,
    left: 25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFB7D5',
    borderWidth: 2.5,
    borderColor: '#16120F',
  },
  joyfulPetalS: {
    position: 'absolute',
    bottom: 2,
    left: 25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFB7D5',
    borderWidth: 2.5,
    borderColor: '#16120F',
  },
  joyfulPetalW: {
    position: 'absolute',
    left: 2,
    top: 25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFB7D5',
    borderWidth: 2.5,
    borderColor: '#16120F',
  },
  joyfulPetalE: {
    position: 'absolute',
    right: 2,
    top: 25,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFB7D5',
    borderWidth: 2.5,
    borderColor: '#16120F',
  },
  joyfulCenter: {
    position: 'absolute',
    top: 22,
    left: 22,
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FFB7D5',
    zIndex: 2,
  },
  joyfulFaceContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },

  // --- GRATEFUL CHARACTER (Lavender Clover) ---
  gratefulEyesRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  gratefulEyeLeft: {
    width: 14,
    height: 8,
    borderBottomWidth: 3,
    borderBottomColor: '#16120F',
    borderRadius: 7,
    transform: [{ rotate: '5deg' }],
  },
  gratefulEyeRight: {
    width: 14,
    height: 8,
    borderBottomWidth: 3,
    borderBottomColor: '#16120F',
    borderRadius: 7,
    transform: [{ rotate: '-5deg' }],
  },
  gratefulSmile: {
    width: 20,
    height: 10,
    borderBottomWidth: 3,
    borderBottomColor: '#16120F',
    borderRadius: 10,
    marginTop: 4,
  },

  // --- BORED CHARACTER (Lime Green Circle) ---
  boredBase: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#C2F687',
    borderWidth: 2.5,
    borderColor: '#16120F',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  boredEyesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  boredEyeball: {
    width: 24,
    height: 30,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#16120F',
    position: 'relative',
    justifyContent: 'flex-end',
    alignItems: 'center',
    overflow: 'hidden',
  },
  boredPupil: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16120F',
    marginBottom: 4,
  },
  boredEyelid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: '#C2F687',
    borderBottomWidth: 1.8,
    borderBottomColor: '#16120F',
  },
  flatMouth: {
    width: 22,
    height: 3,
    backgroundColor: '#16120F',
    borderRadius: 1.5,
    marginTop: 6,
  },

  // --- ANGRY CHARACTER (Orange Square) ---
  angryBase: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: '#FF6F00',
    borderWidth: 2.5,
    borderColor: '#16120F',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  angryEyesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 6,
  },
  angryEyeballWrapper: {
    position: 'relative',
    width: 22,
    height: 22,
  },
  angryEyebrow: {
    position: 'absolute',
    top: -2,
    width: 26,
    height: 5,
    backgroundColor: '#16120F',
    zIndex: 3,
  },
  eyebrowLeft: {
    left: -2,
    transform: [{ rotate: '18deg' }],
  },
  eyebrowRight: {
    right: -2,
    transform: [{ rotate: '-18deg' }],
  },
  angryEyeball: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#16120F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  angryPupil: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16120F',
    position: 'absolute',
    bottom: 2,
  },
  angryMouth: {
    width: 24,
    height: 3,
    backgroundColor: '#16120F',
    borderRadius: 1.5,
    marginTop: 6,
  },

  // --- SENSITIVE CHARACTER (Blue Dome) ---
  sensitiveBase: {
    width: 90,
    height: 90,
    borderTopLeftRadius: 45,
    borderTopRightRadius: 45,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: '#2A6CFF',
    borderWidth: 2.5,
    borderColor: '#16120F',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  sensitiveEyesRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 6,
    marginTop: 10,
  },
  sensitiveEye: {
    width: 12,
    height: 12,
    borderWidth: 2,
    borderColor: '#16120F',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderRadius: 6,
    transform: [{ rotate: '180deg' }],
  },
  sensitiveMouth: {
    width: 20,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginTop: 2,
  },
  teardrop: {
    width: 8,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#16120F',
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    transform: [{ rotate: '45deg' }],
  },

  // --- CONFUSED CHARACTER (Blue Diamond) ---
  confusedBase: {
    width: 80,
    height: 80,
    borderRadius: 14,
    backgroundColor: '#2364aa',
    borderWidth: 2.5,
    borderColor: '#16120F',
    transform: [{ rotate: '45deg' }],
    zIndex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confusedInnerFace: {
    width: 80,
    height: 80,
    transform: [{ rotate: '-45deg' }],
    justifyContent: 'center',
    alignItems: 'center',
  },
  confusedEyesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  confusedEyeBig: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#16120F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spiralPupil: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#16120F',
    borderStyle: 'dashed',
  },
  confusedEyeSmall: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#16120F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotPupil: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#16120F',
  },
  squigglyMouth: {
    width: 20,
    height: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#16120F',
    borderRadius: 6,
    transform: [{ skewX: '15deg' }],
  },

  // --- GUILTY CHARACTER (Yellow Quarter-Slice) ---
  guiltyBase: {
    width: 90,
    height: 90,
    borderTopLeftRadius: 90,
    borderBottomLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: '#FFC72C',
    borderWidth: 2.5,
    borderColor: '#16120F',
    zIndex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 15,
    paddingLeft: 15,
  },
  guiltyEyesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  guiltyEyeball: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#16120F',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    overflow: 'hidden',
  },
  guiltyPupil: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16120F',
    marginTop: 2,
    marginLeft: 2,
  },
  guiltyMouth: {
    width: 18,
    height: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#16120F',
    borderRadius: 6,
    marginRight: 6,
  },
});
