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
        
        // Push text away dynamically based on position
        let verticalOffset = 0;
        const val = payload.value.toLowerCase();
        if (val.includes('listening')) verticalOffset = 15;
        if (val.includes('speaking')) verticalOffset = -15;

        return (
            <g transform={`translate(${x},${y})`}>
                <text
                    x={0}
                    y={verticalOffset}
                    dy={-5}
                    textAnchor="middle"
                    className="fill-slate-400 dark:fill-white/40 text-[9px] font-black uppercase tracking-widest"
                >
                    {payload.value}
                </text>
                <text
                    x={0}
                    y={verticalOffset + 10}
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
        <MissionControlCard className={className} title="Linguistic Intelligence Matrix">
            <div className="w-full h-[350px] relative overflow-hidden">
                <ResponsiveContainer width="100%" aspect={1} minWidth={0} minHeight={0}>
                    <RadarChart 
                        cx="50%" 
                        cy="50%" 
                        outerRadius="50%" 
                        data={data}
                        margin={{ top: 50, right: 70, bottom: 50, left: 70 }}
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
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                    <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center border border-blue-500/20">
                        <Brain size={18} className="text-blue-500" />
                    </div>
                </div>
            </div>
        </MissionControlCard>
    );
};
