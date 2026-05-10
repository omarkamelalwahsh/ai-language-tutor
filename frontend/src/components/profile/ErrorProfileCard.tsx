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
                            outerRadius="55%" 
                            data={chartData} 
                            margin={{ top: 40, right: 60, bottom: 40, left: 60 }}
                        >
                            <PolarGrid stroke="currentColor" className="text-slate-200 dark:text-white/10" strokeDasharray="3 3" />
                            <PolarAngleAxis 
                                dataKey="subject" 
                                tick={{ fill: 'rgba(148, 163, 184, 0.8)', fontSize: 10, fontWeight: 800 }}
                            />
                            <Tooltip 
                                contentStyle={{ 
                                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '16px',
                                    backdropFilter: 'blur(12px)'
                                }}
                                itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                            />
                            <Radar
                                name="Error Density"
                                dataKey="A"
                                stroke="#F43F5E"
                                strokeWidth={3}
                                fill="#F43F5E"
                                fillOpacity={0.15}
                                isAnimationActive={true}
                            />
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
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setSelectedError(w)}
                            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-rose-500/30 transition-all text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tight">{w.subject}</span>
                                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">{w.status || 'Active Pattern'} • {w.severity || 'Medium'} Risk</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-[10px] font-black text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-lg uppercase tracking-wider">{w.A}% Density</span>
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
