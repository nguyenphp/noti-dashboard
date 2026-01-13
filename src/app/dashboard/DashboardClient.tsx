'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Transaction } from '@/lib/supabase';
import dynamic from 'next/dynamic';

// Dynamically import recharts to avoid SSR issues
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(mod => mod.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false });
const Legend = dynamic(() => import('recharts').then(mod => mod.Legend), { ssr: false });
const AreaChart = dynamic(() => import('recharts').then(mod => mod.AreaChart), { ssr: false });
const Area = dynamic(() => import('recharts').then(mod => mod.Area), { ssr: false });

const COLORS = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function DashboardClient() {
    const { data: session } = useSession();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]); // For week comparison
    const [loading, setLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');
    const [activeTab, setActiveTab] = useState<'overview' | 'statistics'>('overview');
    const [isMounted, setIsMounted] = useState(false);

    // Fix hydration mismatch - only render dynamic content after mount
    useEffect(() => {
        setIsMounted(true);
    }, []);

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

    // Fetch all transactions for statistics (last 14 days for week comparison)
    const fetchAllTransactions = useCallback(async () => {
        try {
            const { supabase } = await import('@/lib/supabase');
            const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .gte('created_at', twoWeeksAgo.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAllTransactions(data || []);
        } catch (error) {
            console.error('Error fetching all transactions:', error);
        }
    }, []);

    useEffect(() => {
        fetchTransactions();
        fetchAllTransactions();
        const interval = setInterval(() => {
            fetchTransactions();
            fetchAllTransactions();
        }, 10000);
        return () => clearInterval(interval);
    }, [fetchTransactions, fetchAllTransactions]);

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

    // ============ STATISTICS TAB DATA ============

    // 1. Doanh thu theo giờ (Hourly revenue)
    const hourlyChartData = useMemo(() => {
        const grouped: { [key: number]: number } = {};
        // Initialize all 24 hours
        for (let i = 0; i < 24; i++) {
            grouped[i] = 0;
        }
        allTransactions.forEach(t => {
            const hour = new Date(t.created_at).getHours();
            grouped[hour] = (grouped[hour] || 0) + t.amount;
        });
        return Object.entries(grouped)
            .map(([hour, amount]) => ({
                hour: `${hour}h`,
                hourNum: parseInt(hour),
                amount
            }))
            .sort((a, b) => a.hourNum - b.hourNum);
    }, [allTransactions]);

    // Find peak hour
    const peakHour = useMemo(() => {
        if (hourlyChartData.length === 0) return null;
        return hourlyChartData.reduce((max, curr) => curr.amount > max.amount ? curr : max, hourlyChartData[0]);
    }, [hourlyChartData]);

    // 2. So sánh tuần này vs tuần trước
    const weekComparisonData = useMemo(() => {
        const now = new Date();
        const thisWeekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const lastWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

        const result: { day: string; thisWeek: number; lastWeek: number }[] = [];

        for (let i = 0; i < 7; i++) {
            const thisWeekDay = new Date(thisWeekStart.getTime() + i * 24 * 60 * 60 * 1000);
            const lastWeekDay = new Date(lastWeekStart.getTime() + i * 24 * 60 * 60 * 1000);

            const thisWeekAmount = allTransactions
                .filter(t => {
                    const d = new Date(t.created_at);
                    return d.toDateString() === thisWeekDay.toDateString();
                })
                .reduce((sum, t) => sum + t.amount, 0);

            const lastWeekAmount = allTransactions
                .filter(t => {
                    const d = new Date(t.created_at);
                    return d.toDateString() === lastWeekDay.toDateString();
                })
                .reduce((sum, t) => sum + t.amount, 0);

            result.push({
                day: days[thisWeekDay.getDay()],
                thisWeek: thisWeekAmount,
                lastWeek: lastWeekAmount
            });
        }

        return result;
    }, [allTransactions]);

    // Week over week change
    const weekOverWeekChange = useMemo(() => {
        const thisWeekTotal = weekComparisonData.reduce((sum, d) => sum + d.thisWeek, 0);
        const lastWeekTotal = weekComparisonData.reduce((sum, d) => sum + d.lastWeek, 0);
        if (lastWeekTotal === 0) return null;
        return ((thisWeekTotal - lastWeekTotal) / lastWeekTotal * 100).toFixed(1);
    }, [weekComparisonData]);

    // 3. Phân bổ theo số tiền (Amount distribution)
    const amountDistributionData = useMemo(() => {
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

        return ranges.map(r => ({ range: r.label, count: r.count }));
    }, [allTransactions]);

    // 4. Top 5 ngày doanh thu cao nhất
    const topDaysData = useMemo(() => {
        const grouped: { [key: string]: { date: string; amount: number; count: number } } = {};

        allTransactions.forEach(t => {
            const dateStr = new Date(t.created_at).toLocaleDateString('vi-VN');
            if (!grouped[dateStr]) {
                grouped[dateStr] = { date: dateStr, amount: 0, count: 0 };
            }
            grouped[dateStr].amount += t.amount;
            grouped[dateStr].count++;
        });

        return Object.values(grouped)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);
    }, [allTransactions]);

    // 5. KPI: Average transaction
    const averageTransaction = useMemo(() => {
        if (allTransactions.length === 0) return 0;
        return Math.round(allTransactions.reduce((sum, t) => sum + t.amount, 0) / allTransactions.length);
    }, [allTransactions]);

    // Highest and lowest transaction
    const highestTransaction = useMemo(() => {
        if (allTransactions.length === 0) return 0;
        return Math.max(...allTransactions.map(t => t.amount));
    }, [allTransactions]);

    const lowestTransaction = useMemo(() => {
        if (allTransactions.length === 0) return 0;
        return Math.min(...allTransactions.map(t => t.amount));
    }, [allTransactions]);

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

            {/* Tab Navigation */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
                <div className="flex gap-2 bg-white/5 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'overview'
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        📊 Tổng quan
                    </button>
                    <button
                        onClick={() => setActiveTab('statistics')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'statistics'
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg'
                            : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }`}
                    >
                        📈 Thống kê
                    </button>
                </div>
            </div>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {!isMounted ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                    </div>
                ) : activeTab === 'overview' ? (
                    <>
                        {/* ============ TAB 1: OVERVIEW ============ */}
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
                    </>
                ) : (
                    <>
                        {/* ============ TAB 2: STATISTICS ============ */}

                        {/* KPI Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-lg rounded-2xl p-5 border border-white/10">
                                <p className="text-gray-400 text-xs mb-1">Trung bình/giao dịch</p>
                                <p className="text-2xl font-bold text-white">{formatShortCurrency(averageTransaction)}</p>
                            </div>
                            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-lg rounded-2xl p-5 border border-white/10">
                                <p className="text-gray-400 text-xs mb-1">Cao nhất</p>
                                <p className="text-2xl font-bold text-white">{formatShortCurrency(highestTransaction)}</p>
                            </div>
                            <div className="bg-gradient-to-br from-orange-500/20 to-yellow-500/20 backdrop-blur-lg rounded-2xl p-5 border border-white/10">
                                <p className="text-gray-400 text-xs mb-1">Thấp nhất</p>
                                <p className="text-2xl font-bold text-white">{formatShortCurrency(lowestTransaction)}</p>
                            </div>
                            <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-lg rounded-2xl p-5 border border-white/10">
                                <p className="text-gray-400 text-xs mb-1">Tổng giao dịch (14 ngày)</p>
                                <p className="text-2xl font-bold text-white">{allTransactions.length}</p>
                            </div>
                        </div>

                        {/* Hourly Chart & Week Comparison */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            {/* Hourly Revenue */}
                            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-white">⏰ Doanh thu theo giờ</h3>
                                    {peakHour && peakHour.amount > 0 && (
                                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
                                            🔥 Peak: {peakHour.hour}
                                        </span>
                                    )}
                                </div>
                                <ResponsiveContainer width="100%" height={250}>
                                    <AreaChart data={hourlyChartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="hour" stroke="#9ca3af" fontSize={10} />
                                        <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={formatShortCurrency} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                            labelStyle={{ color: '#fff' }}
                                            formatter={(value) => [formatCurrency(value as number), 'Doanh thu']}
                                        />
                                        <defs>
                                            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.1} />
                                            </linearGradient>
                                        </defs>
                                        <Area type="monotone" dataKey="amount" stroke="#8b5cf6" fill="url(#areaGradient)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Week Comparison */}
                            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-white">📅 Tuần này vs tuần trước</h3>
                                    {weekOverWeekChange !== null && (
                                        <span className={`text-xs px-2 py-1 rounded-full ${parseFloat(weekOverWeekChange) >= 0
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-red-500/20 text-red-400'
                                            }`}>
                                            {parseFloat(weekOverWeekChange) >= 0 ? '↑' : '↓'} {Math.abs(parseFloat(weekOverWeekChange))}%
                                        </span>
                                    )}
                                </div>
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={weekComparisonData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
                                        <YAxis stroke="#9ca3af" fontSize={10} tickFormatter={formatShortCurrency} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                            labelStyle={{ color: '#fff' }}
                                            formatter={(value, name) => [
                                                formatCurrency(value as number),
                                                name === 'thisWeek' ? 'Tuần này' : 'Tuần trước'
                                            ]}
                                        />
                                        <Legend
                                            formatter={(value) => (
                                                <span style={{ color: '#9ca3af' }}>
                                                    {value === 'thisWeek' ? 'Tuần này' : 'Tuần trước'}
                                                </span>
                                            )}
                                        />
                                        <Bar dataKey="thisWeek" fill="#10b981" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="lastWeek" fill="#6b7280" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Amount Distribution & Top Days */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Amount Distribution */}
                            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                                <h3 className="text-lg font-semibold text-white mb-4">💵 Phân bổ theo số tiền</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={amountDistributionData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                        <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                                        <YAxis type="category" dataKey="range" stroke="#9ca3af" fontSize={11} width={80} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                            labelStyle={{ color: '#fff' }}
                                            formatter={(value) => [`${value} giao dịch`, 'Số lượng']}
                                        />
                                        <Bar dataKey="count" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Top 5 Days */}
                            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
                                <h3 className="text-lg font-semibold text-white mb-4">🏆 Top 5 ngày doanh thu cao nhất</h3>
                                {topDaysData.length > 0 ? (
                                    <div className="space-y-3">
                                        {topDaysData.map((day, index) => (
                                            <div key={day.date} className="flex items-center gap-4">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${index === 0
                                                    ? 'bg-yellow-500 text-black'
                                                    : index === 1
                                                        ? 'bg-gray-400 text-black'
                                                        : index === 2
                                                            ? 'bg-orange-600 text-white'
                                                            : 'bg-white/10 text-gray-400'
                                                    }`}>
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-white font-medium">{day.date}</p>
                                                    <p className="text-gray-400 text-xs">{day.count} giao dịch</p>
                                                </div>
                                                <p className="text-green-400 font-bold">{formatCurrency(day.amount)}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-[250px] flex items-center justify-center text-gray-500">
                                        Chưa có dữ liệu
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
}
