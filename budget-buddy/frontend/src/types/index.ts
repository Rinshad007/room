// Types for the entire Budget Buddy app

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Friendship {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface FriendWithRequest {
  friendship_id: string;
  friend: User;
  status: string;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  members: GroupMember[];
}

export interface GroupMember {
  id: string;
  user: User;
  joined_at: string;
}

export type SplitType = 'equal' | 'percentage' | 'custom';
export type Category = 'Food' | 'Travel' | 'Shopping' | 'Rent' | 'Entertainment' | 'Others';
export type PaymentMethod = 'GPay' | 'Cash';
export type SplitStatus = 'pending' | 'accepted' | 'disputed';

export interface SplitEntry {
  user_id: string;
  value: number;
}

export interface ExpenseCreate {
  title: string;
  description?: string;
  amount: number;
  payment_method: PaymentMethod;
  category: Category;
  split_type: SplitType;
  group_id?: string;
  expense_date: string;
  participants: string[];
  split_details?: SplitEntry[];
}

export interface ExpenseSplit {
  id: string;
  user_id: string;
  share_amount: number;
  status: SplitStatus;
}

export interface Expense {
  id: string;
  title: string;
  description?: string;
  amount: number;
  paid_by: string;
  payment_method: PaymentMethod;
  category: Category;
  split_type: SplitType;
  group_id?: string;
  expense_date: string;
  created_at: string;
  splits: ExpenseSplit[];
}

export interface ExpenseListResponse {
  expenses: Expense[];
  total: number;
}

export interface Settlement {
  id: string;
  payer_id: string;
  receiver_id: string;
  amount: number;
  payment_method: PaymentMethod;
  status: 'pending' | 'completed';
  settled_at?: string;
  created_at: string;
}

export interface BalanceSummary {
  total_payable: number;
  total_receivable: number;
  net_balance: number;
}

export interface UserBalance {
  user_id: string;
  balance: number;
}

export interface BalanceDetail {
  summary: BalanceSummary;
  per_user: UserBalance[];
}

export interface Budget {
  id: string;
  user_id: string;
  month: number;
  year: number;
  amount: number;
  spent: number;
  remaining: number;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  created_at: string;
}

export interface DashboardData {
  total_expenses: number;
  total_spent: number;
  total_payable: number;
  total_receivable: number;
  net_balance: number;
}

export interface NotificationListResponse {
  notifications: Notification[];
  unread_count: number;
}

export interface GroupListResponse {
  groups: Group[];
  total: number;
}

export interface FriendListResponse {
  friends: FriendWithRequest[];
  total: number;
}


