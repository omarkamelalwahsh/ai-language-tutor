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

// Custom Glassmorphic Tooltip with Lumina AI styling
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-950/90 backdrop-blur-2xl border border-white/10 p-4 rounded-[2rem] shadow-2xl min-w-[160px] animate-fade-in">
                <p className="text-[10px] font-black tracking-widest text-slate-500 uppercase mb-3">{label}</p>
                <div className="flex flex-col gap-2.5">
                    {payload.map((item: any) => (
                        <div key={item.dataKey} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <div 
                                    className="w-2.5 h-2.5 rounded-full" 
                                    style={{ 
                                        backgroundColor: item.stroke,
                                        boxShadow: `0 0 8px ${item.stroke}`
                                    }} 
                                />
                                <span className="text-[11px] font-bold text-white/80">{item.name}</span>
                            </div>
                            <span className="text-[11px] font-black text-white" style={{ color: item.stroke }}>
                                {item.value}%
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

export const SkillTrajectoryCard: React.FC<SkillTrajectoryCardProps> = ({ data, className = "" }) => {
    const [visibleSkills, setVisibleSkills] = useState<string[]>(['speaking', 'writing', 'reading', 'listening']);

    const skills = [
        { id: 'speaking', label: 'Speaking', color: '#a855f7' },
        { id: 'writing', label: 'Writing', color: '#22d3ee' },
        { id: 'reading', label: 'Reading', color: '#10b981' },
        { id: 'listening', label: 'Listening', color: '#f59e0b' }
    ];

    const toggleSkill = (skill: string) => {
        setVisibleSkills(prev => 
            prev.includes(skill) 
                ? prev.filter(s => s !== skill) 
                : [...prev, skill]
        );
    };

    return (
        <MissionControlCard className={className} title="Performance Trajectory" glowColor="rgba(34, 211, 238, 0.15)">
            <div className="w-full px-8 py-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div className="hidden md:block">
                        <p className="text-xs text-slate-400 dark:text-white/40 font-medium">Historical trends across linguistic dimensions.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5">
                        {skills.map(skill => {
                            const isVisible = visibleSkills.includes(skill.id);
                            return (
                                <button 
                                    key={skill.id}
                                    onClick={() => toggleSkill(skill.id)}
                                    className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl border transition-all duration-300 active:scale-95 relative overflow-hidden group
                                        ${isVisible 
                                            ? 'bg-white/5 border-white/10 text-white shadow-[0_4px_20px_-10px_rgba(255,255,255,0.1)] opacity-100' 
                                            : 'bg-transparent border-transparent text-white/30 opacity-40 hover:opacity-70 hover:scale-102'}
                                    `}
                                >
                                    <div 
                                        className="w-2.5 h-2.5 rounded-full transition-all duration-300 group-hover:scale-125" 
                                        style={{ 
                                            backgroundColor: skill.color,
                                            boxShadow: isVisible ? `0 0 12px ${skill.color}` : 'none'
                                        }} 
                                    />
                                    <span className="text-[10px] font-black uppercase tracking-widest">{skill.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="w-full mt-4 h-[350px] relative overflow-hidden flex items-center justify-center">
                    {data && data.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 20, right: 35, left: -10, bottom: 10 }}>
                                <defs>
                                    {/* Drop Shadow and soft glow effects for floating neon lines */}
                                    <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
                                        <feGaussianBlur stdDeviation="3" result="blur" />
                                        <feMerge>
                                            <feMergeNode in="blur" />
                                            <feMergeNode in="SourceGraphic" />
                                        </feMerge>
                                    </filter>
                                </defs>
                                <CartesianGrid strokeDasharray="6 6" stroke="rgba(255,255,255,0.02)" vertical={false} />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'rgba(255, 255, 255, 0.35)', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }}
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{ fill: 'rgba(255, 255, 255, 0.35)', fontSize: 10, fontWeight: 700 }}
                                    tickFormatter={(val) => `${val}%`}
                                    domain={[0, 100]}
                                    dx={-5}
                                />
                                <Tooltip 
                                    content={<CustomTooltip />}
                                    cursor={{ stroke: 'rgba(255, 255, 255, 0.05)', strokeWidth: 2, strokeDasharray: '4 4' }}
                                />
                                {skills.map(skill => (
                                    <Line 
                                        key={skill.id}
                                        type="monotone" 
                                        dataKey={skill.id} 
                                        name={skill.label}
                                        stroke={skill.color} 
                                        strokeWidth={3} 
                                        dot={{ r: 4, strokeWidth: 1.5, fill: '#0a0f14', stroke: skill.color }}
                                        activeDot={{ r: 6, fill: skill.color, stroke: '#fff', strokeWidth: 2, style: { filter: 'drop-shadow(0px 0px 8px ' + skill.color + ')' } }}
                                        hide={!visibleSkills.includes(skill.id)}
                                        animationDuration={1800}
                                        style={{ filter: 'url(#neon-glow)' }}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-slate-400/25">
                            <Activity size={40} className="animate-pulse" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Synthesizing Historical Data...</p>
                        </div>
                    )}
                </div>
            </div>
        </MissionControlCard>
    );
};
