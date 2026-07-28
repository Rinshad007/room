/**
 * AddExpenseScreen — exact port of web's AddExpensePage.tsx
 *
 * Features:
 *  - Large centered amount input (₹ symbol + number)
 *  - Title, Description, Date, Group selector
 *  - Horizontal CategoryPicker with custom category modal
 *  - Participants toggle (select friends to split with)
 *  - Split type: Equal / Percentage / Custom (₹)
 *  - Per-participant share inputs for pct/custom modes
 *  - Sticky "Save Expense" button at bottom
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Modal, Pressable, Alert, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import TopBar from '../components/TopBar';
import Card from '../components/Card';
import CategoryPicker from '../components/CategoryPicker';
import { useAuthStore } from '../store/auth';
import { groupsAPI, friendsAPI, expensesAPI, usersAPI } from '../api/services';
import { matchCategoryIcon } from '../utils/categoryHelpers';
import type { Group, FriendWithRequest, SplitType } from '../types';
import { colors, fontSizes, fontWeights, radius, spacing, shadows, glassPanel } from '../theme';
import Toast from 'react-native-toast-message';

const DEFAULT_CATEGORIES = [
  { name: 'Food', icon: '🍔' },
  { name: 'Travel', icon: '✈️' },
  { name: 'Shopping', icon: '🛍️' },
  { name: 'Rent', icon: '🏠' },
  { name: 'Entertainment', icon: '🎬' },
  { name: 'Others', icon: '📦' },
];

const AVATAR_COLORS = [
  { bg: '#dcf8c6', text: '#075e54' }, // WhatsApp Green
  { bg: '#e0f2fe', text: '#0369a1' }, // Sky Blue
  { bg: '#fef3c7', text: '#b45309' }, // Amber
  { bg: '#fee2e2', text: '#b91c1c' }, // Crimson
  { bg: '#f3e8ff', text: '#6b21a8' }, // Purple
  { bg: '#fce7f3', text: '#be185d' }, // Rose/Pink
  { bg: '#e0e7ff', text: '#4338ca' }, // Indigo
  { bg: '#ccfbf1', text: '#0f766e' }, // Teal
  { bg: '#ffedd5', text: '#c2410c' }, // Orange
];

const getFriendAvatarColor = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
};

export default function AddExpenseScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { user } = useAuthStore();

  // Custom categories
  const [customCategories, setCustomCategories] = useState<{ name: string; icon: string }[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [showAddCatModal, setShowAddCatModal] = useState(false);

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  // Form state
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Food');
  const [groupId, setGroupId] = useState('');

  // Lists
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<FriendWithRequest[]>([]);
  const [eligibleParticipants, setEligibleParticipants] = useState<{ id: string; name: string }[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  // Split
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [customShares, setCustomShares] = useState<Record<string, number>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);

  const [saving, setSaving] = useState(false);

  // Group selector modal
  const [showGroupModal, setShowGroupModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const gr = await groupsAPI.list();
        setGroups(gr.data.groups || []);
      } catch (err) {
        console.error('Failed to load groups in AddExpenseScreen:', err);
      }

      try {
        const fr = await friendsAPI.list();
        setFriends(fr.data.friends || []);
      } catch (err) {
        console.error('Failed to load friends in AddExpenseScreen:', err);
      }

      try {
        const cr = await usersAPI.getCustomCategories();
        setCustomCategories(cr.data || []);
      } catch (err) {
        console.error('Failed to load custom categories in AddExpenseScreen:', err);
      }
    })();
  }, []);

  // Update eligible participants when group changes
  useEffect(() => {
    if (groupId) {
      const grp = groups.find(g => g.id === groupId);
      if (grp) {
        const members = grp.members
          .filter((m: any) => m.user.id !== user?.id)
          .map((m: any) => ({ id: m.user.id, name: m.user.name }));
        setEligibleParticipants(members);
        setSelectedFriends(members.map((m: any) => m.id));
        const init: Record<string, number> = { you: 0 };
        members.forEach((m: any) => { init[m.id] = 0; });
        setCustomShares(init);
      }
    } else {
      const list = friends.map(f => ({ id: f.friend.id, name: f.friend.name }));
      setEligibleParticipants(list);
      setSelectedFriends([]);
      const init: Record<string, number> = { you: 0 };
      list.forEach(m => { init[m.id] = 0; });
      setCustomShares(init);
    }
  }, [groupId, groups, friends, user?.id]);

  const toggleParticipant = (id: string) => {
    setSelectedFriends(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const name = newCatName.trim();
    const icon = matchCategoryIcon(name);
    try {
      await usersAPI.addCustomCategory(name, icon);
      setCustomCategories(prev => [...prev, { name, icon }]);
      setCategory(name);
      setNewCatName('');
      setShowAddCatModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create category');
    }
  };

  const selectedParticipants = ['you', ...selectedFriends];
  const amountNum = parseFloat(amount) || 0;

  const resetForm = () => {
    setAmount('');
    setTitle('');
    setDescription('');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setCategory('Food');
    setGroupId('');
    setSelectedFriends([]);
    setSplitType('equal');
    const init: Record<string, number> = { you: 0 };
    eligibleParticipants.forEach(p => { init[p.id] = 0; });
    setCustomShares(init);
  };

  const handleSubmit = async () => {
    if (amountNum <= 0) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Amount must be greater than 0' });
      return;
    }
    if (!title.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Title is required' });
      return;
    }

    let split_details: { user_id: string; value: number }[] = [];
    if (selectedFriends.length > 0) {
      if (splitType === 'percentage') {
        let total = 0;
        selectedParticipants.forEach(pId => {
          const val = customShares[pId] || 0;
          total += val;
          split_details.push({ user_id: pId, value: val });
        });
        if (total !== 100) {
          Toast.show({ type: 'error', text1: 'Invalid split', text2: `Total must equal 100% (currently ${total}%)` });
          return;
        }
      } else if (splitType === 'custom') {
        let total = 0;
        selectedParticipants.forEach(pId => {
          const val = customShares[pId] || 0;
          total += val;
          split_details.push({ user_id: pId, value: val });
        });
        if (Math.abs(total - amountNum) > 0.01) {
          Toast.show({ type: 'error', text1: 'Invalid split', text2: `Total must equal ₹${amountNum} (currently ₹${total})` });
          return;
        }
      } else {
        selectedParticipants.forEach(pId => split_details.push({ user_id: pId, value: 0 }));
      }
    } else {
      split_details = [{ user_id: 'you', value: 0 }];
    }

    setSaving(true);
    try {
      await expensesAPI.create({
        title,
        description,
        amount: amountNum,
        payment_method: 'GPay',
        category,
        split_type: selectedFriends.length > 0 ? splitType : 'equal',
        group_id: groupId || undefined,
        expense_date: new Date(expenseDate).toISOString(),
        participants: selectedFriends.length > 0 ? selectedParticipants : ['you'],
        split_details: selectedFriends.length > 0 && splitType !== 'equal' ? split_details : undefined,
      } as any);
      // Reset form so user can add another expense right away
      resetForm();
      Toast.show({
        type: 'success',
        text1: '✅ Expense Added!',
        text2: `"${title}" saved successfully`,
        visibilityTime: 3000,
      });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to save', text2: err.message || 'Something went wrong' });
    } finally {
      setSaving(false);
    }
  };

  const selectedGrp = groups.find(g => g.id === groupId);

  const renderDatePicker = () => {
    if (!showDatePicker) return null;

    if (Platform.OS === 'ios') {
      return (
        <Modal
          transparent
          animationType="fade"
          visible={showDatePicker}
          onRequestClose={() => setShowDatePicker(false)}
        >
          <Pressable style={styles.dateModalOverlay} onPress={() => setShowDatePicker(false)}>
            <View style={styles.iosDateCard}>
              <View style={styles.iosDateHeader}>
                <Text style={styles.iosDateTitle}>Select Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.iosDateDone}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={new Date(expenseDate)}
                mode="date"
                display="inline"
                themeVariant="light"
                onChange={(event, selectedDate) => {
                  if (selectedDate) {
                    setExpenseDate(selectedDate.toISOString().split('T')[0]);
                  }
                }}
              />
            </View>
          </Pressable>
        </Modal>
      );
    }

    return (
      <DateTimePicker
        value={new Date(expenseDate)}
        mode="date"
        display="default"
        onChange={(event, selectedDate) => {
          setShowDatePicker(false);
          if (selectedDate) {
            setExpenseDate(selectedDate.toISOString().split('T')[0]);
          }
        }}
      />
    );
  };

  return (
    <View style={styles.root}>
      <TopBar title="Add Expense" showBack={false} />
      {renderDatePicker()}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Amount Input ──────────────────────────────────────────── */}
          <Card 
            glass 
            style={[
              styles.amountCard,
              amountFocused && styles.amountCardFocused
            ]}
          >
            <Text style={[
              styles.amountLabel,
              amountFocused && { color: colors.secondary }
            ]}>Amount</Text>
            <View style={styles.amountRow}>
              <Text style={[
                styles.currencySymbol,
                amountFocused && { color: colors.secondary }
              ]}>₹</Text>
              <TextInput
                style={[
                  styles.amountInput,
                  amountFocused && { color: colors.primary }
                ]}
                placeholder="0.00"
                placeholderTextColor={colors.onSurfaceVariant + '40'}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onFocus={() => setAmountFocused(true)}
                onBlur={() => setAmountFocused(false)}
              />
            </View>
          </Card>

          {/* ── Details Fields ─────────────────────────────────────────── */}
          <Card glass style={styles.formCard}>
            {/* Title */}
            <View style={[styles.fieldGroup, { marginBottom: 12 }]}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Dinner at Olive"
                placeholderTextColor={colors.onSurfaceVariant + '80'}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Description */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional description..."
                placeholderTextColor={colors.onSurfaceVariant + '80'}
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </Card>

          {/* ── Meta Fields ────────────────────────────────────────────── */}
          <Card glass style={styles.formCard}>
            {/* Date */}
            <View style={[styles.fieldGroup, { marginBottom: 12 }]}>
              <Text style={styles.label}>Date</Text>
              {Platform.OS === 'web' ? (
                <TextInput
                  style={styles.input}
                  value={expenseDate}
                  onChangeText={setExpenseDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.onSurfaceVariant + '80'}
                />
              ) : (
                <TouchableOpacity
                  style={[styles.input, styles.selectBtn]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.selectText}>
                    {new Date(expenseDate).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'long', year: 'numeric'
                    })}
                  </Text>
                  <Ionicons name="calendar-outline" size={16} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              )}
            </View>

            {/* Group */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Group</Text>
              <TouchableOpacity
                style={[styles.input, styles.selectBtn]}
                onPress={() => setShowGroupModal(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.selectText, !groupId && { color: colors.onSurfaceVariant + '80' }]} numberOfLines={1}>
                  {selectedGrp ? selectedGrp.name : 'No Group'}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
          </Card>

          {/* ── Category Picker ──────────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Category</Text>
            <CategoryPicker
              categories={allCategories}
              selected={category}
              onSelect={setCategory}
              onAddCategory={() => setShowAddCatModal(true)}
            />
          </View>

          {/* ── Split Settings ────────────────────────────────────────── */}
          <Card glass style={styles.formCard}>
            {/* Split Method (only when friends selected) */}
            {selectedFriends.length > 0 && (
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Split Method</Text>
                <View style={styles.splitToggle}>
                  {(['equal', 'percentage', 'custom'] as SplitType[]).map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.splitBtn, splitType === type && styles.splitBtnActive]}
                      onPress={() => setSplitType(type)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.splitBtnText, splitType === type && styles.splitBtnTextActive]}>
                        {type === 'equal' ? 'Equal' : type === 'percentage' ? '% Split' : '₹ Custom'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Participants */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Split With</Text>
              <Text style={styles.sublabel}>Select friends to split, or leave empty for personal</Text>

              {eligibleParticipants.length === 0 ? (
                <Text style={styles.emptyParticipants}>No friends yet. Add friends first!</Text>
              ) : (
                <View style={styles.participantList}>
                  {eligibleParticipants.map(p => {
                    const isChecked = selectedFriends.includes(p.id);

                    // Compute the share amount to show on each chip
                    let shareLabel = '';
                    if (isChecked && amountNum > 0) {
                      if (splitType === 'equal') {
                        const perPerson = amountNum / selectedParticipants.length;
                        shareLabel = `₹${perPerson.toFixed(2)}`;
                      } else if (splitType === 'percentage') {
                        const pct = customShares[p.id] || 0;
                        const rupees = (amountNum * pct) / 100;
                        shareLabel = pct > 0 ? `${pct}% · ₹${rupees.toFixed(2)}` : '';
                      } else if (splitType === 'custom') {
                        const amt = customShares[p.id] || 0;
                        shareLabel = amt > 0 ? `₹${amt.toFixed(2)}` : '';
                      }
                    }

                    return (
                      <View key={p.id} style={[
                        styles.participantRow,
                        isChecked && styles.participantRowActive,
                      ]}>
                        <View style={styles.participantLeft}>
                          <TouchableOpacity
                            onPress={() => toggleParticipant(p.id)}
                            style={[styles.checkbox, isChecked && styles.checkboxChecked]}
                            activeOpacity={0.8}
                          >
                            {isChecked && <Ionicons name="checkmark" size={12} color="#fff" />}
                          </TouchableOpacity>
                          
                          {/* Stylish Initial Avatar with unique colors */}
                          <View style={[
                            styles.friendAvatar,
                            {
                              backgroundColor: isChecked ? getFriendAvatarColor(p.id).text : getFriendAvatarColor(p.id).bg,
                              borderColor: isChecked ? getFriendAvatarColor(p.id).text : getFriendAvatarColor(p.id).bg,
                            }
                          ]}>
                            <Text style={[
                              styles.friendAvatarText,
                              { color: isChecked ? '#ffffff' : getFriendAvatarColor(p.id).text }
                            ]}>
                              {p.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                            </Text>
                          </View>

                          <Text style={styles.participantName}>{p.name}</Text>
                        </View>
                        {shareLabel ? (
                          <View style={styles.sharePill}>
                            <Text style={styles.sharePillText}>{shareLabel}</Text>
                          </View>
                        ) : isChecked ? (
                          <View style={styles.sharePillMuted}>
                            <Text style={styles.sharePillMutedText}>enter %</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Custom/Percentage share inputs */}
            {selectedFriends.length > 0 && splitType !== 'equal' && (
              <View style={[styles.fieldGroup, styles.sharesSection]}>
                <Text style={styles.label}>Configure Shares</Text>
                {selectedParticipants.map(pId => {
                  const pName = pId === 'you' ? 'You (Me)' : (eligibleParticipants.find(p => p.id === pId)?.name || 'Friend');
                  const pctVal = customShares[pId] || 0;
                  const rupeesFromPct = splitType === 'percentage' && amountNum > 0
                    ? (amountNum * pctVal) / 100
                    : null;
                  return (
                    <View key={pId} style={styles.shareRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.shareName}>{pName}</Text>
                        {splitType === 'percentage' && rupeesFromPct !== null && pctVal > 0 && (
                          <Text style={styles.shareRupeeHint}>= ₹{rupeesFromPct.toFixed(2)}</Text>
                        )}
                      </View>
                      <View style={styles.shareInput}>
                        {splitType === 'custom' && <Text style={styles.shareSymbol}>₹</Text>}
                        <TextInput
                          style={styles.shareField}
                          placeholder="0"
                          value={String(customShares[pId] || '')}
                          onChangeText={v => setCustomShares(prev => ({ ...prev, [pId]: parseFloat(v) || 0 }))}
                          keyboardType="decimal-pad"
                        />
                        {splitType === 'percentage' && <Text style={styles.shareSymbol}>%</Text>}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        </ScrollView>

        {/* ── Sticky Save Button ─────────────────────────────────────── */}
        <View style={[styles.saveBar, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 88 : 80 }]}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Ionicons name="save-outline" size={20} color={colors.onPrimary} />
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Expense'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Group Selector Modal ──────────────────────────────────────── */}
      <Modal visible={showGroupModal} transparent animationType="slide" onRequestClose={() => setShowGroupModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowGroupModal(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select Group</Text>
            <TouchableOpacity
              style={[styles.groupOption, !groupId && styles.groupOptionActive]}
              onPress={() => { setGroupId(''); setShowGroupModal(false); }}
            >
              <Text style={styles.groupOptionText}>No Group (Direct)</Text>
            </TouchableOpacity>
            {groups.map(g => (
              <TouchableOpacity
                key={g.id}
                style={[styles.groupOption, groupId === g.id && styles.groupOptionActive]}
                onPress={() => { setGroupId(g.id); setShowGroupModal(false); }}
              >
                <Text style={styles.groupOptionText}>{g.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ── Add Custom Category Modal ─────────────────────────────────── */}
      <Modal visible={showAddCatModal} transparent={true} animationType="fade" onRequestClose={() => setShowAddCatModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddCatModal(false)}>
          <View style={styles.catModal}>
            <View style={styles.catModalHeader}>
              <Text style={styles.modalTitle}>New Category</Text>
              <TouchableOpacity onPress={() => setShowAddCatModal(false)}>
                <Ionicons name="close" size={22} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Category Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Gym, Electricity, Cafe"
                placeholderTextColor={colors.onSurfaceVariant + '80'}
                value={newCatName}
                onChangeText={setNewCatName}
                autoFocus={true}
              />
              {newCatName.trim() ? (
                <Text style={styles.previewIcon}>
                  Matched icon: {matchCategoryIcon(newCatName)}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleAddCategory}>
              <Text style={styles.saveBtnText}>Create Category</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.md,
    gap: spacing.md,
  },

  // Amount
  amountCard: {
    alignItems: 'center',
    paddingVertical: 36,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  amountCardFocused: {
    borderColor: colors.secondary + '50',
    backgroundColor: colors.bgCard,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  amountLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  currencySymbol: {
    fontSize: fontSizes.xxxl,
    fontWeight: fontWeights.bold,
    color: colors.onSurfaceVariant,
  },
  amountInput: {
    fontSize: fontSizes.xxxl,
    fontWeight: fontWeights.bold,
    color: colors.onSurface,
    minWidth: 140,
    textAlign: 'center',
  },

  // Form
  formCard: { gap: 20 },
  fieldGroup: { gap: 10 },
  label: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 2,
  },
  sublabel: {
    fontSize: fontSizes.xs,
    color: colors.onSurfaceVariant + '99',
    marginLeft: 2,
    marginTop: -4,
    marginBottom: 4,
  },
  input: {
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurfaceContainerLow,
    paddingHorizontal: 14,
    fontSize: fontSizes.sm,
    color: colors.onSurface,
  },
  twoCol: { flexDirection: 'row', gap: 12 },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 10,
  },
  selectText: { fontSize: fontSizes.sm, color: colors.onSurface, flex: 1 },

  // Category section
  section: { gap: 6 },
  sectionLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.pagePadding,
  },

  // Split toggle
  splitToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgSurfaceContainerLow,
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
  },
  splitBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  splitBtnActive: { backgroundColor: colors.bgCard, ...shadows.card },
  splitBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.onSurfaceVariant,
  },
  splitBtnTextActive: { color: colors.primary, fontWeight: fontWeights.bold },

  // Participants
  participantList: { gap: 8 },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurfaceContainerLow,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  participantRowActive: {
    backgroundColor: colors.secondary + '0f',
    borderColor: colors.secondary + '30',
  },
  participantLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.bgSurfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  friendAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.secondary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.secondary + '30',
  },
  friendAvatarActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  friendAvatarText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: fontWeights.bold,
  },
  friendAvatarTextActive: {
    color: '#ffffff',
  },
  participantName: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  // Share amount pill shown on each participant
  sharePill: {
    backgroundColor: colors.secondary + '1a',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.secondary + '40',
  },
  sharePillText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.bold,
    color: colors.secondary,
  },
  sharePillMuted: {
    backgroundColor: colors.bgSurfaceContainerHigh,
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sharePillMutedText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    color: colors.onSurfaceVariant + '80',
    fontStyle: 'italic',
  },
  equalShare: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.secondary,
  },
  emptyParticipants: {
    fontSize: fontSizes.sm,
    color: colors.onSurfaceVariant + '99',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },

  // Custom shares
  sharesSection: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '30',
    paddingTop: spacing.md,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurfaceContainerLow,
    marginBottom: 6,
  },
  shareName: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.primary },
  shareRupeeHint: {
    fontSize: 10,
    fontWeight: fontWeights.medium,
    color: colors.secondary,
    marginTop: 1,
  },
  shareInput: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shareSymbol: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colors.onSurfaceVariant },
  shareField: {
    width: 70,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '50',
    textAlign: 'center',
    fontSize: fontSizes.sm,
    color: colors.onSurface,
    paddingHorizontal: 8,
  },

  // Save bar
  saveBar: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '20',
    backgroundColor: colors.bg,
  },
  saveBtn: {
    height: 54,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadows.float,
  },
  btnDisabled: { opacity: 0.65 },
  saveBtnText: {
    color: colors.onPrimary,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xl,
    gap: spacing.sm,
    maxHeight: '70%',
  },
  catModal: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  catModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  groupOption: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
  },
  groupOptionActive: { backgroundColor: colors.primaryContainer + '80' },
  groupOptionText: {
    fontSize: fontSizes.md,
    color: colors.onSurface,
    fontWeight: fontWeights.medium,
  },
  previewIcon: {
    fontSize: fontSizes.sm,
    color: colors.onSurfaceVariant,
    marginTop: 4,
    marginLeft: 2,
  },
  // iOS Datepicker Modal
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.40)',
    justifyContent: 'flex-end',
  },
  iosDateCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 36,
    paddingHorizontal: 16,
  },
  iosDateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: colors.outlineVariant + '22',
  },
  iosDateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  iosDateDone: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.secondary,
  },
});
