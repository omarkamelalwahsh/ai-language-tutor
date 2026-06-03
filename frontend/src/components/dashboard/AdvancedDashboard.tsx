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
    Award,
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
import { requestNotificationPermission } from '../../lib/notifications';
import { learnerService, DashboardData, JourneyData } from '../../services/learnerService';
import { useLearnerProfile } from '../../hooks/useLearnerProfile';
import { AnimatedFlame } from './AnimatedFlame';
import { LiquidProgressBar } from './LiquidProgressBar';
import { Sidebar, SidebarContent } from './Sidebar';
import { SkillCard } from './SkillCard';
import { DailyMicroLearning } from './DailyMicroLearning';
import { ErrorAnalysisModal, ErrorItem } from './ErrorAnalysisModal';

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

const handleSpeak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
};


interface SkillData {
    subject: string;
    A: number;
    B: number;
    fullMark: number;
}

// ============================================================================
// SHARED COMPONENTS
// ============================================================================
const ConnectedSkillCard = ({ skillId, name, icon, desc }: any) => {
    const navigate = useNavigate();
    const [tasks, setTasks] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        learnerService.getPracticeTasks(skillId)
            .then(data => {
                setTasks(data.tasks || []);
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load tasks for', skillId, err);
                setLoading(false);
            });
    }, [skillId]);

    const handleStartTask = async (taskId: string, difficulty: string) => {
        try {
            const res = await learnerService.startPracticeSession(skillId, taskId, difficulty);
            navigate(`/runtime?session_id=${res.session_id}&skill=${skillId}&task=${taskId}`);
        } catch (err) {
            console.error('Failed to start session', err);
            navigate(`/runtime?skill=${skillId}&task=${taskId}`);
        }
    };

    if (loading) {
        return <div className="h-96 rounded-2xl bg-slate-100 dark:bg-slate-800/50 animate-pulse border border-slate-200 dark:border-slate-800" />;
    }

    return (
        <SkillCard
            skillName={name}
            description={desc}
            icon={icon}
            tasks={tasks.length > 0 ? tasks : [{ id: 'general', title: 'General Practice', badge: 'New' }]}
            onStartTask={handleStartTask}
        />
    );
};

