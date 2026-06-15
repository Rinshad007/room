import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { groupsAPI, friendsAPI, expensesAPI } from '../api/services';
import type { Group, FriendWithRequest, SplitType, Category, PaymentMethod } from '../types';
import toast from 'react-hot-toast';

export default function AddExpensePage() {
  const navigate = useNavigate();
  
  // Static state
  const categories: Category[] = ['Food', 'Travel', 'Shopping', 'Rent', 'Entertainment', 'Others'];
  const paymentMethods: PaymentMethod[] = ['GPay', 'Cash'];

  // Form inputs
  const [amount, setAmount] = useState<number>(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<Category>('Food');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('GPay');
  const [groupId, setGroupId] = useState<string>('');
  
  // Lists for dropdowns/options
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<FriendWithRequest[]>([]);
  
  // Selection of participants
  const [eligibleParticipants, setEligibleParticipants] = useState<{ id: string; name: string }[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [paidBy, setPaidBy] = useState<string>('you');

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

        // Prepopulate current user
        setEligibleParticipants([{ id: 'you', name: 'You (Me)' }]);
        setSelectedParticipants(['you']);
      } catch (err) {
        console.error(err);
      }
    }
    loadInitialData();
  }, []);

  // Update participants list when Group changes
  useEffect(() => {
    if (groupId) {
      const selectedGrp = groups.find(g => g.id === groupId);
      if (selectedGrp) {
        const membersList = selectedGrp.members.map(m => ({
          id: m.user.id,
          name: m.user.name
        }));
        setEligibleParticipants(membersList);
        setSelectedParticipants(membersList.map(m => m.id));
        
        // Reset shares mapping
        const initialShares: Record<string, number> = {};
        membersList.forEach(m => {
          initialShares[m.id] = 0;
        });
        setCustomShares(initialShares);
      }
    } else {
      // Direct friends splitting
      const list = [{ id: 'you', name: 'You (Me)' }, ...friends.map(f => ({ id: f.friend.id, name: f.friend.name }))];
      setEligibleParticipants(list);
      setSelectedParticipants(['you']);
      
      const initialShares: Record<string, number> = {};
      list.forEach(m => {
        initialShares[m.id] = 0;
      });
      setCustomShares(initialShares);
    }
  }, [groupId, groups, friends]);

  const toggleParticipant = (id: string) => {
    if (selectedParticipants.includes(id)) {
      if (selectedParticipants.length === 1) return; // Keep at least one
      setSelectedParticipants(selectedParticipants.filter(p => p !== id));
    } else {
      setSelectedParticipants([...selectedParticipants, id]);
    }
  };

  const handleShareChange = (id: string, value: number) => {
    setCustomShares({
      ...customShares,
      [id]: value
    });
  };

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

    try {
      const payload = {
        title,
        description,
        amount,
        payment_method: paymentMethod,
        category,
        split_type: splitType,
        group_id: groupId || undefined,
        expense_date: new Date(expenseDate).toISOString(),
        participants: selectedParticipants,
        split_details: splitType !== 'equal' ? split_details : undefined
      };

      await expensesAPI.create(payload);
      toast.success('Expense created successfully!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create expense');
    }
  };

  return (
    <Layout showBack title="Add Expense">
      <div className="page-container page-enter pb-32">
        <form onSubmit={handleSubmit} className="space-y-6">
          
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

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-label-caps text-on-surface-variant uppercase ml-1">Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="input-field h-12 text-sm bg-surface-container-low px-2 py-0 border-transparent focus:ring-0"
                >
                  {paymentMethods.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-label-caps text-on-surface-variant uppercase ml-1">Paid By</label>
                <select
                  value={paidBy}
                  onChange={e => setPaidBy(e.target.value)}
                  className="input-field h-12 text-sm bg-surface-container-low px-2 py-0 border-transparent focus:ring-0"
                  disabled // Simply fallback to "You" for this version of form creation to prevent multi-payer mismatch
                >
                  <option value="you">You (Me)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Categories Horizontal Selector */}
          <div className="space-y-2">
            <label className="block text-on-surface-variant font-label-caps text-label-caps uppercase ml-1">Category</label>
            <div className="flex space-x-3 overflow-x-auto hide-scrollbar pb-2 px-1">
              {categories.map(cat => {
                const isSelected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex flex-col items-center space-y-1.5 min-w-[72px] transition-all duration-200 ${isSelected ? 'scale-105 opacity-100' : 'opacity-65 hover:opacity-100'}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-primary text-on-primary shadow-md' : 'bg-surface-container-high text-on-surface'}`}>
                      <span className="material-symbols-outlined text-[20px]">
                        {cat === 'Food' && 'restaurant'}
                        {cat === 'Travel' && 'flight'}
                        {cat === 'Shopping' && 'shopping_cart'}
                        {cat === 'Rent' && 'home'}
                        {cat === 'Entertainment' && 'movie'}
                        {cat === 'Others' && 'more_horiz'}
                      </span>
                    </div>
                    <span className={`text-[10px] font-label-caps uppercase tracking-wider ${isSelected ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Split Settings */}
          <div className="glass-panel rounded-2xl p-5 space-y-4">
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

            {/* Participants selector */}
            <div className="space-y-3 pt-2">
              <label className="block text-on-surface-variant font-label-caps text-label-caps uppercase ml-1">Split With</label>
              
              <div className="flex flex-col gap-2">
                {eligibleParticipants.map(participant => {
                  const isChecked = selectedParticipants.includes(participant.id);
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

                      {isChecked && (
                        <div className="flex items-center gap-2">
                          {splitType === 'equal' ? (
                            <span className="text-xs text-on-surface-variant font-semibold">
                              ₹{(amount / selectedParticipants.length || 0).toFixed(2)}
                            </span>
                          ) : splitType === 'percentage' ? (
                            <div className="flex items-center space-x-1">
                              <input
                                type="number"
                                placeholder="0"
                                value={customShares[participant.id] || ''}
                                onChange={e => handleShareChange(participant.id, parseFloat(e.target.value) || 0)}
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
                                value={customShares[participant.id] || ''}
                                onChange={e => handleShareChange(participant.id, parseFloat(e.target.value) || 0)}
                                className="w-20 h-8 text-center text-xs bg-white rounded-lg border border-outline-variant focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Save Action Button */}
          <div className="fixed bottom-0 left-0 w-full p-container-padding bg-gradient-to-t from-surface via-surface/90 to-transparent z-40 pb-8">
            <div className="max-w-md mx-auto">
              <button
                type="submit"
                className="w-full h-14 bg-primary text-on-primary rounded-2xl font-semibold flex items-center justify-center space-x-2 shadow-lg active:scale-[0.98] transition-transform hover:bg-primary/95"
              >
                <span className="material-symbols-outlined">save</span>
                <span>Save Expense</span>
              </button>
            </div>
          </div>

        </form>
      </div>
    </Layout>
  );
}
