import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// API Key for mobile app authentication
const API_KEY = process.env.MOBILE_API_KEY || 'noti-secret-key-2024';

// GET - Lấy thống kê
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${API_KEY}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Lấy tất cả transactions trong 14 ngày gần nhất
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

        const { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .gte('created_at', fourteenDaysAgo.toISOString())
            .order('created_at', { ascending: false });

        if (error) throw error;

        const allTransactions = transactions || [];

        // Calculate statistics
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // This week vs last week
        const thisWeekTransactions = allTransactions.filter(t => new Date(t.created_at) >= sevenDaysAgo);
        const lastWeekTransactions = allTransactions.filter(t => {
            const d = new Date(t.created_at);
            return d < sevenDaysAgo && d >= fourteenDaysAgo;
        });

        const thisWeekTotal = thisWeekTransactions.reduce((sum, t) => sum + t.amount, 0);
        const lastWeekTotal = lastWeekTransactions.reduce((sum, t) => sum + t.amount, 0);
        const weekOverWeekChange = lastWeekTotal > 0
            ? ((thisWeekTotal - lastWeekTotal) / lastWeekTotal * 100).toFixed(1)
            : null;

        // Hourly distribution
        const hourlyData: { [key: number]: number } = {};
        for (let i = 0; i < 24; i++) {
            hourlyData[i] = 0;
        }
        allTransactions.forEach(t => {
            const hour = new Date(t.created_at).getHours();
            hourlyData[hour] = (hourlyData[hour] || 0) + t.amount;
        });
        const hourlyChartData = Object.entries(hourlyData).map(([hour, amount]) => ({
            hour: `${hour}h`,
            amount
        }));

        // Find peak hour
        const peakHour = hourlyChartData.reduce((max, curr) =>
            curr.amount > max.amount ? curr : max, hourlyChartData[0]);

        // Amount distribution
        const ranges = [
            { label: '< 20K', min: 0, max: 20000, count: 0 },
            { label: '20K-50K', min: 20000, max: 50000, count: 0 },
            { label: '50K-100K', min: 50000, max: 100000, count: 0 },
            { label: '100K-200K', min: 100000, max: 200000, count: 0 },
            { label: '200K-500K', min: 200000, max: 500000, count: 0 },
            { label: '> 500K', min: 500000, max: Infinity, count: 0 },
        ];
        allTransactions.forEach(t => {
            const range = ranges.find(r => t.amount >= r.min && t.amount < r.max);
            if (range) range.count++;
        });
        const amountDistribution = ranges.map(r => ({ range: r.label, count: r.count }));

        // Top 5 days
        const dailyData: { [key: string]: { date: string; amount: number; count: number } } = {};
        allTransactions.forEach(t => {
            const dateStr = new Date(t.created_at).toLocaleDateString('vi-VN');
            if (!dailyData[dateStr]) {
                dailyData[dateStr] = { date: dateStr, amount: 0, count: 0 };
            }
            dailyData[dateStr].amount += t.amount;
            dailyData[dateStr].count++;
        });
        const topDays = Object.values(dailyData)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);

        // KPIs
        const totalTransactions = allTransactions.length;
        const averageTransaction = totalTransactions > 0
            ? Math.round(allTransactions.reduce((sum, t) => sum + t.amount, 0) / totalTransactions)
            : 0;
        const highestTransaction = totalTransactions > 0
            ? Math.max(...allTransactions.map(t => t.amount))
            : 0;
        const lowestTransaction = totalTransactions > 0
            ? Math.min(...allTransactions.map(t => t.amount))
            : 0;

        // Daily chart for this week
        const dailyChartData: { date: string; amount: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = day.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            const dayTotal = thisWeekTransactions
                .filter(t => new Date(t.created_at).toDateString() === day.toDateString())
                .reduce((sum, t) => sum + t.amount, 0);
            dailyChartData.push({ date: dateStr, amount: dayTotal });
        }

        // Source breakdown
        const momoTotal = allTransactions.filter(t => t.source === 'momo').reduce((sum, t) => sum + t.amount, 0);
        const mbTotal = allTransactions.filter(t => t.source === 'mbbank').reduce((sum, t) => sum + t.amount, 0);
        const momoCount = allTransactions.filter(t => t.source === 'momo').length;
        const mbCount = allTransactions.filter(t => t.source === 'mbbank').length;

        return NextResponse.json({
            kpis: {
                totalTransactions,
                averageTransaction,
                highestTransaction,
                lowestTransaction,
                thisWeekTotal,
                lastWeekTotal,
                weekOverWeekChange,
            },
            charts: {
                hourlyChartData,
                peakHour: peakHour?.hour || null,
                amountDistribution,
                topDays,
                dailyChartData,
            },
            sources: {
                momo: { total: momoTotal, count: momoCount },
                mbbank: { total: mbTotal, count: mbCount },
            }
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
    }
}
