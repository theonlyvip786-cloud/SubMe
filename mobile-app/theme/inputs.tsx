import React from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { colors, typography, spacing, radii, fontFamily, shadows } from './designSystem';

// Input box background matches screen canvas exactly
const inputBg = colors.white; // #FFFFFF

/** Reference swap/input fields — auth screens */
export const inputBorderAuth = {
  borderWidth: 1,
  borderColor: 'rgba(22, 18, 15, 0.12)',
  borderRadius: radii.lg,
  backgroundColor: inputBg,
} as const;

/** Bento fields elsewhere */
export const inputBorder = {
  borderWidth: 1,
  borderColor: 'rgba(22, 18, 15, 0.12)',
  borderRadius: radii.lg,
  backgroundColor: inputBg,
} as const;

export const noFocusOutline = Platform.select({
  web: {
    outlineStyle: 'none',
    outlineWidth: 0,
    outlineColor: 'transparent',
    boxShadow: 'none',
  } as any,
  default: {},
});

export const inputStyles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing[4],
    minHeight: 52,
    backgroundColor: inputBg,
    borderWidth: 1,
    borderColor: 'rgba(22, 18, 15, 0.12)',
    borderRadius: radii.lg,
    ...shadows.sm,
  },
  boxAuth: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    minHeight: 52,
    backgroundColor: inputBg,
    borderWidth: 1,
    borderColor: 'rgba(22, 18, 15, 0.12)',
    borderRadius: radii.lg,
    ...shadows.sm,
  },
  boxMultiline: {
    alignItems: 'flex-start',
    minHeight: 96,
    paddingVertical: spacing[3],
    backgroundColor: inputBg,
  },
  field: {
    flex: 1,
    fontFamily,
    fontSize: typography.size.base,
    fontWeight: typography.weight.medium,
    color: colors.textPrimary,
    paddingVertical: Platform.OS === 'web' ? 0 : spacing[3],
    borderWidth: 0,
    textAlignVertical: 'center',
    minWidth: 0,
    ...noFocusOutline,
  },
  fieldMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: spacing[2],
  },
  icon: {
    marginRight: spacing[3],
    alignSelf: 'center',
  },
  admin: {
    ...inputBorder,
    backgroundColor: inputBg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 48,
    fontFamily,
    fontSize: typography.size.sm,
    color: colors.textPrimary,
    textAlignVertical: 'center',
    ...noFocusOutline,
    ...shadows.sm,
  },
  standalone: {
    ...inputBorder,
    backgroundColor: inputBg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 48,
    fontFamily,
    fontSize: typography.size.base,
    color: colors.textPrimary,
    textAlignVertical: 'center',
    ...noFocusOutline,
    ...shadows.sm,
  },
  standaloneAuth: {
    ...inputBorderAuth,
    backgroundColor: inputBg,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 48,
    fontFamily,
    fontSize: typography.size.base,
    color: colors.textPrimary,
    textAlignVertical: 'center',
    ...noFocusOutline,
    ...shadows.sm,
  },
});

type InputBoxProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  multiline?: boolean;
  auth?: boolean;
};

export function InputBox({ children, style, multiline, auth }: InputBoxProps) {
  return (
    <View
      style={[
        auth ? inputStyles.boxAuth : inputStyles.box,
        multiline && inputStyles.boxMultiline,
        { backgroundColor: inputBg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type AppTextInputProps = TextInputProps & {
  variant?: 'default' | 'multiline' | 'admin' | 'flat' | 'standalone' | 'standaloneAuth';
};

export function AppTextInput({ style, variant = 'default', ...props }: AppTextInputProps) {
  const base =
    variant === 'admin'
      ? inputStyles.admin
      : variant === 'standaloneAuth'
        ? inputStyles.standaloneAuth
        : variant === 'standalone'
          ? inputStyles.standalone
          : variant === 'multiline'
            ? [inputStyles.field, inputStyles.fieldMultiline]
            : inputStyles.field;

  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      underlineColorAndroid="transparent"
      {...props}
      style={[
        base,
        style,
        noFocusOutline,
        { backgroundColor: 'transparent' }
      ]}
    />
  );
}
