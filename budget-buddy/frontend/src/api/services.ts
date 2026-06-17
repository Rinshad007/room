import api from './client';
import type {
  User, TokenResponse, Group, Expense, ExpenseCreate, ExpenseListResponse,
  Settlement, BalanceDetail, Budget, BudgetSummary, DashboardData, NotificationListResponse, GroupListResponse, FriendListResponse
} from '../types';

// ─── Auth ──────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post<TokenResponse & { user: User }>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<TokenResponse>('/auth/login', data),
  me: () => api.get<User>('/auth/me'),
  refresh: (refresh_token: string) =>
    api.post<{ access_token: string }>('/auth/refresh', { refresh_token }),
};

// ─── Users ─────────────────────────────────────────────────────────────
export const usersAPI = {
  me: () => api.get<User>('/users/me'),
  update: (data: Partial<User>) => api.patch<User>('/users/me', data),
  search: (q: string) => api.get<{ users: User[]; total: number }>(`/users/search?q=${q}`),
  getById: (id: string) => api.get<User>(`/users/${id}`),
};

// ─── Friends ───────────────────────────────────────────────────────────
export const friendsAPI = {
  list: () => api.get<FriendListResponse>('/friends/'),
  sendRequest: (receiver_id: string) => api.post('/friends/request', { receiver_id }),
  pending: () => api.get('/friends/pending'),
  accept: (id: string) => api.post(`/friends/${id}/accept`),
  reject: (id: string) => api.post(`/friends/${id}/reject`),
  remove: (id: string) => api.delete(`/friends/${id}`),
};

// ─── Groups ────────────────────────────────────────────────────────────
export const groupsAPI = {
  list: () => api.get<GroupListResponse>('/groups/'),
  create: (data: { name: string; description?: string }) => api.post<Group>('/groups/', data),
  get: (id: string) => api.get<Group>(`/groups/${id}`),
  update: (id: string, data: Partial<Group>) => api.patch<Group>(`/groups/${id}`, data),
  delete: (id: string) => api.delete(`/groups/${id}`),
  addMember: (id: string, user_id: string) => api.post(`/groups/${id}/members`, { user_id }),
  removeMember: (id: string, user_id: string) => api.delete(`/groups/${id}/members/${user_id}`),
};

// ─── Expenses ──────────────────────────────────────────────────────────
export const expensesAPI = {
  create: (data: ExpenseCreate) => api.post<Expense>('/expenses/', data),
  list: (skip = 0, limit = 20) => api.get<ExpenseListResponse>(`/expenses/?skip=${skip}&limit=${limit}`),
  get: (id: string) => api.get<Expense>(`/expenses/${id}`),
  byGroup: (group_id: string) => api.get<ExpenseListResponse>(`/expenses/group/${group_id}`),
  delete: (id: string) => api.delete(`/expenses/${id}`),
  updateSplitStatus: (split_id: string, status: string) =>
    api.patch(`/expenses/splits/${split_id}/status`, { status }),
};

// ─── Settlements ───────────────────────────────────────────────────────
export const settlementsAPI = {
  create: (data: { receiver_id: string; amount: number; payment_method: string }) =>
    api.post<Settlement>('/settlements/', data),
  list: () => api.get<Settlement[]>('/settlements/'),
  balances: () => api.get<BalanceDetail>('/settlements/balances'),
  approve: (id: string) => api.post<Settlement>(`/settlements/${id}/approve`),
};

// ─── Budgets ───────────────────────────────────────────────────────────
export const budgetsAPI = {
  create: (data: { month: number; year: number; amount: number }) =>
    api.post<Budget>('/budgets/', data),
  list: () => api.get<Budget[]>('/budgets/'),
  get: (month: number, year: number) => api.get<Budget>(`/budgets/${month}/${year}`),
  summary: (month: number, year: number) => api.get<BudgetSummary>(`/budgets/summary/${month}/${year}`),
  update: (month: number, year: number, amount: number) =>
    api.patch<Budget>(`/budgets/${month}/${year}`, { amount }),
};

// ─── Analytics ─────────────────────────────────────────────────────────
export const analyticsAPI = {
  dashboard: () => api.get<DashboardData>('/analytics/dashboard'),
  monthly: (year?: number) => api.get(`/analytics/monthly${year ? `?year=${year}` : ''}`),
  categories: (month?: number, year?: number) =>
    api.get(`/analytics/categories${month ? `?month=${month}&year=${year}` : ''}`),
  trends: (months?: number) => api.get(`/analytics/trends${months ? `?months=${months}` : ''}`),
};

// ─── Notifications ─────────────────────────────────────────────────────
export const notificationsAPI = {
  list: () => api.get<NotificationListResponse>('/notifications/'),
  readAll: () => api.post('/notifications/read-all'),
};
