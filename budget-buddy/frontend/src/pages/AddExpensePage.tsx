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
    { name: 'Travel', icon: '✈️' },
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
        // Exclude current user from eligible list (implicitly 'you')
        const membersList = selectedGrp.members
          .filter(m => m.user.id !== user?.id)
          .map(m => ({
            id: m.user.id,
            name: m.user.name
          }));
        setEligibleParticipants(membersList);
        setSelectedFriends(membersList.map(m => m.id));
        
        // Reset shares mapping
        const initialShares: Record<string, number> = { you: 0 };
        membersList.forEach(m => {
          initialShares[m.id] = 0;
        });
        setCustomShares(initialShares);
      }
    } else {
      // Direct friends splitting
      const list = friends.map(f => ({ id: f.friend.id, name: f.friend.name }));
      setEligibleParticipants(list);
      setSelectedFriends([]); // default to no split
      
      const initialShares: Record<string, number> = { you: 0 };
      list.forEach(m => {
        initialShares[m.id] = 0;
      });
      setCustomShares(initialShares);
    }
  }, [groupId, groups, friends, user]);

  const toggleParticipant = (id: string) => {
    if (selectedFriends.includes(id)) {
      setSelectedFriends(selectedFriends.filter(p => p !== id));
    } else {
      setSelectedFriends([...selectedFriends, id]);
    }
  };

  const handleShareChange = (id: string, value: number) => {
    setCustomShares({
      ...customShares,
      [id]: value
    });
  };

  // Computed participants list
  const selectedParticipants = ['you', ...selectedFriends];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    // Validate splits configuration
    let split_details: { user_id: string; value: number }[] = [];
    if (selectedFriends.length > 0) {
      if (splitType === 'percentage') {
        let totalPct = 0;
        selectedParticipants.forEach(pId => {
          const val = customShares[pId] || 0;
          totalPct += val;
          split_details.push({ user_id: pId, value: val });
        });
        if (totalPct !== 100) {
          toast.error(`Total percentage must equal 100% (currently ${totalPct}%)`);
          return;
        }
      } else if (splitType === 'custom') {
        let totalAmt = 0;
        selectedParticipants.forEach(pId => {
          const val = customShares[pId] || 0;
          totalAmt += val;
          split_details.push({ user_id: pId, value: val });
        });
        if (totalAmt !== amount) {
          toast.error(`Total custom split amounts must equal ${amount} (currently ${totalAmt})`);
          return;
        }
      } else {
        // Equal split type
        selectedParticipants.forEach(pId => {
          split_details.push({ user_id: pId, value: 0 });
        });
      }
    } else {
      // Personal expense: 100% goes to 'you', no splits needed
      split_details = [{ user_id: 'you', value: 0 }];
    }

    try {
      const payload = {
        title,
        description,
        amount,
        payment_method: 'GPay', // Default payment method
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

  return (
    <Layout title="Add Expense">
      <div className="page-container page-enter" style={{ paddingBottom: '9rem' }}>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          
          {/* Amount input */}
          <div className="flex flex-col items-center justify-center py-4 bg-white rounded-2xl border border-outline-variant/35 shadow-sm">
            <span className="text-on-surface-variant font-label-caps text-label-caps uppercase mb-1">Amount</span>
            <div className="flex items-center space-x-2">
              <span className="font-display-currency text-display-currency text-on-surface-variant">₹</span>
              <input
                type="number"
                step="any"
                required
                placeholder="0.00"
                value={amount || ''}
                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full max-w-[200px] text-center font-display-currency text-display-currency bg-transparent border-none focus:ring-0 placeholder:text-on-surface-variant/30 text-on-background outline-none"
              />
            </div>
          </div>

          {/* Form fields */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-label-caps text-on-surface-variant uppercase ml-1">Title</label>
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
              <label className="text-label-caps text-on-surface-variant uppercase ml-1">Description</label>
              <input
                type="text"
                placeholder="Optional description..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="input-field h-12 text-sm bg-surface-container-low"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-label-caps text-on-surface-variant uppercase ml-1">Date</label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={e => setExpenseDate(e.target.value)}
                  className="input-field h-12 text-sm bg-surface-container-low"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-label-caps text-on-surface-variant uppercase ml-1">Group</label>
                <select
                  value={groupId}
                  onChange={e => setGroupId(e.target.value)}
                  className="input-field h-12 text-sm bg-surface-container-low px-2 py-0 border-transparent focus:ring-0"
                >
                  <option value="">No Group (Direct)</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Categories Horizontal Selector */}
          <div className="space-y-2">
            <label className="block text-on-surface-variant font-label-caps text-label-caps uppercase ml-1">Category</label>
            <div className="flex space-x-3 overflow-x-auto hide-scrollbar pb-2 px-1 items-center">
              {allCategories.map(cat => {
                const isSelected = category === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => setCategory(cat.name)}
                    className={`flex flex-col items-center space-y-1.5 min-w-[72px] transition-all duration-200 ${isSelected ? 'scale-105 opacity-100' : 'opacity-65 hover:opacity-100'}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl transition-all ${isSelected ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-high text-on-surface'}`}>
                      {cat.icon}
                    </div>
                    <span className={`text-[10px] font-label-caps uppercase tracking-wider ${isSelected ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>{cat.name}</span>
                  </button>
                );
              })}
              
              {/* Add Custom Category Button */}
              <button
                type="button"
                onClick={() => setShowAddCatModal(true)}
                className="flex flex-col items-center space-y-1.5 min-w-[72px] opacity-65 hover:opacity-100 transition-all duration-200"
              >
                <div className="w-12 h-12 rounded-full border border-dashed border-primary/40 flex items-center justify-center text-primary bg-primary/5 hover:bg-primary/10 transition-colors">
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </div>
                <span className="text-[10px] font-label-caps uppercase tracking-wider text-primary font-bold">Add</span>
              </button>
            </div>
          </div>

          {/* Split Settings */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
            {selectedFriends.length > 0 && (
              <div>
                <label className="block text-on-surface-variant font-label-caps text-label-caps uppercase mb-2 ml-1">Split Method</label>
                <div className="flex p-1 bg-surface-container-low rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSplitType('equal')}
                    className={`flex-1 py-2 text-center rounded-lg font-medium text-xs transition-all ${splitType === 'equal' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
                  >
                    Equal
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitType('percentage')}
                    className={`flex-1 py-2 text-center rounded-lg font-medium text-xs transition-all ${splitType === 'percentage' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitType('custom')}
                    className={`flex-1 py-2 text-center rounded-lg font-medium text-xs transition-all ${splitType === 'custom' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-primary'}`}
                  >
                    Custom (₹)
                  </button>
                </div>
              </div>
            )}

            {/* Participants selector */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col">
                <label className="text-on-surface-variant font-label-caps text-label-caps uppercase ml-1">Split With</label>
                <span className="text-[10px] text-on-surface-variant/60 ml-1 mt-0.5">
                  Select friends to split the bill, or leave empty for a personal expense.
                </span>
              </div>
              
              <div className="flex flex-col gap-2">
                {eligibleParticipants.map(participant => {
                  const isChecked = selectedFriends.includes(participant.id);
                  return (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <button
                          type="button"
                          onClick={() => toggleParticipant(participant.id)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${isChecked ? 'bg-primary text-on-primary' : 'bg-surface-container-highest border border-outline-variant'}`}
                        >
                          {isChecked && <span className="material-symbols-outlined text-[14px]">check</span>}
                        </button>
                        <span className="text-sm font-semibold text-primary">{participant.name}</span>
                      </div>

                      {isChecked && splitType === 'equal' && (
                        <span className="text-xs text-on-surface-variant font-semibold">
                          ₹{(amount / selectedParticipants.length || 0).toFixed(2)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom/Percentage Share Inputs */}
            {selectedFriends.length > 0 && splitType !== 'equal' && (
              <div className="space-y-3 border-t border-outline-variant/30 pt-4">
                <label className="block text-on-surface-variant font-label-caps text-label-caps uppercase ml-1">
                  Configure Shares
                </label>
                <div className="flex flex-col gap-2">
                  {selectedParticipants.map(pId => {
                    const pName = pId === 'you' ? 'You (Me)' : (eligibleParticipants.find(p => p.id === pId)?.name || 'Friend');
                    return (
                      <div key={pId} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low">
                        <span className="text-sm font-semibold text-primary">{pName}</span>
                        <div className="flex items-center gap-2">
                          {splitType === 'percentage' ? (
                            <div className="flex items-center space-x-1">
                              <input
                                type="number"
                                placeholder="0"
                                value={customShares[pId] || ''}
                                onChange={e => handleShareChange(pId, parseFloat(e.target.value) || 0)}
                                className="w-16 h-8 text-center text-xs bg-white rounded-lg border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                              />
                              <span className="text-xs text-on-surface-variant font-bold">%</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-1">
                              <span className="text-xs text-on-surface-variant font-bold">₹</span>
                              <input
                                type="number"
                                placeholder="0"
                                value={customShares[pId] || ''}
                                onChange={e => handleShareChange(pId, parseFloat(e.target.value) || 0)}
                                className="w-20 h-8 text-center text-xs bg-white rounded-lg border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                              />
                            </div>
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

      {/* Save button */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: '64px',
          zIndex: 45,
          padding: '12px 16px 16px',
          background: 'linear-gradient(to top, #f8f9fa 55%, transparent)',
        }}
      >
        <div style={{ maxWidth: '32rem', margin: '0 auto' }}>
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

      {/* New Category Modal */}
      {showAddCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-xl border border-outline-variant/30">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-headline-lg-mobile text-primary">New Category</h3>
              <button onClick={() => setShowAddCatModal(false)} className="text-on-surface-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleAddCategory} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-label-caps text-on-surface-variant uppercase">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gym, Electricity, Cafe"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="input-field h-12 text-sm"
                />
                {newCatName.trim() && (
                  <p className="text-xs text-on-surface-variant/70 mt-1 flex items-center gap-1.5">
                    Matched Icon: <span className="text-lg bg-surface-container p-1 rounded">{matchCategoryIcon(newCatName)}</span>
                  </p>
                )}
              </div>
              <button type="submit" className="btn-primary w-full h-12 text-sm shadow-none mt-2">
                Create Category
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
