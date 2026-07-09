import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { groupsAPI, usersAPI } from '../api/services';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { colors, fontSizes, fontWeights, spacing, radius } from '../theme';
import type { Group } from '../types';

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await groupsAPI.list();
      setGroups(res.data.groups);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!groupName.trim()) { Alert.alert('Error', 'Group name is required'); return; }
    setCreating(true);
    try {
      await groupsAPI.create({ name: groupName.trim(), description: groupDesc.trim() });
      setShowCreate(false); setGroupName(''); setGroupDesc('');
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    setCreating(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Group', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await groupsAPI.delete(id); load(); } }
    ]);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Groups</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={groups}
        keyExtractor={g => g.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={<EmptyState icon="people-outline" title="No Groups Yet" subtitle="Create a group to split expenses with friends" />}
        renderItem={({ item }) => (
          <Card style={styles.groupCard}>
            <View style={styles.groupRow}>
              <View style={styles.groupIconWrapper}>
                <Text style={styles.groupIcon}>👥</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupName}>{item.name}</Text>
                {item.description ? <Text style={styles.groupDesc}>{item.description}</Text> : null}
                <Text style={styles.memberCount}>{item.members.length} member{item.members.length !== 1 ? 's' : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
            <View style={styles.members}>
              {item.members.slice(0, 4).map(m => (
                <View key={m.id} style={styles.memberPill}>
                  <Text style={styles.memberPillText}>{m.user.name.charAt(0).toUpperCase()}</Text>
                </View>
              ))}
              {item.members.length > 4 && <Text style={styles.moreMembers}>+{item.members.length - 4}</Text>}
            </View>
          </Card>
        )}
      />

      {/* Create Group Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Create Group</Text>
            <Input label="Group Name" value={groupName} onChangeText={setGroupName} placeholder="e.g. Trip to Goa" autoCapitalize="words" />
            <Input label="Description (optional)" value={groupDesc} onChangeText={setGroupDesc} placeholder="What's this group for?" />
            <View style={styles.modalButtons}>
              <Button title="Cancel" variant="ghost" onPress={() => { setShowCreate(false); setGroupName(''); setGroupDesc(''); }} style={{ flex: 1 }} />
              <Button title="Create" onPress={handleCreate} loading={creating} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 80 },
  groupCard: { marginBottom: 0 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  groupIconWrapper: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center' },
  groupIcon: { fontSize: 22 },
  groupName: { fontSize: fontSizes.md, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  groupDesc: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  memberCount: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  members: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  memberPill: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary + '33', alignItems: 'center', justifyContent: 'center' },
  memberPillText: { color: colors.primary, fontSize: fontSizes.xs, fontWeight: '700' },
  moreMembers: { color: colors.textMuted, fontSize: fontSizes.xs },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bgCard, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  modalTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary, marginBottom: spacing.lg },
  modalButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
