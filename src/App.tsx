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
import { MajlisData, Month, MONTHS, FIELD_LABELS, ZaimData } from './types';
import { fetchSheetData, fetchZaimData, fetchMajlisNames, MajlisNameMap } from './services/googleSheets';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function App() {
  const [selectedMonth, setSelectedMonth] = useState<Month>(() => {
    const saved = localStorage.getItem('selectedMonth');
    return (saved as Month) || 'Jan26';
  });
  const [data, setData] = useState<MajlisData[]>([]);
  const [zaimData, setZaimData] = useState<ZaimData[]>([]);
  const [zaimError, setZaimError] = useState<string | null>(null);
  const [showZaimDebug, setShowZaimDebug] = useState(false);
  const [masterMajlisNames, setMasterMajlisNames] = useState<MajlisNameMap[]>([]);
  const [allPrevMonthsData, setAllPrevMonthsData] = useState<MajlisData[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'dashboard' | 'table'>(() => {
    return (localStorage.getItem('view') as 'dashboard' | 'table') || 'dashboard';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRatioField, setSelectedRatioField] = useState<keyof MajlisData>(() => {
    return (localStorage.getItem('selectedRatioField') as keyof MajlisData) || 'generalMeetingAttendance';
  });
  const [selectedGrade, setSelectedGrade] = useState<string | 'all'>('all');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [thresholds, setThresholds] = useState(() => {
    const saved = localStorage.getItem('thresholds');
    return saved ? JSON.parse(saved) : {
      A: 80,
      B: 70,
      C: 60,
      D: 50,
      E: 40
    };
  });
  const [sizeThresholds, setSizeThresholds] = useState({
    small: 15,
    medium: 40
  });
  const [selectedSizeCategory, setSelectedSizeCategory] = useState<'small' | 'medium' | 'large'>(() => {
    return (localStorage.getItem('selectedSizeCategory') as any) || 'small';
  });

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

  const gradeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: data.length, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 };
    data.forEach(item => {
      const val = item[selectedRatioField] as number || 0;
      const ratio = item.tajnidMembers > 0 ? (val / item.tajnidMembers) * 100 : 0;
      const perf = getPerformanceClass(ratio, selectedRatioField);
      if (perf) {
        const gradeLetter = perf.label.split(' ')[1];
        counts[gradeLetter] = (counts[gradeLetter] || 0) + 1;
      }
    });
    return counts;
  }, [data, selectedRatioField, thresholds]);

  const getMajlisSize = (tajnid: number) => {
    if (tajnid <= sizeThresholds.small) return { label: 'Small', color: 'bg-slate-100 text-slate-600' };
    if (tajnid <= sizeThresholds.medium) return { label: 'Medium', color: 'bg-slate-200 text-slate-700' };
    return { label: 'Large', color: 'bg-slate-300 text-slate-800' };
  };

  // Persist settings
  useEffect(() => localStorage.setItem('selectedMonth', selectedMonth), [selectedMonth]);
  useEffect(() => localStorage.setItem('view', view), [view]);
  useEffect(() => localStorage.setItem('selectedRatioField', selectedRatioField), [selectedRatioField]);
  useEffect(() => localStorage.setItem('selectedSizeCategory', selectedSizeCategory), [selectedSizeCategory]);
  useEffect(() => localStorage.setItem('thresholds', JSON.stringify(thresholds)), [thresholds]);

  const loadData = async (month: Month) => {
    setLoading(true);
    setError(null);
    setZaimError(null);
    try {
      const [result, zaimResult, masterNames] = await Promise.all([
        fetchSheetData(month),
        fetchZaimData().catch(err => {
          console.error('Failed to fetch Zaim data:', err);
          setZaimError(err.message || 'Unknown error');
          return [];
        }),
        fetchMajlisNames().catch(() => [])
      ]);

      console.log(`Loaded ${zaimResult.length} Zaim records. First few:`, zaimResult.slice(0, 3));

      if (result.length === 0) {
        setError(`No data found for ${month}. Please ensure the sheet name is correct and contains data starting from row 2.`);
      }
      setData(result);
      setZaimData(zaimResult);
      setMasterMajlisNames(masterNames);

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

  const exportToCSV = () => {
    if (filteredData.length === 0) return;
    
    const headers = Object.keys(FIELD_LABELS).map(key => `"${FIELD_LABELS[key as keyof MajlisData]}"`);
    const rows = filteredData.map(item => 
      Object.keys(FIELD_LABELS).map(key => {
        const val = item[key as keyof MajlisData];
        return `"${val !== undefined && val !== null ? String(val).replace(/"/g, '""') : ''}"`;
      })
    );
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Majlis_Report_${selectedMonth}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const normalizeName = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]/g, '').trim();
  };

  const findZaimInfo = (majlisName: string) => {
    const normalizedTarget = normalizeName(majlisName);
    
    // 1. Find the mapping to get both Bangla and English versions
    const mapping = masterMajlisNames.find(m => 
      normalizeName(m.bangla) === normalizedTarget || 
      normalizeName(m.english) === normalizedTarget
    );
    
    const targetBangla = mapping ? normalizeName(mapping.bangla) : normalizedTarget;
    const targetEnglish = mapping ? normalizeName(mapping.english) : normalizedTarget;

    console.log(`[Zaim Match] Target: "${majlisName}" (B: ${targetBangla}, E: ${targetEnglish})`);

    // 2. Try exact match against both versions
    let info = zaimData.find(z => {
      const zNorm = normalizeName(z.majlis);
      return zNorm === targetBangla || zNorm === targetEnglish;
    });
    if (info) return info;
    
    // 3. Try fuzzy match (contains) against both versions
    info = zaimData.find(z => {
      const zNorm = normalizeName(z.majlis);
      return zNorm.includes(targetBangla) || targetBangla.includes(zNorm) ||
             zNorm.includes(targetEnglish) || targetEnglish.includes(zNorm);
    });
    if (info) return info;

    // 4. Try word-based match
    const targetParts = majlisName.toLowerCase().split(/[\s\.]+/).filter(p => p.length > 2);
    if (targetParts.length > 0) {
      info = zaimData.find(z => {
        const zParts = z.majlis.toLowerCase().split(/[\s\.]+/);
        return targetParts.every(tp => zParts.some(zp => zp.includes(tp) || tp.includes(zp)));
      });
    }
    
    return info;
  };

  const sendWhatsAppReport = (majlisName: string, recipientType: 'zaim' | 'district' | 'region') => {
    console.log(`Attempting to send report for: ${majlisName} to ${recipientType}`);
    
    const zaimInfo = findZaimInfo(majlisName);
    const normalizedTarget = normalizeName(majlisName);
    const majlis = data.find(m => normalizeName(m.majlisName) === normalizedTarget);

    // Get mapping for this majlis to check for direct WhatsApp number
    const mapping = masterMajlisNames.find(m => 
      normalizeName(m.bangla) === normalizedTarget || 
      normalizeName(m.english) === normalizedTarget
    );

    if (!majlis) {
      alert(`Data for Majlis "${majlisName}" not found in the current month's report.`);
      return;
    }

    let phone = '';
    let recipientName = '';
    let roleTitle = '';
    
    // Prioritize mapping's info for all recipient types
    if (recipientType === 'zaim' && mapping?.whatsappNumber) {
      phone = mapping.whatsappNumber;
      recipientName = zaimInfo?.zaimName || 'Zaim';
      roleTitle = 'Zaim';
    } else if (recipientType === 'district' && mapping?.districtNazimMobile) {
      phone = mapping.districtNazimMobile;
      recipientName = mapping.districtNazimName || zaimInfo?.districtNazimName || 'District Nazim-e-Ala';
      roleTitle = 'District Nazim-e-Ala';
    } else if (recipientType === 'region' && mapping?.regionNazimMobile) {
      phone = mapping.regionNazimMobile;
      recipientName = mapping.regionNazimName || zaimInfo?.regionNazimName || 'Region Nazim-e-Ala';
      roleTitle = 'Region Nazim-e-Ala';
    } else if (zaimInfo) {
      if (recipientType === 'zaim') {
        phone = zaimInfo.zaimMobile;
        recipientName = zaimInfo.zaimName;
        roleTitle = 'Zaim';
      } else if (recipientType === 'district') {
        phone = zaimInfo.districtNazimMobile;
        recipientName = zaimInfo.districtNazimName;
        roleTitle = 'District Nazim-e-Ala';
      } else {
        phone = zaimInfo.regionNazimMobile;
        recipientName = zaimInfo.regionNazimName;
        roleTitle = 'Region Nazim-e-Ala';
      }
    }

    if (!phone) {
      const mapping = masterMajlisNames.find(m => 
        normalizeName(m.bangla) === normalizedTarget || 
        normalizeName(m.english) === normalizedTarget
      );
      const targetBangla = mapping ? normalizeName(mapping.bangla) : normalizedTarget;
      const targetEnglish = mapping ? normalizeName(mapping.english) : normalizedTarget;

      const closestMatches = zaimData
        .map(z => z.majlis)
        .filter(name => {
          const norm = normalizeName(name);
          return norm.includes(targetBangla) || targetBangla.includes(norm) ||
                 norm.includes(targetEnglish) || targetEnglish.includes(norm);
        })
        .slice(0, 3);

      const matchMsg = closestMatches.length > 0 
        ? `\n\nClosest matches found in Zaim sheet: ${closestMatches.join(', ')}`
        : `\n\nNo similar names found in the Zaim sheet. Please ensure "${majlisName}" exists in the "Zaim" sheet.`;

      alert(`Phone number for ${roleTitle || recipientType} not found for "${majlisName}".${matchMsg}`);
      return;
    }

    // Clean phone number (remove spaces, dashes, etc.)
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Bangladesh specific: if starts with 0 and is 11 digits, prepend 88
    if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
      cleanPhone = '88' + cleanPhone;
    }
    
    // Generate report message
    const val = majlis[selectedRatioField] as number || 0;
    const ratio = majlis.tajnidMembers > 0 ? (val / majlis.tajnidMembers) * 100 : 0;
    const perf = getPerformanceClass(ratio, selectedRatioField);

    // Include key metrics in the message
    const keyMetrics = [
      `*${FIELD_LABELS.tajnidMembers}:* ${majlis.tajnidMembers}`,
      `*${FIELD_LABELS.amelaMeeting}:* ${majlis.amelaMeeting}`,
      `*${FIELD_LABELS.generalMeeting}:* ${majlis.generalMeeting}`,
      `*${FIELD_LABELS.generalMeetingAttendance}:* ${majlis.generalMeetingAttendance}`,
      `*${FIELD_LABELS.fiveTimePrayers}:* ${majlis.fiveTimePrayers}`,
      `*${FIELD_LABELS.congregationalPrayers}:* ${majlis.congregationalPrayers}`,
      `*${FIELD_LABELS.mtaConnection}:* ${majlis.mtaConnection}`,
    ].join('\n');

    const message = `*Majlis Report - ${selectedMonth}*\n` +
      `*Majlis:* ${majlisName}\n` +
      `*District:* ${mapping?.district || zaimInfo?.district || 'N/A'}\n\n` +
      `*Performance Summary:* \n` +
      `*Metric:* ${FIELD_LABELS[selectedRatioField]}\n` +
      `*Value:* ${val} / ${majlis.tajnidMembers}\n` +
      `*Ratio:* ${ratio.toFixed(2)}%\n` +
      `*Grade:* ${perf?.label || 'N/A'}\n\n` +
      `*Detailed Data:* \n${keyMetrics}\n\n` +
      `Assalamu Alaikum ${recipientName},\n` +
      `Here is the monthly report for Majlis ${majlisName}. Please review.`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    
    console.log(`Opening WhatsApp for ${majlisName} (${recipientType}): ${whatsappUrl}`);
    const newWindow = window.open(whatsappUrl, '_blank');
    if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
      console.warn('Popup blocked, using location.href fallback');
      window.location.href = whatsappUrl;
    }
  };

  useEffect(() => {
    loadData(selectedMonth);
  }, [selectedMonth]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = item.majlisName.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      
      if (selectedGrade !== 'all') {
        const val = item[selectedRatioField] as number || 0;
        const ratio = item.tajnidMembers > 0 ? (val / item.tajnidMembers) * 100 : 0;
        const perf = getPerformanceClass(ratio, selectedRatioField);
        if (!perf) return false;
        return perf.label === `Class ${selectedGrade}`;
      }
      
      return true;
    });
  }, [data, searchTerm, selectedGrade, selectedRatioField, thresholds]);

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

    // Calculate totals for current month (filtered by search only)
    const current = calculateTotals(filteredData);
    
    // Calculate average of all previous months for trend comparison
    const previousTotalsList = allPrevMonthsData.map(monthData => {
      const filteredMonthData = monthData.filter(item => 
        item.majlisName.toLowerCase().includes(searchTerm.toLowerCase())
      );
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
      if (diff > 0.1) return 'up';
      if (diff < -0.1) return 'down';
      return 'stable';
    };

    const allStats: { id: string; label: string; value: number; trend: 'up' | 'down' | 'stable' | null }[] = Object.keys(current).map(key => ({
      id: key,
      label: FIELD_LABELS[key as keyof MajlisData],
      value: current[key],
      trend: getTrend(current[key], previousTotalsList.length > 0 ? previousAverage[key] : null)
    }));

    return allStats;
  }, [data, allPrevMonthsData, searchTerm]);

  const missingReportsInfo = useMemo(() => {
    if (masterMajlisNames.length === 0) return [];
    
    const submittedDataMap = new Map<string, MajlisData>(
      data.map(m => [normalizeName(m.majlisName), m])
    );

    return masterMajlisNames
      .map(mapping => {
        const name = mapping.bangla;
        const normalized = normalizeName(name);
        const submission = submittedDataMap.get(normalized);
        // A report is missing if it's not in the sheet OR if Tajnid is 0
        const isMissing = !submission || submission.tajnidMembers === 0;
        return {
          name,
          isMissing,
          status: !submission ? 'Not in sheet' : 'Blank Tajnid'
        };
      })
      .filter(item => item.isMissing)
      .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b));
  }, [masterMajlisNames, data, searchTerm]);

  const sendReminder = (majlisName: string) => {
    const zaimInfo = findZaimInfo(majlisName);
    const normalizedTarget = normalizeName(majlisName);

    // Get mapping for this majlis to check for direct WhatsApp number
    const mapping = masterMajlisNames.find(m => 
      normalizeName(m.bangla) === normalizedTarget || 
      normalizeName(m.english) === normalizedTarget
    );

    // Prioritize mapping's whatsappNumber
    let phone = mapping?.whatsappNumber || zaimInfo?.zaimMobile;

    if (!phone) {
      const targetBangla = mapping ? normalizeName(mapping.bangla) : normalizedTarget;
      const targetEnglish = mapping ? normalizeName(mapping.english) : normalizedTarget;

      const closestMatches = zaimData
        .map(z => z.majlis)
        .filter(name => {
          const norm = normalizeName(name);
          return norm.includes(targetBangla) || targetBangla.includes(norm) ||
                 norm.includes(targetEnglish) || targetEnglish.includes(norm);
        })
        .slice(0, 3);

      const matchMsg = closestMatches.length > 0 
        ? `\n\nClosest matches found in Zaim sheet: ${closestMatches.join(', ')}`
        : `\n\nNo similar names found in the Zaim sheet. Please ensure "${majlisName}" exists in the "Zaim" sheet.`;

      alert(`Contact info for Zaim of "${majlisName}" not found.${matchMsg}`);
      return;
    }

    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0') && formattedPhone.length === 11) {
      formattedPhone = '88' + formattedPhone;
    }

    const message = `*Reminder: Monthly Report - ${selectedMonth}*\n\n` +
      `আসসালামু আলাইকুম\n` +
      `জনাব যয়িম(আলা), \n` +
      `${majlisName} মজলিস\n\n` +
      `*${majlisName} মজলিস*-এর ${selectedMonth} মাসিক প্রতিবেদনটি এখনও পাওয়া যায়নি`;

    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

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

  const needsAttentionInfo = useMemo(() => {
    return chartData
      .filter(item => item.ratio < thresholds.C)
      .sort((a, b) => a.ratio - b.ratio);
  }, [chartData, thresholds.C]);

  const topPerformersInfo = useMemo(() => {
    return chartData
      .filter(item => item.ratio >= thresholds.B)
      .sort((a, b) => b.ratio - a.ratio);
  }, [chartData, thresholds.B]);

  const ratioFields = useMemo(() => {
    return Object.keys(FIELD_LABELS).filter(key => {
      const k = key as keyof MajlisData;
      return typeof data[0]?.[k] === 'number' && k !== 'tajnidMembers' && k !== 'sl';
    }) as (keyof MajlisData)[];
  }, [data]);

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

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Grade:</span>
              <div className="flex gap-1">
                {['all', 'A', 'B', 'C', 'D', 'E', 'F'].map(grade => (
                  <button
                    key={grade}
                    onClick={() => setSelectedGrade(grade)}
                    className={cn(
                      "px-2 h-6 rounded-md text-[10px] font-bold transition-all flex items-center gap-1",
                      selectedGrade === grade 
                        ? "bg-indigo-600 text-white shadow-sm" 
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    )}
                  >
                    <span>{grade === 'all' ? 'All' : grade}</span>
                    <span className={cn(
                      "text-[8px] opacity-60 px-1 rounded-full",
                      selectedGrade === grade ? "bg-white/20" : "bg-slate-200"
                    )}>
                      {gradeCounts[grade] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>
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
              onClick={exportToCSV}
              className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-all flex items-center gap-2 px-3"
              title="Export to CSV"
            >
              <Download size={18} />
              <span className="text-xs font-bold hidden sm:inline">Export</span>
            </button>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-8 h-8 bg-slate-100 rounded-lg animate-pulse" />
                  <div className="w-12 h-4 bg-slate-100 rounded animate-pulse" />
                </div>
                <div className="w-24 h-2 bg-slate-100 rounded mb-2 animate-pulse" />
                <div className="w-16 h-6 bg-slate-100 rounded animate-pulse" />
              </div>
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Top Performers */}
                    {topPerformersInfo.length > 0 && (
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <TrendingUp size={16} className="text-emerald-500" />
                          Top Performers ({topPerformersInfo.length})
                        </h3>
                        <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          <div className="space-y-2">
                            {topPerformersInfo.map((item, idx) => {
                              const perf = getPerformanceClass(item.ratio, selectedRatioField);
                              return (
                                <div key={idx} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                  <div>
                                    <p className="text-[11px] font-bold text-slate-900">{item.name}</p>
                                    <div className="flex items-center gap-2">
                                      <p className="text-[10px] text-slate-500">{item.value} / {item.tajnid}</p>
                                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase", perf?.color)}>
                                        {perf?.label}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <p className="text-sm font-bold text-emerald-600">{item.ratio}%</p>
                                      <p className="text-[9px] font-bold text-emerald-500 uppercase">Rank #{idx + 1}</p>
                                    </div>
                                    <button 
                                      onClick={() => sendWhatsAppReport(item.name, 'zaim')}
                                      className="p-2 bg-white text-emerald-600 rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-colors shadow-sm"
                                      title="Send Report to Zaim"
                                    >
                                      <MessageSquare size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Needs Attention */}
                    {needsAttentionInfo.length > 0 && (
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <TrendingDown size={16} className="text-rose-500" />
                          Needs Attention ({needsAttentionInfo.length})
                        </h3>
                        <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          <div className="space-y-2">
                            {needsAttentionInfo.map((item, idx) => {
                              const perf = getPerformanceClass(item.ratio, selectedRatioField);
                              return (
                                <div key={idx} className="flex items-center justify-between p-3 bg-rose-50/50 rounded-xl border border-rose-100">
                                  <div>
                                    <p className="text-[11px] font-bold text-slate-900">{item.name}</p>
                                    <div className="flex items-center gap-2">
                                      <p className="text-[10px] text-slate-500">{item.value} / {item.tajnid}</p>
                                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase", perf?.color)}>
                                        {perf?.label}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-right">
                                      <p className="text-sm font-bold text-rose-600">{item.ratio}%</p>
                                    </div>
                                    <button 
                                      onClick={() => sendWhatsAppReport(item.name, 'zaim')}
                                      className="p-2 bg-white text-rose-600 rounded-lg border border-rose-200 hover:bg-rose-50 transition-colors shadow-sm"
                                      title="Send Report to Zaim"
                                    >
                                      <MessageSquare size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-8">

                    {/* Contact Data Status */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <Users size={16} className="text-indigo-500" />
                          Contact Data
                        </h3>
                        <div className="flex items-center gap-2">
                          {zaimData.length > 0 && (
                            <button 
                              onClick={() => setShowZaimDebug(!showZaimDebug)}
                              className="text-[10px] text-indigo-600 hover:underline font-bold uppercase"
                            >
                              {showZaimDebug ? 'Hide' : 'View'}
                            </button>
                          )}
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                            zaimData.length > 0 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                          )}>
                            {zaimData.length > 0 ? `${zaimData.length} Loaded` : 'Not Loaded'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        WhatsApp buttons require data from the <strong>"Zaim"</strong> sheet to function. 
                        {zaimData.length === 0 && !zaimError && " Please ensure the sheet name is exactly 'Zaim' and contains data."}
                        {zaimError && (
                          <span className="block mt-1 text-rose-500 font-medium">
                            Error: {zaimError}
                          </span>
                        )}
                      </p>

                      {showZaimDebug && zaimData.length > 0 && (
                        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Loaded Majlis Names:</p>
                          <div className="grid grid-cols-1 gap-1">
                            {zaimData.slice(0, 50).map((z, i) => (
                              <div key={i} className="text-[10px] text-slate-600 flex justify-between border-b border-slate-100 pb-1">
                                <span>{z.majlis}</span>
                                <span className="text-slate-400">{z.zaimMobile ? '✓' : '✗'}</span>
                              </div>
                            ))}
                            {zaimData.length > 50 && <p className="text-[10px] text-slate-400 mt-1">...and {zaimData.length - 50} more</p>}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Missing Reports */}
                    {missingReportsInfo.length > 0 && (
                      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <AlertCircle size={16} className="text-amber-500" />
                          Missing Reports ({missingReportsInfo.length})
                        </h3>
                        <div className="max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          <div className="space-y-2">
                            {missingReportsInfo.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                                <div>
                                  <p className="text-[11px] font-bold text-slate-900">{item.name}</p>
                                  <span className={cn(
                                    "text-[9px] font-bold uppercase",
                                    item.status === 'Blank Tajnid' ? "text-rose-600" : "text-amber-600"
                                  )}>
                                    {item.status === 'Blank Tajnid' ? 'Blank Data' : 'Not Submitted'}
                                  </span>
                                </div>
                                <button 
                                  onClick={() => sendReminder(item.name)}
                                  className="p-2 bg-white text-amber-600 rounded-lg border border-amber-200 hover:bg-amber-50 transition-colors shadow-sm"
                                  title="Send Reminder to Zaim"
                                >
                                  <MessageSquare size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
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
                    <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                      <tr>
                        <th className="px-6 py-4 font-bold sticky top-0 bg-slate-50 z-10">Actions</th>
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
                            <td className="px-6 py-4">
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => sendWhatsAppReport(item.name, 'zaim')}
                                  className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"
                                  title="Send to Zaim"
                                >
                                  <MessageSquare size={14} />
                                </button>
                                <button 
                                  onClick={() => sendWhatsAppReport(item.name, 'district')}
                                  className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                  title="Send to District Nazim"
                                >
                                  <MessageSquare size={14} />
                                </button>
                                <button 
                                  onClick={() => sendWhatsAppReport(item.name, 'region')}
                                  className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                                  title="Send to Region Nazim"
                                >
                                  <MessageSquare size={14} />
                                </button>
                              </div>
                            </td>
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
                  <thead className="sticky top-0 bg-slate-50 z-20 shadow-sm">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 sticky top-0 left-0 bg-slate-50 z-40 w-[140px] min-w-[140px]">
                        Actions
                      </th>
                      {Object.keys(FIELD_LABELS).map((key) => {
                        const isSL = key === 'sl';
                        const isMajlis = key === 'majlisName';
                        return (
                          <th 
                            key={key} 
                            className={cn(
                              "px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap",
                              isSL && "sticky top-0 left-[140px] bg-slate-50 z-40 w-[80px] min-w-[80px]",
                              isMajlis && "sticky top-0 left-[220px] bg-slate-50 z-40 w-[220px] min-w-[220px]",
                              !isSL && !isMajlis && "z-10"
                            )}
                          >
                            {FIELD_LABELS[key as keyof MajlisData]}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors text-sm">
                        <td className="px-4 py-3 text-slate-600 border-b border-slate-50 sticky left-0 bg-white z-20 w-[140px] min-w-[140px]">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => sendWhatsAppReport(item.majlisName, 'zaim')}
                              className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors"
                              title="Send to Zaim"
                            >
                              <MessageSquare size={14} />
                            </button>
                            <button 
                              onClick={() => sendWhatsAppReport(item.majlisName, 'district')}
                              className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                              title="Send to District Nazim"
                            >
                              <MessageSquare size={14} />
                            </button>
                            <button 
                              onClick={() => sendWhatsAppReport(item.majlisName, 'region')}
                              className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
                              title="Send to Region Nazim"
                            >
                              <MessageSquare size={14} />
                            </button>
                          </div>
                        </td>
                        {Object.keys(FIELD_LABELS).map((key) => {
                          const isSL = key === 'sl';
                          const isMajlis = key === 'majlisName';
                          return (
                            <td 
                              key={key} 
                              className={cn(
                                "px-4 py-3 text-slate-600 border-b border-slate-50 whitespace-nowrap",
                                isSL && "sticky left-[140px] bg-white z-20 w-[80px] min-w-[80px]",
                                isMajlis && "sticky left-[220px] bg-white z-20 w-[220px] min-w-[220px]"
                              )}
                            >
                              {item[key as keyof MajlisData]}
                            </td>
                          );
                        })}
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
          <div 
            title={`Compared to average of previous months (Jan'26 to last month)`}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase cursor-help",
              trend === 'up' ? "bg-emerald-50 text-emerald-600" : 
              trend === 'down' ? "bg-rose-50 text-rose-600" : 
              "bg-slate-50 text-slate-400"
            )}
          >
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
