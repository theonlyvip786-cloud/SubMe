import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Image,
    ActivityIndicator, RefreshControl, TouchableOpacity, Modal, Dimensions, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { API_URL } from '../config';
import { colors, typography, spacing, radii, shadows, fontFamily } from '../theme/designSystem';
import { StaggeredItem } from '../theme/animations';
import { getThumbnailSource } from '../assets/thumbnails';

const { width: screenWidth } = Dimensions.get('window');

function getYouTubeId(url: string): string | null {
    if (!url) return null;
    const vMatch = url.match(/[?&]v=([^&]+)/);
    if (vMatch) return vMatch[1];
    const shortMatch = url.match(/youtu\.be\/([^?&]+)/);
    if (shortMatch) return shortMatch[1];
    return null;
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export default function MyProofsScreen({ navigation }: any) {
    const { token } = useAuthStore();
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedProof, setSelectedProof] = useState<any | null>(null);
    const [reporting, setReporting] = useState(false);

    const fetchProofs = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/api/proofs/my-tasks`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setTasks(res.data || []);
        } catch {
            setTasks([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [token]);

    useEffect(() => {
        fetchProofs();
        const unsub = navigation.addListener('focus', fetchProofs);
        return unsub;
    }, [navigation, fetchProofs]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchProofs();
    };

    const handleReport = async () => {
        if (!selectedProof) return;
        setReporting(true);
        try {
            await axios.post(`${API_URL}/api/proofs/${selectedProof.id}/report`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            Alert.alert('Reported', 'User reported successfully. Admin will review this.');
            setSelectedProof(null);
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.error || 'Failed to report user');
        } finally {
            setReporting(false);
        }
    };

    const totalProofs = tasks.reduce((sum, t) => sum + (t.proofs?.length || 0), 0);

    return (
        <SafeAreaView style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Subscription Proofs</Text>
                <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{totalProofs}</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.blue} />
                    <Text style={styles.loadingText}>Loading proofs...</Text>
                </View>
            ) : tasks.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="images-outline" size={64} color={colors.textMuted} />
                    <Text style={styles.emptyTitle}>No Proofs Yet</Text>
                    <Text style={styles.emptyDesc}>
                        When users subscribe to your promoted content and upload screenshot proof, they will appear here.
                    </Text>
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />
                    }
                >
                    {/* Info Banner */}
                    <View style={styles.infoBanner}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={colors.blue} />
                        <Text style={styles.infoBannerText}>
                            These screenshots are only visible to you. Admin has no access.
                        </Text>
                    </View>

                    {tasks.map((task, ti) => {
                        const vid = getYouTubeId(task.video_url);
                        const ytThumb = vid ? `https://img.youtube.com/vi/${vid}/mqdefault.jpg` : null;
                        const localThumb = getThumbnailSource(task.thumbnail_id);

                        return (
                            <StaggeredItem key={task.id} index={ti} style={styles.taskBlock}>
                                {/* Task Header Card */}
                                <View style={styles.taskHeader}>
                                    <View style={styles.taskThumb}>
                                        {localThumb ? (
                                            <Image source={localThumb} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                                        ) : ytThumb ? (
                                            <Image source={{ uri: ytThumb }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                                        ) : (
                                            <Ionicons name="videocam-outline" size={24} color={colors.textMuted} />
                                        )}
                                    </View>
                                    <View style={styles.taskInfo}>
                                        <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
                                        <View style={styles.taskMeta}>
                                            <Ionicons
                                                name={task.platform === 'instagram' ? 'logo-instagram' : 'logo-youtube'}
                                                size={12}
                                                color={task.platform === 'instagram' ? '#E1306C' : '#FF0000'}
                                            />
                                            <Text style={styles.taskMetaText}>{task.platform === 'instagram' ? 'Instagram' : 'YouTube'}</Text>
                                            <View style={styles.proofCountChip}>
                                                <Text style={styles.proofCountText}>
                                                    {task.proofs?.length || 0} proof{task.proofs?.length !== 1 ? 's' : ''}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* Proofs Grid */}
                                {task.proofs && task.proofs.length > 0 ? (
                                    <View style={styles.proofsGrid}>
                                        {task.proofs.map((proof: any, pi: number) => (
                                            <TouchableOpacity
                                                key={proof.id}
                                                style={styles.proofThumb}
                                                onPress={() => setSelectedProof(proof)}
                                                activeOpacity={0.85}
                                            >
                                                <Image
                                                    source={{ uri: proof.screenshot_url }}
                                                    style={StyleSheet.absoluteFillObject}
                                                    resizeMode="cover"
                                                />
                                                <View style={styles.proofOverlay}>
                                                    <Ionicons name="expand-outline" size={16} color={colors.white} />
                                                </View>
                                                <View style={styles.proofDate}>
                                                    <Text style={styles.proofDateText} numberOfLines={1}>
                                                        @{proof.users?.username || 'user'}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ) : (
                                    <View style={styles.noProofs}>
                                        <Ionicons name="hourglass-outline" size={20} color={colors.textMuted} />
                                        <Text style={styles.noProofsText}>No proofs submitted yet</Text>
                                    </View>
                                )}
                            </StaggeredItem>
                        );
                    })}
                </ScrollView>
            )}

            {/* Full-screen image viewer modal */}
            <Modal
                visible={!!selectedProof}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedProof(null)}
            >
                <View style={styles.modalBg}>
                    <TouchableOpacity
                        style={styles.modalCloseBtn}
                        onPress={() => setSelectedProof(null)}
                    >
                        <Ionicons name="close-circle" size={36} color={colors.white} />
                    </TouchableOpacity>
                    
                    {selectedProof && (
                        <Image
                            source={{ uri: selectedProof.screenshot_url }}
                            style={styles.modalImage}
                            resizeMode="contain"
                        />
                    )}
                    
                    {selectedProof && (
                        <View style={styles.modalBottomBar}>
                            <View>
                                <Text style={styles.modalUserText}>Submitted by: @{selectedProof.users?.username || 'user'}</Text>
                                <Text style={styles.modalDateText}>
                                    {new Date(selectedProof.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            </View>
                            <TouchableOpacity 
                                style={[styles.reportBtn, reporting && { opacity: 0.7 }]} 
                                onPress={handleReport}
                                disabled={reporting}
                            >
                                {reporting ? (
                                    <ActivityIndicator size="small" color={colors.white} />
                                ) : (
                                    <>
                                        <Ionicons name="warning-outline" size={16} color={colors.white} />
                                        <Text style={styles.reportBtnText}>Report User</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const THUMB_SIZE = (screenWidth - 48 - 8 * 2) / 3;

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bgPrimary },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing[5],
        paddingVertical: spacing[4],
        gap: spacing[3],
    },
    backBtn: {
        width: 40, height: 40,
        borderRadius: radii.md,
        backgroundColor: colors.white,
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.sm,
    },
    headerTitle: {
        fontFamily,
        flex: 1,
        fontSize: 20,
        fontWeight: '800',
        color: colors.textPrimary,
        letterSpacing: -0.5,
    },
    countBadge: {
        backgroundColor: colors.blue,
        borderRadius: radii.full,
        minWidth: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing[2],
    },
    countBadgeText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: '800',
        color: colors.white,
    },

    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing[8],
        gap: spacing[3],
    },
    loadingText: {
        fontFamily,
        fontSize: typography.size.sm,
        color: colors.textMuted,
        marginTop: spacing[2],
    },
    emptyTitle: {
        fontFamily,
        fontSize: typography.size.xl,
        fontWeight: '800',
        color: colors.textPrimary,
        marginTop: spacing[3],
    },
    emptyDesc: {
        fontFamily,
        fontSize: typography.size.sm,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },

    scrollContent: {
        paddingHorizontal: spacing[5],
        paddingBottom: 100,
        gap: spacing[4],
    },

    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        backgroundColor: colors.blue + '15',
        borderRadius: radii.xl,
        padding: spacing[4],
        borderWidth: 1,
        borderColor: colors.blue + '30',
        marginBottom: spacing[2],
    },
    infoBannerText: {
        fontFamily,
        flex: 1,
        fontSize: typography.size.xs,
        color: colors.blue,
        fontWeight: '600',
        lineHeight: 16,
    },

    taskBlock: {
        backgroundColor: colors.white,
        borderRadius: radii['2xl'],
        overflow: 'hidden',
        ...shadows.sm,
        marginBottom: spacing[3],
    },
    taskHeader: {
        flexDirection: 'row',
        gap: spacing[3],
        padding: spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: colors.bgSecondary,
    },
    taskThumb: {
        width: 64,
        height: 48,
        borderRadius: radii.md,
        backgroundColor: colors.bgSecondary,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    taskInfo: { flex: 1, justifyContent: 'center', gap: spacing[1.5] },
    taskTitle: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: '800',
        color: colors.textPrimary,
        lineHeight: 18,
    },
    taskMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[2],
    },
    taskMetaText: {
        fontFamily,
        fontSize: 11,
        color: colors.textMuted,
        fontWeight: '600',
    },
    proofCountChip: {
        backgroundColor: colors.lime,
        paddingHorizontal: spacing[2],
        paddingVertical: 2,
        borderRadius: radii.full,
    },
    proofCountText: {
        fontFamily,
        fontSize: 10,
        fontWeight: '800',
        color: colors.black,
    },

    proofsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        padding: spacing[4],
    },
    proofThumb: {
        width: THUMB_SIZE,
        height: THUMB_SIZE * 1.6,
        borderRadius: radii.lg,
        backgroundColor: colors.bgSecondary,
        overflow: 'hidden',
    },
    proofOverlay: {
        position: 'absolute',
        top: spacing[2],
        right: spacing[2],
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderRadius: radii.full,
        width: 26,
        height: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
    proofDate: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingVertical: 4,
        paddingHorizontal: 6,
    },
    proofDateText: {
        fontFamily,
        fontSize: 9,
        color: colors.white,
        fontWeight: '600',
    },
    noProofs: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[2],
        paddingVertical: spacing[5],
    },
    noProofsText: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.textMuted,
    },

    // Modal
    modalBg: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.92)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCloseBtn: {
        position: 'absolute',
        top: 56,
        right: 20,
        zIndex: 10,
    },
    modalImage: {
        width: screenWidth,
        height: screenWidth * 1.8,
    },
    modalHint: {
        fontFamily,
        fontSize: typography.size.xs,
        color: 'rgba(255,255,255,0.4)',
        position: 'absolute',
        bottom: 40,
    },
    modalBottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        padding: spacing[5],
        paddingBottom: Platform.OS === 'ios' ? spacing[8] : spacing[5],
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalUserText: {
        fontFamily,
        fontSize: typography.size.sm,
        color: colors.white,
        fontWeight: '700',
        marginBottom: 2,
    },
    modalDateText: {
        fontFamily,
        fontSize: typography.size.xs,
        color: 'rgba(255,255,255,0.6)',
    },
    reportBtn: {
        backgroundColor: '#DC2626', // red
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[2],
        borderRadius: radii.md,
        gap: spacing[1.5],
    },
    reportBtnText: {
        fontFamily,
        fontSize: typography.size.xs,
        fontWeight: '700',
        color: colors.white,
    }
});
