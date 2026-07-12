import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { groupsAPI, friendsAPI, expensesAPI, usersAPI } from '../api/services';
import type { Group, FriendWithRequest, SplitType, Category } from '../types';
import { useAuthStore } from '../store/auth';
import { matchCategoryIcon } from '../utils/categoryHelpers';
import toast from 'react-hot-toast';

export default function AddExpensePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const formRef = useRef<HTMLFormElement>(null);

  // Custom categories state
  const [customCategories, setCustomCategories] = useState<{ name: string; icon: string }[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [showAddCatModal, setShowAddCatModal] = useState(false);

  const defaultCategories = [
    { name: 'Food', icon: '🍔' },
    { name: 'Travel', icon: '🚌' },
    { name: 'Shopping', icon: '🛍️' },
    { name: 'Rent', icon: '🏠' },
    { name: 'Entertainment', icon: '🎬' },
    { name: 'Others', icon: '📦' }
  ];

  const allCategories = [...defaultCategories, ...customCategories];

  // Form inputs
  const [amount, setAmount] = useState<number>(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<Category>('Food');
  const [groupId, setGroupId] = useState<string>('');

  // Lists for dropdowns/options
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<FriendWithRequest[]>([]);

  // Selection of participants (friends only)
  const [eligibleParticipants, setEligibleParticipants] = useState<{ id: string; name: string }[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  // Split details state
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [customShares, setCustomShares] = useState<Record<string, number>>({});

  useEffect(() => {
    async function loadInitialData() {
      try {
        const groupsRes = await groupsAPI.list();
        setGroups(groupsRes.data.groups);
        const friendsRes = await friendsAPI.list();
        setFriends(friendsRes.data.friends || []);

        const catRes = await usersAPI.getCustomCategories();
        setCustomCategories(catRes.data);
      } catch (err) {
        console.error(err);
      }
    }
    loadInitialData();
  }, []);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const name = newCatName.trim();
    const icon = matchCategoryIcon(name);
    try {
      await usersAPI.addCustomCategory(name, icon);
      setCustomCategories([...customCategories, { name, icon }]);
      setCategory(name);
      setNewCatName('');
      setShowAddCatModal(false);
      toast.success(`Category "${name}" ${icon} created!`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create category');
    }
  };

  // Update participants list when Group changes
  useEffect(() => {
    if (groupId) {
      const selectedGrp = groups.find(g => g.id === groupId);
      if (selectedGrp) {
        const membersList = selectedGrp.members
          .filter(m => m.user.id !== user?.id)
          .map(m => ({ id: m.user.id, name: m.user.name }));
        setEligibleParticipants(membersList);
        setSelectedFriends(membersList.map(m => m.id));
        const initialShares: Record<string, number> = { you: 0 };
        membersList.forEach(m => { initialShares[m.id] = 0; });
        setCustomShares(initialShares);
      }
    } else {
      const list = friends.map(f => ({ id: f.friend.id, name: f.friend.name }));
      setEligibleParticipants(list);
      setSelectedFriends([]);
      const initialShares: Record<string, number> = { you: 0 };
      list.forEach(m => { initialShares[m.id] = 0; });
      setCustomShares(initialShares);
    }
  }, [groupId, groups, friends, user]);

  const toggleParticipant = (id: string) => {
    setSelectedFriends(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleShareChange = (id: string, value: number) => {
    setCustomShares(prev => ({ ...prev, [id]: value }));
  };

  const selectedParticipants = ['you', ...selectedFriends];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) { toast.error('Amount must be greater than 0'); return; }
    if (!title.trim()) { toast.error('Title is required'); return; }

    let split_details: { user_id: string; value: number }[] = [];
    if (selectedFriends.length > 0) {
      if (splitType === 'percentage') {
        let totalPct = 0;
        selectedParticipants.forEach(pId => {
          const val = customShares[pId] || 0;
          totalPct += val;
          split_details.push({ user_id: pId, value: val });
        });
        if (totalPct !== 100) { toast.error(`Total percentage must equal 100% (currently ${totalPct}%)`); return; }
      } else if (splitType === 'custom') {
        let totalAmt = 0;
        selectedParticipants.forEach(pId => {
          const val = customShares[pId] || 0;
          totalAmt += val;
          split_details.push({ user_id: pId, value: val });
        });
        if (totalAmt !== amount) { toast.error(`Total custom split amounts must equal ${amount} (currently ${totalAmt})`); return; }
      } else {
        selectedParticipants.forEach(pId => split_details.push({ user_id: pId, value: 0 }));
      }
    } else {
      split_details = [{ user_id: 'you', value: 0 }];
    }

    try {
      const payload = {
        title,
        description,
        amount,
        payment_method: 'GPay',
        category,
        split_type: selectedFriends.length > 0 ? splitType : 'equal',
        group_id: groupId || undefined,
        expense_date: new Date(expenseDate).toISOString(),
        participants: selectedFriends.length > 0 ? selectedParticipants : ['you'],
        split_details: selectedFriends.length > 0 && splitType !== 'equal' ? split_details : undefined
      };
      await expensesAPI.create(payload as any);
      toast.success('Expense created successfully!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create expense');
    }
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const avatarColors = [
    'bg-blue-100 text-blue-700',
    'bg-emerald-100 text-emerald-700',
    'bg-violet-100 text-violet-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
  ];

  return (
    <Layout title="Add Expense">
      {/* Extra padding-bottom to clear fixed save button + bottom nav */}
      <div className="page-container page-enter" style={{ paddingBottom: 'calc(9rem + env(safe-area-inset-bottom, 0px))' }}>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">

          {/* ── Amount input ─────────────────────────────────────────────── */}
          <div className="flex flex-col items-center justify-center py-6 bg-white rounded-2xl border border-outline-variant/30 shadow-sm">
            <span className="text-label-caps font-label-caps text-on-surface-variant uppercase mb-2 tracking-wider">
              Total Amount
            </span>
            <div className="flex items-center gap-1">
              <span className="font-display-currency text-display-currency text-on-surface-variant/60">₹</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                required
                placeholder="0.00"
                value={amount || ''}
                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                className="w-48 text-center font-display-currency text-display-currency bg-transparent border-none focus:ring-0 placeholder:text-on-surface-variant/25 text-on-background outline-none"
              />
            </div>
          </div>

          {/* ── Title + Description ───────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-4 space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-label-caps text-on-surface-variant uppercase ml-1 tracking-wider">Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Dinner at Olive"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="input-field h-12 text-sm bg-surface-container-low"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-label-caps text-on-surface-variant uppercase ml-1 tracking-wider">Description</label>
              <input
                type="text"
                placeholder="Optional description…"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="input-field h-12 text-sm bg-surface-container-low"
              />
            </div>

            {/* Date + Group — stacked on xs, side-by-side on sm+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-label-caps text-on-surface-variant uppercase ml-1 tracking-wider">Date</label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={e => setExpenseDate(e.target.value)}
                  className="input-field h-12 text-sm bg-surface-container-low"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-label-caps text-on-surface-variant uppercase ml-1 tracking-wider">Group</label>
                <select
                  value={groupId}
                  onChange={e => setGroupId(e.target.value)}
                  className="input-field h-12 text-sm bg-surface-container-low px-3 py-0 border-transparent focus:ring-0"
                >
                  <option value="">No Group (Direct)</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Category horizontal scroll ────────────────────────────────── */}
          <div className="space-y-2">
            <label className="block text-label-caps text-on-surface-variant uppercase ml-1 tracking-wider">Category</label>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 px-1 items-start">
              {allCategories.map(cat => {
                const isSelected = category === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setCategory(cat.name)}
                    className={`flex flex-col items-center gap-2 flex-shrink-0 transition-all duration-200 ${
                      isSelected ? 'scale-105 opacity-100' : 'opacity-60 hover:opacity-90'
                    }`}
                    style={{ minWidth: 64 }}
                  >
                    {/* Perfect 1:1 aspect ratio circle */}
                    <div
                      className={`icon-circle transition-all ${
                        isSelected ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-high'
                      }`}
                      style={{ width: 48, height: 48, fontSize: 22 }}
                    >
                      {cat.icon}
                    </div>
                    <span
                      className={`text-center uppercase tracking-wider leading-tight ${
                        isSelected ? 'text-primary font-bold' : 'text-on-surface-variant'
                      }`}
                      style={{ fontSize: 10, maxWidth: 60, wordBreak: 'break-word' }}
                    >
                      {cat.name}
                    </span>
                  </button>
                );
              })}

              {/* Add custom category */}
              <button
                type="button"
                onClick={() => setShowAddCatModal(true)}
                className="flex flex-col items-center gap-2 flex-shrink-0 opacity-60 hover:opacity-100 transition-all duration-200"
                style={{ minWidth: 64 }}
              >
                <div
                  className="flex-shrink-0 rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center bg-primary/5 hover:bg-primary/10 transition-colors"
                  style={{ width: 48, height: 48, overflow: 'hidden' }}
                >
                  <span className="material-symbols-outlined text-primary" style={{ fontSize: 22 }}>add</span>
                </div>
                <span className="uppercase tracking-wider text-primary font-bold" style={{ fontSize: 10 }}>Add</span>
              </button>
            </div>
          </div>

          {/* ── Split Section ─────────────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-4 space-y-4">

            {/* Split method tabs — shown only when friends selected */}
            {selectedFriends.length > 0 && (
              <div>
                <label className="block text-label-caps text-on-surface-variant uppercase mb-2 ml-1 tracking-wider">
                  Split Method
                </label>
                <div className="flex p-1 bg-surface-container-low rounded-xl gap-1">
                  {([['equal', 'Equal'], ['percentage', '%'], ['custom', '₹ Custom']] as [SplitType, string][]).map(
                    ([type, label]) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSplitType(type)}
                        className={`flex-1 py-2.5 text-center rounded-lg font-semibold text-xs transition-all ${splitType === type
                            ? 'bg-white text-primary shadow-sm'
                            : 'text-on-surface-variant hover:text-primary'
                          }`}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Participants */}
            <div className="space-y-2">
              <div>
                <label className="text-label-caps text-on-surface-variant uppercase ml-1 tracking-wider">Split With</label>
                <p className="text-[10px] text-on-surface-variant/60 ml-1 mt-0.5">
                  Select friends to split, or leave empty for a personal expense.
                </p>
              </div>

              {eligibleParticipants.length === 0 ? (
                <p className="text-sm text-on-surface-variant/50 italic text-center py-3">
                  No friends yet. Add friends to split expenses.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {eligibleParticipants.map((participant, idx) => {
                    const isChecked = selectedFriends.includes(participant.id);
                    const colorClass = avatarColors[idx % avatarColors.length];
                    return (
                      <button
                        key={participant.id}
                        type="button"
                        onClick={() => toggleParticipant(participant.id)}
                        className={`flex items-center justify-between w-full px-3 py-3 rounded-xl transition-all text-left ${isChecked
                            ? 'bg-primary/5 border border-primary/20'
                            : 'bg-surface-container-low hover:bg-surface-container border border-transparent'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${colorClass}`}>
                            {getInitials(participant.name)}
                          </div>
                          <span className="text-sm font-semibold text-primary">{participant.name}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isChecked && splitType === 'equal' && (
                            <span className="text-xs text-on-surface-variant font-semibold">
                              ₹{(amount / selectedParticipants.length || 0).toFixed(2)}
                            </span>
                          )}
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${isChecked
                              ? 'bg-primary text-on-primary'
                              : 'bg-surface-container-highest border border-outline-variant'
                            }`}>
                            {isChecked && <span className="material-symbols-outlined text-[14px]">check</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Custom/Percentage share inputs */}
            {selectedFriends.length > 0 && splitType !== 'equal' && (
              <div className="space-y-3 border-t border-outline-variant/30 pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-label-caps text-on-surface-variant uppercase ml-1 tracking-wider">Configure Shares</label>
                  <span className="text-xs text-on-surface-variant/60">
                    {splitType === 'percentage'
                      ? `Total: ${Object.values(customShares).reduce((a, b) => a + b, 0)}%`
                      : `Total: ₹${Object.values(customShares).reduce((a, b) => a + b, 0).toFixed(2)}`
                    }
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {selectedParticipants.map((pId, idx) => {
                    const pName = pId === 'you' ? 'You (Me)' : (eligibleParticipants.find(p => p.id === pId)?.name || 'Friend');
                    const colorClass = pId === 'you' ? 'bg-primary/10 text-primary' : avatarColors[(idx - 1) % avatarColors.length];
                    return (
                      <div key={pId} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${colorClass}`}>
                            {getInitials(pName)}
                          </div>
                          <span className="text-sm font-semibold text-primary truncate">{pName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {splitType === 'percentage' ? (
                            <>
                              <input
                                type="number"
                                inputMode="decimal"
                                placeholder="0"
                                value={customShares[pId] || ''}
                                onChange={e => handleShareChange(pId, parseFloat(e.target.value) || 0)}
                                className="w-16 h-10 text-center text-sm bg-white rounded-lg border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                              />
                              <span className="text-sm text-on-surface-variant font-bold w-4">%</span>
                            </>
                          ) : (
                            <>
                              <span className="text-sm text-on-surface-variant font-bold">₹</span>
                              <input
                                type="number"
                                inputMode="decimal"
                                placeholder="0"
                                value={customShares[pId] || ''}
                                onChange={e => handleShareChange(pId, parseFloat(e.target.value) || 0)}
                                className="w-20 h-10 text-center text-sm bg-white rounded-lg border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                              />
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </form>
      </div>

      {/* ── Fixed Save Button ──────────────────────────────────────────────── */}
      <div
        className="fixed left-0 right-0 px-4"
        style={{
          /* Float above the pill nav: pill is ~68px + 10px gap + safe-area */
          bottom: 'calc(5rem + env(safe-area-inset-bottom, 16px))',
          zIndex: 45,
          background: 'linear-gradient(to top, #f8f9fa 65%, transparent)',
          paddingTop: '16px',
          paddingBottom: '10px',
        }}
      >
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => formRef.current?.requestSubmit()}
            className="w-full h-14 bg-primary text-on-primary rounded-2xl font-semibold text-base flex items-center justify-center gap-2 shadow-float active:scale-[0.98] transition-transform"
          >
            <span className="material-symbols-outlined">save</span>
            <span>Save Expense</span>
          </button>
        </div>
      </div>

      {/* ── New Category Modal ─────────────────────────────────────────────── */}
      {showAddCatModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl p-6 w-full sm:max-w-sm flex flex-col gap-4 shadow-xl border border-outline-variant/30">
            <div className="flex justify-between items-center">
              {/* Drag handle for mobile bottom sheet */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-outline-variant/40 sm:hidden" />
              <h3 className="font-bold text-headline-lg-mobile text-primary">New Category</h3>
              <button
                onClick={() => setShowAddCatModal(false)}
                className="text-on-surface-variant hover:text-primary transition-colors p-1 rounded-full hover:bg-surface-variant/30"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleAddCategory} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-label-caps text-on-surface-variant uppercase tracking-wider">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gym, Electricity, Cafe"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="input-field h-12 text-sm"
                  autoFocus
                />
                {newCatName.trim() && (
                  <p className="text-xs text-on-surface-variant/70 flex items-center gap-1.5">
                    Matched Icon: <span className="text-lg bg-surface-container px-2 py-0.5 rounded">{matchCategoryIcon(newCatName)}</span>
                  </p>
                )}
              </div>
              <button type="submit" className="btn-primary w-full h-12 text-sm shadow-none mt-1">
                Create Category
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
