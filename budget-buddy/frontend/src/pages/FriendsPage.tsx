import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { friendsAPI, usersAPI } from '../api/services';
import type { User, FriendWithRequest } from '../types';
import toast from 'react-hot-toast';

export default function FriendsPage() {
  const [friends, setFriends] = useState<FriendWithRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendWithRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendWithRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'friends' | 'pending'>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchFriends = async () => {
    try {
      setLoading(true);
      const friendsRes = await friendsAPI.list();
      setFriends(friendsRes.data.friends || []);

      const pendingRes = await friendsAPI.pending();
      setPendingRequests(pendingRes.data.received || []);
      setSentRequests(pendingRes.data.sent || []);
    } catch (err) {
      console.error('Failed to fetch friends data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      setSearching(true);
      const res = await usersAPI.search(searchQuery);
      setSearchResults(res.data.users || []);
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async (userId: string) => {
    try {
      await friendsAPI.sendRequest(userId);
      toast.success('Friend request sent!');
      setSearchQuery('');
      setSearchResults([]);
      fetchFriends();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Request failed');
    }
  };

  const acceptRequest = async (friendshipId: string) => {
    try {
      await friendsAPI.accept(friendshipId);
      toast.success('Friend request accepted!');
      fetchFriends();
    } catch (err) {
      toast.error('Accept failed');
    }
  };

  const rejectRequest = async (friendshipId: string) => {
    try {
      await friendsAPI.reject(friendshipId);
      toast.success('Request declined');
      fetchFriends();
    } catch (err) {
      toast.error('Decline failed');
    }
  };

  const cancelRequest = async (friendshipId: string) => {
    try {
      await friendsAPI.remove(friendshipId);
      toast.success('Friend request cancelled');
      fetchFriends();
    } catch (err) {
      toast.error('Cancel failed');
    }
  };

  const removeFriend = async (friendshipId: string) => {
    if (!confirm('Are you sure you want to remove this friend?')) return;
    try {
      await friendsAPI.remove(friendshipId);
      toast.success('Friend removed');
      fetchFriends();
    } catch (err) {
      toast.error('Removal failed');
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
        {/* Tabs */}
        <div className="flex border-b border-outline-variant/30 mb-5">
          <button
            onClick={() => setActiveTab('friends')}
            className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'friends'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            All Friends ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'pending'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-primary'
            }`}
          >
            Pending Requests
            {pendingRequests.length > 0 && (
              <span className="bg-error text-on-error px-2 py-0.5 rounded-full text-[10px] font-bold">
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'friends' ? (
          <>
            {/* Search / Add Friend Form */}
            <section className="flex flex-col gap-3">
              <h2 className="text-headline-lg-mobile text-primary font-bold">Add Friend</h2>
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search by email or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field h-12 text-sm flex-1"
                />
                <button type="submit" className="btn-primary h-12 px-4 shadow-none">
                  {searching ? (
                    <span className="material-symbols-outlined animate-spin">refresh</span>
                  ) : (
                    'Search'
                  )}
                </button>
              </form>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="glass-panel rounded-xl p-3 flex flex-col gap-2.5">
                  {searchResults.map((user) => (
                    <div key={user.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-sm">
                          {user.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-primary">{user.name}</p>
                          <p className="text-xs text-on-surface-variant">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => sendRequest(user.id)}
                        className="btn-primary h-8 px-3 text-xs shadow-none py-0 rounded-lg"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* All Friends */}
            <section className="flex flex-col gap-3">
              <h2 className="text-monetary-md text-on-surface-variant font-semibold">All Friends</h2>
              <div className="flex flex-col gap-3">
                {friends.length === 0 ? (
                  <p className="py-6 text-center text-body-md text-on-surface-variant/60 italic glass-panel rounded-xl">
                    No friends added yet. Use search above to find people.
                  </p>
                ) : (
                  friends.map((item) => {
                    const balance = 0; // Simplified balance
                    return (
                      <div
                        key={item.friendship_id}
                        className="card p-4 flex items-center justify-between bg-white border border-outline-variant/20 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary font-bold">
                            {item.friend.name[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-body-md text-primary">{item.friend.name}</p>
                            <p className="text-xs text-on-surface-variant/80">
                              {balance === 0 ? (
                                <span className="text-on-surface-variant/60">Settled up</span>
                              ) : balance > 0 ? (
                                <span>
                                  owes you <span className="text-secondary font-bold">₹{balance}</span>
                                </span>
                              ) : (
                                <span>
                                  you owe <span className="text-error font-bold">₹{Math.abs(balance)}</span>
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => removeFriend(item.friendship_id)}
                          className="text-on-surface-variant/40 hover:text-error hover:bg-error/5 p-1.5 rounded-lg transition-colors"
                          title="Remove Friend"
                        >
                          <span className="material-symbols-outlined text-[20px]">delete</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            {/* Friend Requests Received */}
            <section className="flex flex-col gap-3">
              <h2 className="text-monetary-md text-on-surface-variant font-semibold">Received Requests</h2>
              <div className="flex flex-col gap-2">
                {pendingRequests.length === 0 ? (
                  <p className="py-6 text-center text-body-md text-on-surface-variant/60 italic glass-panel rounded-xl">
                    No pending requests received.
                  </p>
                ) : (
                  pendingRequests.map((req) => (
                    <div key={req.friendship_id} className="glass-panel rounded-xl p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center font-bold text-on-surface-variant text-sm">
                          {req.friend.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-primary">{req.friend.name}</p>
                          <p className="text-xs text-on-surface-variant/80">{req.friend.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => rejectRequest(req.friendship_id)}
                          className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high transition-colors flex items-center justify-center active:scale-95 text-on-surface-variant"
                          title="Decline"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                        <button
                          onClick={() => acceptRequest(req.friendship_id)}
                          className="w-9 h-9 rounded-full bg-primary hover:bg-primary/95 transition-colors flex items-center justify-center active:scale-95 text-on-primary shadow-sm"
                          title="Accept"
                        >
                          <span className="material-symbols-outlined text-[18px]">check</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Friend Requests Sent */}
            <section className="flex flex-col gap-3 mt-4">
              <h2 className="text-monetary-md text-on-surface-variant font-semibold">Sent Requests</h2>
              <div className="flex flex-col gap-2">
                {sentRequests.length === 0 ? (
                  <p className="py-6 text-center text-body-md text-on-surface-variant/60 italic glass-panel rounded-xl">
                    No pending requests sent.
                  </p>
                ) : (
                  sentRequests.map((req) => (
                    <div key={req.friendship_id} className="glass-panel rounded-xl p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center font-bold text-on-surface-variant text-sm">
                          {req.friend.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-primary">{req.friend.name}</p>
                          <p className="text-xs text-on-surface-variant/80">{req.friend.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => cancelRequest(req.friendship_id)}
                        className="btn-text h-8 px-3 text-xs text-error hover:bg-error/5 py-0 rounded-lg font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
