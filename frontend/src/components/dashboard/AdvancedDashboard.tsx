import React, { useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    Map as MapIcon,
    BarChart3,
    History,
    Settings,
    Trophy,
    Zap,
    LogOut,
    Brain,
    AlertCircle,
    Clock,
    CheckCircle2,
    Lock,
    RefreshCcw,
    BookOpen,
    ChevronRight,
    Bell,
    Home,
    Database,
    ArrowRight,
    TrendingUp,
    Activity,
    Mic,
    Heart,
    Target,
    Layout,
    X,
    Sparkles,
    PenTool,
    Headphones,
    LayoutDashboard,
    ShieldCheck,
    Layers,
    Calendar
} from 'lucide-react';
import { LearningJourneyView } from '../../views/LearningJourneyView';
import { 
    ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';
import { DashboardSkeleton } from './DashboardSkeleton';
import { NeuralPulseLoader } from '../common/NeuralPulseLoader';
import { VisualErrorProfile } from './VisualErrorProfile';
import { normalizeBand } from '../../lib/cefr-utils';
import ThemeToggle from '../ThemeToggle';
import { BrainMatrixCard } from '../profile/BrainMatrixCard';
import { SkillTrajectoryCard } from '../profile/SkillTrajectoryCard';
import { RoadmapGridCard } from '../profile/RoadmapGridCard';
import { ErrorProfileCard } from '../profile/ErrorProfileCard';

import { useSupabaseDashboard } from '../../hooks/useSupabaseDashboard';
import { AdvancedDashboardPayload } from '../../types/dashboard';
import { AssessmentSessionResult, AssessmentOutcome } from '../../types/assessment';
import { learnerService, DashboardData, JourneyData } from '../../services/learnerService';
import { useLearnerProfile } from '../../hooks/useLearnerProfile';

// --- Types ---
interface AdvancedDashboardProps {
    result?: AssessmentSessionResult | null;
    dashboardData: AdvancedDashboardPayload;
    assessmentOutcome?: AssessmentOutcome | null;
    onStartSession: () => void;
    onNavigateLeaderboard: () => void;
    onViewReview: () => void;
    onViewHistoryReport?: (id: string) => void;
    onLogout?: () => void;
    isArchitecting?: boolean;
}

interface SkillData {
    subject: string;
    A: number;
    B: number;
    fullMark: number;
}

// ============================================================================
// MAIN COMPONENT EXCELLENCE
// ============================================================================
export const AdvancedDashboard: React.FC<AdvancedDashboardProps> = (props) => {
    const { result, onLogout } = props;
    const supabaseData = useSupabaseDashboard();
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    // Tab router
    const activeTab = useMemo(() => {
        const segments = location.pathname.split('/');
        const last = segments[segments.length - 1];
        if (['dashboard', 'home', ''].includes(last)) return 'home';
        if (['journey', 'path'].includes(last)) return 'journey';
        return last;
    }, [location.pathname]);

    const handleTabChange = (tabId: string) => {
        if (tabId === 'practice') {
            props.onStartSession();
            return;
        }
        if (tabId === 'journey') {
            navigate('/journey');
            return;
        }
        if (tabId === 'home') navigate('/dashboard');
        else navigate(`/dashboard/${tabId}`);
    };

    const [realtimeData, setRealtimeData] = React.useState<DashboardData | null>(null);
    const [journeyData, setJourneyData] = React.useState<JourneyData | null>(null);
    const [isLearnerLoading, setIsLearnerLoading] = React.useState(true);

    const fetchAllData = React.useCallback(async () => {
        const userContext = supabaseData.user?.id;
        
        // تأكد من وجود المستخدم أولاً
        if (!userContext || String(userContext) === 'undefined') {
            return;
        }

        setIsLearnerLoading(true);
        try {
            console.log('[Dashboard] Fetching fresh data...');
            const [dash, journey] = await Promise.all([
                learnerService.getDashboard(),
                learnerService.getJourney()
            ]);
            console.log('[Dashboard] API Response received:', dash);
            setRealtimeData(dash);
            setJourneyData(journey);
        } catch (err) {
            console.error('[Dashboard] Fetch Error:', err);
        } finally {
            setIsLearnerLoading(false);
        }
    }, [supabaseData.user?.id]);

    React.useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const isLoading = (supabaseData.isLoading || isLearnerLoading) && !result;

    // --- Hybrid Recovery: Fallback KPI Calculation ---
    const calculateFallbackKPIs = React.useCallback((sData: any) => {
        const skills = sData?.skills || [];
        const profile = sData?.profile || {};
        const history = sData?.history || [];
        
        // 1. Momentum (Based on streak)
        const momentum = Math.min(100, (profile.streak || 0) * 10);
        
        // 2. Weekly Minutes (Sum of recent sessions)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const weeklyMinutes = history
            .filter((h: any) => new Date(h.createdAt || h.created_at) >= sevenDaysAgo)
            .reduce((acc: number, h: any) => acc + (h.durationMs || 0), 0) / 60000;

        // 3. Active Errors
        const activeErrors = (sData?.errorProfile?.weakness_areas || []).length;

        // 4. Due Reviews
        const dueReviews = skills.filter((s: any) => 
            (s.proficiency_confidence || s.confidence || 0) < 0.5
        ).length;

        return {
            momentum: Math.round(momentum),
            weekly_minutes: Math.round(weeklyMinutes),
            active_errors: activeErrors,
            due_reviews: dueReviews
        };
    }, []);

    const mergedDashboardData = useMemo(() => {
        if (!realtimeData) return null;
        
        const apiKPIs = realtimeData.kpis || { momentum: 0, weekly_minutes: 0, active_errors: 0, due_reviews: 0 };
        // If API returns all zeros, it might be a sync delay on live. Recover from Supabase.
        const needsRecovery = apiKPIs.momentum === 0 && apiKPIs.weekly_minutes === 0 && apiKPIs.active_errors === 0;

        if (needsRecovery && supabaseData.profile) {
            console.log('[Dashboard] Entering Hybrid Recovery Mode: Using Supabase data for KPIs');
            return {
                ...realtimeData,
                kpis: calculateFallbackKPIs(supabaseData)
            };
        }
        return realtimeData;
    }, [realtimeData, supabaseData, calculateFallbackKPIs]);

    // 🎯 Dynamic Name Selection: API Data > Profile Data > Auth Data > Fallback
    const displayName = mergedDashboardData?.profile?.full_name || realtimeData?.profile?.full_name || supabaseData?.profile?.full_name || supabaseData?.user?.fullName || 'Learner';

    console.log('User Context:', supabaseData.user?.id);

    // Remove the global blocking skeleton for a more fluid experience
    const isGlobalLoading = (supabaseData.isLoading) && !result;
    
    if (isGlobalLoading) return <NeuralPulseLoader status="Synchronizing AI Profile..." />;

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-50 font-sans overflow-hidden relative selection:bg-blue-500/30 transition-colors duration-300">
            {/* 🌌 Dynamic Atmospheric Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 dark:bg-blue-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
            </div>

            {/* Auto-Sync Banner */}
            <AnimatePresence>
                {supabaseData.isSyncing && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -20 }}
                        className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-slate-50 px-6 py-2 rounded-full shadow-sm font-bold text-sm flex items-center gap-2 transition-colors duration-300"
                    >
                        <RefreshCcw className="w-4 h-4 text-blue-500 animate-spin" /> Syncing Real-time Profile...
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* 0. Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="fixed inset-0 bg-slate-50 dark:bg-gray-950/60 backdrop-blur-sm z-[100] md:hidden transition-colors duration-300"
                    >
                        <motion.aside 
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-72 h-full bg-white dark:bg-gray-900/95 backdrop-blur-xl p-6 shadow-premium dark:shadow-md flex flex-col border-r border-slate-200 dark:border-gray-800"
                        >
                            <SidebarContent activeTab={activeTab} onTabChange={(id) => { handleTabChange(id); setIsMobileMenuOpen(false); }} onLogout={onLogout} navigate={navigate} />
                        </motion.aside>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 1. Sidebar (Desktop) */}
            <aside className="w-64 bg-white dark:bg-gray-900/40 backdrop-blur-xl flex flex-col p-6 shrink-0 z-10 hidden md:flex border-r border-slate-200 dark:border-gray-800 shadow-premium dark:shadow-md">
                <SidebarContent activeTab={activeTab} onTabChange={handleTabChange} onLogout={onLogout} navigate={navigate} />
            </aside>

            {/* 2. Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                <header className="h-[72px] bg-white dark:bg-gray-900/50 backdrop-blur-xl flex items-center justify-between px-8 shrink-0 relative z-20 border-b border-slate-200 dark:border-gray-800">
                    <div className="flex items-center gap-4">
                        {/* Mobile Menu Toggle */}
                        <button 
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="p-2 -ml-2 rounded-xl bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-800 text-slate-500 dark:text-slate-400 md:hidden hover:bg-slate-200 dark:hover:bg-gray-700 transition shadow-sm active:scale-95"
                        >
                            <Layout size={20} />
                        </button>

                        <div className="flex items-center gap-2 text-sm font-bold text-slate-400 dark:text-slate-500 capitalize bg-slate-100 dark:bg-gray-800 px-4 py-2 rounded-full border border-slate-200 dark:border-gray-800 shadow-sm">
                            <span className={`transition-colors cursor-pointer hover:text-slate-900 dark:hover:text-slate-50 ${activeTab === 'home' ? 'text-slate-900 dark:text-slate-50' : ''}`} onClick={() => handleTabChange('home')}>
                                {activeTab === 'home' ? 'Home' : 'My Path'}
                            </span>
                            {activeTab !== 'home' && (
                                <>
                                    <ChevronRight size={14} className="text-slate-300 dark:text-slate-700" />
                                    <span className="text-slate-800 dark:text-slate-200">{activeTab === 'journey' ? 'Learning Journey Map' : activeTab}</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <button className="relative p-2 bg-slate-50 dark:bg-gray-800 rounded-full border border-slate-200 dark:border-gray-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50 transition shadow-premium hover:shadow-md active:scale-95">
                            <Bell size={18} />
                            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white dark:border-gray-900"></span>
                        </button>

                        <div className="hidden md:block text-right">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-50 leading-none">{displayName}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-black mt-1">
                                {normalizeBand(supabaseData?.profile?.overall_level || 'A1')}
                            </p>
                        </div>

                        <div 
                            onClick={() => navigate('/profile')}
                            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-gray-800 overflow-hidden border-2 border-slate-200 dark:border-gray-800 shadow-sm hover:shadow-md transition cursor-pointer active:scale-95"
                        >
                            <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${displayName}&backgroundColor=transparent`} alt="Profile" className="w-full h-full object-cover" />
                        </div>

                        <button onClick={onLogout} className="p-2 ml-2 rounded-xl bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-slate-400 hover:bg-rose-500/10 dark:hover:bg-rose-500/20 hover:text-rose-600 dark:hover:text-rose-400 transition-all border border-slate-200 dark:border-gray-800 group shadow-sm active:scale-95" title="Sign Out">
                            <LogOut size={20} className="group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-12 pt-2">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="h-full"
                        >
                            {activeTab === 'home' && (
                                isLearnerLoading ? (
                                    <DashboardSkeleton />
                                ) : (
                                    <HomeTab 
                                        onStartSession={props.onStartSession} 
                                        displayName={displayName} 
                                        dashboardData={mergedDashboardData} 
                                        journeyData={journeyData}
                                        onTabChange={handleTabChange}
                                        supabaseData={supabaseData}
                                    />
                                )
                            )}
                            {activeTab === 'journey' && <JourneyTab {...props} supabaseData={supabaseData} />}
                            {activeTab === 'analytics' && (
                                <AnalyticsTab 
                                    supabaseData={supabaseData} 
                                    dashboardData={mergedDashboardData}
                                    weaknesses={supabaseData.errorProfile?.weakness_areas || []}
                                    mistakes={supabaseData.errorProfile?.common_mistakes || []}
                                    actionPlan={mergedDashboardData?.intelligence_feed?.action_plan || supabaseData.errorProfile?.action_plan || "Generating your path..."}
                                />
                            )}
                            {activeTab === 'history' && <HistoryTab {...props} supabaseData={supabaseData} />}
                            {activeTab === 'settings' && <SettingsTab {...props} supabaseData={supabaseData} refresh={fetchAllData} />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};

// ============================================================================
// SUB-COMPONENTS (PREMIUM AI-GLASS SYSTEM)
// ============================================================================

const GlassCard = ({ children, className = "", hover = true, glow = false }: any) => (
    <motion.div
        whileHover={hover ? { y: -4, scale: 1.01 } : {}}
        className={`relative bg-white dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden transition-all duration-500 shadow-premium dark:shadow-md ${glow ? 'shadow-blue-500/10' : ''} ${className}`}
    >
        {glow && <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[60px] pointer-events-none" />}
        {children}
    </motion.div>
);

const AnimatedGauge = ({ value, label, size = 80, strokeWidth = 8, color = "#3B82F6" }: any) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (value / 100) * circumference;

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="relative" style={{ width: size, height: size }}>
                <svg className="w-full h-full -rotate-90">
                    <circle 
                        cx={size / 2} cy={size / 2} r={radius}
                        stroke="rgba(203, 213, 225, 0.2)" strokeWidth={strokeWidth} fill="transparent"
                    />
                    <motion.circle 
                        cx={size / 2} cy={size / 2} r={radius}
                        stroke={color} strokeWidth={strokeWidth} fill="transparent"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-black text-slate-900 dark:text-white">{Math.round(value || 0)}%</span>
                </div>
            </div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-widest">{label}</span>
        </div>
    );
};

const JourneyPortal = ({ journeyData }: { journeyData: JourneyData | null }) => {
    const navigate = useNavigate();
    
    // Fallback if no journey nodes yet
    const nodes = journeyData?.nodes?.slice(0, 3) || [
        { type: 'lesson', title: 'Calibrating Path...', is_locked: false, status: 'active' },
        { type: 'drill', title: 'Analyzing Skills...', is_locked: true, status: 'locked' },
        { type: 'audit', title: 'Assessment Required', is_locked: true, status: 'locked' }
    ];

    const getIcon = (type: string) => {
        switch(type.toLowerCase()) {
            case 'lesson': return <Layers size={14} />;
            case 'drill': return <Zap size={14} />;
            default: return <ShieldCheck size={14} />;
        }
    };

    return (
        <GlassCard className="p-6 flex flex-col gap-4 group cursor-pointer" glow onClick={() => navigate('/journey')}>
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-widest uppercase">Journey Portal</h3>
                <Sparkles size={16} className="text-blue-500 dark:text-blue-400 animate-pulse" />
            </div>
            <div className="flex flex-col gap-3 relative before:absolute before:left-[17px] before:top-4 before:bottom-4 before:w-[1px] before:bg-slate-200 dark:before:bg-white/10">
                {nodes.map((node, i) => (
                    <div key={i} className={`flex items-start gap-4 transition-all duration-300 ${node.is_locked ? 'opacity-30 grayscale' : 'hover:translate-x-1'}`}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 z-10 border transition-colors
                            ${node.status === 'active' ? 'bg-blue-600 border-blue-400 text-white shadow-premium shadow-blue-500/20' : 'bg-slate-50 dark:bg-gray-900/50 border-slate-200 dark:border-gray-800 text-slate-400 dark:text-slate-400'}
                        `}>
                            {getIcon(node.type)}
                        </div>
                        <div className="pt-1">
                            <p className="text-[13px] font-bold text-slate-900 dark:text-white/90 leading-none mb-1">{node.title}</p>
                            <p className="text-[10px] font-black text-slate-400 dark:text-white/30 uppercase tracking-widest">
                                {node.status === 'active' ? 'Current Objective' : node.status}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </GlassCard>
    );
};

