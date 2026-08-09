import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, Linking, RefreshControl,
    Dimensions, Image, Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import axios from 'axios';
import useAuthStore from '../store/useAuthStore';
import { API_URL } from '../config';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, radii, shadows, fontFamily, animation } from '../theme/designSystem';
import { AnimatedPressable, StaggeredItem } from '../theme/animations';
import { AppTextInput, InputBox } from '../theme/inputs';
import { THUMBNAILS } from '../assets/thumbnails';

export default function AdminToolsScreen({ navigation }: any) {
    const { token, setAdminMode } = useAuthStore();
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Sub-tab segment controls
    const [toolsSubTab, setToolsSubTab] = useState<'manage' | 'create' | 'upi' | 'logs'>('manage');

    const [upiPayeeName, setUpiPayeeName] = useState('SubMe Admin');
    const [upiHandles, setUpiHandles] = useState<string[]>(['theonlyvip786@okaxis']);
    const [newHandleInput, setNewHandleInput] = useState('');
    const [savingUpi, setSavingUpi] = useState(false);

    const [allTasks, setAllTasks] = useState<any[]>([]);
    const [sysLogs, setSysLogs] = useState<any[]>([]);
    
    // Create Task Form State
    const [newTask, setNewTask] = useState({
        title: '', video_url: '', reward_points: '1', required_watch_time: '180',
        mcq_question: '', mcq_options: ['', '', '', ''], mcq_answer: '', is_vip: false,
        thumbnail_id: '' as string, platform: 'youtube'
    });

    // Edit Task Modal State
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingTask, setEditingTask] = useState<any>(null);
    const [savingEdit, setSavingEdit] = useState(false);

    const [showThumbPicker, setShowThumbPicker] = useState(false);
    const [thumbPickerTarget, setThumbPickerTarget] = useState<'new' | 'edit'>('new');

    const { width: screenWidth } = Dimensions.get('window');
    const THUMB_ITEM_SIZE = (screenWidth - 48 - 16 * 2) / 3;

    const insets = useSafeAreaInsets();

    useEffect(() => {
        refreshData(true);
        const unsub = navigation.addListener('focus', () => {
            refreshData(true);
        });
        return unsub;
    }, [navigation, token, toolsSubTab]);

    const refreshAll = async () => {
        setRefreshing(true);
        await refreshData(true);
        setTimeout(() => setRefreshing(false), 500);
    };

    const refreshData = async (silent = false) => {
        if (toolsSubTab === 'manage') await fetchAllTasks(silent);
        if (toolsSubTab === 'logs') await fetchLogs(silent);
        if (toolsSubTab === 'upi') await fetchUpiAdminConfig(silent);
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

    const handleAction = async (type: string, id: string, action: 'toggle') => {
        try {
            await axios.post(`${API_URL}/api/admin/${type}/${id}/${action}`, {}, { headers: { Authorization: `Bearer ${token}` } });
            if (type === 'tasks' && action === 'toggle') fetchAllTasks();
        } catch (e: any) { Alert.alert('Error', 'Action failed'); }
    };

    const handleDeleteTask = async (id: string) => {
        Alert.alert(
            'Delete Task',
            'Are you sure you want to permanently delete this task?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await axios.delete(`${API_URL}/api/admin/tasks/${id}`, { headers: { Authorization: `Bearer ${token}` } });
                            setAllTasks(p => p.filter(i => i.id !== id));
                            Alert.alert('Deleted', 'Task has been removed');
                        } catch (e: any) { Alert.alert('Error', 'Could not delete task'); }
                    }
                }
            ]
        );
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
                title: '', video_url: '', reward_points: '1', required_watch_time: '180',
                mcq_question: '', mcq_options: ['', '', '', ''], mcq_answer: '', is_vip: false,
                thumbnail_id: '', platform: 'youtube'
            });
            setShowThumbPicker(false);
            setToolsSubTab('manage');
        } catch (e) { Alert.alert('Error', 'Failed to create task'); }
    };

    const openEditModal = (task: any) => {
        setEditingTask({
            id: task.id,
            title: task.title || '',
            video_url: task.video_url || '',
            reward_points: String(task.reward_points || (task.is_vip ? 2 : 1)),
            required_watch_time: String(task.required_watch_time || 180),
            mcq_question: task.mcq_question || '',
            mcq_options: Array.isArray(task.mcq_options) ? task.mcq_options : (task.mcq_options || ['', '', '', '']),
            mcq_answer: task.mcq_answer || '',
            thumbnail_id: task.thumbnail_id || '',
            is_vip: !!task.is_vip
        });
        setEditModalVisible(true);
    };

    const handleSaveEditTask = async () => {
        if (!editingTask || !editingTask.title || !editingTask.video_url) {
            return Alert.alert('Error', 'Please fill required fields (Title & Video URL)');
        }
        setSavingEdit(true);
        try {
            await axios.put(`${API_URL}/api/admin/tasks/${editingTask.id}`, editingTask, {
                headers: { Authorization: `Bearer ${token}` }
            });
            Alert.alert('Updated', 'Task has been updated successfully!');
            setEditModalVisible(false);
            setEditingTask(null);
            fetchAllTasks();
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.error || 'Failed to update task');
        } finally {
            setSavingEdit(false);
        }
    };

    return (
        <View style={styles.screen}>
            <View style={[styles.container, { paddingTop: Math.max(insets.top, 16) }]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Task & System Tools</Text>
                    <TouchableOpacity 
                        style={styles.exitAdminBtn} 
                        onPress={() => setAdminMode(false)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="log-out-outline" size={14} color={colors.white} style={{ marginRight: 4 }} />
                        <Text style={styles.exitAdminText}>Exit Admin</Text>
                    </TouchableOpacity>
                </View>

                {/* Sub-tabs as horizontal ScrollView with crisp styling */}
                <View>
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.segmentContainer}
                    >
                        <TouchableOpacity 
                            style={[styles.segmentBtn, toolsSubTab === 'manage' && styles.segmentBtnActive]}
                            onPress={() => setToolsSubTab('manage')}
                        >
                            <Text style={[styles.segmentText, toolsSubTab === 'manage' && styles.segmentTextActive]}>Manage Tasks</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.segmentBtn, toolsSubTab === 'create' && styles.segmentBtnActive]}
                            onPress={() => setToolsSubTab('create')}
                        >
                            <Text style={[styles.segmentText, toolsSubTab === 'create' && styles.segmentTextActive]}>Create Task</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.segmentBtn, toolsSubTab === 'upi' && styles.segmentBtnActive]}
                            onPress={() => setToolsSubTab('upi')}
                        >
                            <Text style={[styles.segmentText, toolsSubTab === 'upi' && styles.segmentTextActive]}>UPI Setup</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.segmentBtn, toolsSubTab === 'logs' && styles.segmentBtnActive]}
                            onPress={() => setToolsSubTab('logs')}
                        >
                            <Text style={[styles.segmentText, toolsSubTab === 'logs' && styles.segmentTextActive]}>Audit Logs</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                {/* Main Content Area */}
                <ScrollView 
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.lime} />}
                    contentContainerStyle={styles.scrollContent}
                >
                    {loading && toolsSubTab !== 'create' && (
                        <ActivityIndicator color={colors.lime} style={{ marginVertical: spacing[4] }} />
                    )}

                    {!loading && (
                        <View style={styles.sectionContainer}>

                            {/* Manage Tasks View */}
                            {toolsSubTab === 'manage' && (
                                <View style={{ gap: spacing[4] }}>
                                    <View style={styles.sectionHeaderRow}>
                                        <Text style={styles.sectionTitleText}>Live Tasks Directory</Text>
                                        <TouchableOpacity 
                                            style={styles.inlineCreateBtn} 
                                            onPress={() => setToolsSubTab('create')}
                                        >
                                            <Ionicons name="add-circle" size={16} color={colors.black} style={{ marginRight: 4 }} />
                                            <Text style={styles.inlineCreateBtnText}>New Task</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {allTasks.length > 0 ? (
                                        allTasks.map((task, i) => (
                                            <StaggeredItem key={task.id} index={i} style={styles.reviewCard}>
                                                <View style={styles.cardHeaderRow}>
                                                    <Ionicons name="videocam" size={22} color={task.is_active ? colors.lime : colors.textMuted} />
                                                    <View style={styles.cardHeaderInfo}>
                                                        <Text style={styles.cardTitle}>{task.title}</Text>
                                                        <Text style={styles.cardUser}>{task.reward_points} BUG's • {task.required_watch_time}s watch required</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.cardActions}>
                                                    <AnimatedPressable 
                                                        style={[styles.actionBtn, { backgroundColor: colors.bgSecondary }]} 
                                                        onPress={() => openEditModal(task)} 
                                                        scaleTo={animation.pressScale}
                                                    >
                                                        <Ionicons name="pencil" size={14} color={colors.black} style={{ marginRight: 4 }} />
                                                        <Text style={styles.actionBtnText}>Edit</Text>
                                                    </AnimatedPressable>

                                                    <AnimatedPressable 
                                                        style={[styles.actionBtn, { backgroundColor: task.is_active ? colors.peach : colors.lime }]} 
                                                        onPress={() => handleAction('tasks', task.id, 'toggle')} 
                                                        scaleTo={animation.pressScale}
                                                    >
                                                        <Text style={styles.actionBtnText}>{task.is_active ? 'Pause' : 'Activate'}</Text>
                                                    </AnimatedPressable>

                                                    <AnimatedPressable 
                                                        style={[styles.actionBtn, { backgroundColor: colors.black }]} 
                                                        onPress={() => handleDeleteTask(task.id)} 
                                                        scaleTo={animation.pressScale}
                                                    >
                                                        <Text style={[styles.actionBtnText, { color: colors.white }]}>Delete</Text>
                                                    </AnimatedPressable>
                                                </View>
                                            </StaggeredItem>
                                        ))
                                    ) : (
                                        <View style={styles.emptyState}>
                                            <Ionicons name="videocam-outline" size={56} color={colors.textMuted} />
                                            <Text style={styles.emptyText}>No tasks created yet</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Publish Task View */}
                            {toolsSubTab === 'create' && (
                                <View style={styles.formCard}>
                                    <Text style={styles.formTitle}>Publish Video Task</Text>

                                    <Text style={styles.formLabel}>Platform</Text>
                                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                                        <TouchableOpacity style={[styles.segmentBtn, newTask.platform === 'youtube' && styles.segmentBtnActive, { flex: 1 }]} onPress={() => setNewTask({...newTask, platform: 'youtube'})}>
                                            <Ionicons name="logo-youtube" size={16} color={newTask.platform === 'youtube' ? colors.white : colors.textMuted} style={{ marginRight: 6 }} />
                                            <Text style={[styles.segmentText, newTask.platform === 'youtube' && styles.segmentTextActive]}>YouTube</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.segmentBtn, newTask.platform === 'instagram' && styles.segmentBtnActive, { flex: 1 }]} onPress={() => setNewTask({...newTask, platform: 'instagram'})}>
                                            <Ionicons name="logo-instagram" size={16} color={newTask.platform === 'instagram' ? colors.white : colors.textMuted} style={{ marginRight: 6 }} />
                                            <Text style={[styles.segmentText, newTask.platform === 'instagram' && styles.segmentTextActive]}>Instagram</Text>
                                        </TouchableOpacity>
                                    </View>

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

                                    <Text style={styles.formLabel}>Anti-Cheat MCQ Options (Comma Separated)</Text>
                                    <InputBox style={styles.formInputBox}>
                                        <AppTextInput 
                                            variant="flat" 
                                            placeholder="Red, Blue, Green, Yellow" 
                                            value={Array.isArray(newTask.mcq_options) ? newTask.mcq_options.join(', ') : newTask.mcq_options} 
                                            onChangeText={t => setNewTask({...newTask, mcq_options: t.split(',').map(s => s.trim())})} 
                                        />
                                    </InputBox>

                                    <Text style={styles.formLabel}>Correct MCQ Answer</Text>
                                    <InputBox style={styles.formInputBox}>
                                        <AppTextInput 
                                            variant="flat" 
                                            placeholder="Red" 
                                            value={newTask.mcq_answer} 
                                            onChangeText={t => setNewTask({...newTask, mcq_answer: t})} 
                                        />
                                    </InputBox>

                                    {/* Thumbnail Selection */}
                                    <Text style={styles.formLabel}>Banner Thumbnail</Text>
                                    <TouchableOpacity style={styles.thumbnailSelectorBtn} onPress={() => { setThumbPickerTarget('new'); setShowThumbPicker(true); }}>
                                        {newTask.thumbnail_id ? (
                                            <View style={styles.thumbnailPreviewContainer}>
                                                <Image 
                                                    source={THUMBNAILS.find(t => t.id === newTask.thumbnail_id)?.source} 
                                                    style={styles.thumbnailPreviewImage} 
                                                />
                                                <View style={styles.thumbnailPreviewOverlay}>
                                                    <Text style={styles.thumbnailPreviewText}>Change Thumbnail</Text>
                                                </View>
                                            </View>
                                        ) : (
                                            <View style={styles.thumbnailEmptyState}>
                                                <Ionicons name="image-outline" size={24} color={colors.textMuted} />
                                                <Text style={styles.thumbnailEmptyText}>Select a Banner Image</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>

                                    <AnimatedPressable style={styles.publishBtn} onPress={handleCreateTask} scaleTo={animation.pressScale}>
                                        <Text style={styles.publishBtnText}>Publish Live Task</Text>
                                    </AnimatedPressable>
                                </View>
                            )}

                            {/* UPI Setup View */}
                            {toolsSubTab === 'upi' && (
                                <View style={styles.formCard}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}>
                                        <Ionicons name="settings" size={22} color={colors.black} style={{ marginRight: spacing[2] }} />
                                        <Text style={styles.formTitle}>Payment Gateway Settings</Text>
                                    </View>
                                    
                                    <Text style={styles.sectionDescText}>
                                        Manage the UPI VPA (Virtual Payment Address) that users will send manual top-up payments to. This is displayed on the Wallet screen.
                                    </Text>

                                    <Text style={styles.formLabel}>Payee Name (Receiver Name)</Text>
                                    <InputBox style={styles.formInputBox}>
                                        <AppTextInput 
                                            variant="flat" 
                                            placeholder="e.g. SubMe Admin" 
                                            value={upiPayeeName} 
                                            onChangeText={setUpiPayeeName} 
                                        />
                                    </InputBox>

                                    <Text style={[styles.formLabel, { marginTop: spacing[3] }]}>Active UPI Addresses</Text>
                                    <View style={{ gap: spacing[3], marginBottom: spacing[4], marginTop: spacing[1] }}>
                                        {upiHandles.map((handle, idx) => (
                                            <View key={idx} style={styles.upiHandleItem}>
                                                <Ionicons name="checkmark-circle" size={18} color={colors.lime} style={{ marginRight: spacing[3] }} />
                                                <Text style={styles.upiHandleText}>{handle}</Text>
                                                <TouchableOpacity 
                                                    style={styles.upiRemoveBtn}
                                                    onPress={() => {
                                                        const newArr = [...upiHandles];
                                                        newArr.splice(idx, 1);
                                                        setUpiHandles(newArr);
                                                    }}
                                                >
                                                    <Ionicons name="close-circle" size={20} color={colors.peach} />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                    </View>

                                    <Text style={styles.formLabel}>Add New UPI Address</Text>
                                    <View style={styles.addUpiRow}>
                                        <InputBox style={{ flex: 1, marginRight: spacing[3] }}>
                                            <AppTextInput 
                                                variant="flat" 
                                                placeholder="user@bank" 
                                                value={newHandleInput} 
                                                onChangeText={setNewHandleInput}
                                                autoCapitalize="none"
                                            />
                                        </InputBox>
                                        <AnimatedPressable 
                                            style={styles.addUpiBtn}
                                            scaleTo={animation.pressScale}
                                            onPress={() => {
                                                if (newHandleInput.trim()) {
                                                    setUpiHandles([...upiHandles, newHandleInput.trim()]);
                                                    setNewHandleInput('');
                                                }
                                            }}
                                        >
                                            <Ionicons name="add" size={22} color={colors.black} />
                                        </AnimatedPressable>
                                    </View>

                                    <AnimatedPressable 
                                        style={styles.publishBtn} 
                                        onPress={handleSaveUpiConfig} 
                                        disabled={savingUpi}
                                        scaleTo={animation.pressScale}
                                    >
                                        {savingUpi ? (
                                            <ActivityIndicator color={colors.black} />
                                        ) : (
                                            <Text style={styles.publishBtnText}>Save Live Settings</Text>
                                        )}
                                    </AnimatedPressable>
                                </View>
                            )}

                            {/* System Logs View */}
                            {toolsSubTab === 'logs' && (
                                <View style={{ gap: spacing[3] }}>
                                    <Text style={styles.sectionTitleText}>System Audit Logs</Text>
                                    {sysLogs.map((log) => {
                                        const isReport = log.action.includes('Report') || log.action === 'User Reported (Unsubscribe/Cheat)';
                                        return (
                                            <View 
                                                key={log.id} 
                                                style={[
                                                    styles.logCard, 
                                                    isReport && { 
                                                        backgroundColor: '#FFF5F5', 
                                                        borderColor: '#FEB2B2',
                                                        borderWidth: 1.5
                                                    }
                                                ]}
                                            >
                                                <Ionicons 
                                                    name={isReport ? "alert-circle" : "shield-checkmark"} 
                                                    size={22} 
                                                    color={isReport ? "#E53E3E" : colors.blue} 
                                                    style={{ marginRight: spacing[3], marginTop: 2 }} 
                                                />
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] }}>
                                                        <Text style={[styles.logAction, isReport && { color: '#C53030', fontWeight: 'bold' }]}>
                                                            {log.action}
                                                        </Text>
                                                        {isReport && (
                                                            <View style={{ backgroundColor: '#E53E3E', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full }}>
                                                                <Text style={{ color: colors.white, fontSize: 10, fontWeight: 'bold' }}>REPORTED</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    
                                                    {log.action === 'User Reported (Unsubscribe/Cheat)' && log.metadata ? (
                                                        <View style={{ backgroundColor: colors.white, padding: spacing[3], borderRadius: radii.lg, marginVertical: spacing[2], borderWidth: 1, borderColor: '#FED7D7', ...shadows.sm }}>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                                                <Ionicons name="person" size={14} color="#C53030" style={{ marginRight: 6 }} />
                                                                <Text style={{ fontSize: typography.size.sm, color: colors.black }}>
                                                                    Reported User: <Text style={{ fontWeight: 'bold', color: '#E53E3E' }}>@{log.metadata.reported_username}</Text>
                                                                </Text>
                                                            </View>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                                                <Ionicons name="videocam" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                                                                <Text style={{ fontSize: typography.size.xs, color: colors.textSecondary }}>
                                                                    Task: <Text style={{ fontWeight: '600', color: colors.black }}>{log.metadata.task_title}</Text>
                                                                </Text>
                                                            </View>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing[3] }}>
                                                                <Ionicons name="warning" size={14} color="#DD6B20" style={{ marginRight: 6 }} />
                                                                <Text style={{ fontSize: typography.size.xs, color: colors.textSecondary }}>
                                                                    Reason: <Text style={{ fontWeight: '600', color: '#DD6B20' }}>{log.metadata.reason}</Text>
                                                                </Text>
                                                            </View>
                                                            
                                                            <AnimatedPressable 
                                                                style={{
                                                                    backgroundColor: '#E53E3E',
                                                                    height: 40,
                                                                    borderRadius: radii.md,
                                                                    flexDirection: 'row',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    ...shadows.sm
                                                                }} 
                                                                onPress={() => {
                                                                    Alert.alert(
                                                                        'Ban Fraud User',
                                                                        `Are you sure you want to ban @${log.metadata.reported_username}?`,
                                                                        [
                                                                            { text: 'Cancel', style: 'cancel' },
                                                                            {
                                                                                text: 'Ban User', 
                                                                                style: 'destructive',
                                                                                onPress: async () => {
                                                                                    setLoading(true);
                                                                                    try {
                                                                                        await axios.post(`${API_URL}/api/admin/users/${log.metadata.reported_user_id}/ban`, { action: 'ban' }, { headers: { Authorization: `Bearer ${token}` } });
                                                                                        Alert.alert('Success 🎉', `User @${log.metadata.reported_username} has been banned.`);
                                                                                        fetchLogs();
                                                                                    } catch (e) { Alert.alert('Error', 'Failed to ban user'); }
                                                                                    finally { setLoading(false); }
                                                                                }
                                                                            }
                                                                        ]
                                                                    );
                                                                }} 
                                                                scaleTo={animation.pressScale}
                                                            >
                                                                <Ionicons name="ban-outline" size={16} color={colors.white} style={{ marginRight: 6 }} />
                                                                <Text style={{ color: colors.white, fontSize: typography.size.xs, fontWeight: 'bold' }}>
                                                                    Ban @{log.metadata.reported_username}
                                                                </Text>
                                                            </AnimatedPressable>
                                                        </View>
                                                    ) : (
                                                        <Text style={styles.logMeta}>User: @{log.users?.username || 'System'} | IP: {log.ip_address || 'N/A'}</Text>
                                                    )}
                                                    
                                                    <Text style={styles.logDate}>{new Date(log.created_at).toLocaleString()}</Text>
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
            </View>

            {/* Thumbnail Picker Modal */}
            <Modal
                visible={showThumbPicker}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowThumbPicker(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Choose Banner Art</Text>
                        <TouchableOpacity onPress={() => setShowThumbPicker(false)}>
                            <Ionicons name="close-circle" size={28} color={colors.black} />
                        </TouchableOpacity>
                    </View>
                    
                    <ScrollView contentContainerStyle={styles.thumbnailGrid}>
                        {THUMBNAILS.map(thumb => (
                            <TouchableOpacity 
                                key={thumb.id}
                                style={[
                                    styles.thumbnailOption, 
                                    { width: THUMB_ITEM_SIZE, height: THUMB_ITEM_SIZE },
                                    (thumbPickerTarget === 'edit' ? editingTask?.thumbnail_id : newTask.thumbnail_id) === thumb.id && styles.thumbnailOptionSelected
                                ]}
                                onPress={() => {
                                    if (thumbPickerTarget === 'edit' && editingTask) {
                                        setEditingTask({ ...editingTask, thumbnail_id: thumb.id });
                                    } else {
                                        setNewTask({ ...newTask, thumbnail_id: thumb.id });
                                    }
                                    setShowThumbPicker(false);
                                }}
                            >
                                <Image source={thumb.source} style={styles.thumbnailImage} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </Modal>

            {/* Edit Task Modal */}
            <Modal
                visible={editModalVisible}
                animationType="slide"
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Edit Task Details</Text>
                        <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                            <Ionicons name="close-circle" size={28} color={colors.black} />
                        </TouchableOpacity>
                    </View>

                    {editingTask && (
                        <ScrollView style={{ flex: 1, padding: spacing[5] }}>
                            <Text style={styles.formLabel}>Platform</Text>
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                                <TouchableOpacity style={[styles.segmentBtn, editingTask.platform === 'youtube' && styles.segmentBtnActive, { flex: 1 }]} onPress={() => setEditingTask({...editingTask, platform: 'youtube'})}>
                                    <Ionicons name="logo-youtube" size={16} color={editingTask.platform === 'youtube' ? colors.white : colors.textMuted} style={{ marginRight: 6 }} />
                                    <Text style={[styles.segmentText, editingTask.platform === 'youtube' && styles.segmentTextActive]}>YouTube</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.segmentBtn, editingTask.platform === 'instagram' && styles.segmentBtnActive, { flex: 1 }]} onPress={() => setEditingTask({...editingTask, platform: 'instagram'})}>
                                    <Ionicons name="logo-instagram" size={16} color={editingTask.platform === 'instagram' ? colors.white : colors.textMuted} style={{ marginRight: 6 }} />
                                    <Text style={[styles.segmentText, editingTask.platform === 'instagram' && styles.segmentTextActive]}>Instagram</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.formLabel}>Task Title</Text>
                            <InputBox style={styles.formInputBox}>
                                <AppTextInput 
                                    variant="flat" 
                                    value={editingTask.title} 
                                    onChangeText={t => setEditingTask({ ...editingTask, title: t })} 
                                />
                            </InputBox>

                            <Text style={styles.formLabel}>Video URL</Text>
                            <InputBox style={styles.formInputBox}>
                                <AppTextInput 
                                    variant="flat" 
                                    value={editingTask.video_url} 
                                    onChangeText={t => setEditingTask({ ...editingTask, video_url: t })} 
                                />
                            </InputBox>

                            <View style={styles.formGrid}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.formLabel}>Reward BUG's</Text>
                                    <InputBox style={styles.formInputBox}>
                                        <AppTextInput 
                                            variant="flat" 
                                            keyboardType="numeric" 
                                            value={editingTask.reward_points} 
                                            onChangeText={t => setEditingTask({ ...editingTask, reward_points: t })} 
                                        />
                                    </InputBox>
                                </View>
                                <View style={{ flex: 1, marginLeft: spacing[4] }}>
                                    <Text style={styles.formLabel}>Watch Time (Secs)</Text>
                                    <InputBox style={styles.formInputBox}>
                                        <AppTextInput 
                                            variant="flat" 
                                            keyboardType="numeric" 
                                            value={editingTask.required_watch_time} 
                                            onChangeText={t => setEditingTask({ ...editingTask, required_watch_time: t })} 
                                        />
                                    </InputBox>
                                </View>
                            </View>

                            <Text style={styles.formLabel}>MCQ Question</Text>
                            <InputBox style={styles.formInputBox}>
                                <AppTextInput 
                                    variant="flat" 
                                    value={editingTask.mcq_question} 
                                    onChangeText={t => setEditingTask({ ...editingTask, mcq_question: t })} 
                                />
                            </InputBox>

                            <Text style={styles.formLabel}>MCQ Options (Comma Separated)</Text>
                            <InputBox style={styles.formInputBox}>
                                <AppTextInput 
                                    variant="flat" 
                                    value={Array.isArray(editingTask.mcq_options) ? editingTask.mcq_options.join(', ') : editingTask.mcq_options} 
                                    onChangeText={t => setEditingTask({ ...editingTask, mcq_options: t.split(',').map(s => s.trim()) })} 
                                />
                            </InputBox>

                            <Text style={styles.formLabel}>Correct MCQ Answer</Text>
                            <InputBox style={styles.formInputBox}>
                                <AppTextInput 
                                    variant="flat" 
                                    value={editingTask.mcq_answer} 
                                    onChangeText={t => setEditingTask({ ...editingTask, mcq_answer: t })} 
                                />
                            </InputBox>

                            <Text style={styles.formLabel}>Banner Thumbnail</Text>
                            <TouchableOpacity 
                                style={styles.thumbnailSelectorBtn} 
                                onPress={() => { setThumbPickerTarget('edit'); setShowThumbPicker(true); }}
                            >
                                {editingTask.thumbnail_id ? (
                                    <View style={styles.thumbnailPreviewContainer}>
                                        <Image 
                                            source={THUMBNAILS.find(t => t.id === editingTask.thumbnail_id)?.source} 
                                            style={styles.thumbnailPreviewImage} 
                                        />
                                        <View style={styles.thumbnailPreviewOverlay}>
                                            <Text style={styles.thumbnailPreviewText}>Change Thumbnail</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={styles.thumbnailEmptyState}>
                                        <Ionicons name="image-outline" size={24} color={colors.textMuted} />
                                        <Text style={styles.thumbnailEmptyText}>Select a Banner Image</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            <AnimatedPressable 
                                style={[styles.publishBtn, { marginBottom: spacing[12] }]} 
                                onPress={handleSaveEditTask}
                                disabled={savingEdit}
                                scaleTo={animation.pressScale}
                            >
                                {savingEdit ? (
                                    <ActivityIndicator color={colors.black} />
                                ) : (
                                    <Text style={styles.publishBtnText}>Save Changes</Text>
                                )}
                            </AnimatedPressable>
                        </ScrollView>
                    )}
                </View>
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

    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing[3],
    },
    sectionTitleText: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    sectionDescText: {
        fontFamily,
        fontSize: typography.size.sm,
        color: colors.textSecondary,
        lineHeight: 20,
        marginBottom: spacing[5],
    },
    inlineCreateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.lime,
        paddingHorizontal: spacing[3],
        paddingVertical: spacing[1.5],
        borderRadius: radii.md,
    },
    inlineCreateBtnText: {
        fontFamily,
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },

    segmentContainer: {
        flexDirection: 'row',
        paddingHorizontal: spacing[6],
        paddingBottom: spacing[4],
        gap: spacing[2],
    },
    segmentBtn: {
        paddingHorizontal: spacing[5],
        paddingVertical: spacing[3],
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.full,
        backgroundColor: colors.white,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
        ...shadows.sm,
    },
    segmentBtnActive: {
        backgroundColor: colors.lime,
        borderColor: colors.lime,
    },
    segmentText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    segmentTextActive: {
        color: colors.black,
    },

    formCard: {
        backgroundColor: colors.white,
        borderRadius: radii.xl,
        padding: spacing[5],
        ...shadows.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    formTitle: {
        fontFamily,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: colors.black,
        marginBottom: spacing[4],
    },
    formGrid: {
        flexDirection: 'row',
    },
    formLabel: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
        marginBottom: spacing[2],
    },
    formInputBox: {
        marginBottom: spacing[4],
    },

    thumbnailSelectorBtn: {
        width: '100%',
        height: 120,
        backgroundColor: colors.bgSecondary,
        borderRadius: radii.lg,
        borderWidth: 2,
        borderColor: colors.border,
        borderStyle: 'dashed',
        marginBottom: spacing[6],
        overflow: 'hidden',
    },
    thumbnailPreviewContainer: { flex: 1, position: 'relative' },
    thumbnailPreviewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    thumbnailPreviewOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    thumbnailPreviewText: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.white,
    },
    thumbnailEmptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing[2],
    },
    thumbnailEmptyText: {
        fontFamily,
        fontSize: typography.size.sm,
        color: colors.textMuted,
    },

    modalContainer: { flex: 1, backgroundColor: colors.bgPrimary },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing[5],
        paddingTop: spacing[8],
        backgroundColor: colors.white,
        borderBottomWidth: 1,
        borderColor: colors.border,
    },
    modalTitle: {
        fontFamily,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    thumbnailGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: spacing[4],
        gap: spacing[4],
    },
    thumbnailOption: {
        borderRadius: radii.md,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    thumbnailOptionSelected: {
        borderColor: colors.lime,
        transform: [{ scale: 1.05 }],
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },

    publishBtn: {
        backgroundColor: colors.lime,
        height: 52,
        borderRadius: radii.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing[2],
    },
    publishBtnText: {
        fontFamily,
        fontSize: typography.size.base,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },

    reviewCard: {
        backgroundColor: colors.white,
        borderRadius: radii.xl,
        padding: spacing[5],
        marginBottom: spacing[4],
        borderWidth: 1,
        borderColor: colors.border,
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
    cardActions: {
        flexDirection: 'row',
        gap: spacing[2],
    },
    actionBtn: {
        flex: 1,
        height: 44,
        borderRadius: radii.lg,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.sm,
    },
    actionBtnText: {
        fontFamily,
        fontSize: typography.size.xs,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },

    logCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: colors.white,
        padding: spacing[4],
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.sm,
    },
    logAction: {
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
        marginBottom: 2,
        flexWrap: 'wrap',
    },
    logMeta: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.textSecondary,
        marginBottom: 2,
    },
    logDate: {
        fontFamily,
        fontSize: typography.size.xs,
        color: colors.textMuted,
    },

    upiHandleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgSecondary,
        padding: spacing[3],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    upiHandleText: {
        flex: 1,
        fontFamily,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.bold,
        color: colors.black,
    },
    upiRemoveBtn: {
        padding: spacing[1],
    },
    addUpiRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing[6],
    },
    addUpiBtn: {
        width: 52,
        height: 52,
        backgroundColor: colors.lime,
        borderRadius: radii.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing[4],
    },
    emptyState: {
        paddingVertical: 60,
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
});
