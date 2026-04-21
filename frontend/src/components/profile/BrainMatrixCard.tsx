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
    // Custom tick that adds CEFR labels
    const CustomAngleTick = ({ payload, x, y }: any) => {
        const skill = data.find(d => d.subject === payload.value);
        const cefrLevel = skill?.level || 'A1';
        
        return (
            <g transform={`translate(${x},${y})`}>
                <text
                    x={0}
                    y={0}
                    dy={-10}
                    textAnchor="middle"
                    className="fill-slate-400 dark:fill-white/40 text-[9px] font-black uppercase tracking-widest"
                >
                    {payload.value}
                </text>
                <text
                    x={0}
                    y={5}
                    dy={0}
                    textAnchor="middle"
                    className="fill-blue-600 dark:fill-blue-400 text-[10px] font-black"
                >
                    {cefrLevel}
                </text>
            </g>
        );
    };

    return (
        <MissionControlCard className={`${className} !p-0`} title="Linguistic Intelligence Matrix">
            <div className="p-8 pt-4">

                <div className="h-[400px] w-full flex items-center justify-center relative min-w-0">
                    <ResponsiveContainer width="100%" aspect={1.1} debounce={200}>
                        <RadarChart 
                            cx="50%" 
                            cy="50%" 
                            outerRadius="70%" 
                            data={data}
                            margin={{ top: 40, right: 40, bottom: 40, left: 40 }}
                        >
                            <PolarGrid stroke="currentColor" className="text-slate-200 dark:text-white/10" strokeDasharray="4 4" />
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
                                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '16px',
                                    backdropFilter: 'blur(12px)'
                                }}
                                itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
                            />
                            <Radar
                                name="Current Mastery"
                                dataKey="A"
                                stroke="#2563EB"
                                strokeWidth={3}
                                fill="#2563EB"
                                fillOpacity={0.15}
                                isAnimationActive={true}
                            />
                            {/* Inner core for depth */}
                            <Radar
                                name="Core"
                                dataKey="A"
                                stroke="none"
                                fill="#2563EB"
                                fillOpacity={0.05}
                                isAnimationActive={true}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                    
                    {/* Center Icon Overlay */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-blue-600/10 flex items-center justify-center border border-blue-500/20">
                            <Brain size={20} className="text-blue-500" />
                        </div>
                    </div>
                </div>
            </div>
        </MissionControlCard>
    );
};
