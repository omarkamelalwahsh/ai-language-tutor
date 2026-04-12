import React, { useMemo } from 'react';
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
    X
} from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';

import { useSupabaseDashboard } from '../../hooks/useSupabaseDashboard';
import { AdvancedDashboardPayload } from '../../types/dashboard';
import { AssessmentSessionResult, AssessmentOutcome } from '../../types/assessment';

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

    // Tab router
    const activeTab = useMemo(() => {
        const segments = location.pathname.split('/');
        const last = segments[segments.length - 1];
        if (['dashboard', 'home', ''].includes(last)) return 'home';
        if (['journey', 'path'].includes(last)) return 'journey';
        return last;
    }, [location.pathname]);

    const handleTabChange = (tabId: string) => {
        if (tabId === 'home') navigate('/dashboard');
        else navigate(`/dashboard/${tabId}`);
    };

    const isLoading = supabaseData.isLoading && !result;

    // 🎯 Dynamic Name Selection: Profile Data > Auth Data > Fallback
    const displayName = supabaseData?.profile?.full_name || supabaseData?.user?.fullName || 'Learner';

    if (isLoading) return <LoadingSkeleton />;

    return (
        <div className="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans overflow-hidden relative">

            {/* Auto-Sync Banner */}
            <AnimatePresence>
                {supabaseData.isSyncing && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -20 }}
                        className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-white border border-slate-200 text-slate-700 px-6 py-2 rounded-full shadow-sm font-bold text-sm flex items-center gap-2"
                    >
                        <RefreshCcw className="w-4 h-4 text-blue-500 animate-spin" /> Syncing Real-time Profile...
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 1. Sidebar */}
            <aside className="w-64 bg-[#0B1437] flex flex-col p-6 shrink-0 z-10 hidden md:flex rounded-br-3xl shadow-xl shadow-slate-200/50">
                <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer transition-transform hover:scale-105 active:scale-95" onClick={() => handleTabChange('home')}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
                        <Trophy size={20} className="text-white" fill="currentColor" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-white leading-tight tracking-tight">Career Copilot</h1>
                    </div>
                </div>

                <nav className="space-y-1.5 flex-1">
                    <NavItem icon={<Home size={18} />} label="Home" active={activeTab === 'home'} onClick={() => handleTabChange('home')} />
                    <NavItem icon={<MapIcon size={18} />} label="My Path" active={activeTab === 'journey'} onClick={() => handleTabChange('journey')} />
                    <NavItem icon={<BarChart3 size={18} />} label="Analytics" active={activeTab === 'analytics'} onClick={() => handleTabChange('analytics')} />
                    <NavItem icon={<History size={18} />} label="History" active={activeTab === 'history'} onClick={() => handleTabChange('history')} />
                    <NavItem icon={<BookOpen size={18} />} label="Practice" active={activeTab === 'practice'} onClick={() => handleTabChange('practice')} />
                </nav>

                <div className="mt-auto pt-6 border-t border-slate-700/50 space-y-1.5">
                    <NavItem icon={<Settings size={18} />} label="Settings" active={activeTab === 'settings'} onClick={() => handleTabChange('settings')} />
                    {onLogout && <NavItem icon={<LogOut size={18} />} label="Sign Out" onClick={onLogout} isDanger />}
                </div>
            </aside>

            {/* 2. Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                <header className="h-[72px] bg-[#F8FAFC]/80 backdrop-blur-md flex items-center justify-between px-8 shrink-0 relative z-20">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-400 capitalize bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
                        <span className={`transition-colors cursor-pointer hover:text-slate-700 ${activeTab === 'home' ? 'text-slate-800' : ''}`} onClick={() => handleTabChange('home')}>
                            {activeTab === 'home' ? 'Home' : 'My Path'}
                        </span>
                        {activeTab !== 'home' && (
                            <>
                                <ChevronRight size={14} className="text-slate-300" />
                                <span className="text-slate-800">{activeTab === 'journey' ? 'Learning Journey Map' : activeTab}</span>
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="relative p-2 bg-white rounded-full border border-slate-200 text-slate-400 hover:text-slate-600 transition shadow-sm hover:shadow active:scale-95">
                            <Bell size={18} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
                        </button>

                        <div className="hidden md:block text-right">
                            <p className="text-sm font-bold text-slate-900 leading-none">{displayName}</p>
                            <p className="text-[10px] text-slate-500 uppercase font-black mt-1">
                                {supabaseData.profile?.overall_level || 'Calculating...'}
                            </p>
                        </div>

                        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm hover:shadow-md transition cursor-pointer">
                            <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${displayName}&backgroundColor=transparent`} alt="Profile" className="w-full h-full object-cover" />
                        </div>

                        <button onClick={onLogout} className="p-2 ml-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100 group shadow-sm active:scale-95" title="Sign Out">
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
                            {activeTab === 'home' && <HomeTab {...props} displayName={displayName} />}
                            {activeTab === 'journey' && <JourneyTab {...props} />}
                            {activeTab === 'analytics' && <AnalyticsTab {...props} />}
                            {activeTab === 'history' && <HistoryTab {...props} />}
                            {activeTab === 'settings' && <SettingsTab {...props} />}
                            {activeTab === 'practice' && <PracticeFallback handleReturn={() => handleTabChange('home')} />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const HomeTab = ({ assessmentOutcome, onViewReview, displayName }: any) => {
    const supabaseData = useSupabaseDashboard();
    const profile = supabaseData?.profile || {};
    let rawLevel = assessmentOutcome?.finalLevel || profile.overall_level || 'A1';
    const isCalculatingLevel = rawLevel === 'Pending' || (!profile.overall_level && profile.onboardingComplete);
    const currentLevel = isCalculatingLevel ? 'Computing...' : rawLevel;
    const points = profile.points || 0;

    const skillData: SkillData[] = useMemo(() => {
        let sourceSkills = [];
        if (assessmentOutcome?.skillBreakdown) {
            sourceSkills = Object.entries(assessmentOutcome.skillBreakdown).map(([id, data]: [string, any]) => ({
                skillId: id,
                masteryScore: Math.round((data.score || 0) * 100),
            }));
        } else if (supabaseData.skills?.length > 0) {
            sourceSkills = supabaseData.skills;
        } else {
            sourceSkills = ['Speaking', 'Reading', 'Writing', 'Listening'].map(s => ({ skillId: s, masteryScore: 0 }));
        }

        return sourceSkills.map((s: any) => ({
            subject: s.skillId.charAt(0).toUpperCase() + s.skillId.slice(1).toLowerCase(),
            A: s.masteryScore || 0,
            B: Math.min(100, (s.masteryScore || 0) + 20),
            fullMark: 100
        }));
    }, [supabaseData.skills, assessmentOutcome]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-[1400px] mx-auto min-h-full">
            <div className="lg:col-span-8 flex flex-col gap-6">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between relative overflow-hidden group hover:shadow-md transition duration-300">
                    <div className="flex items-center gap-6 relative z-10">
                        <div className="w-20 h-20 rounded-[1.25rem] bg-slate-50 overflow-hidden shadow-sm border border-slate-200 shrink-0">
                            <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${displayName}&backgroundColor=transparent`} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{displayName}</h2>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Global Level</span>
                                <span className="text-[11px] font-black text-amber-700 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md">{currentLevel}</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-left sm:text-right mt-6 sm:mt-0 pt-6 sm:pt-0 border-t border-slate-100 sm:border-0 w-full sm:w-auto">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total points</p>
                        <p className="text-5xl font-black text-slate-900 tracking-tighter mb-4">{points}</p>
                        <button onClick={onViewReview} className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-indigo-600 text-white text-[11px] font-bold uppercase rounded-xl transition shadow-lg active:scale-95">
                            <History size={14} /> Review Assessment
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex-1 flex flex-col min-h-[450px]">
                    <h3 className="text-xl font-bold text-slate-900 mb-6">Mastery Distribution</h3>
                    <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={skillData}>
                                <PolarGrid stroke="#f1f5f9" strokeDasharray="4 4" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }} />
                                <Radar name="Skills" dataKey="A" stroke="#f59e0b" strokeWidth={2} fill="#f59e0b" fillOpacity={0.35} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 h-full">
                    <h3 className="text-xl font-bold text-slate-900 mb-6">Focus Areas</h3>
                    <div className="space-y-4">
                        <div className="p-4 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-sm">
                            Real-time tasks will appear here based on your level.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Helpers ---

const NavItem = ({ icon, label, active, onClick, isDanger }: any) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${active
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : isDanger
                    ? 'text-slate-400 hover:bg-rose-500/10 hover:text-rose-500'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
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