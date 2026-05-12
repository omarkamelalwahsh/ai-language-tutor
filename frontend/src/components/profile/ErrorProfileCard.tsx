import React, { useState } from 'react';
import { 
    RadarChart, PolarGrid, PolarAngleAxis, Radar, 
    ResponsiveContainer, Tooltip 
} from 'recharts';
import { motion } from 'motion/react';
import { MissionControlCard } from './MissionControlCard';
import { AlertCircle } from 'lucide-react';
import { ErrorAnalysisModal, ErrorItem } from '../dashboard/ErrorAnalysisModal';

interface ErrorProfileCardProps {
    data: ErrorItem[];
    className?: string;
}

export const ErrorProfileCard: React.FC<ErrorProfileCardProps> = ({ data, className = "" }) => {
    const [selectedError, setSelectedError] = useState<ErrorItem | null>(null);

    // Map backend data format to Recharts format
    const chartData = React.useMemo(() => {
        if (!data) return [];
        return data.map(item => ({
            ...item,
            subject: item.type || item.subject || 'Unknown',
            A: item.A !== undefined ? item.A : Math.min(100, (item.count || 1) * 25) // Convert count to percentage
        }));
    }, [data]);

    return (
        <MissionControlCard className={className} title="Linguistic Error Model">
            <div className="w-full h-[350px] relative overflow-hidden">
                {chartData && chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" aspect={1} minWidth={0} minHeight={0}>
                        <RadarChart 
                            cx="50%" 
                            cy="50%" 
                            outerRadius="65%" 
                            data={chartData} 
                            margin={{ top: 20, right: 40, bottom: 20, left: 40 }}
                        >
                            <PolarGrid stroke="currentColor" className="text-slate-200 dark:text-white/5" strokeDasharray="4 4" />
                            <PolarAngleAxis 
                                dataKey="subject" 
                                tick={{ fill: 'rgba(148, 163, 184, 0.6)', fontSize: 11, fontWeight: 900, letterSpacing: '0.1em' }}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'rgba(15, 23, 42, 0.8)', 
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '24px',
                                    backdropFilter: 'blur(20px)',
                                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                                }}
                                itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}
                            />
                            <Radar
                                name="Error Density"
                                dataKey="A"
                                stroke="#F43F5E"
                                strokeWidth={4}
                                fill="url(#errorGradient)"
                                fillOpacity={0.3}
                                isAnimationActive={true}
                                animationDuration={1500}
                            />
                            <defs>
                                <radialGradient id="errorGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                                    <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.8} />
                                    <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.1} />
                                </radialGradient>
                            </defs>
                        </RadarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center gap-4 text-emerald-400/20">
                        <AlertCircle size={40} className="animate-pulse" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em]">Zero Critical Friction Detected</p>
                    </div>
                )}
            </div>
            
            {/* Secondary list of weaknesses */}
            {chartData && chartData.length > 0 && (
                <div className="mt-4 px-8 pb-8 space-y-3">
                    {chartData.slice(0, 3).map((w, i) => (
                        <motion.button 
                            key={i} 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            whileHover={{ scale: 1.02, x: 5 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedError(w)}
                            className="w-full flex items-center justify-between p-5 bg-white/50 dark:bg-white/[0.03] backdrop-blur-md rounded-3xl border border-slate-100 dark:border-white/5 hover:border-rose-500/50 hover:bg-rose-500/[0.02] transition-all text-left group/item"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)] group-hover/item:scale-150 transition-transform" />
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">{w.subject}</span>
                                    <span className="text-[10px] text-slate-400 dark:text-white/30 font-bold tracking-tight">{w.status || 'Active Pattern'} • {w.severity || 'Medium'} Risk</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[11px] font-black text-rose-500 bg-rose-500/10 px-3 py-1.5 rounded-xl uppercase tracking-widest">{w.A}%</span>
                            </div>
                        </motion.button>
                    ))}
                </div>
            )}

            <ErrorAnalysisModal 
                isOpen={!!selectedError} 
                error={selectedError} 
                onClose={() => setSelectedError(null)} 
            />
        </MissionControlCard>
    );
};
