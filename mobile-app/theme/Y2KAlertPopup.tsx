import React, { useEffect, useRef } from 'react';
import {
  Modal, View, Text, StyleSheet, Animated, Dimensions,
  TouchableWithoutFeedback, KeyboardAvoidingView, Platform
} from 'react-native';
import { colors, radii, spacing, fontFamily, typography, shadows } from './designSystem';
import Y2KCharacter, { CharacterType } from './Y2KCharacter';
import { AnimatedPressable } from './animations';

const { width: SCREEN_W } = Dimensions.get('window');

interface Y2KAlertPopupProps {
  visible: boolean;
  onClose: () => void;
  characterType: CharacterType | 'none';
  title: string;
  description: string;
  actionText?: string;
}

export default function Y2KAlertPopup({
  visible,
  onClose,
  characterType,
  title,
  description,
  actionText = 'Ok, Got it!',
}: Y2KAlertPopupProps) {
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 80,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.7);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.modalCard,
                {
                  opacity: opacityAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              {/* Outer Neobrutalist shadow block behind the card */}
              <View style={styles.cardShadow} />

              {/* Card Container */}
              <View style={styles.cardBody}>
                {/* Floating Character Container */}
                {characterType !== 'none' && (
                  <View style={styles.characterContainer}>
                    <Y2KCharacter type={characterType as CharacterType} size={90} animate={true} />
                  </View>
                )}

                {/* Text Block */}
                <View style={styles.textBlock}>
                  <Text style={styles.titleText}>{title}</Text>
                  <Text style={styles.descText}>{description}</Text>
                </View>

                {/* Bento Primary Button */}
                <AnimatedPressable
                  style={styles.actionBtn}
                  onPress={onClose}
                  scaleTo={0.96}
                >
                  {/* Button Shadow Block */}
                  <View style={styles.btnShadow} />

                  <View style={styles.btnFace}>
                    <Text style={styles.btnText}>{actionText}</Text>
                  </View>
                </AnimatedPressable>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(22, 18, 15, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  modalCard: {
    width: Math.min(SCREEN_W - spacing[10], 320),
    position: 'relative',
  },
  cardShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: '#16120F',
    borderRadius: radii['2xl'],
  },
  cardBody: {
    backgroundColor: '#F9F9F6', // Parchment warm white
    borderRadius: radii['2xl'],
    borderWidth: 2.5,
    borderColor: '#16120F',
    padding: spacing[6],
    alignItems: 'center',
    zIndex: 1,
  },
  characterContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  textBlock: {
    alignItems: 'center',
    marginBottom: spacing[6],
  },
  titleText: {
    fontFamily,
    fontSize: 22,
    fontWeight: '800',
    color: '#16120F',
    textAlign: 'center',
    marginBottom: spacing[2],
  },
  descText: {
    fontFamily,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing[2],
  },
  actionBtn: {
    width: '100%',
    height: 48,
    position: 'relative',
  },
  btnShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    backgroundColor: '#16120F',
    borderRadius: radii.md,
  },
  btnFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.lime, // Signature chartreuse
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: '#16120F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: '800',
    color: '#16120F',
  },
});
