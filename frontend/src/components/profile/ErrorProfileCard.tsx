import React from 'react';
import { 
    RadarChart, PolarGrid, PolarAngleAxis, Radar, 
    ResponsiveContainer, Tooltip 
} from 'recharts';
import { MissionControlCard } from './MissionControlCard';
import { AlertCircle } from 'lucide-react';

interface ErrorProfileCardProps {
    data: any[];
    className?: string;
}

export const ErrorProfileCard: React.FC<ErrorProfileCardProps> = ({ data, className = "" }) => {
    return (
        <MissionControlCard className={className} title="Linguistic Error Model">
            <div className="w-full h-[350px] relative overflow-hidden">
                {data && data.length > 0 ? (
                    <ResponsiveContainer width="100%" aspect={1} minWidth={0} minHeight={0}>
                        <RadarChart 
                            cx="50%" 
                            cy="50%" 
                            outerRadius="55%" 
                            data={data} 
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
            {data && data.length > 0 && (
                <div className="mt-4 px-8 pb-8 space-y-3">
                    {data.slice(0, 2).map((w, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span className="text-[10px] font-bold text-slate-800 dark:text-white/80 uppercase">{w.subject}</span>
                            </div>
                            <span className="text-[9px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded uppercase">{w.A}% Density</span>
                        </div>
                    ))}
                </div>
            )}
        </MissionControlCard>
    );
};
