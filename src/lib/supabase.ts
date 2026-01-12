import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iorwtwlqtnibhfajypee.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlvcnd0d2xxdG5pYmhmYWp5cGVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjg3NTUsImV4cCI6MjA4MzgwNDc1NX0.AMacmU6VzXnPOhcYYFlQaSGqRkMg20BY5DoTX3hCPUY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export interface Transaction {
    id: string;
    amount: number;
    source: 'momo' | 'mbbank';
    raw_text: string | null;
    created_at: string;
}

// Helper functions
export async function getTransactions(startDate?: Date, endDate?: Date) {
    let query = supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

    if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
        query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Transaction[];
}

export async function getTodayTransactions() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return getTransactions(today);
}

export async function addTransaction(
    amount: number,
    source: 'momo' | 'mbbank',
    rawText?: string
) {
    const { data, error } = await supabase
        .from('transactions')
        .insert([{ amount, source, raw_text: rawText }])
        .select()
        .single();

    if (error) throw error;
    return data as Transaction;
}

export async function getTodayRevenue() {
    const transactions = await getTodayTransactions();
    return transactions.reduce((sum, t) => sum + t.amount, 0);
}