const DailyRoadmapNode = ({ idx, title, subtitle, icon, content, color, align = 'left' }: any) => {
    const isRight = align === 'right';
    const isPlaceholder = !content;

    return (
        <motion.div 
            initial={{ opacity: 0, x: isRight ? 50 : -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className={`flex items-center gap-12 ${isRight ? 'flex-row-reverse' : 'flex-row'}`}
        >
            {/* The Node Hexagon */}
            <div className="shrink-0 relative">
                <div className={`absolute inset-0 bg-${color}-500/20 blur-[30px] rounded-full animate-pulse`} />
                <div className={`
                    w-24 h-24 rounded-[2rem] bg-slate-900 border-2 border-${color}-500/50 flex flex-col items-center justify-center relative z-10 shadow-2xl
                `}>
                    <div className={`text-${color}-400 mb-1`}>{icon}</div>
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Step 0{idx + 1}</span>
                </div>
            </div>

            {/* The Content Card */}
            <GlassCard className="flex-1 p-8 border-l-4" style={{ borderLeftColor: `var(--${color}-500)` }} glow>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <span className={`text-[10px] font-black uppercase tracking-widest text-${color}-400 mb-1 block`}>{subtitle}</span>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{title}</h3>
                    </div>
                </div>
                
                <div className="bg-slate-50 dark:bg-white/[0.03] rounded-2xl p-6 border border-slate-200 dark:border-white/5">
                    {/* Dynamic Content based on node type */}
                    {isPlaceholder ? (
                        <div className="space-y-3 animate-pulse">
                            <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-3/4" />
                            <div className="h-4 bg-slate-200 dark:bg-white/10 rounded w-1/2" />
                        </div>
                    ) : (
                        <>
                            {idx === 0 && (
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-6">
                                        {content.steps?.map((s: any, i: number) => (
                                            <div key={i} className="flex flex-col">
                                                <span className="text-[9px] font-black text-slate-500 uppercase mb-1">{s.level}</span>
                                                <span className={`text-xl font-black ${i === 2 ? 'text-blue-400' : 'text-slate-400'}`}>{s.word}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-sm text-slate-400 italic leading-relaxed border-t border-white/5 pt-4">"{content.context_note}"</p>
                                </div>
                            )}
                            {idx === 1 && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/10">
                                            <p className="text-[10px] font-black text-rose-400 uppercase mb-2">Pattern Detected</p>
                                            <p className="text-sm font-bold text-slate-300">"{content.incorrect}"</p>
                                        </div>
                                        <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                            <p className="text-[10px] font-black text-emerald-400 uppercase mb-2">Neural Correction</p>
                                            <p className="text-sm font-bold text-slate-300">"{content.correct}"</p>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium pl-2 border-l-2 border-rose-500/30">{content.rule}</p>
                                </div>
                            )}
                            {idx >= 2 && (
                                <div className="space-y-4">
                                    <p className="text-sm text-slate-300 font-bold leading-relaxed">{content.focus || content.topic}</p>
                                    <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 italic text-xs text-slate-400">
                                        {content.advanced_c1_academic || content.example || content.rule}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

            </GlassCard>
        </motion.div>
    );
};

const PracticeHub = () => {
    const skills = [
        { id: 'listening', name: 'Listening', icon: <Headphones size={28} />, color: 'blue', desc: 'Improve auditory precision' },
        { id: 'reading', name: 'Reading', icon: <BookOpen size={28} />, color: 'emerald', desc: 'Master technical text' },
        { id: 'writing', name: 'Writing', icon: <PenTool size={28} />, color: 'purple', desc: 'Perfect your technical prose' },
        { id: 'speaking', name: 'Speaking', icon: <Mic size={28} />, color: 'orange', desc: 'Communicate with confidence' },
    ];

    return (
        <div className="w-full max-w-7xl mx-auto py-10 px-4">
            <div className="mb-12">
                <h2 className="text-4xl font-black text-slate-900 dark:text-slate-50 tracking-tight flex items-center gap-4">
                    <Zap className="text-blue-500" /> Skill Training Hub
                </h2>
                <p className="text-slate-400 dark:text-slate-500 font-medium text-lg mt-2">Select a cognitive dimension to focus your practice using the Neural Pedagogical Engine.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {skills.map((skill) => (
                    <ConnectedSkillCard 
                        key={skill.id}
                        skillId={skill.id}
                        name={skill.name}
                        icon={skill.icon}
                        desc={skill.desc}
                    />
                ))}
            </div>
        </div>
    );
};

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
};

const LevelProgress = ({ current_xp, required_xp, level, is_gateway_unlocked, total_xp = 0, streak = 0 }: any) => {
    const percentage = Math.min(100, (current_xp / required_xp) * 100);
    
    // Determine target level
    const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const currentIdx = CEFR_LEVELS.indexOf(level.toUpperCase());
    const targetLevel = currentIdx >= 0 && currentIdx < CEFR_LEVELS.length - 1 
        ? CEFR_LEVELS[currentIdx + 1] 
        : 'MAX';

    return (
        <div className="mb-10 w-full relative">
            {is_gateway_unlocked && (
                <div className="absolute -top-4 right-8 z-20">
                     <motion.div 
                        animate={{ scale: [1, 1.1, 1], rotate: [0, 2, -2, 0] }} 
                        transition={{ repeat: Infinity, duration: 3 }}
                        className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[10px] font-black uppercase rounded-full shadow-xl flex items-center gap-2 border border-white/20"
                     >
                        <Award size={14} className="animate-bounce" /> Gateway Exam Ready
                     </motion.div>
                </div>
            )}
            <LiquidProgressBar 
                progress={percentage} 
                levelTitle={level} 
                targetLevel={targetLevel} 
                xpPoints={total_xp || current_xp} 
                streak={streak}
            />
        </div>
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

const GlassCard = ({ children, className = "", hover = true, glow = false, onClick }: any) => (
    <motion.div
        whileHover={hover ? { y: -4, scale: 1.01 } : {}}
        onClick={onClick}
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
    const nodes = journeyData?.nodes?.slice(0, 3) || [];

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
    })) : [];

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
    <GlassCard className="flex flex-col gap-3 p-4 sm:p-6" glow>
        <div className="flex justify-between items-start mb-1">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/50 text-blue-600 dark:text-blue-400">
                <Target size={16} />
            </div>
            <span className={`text-[8px] sm:text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full border shadow-sm ${
                skill.stability === 'Stable' 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                    : 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-600 dark:text-amber-400'
            }`}>
                {skill.stability || 'Analyzing'}
            </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                    <circle cx="50%" cy="50%" r="40%" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-100 dark:text-gray-800" />
                    <motion.circle 
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: (skill.score || 0) / 100 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        cx="50%" cy="50%" r="40%" fill="none" stroke="#2563eb" strokeWidth="4" 
                        strokeLinecap="round" 
                        className="drop-shadow-[0_0_4px_rgba(37,99,235,0.2)]"
                    />
                </svg>
                <span className="absolute text-xs sm:text-lg font-black text-slate-900 dark:text-white">{skill.score || 0}%</span>
            </div>
            <div className="min-w-0">
                <h3 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight">{skill.name}</h3>
                <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium">{skill.level || 'A1'} Proficiency</p>
            </div>
        </div>
        <div className="flex items-center justify-between text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-white/20 mt-1">
            <span>Trend</span>
            <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <TrendingUp size={10} /> {skill.trend || '—'}
            </span>
        </div>
    </GlassCard>
);

const ProfileErrorCard = ({ error, onSelect }: { error: any, onSelect: (err: any) => void }) => (
    <motion.button 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelect(error)}
        className="w-full flex items-center justify-between p-5 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 rounded-2xl hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all group/err shadow-premium text-left"
    >
        <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-xl ${
                error.severity === 'High' 
                    ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' 
                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
            }`}>
                <AlertCircle size={18} />
            </div>
            <div>
                <h4 className="text-slate-900 dark:text-white font-bold text-sm">{error.subject || error.type}</h4>
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
    </motion.button>
);



const HomeTab = ({ onStartSession, displayName, dashboardData, journeyData, onTabChange, supabaseData, dailyBites, onInteraction }: any) => {
    const navigate = useNavigate();
    const { data: profileData, refresh: refreshProfile } = useLearnerProfile();
    const [selectedError, setSelectedError] = React.useState<ErrorItem | null>(null);
    const [weeklyVocab, setWeeklyVocab] = React.useState<any>(null);
    const [nextWordIn, setNextWordIn] = React.useState<string>('');

    React.useEffect(() => {
        const fetchWeekly = async () => {
            try {
                // Fetch weekly vocab (source of truth for words)
                const weeklyData = await learnerService.getWeeklyVocab();
                setWeeklyVocab(weeklyData);
                if (weeklyData?.next_word_in) setNextWordIn(weeklyData.next_word_in);
            } catch (err) {
                console.error("Failed to load weekly vocab", err);
            }
        };
        fetchWeekly();
    }, []);


    // Live countdown timer (updates every 60s)

    React.useEffect(() => {
        const updateTimer = () => {
            const now = new Date();
            const nextMidnight = new Date();
            nextMidnight.setHours(24, 0, 0, 0);
            const diff = nextMidnight.getTime() - now.getTime();
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((diff / 1000 / 60) % 60);
            setNextWordIn(`${hours}h ${minutes}m`);
        };
        const timer = setInterval(updateTimer, 60000);
        updateTimer();
        return () => clearInterval(timer);
    }, []);

    // Server-driven day index (fallback to client calculation)
    const cycleDay = weeklyVocab?.current_day_index ?? ((new Date().getDay() + 1) % 7);


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

    const unifiedErrors = useMemo(() => {
        const modelErrors = profileData?.error_model || [];
        if (modelErrors.length > 0) return modelErrors;
        
        // Fallback to weakness areas from dashboard data
        return (Array.isArray(dashboardData?.error_profile?.weakness_areas) ? dashboardData.error_profile.weakness_areas : []).map((w: string) => ({
            type: w,
            subject: w,
            count: 1,
            severity: 'Medium',
            status: 'Analyzing',
            examples: []
        }));
    }, [profileData?.error_model, dashboardData?.error_profile?.weakness_areas]);



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
                            dailyBites={dailyBites}
                            onInteraction={onInteraction}
                        />

                    );
                })()}
            </motion.div>

            <motion.div variants={itemVariants}>
                <PracticeHub />
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
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
                        <BrainMatrixCard data={matrixData} />
                        <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-[2.5rem] p-8">
                            <div className="flex items-center gap-3 mb-6">
                                <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">Error Queue</h2>
                                <span className="px-2 py-0.5 bg-rose-500/20 text-rose-500 dark:text-rose-400 rounded-md text-[10px] font-black uppercase">Active Friction</span>
                            </div>
                            <div className="flex flex-col gap-3">
                                {unifiedErrors.map((err: any, idx: number) => (
                                    <motion.div key={`${err.type}-${err.subject || idx}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + idx * 0.1 }}>
                                        <ProfileErrorCard error={err} onSelect={setSelectedError} />
                                    </motion.div>
                                ))}
                                {unifiedErrors.length === 0 && (
                                    <p className="text-sm text-slate-400 dark:text-slate-50 italic">No recurring error patterns detected yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <SkillTrajectoryCard data={trends} />

                    {/* Skill Model Matrix from Profile */}
                    {profileData?.skill_matrix && profileData.skill_matrix.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-black tracking-tight flex items-center gap-3 text-slate-900 dark:text-white">
                                    <Activity size={22} className="text-blue-600 dark:text-blue-400" /> Skill Model Matrix
                                </h2>
                                <p className="text-[10px] text-slate-400 dark:text-slate-50 font-black uppercase tracking-widest italic hidden md:block">Updated Real-time</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {profileData.skill_matrix.map((skill: any, idx: number) => (
                                    <motion.div key={skill.name} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * idx }}>
                                        <ProfileSkillCard skill={skill} />
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Focused Weekly Word Journey */}
                    {profileData && (
                        <div className="grid grid-cols-1 gap-8">
                            <div className="space-y-6">
                                <GlassCard className="p-10" hover={false}>
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h3 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">Weekly Vocabulary Journey</h3>
                                            <div className="flex items-center gap-4">
                                                <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">Your 7-day cognitive progression path.</p>
                                                <div className="h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                                                <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Next word in:</span>
                                                    <span className="text-[11px] font-black text-blue-600 dark:text-blue-400">{nextWordIn}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {weeklyVocab?.week_info?.theme && (
                                            <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{weeklyVocab.week_info.theme}</p>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex justify-between items-stretch gap-4 mb-2 overflow-x-auto pb-4 scrollbar-hide">
                                        {!weeklyVocab ? (
                                            Array.from({ length: 7 }).map((_, i) => (
                                                <div key={i} className="flex-1 min-w-[140px] h-48 bg-slate-100 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-[2rem] animate-pulse" />
                                            ))
                                        ) : (
                                            weeklyVocab.weekly_log.map((item: any, i: number) => {
                                                const isToday = cycleDay === i;
                                                const isPast = i < cycleDay;
                                                const isLocked = i > cycleDay;
                                                const isCompleted = item.is_completed;
                                                
                                                return (
                                                    <div 
                                                        key={item.day} 
                                                        className={`flex-1 min-w-[140px] p-6 rounded-[2.5rem] border transition-all duration-500 flex flex-col items-center justify-between min-h-[220px] relative group/word
                                                            ${isToday 
                                                                ? 'bg-cyan-500/10 border-cyan-400 shadow-[0_0_25px_rgba(34,211,238,0.25)] scale-105 z-10 neon-glow-primary' 
                                                                : isCompleted 
                                                                    ? 'bg-emerald-500/10 border-emerald-500/20 opacity-80' 
                                                                    : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/5 opacity-60'}
                                                        `}
                                                    >
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-cyan-300' : 'text-slate-400'}`}>Day {i + 1}</span>
                                                            <h4 className={`text-sm font-black tracking-tight ${isToday ? 'text-cyan-100' : 'text-slate-900 dark:text-white/60'}`}>{item.day}</h4>
                                                        </div>

                                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover/word:scale-110
                                                            ${isToday ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400/30' : 'bg-slate-100 dark:bg-white/5 text-slate-400'}
                                                        `}>
                                                            {isCompleted ? <CheckCircle2 size={20} className="text-emerald-500" /> : (isPast ? <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-700" /> : <Sparkles size={20} />)}
                                                        </div>

                                                        <div className="text-center">
                                                            <p className={`text-[13px] font-black tracking-tight mb-1 ${isToday ? 'text-white' : (isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white/80')}`}>
                                                                {isLocked ? '••••••' : (item.data?.word_c1 || '———')}
                                                            </p>
                                                            <div className={`h-1 w-8 rounded-full mx-auto ${isToday ? 'bg-cyan-400/50' : 'bg-slate-200 dark:bg-white/10'}`} />
                                                        </div>

                                                        {isToday && (
                                                            <div className="absolute -top-2 -right-2 w-8 h-8 bg-cyan-400 rounded-full flex items-center justify-center shadow-lg border border-white/20 animate-bounce neon-glow-primary">
                                                                <Zap size={14} className="text-white fill-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </GlassCard>
                            </div>
                        </div>
                    )}
                </div>

                {/* 4. Intelligence Sidebar (Right) */}
                <div className="lg:col-span-4 space-y-8">
                    <GlassCard className="p-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none" glow>
                        <div className="flex items-center justify-between mb-8">
                            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                <Trophy size={24} className="text-white" />
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">Co-residence</p>
                                <p className="text-2xl font-black">{coResidence}%</p>
                            </div>
                        </div>
                        <h3 className="text-xl font-black mb-2 tracking-tight">Growth Equilibrium</h3>
                        <p className="text-sm text-blue-100 font-medium leading-relaxed mb-8 opacity-80">
                            Your skill distribution is {coResidence > 80 ? 'highly synchronized' : 'evolving'}. Strengthening Writing will stabilize your neural profile.
                        </p>
                        <button className="w-full py-4 bg-white text-blue-600 font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl hover:bg-blue-50 transition active:scale-95">
                            Optimize Profile
                        </button>
                    </GlassCard>

                    <IntelligenceFeed dashboardData={dashboardData} />
                </div>
            </div>

            <ErrorAnalysisModal 
                isOpen={!!selectedError} 
                error={selectedError} 
                onClose={() => setSelectedError(null)} 
            />
        </motion.div>
    );
};



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
                            {(Array.isArray(errorProfile.weakness_areas) ? errorProfile.weakness_areas : []).slice(0, 3).map((w: string, i: number) => (
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
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                            <Sparkles size={18} />
                        </div>
                        Linguistic Action Plan
                    </h3>
                    {errorProfile.action_plan && (
                        <p className="text-[15px] font-medium text-slate-500 dark:text-slate-400 leading-[1.8] mb-8 max-w-2xl">
                            {errorProfile.action_plan}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-3">
                        {(Array.isArray(errorProfile.weakness_areas) ? errorProfile.weakness_areas : []).slice(0, 5).map((tag: string) => (
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
        displayName: profile?.display_name || '',
        bio: profile?.bio || '',
        goal: profile?.learning_goal || 'casual',
        pace: profile?.learning_intensity || 'regular',
        notifications: profile?.notifications_enabled ?? true
    });

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await learnerService.updateProfile({
                display_name: settings.displayName,
                bio: settings.bio,
                learning_goal: settings.goal,
                learning_intensity: settings.pace,
                notifications_enabled: settings.notifications
            });
            await refresh();
        } catch (err) {
            console.error("Failed to save settings", err);
        } finally {
            setIsSaving(false);
        }
    };

    const SettingCard = ({ icon, label, title, subtitle, children }: any) => (
        <GlassCard className="p-8" hover={false}>
            <div className="flex flex-col md:flex-row gap-8">
                <div className="md:w-1/3">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                            {icon}
                        </div>
                        <h4 className="text-[10px] font-black text-slate-400 dark:text-white/20 uppercase tracking-[0.2em]">{label}</h4>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">{subtitle}</p>
                </div>
                <div className="md:w-2/3">
                    {children}
                </div>
            </div>
        </GlassCard>
    );

    return (
        <div className="w-full max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex items-center justify-between mb-10">
                <div>
                    <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">Engine Configuration</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Fine-tune your cognitive development parameters.</p>
                </div>
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-8 py-3 bg-blue-600 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-premium hover:bg-blue-700 transition active:scale-95 disabled:opacity-50 flex items-center gap-3"
                >
                    {isSaving ? <RefreshCcw size={14} className="animate-spin" /> : <Zap size={14} />}
                    Save Configuration
                </button>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <SettingCard icon={<Activity size={22} />} label="Identity" title="Public Profile" subtitle="How you appear across the linguistic network.">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-white/20 uppercase tracking-widest">Display Name</label>
                            <input 
                                type="text" 
                                value={settings.displayName}
                                onChange={e => setSettings({...settings, displayName: e.target.value})}
                                className="w-full px-6 py-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 focus:border-blue-500 outline-none transition font-bold text-slate-900 dark:text-white"
                                placeholder="Quantum Learner"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 dark:text-white/20 uppercase tracking-widest">Cognitive Bio</label>
                            <textarea 
                                value={settings.bio}
                                onChange={e => setSettings({...settings, bio: e.target.value})}
                                className="w-full px-6 py-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 focus:border-blue-500 outline-none transition font-bold text-slate-900 dark:text-white min-h-[120px]"
                                placeholder="Synthesizing neural patterns..."
                            />
                        </div>
                    </div>
                </SettingCard>

                <SettingCard icon={<Target size={22} />} label="Objectives" title="Learning Focus" subtitle="Direct your AI Architect's primary generation goals.">
                    <select 
                        value={settings.goal}
                        onChange={e => setSettings({...settings, goal: e.target.value as any})}
                        className="w-full px-6 py-4 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 focus:border-blue-500 outline-none transition font-bold text-slate-900 dark:text-white appearance-none"
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
            navigate('/dashboard/practice');
            return;
        }
        if (tabId === 'journey') {
            navigate('/journey');
            return;
        }
        if (tabId === 'home') navigate('/dashboard');
        else navigate(`/dashboard/${tabId}`);
    };

    useEffect(() => {
        // Request notification permission and setup FCM
        requestNotificationPermission();
    }, []);

    const [realtimeData, setRealtimeData] = React.useState<DashboardData | null>(null);
    const [journeyData, setJourneyData] = React.useState<JourneyData | null>(null);
    const [dailyBites, setDailyBites] = React.useState<any>(null);
    const [isLearnerLoading, setIsLearnerLoading] = React.useState(true);

    const fetchAllData = React.useCallback(async () => {
        const userContext = supabaseData.user?.id;
        
        if (!userContext || String(userContext) === 'undefined') {
            return;
        }

        setIsLearnerLoading(true);
        try {
            console.log('[Dashboard] Fetching fresh data...');
            const [dash, journey, bites] = await Promise.all([
                learnerService.getDashboard(),
                learnerService.getJourney(),
                learnerService.getDailyBites()
            ]);
            setRealtimeData(dash);
            setJourneyData(journey);
            setDailyBites(bites);
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
        const activeErrors = (Array.isArray(sData?.errorProfile?.weakness_areas) ? sData.errorProfile.weakness_areas : []).length;

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

    // 🎯 Progressive Rendering: Only block if we have NO data at all
    const isInitialLoading = (supabaseData.isLoading && !supabaseData.profile && !result);
    
    if (isInitialLoading) return <NeuralPulseLoader status="Synchronizing AI Profile..." />;

    return (
        <>
            {/* 📱 Pixel-Perfect Lumina AI Mobile Dashboard (md:hidden) */}
            <div className="md:hidden min-h-screen bg-slate-50 dark:bg-[#0a0f14] text-slate-900 dark:text-slate-100 flex flex-col pb-24 overflow-x-hidden relative select-none transition-colors duration-300">
                {/* Mobile Background Neon Aura */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[-10%] left-[-15%] w-[60%] h-[40%] bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-[100px] animate-pulse" />
                    <div className="absolute bottom-[20%] right-[-15%] w-[60%] h-[40%] bg-purple-500/[0.03] dark:bg-purple-500/5 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2.5s' }} />
                </div>

                {/* 1. Mobile Header */}
                <header className="flex items-center justify-between px-6 py-4 bg-white/80 dark:bg-[#0a0f14]/80 backdrop-blur-xl sticky top-0 z-[40] border-b border-slate-200/50 dark:border-white/[0.03] transition-colors duration-300">
                    <div className="flex items-center gap-3">
                        <div 
                            onClick={() => handleTabChange('settings')}
                            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-white/10 overflow-hidden shadow-md active:scale-95 transition-all"
                        >
                            <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${displayName}&backgroundColor=transparent`} alt="Profile" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-base font-black text-slate-900 dark:text-white tracking-wide">{displayName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_2px_4px_rgba(255,255,255,0.05)]">
                            <span className="text-xs">🔥</span>
                            <span className="text-xs font-black text-slate-800 dark:text-white tracking-widest">{mergedDashboardData?.profile?.streak || supabaseData?.profile?.streak || 0}</span>
                        </div>
                    </div>
                </header>

                {activeTab === 'home' ? (
                    <div className="flex-grow flex flex-col pt-4">
                        {/* 2. Main Practice Card (Chat with Aria) */}
                        <div className="mx-6 p-6 rounded-[2.5rem] bg-white dark:bg-gradient-to-br dark:from-slate-900 dark:via-[#0e141b] dark:to-slate-950 border border-slate-200/60 dark:border-white/[0.05] shadow-[0_15px_35px_-15px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_50px_-15px_rgba(0,0,0,0.8)] relative overflow-hidden group transition-all duration-300">
                            {/* Card Ambient Glow */}
                            <div className="absolute -top-12 -right-12 w-28 h-28 bg-cyan-400/[0.08] dark:bg-cyan-400/10 rounded-full blur-2xl pointer-events-none" />
                            
                            <div className="flex items-start gap-4">
                                <div className="relative shrink-0">
                                    <div className="w-16 h-16 rounded-2xl border border-cyan-400/20 dark:border-cyan-400/40 overflow-hidden bg-slate-50 dark:bg-slate-950 relative shadow-inner">
                                        <img src="https://api.dicebear.com/7.x/adventurer/svg?seed=Aria&backgroundColor=transparent" alt="Aria" className="w-full h-full object-cover scale-110" />
                                    </div>
                                    <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0e141b] shadow-md animate-pulse" />
                                </div>
                                <div className="flex-grow">
                                    <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight">Chat with Aria</h4>
                                    <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest">Practice speaking</p>
                                    <p className="text-[13px] font-black text-slate-800 dark:text-white/95 mt-1 leading-snug">"Ordering at a Cafe"</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    window.dispatchEvent(new CustomEvent('open-virtual-tutor'));
                                }}
                                className="w-full mt-5 py-4 rounded-[1.5rem] bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-400 text-slate-950 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all duration-300 shadow-[0_4px_25px_rgba(34,211,238,0.25)] hover:brightness-110"
                            >
                                <Mic size={14} className="fill-current text-slate-950" />
                                <span>Start Practice</span>
                            </button>
                        </div>

                        {/* 3. Skill Progress Section */}
                        <div className="mt-8 px-6">
                            <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em] mb-4">Skill Progress</h3>
                            
                            {/* Circular Skills Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                {(() => {
                                    const getSkillStats = (id: string) => {
                                        const s = (supabaseData.skills || []).find((item: any) => (item.skillId || item.skill || '').toLowerCase() === id.toLowerCase());
                                        const raw = s ? (s.current_score !== undefined ? s.current_score : s.masteryScore || 0) : 0;
                                        const score = Math.round(raw < 1 && raw > 0 ? raw * 100 : raw);
                                        return {
                                            score: score || 0,
                                            level: s?.level || s?.currentLevel || s?.current_level || 'A1'
                                        };
                                    };
                                    const reading = getSkillStats('reading');
                                    const writing = getSkillStats('writing');
                                    const listening = getSkillStats('listening');
                                    const speaking = getSkillStats('speaking');
                                    
                                    const skillConfigs = [
                                        { id: 'reading', label: 'Reading', stats: reading, color: '#10b981', xp: '+5% XP' },
                                        { id: 'writing', label: 'Writing', stats: writing, color: '#22d3ee', xp: '+2% XP' },
                                        { id: 'listening', label: 'Listening', stats: listening, color: '#a855f7', xp: '+8% XP' },
                                        { id: 'speaking', label: 'Speaking', stats: speaking, color: '#f59e0b', xp: '+12% XP' }
                                    ];
                                    
                                    return skillConfigs.map(s => {
                                        const radius = 22;
                                        const strokeWidth = 3.5;
                                        const circumference = 2 * Math.PI * radius;
                                        const strokeDashoffset = circumference - (Math.max(5, Math.min(100, s.stats.score)) / 100) * circumference;
                                        
                                        return (
                                            <div 
                                                key={s.id}
                                                onClick={() => handleTabChange('analytics')}
                                                className="bg-white dark:bg-[#11161d]/60 border border-slate-200/60 dark:border-white/[0.04] p-5 rounded-[2rem] flex flex-col items-center justify-center text-center shadow-[0_8px_20px_-6px_rgba(0,0,0,0.02)] dark:shadow-lg hover:border-slate-300 dark:hover:border-white/10 active:scale-97 transition-all duration-300"
                                            >
                                                <div className="relative w-14 h-14 flex items-center justify-center mb-3">
                                                    <svg className="w-full h-full transform -rotate-90">
                                                        <circle cx="28" cy="28" r={radius} stroke="rgba(0,0,0,0.04)" strokeWidth={strokeWidth} fill="transparent" className="stroke-slate-100 dark:stroke-white/[0.04]" />
                                                        <circle 
                                                            cx="28" 
                                                            cy="28" 
                                                            r={radius} 
                                                            stroke={s.color} 
                                                            strokeWidth={strokeWidth} 
                                                            fill="transparent" 
                                                            strokeDasharray={circumference}
                                                            strokeDashoffset={strokeDashoffset}
                                                            strokeLinecap="round"
                                                            style={{ filter: `drop-shadow(0px 0px 5px ${s.color}60)` }}
                                                        />
                                                    </svg>
                                                    <span className="absolute text-[10px] font-black text-slate-800 dark:text-white">{s.stats.level}</span>
                                                </div>
                                                <span className="text-[13px] font-black text-slate-900 dark:text-white/90">{s.label}</span>
                                                <span className="text-[10px] font-black text-emerald-500 dark:text-emerald-400 mt-1 uppercase tracking-widest">{s.xp}</span>
                                            </div>
                                        );
                                    });
                                })()}
                              </div>
                          </div>

                        {/* 4. Daily Boost Horizontal Scroll */}
                        <div className="mt-8">
                            <div className="flex items-center justify-between px-6 mb-4">
                                <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em]">Daily Boost</h3>
                                <button 
                                    onClick={() => handleTabChange('daily')}
                                    className="text-[10px] font-black text-cyan-500 dark:text-cyan-400 uppercase tracking-widest active:scale-95 transition-all"
                                >
                                    View All
                                </button>
                            </div>
                            
                            <div className="flex gap-4 overflow-x-auto px-6 py-2 scrollbar-hide">
                                {(() => {
                                    const vocabWord = dailyBites?.bites?.vocabulary?.steps?.[2]?.word || dailyBites?.bites?.vocabulary?.word_c1 || 'Éphémère';
                                    const vocabContext = dailyBites?.bites?.vocabulary?.context_note || 'adj. Short-lived';
                                    
                                    const grammarTopic = dailyBites?.bites?.grammar?.pattern || 'Subjunctive';
                                    const grammarContext = dailyBites?.bites?.grammar?.correction || 'Expressing desire.';
                                    
                                    const styleTopic = dailyBites?.bites?.style?.focus || 'Passive Voice';
                                    const styleContext = dailyBites?.bites?.style?.rewrite_tip || 'Formal clarity.';
                                    
                                    const boostCards = [
                                        { title: vocabWord, subtitle: vocabContext, color: '#22d3ee', icon: '文' },
                                        { title: grammarTopic, subtitle: grammarContext, color: '#a855f7', icon: '⚡' },
                                        { title: styleTopic, subtitle: styleContext, color: '#3b82f6', icon: '✎' }
                                    ];
                                    
                                    return boostCards.map((b, i) => (
                                        <div 
                                            key={i}
                                            onClick={() => handleTabChange('daily')}
                                            className="min-w-[160px] max-w-[180px] bg-white dark:bg-[#11161d]/60 border border-slate-200/60 dark:border-white/[0.04] p-5 rounded-[2rem] flex flex-col justify-between min-h-[140px] relative shadow-[0_8px_20px_-6px_rgba(0,0,0,0.02)] dark:shadow-lg overflow-hidden active:scale-95 transition-all"
                                        >
                                            {/* Accent Left Bar */}
                                            <div className="absolute left-0 top-6 bottom-6 w-1 rounded-r-md" style={{ backgroundColor: b.color }} />
                                            
                                            <div className="flex flex-col gap-2">
                                                <div 
                                                    className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black" 
                                                    style={{ backgroundColor: `${b.color}15`, color: b.color }}
                                                >
                                                    {b.icon}
                                                </div>
                                                <h4 className="text-[14px] font-black text-slate-900 dark:text-white leading-tight mt-1 line-clamp-1">{b.title}</h4>
                                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed">{b.subtitle}</p>
                                            </div>
                                            
                                            {/* Small Bottom Progress Strip */}
                                            <div className="w-full h-1 bg-slate-100 dark:bg-white/5 rounded-full mt-4 overflow-hidden">
                                                <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: b.color }} />
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>

                        {/* 5. Statistics Banner Card */}
                        <div className="mt-8 mx-6">
                            {(() => {
                                const totalQuestions = supabaseData.profile?.totalQuestionsAnswered ?? 0;
                                const avgTime = supabaseData.profile?.averageResponseTime ?? 0;
                                const activeHours = Math.round(((totalQuestions * avgTime) / 3600) * 10) / 10 || 0;
                                const points = supabaseData.profile?.points ?? 0;
                                const formattedPoints = points >= 1000 ? `${(points / 1000).toFixed(1)}k` : points.toString();
                                const accuracy = supabaseData.profile?.accuracyRate ?? 0;
                                const formattedAccuracy = accuracy > 0 ? `${Math.round(accuracy * 100)}% Accuracy` : '0% Accuracy';
                                
                                return (
                                    <div className="bg-white dark:bg-[#11161d]/60 border border-slate-200/60 dark:border-white/[0.04] p-6 rounded-[2.5rem] grid grid-cols-2 divide-x divide-slate-100 dark:divide-white/[0.04] shadow-[0_8px_20px_-6px_rgba(0,0,0,0.02)] dark:shadow-lg transition-all">
                                        <div className="flex flex-col pr-4">
                                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Hours</span>
                                            <span className="text-2xl font-black text-cyan-500 dark:text-cyan-400 tracking-tight">{activeHours}</span>
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1">
                                                🎯 {formattedAccuracy}
                                            </span>
                                        </div>
                                        <div className="flex flex-col pl-6">
                                            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">XP Earned</span>
                                            <span className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight">{formattedPoints}</span>
                                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1">
                                                ⚡ Level {supabaseData.profile?.overall_level || 'A1'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                ) : (
                    // Tabs render directly in a matching dark container
                    <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 min-h-0 bg-slate-50 dark:bg-[#0a0f14] transition-colors duration-300">
                        {activeTab === 'journey' && <JourneyTab {...props} supabaseData={supabaseData} />}
                        {activeTab === 'daily' && (
                            <div className="w-full min-h-screen pb-20 relative px-2">
                                {dailyBites ? (
                                    <DailyMicroLearning 
                                        bites={dailyBites?.bites} 
                                        initialCompleted={dailyBites?.completed} 
                                        onInteraction={fetchAllData} 
                                    />
                                ) : (
                                    <div className="flex justify-center py-20">
                                        <NeuralPulseLoader status="Synthesizing..." />
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'analytics' && (
                            <AnalyticsTab 
                                supabaseData={supabaseData} 
                                dashboardData={mergedDashboardData}
                                weaknesses={Array.isArray(supabaseData.errorProfile?.weakness_areas) ? supabaseData.errorProfile.weakness_areas : []}
                                mistakes={Array.isArray(supabaseData.errorProfile?.common_mistakes) ? supabaseData.errorProfile.common_mistakes : []}
                                actionPlan={mergedDashboardData?.intelligence_feed?.action_plan || supabaseData.errorProfile?.action_plan || ""}
                            />
                        )}
                        {activeTab === 'settings' && <SettingsTab {...props} supabaseData={supabaseData} refresh={fetchAllData} />}
                    </div>
                )}

                {/* 6. Fixed Bottom Navigation Bar */}
                <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/90 dark:bg-[#0a0f14]/90 backdrop-blur-2xl border-t border-slate-200/50 dark:border-white/[0.03] grid grid-cols-5 items-center justify-center px-4 z-[45] transition-colors duration-300">
                    {[
                        { id: 'home', label: 'Home', icon: <Home size={18} /> },
                        { id: 'journey', label: 'Lessons', icon: <BookOpen size={18} /> },
                        { id: 'tutor', label: 'AI Tutor', icon: <Brain size={18} /> },
                        { id: 'analytics', label: 'Progress', icon: <BarChart3 size={18} /> },
                        { id: 'settings', label: 'Profile', icon: <Settings size={18} /> }
                    ].map(tab => {
                        const isActive = activeTab === tab.id || (tab.id === 'home' && activeTab === 'daily');
                        
                        if (tab.id === 'tutor') {
                            return (
                                <button 
                                    key={tab.id}
                                    onClick={() => {
                                        window.dispatchEvent(new CustomEvent('open-virtual-tutor'));
                                    }}
                                    className="flex flex-col items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-all duration-300"
                                >
                                    {tab.icon}
                                    <span className="mt-1">{tab.label}</span>
                                </button>
                            );
                        }
                        
                        return (
                            <button 
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`flex flex-col items-center justify-center transition-all duration-300 ${
                                    isActive 
                                        ? 'text-cyan-600 dark:text-cyan-400' 
                                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                                }`}
                            >
                                <div className={`flex flex-col items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider ${
                                    isActive ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-4 py-2 rounded-2xl' : ''
                                }`}>
                                    {tab.icon}
                                    <span className="mt-0.5">{tab.label}</span>
                                </div>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* --- ORIGINAL RESPONSIVE DESKTOP LAYOUT (hidden md:flex) --- */}
            <div className="hidden md:flex h-screen w-full bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-50 font-sans overflow-x-hidden relative selection:bg-blue-500/30 transition-colors duration-300">
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
                            <SidebarContent activeTab={activeTab} onTabChange={(id) => { handleTabChange(id); setIsMobileMenuOpen(false); }} onLogout={onLogout} />
                        </motion.aside>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 1. Sidebar (Desktop) */}
            <Sidebar activeTab={activeTab} onTabChange={handleTabChange} onLogout={onLogout} />

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
                        
                            {/* 1. CEFR MASTERY RESERVOIR (Moved to the very top as requested) */}
                            <motion.div variants={itemVariants} className="mb-10">
                                <LevelProgress 
                                    current_xp={mergedDashboardData?.profile?.current_level_xp || 0}
                                    required_xp={mergedDashboardData?.profile?.required_xp || 1000}
                                    level={mergedDashboardData?.profile?.current_level || 'A1'}
                                    is_gateway_unlocked={mergedDashboardData?.profile?.is_gateway_unlocked}
                                    streak={mergedDashboardData?.profile?.streak || supabaseData?.profile?.streak || 0}
                                />
                            </motion.div>

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
                                        dailyBites={dailyBites}
                                        onInteraction={fetchAllData}
                                    />
                                )
                            )}
                            {activeTab === 'daily' && (
                                <div className="w-full max-w-5xl mx-auto min-h-screen pb-20 relative px-6">
                                    {dailyBites ? (
                                        <DailyMicroLearning 
                                            bites={dailyBites?.bites} 
                                            initialCompleted={dailyBites?.completed} 
                                            onInteraction={fetchAllData} 
                                        />
                                    ) : (
                                        <div className="flex justify-center py-20">
                                            <NeuralPulseLoader status="Synthesizing..." />
                                        </div>
                                    )}
                                </div>
                            )}




                            {activeTab === 'journey' && <JourneyTab {...props} supabaseData={supabaseData} />}

                            {activeTab === 'analytics' && (
                                <AnalyticsTab 
                                    supabaseData={supabaseData} 
                                    dashboardData={mergedDashboardData}
                                    weaknesses={Array.isArray(supabaseData.errorProfile?.weakness_areas) ? supabaseData.errorProfile.weakness_areas : []}
                                    mistakes={Array.isArray(supabaseData.errorProfile?.common_mistakes) ? supabaseData.errorProfile.common_mistakes : []}
                                    actionPlan={mergedDashboardData?.intelligence_feed?.action_plan || supabaseData.errorProfile?.action_plan || ""}
                                />
                            )}
                            {activeTab === 'history' && <HistoryTab {...props} supabaseData={supabaseData} />}
                            {activeTab === 'practice' && <PracticeHub />}
                            {activeTab === 'settings' && <SettingsTab {...props} supabaseData={supabaseData} refresh={fetchAllData} />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </main>
        </div>
    </>
);
};
export default AdvancedDashboard;