const IntelligenceFeed = ({ dashboardData }: { dashboardData: DashboardData | null }) => {
    const rawInsights = dashboardData?.intelligence_feed?.recent_insights || [];
    
    // Default fallback if no insights yet
    const insights = rawInsights.length > 0 ? rawInsights.map(ri => ({
        model: ri.category || 'Intelligence',
        text: ri.insight,
        type: 'info'
    })) : [
        { model: 'Skill Matrix', text: 'Calibrating your linguistic baseline...', type: 'info' },
        { model: 'Retention', text: 'Analyzing memory decay patterns...', type: 'info' }
    ];

    return (
        <div className="flex flex-col gap-4">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-white/40 uppercase tracking-[0.2em] px-2 mb-2">Learner Intelligence Feed</h3>
            <div className="space-y-3">
                {insights.map((insight, i) => (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.2 }}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group cursor-default shadow-sm"
                    >
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                            <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{insight.model}</span>
                        </div>
                        <p className="text-[12px] font-medium text-slate-600 dark:text-white/70 leading-relaxed group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{insight.text}</p>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

const ProfileSkillCard = ({ skill }: { skill: any }) => (
    <GlassCard className="flex flex-col gap-4 p-6" glow>
        <div className="flex justify-between items-start">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50 text-blue-600 dark:text-blue-400">
                <Target size={20} />
            </div>
            <span className={`text-[9px] uppercase font-black tracking-widest px-2.5 py-1 rounded-full border shadow-sm ${
                skill.stability === 'Stable' 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400'
            }`}>
                {skill.stability || 'Analyzing'}
            </span>
        </div>
        <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="5" className="text-slate-100 dark:text-gray-800" />
                    <motion.circle 
                        initial={{ strokeDashoffset: 176 }}
                        animate={{ strokeDashoffset: 176 - ((skill.score || 0) / 100) * 176 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        cx="32" cy="32" r="28" fill="none" stroke="#2563eb" strokeWidth="5" 
                        strokeDasharray="176" strokeLinecap="round" 
                        className="drop-shadow-[0_0_4px_rgba(37,99,235,0.2)]"
                    />
                </svg>
                <span className="absolute text-lg font-black text-slate-900 dark:text-white">{skill.score || 0}%</span>
            </div>
            <div className="min-w-0">
                <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">{skill.name}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">{skill.level || 'A1'} Proficiency</p>
            </div>
        </div>
        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-white/20">
            <span>Trend</span>
            <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <TrendingUp size={11} /> {skill.trend || 'Calibrating'}
            </span>
        </div>
    </GlassCard>
);

const ProfileErrorCard = ({ error }: { error: any }) => (
    <div className="flex items-center justify-between p-5 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all group/err shadow-premium">
        <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-xl ${
                error.severity === 'High' 
                    ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' 
                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
                <AlertCircle size={18} />
            </div>
            <div>
                <h4 className="text-slate-900 dark:text-white font-bold text-sm">{error.type}</h4>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest mt-0.5">{error.count} Occurrences</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl border shadow-sm ${
                error.status === 'Improving' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50 text-blue-600 dark:text-blue-400' 
                    : 'bg-slate-50 dark:bg-gray-800 border-slate-200 dark:border-gray-800 text-slate-400'
            }`}>
                {error.status}
            </span>
            <div className={`w-2 h-2 rounded-full ${error.severity === 'High' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`} />
        </div>
    </div>
);

const HomeTab = ({ onStartSession, displayName, dashboardData, journeyData, onTabChange, supabaseData }: any) => {
    const navigate = useNavigate();
    const { data: profileData } = useLearnerProfile();
    const kpis = dashboardData?.kpis || { momentum: 0, weekly_minutes: 0, active_errors: 0, due_reviews: 0 };
    const trends = dashboardData?.trends || [];
    const skills = dashboardData?.skills || [];
    const journey = journeyData || dashboardData?.journey || { nodes: [] };

    // 🎯 Source of Truth: Favor profileData (richer AI profile) over dashboardData fallback
    // 🎯 Source of Truth: Favor profileData (richer AI profile) over dashboardData fallback
    const matrixData = (profileData?.skill_matrix || skills || []).map((s: any) => {
        const skillName = s.name || s.skill || s.subject || '';
        const scoreVal = s.score !== undefined ? s.score : (s.masteryScore || s.currentScore || (s.current_score !== undefined ? s.current_score : 0));
        
        return {
            subject: skillName.charAt(0).toUpperCase() + skillName.slice(1),
            name: skillName.charAt(0).toUpperCase() + skillName.slice(1),
            score: scoreVal,
            A: scoreVal,
            level: s.level || s.currentLevel || s.overall_level || 'A1',
            stability: s.stability || (scoreVal > 70 ? 'Stable' : 'Fragile'),
            trend: s.trend || (scoreVal > 50 ? 'Improving' : 'Stagnant'),
            fullMark: 100
        };
    });

    // 🧠 Calculate "Skills Co-residence" - how evenly skills are growing together
    const scores = matrixData.map(m => m.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);
    const variance = scores.reduce((a, b) => a + Math.pow(b - avgScore, 2), 0) / (scores.length || 1);
    const coResidence = Math.max(0, Math.min(100, Math.round(100 - Math.sqrt(variance))));

    const errorData = (profileData?.error_model || []).map((e: any) => ({
        subject: e.type || e.subject,
        A: e.severity === 'High' ? 90 : (e.severity === 'Medium' ? 60 : 30),
        fullMark: 100
    })).concat((dashboardData?.error_profile?.weakness_areas || []).map((w: string) => ({
        subject: w,
        A: 50,
        fullMark: 100
    })));

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };
    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: { y: 0, opacity: 1 }
    };

    return (
        <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="w-full max-w-7xl mx-auto px-4 md:px-0 space-y-10 pb-40"
        >
            {/* 1. MISSION CONTROL ROADMAP (The only primary card) */}
            <motion.div variants={itemVariants}>
                {(() => {
                    const allNodes = Array.isArray(journey) ? journey : (journey.nodes || []);
                    
                    if (allNodes.length === 0) {
                        return (
                            <div className="w-full p-12 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center min-h-[400px] text-center">
                                <div className="w-20 h-20 mb-6">
                                    <NeuralPulseLoader status="Architecting Path..." />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Neural Path Calibration</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                                    Our AI Architect is synthesizing your assessment evidence to construct your optimized sequence.
                                </p>
                            </div>
                        );
                    }

                    const activeIdx = allNodes.findIndex((n: any) => n.status === 'active' || n.status === 'current');
                    const startIdx = activeIdx >= 0 ? Math.max(0, activeIdx - 1) : 0; // Show a bit of history
                    const focusedNodes = allNodes.slice(startIdx, startIdx + 4);
                    
                    // Map CEFR level to roadmap index (A1=0, A2=1, B1=2, B2=3, C1=4, C2=5)
                    const cefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
                    const userLevelStr = supabaseData?.profile?.overall_level || dashboardData?.profile?.overall_level || 'A1';
                    const levelIndex = cefrLevels.indexOf(userLevelStr);
                    const finalCurrentIndex = levelIndex >= 0 ? levelIndex : 0;
                    
                    return (
                        <RoadmapGridCard 
                            nodes={focusedNodes} 
                            onViewFullJourney={() => navigate('/journey')}
                            totalNodesCount={allNodes.length}
                            currentIndex={finalCurrentIndex}
                            skillsMatrix={matrixData}
                            dashData={dashboardData}
                        />
                    );
                })()}
            </motion.div>



            {/* 2. KPI ROW */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KPICard label="Momentum" value={`${kpis?.momentum || 0}%`} icon={<Zap size={18} />} color="text-indigo-600" bgColor="bg-indigo-50 dark:bg-indigo-500/10" />
                <KPICard label="Weekly Minutes" value={`${kpis?.weekly_minutes || 0}m`} icon={<Clock size={18} />} color="text-blue-600" bgColor="bg-blue-50 dark:bg-blue-500/10" />
                <KPICard label="Active Errors" value={`${kpis?.active_errors || 0}`} icon={<AlertCircle size={18} />} color="text-rose-600" bgColor="bg-rose-50 dark:bg-rose-500/10" />
                <KPICard label="Due Reviews" value={`${kpis?.due_reviews || 0}`} icon={<Target size={18} />} color="text-amber-600" bgColor="bg-amber-50 dark:bg-amber-500/10" />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* 3. Main Analysis Column (Left) */}
                <div className="lg:col-span-8 space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div className="min-h-[380px]"><BrainMatrixCard data={matrixData} /></div>
                        <div className="min-h-[380px]"><ErrorProfileCard data={errorData.slice(0, 6)} /></div>
                    </div>
                    
                    <div className="min-h-[320px]"><SkillTrajectoryCard data={trends} /></div>

                    {/* Skill Model Matrix from Profile */}
                    {profileData?.skill_matrix && profileData.skill_matrix.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black tracking-tight flex items-center gap-3 text-slate-900 dark:text-white">
                                    <Activity size={22} className="text-blue-600 dark:text-blue-400" /> Skill Model Matrix
                                </h2>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest italic hidden md:block">Updated Real-time</p>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {profileData.skill_matrix.map((skill: any, idx: number) => (
                                    <motion.div key={skill.name} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * idx }}>
                                        <ProfileSkillCard skill={skill} />
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error Model + Cognitive State from Profile */}
                    {profileData && (
                        <div className="grid lg:grid-cols-2 gap-8">
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Error Queue</h2>
                                    <span className="px-2 py-0.5 bg-rose-500/20 text-rose-500 dark:text-rose-400 rounded-md text-[10px] font-black uppercase">Active Friction</span>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {(profileData.error_model || []).map((err: any, idx: number) => (
                                        <motion.div key={err.type} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + idx * 0.1 }}>
                                            <ProfileErrorCard error={err} />
                                        </motion.div>
                                    ))}
                                    {(!profileData.error_model || profileData.error_model.length === 0) && (
                                        <p className="text-sm text-slate-400 dark:text-slate-500 italic">No recurring error patterns detected yet.</p>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-6">
                                <GlassCard className="p-6" hover={false}>
                                    <h3 className="text-lg font-black mb-4 flex items-center gap-3 text-slate-900 dark:text-white">
                                        <Calendar size={18} className="text-blue-600 dark:text-blue-400" /> Retention Model
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 dark:bg-white/[0.03] rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                                            <p className="text-3xl font-black mb-1 text-slate-900 dark:text-white">{profileData.cognitive_state?.retention_queue?.due_count || 0}</p>
                                            <p className="text-[9px] uppercase font-black text-slate-400 dark:text-white/30 tracking-widest">Due Today</p>
                                        </div>
                                        <div className="p-4 bg-slate-50 dark:bg-white/[0.03] rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                                            <div className="flex -space-x-2 mb-2">
                                                {(profileData.cognitive_state?.retention_queue?.high_risk || []).slice(0, 4).map((item: string, i: number) => (
                                                    <div key={item} className="w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-black border-2 border-white dark:border-gray-900 bg-blue-600 text-white shadow-sm">{item[0]}</div>
                                                ))}
                                            </div>
                                            <p className="text-[9px] uppercase font-black text-rose-500 dark:text-rose-400 tracking-widest">Fragile</p>
                                        </div>
                                    </div>
                                </GlassCard>
                            </div>
                        </div>
                    )}

                </div>

                {/* 4. Action & Intelligence Sidebar (Right) */}
                <div className="lg:col-span-4 space-y-8 sticky top-6">
                    {/* Action CTA */}
                    <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-8 text-white relative overflow-hidden shadow-sm dark:shadow-md group">
                        <div className="relative z-10">
                            <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[10px] font-black uppercase tracking-widest mb-4 inline-block">
                                Deep Practice Focus
                            </span>
                            <h3 className="text-xl font-black tracking-tighter mb-3 leading-snug">
                                {profileData?.best_next_move || dashboardData?.action_panel?.hero?.title || "Deep Practice: Concept Integration"}
                            </h3>
                            <button 
                                onClick={() => navigate('/runtime')}
                                className="w-full mt-4 px-8 py-4 bg-white text-blue-600 font-black uppercase tracking-widest text-xs rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-premium flex items-center justify-center gap-3"
                            >
                                Start Session <ArrowRight size={18} />
                            </button>
                        </div>
                        <Brain size={120} className="absolute bottom-[-30px] right-[-30px] text-white/5 -rotate-12 group-hover:rotate-0 transition-transform duration-1000" />
                    </div>

                    <GlassCard className="p-8" hover={false}>
                        <IntelligenceFeed dashboardData={dashboardData} />
                    </GlassCard>

                    <GlassCard className="p-8 bg-blue-50 dark:bg-indigo-500/5 border-blue-100 dark:border-indigo-500/10" hover={false}>
                        <h3 className="text-sm font-black text-blue-600 dark:text-indigo-400 mb-4 tracking-widest uppercase">AI Synthesis</h3>
                        <p className="text-sm text-slate-600 dark:text-white/60 leading-relaxed italic font-medium">
                            "{dashboardData?.intelligence_feed?.action_plan || "Calculating next optimal drift in your linguistic matrix..."}"
                        </p>
                    </GlassCard>
                </div>
            </div>
        </motion.div>
    );
};

// --- Custom Components for Clean Dashboard ---

const KPICard = ({ label, value, icon, color, bgColor, trend }: any) => (
    <motion.div variants={{ hidden: { opacity: 0, scale: 0.95 }, visible: { opacity: 1, scale: 1 } }}>
        <GlassCard className="p-6 md:p-8" glow>
            <div className="flex justify-between items-start mb-4">
                <div className={`p-2 rounded-xl ${bgColor} ${color} border border-slate-100 dark:border-white/5`}>
                    {icon}
                </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 dark:text-white/20 uppercase tracking-[0.2em] mb-1">{label}</p>
            <p className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter">{value}</p>
            <p className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest">{trend}</p>
        </GlassCard>
    </motion.div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-gray-900/80 backdrop-blur-xl border border-slate-200 dark:border-gray-800 p-4 rounded-2xl shadow-sm dark:shadow-md">
                <p className="text-[10px] font-black text-slate-900 dark:text-slate-50/20 uppercase tracking-widest mb-2">{label}</p>
                <div className="space-y-2">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-50 capitalize">{entry.name}:</span>
                            <span className="text-xs font-black text-slate-900 dark:text-slate-50">{entry.value}%</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

// --- Helpers ---

const SidebarContent = ({ activeTab, onTabChange, onLogout, navigate }: any) => (
    <>
        <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer transition-transform hover:scale-105 active:scale-95 group" onClick={() => onTabChange('home')}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-600 shadow-premium shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-all">
                <Trophy size={20} className="text-white" fill="currentColor" />
            </div>
            <div>
                <h1 className="text-xl font-black text-slate-900 dark:text-slate-50 leading-tight tracking-tight">Language AI</h1>
                <p className="text-[10px] font-black text-blue-600 dark:text-blue-500 uppercase tracking-widest leading-none mt-1">Linguistic Engine</p>
            </div>
        </div>

        <nav className="space-y-1.5 flex-1">
            <NavItem icon={<Home size={18} />} label="Home" active={activeTab === 'home'} onClick={() => onTabChange('home')} />

            <NavItem icon={<MapIcon size={18} />} label="My Journey" active={activeTab === 'journey'} onClick={() => onTabChange('journey')} />
            <NavItem icon={<BarChart3 size={18} />} label="Analytics" active={activeTab === 'analytics'} onClick={() => onTabChange('analytics')} />
            <NavItem icon={<History size={18} />} label="History" active={activeTab === 'history'} onClick={() => onTabChange('history')} />
            <NavItem icon={<BookOpen size={18} />} label="Practice" active={activeTab === 'practice'} onClick={() => onTabChange('practice')} />
        </nav>

        <div className="mt-auto pt-6 border-t border-white/5 space-y-1.5">
            <NavItem icon={<Settings size={18} />} label="Settings" active={activeTab === 'settings'} onClick={() => onTabChange('settings')} />
            {onLogout && <NavItem icon={<LogOut size={18} />} label="Sign Out" onClick={onLogout} isDanger />}
        </div>
    </>
);

const NavItem = ({ icon, label, active, onClick, isDanger }: any) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${active
                ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 border border-blue-100 dark:border-blue-500/30 shadow-premium dark:shadow-blue-500/10'
                : isDanger
                    ? 'text-slate-500 dark:text-slate-50/30 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400'
                    : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-slate-50'
            }`}
    >
        {icon}
        <span className="text-sm font-bold">{label}</span>
    </button>
);

const PracticeFallback = ({ handleReturn }: any) => (
    <div className="h-full flex flex-col items-center justify-center text-slate-400">
        <Zap className="w-12 h-12 mb-4 text-slate-200" />
        <h2 className="text-xl font-bold text-slate-600">Module Restructuring</h2>
        <p className="text-sm text-center max-w-xs">We're building new interactive exercises. Stay tuned!</p>
        <button onClick={handleReturn} className="mt-6 px-6 py-2 bg-blue-50 text-blue-600 font-bold rounded-lg hover:bg-blue-100 transition">Return Home</button>
    </div>
);

const LoadingSkeleton = () => (
    <div className="h-screen w-full flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
            <RefreshCcw className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-slate-400 font-bold animate-pulse">Initializing Environment...</p>
        </div>
    </div>
);
const JourneyTab = ({ onStartSession, result }: any) => {
    return (
        <div className="h-full overflow-y-auto rounded-3xl overflow-hidden border border-slate-200 shadow-sm dark:shadow-md">
            <LearningJourneyView 
                result={result} 
                onStartSession={onStartSession} 
                onViewDashboard={() => {}} // Already on dashboard
            />
        </div>
    );
};

const AnalyticsTab = ({ supabaseData }: any) => {
    const skills = supabaseData.skills || [];
    const errorProfile = supabaseData.errorProfile || { weakness_areas: [], common_mistakes: [], action_plan: "" };
    const history = supabaseData.history || [];
    const achievements = supabaseData.achievements || [];
    
    const eventLog = React.useMemo(() => {
        const historyItems = history.map((h: any) => ({
            id: `h-${h.id}`,
            title: `Assessment: ${h.overallLevel || h.category || 'General'}`,
            desc: h.overallLevel ? `Level: ${h.overallLevel}` : 'Diagnostic preview',
            time: h.createdAt || h.created_at || Date.now(),
            type: h.overallLevel?.includes('A') ? 'info' : 'success'
        }));
        return historyItems.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);
    }, [history]);

    const skillData = useMemo(() => {
        const skillOrder = ['listening', 'speaking', 'reading', 'writing', 'grammar'];
        return skillOrder.map(skillName => {
            const s = skills.find((item: any) => (item.skillId || item.skill || '').toLowerCase() === skillName);
            const raw = s ? (s.current_score !== undefined ? s.current_score : s.masteryScore) : 0;
            const currentScore = Math.round(raw < 1 && raw > 0 ? raw * 100 : raw);
            return {
                subject: skillName.charAt(0).toUpperCase() + skillName.slice(1),
                current: currentScore,
                fullMark: 100
            };
        });
    }, [skills]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-[1400px] mx-auto min-h-full">
            <div className="lg:col-span-8 flex flex-col gap-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Mastery Distribution Radar */}
                    <GlassCard className="p-8 flex flex-col" glow>
                        <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 mb-6">Mastery Distribution</h3>
                        <div className="h-[300px] w-full relative min-w-0 min-h-0 overflow-hidden">
                            <ResponsiveContainer width="100%" height="100%" debounce={50}>
                                <RadarChart 
                                    cx="50%" 
                                    cy="50%" 
                                    outerRadius="70%" 
                                    data={skillData}
                                    margin={{ top: 30, right: 30, bottom: 30, left: 30 }}
                                >
                                    <PolarGrid stroke="currentColor" className="text-slate-200 dark:text-white/10" strokeDasharray="4 4" />
                                    <PolarAngleAxis 
                                        dataKey="subject" 
                                        tick={({ payload, x, y }: any) => {
                                            const s = skills.find((i: any) => (i.skillId || i.skill || '').toLowerCase() === payload.value.toLowerCase());
                                            return (
                                                <g transform={`translate(${x},${y})`}>
                                                    <text x={0} y={0} dy={-10} textAnchor="middle" className="fill-slate-400 dark:fill-white/40 text-[9px] font-black uppercase tracking-widest">{payload.value}</text>
                                                    <text x={0} y={5} textAnchor="middle" className="fill-blue-600 dark:fill-blue-400 text-[10px] font-black">{s?.level || s?.currentLevel || 'A1'}</text>
                                                </g>
                                            );
                                        }} 
                                    />
                                    <Radar name="Mastery" dataKey="current" stroke="#3B82F6" strokeWidth={3} fill="#3B82F6" fillOpacity={0.2} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </GlassCard>

                    {/* Skill Deep Dive */}
                    <GlassCard className="p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-slate-900 dark:text-slate-50">Logic Mapping</h3>
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                <Database size={18} />
                            </div>
                        </div>
                        <div className="space-y-6">
                            {(errorProfile.weakness_areas || []).slice(0, 3).map((w: string, i: number) => (
                                <div key={i} className="group/dive">
                                    <p className="text-[14px] font-black text-slate-900 dark:text-slate-50 mb-1">{w}</p>
                                    <p className="text-[12px] font-medium text-slate-400 dark:text-slate-500 leading-relaxed">
                                        {errorProfile.common_mistakes?.[i] || "Analyzing pattern persistence..."}
                                    </p>
                                    <div className="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full mt-3 overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${80 - (i * 20)}%` }}
                                            className="h-full bg-blue-600/40 dark:bg-blue-500/50"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </GlassCard>
                </div>

                {/* Intelligence Action Plan */}
                <GlassCard className="p-8 relative overflow-hidden" glow>
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Zap size={80} className="text-blue-500" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                            <Sparkles size={18} />
                        </div>
                        Linguistic Action Plan
                    </h3>
                    <p className="text-[15px] font-medium text-slate-500 dark:text-slate-400 leading-[1.8] mb-8 max-w-2xl">
                        {errorProfile.action_plan || "Your roadmap to linguistic mastery is being sculpted by our AI Architect."}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        {(errorProfile.weakness_areas || ['Grammar Repairs', 'Speech Pacing', 'Vocab Expansion']).slice(0, 5).map((tag: string) => (
                            <span key={tag} className="px-4 py-2 bg-white dark:bg-gray-900/5 hover:bg-white dark:bg-gray-900/10 border-slate-200 dark:border-gray-800 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                {tag}
                            </span>
                        ))}
                    </div>
                </GlassCard>
            </div>

            {/* Event Log Sidebar */}
            <div className="lg:col-span-4 h-full">
                <GlassCard className="p-8 h-full">
                    <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 mb-8">Parallel Event Log</h3>
                    <div className="space-y-8 relative before:absolute before:left-[7px] before:top-4 before:bottom-4 before:w-[2px] before:bg-slate-100 dark:before:bg-white/5">
                        {eventLog.map(event => (
                            <div key={event.id} className="flex gap-6 relative z-10 group cursor-default">
                                <div className={`w-4 h-4 rounded-full border-2 border-slate-50 dark:border-[#020617] mt-1 shadow-premium transition-transform group-hover:scale-125
                                    ${event.type === 'info' ? 'bg-blue-500' : 'bg-emerald-500'}`} 
                                />
                                <div>
                                    <h4 className="text-[14px] font-bold text-slate-900 dark:text-slate-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{event.title}</h4>
                                    <p className="text-[12px] font-medium text-slate-500 dark:text-slate-500 mb-1">{event.desc}</p>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-50/20">
                                        {new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCard>
            </div>
        </div>
    );
};

const HistoryTab = ({ assessmentOutcome, onViewHistoryReport, supabaseData }: any) => {
    const history = supabaseData.history || [];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-[1400px] mx-auto min-h-full">
            <div className="lg:col-span-8 flex flex-col gap-8 h-full">
                <GlassCard className="p-8 flex-1 flex flex-col" glow>
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-black text-slate-900 dark:text-slate-50">Assessment History</h3>
                        <span className="text-[10px] font-black text-slate-900 dark:text-slate-50/30 uppercase tracking-[0.2em]">{history.length} Dimensions Logged</span>
                    </div>

                    <div className="flex-1 space-y-4 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                        {history.length > 0 ? (
                            history.map((session: any) => (
                                <div key={session.id} className="p-6 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-200 dark:hover:border-white/10 transition-all group lg:flex items-center justify-between shadow-premium">
                                    <div className="flex items-center gap-6">
                                        <div className="w-14 h-14 rounded-2xl bg-white dark:bg-gray-900/5 border-slate-200 dark:border-gray-800 flex flex-col items-center justify-center shadow-premium group-hover:border-blue-500/30 transition-colors">
                                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-50/30 uppercase leading-none mb-1">
                                                {new Date(session.createdAt).toLocaleString('default', { month: 'short' })}
                                            </span>
                                            <span className="text-xl font-black text-slate-900 dark:text-slate-50 leading-none">
                                                {new Date(session.createdAt).getDate()}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-3 mb-1">
                                                <h4 className="font-bold text-slate-900 dark:text-slate-50 text-[16px] leading-none">AI Diagnostics</h4>
                                                <span className="text-[10px] bg-blue-500/20 text-blue-400 font-black px-2 py-0.5 rounded border border-blue-500/30">
                                                    {session.overallLevel}
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                Session Entropy: {session.id.substring(0, 8)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-4 lg:mt-0 flex items-center gap-8">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-black text-slate-900 dark:text-slate-50/30 uppercase tracking-widest mb-2">Confidence Score</span>
                                            <div className="flex items-center gap-3">
                                                <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                                    <motion.div 
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${(session.confidence || 0) * 100}%` }}
                                                        className="h-full bg-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]" 
                                                    />
                                                </div>
                                                <span className="text-xs font-black text-slate-500 dark:text-slate-400">{Math.round((session.confidence || 0) * 100)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-64 flex flex-col items-center justify-center text-slate-900 dark:text-slate-50/10">
                                <History size={48} strokeWidth={1} className="mb-4 opacity-20" />
                                <p className="text-sm font-black uppercase tracking-widest">Awaiting First Execution</p>
                            </div>
                        )}
                    </div>
                </GlassCard>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-8">
                <GlassCard className="p-8 bg-gradient-to-br from-[#0B1437]/60 to-transparent" glow>
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-6">
                        <TrendingUp size={22} />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-slate-50 mb-2">Progress Velocity</h3>
                    <p className="text-slate-400 dark:text-slate-500 text-sm font-medium mb-8 leading-relaxed">Your linguistic baseline is expanding. Current trajectory predicts target reach in 1.4 months.</p>
                    <div className="p-5 rounded-2xl bg-white dark:bg-gray-900/5 hover:bg-white dark:bg-gray-900/10 border-slate-200 dark:border-gray-800">
                        <p className="text-[10px] font-black text-slate-900 dark:text-slate-50/30 uppercase tracking-widest mb-1.5">Max Proficiency Level</p>
                        <p className="text-4xl font-black text-slate-900 dark:text-slate-50">{history[0]?.overallLevel || 'B1'}</p>
                    </div>
                </GlassCard>
            </div>
        </div>
    )
}

const SettingsTab = ({ supabaseData, refresh }: any) => {
    const profile = supabaseData.profile;
    const [isSaving, setIsSaving] = React.useState(false);
    
    const [settings, setSettings] = React.useState({
        why: profile?.learningGoal || 'casual',
        what: profile?.targetLanguage || 'English',
        how: profile?.focusSkills || ['speaking', 'listening'],
        interest: profile?.learningTopics || ['general'],
        pace: profile?.sessionIntensity || 'regular'
    });

    React.useEffect(() => {
        if (profile) {
            setSettings({
                why: profile.learningGoal || 'casual',
                what: profile.targetLanguage || 'English',
                how: profile.focusSkills || [],
                interest: profile.learningTopics || [],
                pace: profile.sessionIntensity || 'regular'
            });
        }
    }, [profile]);

    const handleSave = async () => {
        setIsSaving(true);
        const userId = localStorage.getItem('auth_user_id');
        if (!userId) {
            setIsSaving(false);
            return;
        }

        try {
            const { supabase } = await import('../../lib/supabaseClient');
            const { error } = await supabase
                .from('learner_profiles')
                .update({
                    learning_goal: settings.why,
                    focus_skills: settings.how,
                    learning_topics: settings.interest,
                    session_intensity: settings.pace,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (error) throw error;
            if (refresh) refresh();
            if (supabaseData.refresh) supabaseData.refresh();
        } catch (err) {
            console.error('[Settings] Save Failed:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const SettingCard = ({ icon, label, title, subtitle, children }: { icon: any, label: string, title: string, subtitle: string, children: React.ReactNode }) => (
        <GlassCard className="p-8 flex flex-col group relative">
            <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-slate-900 dark:text-slate-50/20 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-all">
                        {icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest leading-none">{label}</span>
                            <h3 className="text-xl font-black text-slate-900 dark:text-slate-50 tracking-tight leading-none">{title}</h3>
                        </div>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2 font-medium">{subtitle}</p>
                    </div>
                </div>
            </div>
            {children}
        </GlassCard>
    );

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 pb-32">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight">Engine Parameters</h2>
                    <p className="text-slate-400 dark:text-slate-500 font-medium">Fine-tune your trajectory across 5 dimensions.</p>
                </div>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-sm dark:shadow-md
                    ${isSaving 
                        ? 'bg-white/5 text-slate-900 dark:text-slate-50/20 cursor-not-allowed' 
                        : 'bg-blue-600 text-slate-900 dark:text-slate-50 hover:bg-blue-500 shadow-blue-500/40 active:scale-95'}
                  `}
                >
                    {isSaving ? 'Synchronizing...' : 'Apply Overrides'}
                </motion.button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <SettingCard icon={<Trophy size={22} />} label="Incentive" title="Primary Goal" subtitle="What is your ultimate objective?">
                    <select 
                        value={settings.why}
                        onChange={(e) => setSettings({...settings, why: e.target.value as any})}
                        className="w-full bg-white dark:bg-gray-900/5 hover:bg-white dark:bg-gray-900/10 border-slate-200 dark:border-gray-800 rounded-xl px-4 py-4 font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition appearance-none cursor-pointer"
                    >
                        <option value="casual" className="bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-50">Casual Learner</option>
                        <option value="serious" className="bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-50">Academic Performance</option>
                        <option value="professional" className="bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-50">Professional Career</option>
                    </select>
                </SettingCard>
                
                <div className="md:col-span-2">
                    <SettingCard icon={<Clock size={22} />} label="Intensity" title="Learning Pace" subtitle="Set your weekly intensity level.">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {[
                                { id: 'light', label: 'Light', desc: '15m / day' },
                                { id: 'regular', label: 'Regular', desc: '45m / day' },
                                { id: 'intensive', label: 'Intensive', desc: '90m / day' }
                            ].map((opt: any) => (
                                <button
                                    key={opt.id}
                                    onClick={() => setSettings({...settings, pace: opt.id as any})}
                                    className={`p-6 rounded-2xl border-2 transition text-left relative overflow-hidden group/opt
                                        ${settings.pace === opt.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-white/5 hover:border-white/10'}
                                    `}
                                >
                                    <h4 className={`font-black uppercase tracking-widest text-xs mb-2 ${settings.pace === opt.id ? 'text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {opt.label}
                                    </h4>
                                    <p className="text-[11px] text-slate-900 dark:text-slate-50/30 font-bold">{opt.desc}</p>
                                    {settings.pace === opt.id && <div className="absolute top-0 right-0 p-3"><Zap size={14} className="text-blue-400" /></div>}
                                </button>
                            ))}
                        </div>
                    </SettingCard>
                </div>
            </div>
        </div>
    );
}

const IsometricHexNode = ({ status, label, onClick }: { status: 'active' | 'locked', label: any, onClick?: any, key?: any }) => {
    const isLocked = status === 'locked';
    return (
        <div 
           className={`flex flex-col items-center gap-3 w-32 group transition-all duration-300 ${isLocked ? '' : 'cursor-pointer hover:-translate-y-2'}`}
           onClick={!isLocked ? onClick : undefined}
        >
           <div className={`relative w-[6.5rem] h-[6.5rem] flex items-center justify-center`}>
               {!isLocked && <div className="absolute -bottom-4 w-12 h-3 bg-amber-900/10 rounded-full blur-md group-hover:scale-110 transition-transform" />}
               <div className="relative w-full h-full">
                  <div 
                     className={`absolute top-2 w-full h-full ${isLocked ? 'bg-slate-300' : 'bg-amber-600'} opacity-100`}
                     style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }} 
                  />
                  <div 
                     className={`absolute top-0 w-full h-full flex flex-col items-center justify-center text-slate-900 dark:text-slate-50
                       ${isLocked ? 'bg-[#1E293B]' : 'bg-gradient-to-br from-amber-400 to-amber-500 shadow-[inset_0_2px_10px_rgba(255,255,255,0.3)]'}
                     `}
                     style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}
                  >
                      <div className={`w-[96%] h-[96%] flex items-center justify-center ${isLocked ? 'bg-[#1e293b]' : 'bg-gradient-to-br from-amber-400 to-amber-500'}`} style={{ clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)" }}>
                          {isLocked ? <Lock size={20} className="text-slate-400" /> : <BookOpen size={24} className="text-slate-900 dark:text-slate-50 drop-shadow-md" />}
                      </div>
                  </div>
               </div>
           </div>
           <div className={`px-3 py-1.5 rounded-lg border shadow-sm backdrop-blur-sm
              ${isLocked ? 'bg-white/80 border-slate-200' : 'bg-white border-amber-100'}
           `}>
              <span className={`text-[10px] font-black uppercase tracking-wider text-center leading-tight
                 ${isLocked ? 'text-slate-400' : 'text-amber-600'}
              `}>
                 {label}
              </span>
           </div>
        </div>
    );
}

const EventLogItem = ({ icon, title, desc, blur }: { icon: any, title: string, desc: string, blur?: boolean }) => (
    <div className={`flex items-start gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow hover:border-slate-200 transition-all cursor-default ${blur ? 'opacity-40 grayscale blur-[0.5px]' : ''}`}>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 shrink-0">
            {icon}
        </div>
        <div className="flex-1 mt-0.5">
            <h4 className="font-bold text-slate-800 text-[13px] tracking-tight">{title}</h4>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black mt-1">{desc}</p>
        </div>
    </div>
);

export default AdvancedDashboard;


