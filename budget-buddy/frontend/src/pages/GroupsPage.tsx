import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { groupsAPI, friendsAPI, expensesAPI } from '../api/services';
import type { Group, FriendWithRequest, Expense } from '../types';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

export default function GroupsPage() {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<FriendWithRequest[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupExpenses, setGroupExpenses] = useState<Expense[]>([]);
  
  // Modals / forms
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const res = await groupsAPI.list();
      setGroups(res.data.groups);

      const friendsRes = await friendsAPI.list();
      setFriends(friendsRes.data.friends || []);
    } catch (err) {
      console.error('Failed to load groups', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
    
    // Check query params if create modal is requested (e.g. from Dashboard click)
    if (searchParams.get('create') === 'true') {
      setShowCreateModal(true);
      // Clean up search query param
      setSearchParams({});
    }
  }, [searchParams]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    try {
      await groupsAPI.create({ name: newGroupName, description: newGroupDesc });
      toast.success('Group created successfully!');
      setNewGroupName('');
      setNewGroupDesc('');
      setShowCreateModal(false);
      loadGroups();
    } catch (err) {
      toast.error('Failed to create group');
    }
  };

  const handleSelectGroup = async (group: Group) => {
    try {
      setLoadingDetail(true);
      setSelectedGroup(group);
      const res = await expensesAPI.byGroup(group.id);
      setGroupExpenses(res.data.expenses || []);
    } catch (err) {
      toast.error('Failed to load group details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    if (!selectedGroup) return;
    try {
      await groupsAPI.addMember(selectedGroup.id, userId);
      toast.success('Member added!');
      // Reload group details
      const refreshed = await groupsAPI.get(selectedGroup.id);
      setSelectedGroup(refreshed.data);
      loadGroups();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to add member');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;
    try {
      await groupsAPI.delete(groupId);
      toast.success('Group deleted');
      setSelectedGroup(null);
      loadGroups();
    } catch (err) {
      toast.error('Failed to delete group');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Food': return 'restaurant';
      case 'Travel': return 'flight';
      case 'Shopping': return 'shopping_cart';
      case 'Rent': return 'home';
      case 'Entertainment': return 'movie';
      default: return 'payments';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="page-container space-y-6">
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-32 w-full" />
          <div className="skeleton h-48 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container page-enter">
        {selectedGroup ? (
          /* Group Detail View */
          <div className="flex flex-col gap-6">
            {/* Header info */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedGroup(null)}
                className="text-on-surface-variant hover:bg-surface-container-high/50 p-2 -ml-2 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="font-bold text-headline-lg-mobile text-primary truncate">{selectedGroup.name}</h1>
                <p className="text-xs text-on-surface-variant truncate">{selectedGroup.description || 'No description'}</p>
              </div>
              <button
                onClick={() => handleDeleteGroup(selectedGroup.id)}
                className="text-error hover:bg-error/5 p-2 rounded-lg transition-colors"
                title="Delete Group"
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>

            {/* Members Section */}
            <section className="glass-panel rounded-xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-monetary-md text-primary">Members ({selectedGroup.members.length})</h3>
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">person_add</span> Add
                </button>
              </div>

              <div className="flex gap-2.5 overflow-x-auto hide-scrollbar py-1">
                {selectedGroup.members.map((m) => (
                  <div key={m.id} className="flex flex-col items-center min-w-[56px]">
                    <div className="w-10 h-10 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-sm">
                      {m.user.name[0].toUpperCase()}
                    </div>
                    <span className="text-[10px] text-on-surface-variant font-medium mt-1 truncate max-w-[56px]">
                      {m.user.name}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Group Expenses List */}
            <section className="flex flex-col gap-3">
              <h3 className="font-bold text-monetary-md text-primary">Group Expenses</h3>
              {loadingDetail ? (
                <div className="skeleton h-32 w-full" />
              ) : groupExpenses.length === 0 ? (
                <p className="py-8 text-center text-body-md text-on-surface-variant/60 italic glass-panel rounded-xl">
                  No expenses added in this group yet.
                </p>
              ) : (
                <div className="glass-panel rounded-xl p-4 flex flex-col gap-0">
                  {groupExpenses.map((exp, idx) => (
                    <div key={exp.id}>
                      {idx > 0 && <div className="w-full h-px bg-outline-variant/30 my-3" />}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant">
                            <span className="material-symbols-outlined">{getCategoryIcon(exp.category)}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-body-md text-primary truncate max-w-[150px]">{exp.title}</p>
                            <p className="text-xs text-on-surface-variant">
                              {new Date(exp.expense_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} • {exp.category}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-monetary-md text-primary font-bold">₹{exp.amount.toLocaleString('en-IN')}</span>
                          <span className="text-[10px] text-on-surface-variant/75 mt-0.5">
                            Paid by {exp.paid_by === 'you' || exp.paid_by === user?.id ? 'You' : 'Member'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          /* Groups List View */
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h1 className="text-headline-lg font-bold text-primary">Groups</h1>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary h-10 px-4 text-sm py-0 rounded-lg shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">add</span> New Group
              </button>
            </div>

            {/* Groups Grid */}
            <div className="flex flex-col gap-4">
              {groups.length === 0 ? (
                <div className="glass-panel rounded-xl p-8 text-center">
                  <p className="text-body-md text-on-surface-variant/60 italic mb-4">No groups created yet.</p>
                  <button onClick={() => setShowCreateModal(true)} className="btn-secondary mx-auto text-sm py-2 px-4 h-auto">
                    Create your first group
                  </button>
                </div>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => handleSelectGroup(group)}
                    className="bg-white rounded-xl p-4 border border-outline-variant/20 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-shadow cursor-pointer flex justify-between items-center"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary border border-outline-variant/20">
                        <span className="material-symbols-outlined">grid_view</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-monetary-md text-primary">{group.name}</h3>
                        <p className="text-xs text-on-surface-variant mt-0.5">{group.members.length} members</p>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant/40">chevron_right</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Create Group Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-xl border border-outline-variant/30">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-headline-lg-mobile text-primary">New Group</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-on-surface-variant">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <form onSubmit={handleCreateGroup} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-label-caps text-on-surface-variant uppercase">Group Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Goa Trip"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="input-field h-12 text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-label-caps text-on-surface-variant uppercase">Description</label>
                  <input
                    type="text"
                    placeholder="Optional details..."
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    className="input-field h-12 text-sm"
                  />
                </div>

                <button type="submit" className="btn-primary w-full h-12 text-sm shadow-none mt-2">
                  Create Group
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMemberModal && selectedGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-xl border border-outline-variant/30">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-headline-lg-mobile text-primary">Add Member</h3>
                <button onClick={() => setShowAddMemberModal(false)} className="text-on-surface-variant">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                {friends.length === 0 ? (
                  <p className="text-sm text-on-surface-variant italic text-center py-4">Add friends first on the Friends tab</p>
                ) : (
                  friends
                    .filter((f) => !selectedGroup.members.some((m) => m.user.id === f.friend.id))
                    .map((item) => (
                      <div key={item.friend.id} className="flex items-center justify-between border-b border-outline-variant/20 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center font-bold text-xs">
                            {item.friend.name[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-sm text-primary">{item.friend.name}</span>
                        </div>
                        <button
                          onClick={() => handleAddMember(item.friend.id)}
                          className="btn-primary h-8 px-3 text-xs py-0 shadow-none rounded-lg"
                        >
                          Add
                        </button>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
