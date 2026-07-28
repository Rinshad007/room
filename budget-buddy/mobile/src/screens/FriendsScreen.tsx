/**
 * FriendsScreen — port of web's FriendsPage.tsx
 *
 * Tabs: All Friends | Pending Requests
 * Features: Search by name/email, send request, accept/decline received, cancel sent, remove friend
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TopBar from '../components/TopBar';
import Card from '../components/Card';
import Skeleton from '../components/Skeleton';
import { useAuthStore } from '../store/auth';
import { friendsAPI, usersAPI } from '../api/services';
import type { FriendWithRequest, User } from '../types';
import { colors, fontSizes, fontWeights, radius, spacing, shadows } from '../theme';

type Tab = 'friends' | 'pending';

export default function FriendsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<FriendWithRequest[]>([]);
  const [pending, setPending] = useState<FriendWithRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [fr, pe] = await Promise.all([friendsAPI.list(), friendsAPI.pendingRequests()]);
      setFriends(fr.data.friends || []);
      setPending(pe.data.pending_requests || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setHasSearched(false);
    try {
      const res = await usersAPI.search(searchQuery.trim());
      // Filter out self
      const list = (res.data.users || []).filter((u: User) => u.id !== user?.id);
      setSearchResults(list);
      setHasSearched(true);
    } catch {
      Alert.alert('Error', 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (targetId: string) => {
    try {
      await friendsAPI.sendRequest(targetId);
      Alert.alert('Success', 'Friend request sent!');
      setSearchQuery('');
      setSearchResults([]);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send request');
    }
  };

  const handleAccept = async (friendshipId: string) => {
    try {
      await friendsAPI.acceptRequest(friendshipId);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to accept request');
    }
  };

  const handleDecline = async (friendshipId: string) => {
    try {
      await friendsAPI.declineRequest(friendshipId);
      await load();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to decline request');
    }
  };

  const handleRemove = async (friendshipId: string) => {
    Alert.alert('Remove Friend?', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await friendsAPI.removeFriend(friendshipId);
            await load();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to remove friend');
          }
        },
      },
    ]);
  };

  const pendingReceived = pending.filter((p: any) => p.receiver_id === user?.id || p.friend?.receiver_id === user?.id);
  const pendingSent = pending.filter((p: any) => p.sender_id === user?.id || p.friend?.sender_id === user?.id);
  const totalPending = pendingReceived.length + pendingSent.length;

  if (loading) {
    return (
      <View style={styles.root}>
        <TopBar title="Friends" showBack />
        <ScrollView contentContainerStyle={styles.scroll}>
          {[...Array(4)].map((_, i) => <Skeleton key={i} height={72} borderRadius={radius.xl} />)}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <TopBar title="Friends" showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Search + Send (Add Friend) ─────────────────────────────── */}
        <Card glass>
          <Text style={styles.sectionTitle}>Add Friend</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by email or name..."
              placeholderTextColor={colors.onSurfaceVariant + '80'}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                if (hasSearched) setHasSearched(false);
              }}
              autoCapitalize="none"
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={handleSearch}
              disabled={searching || !searchQuery.trim()}
              activeOpacity={0.85}
            >
              {searching ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={styles.searchBtnText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Search Results */}
          {searchResults.length > 0 ? (
            <View style={styles.searchResultsContainer}>
              {searchResults.map((u) => {
                const isAlreadyFriend = friends.some(f => f.friend.id === u.id);
                const isPendingSent = pendingSent.some(p => p.friend?.id === u.id || p.receiver_id === u.id);
                const isPendingRecv = pendingReceived.some(p => p.friend?.id === u.id || p.sender_id === u.id);

                return (
                  <View key={u.id} style={styles.resultRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{u.name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={styles.friendInfo}>
                      <Text style={styles.friendName}>{u.name}</Text>
                      <Text style={styles.friendEmail}>{u.email}</Text>
                    </View>
                    {isAlreadyFriend ? (
                      <View style={styles.statusChip}>
                        <Text style={styles.statusChipText}>Friend</Text>
                      </View>
                    ) : isPendingSent ? (
                      <View style={styles.statusChip}>
                        <Text style={styles.statusChipText}>Sent</Text>
                      </View>
                    ) : isPendingRecv ? (
                      <TouchableOpacity
                        style={styles.acceptMiniBtn}
                        onPress={() => {
                          const item = pendingReceived.find(p => p.friend?.id === u.id || p.sender_id === u.id);
                          if (item) handleAccept(item.friendship_id || item.id || '');
                        }}
                      >
                        <Text style={styles.acceptMiniText}>Accept</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.addMiniBtn}
                        onPress={() => sendRequest(u.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.addMiniText}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          ) : hasSearched ? (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>No users found matching "{searchQuery}"</Text>
            </View>
          ) : null}
        </Card>

        {/* ── Tabs ─────────────────────────────────────────────────── */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'friends' && styles.tabBtnActive]}
            onPress={() => setTab('friends')}
          >
            <Text style={[styles.tabText, tab === 'friends' && styles.tabTextActive]}>
              All Friends ({friends.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'pending' && styles.tabBtnActive]}
            onPress={() => setTab('pending')}
          >
            <Text style={[styles.tabText, tab === 'pending' && styles.tabTextActive]}>Pending Requests</Text>
            {totalPending > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{totalPending}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Friends Tab ───────────────────────────────────────────── */}
        {tab === 'friends' && (
          <Card glass>
            {friends.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={40} color={colors.onSurfaceVariant + '50'} />
                <Text style={styles.emptyText}>No friends added yet. Use search above to find people.</Text>
              </View>
            ) : (
              friends.map(f => (
                <View key={f.friendship_id} style={styles.friendRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{f.friend.name[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{f.friend.name}</Text>
                    <Text style={styles.friendEmail}>Settled up</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemove(f.friendship_id)}
                    style={styles.removeBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={20} color={colors.onSurfaceVariant + '66'} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </Card>
        )}

        {/* ── Pending Tab ────────────────────────────────────────────── */}
        {tab === 'pending' && (
          <Card glass>
            {totalPending === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="time-outline" size={40} color={colors.onSurfaceVariant + '50'} />
                <Text style={styles.emptyText}>No pending requests.</Text>
              </View>
            ) : (
              <>
                {pendingReceived.length > 0 && (
                  <View>
                    <Text style={styles.pendingLabel}>Received</Text>
                    {pendingReceived.map((p: any) => {
                      const senderName = p.friend?.name || p.sender_name || 'User';
                      const id = p.friendship_id || p.id;
                      return (
                        <View key={id} style={styles.friendRow}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{senderName[0]?.toUpperCase()}</Text>
                          </View>
                          <View style={styles.friendInfo}>
                            <Text style={styles.friendName}>{senderName}</Text>
                            <Text style={styles.friendEmail}>Wants to be friends</Text>
                          </View>
                          <View style={styles.actionBtns}>
                            <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(id)} activeOpacity={0.85}>
                              <Text style={styles.acceptBtnText}>Accept</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(id)} activeOpacity={0.85}>
                              <Ionicons name="close" size={16} color={colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {pendingSent.length > 0 && (
                  <View style={{ marginTop: pendingReceived.length > 0 ? 12 : 0 }}>
                    <Text style={styles.pendingLabel}>Sent</Text>
                    {pendingSent.map((p: any) => {
                      const receiverName = p.friend?.name || p.receiver_name || 'User';
                      const id = p.friendship_id || p.id;
                      return (
                        <View key={id} style={styles.friendRow}>
                          <View style={[styles.avatar, { backgroundColor: colors.bgSurfaceContainerHigh }]}>
                            <Text style={styles.avatarText}>{receiverName[0]?.toUpperCase()}</Text>
                          </View>
                          <View style={styles.friendInfo}>
                            <Text style={styles.friendName}>{receiverName}</Text>
                            <Text style={styles.friendEmail}>Request sent</Text>
                          </View>
                          <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => handleDecline(id)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.pagePadding, paddingTop: spacing.md, gap: spacing.md },

  sectionTitle: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.primary, marginBottom: 12 },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: {
    flex: 1, height: 48, borderRadius: radius.lg,
    backgroundColor: colors.bgSurfaceContainerLow,
    paddingHorizontal: 14, fontSize: fontSizes.sm, color: colors.onSurface,
  },
  searchBtn: {
    height: 48, paddingHorizontal: 16, borderRadius: radius.lg,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.float,
  },
  searchBtnText: { color: colors.onPrimary, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold },

  searchResultsContainer: {
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: colors.outlineVariant + '22',
    gap: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addMiniBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addMiniText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  acceptMiniBtn: {
    backgroundColor: colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  acceptMiniText: {
    color: colors.onSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  statusChip: {
    backgroundColor: colors.bgSurfaceContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    fontWeight: '600',
  },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgSurfaceContainerLow,
    borderRadius: radius.xl,
    padding: 4,
    gap: 4,
  },
  tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.lg },
  tabBtnActive: { backgroundColor: colors.bgCard, ...shadows.card },
  tabText: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, color: colors.onSurfaceVariant },
  tabTextActive: { color: colors.primary, fontWeight: fontWeights.bold },
  badge: { backgroundColor: colors.error, borderRadius: 100, paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: fontWeights.bold },

  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.primary },
  friendInfo: { flex: 1 },
  friendName: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.primary },
  friendEmail: { fontSize: fontSizes.xs, color: colors.onSurfaceVariant, marginTop: 1 },

  removeBtn: { padding: 8, borderRadius: 8 },

  actionBtns: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  acceptBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.primary },
  acceptBtnText: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colors.onPrimary },
  declineBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.error + '50', alignItems: 'center', justifyContent: 'center' },

  cancelBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: colors.outlineVariant },
  cancelBtnText: { fontSize: fontSizes.xs, color: colors.onSurfaceVariant, fontWeight: fontWeights.medium },

  pendingLabel: {
    fontSize: fontSizes.xs, fontWeight: fontWeights.semibold,
    color: colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  emptyText: { fontSize: fontSizes.sm, color: colors.onSurfaceVariant + '99', textAlign: 'center', fontStyle: 'italic' },
  noResultsContainer: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: colors.outlineVariant + '22',
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 13,
    color: colors.onSurfaceVariant + 'b2',
    fontStyle: 'italic',
  },
});
