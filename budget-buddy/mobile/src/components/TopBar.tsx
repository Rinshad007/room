/**
 * TopBar — matches web's TopBar.tsx
 * Shows avatar (→ Profile), title, Friends icon, Notifications with badge + panel.
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  FlatList, Pressable, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import { useAuthStore } from '../store/auth';
import { notificationsAPI } from '../api/services';
import type { Notification } from '../types';
import { colors, fontSizes, fontWeights, spacing, radius, shadows } from '../theme';

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  showNotifications?: boolean;
  onBack?: () => void;
}

export default function TopBar({
  title = 'Budget Buddy',
  showBack = false,
  showNotifications = true,
  onBack,
}: TopBarProps) {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    if (!showNotifications || !user?.id) return;

    const notifRef = ref(db, 'notifications');
    const unsubscribe = onValue(notifRef, (snapshot) => {
      const list: Notification[] = [];
      if (snapshot.exists()) {
        Object.values(snapshot.val()).forEach((n: any) => {
          if (n && n.user_id === user.id) {
            list.push(n as Notification);
          }
        });
      }
      list.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setNotifications(list);
    }, (error) => {
      console.error("Live notifications listener failed", error);
    });

    return () => unsubscribe();
  }, [showNotifications, user?.id]);

  const unread = notifications.filter(n => !n.is_read).length;

  const handleMarkAll = () => {
    notificationsAPI.readAll().then(() => {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    });
    setShowPanel(false);
  };

  const initials = user?.name
    ?.split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'BB';

  return (
    <>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.inner}>
          {/* Left: avatar or back + logo + title */}
          <View style={styles.left}>
            {showBack ? (
              <TouchableOpacity onPress={onBack || (() => nav.goBack())} style={styles.iconBtn} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={24} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => nav.navigate('Profile')} activeOpacity={0.8}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              </TouchableOpacity>
            )}
            <Text style={styles.title}>{title}</Text>
          </View>

          {/* Right: Friends + Notifications */}
          <View style={styles.right}>
            <TouchableOpacity
              onPress={() => nav.navigate('Friends')}
              style={styles.iconBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="people-outline" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>

            {showNotifications && (
              <TouchableOpacity
                onPress={() => setShowPanel(true)}
                style={styles.iconBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="notifications-outline" size={22} color={colors.onSurfaceVariant} />
                {unread > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Notifications Panel Modal */}
      <Modal
        visible={showPanel}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPanel(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowPanel(false)}>
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Notifications</Text>
              {unread > 0 && (
                <TouchableOpacity onPress={handleMarkAll}>
                  <Text style={styles.markAllText}>Mark all read</Text>
                </TouchableOpacity>
              )}
            </View>

            {notifications.length === 0 ? (
              <View style={styles.emptyNotif}>
                <Text style={styles.emptyNotifText}>No notifications yet</Text>
              </View>
            ) : (
              <FlatList
                data={notifications.slice(0, 10)}
                keyExtractor={item => item.id}
                renderItem={({ item: n }) => (
                  <View style={[styles.notifItem, !n.is_read && styles.notifUnread]}>
                    <Text style={styles.notifTitle}>{n.title}</Text>
                    <Text style={styles.notifMsg}>{n.message}</Text>
                    <Text style={styles.notifDate}>
                      {new Date(n.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Platform.OS === 'android' ? colors.bg : 'rgba(248,249,250,0.92)',
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant + '50',
    ...shadows.nav,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.pagePadding,
    height: 56,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: fontWeights.bold,
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: colors.error,
    borderRadius: 8,
    paddingHorizontal: 4,
    minWidth: 16,
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  // Panel
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: spacing.pagePadding,
  },
  panel: {
    width: 300,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    maxHeight: 380,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '40',
    overflow: 'hidden',
    ...shadows.float,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant + '30',
  },
  panelTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  markAllText: {
    fontSize: fontSizes.xs,
    color: colors.secondary,
    fontWeight: fontWeights.semibold,
  },
  emptyNotif: { padding: spacing.xl, alignItems: 'center' },
  emptyNotifText: {
    color: colors.onSurfaceVariant,
    fontSize: fontSizes.sm,
  },
  notifItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant + '20',
  },
  notifUnread: { backgroundColor: colors.secondary + '0D' },
  notifTitle: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.onSurface,
  },
  notifMsg: {
    fontSize: fontSizes.xs,
    color: colors.onSurfaceVariant,
    marginTop: 2,
  },
  notifDate: {
    fontSize: 10,
    color: colors.onSurfaceVariant + '99',
    marginTop: 4,
  },
});
