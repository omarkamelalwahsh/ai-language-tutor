import React, { useState } from 'react';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer 
} from 'recharts';
import { MissionControlCard } from './MissionControlCard';
import { TrendingUp, Activity } from 'lucide-react';

interface SkillTrajectoryCardProps {
    data: any[];
    className?: string;
}

export const SkillTrajectoryCard: React.FC<SkillTrajectoryCardProps> = ({ data, className = "" }) => {
    const [visibleSkills, setVisibleSkills] = useState<string[]>(['speaking', 'writing', 'reading', 'listening']);

    const skills = [
        { id: 'speaking', label: 'Speaking', color: '#6366F1' },
        { id: 'writing', label: 'Writing', color: '#3B82F6' },
        { id: 'reading', label: 'Reading', color: '#10B981' },
        { id: 'listening', label: 'Listening', color: '#F59E0B' }
    ];

    const toggleSkill = (skill: string) => {
        setVisibleSkills(prev => 
            prev.includes(skill) 
                ? prev.filter(s => s !== skill) 
                : [...prev, skill]
        );
    };

    return (
        <MissionControlCard className={className} title="Performance Trajectory">
            <div className="w-full">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="hidden md:block">
                        <p className="text-xs text-slate-400 dark:text-white/40 font-medium">Historical trends across linguistic dimensions.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {skills.map(skill => (
                            <button 
                                key={skill.id}
                                onClick={() => toggleSkill(skill.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all active:scale-95
                                    ${visibleSkills.includes(skill.id) 
                                        ? 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 opacity-100' 
                                        : 'bg-transparent border-transparent opacity-30 grayscale'}
                                `}
                            >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: skill.color }} />
                                <span className="text-[9px] font-black uppercase text-slate-500 dark:text-white/60 tracking-widest">{skill.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="w-full mt-4 h-[350px] relative overflow-hidden">
                    {data && data.length > 0 ? (
                        <ResponsiveContainer width="100%" aspect={1.5} minWidth={0} minHeight={0}>
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'rgba(148, 163, 184, 0.4)', fontSize: 10, fontWeight: 700 }}
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'rgba(148, 163, 184, 0.4)', fontSize: 10, fontWeight: 700 }}
                                    domain={[0, 100]}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'rgba(15, 23, 42, 0.95)', 
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '16px',
                                        backdropFilter: 'blur(12px)',
                                        padding: '12px'
                                    }}
                                    itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                                />
                                {skills.map(skill => (
                                    <Line 
                                        key={skill.id}
                                        type="monotone" 
                                        dataKey={skill.id} 
                                        name={skill.label}
                                        stroke={skill.color} 
                                        strokeWidth={4} 
                                        dot={false}
                                        hide={!visibleSkills.includes(skill.id)}
                                        activeDot={{ r: 6, fill: skill.color, stroke: '#fff', strokeWidth: 2 }}
                                        animationDuration={1500}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-slate-400/20">
                            <Activity size={40} className="animate-pulse" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Synthesizing Historical Data...</p>
                        </div>
                    )}
                </div>
            </div>
        </MissionControlCard>
    );
};
