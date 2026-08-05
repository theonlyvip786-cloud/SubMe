import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, Linking, RefreshControl,
    Animated, Dimensions, Platform, Image, Modal, FlatList
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import * as Clipboard from 'expo-clipboard';
import useAuthStore from '../store/useAuthStore';
import { API_URL } from '../config';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, sharedStyles, shadows, fontFamily, animation } from '../theme/designSystem';
import { AnimatedPressable, StaggeredItem } from '../theme/animations';
import Y2KNote from '../theme/Y2KNote';
import { AppTextInput, InputBox } from '../theme/inputs';
import { THUMBNAILS } from '../assets/thumbnails';

type TabType = 'analytics' | 'reviews' | 'payments' | 'tools';

export default function AdminToolsScreen({ navigation, route }: any) {
    const { token, user, setAdminMode } = useAuthStore();
    const [tab, setTab] = useState<TabType>('tools');
    const [loading, setLoading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    // Sub-tab segment controls
    const [reviewSubTab, setReviewSubTab] = useState<'submissions' | 'promotions'>('submissions');
    const [toolsSubTab, setToolsSubTab] = useState<'create' | 'manage' | 'credit' | 'logs' | 'upi'>('create');

    const [upiPayeeName, setUpiPayeeName] = useState('SubMe Admin');
    const [upiHandles, setUpiHandles] = useState<string[]>(['subkaro@axl', 'subkaro@ybl', 'subkaro@ibl']);
    const [newHandleInput, setNewHandleInput] = useState('');
    const [savingUpi, setSavingUpi] = useState(false);

    const [stats, setStats] = useState({ totalUsers: 0, pendingSubmissions: 0, pendingPayments: 0, totalPoints: 0 });
    const [analyticsData, setAnalyticsData] = useState<any>(null);
    const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const [selectedBarIdx, setSelectedBarIdx] = useState<number | null>(null);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [promotions, setPromotions] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [allTasks, setAllTasks] = useState<any[]>([]);
    const [sysLogs, setSysLogs] = useState<any[]>([]);

    const [query, setQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');

    const [newTask, setNewTask] = useState({
        title: '', video_url: '', reward_points: '10', required_watch_time: '180',
        mcq_question: '', mcq_options: ['', '', '', ''], mcq_answer: '', is_vip: false,
        thumbnail_id: '' as string
    });
    const [showThumbPicker, setShowThumbPicker] = useState(false);
    const { width: screenWidth } = Dimensions.get('window');
    const THUMB_ITEM_SIZE = (screenWidth - 48 - 16 * 2) / 3; // 3 columns with padding

    const insets = useSafeAreaInsets();

    useEffect(() => {
        Promise.all([fetchStats(), refreshData(true)]);
        const unsub = navigation.addListener('focus', () => {
            Promise.all([fetchStats(), refreshData(true)]);
        });
        return unsub;
    }, [navigation, token, tab, reviewSubTab, toolsSubTab]);

    const refreshAll = async () => {
        setRefreshing(true);
        await Promise.all([fetchStats(), refreshData(true)]);
        setTimeout(() => setRefreshing(false), 500);
    };

    const refreshData = async (silent = false) => {
        if (tab === 'analytics') await fetchAnalytics(silent);
        if (tab === 'reviews') {
            if (reviewSubTab === 'submissions') await fetchSubmissions(silent);
            if (reviewSubTab === 'promotions') await fetchPromotions(silent);
        }
        if (tab === 'payments') await fetchPayments(silent);
        if (tab === 'tools') {
            if (toolsSubTab === 'manage') await fetchAllTasks(silent);
            if (toolsSubTab === 'logs') await fetchLogs(silent);
            if (toolsSubTab === 'upi') await fetchUpiAdminConfig(silent);
        }
    };

    const fetchUpiAdminConfig = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/payments/upi-config`);
            if (res.data) {
                setUpiPayeeName(res.data.name || 'SubMe Admin');
                if (Array.isArray(res.data.handles) && res.data.handles.length > 0) {
                    setUpiHandles(res.data.handles);
                }
            }
        } catch (e) { console.error(e); }
        finally { if (!silent) setLoading(false); }
    };

    const handleSaveUpiConfig = async () => {
        if (!upiPayeeName.trim()) {
            return Alert.alert('Error', 'Please enter a payee name.');
        }
        if (upiHandles.length === 0) {
            return Alert.alert('Error', 'At least one UPI ID is required.');
        }

        setSavingUpi(true);
        try {
            const res = await axios.post(`${API_URL}/api/admin/upi-config`, {
                name: upiPayeeName.trim(),
                handles: upiHandles,
            }, { headers: { Authorization: `Bearer ${token}` } });

            Alert.alert('Success 🎉', res.data.message || 'UPI settings updated live!');
        } catch (err: any) {
            Alert.alert('Save Failed', err.response?.data?.error || err.message);
        } finally {
            setSavingUpi(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/admin/stats`, { headers: { Authorization: `Bearer ${token}` } });
            setStats(res.data);
        } catch (e) { console.error(e); }
    };

    const fetchSubmissions = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/admin/submissions/pending`, { headers: { Authorization: `Bearer ${token}` } });
            setSubmissions(res.data);
        } catch (e) { console.error(e); }
        finally { if (!silent) setLoading(false); }
    };

    const fetchPromotions = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/admin/promotions/pending`, { headers: { Authorization: `Bearer ${token}` } });
            setPromotions(res.data);
        } catch (e) { console.error(e); }
        finally { if (!silent) setLoading(false); }
    };

    const fetchPayments = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/admin/payments/pending`, { headers: { Authorization: `Bearer ${token}` } });
            setPayments(res.data);
        } catch (e) { console.error(e); }
        finally { if (!silent) setLoading(false); }
    };

    const fetchAnalytics = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/admin/analytics`, { headers: { Authorization: `Bearer ${token}` } });
            setAnalyticsData(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const fetchAllTasks = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/admin/tasks`, { headers: { Authorization: `Bearer ${token}` } });
            setAllTasks(res.data);
        } catch (e) { console.error(e); }
        finally { if (!silent) setLoading(false); }
    };

    const fetchLogs = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/admin/logs`, { headers: { Authorization: `Bearer ${token}` } });
            setSysLogs(res.data);
        } catch (e) { console.error(e); }
        finally { if (!silent) setLoading(false); }
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

    const handleAction = async (type: string, id: string, action: 'approve' | 'reject' | 'toggle') => {
        try {
            await axios.post(`${API_URL}/api/admin/${type}/${id}/${action}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            if (type === 'submissions') setSubmissions(p => p.filter(i => i.id !== id));
            else if (type === 'promotions') setPromotions(p => p.filter(i => i.id !== id));
            else if (type === 'payments') setPayments(p => p.filter(i => i.id !== id));
            else if (type === 'tasks' && action === 'toggle') fetchAllTasks();
            fetchStats();
        } catch (e: any) { Alert.alert('Error', 'Action failed'); }
    };

    const handleDeleteTask = async (id: string) => {
        try {
            await axios.delete(`${API_URL}/api/admin/tasks/${id}`, { headers: { Authorization: `Bearer ${token}` } });
            setAllTasks(p => p.filter(i => i.id !== id));
            Alert.alert('Deleted', 'Task has been removed');
        } catch (e: any) { Alert.alert('Error', 'Could not delete task'); }
    };

    const searchUsers = async () => {
        if (query.length < 2) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/admin/users/search?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` } });
            setUsers(res.data);
        } catch (e) { Alert.alert('Error', 'Search failed'); }
        finally { setLoading(false); }
    };

    const creditUser = async () => {
        if (!selectedUser || !amount) return;
        try {
            await axios.post(`${API_URL}/api/admin/users/credit`, {
                userId: selectedUser.id, amount: parseInt(amount), description: note
            }, { headers: { Authorization: `Bearer ${token}` } });
            Alert.alert('Success', 'Credits applied successfully');
            setSelectedUser(null); setQuery(''); setAmount(''); setNote(''); fetchStats();
        } catch (e) { Alert.alert('Error', 'Failed to credit user'); }
    };

    const handleCreateTask = async () => {
        if (!newTask.title || !newTask.video_url) return Alert.alert('Error', 'Fill required fields');
        try {
            await axios.post(`${API_URL}/api/admin/tasks`, {
                ...newTask,
                thumbnail_id: newTask.thumbnail_id || null
            }, { headers: { Authorization: `Bearer ${token}` } });
            Alert.alert('Published', 'Task is now live');
            setNewTask({
                title: '', video_url: '', reward_points: '10', required_watch_time: '180',
                mcq_question: '', mcq_options: ['', '', '', ''], mcq_answer: '', is_vip: false,
                thumbnail_id: ''
            });
            setShowThumbPicker(false);
            setToolsSubTab('manage');
        } catch (e) { Alert.alert('Error', 'Failed to create task'); }
    };

    const getTabColor = (t: TabType) => {
        switch(t) {
            case 'analytics': return colors.blue;
            case 'reviews': return colors.lavender;
            case 'payments': return colors.peach;
            case 'tools': return colors.lime;
            default: return colors.black;
        }
    };

    return (
        <View style={styles.screen}>
            <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Admin Dashboard</Text>
                </View>

                {/* Tab Switcher */}
                <View style={styles.tabBar}>
                    {(['analytics', 'reviews', 'payments', 'tools'] as const).map(t => (
                        <TouchableOpacity
                            key={t}
                            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
                            onPress={() => setTab(t)}
                        >
                            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Main Content Area */}
                <ScrollView 
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={getTabColor(tab)} />}
                    contentContainerStyle={styles.scrollContent}
                >
                    {loading && (
                        <ActivityIndicator color={getTabColor(tab)} style={{ marginVertical: spacing[4] }} />
                    )}

                    {/* 1. DASHBOARD / ANALYTICS TAB */}
                    {tab === 'analytics' && !loading && (
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
                                                    Net: <Text style={{ color: net >= 0 ? colors.blue : colors.pink }}>{net >= 0 ? `+${net}` : net} BUG's</Text>
                                                </Text>
                                            </View>
                                            
                                            <View style={styles.activeCalloutRight}>
                                                <View style={styles.legendItem}>
                                                    <View style={[styles.legendDot, { backgroundColor: colors.lime }]} />
                                                    <Text style={styles.legendLabel}>+{activeItem?.earned || 0}</Text>
                                                </View>
                                                <View style={styles.legendItem}>
                                                    <View style={[styles.legendDot, { backgroundColor: colors.pink }]} />
                                                    <Text style={styles.legendLabel}>-{activeItem?.spent || 0}</Text>
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
                                                                                    backgroundColor: colors.lime,
                                                                                    borderWidth: isSelected ? 1 : 0,
                                                                                    borderColor: colors.black,
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
                                                                                    backgroundColor: colors.pink,
                                                                                    borderWidth: isSelected ? 1 : 0,
                                                                                    borderColor: colors.black,
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
                                <Ionicons name="shield-checkmark" size={24} color={colors.blue} style={{ marginBottom: spacing[2] }} />
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

                    {/* 2. APPROVALS / REVIEWS TAB */}
                    {tab === 'reviews' && !loading && (
                        <View style={styles.sectionContainer}>
                            {/* Segmented Pill Switcher */}
                            <View style={styles.segmentContainer}>
                                <TouchableOpacity 
                                    style={[styles.segmentBtn, reviewSubTab === 'submissions' && styles.segmentBtnActive]}
                                    onPress={() => setReviewSubTab('submissions')}
                                >
                                    <Text style={[styles.segmentText, reviewSubTab === 'submissions' && styles.segmentTextActive]}>Tasks</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.segmentBtn, reviewSubTab === 'promotions' && styles.segmentBtnActive]}
                                    onPress={() => setReviewSubTab('promotions')}
                                >
                                    <Text style={[styles.segmentText, reviewSubTab === 'promotions' && styles.segmentTextActive]}>Promotions</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Task Submissions Review */}
                            {reviewSubTab === 'submissions' && (
                                submissions.length > 0 ? (
                                    submissions.map((sub, i) => (
                                        <StaggeredItem key={sub.id} index={i} style={styles.reviewCard}>
                                            <View style={styles.cardHeaderRow}>
                                                <Ionicons name="videocam" size={20} color={colors.blue} />
                                                <View style={styles.cardHeaderInfo}>
                                                    <Text style={styles.cardTitle}>{sub.tasks?.title}</Text>
                                                    <Text style={styles.cardUser}>by @{sub.users?.username}</Text>
                                                </View>
                                            </View>

                                            <TouchableOpacity style={styles.viewMediaBtn} onPress={() => setPreviewUrl(sub.screenshot_url)}>
                                                <Ionicons name="image" size={16} color={colors.black} />
                                                <Text style={styles.viewMediaText}>View Screenshot Proof</Text>
                                            </TouchableOpacity>

                                            <View style={styles.cardActions}>
                                                <AnimatedPressable style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleAction('submissions', sub.id, 'reject')} scaleTo={animation.pressScale}>
                                                    <Text style={styles.rejectText}>Reject</Text>
                                                </AnimatedPressable>
                                                <AnimatedPressable style={[styles.actionBtn, styles.approveBtn, { backgroundColor: colors.lime }]} onPress={() => handleAction('submissions', sub.id, 'approve')} scaleTo={animation.pressScale}>
                                                    <Text style={styles.approveText}>Approve</Text>
                                                </AnimatedPressable>
                                            </View>
                                        </StaggeredItem>
                                    ))
                                ) : (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="checkmark-done-circle" size={64} color={colors.lime} />
                                        <Text style={styles.emptyText}>All task submissions reviewed!</Text>
                                    </View>
                                )
                            )}

                            {/* Promotion Requests Review */}
                            {reviewSubTab === 'promotions' && (
                                promotions.length > 0 ? (
                                    promotions.map((p, i) => (
                                        <StaggeredItem key={p.id} index={i} style={styles.reviewCard}>
                                            <View style={styles.cardHeaderRow}>
                                                <Ionicons name="megaphone" size={20} color={colors.peach} />
                                                <View style={styles.cardHeaderInfo}>
                                                    <Text style={styles.cardTitle}>{p.title}</Text>
                                                    <Text style={styles.cardUser}>by @{p.users?.username}</Text>
                                                </View>
                                            </View>

                                            <TouchableOpacity style={styles.viewMediaBtn} onPress={() => Linking.openURL(p.video_url)}>
                                                <Ionicons name="link" size={16} color={colors.black} />
                                                <Text style={styles.viewMediaText}>Verify Video Link</Text>
                                            </TouchableOpacity>

                                            <View style={styles.cardActions}>
                                                <AnimatedPressable style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleAction('promotions', p.id, 'reject')} scaleTo={animation.pressScale}>
                                                    <Text style={styles.rejectText}>Reject</Text>
                                                </AnimatedPressable>
                                                <AnimatedPressable style={[styles.actionBtn, styles.approveBtn, { backgroundColor: colors.lime }]} onPress={() => handleAction('promotions', p.id, 'approve')} scaleTo={animation.pressScale}>
                                                    <Text style={styles.approveText}>Publish Promo</Text>
                                                </AnimatedPressable>
                                            </View>
                                        </StaggeredItem>
                                    ))
                                ) : (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="notifications-off" size={64} color={colors.peach} />
                                        <Text style={styles.emptyText}>No pending promotions to review</Text>
                                    </View>
                                )
                            )}
                        </View>
                    )}

                    {/* 3. PAYMENTS / TOP-UPS TAB */}
                    {tab === 'payments' && !loading && (
                        <View style={styles.sectionContainer}>
                            {payments.length > 0 ? (
                                payments.map((pay, i) => (
                                    <StaggeredItem key={pay.id} index={i} style={styles.reviewCard}>
                                        <View style={styles.cardHeaderRow}>
                                            <Ionicons name="cash" size={20} color={colors.lime} />
                                            <View style={styles.cardHeaderInfo}>
                                                <Text style={styles.cardTitle}>₹{pay.amount} BUG's Recharge</Text>
                                                <Text style={styles.cardUser}>by @{pay.users?.username}</Text>
                                                <Text style={styles.utrText}>UTR / Transaction ID: {pay.utr_number}</Text>
                                            </View>
                                        </View>

                                        <TouchableOpacity style={styles.viewMediaBtn} onPress={() => setPreviewUrl(pay.screenshot_url)}>
                                            <Ionicons name="document" size={16} color={colors.black} />
                                            <Text style={styles.viewMediaText}>View Receipt Proof</Text>
                                        </TouchableOpacity>

                                        <View style={styles.cardActions}>
                                            <AnimatedPressable style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleAction('payments', pay.id, 'reject')} scaleTo={animation.pressScale}>
                                                <Text style={styles.rejectText}>Reject</Text>
                                            </AnimatedPressable>
                                            <AnimatedPressable style={[styles.actionBtn, styles.approveBtn, { backgroundColor: colors.lime }]} onPress={() => handleAction('payments', pay.id, 'approve')} scaleTo={animation.pressScale}>
                                                <Text style={styles.approveText}>Confirm Payment</Text>
                                            </AnimatedPressable>
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

                    {/* 4. ADMIN TOOLS TAB (PUBLISH TASK DIRECTLY) */}
                    {tab === 'tools' && (
                        <View style={styles.sectionContainer}>
                            {/* Sub-tab Switcher */}
                            <View style={{ flexDirection: 'row', gap: spacing[2], marginBottom: spacing[4] }}>
                                {([
                                    { key: 'create', label: 'Create Task' },
                                    { key: 'manage', label: 'Manage Tasks' },
                                    { key: 'credit', label: 'Credit User' },
                                    { key: 'upi', label: 'UPI Setup' },
                                    { key: 'logs', label: 'Audit Logs' },
                                ] as const).map(({ key, label }) => (
                                    <TouchableOpacity
                                        key={key}
                                        onPress={() => setToolsSubTab(key as any)}
                                        style={{
                                            flex: 1,
                                            paddingVertical: 8,
                                            paddingHorizontal: 4,
                                            borderRadius: radii.sm,
                                            backgroundColor: toolsSubTab === key ? colors.charcoal : colors.white,
                                            alignItems: 'center',
                                            ...shadows.sm,
                                        }}
                                    >
                                        <Text style={{
                                            fontSize: 11,
                                            fontWeight: typography.weight.bold,
                                            color: toolsSubTab === key ? colors.white : colors.textPrimary,
                                        }}>
                                            {label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Create Task View */}
                            {toolsSubTab === 'create' && (
                                <>
                                    <View style={styles.formCard}>
                                        <Text style={styles.formTitle}>Publish Video Task</Text>

                                        {/* ── Thumbnail Picker ── */}
                                        <Text style={styles.formLabel}>Task Banner Thumbnail</Text>
                                        <TouchableOpacity
                                            style={styles.thumbPickerToggle}
                                            onPress={() => setShowThumbPicker(v => !v)}
                                            activeOpacity={0.8}
                                        >
                                            {newTask.thumbnail_id ? (
                                                <Image
                                                    source={THUMBNAILS.find(t => t.id === newTask.thumbnail_id)?.source}
                                                    style={styles.thumbPickerPreview}
                                                    resizeMode="cover"
                                                />
                                            ) : (
                                                <View style={styles.thumbPickerEmpty}>
                                                    <Ionicons name="images-outline" size={28} color={colors.textMuted} />
                                                    <Text style={styles.thumbPickerEmptyText}>Tap to choose thumbnail</Text>
                                                </View>
                                            )}
                                            <View style={styles.thumbPickerBadge}>
                                                <Ionicons name={showThumbPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.black} />
                                            </View>
                                        </TouchableOpacity>

                                        {showThumbPicker && (
                                            <View style={styles.thumbGrid}>
                                                {THUMBNAILS.map(thumb => {
                                                    const isSelected = newTask.thumbnail_id === thumb.id;
                                                    return (
                                                        <TouchableOpacity
                                                            key={thumb.id}
                                                            style={[
                                                                styles.thumbGridItem,
                                                                { width: THUMB_ITEM_SIZE, height: THUMB_ITEM_SIZE * 0.65 },
                                                                isSelected && styles.thumbGridItemSelected
                                                            ]}
                                                            onPress={() => {
                                                                setNewTask(prev => ({
                                                                    ...prev,
                                                                    thumbnail_id: isSelected ? '' : thumb.id
                                                                }));
                                                                if (!isSelected) setShowThumbPicker(false);
                                                            }}
                                                            activeOpacity={0.75}
                                                        >
                                                            <Image
                                                                source={thumb.source}
                                                                style={styles.thumbGridImage}
                                                                resizeMode="cover"
                                                            />
                                                            {isSelected && (
                                                                <View style={styles.thumbGridCheckOverlay}>
                                                                    <View style={styles.thumbGridCheck}>
                                                                        <Ionicons name="checkmark" size={14} color={colors.white} />
                                                                    </View>
                                                                </View>
                                                            )}
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </View>
                                        )}

                                        <Text style={styles.formLabel}>Task Title</Text>
                                        <InputBox style={styles.formInputBox}>
                                            <AppTextInput 
                                                variant="flat" 
                                                placeholder="e.g. SubMe Launch Trailer Review" 
                                                value={newTask.title} 
                                                onChangeText={t => setNewTask({...newTask, title: t})} 
                                            />
                                        </InputBox>

                                        <Text style={styles.formLabel}>YouTube Video URL</Text>
                                        <InputBox style={styles.formInputBox}>
                                            <AppTextInput 
                                                variant="flat" 
                                                placeholder="https://youtu.be/..." 
                                                value={newTask.video_url} 
                                                onChangeText={t => setNewTask({...newTask, video_url: t})} 
                                            />
                                        </InputBox>

                                        <View style={styles.formGrid}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.formLabel}>Reward BUG's</Text>
                                                <InputBox style={styles.formInputBox}>
                                                    <AppTextInput 
                                                        variant="flat" 
                                                        placeholder="10" 
                                                        keyboardType="numeric" 
                                                        value={newTask.reward_points} 
                                                        onChangeText={t => setNewTask({...newTask, reward_points: t})} 
                                                    />
                                                </InputBox>
                                            </View>
                                            <View style={{ flex: 1, marginLeft: spacing[4] }}>
                                                <Text style={styles.formLabel}>Watch Time (Secs)</Text>
                                                <InputBox style={styles.formInputBox}>
                                                    <AppTextInput 
                                                        variant="flat" 
                                                        placeholder="180" 
                                                        keyboardType="numeric" 
                                                        value={newTask.required_watch_time} 
                                                        onChangeText={t => setNewTask({...newTask, required_watch_time: t})} 
                                                    />
                                                </InputBox>
                                            </View>
                                        </View>

                                        <Text style={styles.formLabel}>Anti-Cheat MCQ Question</Text>
                                        <InputBox style={styles.formInputBox}>
                                            <AppTextInput 
                                                variant="flat" 
                                                placeholder="e.g. What color is the ball at 1:12?" 
                                                value={newTask.mcq_question} 
                                                onChangeText={t => setNewTask({...newTask, mcq_question: t})} 
                                            />
                                        </InputBox>

                                        <Text style={styles.formLabel}>Anti-Cheat MCQ Options (Separate with Comma)</Text>
                                        <InputBox style={styles.formInputBox}>
                                            <AppTextInput 
                                                variant="flat" 
                                                placeholder="Red, Green, Blue, Yellow" 
                                                onChangeText={t => {
                                                    const opts = t.split(',').map(o => o.trim());
                                                    setNewTask({...newTask, mcq_options: opts});
                                                }} 
                                            />
                                        </InputBox>

                                        <Text style={styles.formLabel}>Correct MCQ Option (Must match exactly)</Text>
                                        <InputBox style={styles.formInputBox}>
                                            <AppTextInput 
                                                variant="flat" 
                                                placeholder="Red" 
                                                value={newTask.mcq_answer} 
                                                onChangeText={t => setNewTask({...newTask, mcq_answer: t.trim()})} 
                                            />
                                        </InputBox>

                                        <AnimatedPressable 
                                            style={[styles.actionSubmitBtn, { backgroundColor: colors.lime }]} 
                                            onPress={handleCreateTask} 
                                            scaleTo={animation.pressScale}
                                        >
                                            <Text style={styles.actionSubmitText}>Publish Task</Text>
                                        </AnimatedPressable>
                                    </View>

                                    {/* Exit Admin Mode */}
                                    <TouchableOpacity style={styles.exitBentoBtn} onPress={() => setAdminMode(false)}>
                                        <Ionicons name="log-out" size={20} color={colors.black} />
                                        <Text style={styles.exitBentoBtnText}>Exit Admin Mode</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {/* Credit User View */}
                            {toolsSubTab === 'credit' && (
                                <View style={styles.creditFormCard}>
                                    <Text style={styles.formTitle}>Credit User Wallet</Text>
                                    
                                    <InputBox style={styles.searchBar}>
                                        <Ionicons name="search" size={20} color={colors.textMuted} style={{ marginRight: spacing[2] }} />
                                        <AppTextInput
                                            variant="flat"
                                            style={styles.searchInput}
                                            placeholder="Search username or email..."
                                            value={query}
                                            onChangeText={setQuery}
                                            onSubmitEditing={searchUsers}
                                        />
                                        {query.length > 0 && (
                                            <TouchableOpacity onPress={() => { setQuery(''); setUsers([]); setSelectedUser(null); }}>
                                                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                                            </TouchableOpacity>
                                        )}
                                    </InputBox>

                                    {users.length > 0 && (
                                        <View style={styles.userListContainer}>
                                            {users.map((u) => (
                                                <TouchableOpacity 
                                                    key={u.id} 
                                                    style={[styles.userRow, selectedUser?.id === u.id && styles.userRowActive]} 
                                                    onPress={() => setSelectedUser(u)}
                                                >
                                                    <View style={styles.userAvatarBlock}>
                                                        <Text style={styles.avatarText}>{u.username[0].toUpperCase()}</Text>
                                                    </View>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.userRowUsername}>@{u.username}</Text>
                                                        <Text style={styles.userRowEmail}>{u.email}</Text>
                                                    </View>
                                                    <View style={styles.userPointsBlock}>
                                                        <Y2KNote size={10} style={{ marginRight: 4 }} />
                                                        <Text style={styles.userPointsText}>{u.points}</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {selectedUser && (
                                        <View style={styles.creditFormInputs}>
                                            <Text style={styles.selectedUserText}>Ref: @{selectedUser.username}</Text>
                                            
                                            <Text style={styles.formLabel}>Amount (BUG's)</Text>
                                            <InputBox style={styles.formInputBox}>
                                                <AppTextInput 
                                                    variant="flat" 
                                                    placeholder="e.g. 50 or -50" 
                                                    keyboardType="numbers-and-punctuation"
                                                    value={amount} 
                                                    onChangeText={setAmount} 
                                                />
                                            </InputBox>

                                            <Text style={styles.formLabel}>Reason / Note</Text>
                                            <InputBox style={styles.formInputBox}>
                                                <AppTextInput 
                                                    variant="flat" 
                                                    placeholder="Manual reward or top-up adjustment" 
                                                    value={note} 
                                                    onChangeText={setNote} 
                                                />
                                            </InputBox>

                                            <AnimatedPressable 
                                                style={[styles.actionSubmitBtn, { backgroundColor: colors.peach }]} 
                                                onPress={creditUser} 
                                                scaleTo={animation.pressScale}
                                            >
                                                <Text style={styles.actionSubmitText}>Credit BUG's</Text>
                                            </AnimatedPressable>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Manage Tasks View */}
                            {toolsSubTab === 'manage' && (
                                <View style={styles.sectionContainer}>
                                    {allTasks.length > 0 ? allTasks.map((t, i) => (
                                        <StaggeredItem key={t.id} index={i} style={styles.reviewCard}>
                                            <View style={styles.cardHeaderRow}>
                                                <Ionicons name="videocam" size={20} color={t.is_active ? colors.lime : colors.textMuted} />
                                                <View style={styles.cardHeaderInfo}>
                                                    <Text style={styles.cardTitle}>{t.title}</Text>
                                                    <Text style={styles.cardUser}>{t.reward_points} BUG's | {t.is_vip ? 'VIP' : 'Standard'}</Text>
                                                </View>
                                            </View>
                                            <View style={styles.cardActions}>
                                                <AnimatedPressable style={[styles.actionBtn, styles.rejectBtn]} onPress={() => handleDeleteTask(t.id)} scaleTo={animation.pressScale}>
                                                    <Text style={styles.rejectText}>Delete</Text>
                                                </AnimatedPressable>
                                                <AnimatedPressable style={[styles.actionBtn, styles.approveBtn, { backgroundColor: t.is_active ? colors.peach : colors.lime }]} onPress={() => handleAction('tasks', t.id, 'toggle')} scaleTo={animation.pressScale}>
                                                    <Text style={styles.approveText}>{t.is_active ? 'Pause Task' : 'Activate'}</Text>
                                                </AnimatedPressable>
                                            </View>
                                        </StaggeredItem>
                                    )) : (
                                        <Text style={styles.emptyText}>No tasks found</Text>
                                    )}
                                </View>
                            )}

                            {/* Audit Logs View */}
                            {toolsSubTab === 'logs' && (
                                <View style={styles.sectionContainer}>
                                    {sysLogs.length > 0 ? sysLogs.map((log, i) => (
                                        <StaggeredItem key={log.id} index={i} style={styles.reviewCard}>
                                            <View style={styles.cardHeaderRow}>
                                                <Ionicons name="shield-half" size={20} color={colors.pink} />
                                                <View style={styles.cardHeaderInfo}>
                                                    <Text style={styles.cardTitle}>{log.action}</Text>
                                                    <Text style={styles.cardUser}>User: @{log.users?.username || 'Unknown'} | IP: {log.ip_address || 'N/A'}</Text>
                                                    <Text style={styles.utrText}>{new Date(log.created_at).toLocaleString()}</Text>
                                                </View>
                                            </View>
                                        </StaggeredItem>
                                    )) : (
                                        <Text style={styles.emptyText}>No logs found</Text>
                                    )}
                                </View>
                            )}

                            {/* UPI Handles Setup View */}
                            {toolsSubTab === 'upi' && (
                                <View style={styles.creditFormCard}>
                                    <Text style={styles.formTitle}>Manage Wallet UPI Handles</Text>
                                    <Text style={[styles.cardUser, { marginBottom: spacing[4] }]}>
                                        Update the payee name & list of active UPI IDs displayed to users on the Wallet screen.
                                    </Text>

                                    <Text style={styles.inputLabel}>Payee / Display Name</Text>
                                    <InputBox style={{ marginBottom: spacing[4] }}>
                                        <AppTextInput
                                            variant="flat"
                                            value={upiPayeeName}
                                            onChangeText={setUpiPayeeName}
                                            placeholder="e.g. SubMe Admin"
                                        />
                                    </InputBox>

                                    <Text style={styles.inputLabel}>Active UPI IDs</Text>
                                    <View style={{ gap: spacing[2], marginBottom: spacing[4] }}>
                                        {upiHandles.map((handle, index) => (
                                            <View key={index} style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                backgroundColor: colors.bgPrimary,
                                                paddingHorizontal: spacing[3],
                                                paddingVertical: spacing[2.5],
                                                borderRadius: radii.md,
                                                borderWidth: 1,
                                                borderColor: colors.border
                                            }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                                                    <Ionicons name="qr-code-outline" size={16} color={colors.black} />
                                                    <Text style={{ fontFamily, fontSize: 14, fontWeight: '700', color: colors.black }}>
                                                        {handle}
                                                    </Text>
                                                </View>

                                                <TouchableOpacity
                                                    onPress={() => {
                                                        const updated = upiHandles.filter((_, i) => i !== index);
                                                        setUpiHandles(updated);
                                                    }}
                                                    style={{ padding: 4 }}
                                                >
                                                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>

                                    {/* Add New Handle */}
                                    <Text style={styles.inputLabel}>Add New UPI ID</Text>
                                    <View style={{ flexDirection: 'row', gap: spacing[2], marginBottom: spacing[5] }}>
                                        <InputBox style={{ flex: 1 }}>
                                            <AppTextInput
                                                variant="flat"
                                                value={newHandleInput}
                                                onChangeText={setNewHandleInput}
                                                placeholder="e.g. subkaro@axl"
                                                autoCapitalize="none"
                                            />
                                        </InputBox>

                                        <TouchableOpacity
                                            style={{
                                                backgroundColor: colors.lime,
                                                paddingHorizontal: spacing[4],
                                                borderRadius: radii.md,
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                ...shadows.sm
                                            }}
                                            onPress={() => {
                                                const cleaned = newHandleInput.trim().toLowerCase();
                                                if (!cleaned || !cleaned.includes('@')) {
                                                    return Alert.alert('Invalid UPI', 'Please enter a valid handle like name@upi');
                                                }
                                                if (upiHandles.includes(cleaned)) {
                                                    return Alert.alert('Duplicate', 'This UPI handle is already added.');
                                                }
                                                setUpiHandles([...upiHandles, cleaned]);
                                                setNewHandleInput('');
                                            }}
                                        >
                                            <Ionicons name="add-circle-outline" size={20} color={colors.black} />
                                        </TouchableOpacity>
                                    </View>

                                    <AnimatedPressable
                                        style={[styles.actionSubmitBtn, { backgroundColor: colors.lime }, savingUpi && { opacity: 0.7 }]}
                                        onPress={handleSaveUpiConfig}
                                        disabled={savingUpi}
                                    >
                                        {savingUpi ? (
                                            <ActivityIndicator color={colors.black} />
                                        ) : (
                                            <>
                                                <Ionicons name="save-outline" size={18} color={colors.black} />
                                                <Text style={[styles.actionSubmitText, { color: colors.black }]}>Save & Update Live Wallet</Text>
                                            </>
                                        )}
                                    </AnimatedPressable>
                                </View>
                            )}


                        </View>
                    )}
                </ScrollView>
            </View>
            
            <Modal
                visible={previewUrl !== null}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setPreviewUrl(null)}
            >
                <View style={styles.modalBackdrop}>
                    <TouchableOpacity style={styles.modalCloseOverlay} activeOpacity={1} onPress={() => setPreviewUrl(null)} />
                    <View style={styles.modalCard}>
                        {/* Title Bar */}
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Receipt / Screenshot Preview</Text>
                            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setPreviewUrl(null)}>
                                <Ionicons name="close" size={20} color={colors.black} />
                            </TouchableOpacity>
                        </View>
                        {/* Image body */}
                        <View style={styles.modalBody}>
                            {previewUrl && (
                                <Image
                                    source={{ uri: previewUrl }}
                                    style={styles.previewImg}
                                    resizeMode="contain"
                                />
                            )}
                        </View>
                        {/* Action buttons */}
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.modalOpenExternalBtn}
                                onPress={() => {
                                    if (previewUrl) {
                                        Linking.openURL(previewUrl);
                                        setPreviewUrl(null);
                                    }
                                }}
                            >
                                <Ionicons name="open-outline" size={16} color={colors.white} style={{ marginRight: 6 }} />
                                <Text style={styles.modalOpenExternalText}>Open External Link</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bgPrimary },
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing[6],
        paddingVertical: spacing[4],
    },
    headerTitle: {
        fontFamily,
        fontSize: 24,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
        letterSpacing: typography.tracking.tight,
    },
    tabBar: {
        flexDirection: 'row',
        gap: spacing[2],
        paddingHorizontal: spacing[6],
        paddingBottom: spacing[3],
        backgroundColor: colors.bgPrimary,
    },
    tabBtn: {
        flex: 1,
        height: 42,
        borderRadius: radii.md,
        backgroundColor: colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.sm,
    },
    tabBtnActive: {
        backgroundColor: colors.lime,
    },
    tabText: {
        fontFamily,
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        color: colors.textMuted,
        textTransform: 'capitalize',
    },
    tabTextActive: {
        color: colors.black,
    },
    coinsBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1.5],
        borderRadius: radii.lg,
        ...shadows.sm,
    },
    coinGold: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: colors.yellow,
        marginRight: 6,
    },
    coinsText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    headerExitBtn: {
        backgroundColor: colors.pink,
        width: 36,
        height: 36,
        borderRadius: radii.md,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.sm,
    },
    exitBentoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.lime,
        borderWidth: 1.5,
        borderColor: colors.black,
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[4],
        borderRadius: radii.xl,
        marginTop: spacing[4],
        gap: spacing[2],
        ...shadows.sm,
    },
    exitBentoBtnText: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    content: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing[6], paddingBottom: 160 },
    sectionContainer: { gap: spacing[4] },

    // Bento Grid Dashboard Layout
    bentoGrid: {
        flexDirection: 'row',
        gap: spacing[3],
    },
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
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    bentoCardValue: {
        fontFamily,
        fontSize: 22,
        fontWeight: typography.weight.black,
        color: colors.black,
        marginVertical: spacing[1],
    },
    bentoCardSub: {
        fontFamily,
        fontSize: 9,
        color: colors.textSecondary,
        fontWeight: typography.weight.bold,
    },

    // Point Activity Visual Bar Chart
    chartCard: {
        backgroundColor: colors.white,
        borderRadius: radii['2xl'],
        padding: spacing[4],
        borderWidth: 1,
        borderColor: 'rgba(22, 18, 15, 0.08)',
        overflow: 'hidden',
        ...shadows.sm,
    },
    chartHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: spacing[2],
        marginBottom: spacing[3],
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
        color: colors.textMuted,
        marginTop: 2,
    },
    timeframeToggleRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        marginBottom: spacing[4],
    },
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[2],
    },
    timeframeToggle: {
        flexDirection: 'row',
        backgroundColor: colors.bgSecondary,
        borderRadius: radii.md,
        padding: 2,
        gap: 2,
    },
    toggleBtn: {
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
        borderRadius: radii.sm,
    },
    toggleBtnActive: {
        backgroundColor: colors.lime,
    },
    toggleBtnText: {
        fontFamily,
        fontSize: 9,
        fontWeight: typography.weight.bold,
        color: colors.textSecondary,
    },
    toggleBtnTextActive: {
        color: colors.black,
    },
    activeCalloutCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.bgSecondary,
        borderRadius: radii.xl,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3],
        marginBottom: spacing[4],
    },
    activeCalloutLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
    },
    activeCalloutLabel: {
        fontFamily,
        fontSize: typography.size.xs,
        fontWeight: typography.weight.black,
        color: colors.black,
        backgroundColor: colors.white,
        paddingHorizontal: spacing[2.5],
        paddingVertical: 3,
        borderRadius: radii.sm,
    },
    activeCalloutNet: {
        fontFamily,
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        color: colors.textSecondary,
    },
    activeCalloutRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
    },
    legendContainer: {
        flexDirection: 'row',
        gap: spacing[4],
        marginBottom: spacing[6],
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
        fontSize: 10,
        fontWeight: typography.weight.bold,
        color: colors.textSecondary,
    },
    chartWrapper: {
        height: 150,
        position: 'relative',
        justifyContent: 'flex-end',
        marginTop: spacing[2],
    },
    gridLinesContainer: {
        position: 'absolute',
        top: 0,
        bottom: 24,
        left: 0,
        right: 0,
        justifyContent: 'space-between',
        zIndex: 0,
    },
    gridLineRow: {
        width: '100%',
    },
    gridLine: {
        height: 1,
        backgroundColor: 'rgba(22, 18, 15, 0.08)',
        width: '100%',
        borderStyle: 'dashed',
    },
    barsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end',
        height: '100%',
        zIndex: 1,
        paddingBottom: 24,
    },
    barGroup: {
        alignItems: 'center',
        flex: 1,
        paddingVertical: spacing[1],
        borderRadius: radii.md,
    },
    barGroupSelected: {
        backgroundColor: 'rgba(22, 18, 15, 0.04)',
    },
    barsRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 3,
        height: 110,
    },
    zeroBaselineDot: {
        width: 10,
        height: 2,
        borderRadius: 1,
        backgroundColor: 'rgba(22, 18, 15, 0.15)',
    },
    barOuter: {
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    barInner: {
        width: 10,
        borderTopLeftRadius: 5,
        borderTopRightRadius: 5,
    },
    barLabel: {
        fontFamily,
        fontSize: 9,
        fontWeight: typography.weight.bold,
        color: colors.textSecondary,
        marginTop: spacing[2],
        textAlign: 'center',
    },
    barLabelSelected: {
        color: colors.black,
        fontWeight: typography.weight.black,
    },

    // Audit Export Card
    exportCard: {
        backgroundColor: colors.white,
        borderRadius: radii.xl,
        padding: spacing[5],
        ...shadows.sm,
    },
    exportTitle: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.black,
        marginBottom: spacing[1],
    },
    exportDesc: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.textSecondary,
        lineHeight: 16,
        marginBottom: spacing[4],
    },
    exportBtn: {
        height: 48,
        borderRadius: radii.lg,
        backgroundColor: colors.black,
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        ...shadows.sm,
    },
    exportBtnText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.white,
    },

    // Segment Control Switcher
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: colors.white,
        borderRadius: radii.lg,
        padding: 4,
        marginBottom: spacing[4],
        gap: 4,
        ...shadows.sm,
    },
    segmentBtn: {
        flex: 1,
        height: 46,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
    },
    segmentBtnActive: {
        backgroundColor: colors.lime,
    },
    segmentText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.textSecondary,
    },
    segmentTextActive: {
        color: colors.black,
    },

    // Review Cards
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
        color: colors.textPrimary,
        lineHeight: 18,
    },
    cardUser: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    utrText: {
        fontSize: 10,
        color: colors.blue,
        fontWeight: typography.weight.bold,
        marginTop: 4,
    },
    viewMediaBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bgSecondary,
        borderRadius: radii.md,
        paddingVertical: spacing[3],
        marginBottom: spacing[4],
        gap: spacing[2],
    },
    viewMediaText: {
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
        height: 46,
        borderRadius: radii.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rejectBtn: {
        backgroundColor: colors.bgSecondary,
    },
    approveBtn: {
        backgroundColor: colors.lime,
        ...shadows.sm,
    },
    rejectText: {
        color: colors.black,
        fontWeight: typography.weight.bold,
        fontSize: typography.size.sm,
    },
    approveText: {
        fontFamily,
        color: colors.black,
        fontWeight: typography.weight.bold,
        fontSize: typography.size.sm,
    },
    emptyState: {
        paddingVertical: 80,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[3],
    },
    emptyText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.textMuted,
    },

    // Custom Forms
    formCard: {
        paddingVertical: spacing[4],
    },
    formTitle: {
        fontFamily,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: colors.black,
        marginBottom: spacing[2],
    },
    formLabel: {
        fontFamily,
        fontSize: 11,
        fontWeight: typography.weight.bold,
        color: colors.textMuted,
        marginBottom: spacing[2],
        marginTop: spacing[4],
        marginLeft: 2,
    },
    formInputBox: {
        minHeight: 52,
        backgroundColor: colors.white,
    },
    formGrid: {
        flexDirection: 'row',
    },
    actionSubmitBtn: {
        height: 52,
        borderRadius: radii.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing[6],
        ...shadows.sm,
    },
    actionSubmitText: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },

    // Credit User Panel
    creditFormCard: {
        paddingVertical: spacing[4],
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
    userListContainer: {
        borderRadius: radii.lg,
        backgroundColor: colors.bgSecondary,
        padding: 4,
        gap: 4,
        marginBottom: spacing[4],
    },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        padding: spacing[3],
        borderRadius: radii.md,
        gap: spacing[3],
    },
    userRowActive: {
        backgroundColor: colors.lime,
    },
    userAvatarBlock: {
        width: 36,
        height: 36,
        borderRadius: radii.xs,
        backgroundColor: colors.black,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: colors.white,
        fontWeight: typography.weight.bold,
        fontSize: typography.size.sm,
    },
    userRowUsername: {
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    userRowEmail: {
        fontSize: 10,
        color: colors.textMuted,
        marginTop: 1,
    },
    userPointsBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgSecondary,
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
        borderRadius: radii.sm,
    },
    miniCoin: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.yellow,
        marginRight: 4,
    },
    userPointsText: {
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    creditFormInputs: {
        marginTop: spacing[2],
        paddingTop: spacing[4],
        borderTopWidth: 1.5,
        borderColor: 'rgba(22, 18, 15, 0.15)',
    },
    selectedUserText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },



    // Modal Preview Styling (Neobrutalist Y2K Theme)
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(22, 18, 15, 0.75)', // Dim warm-toned black overlay
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing[4],
    },
    modalCloseOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    modalCard: {
        width: '100%',
        maxHeight: '80%',
        backgroundColor: colors.white,
        borderRadius: radii.xl,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: colors.black,
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 0,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.lavender,
        borderBottomWidth: 2,
        borderColor: colors.border,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3],
    },
    modalTitle: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    modalCloseBtn: {
        width: 28,
        height: 28,
        borderRadius: radii.xs,
        backgroundColor: colors.white,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBody: {
        backgroundColor: '#F9F8F6', // Parchment canvas
        alignItems: 'center',
        justifyContent: 'center',
        height: 380,
        padding: spacing[2],
    },
    previewImg: {
        width: '100%',
        height: '100%',
    },
    modalFooter: {
        backgroundColor: colors.white,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3],
        borderTopWidth: 1.5,
        borderColor: 'rgba(22, 18, 15, 0.15)',
        alignItems: 'center',
    },
    modalOpenExternalBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.black,
        borderRadius: radii.lg,
        paddingVertical: spacing[2],
        paddingHorizontal: spacing[4],
    },
    modalOpenExternalText: {
        fontFamily,
        color: colors.white,
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
    },
    toolsMenuGrid: {
        gap: spacing[3],
        marginTop: spacing[2],
    },
    toolsMenuBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.white,
        padding: spacing[4],
        borderRadius: radii.xl,
        ...shadows.sm,
    },
    toolsIconBox: {
        width: 48,
        height: 48,
        borderRadius: radii.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    toolsMenuTextWrap: {
        flex: 1,
        marginLeft: spacing[4],
    },
    toolsMenuTitle: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
    },
    toolsMenuSub: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.textMuted,
        marginTop: 2,
    },
    backToMenuBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: colors.white,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        borderRadius: radii.md,
        marginBottom: spacing[4],
        ...shadows.sm,
    },
    backToMenuText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
        marginLeft: spacing[2],
    },

    // ── Thumbnail Picker ────────────────────────────────────────
    thumbPickerToggle: {
        width: '100%',
        height: 96,
        borderRadius: radii.xl,
        backgroundColor: colors.white,
        borderWidth: 1.5,
        borderColor: 'rgba(22, 18, 15, 0.2)',
        borderStyle: 'dashed',
        overflow: 'hidden',
        marginBottom: spacing[3],
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.sm,
    },
    thumbPickerPreview: {
        width: '100%',
        height: '100%',
        borderRadius: radii.xl,
    },
    thumbPickerEmpty: {
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing[2],
    },
    thumbPickerEmptyText: {
        fontFamily,
        fontSize: typography.size.sm,
        color: colors.textMuted,
        fontWeight: '600',
    },
    thumbPickerBadge: {
        position: 'absolute',
        bottom: spacing[2],
        right: spacing[2],
        backgroundColor: colors.white,
        borderRadius: radii.full,
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.sm,
    },
    thumbGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: spacing[4],
        backgroundColor: colors.white,
        borderRadius: radii.xl,
        padding: spacing[3],
        ...shadows.sm,
    },
    thumbGridItem: {
        borderRadius: radii.md,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
        position: 'relative',
    },
    thumbGridImage: {
        width: '100%',
        height: '100%',
    },
    thumbGridItemSelected: {
        borderColor: colors.blue,
    },
    thumbGridCheckOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(42,108,255,0.35)',
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        padding: 4,
    },
    thumbGridCheck: {
        backgroundColor: colors.blue,
        borderRadius: radii.full,
        width: 22,
        height: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

