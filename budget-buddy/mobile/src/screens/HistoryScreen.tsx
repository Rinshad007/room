/**
 * HistoryScreen — exact port of web's HistoryPage.tsx
 *
 * Features:
 *  - Merges expenses + settlements into one list sorted by date
 *  - Swipe-to-delete own expenses (via long-press + confirm)
 *  - Edit modal (title, description, amount, date, category)
 *  - Delete confirmation modal
 *  - Skeleton loading state
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, Pressable, TextInput, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import TopBar from '../components/TopBar';
import Skeleton from '../components/Skeleton';
import { useAuthStore } from '../store/auth';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import { expensesAPI } from '../api/services';
import { matchCategoryIcon } from '../utils/categoryHelpers';
import type { Expense, Settlement, Category } from '../types';
import { colors, fontSizes, fontWeights, radius, spacing, shadows } from '../theme';

const CATEGORIES: Category[] = ['Food', 'Travel', 'Shopping', 'Rent', 'Entertainment', 'Others'];

interface EditState {
  id: string;
  title: string;
  description: string;
  category: Category;
  amount: number;
  expense_date: string;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { ready, myExpenses, mySettlements, resolveName } = useRealtimeStore(user?.id);

  // Only include expenses (no settlements) sorted newest-first
  const historyItems = useMemo(() => {
    type HItem = { type: 'expense'; date: Date; data: Expense };

    const items: HItem[] = myExpenses.map(exp => ({
      type: 'expense' as const,
      date: new Date(exp.expense_date),
      data: exp
    }));
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [myExpenses]);

  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'all' | 'paid' | 'owe'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Filtered list
  const filteredHistoryItems = useMemo(() => {
    return historyItems.filter(item => {
      const exp = item.data;

      // 1. Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = exp.title.toLowerCase().includes(query);
        const matchesDesc = exp.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // 2. Role filter (You paid / You owe)
      const isPayer = exp.paid_by === 'you' || exp.paid_by === user?.id;
      if (selectedRole === 'paid' && !isPayer) return false;
      if (selectedRole === 'owe' && isPayer) return false;

      // 3. Category filter
      if (selectedCategory !== 'all' && exp.category !== selectedCategory) return false;

      return true;
    });
  }, [historyItems, searchQuery, selectedRole, selectedCategory, user?.id]);

  const openEdit = (exp: Expense) => {
    setEditState({
      id: exp.id,
      title: exp.title,
      description: exp.description || '',
      category: exp.category,
      amount: exp.amount,
      expense_date: exp.expense_date.split('T')[0],
    });
  };

  const handleSaveEdit = async () => {
    if (!editState) return;
    setSaving(true);
    try {
      await expensesAPI.update(editState.id, {
        title: editState.title,
        description: editState.description,
        category: editState.category,
        amount: editState.amount,
        expense_date: new Date(editState.expense_date).toISOString(),
      });
      setEditState(null);
    } catch {
      Alert.alert('Error', 'Failed to update expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await expensesAPI.delete(deleteTarget);
      setDeleteTarget(null);
    } catch {
      Alert.alert('Error', 'Failed to delete expense');
    } finally {
      setDeleting(false);
    }
  };

  if (!ready) {
    return (
      <View style={styles.root}>
        <TopBar title="History" showBack />
        <ScrollView contentContainerStyle={styles.scroll}>
          {[...Array(5)].map((_, i) => <Skeleton key={i} height={76} borderRadius={radius.xl} />)}
        </ScrollView>
      </View>
    );
  }

  const renderRightActions = (id: string) => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => setDeleteTarget(id)}
      activeOpacity={0.85}
    >
      <Ionicons name="trash-outline" size={22} color="#fff" />
      <Text style={styles.deleteActionText}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.root}>
      <TopBar title="History" showBack />
      
      {/* ── Search & Filters Section ─────────────────────────────────── */}
      <View style={styles.filterSection}>
        {/* Search Input */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={16} color={colors.onSurfaceVariant + '70'} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search transactions..."
            placeholderTextColor={colors.onSurfaceVariant + '80'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
              <Ionicons name="close-circle" size={16} color={colors.onSurfaceVariant + '90'} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Role Segment Selector */}
        <View style={styles.roleToggle}>
          {([
            { id: 'all', label: 'All' },
            { id: 'paid', label: 'Paid' },
            { id: 'owe', label: 'Owe' },
          ] as const).map(role => (
            <TouchableOpacity
              key={role.id}
              style={[styles.roleBtn, selectedRole === role.id && styles.roleBtnActive]}
              onPress={() => setSelectedRole(role.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.roleBtnText, selectedRole === role.id && styles.roleBtnTextActive]}>
                {role.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category Pills List */}
        <View style={styles.catFilterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catFilterScroll}
          >
            <TouchableOpacity
              style={[styles.catFilterBtn, selectedCategory === 'all' && styles.catFilterBtnActive]}
              onPress={() => setSelectedCategory('all')}
              activeOpacity={0.75}
            >
              <Text style={[styles.catFilterText, selectedCategory === 'all' && styles.catFilterTextActive]}>
                All Categories
              </Text>
            </TouchableOpacity>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat}
                style={[styles.catFilterBtn, selectedCategory === cat && styles.catFilterBtnActive]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.75}
              >
                <Text style={[styles.catFilterText, selectedCategory === cat && styles.catFilterTextActive]}>
                  {matchCategoryIcon(cat)} {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>History</Text>

        {historyItems.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No transactions recorded yet.</Text>
          </View>
        ) : filteredHistoryItems.length === 0 ? (
          <View style={styles.emptyFilter}>
            <Ionicons name="search-outline" size={44} color={colors.onSurfaceVariant + '40'} />
            <Text style={styles.emptyFilterTitle}>No Match Found</Text>
            <Text style={styles.emptyFilterText}>Try adjusting your search query or role filters.</Text>
            <TouchableOpacity 
              style={styles.resetFilterBtn} 
              onPress={() => { setSearchQuery(''); setSelectedRole('all'); setSelectedCategory('all'); }}
            >
              <Text style={styles.resetFilterText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredHistoryItems.map(item => {
              const exp = item.data;
              const isPayer = exp.paid_by === 'you' || exp.paid_by === user?.id;
              const mySplit = (exp.splits || []).find((s: any) => s.user_id === user?.id);
              const displayAmt = mySplit ? mySplit.share_amount : exp.amount;
              const isFullExpense = !mySplit || mySplit.share_amount === exp.amount;
              const canEditDelete = isPayer;

              return (
                <ReanimatedSwipeable
                  key={exp.id}
                  enabled={canEditDelete}
                  renderRightActions={() => renderRightActions(exp.id)}
                  overshootRight={false}
                >
                  <View style={styles.expenseRow}>
                    <View style={styles.expenseIcon}>
                      <Text style={{ fontSize: 18 }}>{matchCategoryIcon(exp.category)}</Text>
                    </View>
                    <View style={styles.expenseInfo}>
                      <Text style={styles.expenseTitle} numberOfLines={1}>{exp.title}</Text>
                      <Text style={styles.expenseMeta}>
                        {new Date(exp.expense_date).toLocaleDateString('en-IN', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })} · {exp.category}
                      </Text>
                    </View>
                    <View style={styles.expenseRight}>
                      <Text style={styles.expenseAmount}>₹{displayAmt.toLocaleString('en-IN')}</Text>
                      {!isFullExpense && (
                        <Text style={styles.expenseTotal}>of ₹{exp.amount.toLocaleString('en-IN')}</Text>
                      )}
                      <Text style={[styles.expensePaid, { color: isPayer ? colors.secondary : colors.error }]}>
                        {isPayer ? 'You paid' : 'You owe'}
                      </Text>
                    </View>
                    {canEditDelete && (
                      <TouchableOpacity onPress={() => openEdit(exp)} style={styles.editBtn}>
                        <Ionicons name="pencil-outline" size={16} color={colors.onSurfaceVariant + '88'} />
                      </TouchableOpacity>
                    )}
                  </View>
                </ReanimatedSwipeable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ── Edit Modal ─────────────────────────────────────────────────── */}
      <Modal visible={!!editState} transparent animationType="slide" onRequestClose={() => setEditState(null)}>
        <Pressable style={styles.overlay} onPress={() => setEditState(null)}>
          <View style={styles.editModal}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Edit Expense</Text>
              <TouchableOpacity onPress={() => setEditState(null)}>
                <Ionicons name="close" size={22} color={colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <View style={styles.editField}>
              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.editInput}
                value={editState?.title}
                onChangeText={v => setEditState(s => s && { ...s, title: v })}
              />
            </View>

            <View style={styles.editField}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={styles.editInput}
                value={editState?.description}
                onChangeText={v => setEditState(s => s && { ...s, description: v })}
                placeholder="Optional"
                placeholderTextColor={colors.onSurfaceVariant + '80'}
              />
            </View>

            <View style={styles.twoCol}>
              <View style={[styles.editField, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Amount (₹)</Text>
                <TextInput
                  style={styles.editInput}
                  value={String(editState?.amount || '')}
                  onChangeText={v => setEditState(s => s && { ...s, amount: parseFloat(v) || 0 })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.editField, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Date</Text>
                <TextInput
                  style={styles.editInput}
                  value={editState?.expense_date}
                  onChangeText={v => setEditState(s => s && { ...s, expense_date: v })}
                />
              </View>
            </View>

            <View style={styles.editField}>
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.catChips}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.catChip, editState?.category === cat && styles.catChipActive]}
                    onPress={() => setEditState(s => s && { ...s, category: cat })}
                  >
                    <Text style={[styles.catChipText, editState?.category === cat && styles.catChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.65 }]}
              onPress={handleSaveEdit}
              disabled={saving}
            >
              <Ionicons name="save-outline" size={18} color={colors.onPrimary} />
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Delete Confirm Modal ──────────────────────────────────────── */}
      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <Pressable style={styles.overlay} onPress={() => setDeleteTarget(null)}>
          <View style={styles.deleteModal}>
            <View style={styles.deleteIconWrap}>
              <Ionicons name="trash-outline" size={32} color={colors.error} />
            </View>
            <Text style={styles.deleteTitle}>Delete Expense?</Text>
            <Text style={styles.deleteSubtitle}>This action cannot be undone.</Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteConfirmBtn, deleting && { opacity: 0.65 }]}
                onPress={handleDelete}
                disabled={deleting}
              >
                <Text style={styles.deleteConfirmText}>{deleting ? 'Deleting…' : 'Delete'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.pagePadding, paddingTop: spacing.md, gap: spacing.sm },
  pageTitle: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: colors.primary,
    paddingHorizontal: 4,
  },

  list: { gap: 10 },
  empty: {
    backgroundColor: Platform.OS === 'android' ? '#ffffff' : 'rgba(255,255,255,0.78)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(198,198,202,0.4)',
    padding: 32,
    alignItems: 'center',
  },
  emptyText: { color: colors.onSurfaceVariant + '99', fontSize: fontSizes.sm, fontStyle: 'italic' },

  // Expense row
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '20',
    ...shadows.card,
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgSurfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  expenseInfo: { flex: 1, minWidth: 0 },
  expenseTitle: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  expenseMeta: { fontSize: fontSizes.xs, color: colors.onSurfaceVariant + '99', marginTop: 2 },
  expenseRight: { alignItems: 'flex-end', flexShrink: 0 },
  expenseAmount: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.primary },
  expenseTotal: { fontSize: 10, color: colors.onSurfaceVariant + '99' },
  expensePaid: { fontSize: fontSizes.xs, fontWeight: fontWeights.medium },
  editBtn: {
    padding: 6,
    borderRadius: 8,
  },

  // Swipe delete
  deleteAction: {
    width: 72,
    backgroundColor: colors.error,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginLeft: 8,
  },
  deleteActionText: { color: '#fff', fontSize: 10, fontWeight: fontWeights.bold },

  // Settlement row
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '20',
    ...shadows.card,
  },
  settlementIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  settlIconCompleted: { backgroundColor: colors.secondaryContainer },
  settlIconPending: { backgroundColor: '#fef3c7' },
  settlMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' },
  pendingChip: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#d97706' + '60',
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  pendingChipText: { fontSize: 10, color: '#92400e', fontWeight: fontWeights.bold },
  settlAmount: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, marginLeft: 'auto' },

  // Edit modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  editModal: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editTitle: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.primary },
  editField: { gap: 5 },
  fieldLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  editInput: {
    height: 44,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '40',
    backgroundColor: colors.bgSurfaceContainerLow,
    paddingHorizontal: 12,
    fontSize: fontSizes.sm,
    color: colors.onSurface,
  },
  twoCol: { flexDirection: 'row', gap: 12 },
  catChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: colors.bgSurfaceContainer,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '40',
  },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.onSurfaceVariant },
  catChipTextActive: { color: colors.onPrimary },
  saveBtn: {
    height: 48,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadows.float,
  },
  saveBtnText: { color: colors.onPrimary, fontSize: fontSizes.md, fontWeight: fontWeights.semibold },

  // Delete modal
  deleteModal: {
    alignSelf: 'center',
    width: '85%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.xxl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  deleteIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteTitle: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.primary },
  deleteSubtitle: { fontSize: fontSizes.sm, color: colors.onSurfaceVariant, textAlign: 'center' },
  deleteActions: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '60',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.onSurfaceVariant },
  deleteConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.xl,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmText: { color: '#fff', fontSize: fontSizes.sm, fontWeight: fontWeights.semibold },

  // Filters styling
  filterSection: {
    paddingHorizontal: spacing.pagePadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    gap: 10,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderColor: colors.outlineVariant + '1A',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSurfaceContainerLow,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '20',
  },
  searchInput: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: colors.onSurface,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 2,
  },
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: colors.bgSurfaceContainerLow,
    borderRadius: radius.lg,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '15',
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  roleBtnActive: {
    backgroundColor: colors.bgCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 1.5,
    elevation: 1,
  },
  roleBtnText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    fontWeight: fontWeights.medium,
  },
  roleBtnTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.bold,
  },
  catFilterContainer: {
    marginTop: 2,
  },
  catFilterScroll: {
    gap: 8,
    paddingRight: 16,
  },
  catFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: colors.bgSurfaceContainerLow,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '15',
  },
  catFilterBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  catFilterText: {
    fontSize: 11,
    color: colors.onSurfaceVariant,
    fontWeight: fontWeights.semibold,
  },
  catFilterTextActive: {
    color: '#ffffff',
  },

  // Empty match state
  emptyFilter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyFilterTitle: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.onSurface,
    marginTop: 4,
  },
  emptyFilterText: {
    fontSize: fontSizes.sm,
    color: colors.onSurfaceVariant + '99',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 6,
  },
  resetFilterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.xl,
    backgroundColor: colors.primary + '12',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  resetFilterText: {
    fontSize: fontSizes.xs,
    color: colors.primary,
    fontWeight: fontWeights.bold,
  },
});
