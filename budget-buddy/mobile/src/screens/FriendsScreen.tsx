import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { friendsAPI, usersAPI } from '../api/services';
import { useAuthStore } from '../store/auth';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { colors, fontSizes, fontWeights, spacing, radius } from '../theme';

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const store = useAuthStore();
  const [friends, setFriends] = useState<any[]>([]);
  const [pending, setPending] = useState<any>({ received: [], sent: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [tab, setTab] = useState<'friends' | 'pending'>('friends');

  const load = useCallback(async () => {
    try {
      const [f, p] = await Promise.all([friendsAPI.list(), friendsAPI.pending()]);
      setFriends(f.data.friends);
      setPending(p.data);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await usersAPI.search(searchQuery.trim());
      setSearchResults((res.data.users as any[]).filter((u: any) => u.id !== store.user?.id));
    } catch {}
  };

  const sendRequest = async (userId: string) => {
    try { await friendsAPI.sendRequest(userId); Alert.alert('Success', 'Friend request sent!'); setShowSearch(false); }
    catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleAccept = async (id: string) => {
    await friendsAPI.accept(id); load();
  };

  const handleReject = async (id: string) => {
    await friendsAPI.reject(id); load();
  };

  const handleRemove = (id: string) => {
    Alert.alert('Remove Friend', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await friendsAPI.remove(id); load(); } }
    ]);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowSearch(true)}>
          <Ionicons name="person-add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'friends' && styles.tabActive]} onPress={() => setTab('friends')}>
          <Text style={[styles.tabText, tab === 'friends' && styles.tabTextActive]}>Friends ({friends.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'pending' && styles.tabActive]} onPress={() => setTab('pending')}>
          <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>
            Pending {pending.received.length > 0 ? `(${pending.received.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'friends' ? (
        <FlatList
          data={friends}
          keyExtractor={f => f.friendship_id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No Friends Yet" subtitle="Search and add friends to split bills" />}
          renderItem={({ item }) => (
            <Card style={styles.friendCard}>
              <View style={styles.friendRow}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{item.friend.name.charAt(0).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendName}>{item.friend.name}</Text>
                  <Text style={styles.friendEmail}>{item.friend.email}</Text>
                </View>
                <TouchableOpacity onPress={() => handleRemove(item.friendship_id)}>
                  <Ionicons name="person-remove-outline" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={pending.received}
          keyExtractor={f => f.friendship_id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState icon="mail-outline" title="No Pending Requests" />}
          renderItem={({ item }) => (
            <Card style={styles.friendCard}>
              <View style={styles.friendRow}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{item.friend.name.charAt(0).toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendName}>{item.friend.name}</Text>
                  <Text style={styles.friendEmail}>{item.friend.email}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item.friendship_id)}>
                    <Ionicons name="checkmark" size={18} color={colors.success} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.friendship_id)}>
                    <Ionicons name="close" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      {/* Search Modal */}
      <Modal visible={showSearch} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add Friend</Text>
            <Input label="Search by name or email" value={searchQuery} onChangeText={setSearchQuery} placeholder="Start typing..." icon="search-outline" />
            <Button title="Search" onPress={handleSearch} style={{ marginBottom: spacing.md }} />
            {searchResults.map(u => (
              <Card key={u.id} style={styles.resultCard}>
                <View style={styles.friendRow}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{u.name.charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.friendName}>{u.name}</Text>
                    <Text style={styles.friendEmail}>{u.email}</Text>
                  </View>
                  <Button title="Add" onPress={() => sendRequest(u.id)} style={{ paddingHorizontal: spacing.md }} />
                </View>
              </Card>
            ))}
            <Button title="Close" variant="ghost" onPress={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }} style={{ marginTop: spacing.md }} />
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
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: fontSizes.sm, fontWeight: '500' },
  tabTextActive: { color: colors.primary, fontWeight: '600' },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 80 },
  friendCard: { marginBottom: 0 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary + '33', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontSize: fontSizes.md, fontWeight: fontWeights.bold },
  friendName: { fontSize: fontSizes.md, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  friendEmail: { fontSize: fontSizes.xs, color: colors.textMuted, marginTop: 2 },
  acceptBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.success + '22', alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.danger + '22', alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bgCard, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: '80%' },
  modalTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary, marginBottom: spacing.md },
  resultCard: { marginBottom: spacing.sm },
});
