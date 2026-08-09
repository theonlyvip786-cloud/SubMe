import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import * as Clipboard from 'expo-clipboard';
import useAuthStore from '../store/useAuthStore';
import { API_URL } from '../config';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows, fontFamily, animation } from '../theme/designSystem';
import { AnimatedPressable } from '../theme/animations';

export default function AdminAnalyticsScreen({ navigation }: any) {
    const { token, setAdminMode } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [stats, setStats] = useState({ totalUsers: 0, pendingSubmissions: 0, pendingPayments: 0, totalPoints: 0 });
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [selectedBarIdx, setSelectedBarIdx] = useState<number | null>(null);

    const insets = useSafeAreaInsets();

    useEffect(() => {
        fetchAnalytics();
        const unsub = navigation.addListener('focus', () => {
            fetchAnalytics(true);
        });
        return unsub;
    }, [navigation, token]);

    const refreshAll = async () => {
        setRefreshing(true);
        await fetchAnalytics(true);
        setTimeout(() => setRefreshing(false), 500);
    };

    const fetchAnalytics = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/admin/analytics`, { headers: { Authorization: `Bearer ${token}` } });
            setAnalyticsData(res.data);
            if (res.data?.stats) {
                setStats(res.data.stats);
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const exportTransactionsCSV = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_URL}/api/admin/transactions/export`, { headers: { Authorization: `Bearer ${token}` } });
            if (res.data && res.data.csv) {
                await Clipboard.setStringAsync(res.data.csv);
                Alert.alert('Export Successful', 'Full transaction ledger has been copied as CSV to your clipboard! You can paste it into Excel or any notes app.');
            } else {
                throw new Error('Invalid CSV payload');
            }
        } catch (e: any) {
            Alert.alert('Export Failed', e.message || 'Unable to export ledger.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.screen}>
            <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Analytics</Text>
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
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.blue} />}
                    contentContainerStyle={styles.scrollContent}
                >
                    {loading && (
                        <ActivityIndicator color={colors.blue} style={{ marginVertical: spacing[4] }} />
                    )}

                    {!loading && (
                        <View style={styles.sectionContainer}>
                            {/* Key Stats Cards */}
                            <View style={styles.bentoGrid}>
                                <View style={[styles.bentoCard, { backgroundColor: colors.lavender }]}>
                                    <View style={styles.bentoCardHeader}>
                                        <Ionicons name="people" size={18} color={colors.black} />
                                        <Text style={styles.bentoCardTitle}>Users</Text>
                                    </View>
                                    <Text style={styles.bentoCardValue}>{stats.totalUsers}</Text>
                                    <Text style={styles.bentoCardSub}>Registered accounts</Text>
                                </View>

                                <View style={[styles.bentoCard, { backgroundColor: colors.peach }]}>
                                    <View style={styles.bentoCardHeader}>
                                        <Ionicons name="cash" size={18} color={colors.black} />
                                        <Text style={styles.bentoCardTitle}>Circulation</Text>
                                    </View>
                                    <Text style={styles.bentoCardValue}>{(analyticsData?.stats?.totalPoints || 0).toLocaleString()}</Text>
                                    <Text style={styles.bentoCardSub}>BUG's (~₹{(analyticsData?.stats?.totalPoints || 0).toLocaleString()} INR)</Text>
                                </View>
                            </View>

                            <View style={[styles.bentoGrid, { marginTop: spacing[3] }]}>
                                <View style={[styles.bentoCard, { backgroundColor: colors.lime }]}>
                                    <View style={styles.bentoCardHeader}>
                                        <Ionicons name="checkmark-done-circle" size={18} color={colors.black} />
                                        <Text style={styles.bentoCardTitle}>Task Submissions</Text>
                                    </View>
                                    <Text style={styles.bentoCardValue}>{stats.pendingSubmissions}</Text>
                                    <Text style={styles.bentoCardSub}>Pending reviews</Text>
                                </View>

                                <View style={[styles.bentoCard, { backgroundColor: colors.blue }]}>
                                    <View style={styles.bentoCardHeader}>
                                        <Ionicons name="wallet" size={18} color={colors.white} />
                                        <Text style={[styles.bentoCardTitle, { color: colors.white }]}>Payments</Text>
                                    </View>
                                    <Text style={[styles.bentoCardValue, { color: colors.white }]}>{stats.pendingPayments}</Text>
                                    <Text style={[styles.bentoCardSub, { color: 'rgba(255,255,255,0.75)' }]}>Pending top-ups</Text>
                                </View>
                            </View>

                            {/* Point Activity Visual Bar Chart */}
                            <View style={styles.chartCard}>
                                <View style={styles.chartHeaderRow}>
                                    <View>
                                        <Text style={styles.chartTitle}>Economy Activity</Text>
                                        <Text style={styles.chartSubTitle}>BUG's Circulation & Velocity</Text>
                                    </View>
                                    
                                    <View style={styles.timeframeToggle}>
                                        {(['daily', 'weekly', 'monthly'] as const).map(tf => (
                                            <TouchableOpacity 
                                                key={tf} 
                                                style={[styles.toggleBtn, timeframe === tf && styles.toggleBtnActive]}
                                                onPress={() => {
                                                    setTimeframe(tf);
                                                    setSelectedBarIdx(null);
                                                }}
                                            >
                                                <Text style={[styles.toggleBtnText, timeframe === tf && styles.toggleBtnTextActive]}>
                                                    {tf.toUpperCase()}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                {/* Dynamic Selected Bar Callout Banner */}
                                {(() => {
                                    const rawData = analyticsData?.charts?.[timeframe] || [];
                                    const emptyFallback = timeframe === 'daily'
                                        ? Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return { label: d.toLocaleDateString('en-US', { weekday: 'short' }), earned: 0, spent: 0 }; })
                                        : timeframe === 'weekly'
                                        ? Array.from({ length: 4 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (3 - i) * 7); const start = new Date(d); start.setDate(start.getDate() - start.getDay()); return { label: `Wk of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, earned: 0, spent: 0 }; })
                                        : Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); return { label: d.toLocaleDateString('en-US', { month: 'short' }), earned: 0, spent: 0 }; });

                                    const chartData = rawData.length > 0 ? rawData : emptyFallback;
                                    const activeIdx = selectedBarIdx !== null ? selectedBarIdx : chartData.length - 1;
                                    const activeItem = chartData[activeIdx] || chartData[0];
                                    const net = (activeItem?.earned || 0) - (activeItem?.spent || 0);

                                    return (
                                        <View style={styles.activeCalloutCard}>
                                            <View style={styles.activeCalloutLeft}>
                                                <Text style={styles.activeCalloutLabel}>{activeItem?.label || 'Period'}</Text>
                                                <Text style={styles.activeCalloutNet}>
                                                    Net: <Text style={{ color: net >= 0 ? '#10B981' : '#F43F5E', fontWeight: '800' }}>{net >= 0 ? `+${net}` : net} BUG's</Text>
                                                </Text>
                                            </View>
                                            
                                            <View style={styles.activeCalloutRight}>
                                                <View style={styles.legendItem}>
                                                    <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                                                    <Text style={[styles.legendLabel, { color: '#059669' }]}>+{activeItem?.earned || 0}</Text>
                                                </View>
                                                <View style={styles.legendItem}>
                                                    <View style={[styles.legendDot, { backgroundColor: '#F43F5E' }]} />
                                                    <Text style={[styles.legendLabel, { color: '#E11D48' }]}>-{activeItem?.spent || 0}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })()}

                                <View style={styles.chartWrapper}>
                                    {/* Grid Lines */}
                                    <View style={styles.gridLinesContainer}>
                                        <View style={styles.gridLineRow}>
                                            <View style={styles.gridLine} />
                                        </View>
                                        <View style={styles.gridLineRow}>
                                            <View style={styles.gridLine} />
                                        </View>
                                        <View style={styles.gridLineRow}>
                                            <View style={styles.gridLine} />
                                        </View>
                                        <View style={styles.gridLineRow}>
                                            <View style={styles.gridLine} />
                                        </View>
                                    </View>

                                    <View style={styles.barsContainer}>
                                        {(() => {
                                            const rawData = analyticsData?.charts?.[timeframe] || [];
                                            const emptyFallback = timeframe === 'daily'
                                                ? Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return { label: d.toLocaleDateString('en-US', { weekday: 'short' }), earned: 0, spent: 0 }; })
                                                : timeframe === 'weekly'
                                                ? Array.from({ length: 4 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (3 - i) * 7); const start = new Date(d); start.setDate(start.getDate() - start.getDay()); return { label: `Wk of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, earned: 0, spent: 0 }; })
                                                : Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - i)); return { label: d.toLocaleDateString('en-US', { month: 'short' }), earned: 0, spent: 0 }; });

                                            const chartData = rawData.length > 0 ? rawData : emptyFallback;
                                            const maxVal = Math.max(...chartData.map((d: any) => Math.max(d.earned, d.spent)), 10);
                                            const activeIdx = selectedBarIdx !== null ? selectedBarIdx : chartData.length - 1;

                                            return chartData.map((d: any, idx: number) => {
                                                const earnedHeight = d.earned > 0 ? Math.max((d.earned / maxVal) * 100, 6) : 0;
                                                const spentHeight = d.spent > 0 ? Math.max((d.spent / maxVal) * 100, 6) : 0;
                                                const isSelected = activeIdx === idx;
                                                const isZero = d.earned === 0 && d.spent === 0;

                                                return (
                                                    <TouchableOpacity 
                                                        key={idx} 
                                                        style={[styles.barGroup, isSelected && styles.barGroupSelected]}
                                                        onPress={() => setSelectedBarIdx(idx)}
                                                        activeOpacity={0.8}
                                                    >
                                                        <View style={styles.barsRow}>
                                                            {isZero ? (
                                                                <View style={styles.zeroBaselineDot} />
                                                            ) : (
                                                                <>
                                                                    {/* Earned Bar */}
                                                                    <View style={styles.barOuter}>
                                                                        {earnedHeight > 0 && (
                                                                            <View style={[
                                                                                styles.barInner, 
                                                                                { 
                                                                                    height: earnedHeight, 
                                                                                    backgroundColor: '#10B981',
                                                                                    opacity: isSelected ? 1 : 0.85,
                                                                                }
                                                                            ]} />
                                                                        )}
                                                                    </View>
                                                                    {/* Spent Bar */}
                                                                    <View style={styles.barOuter}>
                                                                        {spentHeight > 0 && (
                                                                            <View style={[
                                                                                styles.barInner, 
                                                                                { 
                                                                                    height: spentHeight, 
                                                                                    backgroundColor: '#F43F5E',
                                                                                    opacity: isSelected ? 1 : 0.85,
                                                                                }
                                                                            ]} />
                                                                        )}
                                                                    </View>
                                                                </>
                                                            )}
                                                        </View>
                                                        <Text style={[styles.barLabel, isSelected && styles.barLabelSelected]}>{d.label}</Text>
                                                    </TouchableOpacity>
                                                );
                                            });
                                        })()}
                                    </View>
                                </View>
                            </View>

                            {/* Audit Ledger Export Card */}
                            <View style={styles.exportCard}>
                                <View style={styles.exportCardIconBadge}>
                                    <Ionicons name="shield-checkmark" size={24} color={colors.blue} />
                                </View>
                                <Text style={styles.exportTitle}>System Audit & Ledger</Text>
                                <Text style={styles.exportDesc}>
                                    Export the complete immutable transaction ledger as a CSV file to inspect referral credits, payouts, or account tasks.
                                </Text>
                                <AnimatedPressable 
                                    style={styles.exportBtn} 
                                    onPress={exportTransactionsCSV} 
                                    scaleTo={animation.pressScale}
                                >
                                    <Ionicons name="cloud-download" size={18} color={colors.white} style={{ marginRight: 6 }} />
                                    <Text style={styles.exportBtnText}>Copy CSV Ledger</Text>
                                </AnimatedPressable>
                            </View>
                        </View>
                    )}
                </ScrollView>
            </View>
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

    bentoGrid: { flexDirection: 'row', gap: spacing[3] },
    bentoCard: {
        flex: 1,
        borderRadius: radii.xl,
        padding: spacing[4],
        ...shadows.sm,
    },
    bentoCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginBottom: spacing[2],
    },
    bentoCardTitle: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    bentoCardValue: {
        fontFamily,
        fontSize: typography.size['2xl'],
        fontWeight: typography.weight.bold,
        color: colors.black,
        marginBottom: 2,
    },
    bentoCardSub: {
        fontFamily,
        fontSize: typography.size.xs,
        color: 'rgba(0,0,0,0.6)',
    },

    chartCard: {
        backgroundColor: colors.white,
        borderRadius: radii.xl,
        padding: spacing[5],
        marginTop: spacing[4],
        ...shadows.sm,
    },
    chartHeaderRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing[2],
        marginBottom: spacing[4],
    },
    chartTitle: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    chartSubTitle: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.textSecondary,
        marginTop: 2,
    },
    timeframeToggle: {
        flexDirection: 'row',
        backgroundColor: colors.bgSecondary,
        borderRadius: radii.md,
        padding: 2,
    },
    toggleBtn: {
        paddingHorizontal: spacing[2.5],
        paddingVertical: spacing[1],
        borderRadius: radii.sm,
    },
    toggleBtnActive: {
        backgroundColor: colors.white,
        ...shadows.sm,
    },
    toggleBtnText: {
        fontFamily,
        fontSize: 10,
        fontWeight: typography.weight.bold,
        color: colors.textMuted,
    },
    toggleBtnTextActive: {
        color: colors.black,
    },

    activeCalloutCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.bgSecondary,
        borderRadius: radii.lg,
        padding: spacing[3],
        marginBottom: spacing[5],
    },
    activeCalloutLeft: {},
    activeCalloutLabel: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    activeCalloutNet: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    activeCalloutRight: {
        flexDirection: 'row',
        gap: spacing[4],
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[1.5],
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendLabel: {
        fontFamily,
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        color: colors.textSecondary,
    },

    chartWrapper: {
        height: 180,
        position: 'relative',
        marginTop: spacing[2],
    },
    gridLinesContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-between',
    },
    gridLineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 1,
    },
    gridLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
        opacity: 0.5,
    },
    barsContainer: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: spacing[2],
    },
    barGroup: {
        alignItems: 'center',
        width: 36,
        height: '100%',
        justifyContent: 'flex-end',
    },
    barGroupSelected: {
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderRadius: radii.sm,
    },
    barsRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 2,
        height: 140,
        width: '100%',
    },
    barOuter: {
        width: 12,
        height: '100%',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    barInner: {
        width: '100%',
        borderRadius: radii.sm,
    },
    zeroBaselineDot: {
        width: 12,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        marginBottom: 2,
    },
    barLabel: {
        fontFamily,
        fontSize: 10,
        color: colors.textMuted,
        marginTop: spacing[2],
        marginBottom: spacing[2],
        textAlign: 'center',
    },
    barLabelSelected: {
        color: colors.black,
        fontWeight: typography.weight.bold,
    },

    exportCard: {
        backgroundColor: colors.white,
        borderRadius: radii.xl,
        padding: spacing[5],
        marginTop: spacing[6],
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.sm,
    },
    exportCardIconBadge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.bgSecondary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing[3],
    },
    exportTitle: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.black,
        marginBottom: spacing[2],
        textAlign: 'center',
    },
    exportDesc: {
        fontFamily,
        fontSize: typography.size.sm,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: spacing[4],
    },
    exportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.black,
        paddingHorizontal: spacing[6],
        paddingVertical: spacing[3],
        borderRadius: radii.lg,
        width: '100%',
    },
    exportBtnText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.white,
    },
});
