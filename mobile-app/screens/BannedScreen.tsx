import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useAuthStore from '../store/useAuthStore';
import { colors, typography, spacing, radii, sharedStyles, shadows } from '../theme/designSystem';
import { AnimatedPressable } from '../theme/animations';
import { COPY } from '../theme/copy';
import Y2KCharacter from '../theme/Y2KCharacter';

export default function BannedScreen() {
    const { logout } = useAuthStore();

    return (
        <SafeAreaView style={[sharedStyles.screen, { backgroundColor: colors.pink + '08' }]}>
            <View style={styles.container}>
                <View style={styles.iconContainer}>
                    <Y2KCharacter type="angry" size={100} animate={true} />
                </View>


                <View style={styles.textContainer}>
                    <Text style={styles.title}>{COPY.banned.title}</Text>
                    <Text style={styles.subtitle}>{COPY.banned.body}</Text>
                </View>

                <View style={styles.infoBox}>
                    <View style={styles.infoRow}>
                        <Ionicons name="shield-checkmark" size={16} color={colors.textMuted} />
                        <Text style={styles.infoText}>System-wide restriction enabled</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="time" size={16} color={colors.textMuted} />
                        <Text style={styles.infoText}>Duration: Permanent</Text>
                    </View>
                </View>

                <View style={styles.footer}>
                    <AnimatedPressable 
                        style={[sharedStyles.primaryButton, { backgroundColor: colors.pink }]}
                        onPress={logout}
                    >
                        <Text style={[sharedStyles.primaryButtonText, { color: colors.white }]}>Logout & Close</Text>
                        <Ionicons name="exit" size={20} color={colors.white} />
                    </AnimatedPressable>
                    <TouchableOpacity style={styles.supportBtn}>
                        <Text style={styles.supportText}>Contact Support</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing[8],
    },
    iconContainer: {
        marginBottom: spacing[10],
        alignItems: 'center',
        justifyContent: 'center',
    },
    pulseBg: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: colors.pink + '15',
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: spacing[8],
    },
    title: {
        fontSize: typography.size.xl,
        fontWeight: typography.weight.black,
        color: colors.pink,
        marginBottom: spacing[3],
        textAlign: 'center',
    },
    subtitle: {
        fontSize: typography.size.base,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    infoBox: {
        backgroundColor: colors.white,
        borderRadius: radii.xl,
        padding: spacing[5],
        width: '100%',
        marginBottom: spacing[10],
        ...shadows.sm,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        marginVertical: spacing[1],
    },
    infoText: {
        fontSize: typography.size.sm,
        color: colors.textMuted,
        fontWeight: typography.weight.medium,
    },
    footer: {
        width: '100%',
        gap: spacing[4],
    },
    supportBtn: {
        alignItems: 'center',
        paddingVertical: spacing[3],
    },
    supportText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.textMuted,
        textDecorationLine: 'underline',
    },
});

