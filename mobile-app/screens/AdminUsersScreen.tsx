import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, Modal, Image, RefreshControl, Animated
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { API_URL } from '../config';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows, fontFamily, animation } from '../theme/designSystem';
import { AnimatedPressable } from '../theme/animations';
import Y2KNote from '../theme/Y2KNote';
import { AppTextInput, InputBox } from '../theme/inputs';

export default function AdminUsersScreen({ navigation }: any) {
    const { token, user, setAdminMode } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    
    // Credit Modal State
    const [creditModalVisible, setCreditModalVisible] = useState(false);
    const [creditTargetUser, setCreditTargetUser] = useState<any>(null);
    const [creditAmount, setCreditAmount] = useState('');
    
    // Gift Popup State
    const [giftPopupVisible, setGiftPopupVisible] = useState(false);
    const [giftPopupData, setGiftPopupData] = useState<{ username: string; amount: number; isDeduction: boolean } | null>(null);
    const giftScale = useRef(new Animated.Value(0)).current;
    const giftOpacity = useRef(new Animated.Value(0)).current;

    const showGiftPopup = (username: string, amount: number, isDeduction: boolean) => {
        setGiftPopupData({ username, amount, isDeduction });
        setGiftPopupVisible(true);
        giftScale.setValue(0);
        giftOpacity.setValue(0);
        Animated.parallel([
            Animated.spring(giftScale, { toValue: 1, friction: 4, tension: 100, useNativeDriver: true }),
            Animated.timing(giftOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
        setTimeout(() => {
            Animated.parallel([
                Animated.spring(giftScale, { toValue: 0, friction: 6, tension: 80, useNativeDriver: true }),
                Animated.timing(giftOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]).start(() => setGiftPopupVisible(false));
        }, 3000);
    };

    const insets = useSafeAreaInsets();

    useFocusEffect(
        useCallback(() => {
            searchUsers();
        }, [query])
    );

    const searchUsers = async (searchQuery?: string) => {
        const q = searchQuery !== undefined ? searchQuery : query;
        setLoading(true);
        try {
            const qParam = q.trim().length >= 2 ? encodeURIComponent(q.trim()) : '';
            const res = await axios.get(`${API_URL}/api/admin/users/search?q=${qParam}`, { headers: { Authorization: `Bearer ${token}` } });
            setUsers(res.data || []);
        } catch (e) { Alert.alert('Error', 'Failed to fetch users'); }
        finally { setLoading(false); setRefreshing(false); }
    };

    const onRefresh = () => {
        setRefreshing(true);
        searchUsers();
    };

    const submitCredit = async () => {
        if (!creditTargetUser || !creditAmount || isNaN(Number(creditAmount))) return;
        const parsedAmount = parseInt(creditAmount);
        if (parsedAmount === 0) return;
        const isDeduction = parsedAmount < 0;
        setLoading(true);
        try {
            await axios.post(`${API_URL}/api/admin/users/credit`, {
                userId: creditTargetUser.id,
                amount: parsedAmount,
                description: isDeduction ? 'Manual deduction by admin' : 'Manual credit from User Management'
            }, { headers: { Authorization: `Bearer ${token}` } });
            
            setCreditModalVisible(false);
            setCreditAmount('');
            const targetUsername = creditTargetUser.username;
            setCreditTargetUser(null);
            searchUsers(); // Refresh the list
            
            // Show beautiful gift popup instead of plain Alert
            showGiftPopup(targetUsername, Math.abs(parsedAmount), isDeduction);
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.error || (isDeduction ? 'Failed to deduct BUGs' : 'Failed to credit BUGs'));
        } finally {
            setLoading(false);
        }
    };

    const toggleBanStatus = async (targetUser: any) => {
        const action = targetUser.status === 'banned' ? 'unban' : 'ban';
        Alert.alert(
            action === 'ban' ? 'Ban User' : 'Unban User',
            `Are you sure you want to ${action} @${targetUser.username}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm', 
                    style: action === 'ban' ? 'destructive' : 'default',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const res = await axios.post(`${API_URL}/api/admin/users/${targetUser.id}/ban`, { action }, { headers: { Authorization: `Bearer ${token}` } });
                            setUsers(users.map(u => u.id === targetUser.id ? { ...u, ...res.data } : u));
                            Alert.alert('Success', `User @${targetUser.username} is now ${res.data.status}`);
                        } catch (e) { Alert.alert('Error', 'Failed to update user status'); }
                        finally { setLoading(false); }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.screen}>
            <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>User Management</Text>
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
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.black} />}
                >
                    <View style={styles.sectionContainer}>
                        <View style={styles.searchCard}>
                            <Text style={styles.formTitle}>Search Users</Text>
                            
                            <InputBox style={styles.searchBar}>
                                <Ionicons name="search" size={20} color={colors.textMuted} style={{ marginRight: spacing[2] }} />
                                <AppTextInput
                                    variant="flat"
                                    style={styles.searchInput}
                                    placeholder="Search username or email..."
                                    value={query}
                                    onChangeText={setQuery}
                                    onSubmitEditing={() => searchUsers()}
                                    returnKeyType="search"
                                />
                                {loading ? (
                                    <ActivityIndicator size="small" color={colors.black} />
                                ) : query.length > 0 ? (
                                    <TouchableOpacity onPress={() => { setQuery(''); searchUsers(''); }}>
                                        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                                    </TouchableOpacity>
                                ) : null}
                            </InputBox>
                        </View>

                        {users.length > 0 && (
                            <View style={styles.userListContainer}>
                                {users.map((u) => (
                                    <View key={u.id} style={styles.userCard}>
                                        <View style={styles.userInfoRow}>
                                            <View style={styles.userAvatarBlock}>
                                                <Text style={styles.avatarText}>{(u.username || '?')[0].toUpperCase()}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Text style={styles.userRowUsername}>@{u.username}</Text>
                                                    {u.is_premium && (
                                                        <View style={styles.premiumBadge}>
                                                            <Ionicons name="sparkles" size={10} color={colors.black} />
                                                            <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={styles.userRowEmail}>{u.email}</Text>
                                            </View>
                                            <View style={[styles.statusBadge, { backgroundColor: u.status === 'banned' ? colors.pink : colors.lime }]}>
                                                <Text style={styles.statusBadgeText}>{u.status?.toUpperCase() || 'ACTIVE'}</Text>
                                            </View>
                                        </View>
                                        
                                        <View style={styles.userStatsRow}>
                                            <View style={[styles.userStatBlock, { flex: 1 }]}>
                                                <Y2KNote size={14} style={{ marginRight: 6 }} />
                                                <Text style={styles.userStatText}>{u.points} BUG's</Text>
                                            </View>
                                            <View style={[styles.userStatBlock, { flex: 1 }]}>
                                                <Ionicons name="gift" size={14} color={colors.charcoal} style={{ marginRight: 6 }} />
                                                <Text style={styles.userStatText} numberOfLines={1} ellipsizeMode="tail">{u.referral_code}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.cardActionsRow}>
                                            <AnimatedPressable 
                                                style={[styles.banBtn, { flex: 1, backgroundColor: colors.peach, marginRight: spacing[3] }]} 
                                                onPress={() => { setCreditTargetUser(u); setCreditModalVisible(true); }} 
                                                scaleTo={animation.pressScale}
                                            >
                                                <Ionicons name="add-circle" size={16} color={colors.black} style={{ marginRight: 6 }} />
                                                <Text style={[styles.banBtnText, { color: colors.black }]}>Add / Remove BUG's</Text>
                                            </AnimatedPressable>

                                            <AnimatedPressable 
                                                style={[styles.banBtn, { flex: 1, backgroundColor: u.status === 'banned' ? colors.lavender : colors.black }]} 
                                                onPress={() => toggleBanStatus(u)} 
                                                scaleTo={animation.pressScale}
                                            >
                                                <Ionicons name={u.status === 'banned' ? 'shield-checkmark' : 'shield'} size={16} color={u.status === 'banned' ? colors.black : colors.white} style={{ marginRight: 6 }} />
                                                <Text style={[styles.banBtnText, { color: u.status === 'banned' ? colors.black : colors.white }]}>
                                                    {u.status === 'banned' ? 'Unban User' : 'Ban User'}
                                                </Text>
                                            </AnimatedPressable>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}
                        
                        {!loading && query.length > 2 && users.length === 0 && (
                             <View style={styles.emptyState}>
                                 <Ionicons name="search-outline" size={48} color={colors.textMuted} />
                                 <Text style={styles.emptyText}>No users found</Text>
                             </View>
                        )}
                    </View>
                </ScrollView>
            </View>
            
            {/* Credit BUGs Modal */}
            <Modal 
                visible={creditModalVisible} 
                transparent 
                animationType="fade"
                onRequestClose={() => setCreditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <TouchableOpacity 
                        style={StyleSheet.absoluteFill} 
                        activeOpacity={1} 
                        onPress={() => setCreditModalVisible(false)} 
                    />
                    <View style={styles.modalContent}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[4] }}>
                            <Text style={styles.modalTitle}>Modify BUG's</Text>
                            <TouchableOpacity onPress={() => setCreditModalVisible(false)}>
                                <Ionicons name="close" size={20} color={colors.black} />
                            </TouchableOpacity>
                        </View>
                        <Text style={{ fontFamily, fontSize: typography.size.sm, color: colors.textSecondary, marginBottom: spacing[4] }}>
                            Ref Account: <Text style={{ fontWeight: typography.weight.bold, color: colors.black }}>@{creditTargetUser?.username}</Text>
                        </Text>

                        <Text style={styles.formTitle}>Amount (Use - to remove)</Text>
                        <InputBox style={{ marginBottom: 16 }}>
                            <AppTextInput 
                                variant="flat"
                                placeholder="e.g. 50 (add) or -50 (remove)"
                                keyboardType="numbers-and-punctuation"
                                value={creditAmount}
                                onChangeText={setCreditAmount}
                            />
                        </InputBox>
                        
                        <View style={{ flexDirection: 'row', gap: 12, marginTop: spacing[2] }}>
                            <TouchableOpacity 
                                style={[styles.modalBtn, { backgroundColor: colors.bgSecondary }]} 
                                onPress={() => setCreditModalVisible(false)}
                            >
                                <Text style={styles.modalBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalBtn, { backgroundColor: colors.lime }]} 
                                onPress={submitCredit}
                            >
                                <Text style={styles.modalBtnText}>Submit Credit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 🎁 Gift Popup Overlay */}
            {giftPopupVisible && giftPopupData && (
                <Modal transparent visible={giftPopupVisible} animationType="none">
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' }}>
                        <Animated.View style={{
                            opacity: giftOpacity,
                            transform: [{ scale: giftScale }],
                            backgroundColor: colors.white,
                            borderRadius: radii['2xl'],
                            padding: spacing[8],
                            alignItems: 'center',
                            width: 300,
                            ...shadows.lg,
                        }}>
                            {/* Big emoji/icon */}
                            <View style={{
                                width: 80, height: 80, borderRadius: 40,
                                backgroundColor: giftPopupData.isDeduction ? '#fee2e2' : '#dcfce7',
                                justifyContent: 'center', alignItems: 'center', marginBottom: spacing[4],
                            }}>
                                <Text style={{ fontSize: 40 }}>{giftPopupData.isDeduction ? '💸' : '🎁'}</Text>
                            </View>
                            <Text style={{ fontFamily, fontSize: typography.size.xl, fontWeight: '900', color: colors.black, marginBottom: spacing[2], textAlign: 'center' }}>
                                {giftPopupData.isDeduction ? 'BUGs Removed!' : 'BUGs Sent! 🎉'}
                            </Text>
                            <Text style={{ fontFamily, fontSize: typography.size.base, color: '#6b7280', textAlign: 'center', lineHeight: 22 }}>
                                {giftPopupData.isDeduction
                                    ? `${giftPopupData.amount} BUG's have been removed from @${giftPopupData.username}'s wallet.`
                                    : `You gifted ${giftPopupData.amount} BUG's to @${giftPopupData.username}! They'll love it! 🚀`
                                }
                            </Text>
                            <View style={{
                                marginTop: spacing[5],
                                backgroundColor: giftPopupData.isDeduction ? '#ef4444' : colors.lime,
                                paddingHorizontal: spacing[6],
                                paddingVertical: spacing[3],
                                borderRadius: radii.full,
                            }}>
                                <Text style={{ fontFamily, fontWeight: '900', fontSize: typography.size.lg, color: giftPopupData.isDeduction ? colors.white : colors.black }}>
                                    {giftPopupData.isDeduction ? `-${giftPopupData.amount}` : `+${giftPopupData.amount}`} BUG's
                                </Text>
                            </View>
                        </Animated.View>
                    </View>
                </Modal>
            )}
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
    
    searchCard: {
        paddingVertical: spacing[4],
        borderBottomWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        marginBottom: spacing[4],
    },
    formTitle: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.black,
        marginBottom: spacing[4],
    },
    searchBar: {
        minHeight: 52,
        marginBottom: spacing[4],
    },
    searchInput: {
        flex: 1,
        fontSize: typography.size.sm,
        color: colors.textPrimary,
    },
    searchBtn: {
        height: 52,
        borderRadius: radii.lg,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.sm,
    },
    searchBtnText: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.white,
    },
    
    userListContainer: { gap: spacing[4] },
    userCard: {
        paddingVertical: spacing[5],
        borderBottomWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        marginBottom: spacing[2],
    },
    userInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        marginBottom: spacing[4],
    },
    userAvatarBlock: {
        width: 44,
        height: 44,
        borderRadius: radii.sm,
        backgroundColor: colors.black,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: colors.white,
        fontWeight: typography.weight.bold,
        fontSize: typography.size.lg,
        fontFamily,
    },
    userRowUsername: {
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    userRowEmail: {
        fontSize: typography.size.sm,
        color: colors.textMuted,
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1],
        borderRadius: radii.full,
    },
    statusBadgeText: {
        fontSize: 10,
        fontWeight: typography.weight.bold,
        color: colors.black,
        fontFamily,
    },
    
    userStatsRow: {
        flexDirection: 'row',
        gap: spacing[4],
        marginBottom: spacing[4],
        paddingTop: spacing[4],
        borderTopWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    userStatBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgSecondary,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        borderRadius: radii.md,
    },
    userStatText: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    
    banBtn: {
        flexDirection: 'row',
        height: 48,
        borderRadius: radii.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    banBtnText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
    },
    
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing[12],
    },
    emptyText: {
        marginTop: spacing[4],
        fontFamily,
        fontSize: typography.size.sm,
        color: colors.textMuted,
    },
    
    // New Styles
    cardActionsRow: { flexDirection: 'row' },
    premiumBadge: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: colors.yellow, 
        paddingHorizontal: 6, 
        paddingVertical: 2, 
        borderRadius: radii.sm, 
        marginLeft: 6 
    },
    premiumBadgeText: { fontSize: 8, fontWeight: 'bold', marginLeft: 2, fontFamily },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing[6] },
    modalContent: { backgroundColor: colors.white, width: '100%', padding: spacing[6], borderRadius: radii.xl },
    modalTitle: { fontFamily, fontSize: 18, fontWeight: 'bold', marginBottom: spacing[4] },
    modalBtn: { flex: 1, padding: spacing[4], borderRadius: radii.lg, alignItems: 'center' },
    modalBtnText: { fontFamily, fontWeight: 'bold', color: colors.black },
});
