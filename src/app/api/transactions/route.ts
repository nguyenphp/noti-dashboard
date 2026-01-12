import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// API Key for mobile app authentication
const API_KEY = process.env.MOBILE_API_KEY || 'noti-secret-key-2024';

// GET - Lấy danh sách transactions
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${API_KEY}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    try {
        let query = supabase
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });

        if (startDate) {
            query = query.gte('created_at', startDate);
        }
        if (endDate) {
            query = query.lte('created_at', endDate);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ transactions: data });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}

// POST - Thêm transaction mới (từ mobile app)
export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${API_KEY}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { amount, source, rawText } = body;

        if (!amount || !source) {
            return NextResponse.json(
                { error: 'Missing required fields: amount, source' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('transactions')
            .insert([{ amount, source, raw_text: rawText }])
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ transaction: data }, { status: 201 });
    } catch (error) {
        console.error('Error creating transaction:', error);
        return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
    }
}
