import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import { 
  LayoutDashboard, Table as TableIcon, BarChart3, Settings, 
  ChevronDown, Download, RefreshCw, AlertCircle, Search,
  Users, BookOpen, Heart, Activity, Calendar, TrendingUp, TrendingDown, Minus, MessageSquare,
  Menu, X
} from 'lucide-react';
import { MajlisData, Month, MONTHS, FIELD_LABELS } from './types';
import { fetchSheetData } from './services/googleSheets';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function App() {
  const [selectedMonth, setSelectedMonth] = useState<Month>('Jan26');
  const [data, setData] = useState<MajlisData[]>([]);
  const [allPrevMonthsData, setAllPrevMonthsData] = useState<MajlisData[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'table'>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRatioField, setSelectedRatioField] = useState<keyof MajlisData>('generalMeetingAttendance');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [thresholds, setThresholds] = useState({
    A: 80,
    B: 70,
    C: 60,
    D: 50,
    E: 40
  });
  const [sizeThresholds, setSizeThresholds] = useState({
    small: 15,
    medium: 40
  });
  const [selectedSizeCategory, setSelectedSizeCategory] = useState<'small' | 'medium' | 'large'>('small');

  const loadData = async (month: Month) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSheetData(month);
      if (result.length === 0) {
        setError(`No data found for ${month}. Please ensure the sheet name is correct and contains data starting from row 2.`);
      }
      setData(result);

      // Fetch all previous months data for comparison starting from Jan26
      const monthIndex = MONTHS.indexOf(month);
      const prevMonths = MONTHS.slice(0, monthIndex);
      
      if (prevMonths.length > 0) {
        try {
          const results = await Promise.all(
            prevMonths.map(m => fetchSheetData(m).catch(() => []))
          );
          setAllPrevMonthsData(results.filter(r => r.length > 0));
        } catch (e) {
          console.warn('Could not fetch all previous months data', e);
          setAllPrevMonthsData([]);
        }
      } else {
        setAllPrevMonthsData([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedMonth);
  }, [selectedMonth]);

  const filteredData = useMemo(() => {
    return data.filter(item => 
      item.majlisName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  const [showAllStats, setShowAllStats] = useState(false);

  const stats = useMemo(() => {
    if (data.length === 0) return null;

    const calculateTotals = (items: MajlisData[]) => {
      const totals: Record<string, number> = {};
      // Use data[0] to determine which fields are numeric
      const referenceItem = data[0];
      if (!referenceItem) return totals;

      Object.keys(FIELD_LABELS).forEach(key => {
        const k = key as keyof MajlisData;
        if (typeof referenceItem[k] === 'number') {
          totals[key] = items.reduce((acc, curr) => acc + (curr[k] as number || 0), 0);
        }
      });
      return totals;
    };

    // Filter out invalid data (ratio > 100%) for the selected field if requested
    // The user said "Top 10 Majls should discard when percantage is greater than 100 as this data is invalid"
    // We apply this filtering to the statistics as well to ensure totals are accurate
    const validFilteredData = filteredData.filter(item => {
      const val = item[selectedRatioField] as number || 0;
      const ratio = item.tajnidMembers > 0 ? (val / item.tajnidMembers) * 100 : 0;
      return ratio <= 100;
    });

    const current = calculateTotals(validFilteredData);
    
    // Calculate average of all previous months for trend comparison
    const previousTotalsList = allPrevMonthsData.map(monthData => {
      const filteredMonthData = monthData.filter(item => 
        item.majlisName.toLowerCase().includes(searchTerm.toLowerCase())
      ).filter(item => {
        const val = item[selectedRatioField] as number || 0;
        const ratio = item.tajnidMembers > 0 ? (val / item.tajnidMembers) * 100 : 0;
        return ratio <= 100;
      });
      return calculateTotals(filteredMonthData);
    });

    const previousAverage: Record<string, number> = {};
    if (previousTotalsList.length > 0) {
      Object.keys(current).forEach(key => {
        const sum = previousTotalsList.reduce((acc, curr) => acc + (curr[key] || 0), 0);
        previousAverage[key] = sum / previousTotalsList.length;
      });
    }

    const getTrend = (currVal: number, avgVal: number | null) => {
      if (avgVal === null || avgVal === undefined) return null;
      // Use a small threshold to avoid showing trend for tiny differences
      const diff = currVal - avgVal;
      if (diff > 0.01) return 'up';
      if (diff < -0.01) return 'down';
      return 'stable';
    };

    const allStats: { id: string; label: string; value: number; trend: 'up' | 'down' | 'stable' | null }[] = Object.keys(current).map(key => ({
      id: key,
      label: FIELD_LABELS[key as keyof MajlisData],
      value: current[key],
      trend: getTrend(current[key], previousTotalsList.length > 0 ? previousAverage[key] : null)
    }));

    return allStats;
  }, [data, allPrevMonthsData, searchTerm, selectedRatioField]);

  const chartData = useMemo(() => {
    return filteredData
      .map(item => {
        const val = item[selectedRatioField] as number || 0;
        const ratio = item.tajnidMembers > 0 
          ? (val / item.tajnidMembers) * 100 
          : 0;
        return {
          name: item.majlisName,
          ratio: parseFloat(ratio.toFixed(2)),
          value: val,
          tajnid: item.tajnidMembers,
          label: FIELD_LABELS[selectedRatioField]
        };
      })
      .filter(item => item.ratio <= 100)
      .sort((a, b) => b.ratio - a.ratio);
  }, [filteredData, selectedRatioField]);

  const ratioFields = useMemo(() => {
    return Object.keys(FIELD_LABELS).filter(key => {
      const k = key as keyof MajlisData;
      return typeof data[0]?.[k] === 'number' && k !== 'tajnidMembers' && k !== 'sl';
    }) as (keyof MajlisData)[];
  }, [data]);

  const getPerformanceClass = (ratio: number, field: keyof MajlisData) => {
    const nonPerformanceFields: (keyof MajlisData)[] = ['tajnidMembers', 'saffAwwal', 'saffDom', 'totalAmelaMembers'];
    if (nonPerformanceFields.includes(field)) return null;

    if (ratio >= thresholds.A) return { label: 'Class A', color: 'bg-emerald-100 text-emerald-700' };
    if (ratio >= thresholds.B) return { label: 'Class B', color: 'bg-blue-100 text-blue-700' };
    if (ratio >= thresholds.C) return { label: 'Class C', color: 'bg-indigo-100 text-indigo-700' };
    if (ratio >= thresholds.D) return { label: 'Class D', color: 'bg-amber-100 text-amber-700' };
    if (ratio >= thresholds.E) return { label: 'Class E', color: 'bg-orange-100 text-orange-700' };
    return { label: 'Class F', color: 'bg-rose-100 text-rose-700' };
  };

  const getMajlisSize = (tajnid: number) => {
    if (tajnid <= sizeThresholds.small) return { label: 'Small', color: 'bg-slate-100 text-slate-600' };
    if (tajnid <= sizeThresholds.medium) return { label: 'Medium', color: 'bg-slate-200 text-slate-700' };
    return { label: 'Large', color: 'bg-slate-300 text-slate-800' };
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <LayoutDashboard size={18} />
          </div>
          <h1 className="font-bold text-sm">Majlis Dash</h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-50 transition-transform duration-300 lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <LayoutDashboard size={24} />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight">Majlis Dash</h1>
                <p className="text-xs text-slate-500 font-medium">Analysis 2026</p>
              </div>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 text-slate-400 hover:bg-slate-50 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-1">
            <button 
              onClick={() => {
                setView('dashboard');
                setIsSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                view === 'dashboard' ? "bg-indigo-50 text-indigo-600 font-semibold" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <BarChart3 size={20} />
              Dashboard
            </button>
            <button 
              onClick={() => {
                setView('table');
                setIsSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                view === 'table' ? "bg-indigo-50 text-indigo-600 font-semibold" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <TableIcon size={20} />
              Data Table
            </button>
          </nav>

          <div className="mt-12 flex-1 overflow-y-auto pb-6">
            <p className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Select Month</p>
            <div className="grid grid-cols-2 gap-2 px-2">
              {MONTHS.map(m => (
                <button
                  key={m}
                  onClick={() => {
                    setSelectedMonth(m);
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    "px-2 py-2 rounded-lg text-xs font-medium transition-all",
                    selectedMonth === m ? "bg-indigo-600 text-white shadow-md" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {m.replace('26', '')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-4 lg:p-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{selectedMonth} Performance</h2>
            <p className="text-slate-500">Real-time analysis of Majlis activities</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search Majlis..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-full md:w-64"
              />
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-all"
            >
              <Settings size={20} />
            </button>
            <button 
              onClick={() => loadData(selectedMonth)}
              className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-all"
            >
              <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600">
            <AlertCircle size={20} />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : stats && stats.length > 0 ? (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Summary Statistics (Total Counts)</h3>
              <button 
                onClick={() => setShowAllStats(!showAllStats)}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                {showAllStats ? 'Show Less' : `Show All (${stats.length})`}
              </button>
            </div>
            <motion.div 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
            >
              {(showAllStats ? stats : stats.slice(0, 5)).map(({ id, label, value, trend }) => (
                <StatCard 
                  key={id}
                  icon={getIconForField(id)} 
                  label={label} 
                  value={value} 
                  trend={trend}
                  color={getColorForField(id)} 
                />
              ))}
            </motion.div>
          </div>
        ) : !error && (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center mb-8">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-slate-400" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No Data Found</h3>
            <p className="text-slate-500">We couldn't find any records for {selectedMonth}. Check your Google Sheet tabs.</p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {view === 'dashboard' ? (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
                {/* Performance Ranking Chart with Size Selector */}
                <div className="grid grid-cols-1 gap-8">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <h3 className="text-lg font-bold flex items-center gap-2">
                          <BarChart3 size={20} className="text-indigo-600" />
                          Majlis Performance Ranking
                        </h3>
                        <select 
                          value={selectedSizeCategory}
                          onChange={(e) => setSelectedSizeCategory(e.target.value as any)}
                          className="text-xs font-bold bg-indigo-50 text-indigo-700 border-none rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                        >
                          <option value="small">Small (Tajnid ≤ {sizeThresholds.small})</option>
                          <option value="medium">Medium (Tajnid ≤ {sizeThresholds.medium})</option>
                          <option value="large">Large (Tajnid &gt; {sizeThresholds.medium})</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Metric:</span>
                        <select 
                          value={selectedRatioField}
                          onChange={(e) => setSelectedRatioField(e.target.value as keyof MajlisData)}
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        >
                          {ratioFields.map(field => (
                            <option key={field} value={field}>{FIELD_LABELS[field]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="h-[450px]">
                      {(() => {
                        const filteredChartData = chartData.filter(d => {
                          if (selectedSizeCategory === 'small') return d.tajnid <= sizeThresholds.small;
                          if (selectedSizeCategory === 'medium') return d.tajnid > sizeThresholds.small && d.tajnid <= sizeThresholds.medium;
                          if (selectedSizeCategory === 'large') return d.tajnid > sizeThresholds.medium;
                          return true;
                        });

                        return filteredChartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={filteredChartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} unit="%" />
                              <Tooltip 
                                formatter={(value: any, name: any, props: any) => [
                                  `${value}% (${props.payload.value} / ${props.payload.tajnid})`, 
                                  'Ratio'
                                ]}
                                contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              />
                              <Legend iconType="circle" />
                              <Bar dataKey="ratio" name={`${FIELD_LABELS[selectedRatioField]} হার (%)`} fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <AlertCircle size={32} className="mb-2 opacity-20" />
                            <p className="text-sm font-medium">No data for this category</p>
                          </div>
                        );
                      })()}
                    </div>
                    <p className="mt-4 text-xs text-slate-400 italic text-center">
                      * Ratio = ({FIELD_LABELS[selectedRatioField]} / {FIELD_LABELS.tajnidMembers}) × 100
                    </p>
                  </div>
                </div>

              {/* Summary Table Preview */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-lg font-bold">Majlis Performance Ranking by {FIELD_LABELS[selectedRatioField]} Ratio</h3>
                  <button onClick={() => setView('table')} className="text-indigo-600 font-semibold text-sm hover:underline">View All Data</button>
                </div>
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4 font-bold">Majlis Name</th>
                        <th className="px-6 py-4 font-bold">Size</th>
                        <th className="px-6 py-4 font-bold">Tajnid</th>
                        <th className="px-6 py-4 font-bold">{FIELD_LABELS[selectedRatioField]}</th>
                        <th className="px-6 py-4 font-bold">Ratio (%)</th>
                        <th className="px-6 py-4 font-bold">Performance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {chartData.map((item, idx) => {
                        const size = getMajlisSize(item.tajnid);
                        const perf = getPerformanceClass(item.ratio, selectedRatioField);
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                            <td className="px-6 py-4">
                              <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", size.color)}>
                                {size.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-600">{item.tajnid}</td>
                            <td className="px-6 py-4 text-slate-600">{item.value}</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold">
                                {item.ratio}%
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {perf && (
                                <span className={cn("px-2 py-1 rounded-lg text-[10px] font-bold uppercase", perf.color)}>
                                  {perf.label}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="table"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold">Full Data Table - {selectedMonth}</h3>
                <div className="flex gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all">
                    <Download size={16} />
                    Export CSV
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                    <tr>
                      {Object.keys(FIELD_LABELS).map((key) => (
                        <th key={key} className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap">
                          {FIELD_LABELS[key as keyof MajlisData]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors text-sm">
                        {Object.keys(FIELD_LABELS).map((key) => (
                          <td key={key} className="px-4 py-3 text-slate-600 border-b border-slate-50 whitespace-nowrap">
                            {item[key as keyof MajlisData]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Modal */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSettingsOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                      <Settings size={24} />
                    </div>
                    <h3 className="text-xl font-bold">Dashboard Settings</h3>
                  </div>
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
                
                <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
                  {/* Size Thresholds */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Majlis Size Thresholds (Tajnid)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Small (Up to)</label>
                        <input 
                          type="number" 
                          value={sizeThresholds.small}
                          onChange={(e) => setSizeThresholds({...sizeThresholds, small: parseInt(e.target.value)})}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-600">Medium (Up to)</label>
                        <input 
                          type="number" 
                          value={sizeThresholds.medium}
                          onChange={(e) => setSizeThresholds({...sizeThresholds, medium: parseInt(e.target.value)})}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Performance Thresholds */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Performance Class Thresholds (%)</h4>
                    <div className="space-y-4">
                      {Object.entries(thresholds).map(([grade, value]) => (
                        <div key={grade} className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                            grade === 'A' ? "bg-emerald-100 text-emerald-700" :
                            grade === 'B' ? "bg-blue-100 text-blue-700" :
                            grade === 'C' ? "bg-indigo-100 text-indigo-700" :
                            grade === 'D' ? "bg-amber-100 text-amber-700" :
                            "bg-orange-100 text-orange-700"
                          )}>
                            {grade}
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span className="text-xs font-medium text-slate-600">Class {grade} (Min %)</span>
                              <span className="text-xs font-bold text-indigo-600">{value}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="0" 
                              max="100" 
                              value={value}
                              onChange={(e) => setThresholds({...thresholds, [grade]: parseInt(e.target.value)})}
                              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <p className="text-xs text-indigo-700 leading-relaxed">
                      <strong>Note:</strong> Performance classes do not apply to Tajnid, Saff Awwal, Saff Dom, or Total Amela Members as these are demographic fields.
                    </p>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100">
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                  >
                    Save & Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function getIconForField(key: string) {
  if (key.includes('tajnid')) return <Users size={18} />;
  if (key.includes('Meeting')) return <Calendar size={18} />;
  if (key.includes('Quran')) return <BookOpen size={18} />;
  if (key.includes('tabligh') || key.includes('baiat')) return <MessageSquare size={18} />;
  if (key.includes('sick') || key.includes('elderly')) return <Heart size={18} />;
  return <Activity size={18} />;
}

function getColorForField(key: string) {
  if (key.includes('tajnid')) return 'indigo';
  if (key.includes('Attendance')) return 'emerald';
  if (key.includes('Meeting')) return 'amber';
  if (key.includes('Quran')) return 'violet';
  if (key.includes('baiat')) return 'rose';
  return 'slate';
}

const StatCard: React.FC<{ 
  icon: React.ReactNode, 
  label: string, 
  value: number, 
  trend?: 'up' | 'down' | 'stable' | null,
  subValue?: string,
  color: string 
}> = ({ icon, label, value, trend, subValue, color }) => {
  const colorClasses = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
    violet: "bg-violet-50 text-violet-600",
    slate: "bg-slate-50 text-slate-600",
  }[color] || "bg-slate-50 text-slate-600";

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
      <div className="flex justify-between items-start mb-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", colorClasses)}>
          {icon}
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase",
            trend === 'up' ? "bg-emerald-50 text-emerald-600" : 
            trend === 'down' ? "bg-rose-50 text-rose-600" : 
            "bg-slate-50 text-slate-400"
          )}>
            {trend === 'up' && <TrendingUp size={10} />}
            {trend === 'down' && <TrendingDown size={10} />}
            {trend === 'stable' && <Minus size={10} />}
            {trend}
          </div>
        )}
      </div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 line-clamp-1" title={label}>{label}</p>
      <div className="flex items-baseline gap-2">
        <h4 className="text-lg font-bold text-slate-900">{value.toLocaleString()}</h4>
        {subValue && <span className="text-[9px] font-medium text-slate-400">{subValue}</span>}
      </div>
      
      {/* Decorative background element */}
      <div className={cn(
        "absolute -right-2 -bottom-2 w-12 h-12 opacity-[0.03] group-hover:scale-110 transition-transform duration-500",
        colorClasses.split(' ')[1]
      )}>
        {icon}
      </div>
    </div>
  );
};
