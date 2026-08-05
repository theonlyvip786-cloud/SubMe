import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, Linking, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { API_URL } from '../config';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows, fontFamily, animation } from '../theme/designSystem';
import { AnimatedPressable, StaggeredItem } from '../theme/animations';

export default function AdminReviewsScreen({ navigation }: any) {
    const { token } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [allTasks, setAllTasks] = useState<any[]>([]);

    const insets = useSafeAreaInsets();

    useEffect(() => {
        fetchAllTasks();
        const unsub = navigation.addListener('focus', () => {
            fetchAllTasks(true);
        });
        return unsub;
    }, [navigation, token]);

    const refreshAll = async () => {
        setRefreshing(true);
        await fetchAllTasks(true);
        setTimeout(() => setRefreshing(false), 500);
    };

    const fetchAllTasks = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await axios.get(`${API_URL}/api/admin/tasks`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAllTasks(res.data);
        } catch (e) { console.error(e); }
        finally { if (!silent) setLoading(false); }
    };

    const handleDeleteTask = async (id: string, title: string) => {
        Alert.alert(
            'Delete Task',
            `"${title}" ko permanently delete karna chahte hain?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        try {
                            await axios.delete(`${API_URL}/api/admin/tasks/${id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            setAllTasks(p => p.filter(i => i.id !== id));
                            Alert.alert('Deleted', 'Task successfully removed.');
                        } catch (e: any) {
                            Alert.alert('Error', 'Could not delete task');
                        }
                    }
                }
            ]
        );
    };

    const handleToggleTask = async (id: string) => {
        try {
            await axios.post(`${API_URL}/api/admin/tasks/${id}/toggle`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchAllTasks(true);
        } catch (e: any) { Alert.alert('Error', 'Action failed'); }
    };

    const formatExpiry = (createdAt: string) => {
        const created = new Date(createdAt);
        const expires = new Date(created.getTime() + 24 * 60 * 60 * 1000);
        const now = new Date();
        const diff = expires.getTime() - now.getTime();
        if (diff <= 0) return { label: 'Expired', color: colors.pink, expired: true };
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return {
            label: `${hours}h ${mins}m left`,
            color: hours < 3 ? colors.peach : colors.lime,
            expired: false
        };
    };

    return (
        <View style={styles.screen}>
            <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Manage Tasks</Text>
                    <View style={styles.countBadge}>
                        <Text style={styles.countText}>{allTasks.length} tasks</Text>
                    </View>
                </View>

                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.lime} />}
                    contentContainerStyle={styles.scrollContent}
                >
                    {loading && (
                        <ActivityIndicator color={colors.lime} style={{ marginVertical: spacing[4] }} />
                    )}

                    {!loading && allTasks.length === 0 && (
                        <View style={styles.emptyState}>
                            <Ionicons name="list-circle" size={64} color={colors.lime} />
                            <Text style={styles.emptyText}>No active tasks found</Text>
                            <Text style={styles.emptySubText}>Go to Admin Tools → Publish Task to create one</Text>
                        </View>
                    )}

                    {!loading && allTasks.map((task, i) => {
                        const expiry = formatExpiry(task.created_at);
                        return (
                            <StaggeredItem key={task.id} index={i} style={styles.taskCard}>
                                {/* Task Header */}
                                <View style={styles.taskHeaderRow}>
                                    <View style={[
                                        styles.platformBadge,
                                        { backgroundColor: task.platform === 'instagram' ? '#E1306C' : '#FF0000' }
                                    ]}>
                                        <Ionicons
                                            name={task.platform === 'instagram' ? 'logo-instagram' : 'logo-youtube'}
                                            size={12}
                                            color="#fff"
                                        />
                                        <Text style={styles.platformText}>
                                            {task.platform === 'instagram' ? 'Instagram' : 'YouTube'}
                                        </Text>
                                    </View>
                                    {task.is_vip && (
                                        <View style={styles.vipBadge}>
                                            <Ionicons name="star" size={10} color={colors.black} />
                                            <Text style={styles.vipText}>VIP</Text>
                                        </View>
                                    )}
                                    <View style={[styles.expiryBadge, { backgroundColor: expiry.color }]}>
                                        <Ionicons name="time" size={10} color={colors.black} />
                                        <Text style={styles.expiryText}>{expiry.label}</Text>
                                    </View>
                                </View>

                                {/* Task Title & Info */}
                                <Text style={styles.taskTitle}>{task.title}</Text>
                                <TouchableOpacity
                                    style={styles.linkRow}
                                    onPress={() => task.video_url && Linking.openURL(task.video_url)}
                                >
                                    <Ionicons name="link" size={13} color={colors.blue} />
                                    <Text style={styles.linkText} numberOfLines={1}>{task.video_url}</Text>
                                </TouchableOpacity>

                                {/* Task Meta */}
                                <View style={styles.metaRow}>
                                    <View style={styles.metaChip}>
                                        <Ionicons name="bug" size={11} color={colors.black} />
                                        <Text style={styles.metaText}>{task.reward_points} BUG's</Text>
                                    </View>
                                    <View style={styles.metaChip}>
                                        <Ionicons name="timer" size={11} color={colors.black} />
                                        <Text style={styles.metaText}>{task.required_watch_time}s watch</Text>
                                    </View>
                                    <View style={[styles.metaChip, { backgroundColor: task.is_active ? colors.lime : colors.bgSecondary }]}>
                                        <View style={[styles.activeDot, { backgroundColor: task.is_active ? '#00AA00' : colors.textMuted }]} />
                                        <Text style={styles.metaText}>{task.is_active ? 'Active' : 'Paused'}</Text>
                                    </View>
                                </View>

                                {/* Actions */}
                                <View style={styles.taskActions}>
                                    <AnimatedPressable
                                        style={[styles.actionBtn, { backgroundColor: task.is_active ? colors.peach : colors.lime }]}
                                        onPress={() => handleToggleTask(task.id)}
                                        scaleTo={animation.pressScale}
                                    >
                                        <Ionicons
                                            name={task.is_active ? 'pause-circle' : 'play-circle'}
                                            size={16}
                                            color={colors.black}
                                        />
                                        <Text style={styles.actionBtnText}>
                                            {task.is_active ? 'Pause' : 'Activate'}
                                        </Text>
                                    </AnimatedPressable>

                                    <AnimatedPressable
                                        style={[styles.actionBtn, styles.deleteBtn]}
                                        onPress={() => handleDeleteTask(task.id, task.title)}
                                        scaleTo={animation.pressScale}
                                    >
                                        <Ionicons name="trash" size={16} color={colors.white} />
                                        <Text style={[styles.actionBtnText, { color: colors.white }]}>Delete</Text>
                                    </AnimatedPressable>
                                </View>
                            </StaggeredItem>
                        );
                    })}
                </ScrollView>
            </View>
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
    countBadge: {
        backgroundColor: colors.lime,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1.5],
        borderRadius: radii.lg,
    },
    countText: {
        fontFamily,
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    content: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing[6], paddingBottom: 160 },

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
    emptySubText: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.textMuted,
        textAlign: 'center',
        paddingHorizontal: spacing[8],
    },

    taskCard: {
        backgroundColor: colors.white,
        borderRadius: radii.xl,
        padding: spacing[5],
        marginBottom: spacing[4],
        ...shadows.sm,
    },
    taskHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
        marginBottom: spacing[3],
    },
    platformBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
        borderRadius: radii.sm,
    },
    platformText: {
        fontSize: 10,
        fontWeight: typography.weight.bold,
        color: '#fff',
    },
    vipBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: colors.yellow,
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
        borderRadius: radii.sm,
    },
    vipText: {
        fontSize: 10,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    expiryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
        borderRadius: radii.sm,
        marginLeft: 'auto',
    },
    expiryText: {
        fontSize: 10,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    taskTitle: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.textPrimary,
        marginBottom: spacing[2],
        lineHeight: 20,
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: spacing[3],
    },
    linkText: {
        fontSize: typography.size.xs,
        color: colors.blue,
        flex: 1,
    },
    metaRow: {
        flexDirection: 'row',
        gap: spacing[2],
        marginBottom: spacing[4],
        flexWrap: 'wrap',
    },
    metaChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.bgSecondary,
        paddingHorizontal: spacing[2],
        paddingVertical: spacing[1],
        borderRadius: radii.sm,
    },
    metaText: {
        fontSize: 10,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    taskActions: {
        flexDirection: 'row',
        gap: spacing[3],
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[2],
        height: 44,
        borderRadius: radii.lg,
        ...shadows.sm,
    },
    deleteBtn: {
        backgroundColor: '#E63946',
    },
    actionBtnText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
});
