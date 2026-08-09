import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, RefreshControl, Modal, Image, TouchableWithoutFeedback
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import * as Clipboard from 'expo-clipboard';
import useAuthStore from '../store/useAuthStore';
import { API_URL } from '../config';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows, fontFamily, animation } from '../theme/designSystem';
import { AnimatedPressable, StaggeredItem } from '../theme/animations';

export default function AdminPaymentsScreen({ navigation }: any) {
    const { token, setAdminMode } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [payments, setPayments] = useState<any[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const insets = useSafeAreaInsets();

    useEffect(() => {
        fetchPayments(true);
        const unsub = navigation.addListener('focus', () => {
            fetchPayments(true);
        });
        return unsub;
    }, [navigation, token]);

    const refreshAll = async () => {
        setRefreshing(true);
        await fetchPayments(true);
        setTimeout(() => setRefreshing(false), 500);
    };

    const fetchPayments = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/admin/payments/pending`, { headers: { Authorization: `Bearer ${token}` } });
            setPayments(res.data);
        } catch (e) { console.error(e); }
        finally { if (!silent) setLoading(false); }
    };

    const handleAction = async (id: string, action: 'approve' | 'reject') => {
        try {
            await axios.post(`${API_URL}/api/admin/payments/${id}/${action}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            setPayments(p => p.filter(i => i.id !== id));
        } catch (e: any) { Alert.alert('Error', 'Action failed'); }
    };

    return (
        <View style={styles.screen}>
            <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Top-Up Payments</Text>
                    <TouchableOpacity 
                        style={styles.exitAdminBtn} 
                        onPress={() => setAdminMode(false)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="log-out-outline" size={14} color={colors.white} style={{ marginRight: 4 }} />
                        <Text style={styles.exitAdminText}>Exit Admin</Text>
                    </TouchableOpacity>
                </View>

                {/* Main Content Area */}
                <ScrollView 
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.peach} />}
                    contentContainerStyle={styles.scrollContent}
                >
                    {loading && (
                        <ActivityIndicator color={colors.peach} style={{ marginVertical: spacing[4] }} />
                    )}

                    {!loading && (
                        <View style={styles.sectionContainer}>
                            {payments.length > 0 ? (
                                payments.map((pay, i) => (
                                    <StaggeredItem key={pay.id} index={i} style={styles.reviewCard}>
                                        <View style={styles.cardHeaderRow}>
                                            <Ionicons name="cash" size={20} color={colors.lime} />
                                            <View style={styles.cardHeaderInfo}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <Text style={styles.cardTitle}>₹{pay.amount} BUG's Recharge</Text>
                                                    {/* Payment Method Badge */}
                                                    {pay.payment_method === 'cashfree' ? (
                                                        <View style={styles.cfBadge}>
                                                            <Ionicons name="checkmark-circle" size={11} color="#fff" style={{ marginRight: 3 }} />
                                                            <Text style={styles.cfBadgeText}>Cashfree Auto</Text>
                                                        </View>
                                                    ) : (
                                                        <View style={styles.upiBadge}>
                                                            <Text style={styles.upiBadgeText}>UPI Manual</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={styles.cardUser}>by @{pay.users?.username}</Text>
                                                <TouchableOpacity 
                                                    style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}
                                                    onPress={() => {
                                                        Clipboard.setStringAsync(pay.utr_number || pay.cashfree_order_id);
                                                        Alert.alert('Copied', `Copied to clipboard!`);
                                                    }}
                                                >
                                                    <Text style={styles.utrText}>
                                                        {pay.payment_method === 'cashfree' ? 'Order' : 'UTR'}: {pay.utr_number || pay.cashfree_order_id}
                                                    </Text>
                                                    <Ionicons name="copy-outline" size={12} color={colors.blue} style={{ marginLeft: 4 }} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* View proof — for UPI show screenshot, for Cashfree show order ID info */}
                                        {pay.payment_method === 'cashfree' ? (
                                            <View style={[styles.viewMediaBtn, { backgroundColor: colors.lime, borderRadius: radii.lg }]}>
                                                <Ionicons name="shield-checkmark" size={16} color={colors.black} />
                                                <Text style={[styles.viewMediaText, { color: colors.black }]}>Auto-Verified by Cashfree</Text>
                                            </View>
                                        ) : (
                                            <TouchableOpacity style={styles.viewMediaBtn} onPress={() => setPreviewUrl(pay.screenshot_url)}>
                                                <Ionicons name="document" size={16} color={colors.black} />
                                                <Text style={styles.viewMediaText}>View Receipt Proof</Text>
                                            </TouchableOpacity>
                                        )}

                                        <View style={styles.cardActions}>
                                            <AnimatedPressable style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleAction(pay.id, 'reject')} scaleTo={animation.pressScale}>
                                                <Text style={styles.rejectText}>Reject</Text>
                                            </AnimatedPressable>
                                            {/* Cashfree payments are auto-credited — no manual confirm needed */}
                                            {pay.payment_method === 'cashfree' ? (
                                                <View style={[styles.actionBtn, { backgroundColor: colors.lime, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 4 }]}>
                                                    <Ionicons name="checkmark-circle" size={14} color={colors.black} />
                                                    <Text style={styles.approveText}>Auto-Credited</Text>
                                                </View>
                                            ) : (
                                                <AnimatedPressable style={[styles.actionBtn, styles.approveBtn, { backgroundColor: colors.lime }]} onPress={() => handleAction(pay.id, 'approve')} scaleTo={animation.pressScale}>
                                                    <Text style={styles.approveText}>Confirm Payment</Text>
                                                </AnimatedPressable>
                                            )}
                                        </View>
                                    </StaggeredItem>
                                ))
                            ) : (
                                <View style={styles.emptyState}>
                                    <Ionicons name="card" size={64} color={colors.lavender} />
                                    <Text style={styles.emptyText}>No pending UPI recharges</Text>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
            </View>
            {/* Proof Modal */}
            <Modal visible={!!previewUrl} transparent animationType="fade">
                <TouchableWithoutFeedback onPress={() => setPreviewUrl(null)}>
                    <View style={styles.modalBg}>
                        <TouchableWithoutFeedback>
                            <View style={styles.modalContent}>
                                <TouchableOpacity style={styles.closeBtn} onPress={() => setPreviewUrl(null)}>
                                    <Ionicons name="close-circle" size={32} color={colors.white} />
                                </TouchableOpacity>
                                {previewUrl && (
                                    <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" />
                                )}
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bgPrimary },
    container: { flex: 1, paddingHorizontal: 0 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing[6],
        paddingVertical: spacing[4],
    },
    headerTitle: {
        fontFamily,
        fontSize: typography.size.xl,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    exitAdminBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF3B30',
        paddingHorizontal: spacing[3],
        paddingVertical: 6,
        borderRadius: radii.full,
        ...shadows.sm,
    },
    exitAdminText: {
        fontFamily,
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        color: colors.white,
    },
    content: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing[6], paddingBottom: 160 },
    sectionContainer: { marginTop: spacing[2], marginBottom: spacing[8] },

    reviewCard: {
        backgroundColor: colors.white,
        borderRadius: radii.xl,
        padding: spacing[5],
        marginBottom: spacing[4],
        ...shadows.sm,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing[3],
        marginBottom: spacing[4],
    },
    cardHeaderInfo: {
        flex: 1,
    },
    cardTitle: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.black,
        marginBottom: 2,
    },
    cardUser: {
        fontFamily,
        fontSize: typography.size.sm,
        color: colors.textSecondary,
    },
    utrText: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.textSecondary,
    },
    cfBadge: {
        backgroundColor: '#4B3F72',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radii.sm,
        flexDirection: 'row',
        alignItems: 'center',
    },
    cfBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: typography.weight.bold,
        fontFamily,
    },
    upiBadge: {
        backgroundColor: colors.bgSecondary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: radii.sm,
    },
    upiBadgeText: {
        color: colors.textSecondary,
        fontSize: 9,
        fontWeight: typography.weight.bold,
        fontFamily,
    },
    viewMediaBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgSecondary,
        paddingVertical: spacing[3],
        borderRadius: radii.lg,
        gap: spacing[2],
        marginBottom: spacing[4],
    },
    viewMediaText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    cardActions: {
        flexDirection: 'row',
        gap: spacing[3],
    },
    actionBtn: {
        flex: 1,
        height: 48,
        borderRadius: radii.lg,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.sm,
    },
    rejectBtn: {
        backgroundColor: colors.peach,
    },
    approveBtn: {
        backgroundColor: colors.lime,
    },
    rejectText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    approveText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    
    emptyState: {
        paddingVertical: 80,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[3],
    },
    emptyText: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.textMuted,
    },
    modalBg: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '90%',
        height: '80%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewImage: {
        width: '100%',
        height: '100%',
        borderRadius: radii.xl,
    },
    closeBtn: {
        position: 'absolute',
        top: -40,
        right: 0,
        zIndex: 10,
    }
});
