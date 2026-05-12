import React from 'react';
import { 
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, 
    ResponsiveContainer, Tooltip 
} from 'recharts';
import { MissionControlCard } from './MissionControlCard';
import { Brain } from 'lucide-react';

interface BrainMatrixCardProps {
    data: any[];
    className?: string;
}

export const BrainMatrixCard: React.FC<BrainMatrixCardProps> = ({ data, className = "" }) => {
    // Simplified custom tick that stacks text without breaking layout
    const CustomAngleTick = ({ payload, x, y }: any) => {
        const skill = data.find(d => d.subject === payload.value);
        const cefrLevel = skill?.level || 'A1';
        
        return (
            <g transform={`translate(${x},${y})`}>
                <text
                    x={0}
                    y={-12}
                    textAnchor="middle"
                    className="fill-slate-400 dark:fill-white/30 text-[10px] font-black uppercase tracking-[0.2em]"
                >
                    {payload.value}
                </text>
                <text
                    x={0}
                    y={5}
                    textAnchor="middle"
                    className="fill-blue-600 dark:fill-blue-400 text-[11px] font-black tracking-tighter"
                >
                    {cefrLevel}
                </text>
            </g>
        );
    };

    return (
        <MissionControlCard className={className} title="Linguistic Intelligence Matrix">
            <div className="w-full h-[350px] relative overflow-hidden">
                <ResponsiveContainer width="100%" aspect={1}>
                    <RadarChart 
                        cx="50%" 
                        cy="50%" 
                        outerRadius="60%" 
                        data={data}
                        margin={{ top: 40, right: 60, bottom: 40, left: 60 }}
                    >
                        <PolarGrid stroke="currentColor" className="text-slate-200 dark:text-white/5" strokeDasharray="5 5" />
                        <PolarAngleAxis 
                            dataKey="subject" 
                            tick={<CustomAngleTick />}
                        />
                        <PolarRadiusAxis 
                            angle={30} 
                            domain={[0, 100]} 
                            tick={false} 
                            axisLine={false} 
                        />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: 'rgba(15, 23, 42, 0.8)', 
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '24px',
                                backdropFilter: 'blur(20px)',
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
                            }}
                            itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                        />
                        <Radar
                            name="Mastery"
                            dataKey="A"
                            stroke="#3B82F6"
                            strokeWidth={4}
                            fill="url(#brainGradient)"
                            fillOpacity={0.4}
                            isAnimationActive={true}
                            animationDuration={2000}
                        />
                        <defs>
                            <radialGradient id="brainGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.9} />
                                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.2} />
                            </radialGradient>
                        </defs>
                    </RadarChart>
                </ResponsiveContainer>
                
                {/* Center Icon Overlay */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                    <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center border border-blue-500/20">
                        <Brain size={18} className="text-blue-500" />
                    </div>
                </div>
            </div>
        </MissionControlCard>
    );
};
