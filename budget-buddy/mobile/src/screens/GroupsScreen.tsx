/**
 * GroupsScreen — port of web's GroupsPage.tsx
 *
 * List view → tap → Group detail (members, expenses, add member modal, delete)
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, Pressable, Alert, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TopBar from '../components/TopBar';
import Card from '../components/Card';
import Skeleton from '../components/Skeleton';
import { useAuthStore } from '../store/auth';
import { groupsAPI, friendsAPI } from '../api/services';
import type { Group, FriendWithRequest } from '../types';
import { colors, fontSizes, fontWeights, radius, spacing, shadows } from '../theme';

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<FriendWithRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  // Create group modal
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  // Add member modal
  const [showAddMember, setShowAddMember] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [gr, fr] = await Promise.all([groupsAPI.list(), friendsAPI.list()]);
      setGroups(gr.data.groups || []);
      setFriends(fr.data.friends || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!newGroupName.trim()) return;
    setCreating(true);
    try {
      await groupsAPI.create({ name: newGroupName.trim() });
      setNewGroupName('');
      setShowCreate(false);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleAddMember = async (friendId: string) => {
    if (!selectedGroup || addingMemberId) return;
    setAddingMemberId(friendId);
    try {
      await groupsAPI.addMember(selectedGroup.id, friendId);
      await load();
      const updated = (await groupsAPI.list()).data.groups?.find((g: Group) => g.id === selectedGroup.id);
      if (updated) setSelectedGroup(updated);
      setShowAddMember(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add member');
    } finally {
      setAddingMemberId(null);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    Alert.alert('Delete Group?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await groupsAPI.delete(groupId);
            setSelectedGroup(null);
            await load();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete group');
          }
        },
      },
    ]);
  };

  const alreadyMemberIds = new Set(selectedGroup?.members?.map((m: any) => m.user.id) || []);
  const availableFriends = friends.filter(f => !alreadyMemberIds.has(f.friend.id));

  if (loading) {
    return (
      <View style={styles.root}>
        <TopBar title="Groups" showBack />
        <ScrollView contentContainerStyle={styles.scroll}>
          {[...Array(3)].map((_, i) => <Skeleton key={i} height={80} borderRadius={radius.xl} />)}
        </ScrollView>
      </View>
    );
  }

  // ── Group Detail ────────────────────────────────────────────────────────────
  if (selectedGroup) {
    return (
      <View style={styles.root}>
        <TopBar title={selectedGroup.name} showBack onBack={() => setSelectedGroup(null)} />
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Group card */}
          <Card glass>
            <View style={styles.groupDetailHeader}>
              <View style={styles.groupIcon}>
                <Ionicons name="people" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.groupDetailName}>{selectedGroup.name}</Text>
                <Text style={styles.groupDetailSub}>{selectedGroup.members?.length || 0} members</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteGroup(selectedGroup.id)} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>

            {/* Members */}
            <Text style={styles.membersLabel}>Members</Text>
            <View style={styles.memberChips}>
              {(selectedGroup.members || []).map((m: any) => (
                <View key={m.user.id} style={styles.memberChip}>
                  <View style={styles.memberChipAvatar}>
                    <Text style={styles.memberChipAvatarText}>{m.user.name[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.memberChipName}>{m.user.id === user?.id ? 'You' : m.user.name}</Text>
                </View>
              ))}
            </View>

            {/* Add member button */}
            <TouchableOpacity
              style={styles.addMemberBtn}
              onPress={() => setShowAddMember(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add-outline" size={18} color={colors.onPrimary} />
              <Text style={styles.addMemberBtnText}>Add Member</Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>

        {/* Add Member Modal */}
        <Modal visible={showAddMember} transparent animationType="slide" onRequestClose={() => setShowAddMember(false)}>
          <Pressable style={styles.overlay} onPress={() => setShowAddMember(false)}>
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Add a Member</Text>
              {availableFriends.length === 0 ? (
                <Text style={styles.emptyText}>All friends are already in this group.</Text>
              ) : (
                <FlatList
                  data={availableFriends}
                  keyExtractor={f => f.friend.id}
                  renderItem={({ item: f }) => (
                    <TouchableOpacity
                      style={styles.friendPickerRow}
                      onPress={() => handleAddMember(f.friend.id)}
                      disabled={addingMemberId === f.friend.id}
                    >
                      <View style={styles.friendPickerAvatar}>
                        <Text style={styles.memberChipAvatarText}>{f.friend.name[0]?.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.friendPickerName}>{f.friend.name}</Text>
                      {addingMemberId === f.friend.id && (
                        <Text style={styles.addingText}>Adding…</Text>
                      )}
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  }

  // ── Group List ──────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <TopBar title="Groups" showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.listHeader}>
          <Text style={styles.pageTitle}>Groups</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color={colors.onPrimary} />
            <Text style={styles.createBtnText}>New Group</Text>
          </TouchableOpacity>
        </View>

        {groups.length === 0 ? (
          <Card glass style={styles.emptyCard}>
            <Ionicons name="people-outline" size={48} color={colors.onSurfaceVariant + '50'} />
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptyText}>Create a group to split expenses with multiple people.</Text>
          </Card>
        ) : (
          groups.map(g => (
            <TouchableOpacity key={g.id} onPress={() => setSelectedGroup(g)} activeOpacity={0.85}>
              <Card glass style={styles.groupCard}>
                <View style={styles.groupIcon}>
                  <Ionicons name="people" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupName}>{g.name}</Text>
                  <Text style={styles.groupSub}>{g.members?.length || 0} members</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant + '60'} />
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Create Group Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowCreate(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Group</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={22} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Group Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Goa Trip 2024"
                placeholderTextColor={colors.onSurfaceVariant + '80'}
                value={newGroupName}
                onChangeText={setNewGroupName}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, creating && { opacity: 0.65 }]}
              onPress={handleCreate}
              disabled={creating}
            >
              <Ionicons name="people-outline" size={18} color={colors.onPrimary} />
              <Text style={styles.saveBtnText}>{creating ? 'Creating…' : 'Create Group'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.pagePadding, paddingTop: spacing.md, gap: spacing.md },

  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: fontSizes.xxl, fontWeight: fontWeights.bold, color: colors.primary },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.lg,
    ...shadows.card,
  },
  createBtnText: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colors.onPrimary },

  groupCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  groupIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
  },
  groupName: { fontSize: fontSizes.md, fontWeight: fontWeights.semibold, color: colors.primary },
  groupSub: { fontSize: fontSizes.xs, color: colors.onSurfaceVariant, marginTop: 2 },

  emptyCard: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyTitle: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.primary },
  emptyText: { fontSize: fontSizes.sm, color: colors.onSurfaceVariant + '99', textAlign: 'center' },

  // Detail
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  backText: { fontSize: fontSizes.sm, color: colors.onSurfaceVariant },
  groupDetailHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  groupDetailName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.primary },
  groupDetailSub: { fontSize: fontSizes.xs, color: colors.onSurfaceVariant },
  membersLabel: {
    fontSize: fontSizes.xs, fontWeight: fontWeights.semibold,
    color: colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  memberChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  memberChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.bgSurfaceContainer, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6 },
  memberChipAvatar: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
  },
  memberChipAvatarText: { fontSize: 11, fontWeight: fontWeights.bold, color: colors.primary },
  memberChipName: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.onSurface },
  addMemberBtn: {
    height: 44, borderRadius: radius.xl, backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadows.float,
  },
  addMemberBtnText: { color: colors.onPrimary, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold },

  // Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.bgCard, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    padding: spacing.xl, gap: spacing.md, maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.primary },
  fieldGroup: { gap: 6 },
  fieldLabel: {
    fontSize: fontSizes.xs, fontWeight: fontWeights.semibold,
    color: colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    height: 48, borderRadius: radius.lg, backgroundColor: colors.bgSurfaceContainerLow,
    paddingHorizontal: 14, fontSize: fontSizes.sm, color: colors.onSurface,
  },
  saveBtn: {
    height: 48, borderRadius: radius.xl, backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadows.float,
  },
  saveBtnText: { color: colors.onPrimary, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold },

  friendPickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.outlineVariant + '20',
  },
  friendPickerAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
  },
  friendPickerName: { flex: 1, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.onSurface },
  addingText: { fontSize: fontSizes.xs, color: colors.onSurfaceVariant, fontStyle: 'italic' },
});
