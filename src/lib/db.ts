import { supabase } from "@/integrations/supabase/client";

export type Account = {
  id: string;
  name: string;
  bank: string;
  account_number: string | null;
  color: string;
  is_active: boolean;
  current_balance: number;
  opening_balance: number;
};

export type Branch = { id: string; name: string; code: string | null; is_active: boolean };

export type Category = { id: string; name: string; icon: string; color: string; is_active: boolean; is_personal?: boolean };

export type Income = {
  id: string;
  txn_date: string;
  branch_id: string | null;
  category_id: string | null;
  account_id: string | null;
  payment_mode: "cash" | "gpay" | "bank_transfer";
  amount: number;
  notes: string | null;
  attachment_path: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  txn_date: string;
  branch_id: string | null;
  category_id: string | null;
  account_id: string | null;
  payment_mode: "cash" | "gpay" | "bank_transfer";
  amount: number;
  description: string | null;
  attachment_path: string | null;
  created_at: string;
};

export type Transfer = {
  id: string;
  txn_date: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  notes: string | null;
  created_at: string;
};

export type Receivable = {
  id: string;
  txn_date: string;
  type: string;
  party_name: string;
  amount: number;
  settled_amount: number;
  status: "pending" | "settled" | "partial";
  account_id: string | null;
  notes: string | null;
};

export const fetchAccounts = async (): Promise<Account[]> => {
  const { data, error } = await supabase.from("accounts").select("*").order("name");
  if (error) throw error;
  return (data as Account[]) ?? [];
};

export const fetchBranches = async (): Promise<Branch[]> => {
  const { data, error } = await supabase.from("branches").select("*").order("name");
  if (error) throw error;
  return (data as Branch[]) ?? [];
};

export const fetchIncomeCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase.from("income_categories").select("*").order("name");
  if (error) throw error;
  return (data as Category[]) ?? [];
};

export const fetchExpenseCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase.from("expense_categories").select("*").order("name");
  if (error) throw error;
  return (data as Category[]) ?? [];
};

export const fetchIncome = async (limit = 500): Promise<Income[]> => {
  const { data, error } = await supabase
    .from("income_transactions")
    .select("*")
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Income[]) ?? [];
};

export const fetchExpenses = async (limit = 500): Promise<Expense[]> => {
  const { data, error } = await supabase
    .from("expense_transactions")
    .select("*")
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Expense[]) ?? [];
};

export const fetchTransfers = async (limit = 200): Promise<Transfer[]> => {
  const { data, error } = await supabase
    .from("account_transfers")
    .select("*")
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Transfer[]) ?? [];
};

export const fetchReceivables = async (): Promise<Receivable[]> => {
  const { data, error } = await supabase
    .from("cash_receivables")
    .select("*")
    .order("txn_date", { ascending: false });
  if (error) throw error;
  return (data as Receivable[]) ?? [];
};

export async function uploadAttachment(userId: string, file: File): Promise<string> {
  const path = `${userId}/${Date.now()}_${file.name}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file);
  if (error) throw error;
  return path;
}
