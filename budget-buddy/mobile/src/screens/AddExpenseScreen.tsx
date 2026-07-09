import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { expensesAPI, friendsAPI, groupsAPI, usersAPI } from '../api/services';
import { useAuthStore } from '../store/auth';
import Button from '../components/Button';
import Input from '../components/Input';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from 'react-native-toast-message';
import { colors, fontSizes, fontWeights, spacing, radius } from '../theme';
import type { Category, PaymentMethod, SplitType } from '../types';
import { matchCategoryIcon } from '../utils/categoryHelpers';

const SPLIT_TYPES: { key: SplitType; label: string }[] = [{ key: 'equal', label: 'Equal' }, { key: 'percentage', label: 'Percentage' }, { key: 'custom', label: 'Custom' }];
const PAYMENT_METHODS: PaymentMethod[] = ['GPay', 'Cash'];

export default function AddExpenseScreen() {
  const insets = useSafeAreaInsets();
  const store = useAuthStore();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Food');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('GPay');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(true);

  // Custom categories state
  const [customCategories, setCustomCategories] = useState<{ name: string; icon: string }[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [showAddCatModal, setShowAddCatModal] = useState(false);

  const defaultCategories = [
    { name: 'Food', icon: '🍔' },
    { name: 'Travel', icon: '✈️' },
    { name: 'Shopping', icon: '🛍️' },
    { name: 'Rent', icon: '🏠' },
    { name: 'Entertainment', icon: '🎬' },
    { name: 'Others', icon: '📦' }
  ];

  const allCategories = [...defaultCategories, ...customCategories];

  useEffect(() => {
    Promise.all([friendsAPI.list(), groupsAPI.list(), usersAPI.getCustomCategories()]).then(([f, g, c]) => {
      setFriends(f.data.friends);
      setGroups(g.data.groups);
      setCustomCategories(c.data);
      setInitLoading(false);
    });
  }, []);

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
      Toast.show({ type: 'success', text1: 'Category created!', text2: `${name} ${icon}` });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create category');
    }
  };

  const toggleFriend = (id: string) => {
    setSelectedFriends(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const handleSubmit = async () => {
    if (!title || !amount) { Alert.alert('Error', 'Title and amount are required'); return; }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
    setLoading(true);
    try {
      const participants = ['you', ...selectedFriends];
      await expensesAPI.create({
        title, description, amount: numAmount, payment_method: paymentMethod,
        category, split_type: splitType, expense_date: expenseDate,
        participants, ...(selectedGroup ? { group_id: selectedGroup } : {})
      });
      Toast.show({ type: 'success', text1: 'Expense added!', text2: `₹${numAmount} for "${title}"` });
      setTitle(''); setAmount(''); setDescription(''); setSelectedFriends([]); setSelectedGroup('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to add expense');
    } finally {
      setLoading(false);
    }
  };

  if (initLoading) return <LoadingSpinner />;

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add Expense</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Dinner, Uber" icon="create-outline" autoCapitalize="words" />
        <Input label="Amount (₹)" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" icon="cash-outline" />
        <Input label="Date" value={expenseDate} onChangeText={setExpenseDate} placeholder="YYYY-MM-DD" icon="calendar-outline" />
        <Input label="Description (optional)" value={description} onChangeText={setDescription} placeholder="Notes..." multiline numberOfLines={2} icon="document-text-outline" />

        {/* Category */}
        <Text style={styles.sectionLabel}>Category</Text>
        <View style={styles.chipRow}>
          {allCategories.map(cat => (
            <TouchableOpacity key={cat.name} style={[styles.chip, category === cat.name && styles.chipActive]} onPress={() => setCategory(cat.name)}>
              <Text style={styles.chipIcon}>{cat.icon}</Text>
              <Text style={[styles.chipLabel, category === cat.name && styles.chipLabelActive]}>{cat.name}</Text>
            </TouchableOpacity>
          ))}
          {/* Add Category Chip */}
          <TouchableOpacity style={[styles.chip, { borderStyle: 'dashed', borderColor: colors.primary }]} onPress={() => setShowAddCatModal(true)}>
            <Ionicons name="add" size={14} color={colors.primary} />
            <Text style={[styles.chipLabel, { color: colors.primary, fontWeight: 'bold' }]}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Payment Method */}
        <Text style={styles.sectionLabel}>Payment Method</Text>
        <View style={styles.chipRow}>
          {PAYMENT_METHODS.map(pm => (
            <TouchableOpacity key={pm} style={[styles.chip, paymentMethod === pm && styles.chipActive]} onPress={() => setPaymentMethod(pm)}>
              <Text style={[styles.chipLabel, paymentMethod === pm && styles.chipLabelActive]}>{pm === 'GPay' ? '📱 GPay' : '💵 Cash'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Split Type */}
        <Text style={styles.sectionLabel}>Split Type</Text>
        <View style={styles.chipRow}>
          {SPLIT_TYPES.map(st => (
            <TouchableOpacity key={st.key} style={[styles.chip, splitType === st.key && styles.chipActive]} onPress={() => setSplitType(st.key)}>
              <Text style={[styles.chipLabel, splitType === st.key && styles.chipLabelActive]}>{st.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Group (optional) */}
        {groups.length > 0 && <>
          <Text style={styles.sectionLabel}>Group (optional)</Text>
          <View style={styles.chipRow}>
            <TouchableOpacity style={[styles.chip, !selectedGroup && styles.chipActive]} onPress={() => setSelectedGroup('')}>
              <Text style={[styles.chipLabel, !selectedGroup && styles.chipLabelActive]}>Personal</Text>
            </TouchableOpacity>
            {groups.map((g: any) => (
              <TouchableOpacity key={g.id} style={[styles.chip, selectedGroup === g.id && styles.chipActive]} onPress={() => setSelectedGroup(g.id)}>
                <Text style={[styles.chipLabel, selectedGroup === g.id && styles.chipLabelActive]}>{g.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>}

        {/* Participants */}
        {friends.length > 0 && <>
          <Text style={styles.sectionLabel}>Split With</Text>
          {friends.map((f: any) => (
            <TouchableOpacity key={f.friendship_id} style={styles.friendRow} onPress={() => toggleFriend(f.friend.id)}>
              <View style={[styles.checkbox, selectedFriends.includes(f.friend.id) && styles.checkboxChecked]}>
                {selectedFriends.includes(f.friend.id) && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.friendName}>{f.friend.name}</Text>
            </TouchableOpacity>
          ))}
        </>}

        <Button title="Add Expense" onPress={handleSubmit} loading={loading} fullWidth style={styles.submitBtn} />
      </ScrollView>

      {/* New Category Modal */}
      <Modal visible={showAddCatModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Category</Text>
              <TouchableOpacity onPress={() => { setShowAddCatModal(false); setNewCatName(''); }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <Input 
              label="Category Name" 
              value={newCatName} 
              onChangeText={setNewCatName} 
              placeholder="e.g. Gym, Electricity, Cafe" 
              icon="bookmark-outline" 
            />

            {newCatName.trim().length > 0 && (
              <View style={styles.matchPreview}>
                <Text style={styles.matchText}>Matched Icon: </Text>
                <Text style={styles.matchEmoji}>{matchCategoryIcon(newCatName)}</Text>
              </View>
            )}

            <Button title="Create Category" onPress={handleAddCategory} style={styles.createBtn} />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  scroll: { padding: spacing.md, paddingBottom: 100 },
  sectionLabel: { color: colors.textSecondary, fontSize: fontSizes.sm, fontWeight: '500', marginBottom: spacing.sm, marginTop: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.border, gap: 4 },
  chipActive: { backgroundColor: colors.primary + '22', borderColor: colors.primary },
  chipIcon: { fontSize: 14 },
  chipLabel: { color: colors.textSecondary, fontSize: fontSizes.sm, fontWeight: '500' },
  chipLabelActive: { color: colors.primary, fontWeight: '600' },
  friendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  friendName: { color: colors.textPrimary, fontSize: fontSizes.md },
  submitBtn: { marginTop: spacing.lg },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bgCard, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  matchPreview: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.sm, padding: spacing.sm, backgroundColor: colors.bgInput, borderRadius: radius.md },
  matchText: { color: colors.textSecondary, fontSize: fontSizes.sm },
  matchEmoji: { fontSize: fontSizes.lg, fontWeight: 'bold' },
  createBtn: { marginTop: spacing.md },
});
