'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Transaction } from '@/lib/supabase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b'];

export default function DashboardClient() {
    const { data: session } = useSession();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');

    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const { supabase } = await import('@/lib/supabase');

            let query = supabase
                .from('transactions')
                .select('*')
                .order('created_at', { ascending: false });

            const now = new Date();
            if (dateFilter === 'today') {
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                query = query.gte('created_at', today.toISOString());
            } else if (dateFilter === 'week') {
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                query = query.gte('created_at', weekAgo.toISOString());
            } else if (dateFilter === 'month') {
                const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                query = query.gte('created_at', monthAgo.toISOString());
            }

            const { data, error } = await query;

            if (error) throw error;
            setTransactions(data || []);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    }, [dateFilter]);

    useEffect(() => {
        fetchTransactions();
        const interval = setInterval(fetchTransactions, 10000);
        return () => clearInterval(interval);
    }, [fetchTransactions]);

    const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
    const momoTotal = transactions.filter(t => t.source === 'momo').reduce((sum, t) => sum + t.amount, 0);
    const mbTotal = transactions.filter(t => t.source === 'mbbank').reduce((sum, t) => sum + t.amount, 0);
    const momoCount = transactions.filter(t => t.source === 'momo').length;
    const mbCount = transactions.filter(t => t.source === 'mbbank').length;

    // Chart data - doanh thu theo ngày
    const dailyChartData = useMemo(() => {
        const grouped: { [key: string]: number } = {};
        transactions.forEach(t => {
            const date = new Date(t.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            grouped[date] = (grouped[date] || 0) + t.amount;
        });
        return Object.entries(grouped)
            .map(([date, amount]) => ({ date, amount }))
            .reverse()
            .slice(-7);
    }, [transactions]);

    // Pie chart data - tỷ lệ nguồn
    const sourceChartData = useMemo(() => [
        { name: 'MoMo', value: momoTotal, count: momoCount },
        { name: 'MB Bank', value: mbTotal, count: mbCount },
    ].filter(d => d.value > 0), [momoTotal, mbTotal, momoCount, mbCount]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
        }).format(amount);
    };

    const formatShortCurrency = (amount: number) => {
        if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
        if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
        return amount.toString();
    };

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
        });
    };

    const filterLabels = {
        today: 'Hôm nay',
        week: '7 ngày',
        month: '30 ngày',
        all: 'Tất cả',
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* Header */}
            <header className="border-b border-white/10 bg-black/20 backdrop-blur-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <span className="text-xl">💰</span>
                        </div>
                        <h1 className="text-xl font-bold text-white">Noti Dashboard</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-gray-400 text-sm">{session?.user?.email}</span>
                        <button
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition"
                        >
                            Đăng xuất
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Revenue Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Total Revenue */}
                    <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-gray-400 text-sm">Tổng doanh thu</p>
                                <p className="text-4xl font-bold text-white mt-1">
                                    {formatCurrency(totalRevenue)}
                                </p>
                            </div>
                            <div className="bg-green-500/20 px-3 py-1 rounded-full">
                                <span className="text-green-400 text-sm font-medium">{filterLabels[dateFilter]}</span>
                            </div>
                        </div>
                        <div className="flex gap-6">
                            <div>
                                <p className="text-gray-400 text-xs">Giao dịch</p>
                                <p className="text-2xl font-bold text-white">{transactions.length}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-xs">MoMo</p>
                                <p className="text-2xl font-bold text-pink-400">{momoCount}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-xs">MB Bank</p>
                                <p className="text-2xl font-bold text-blue-400">{mbCount}</p>
                            </div>
                        </div>
                    </div>

                    {/* Filter */}
                    <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                        <p className="text-gray-400 text-sm mb-4">Lọc theo thời gian</p>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(filterLabels).map(([key, label]) => (
                                <button
                                    key={key}
                                    onClick={() => setDateFilter(key as typeof dateFilter)}
                                    className={`py-2 px-3 rounded-lg text-sm font-medium transition ${dateFilter === key
                                        ? 'bg-purple-500 text-white'
                                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                                        }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Daily Revenue Chart */}
                    <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                        <h3 className="text-lg font-semibold text-white mb-4">📊 Doanh thu theo ngày</h3>
                        {dailyChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={dailyChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                                    <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={formatShortCurrency} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                        labelStyle={{ color: '#fff' }}
                                        formatter={(value) => [formatCurrency(value as number), 'Doanh thu']}
                                    />
                                    <Bar dataKey="amount" fill="url(#colorGradient)" radius={[4, 4, 0, 0]} />
                                    <defs>
                                        <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#a855f7" />
                                            <stop offset="100%" stopColor="#ec4899" />
                                        </linearGradient>
                                    </defs>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-gray-500">
                                Chưa có dữ liệu
                            </div>
                        )}
                    </div>

                    {/* Source Distribution */}
                    <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                        <h3 className="text-lg font-semibold text-white mb-4">🥧 Phân bổ theo nguồn</h3>
                        {sourceChartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie
                                        data={sourceChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                                    >
                                        {sourceChartData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                        formatter={(value) => formatCurrency(value as number)}
                                    />
                                    <Legend
                                        formatter={(value) => <span style={{ color: '#9ca3af' }}>{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[250px] flex items-center justify-center text-gray-500">
                                Chưa có dữ liệu
                            </div>
                        )}
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
                    <div className="p-6 border-b border-white/10 flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-white">Lịch sử giao dịch</h2>
                        <button
                            onClick={fetchTransactions}
                            className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 text-sm hover:bg-white/20 transition"
                        >
                            🔄 Làm mới
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
                            <p className="text-gray-400 mt-4">Đang tải...</p>
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="p-12 text-center">
                            <span className="text-4xl">📭</span>
                            <p className="text-gray-400 mt-4">Chưa có giao dịch nào</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-white/5">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                            Thời gian
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                            Nguồn
                                        </th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                                            Số tiền
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {transactions.map((tx) => (
                                        <tr key={tx.id} className="hover:bg-white/5 transition">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                                {formatTime(tx.created_at)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tx.source === 'momo'
                                                        ? 'bg-pink-500/20 text-pink-400'
                                                        : 'bg-blue-500/20 text-blue-400'
                                                        }`}
                                                >
                                                    {tx.source === 'momo' ? '💳 MoMo' : '🏦 MB Bank'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-semibold text-green-400">
                                                +{formatCurrency(tx.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
