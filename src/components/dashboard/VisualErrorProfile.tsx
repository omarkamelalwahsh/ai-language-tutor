import React, { useEffect, useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Target, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface ErrorAnalysisRow {
  subject: string;
  A: number;
  fullMark: number;
  mistakesCount: number;
}

export const VisualErrorProfile = () => {
  const [data, setData] = useState<ErrorAnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchErrorAnalysis = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: analysis, error: fetchError } = await supabase
          .from('user_error_analysis')
          .select('category, error_rate, last_updated')
          .eq('user_id', user.id);

        if (fetchError) throw fetchError;

        if (analysis && analysis.length > 0) {
          const formatted = analysis.map(row => ({
            subject: row.category?.charAt(0).toUpperCase() + row.category?.slice(1) || 'Unknown',
            A: Math.round((row.error_rate || 0) * 100),
            fullMark: 100,
            mistakesCount: 0 // Placeholder as we now read error_rate directly
          }));
          
          setData(formatted);
        } else {
          setData([]);
        }
      } catch (err: any) {
        console.error('[VisualErrorProfile] Fetch Error:', err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchErrorAnalysis();
  }, []);

  if (loading) {
    return (
      <div className="h-[450px] w-full flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
        <Activity className="w-10 h-10 text-indigo-400 animate-pulse mb-4" />
        <p className="text-slate-500 font-medium">Analyzing diagnostic patterns...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="h-[450px] w-full bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-50 via-white to-white" />
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
            <Target className="w-10 h-10 text-indigo-300" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">No Diagnostic Data Yet</h3>
          <p className="text-slate-500 max-w-md">
            Complete your first adaptive assessment to generate your visual error profile and uncover targeted insights.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-8 pb-10 w-full rounded-2xl bg-white border border-slate-100 shadow-xl overflow-hidden relative"
    >
      {/* Decorative Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="p-2 bg-indigo-100/50 rounded-xl">
                <Target className="w-6 h-6 text-indigo-600" />
              </span>
              Visual Error Profile
            </h3>
            <p className="text-sm text-slate-500 font-medium mt-1">Diagnostic view of error density across skills.</p>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 text-sm">
             <div className="flex items-center gap-1.5 font-bold text-slate-600">
                <div className="w-3 h-3 bg-indigo-500 rounded-sm" /> Error Density
             </div>
          </div>
        </div>

        <div className="h-[450px] w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
              <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <PolarAngleAxis 
                dataKey="subject" 
                tick={{ fill: '#475569', fontSize: 13, fontWeight: 700 }} 
              />
              <Tooltip 
                 contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' }}
                 formatter={(value: any, name: any, props: any) => [`${value}% Error Rate`, `Based on ${props.payload.mistakesCount} mistakes`]}
              />
              <Radar
                name="Error Profile"
                dataKey="A"
                stroke="#6366f1"
                strokeWidth={3}
                fill="#818cf8"
                fillOpacity={0.35}
                activeDot={{ r: 6, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
};

