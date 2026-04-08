import React, { useEffect, useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Activity, Target } from 'lucide-react';
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

        // Fetching from user_error_analysis table (Source of Truth)
        const { data: analysis, error: fetchError } = await supabase
          .from('user_error_analysis')
          .select('category, error_rate, mistakes_count')
          .eq('user_id', user.id);

        if (fetchError) throw fetchError;

        if (analysis && analysis.length > 0) {
          const formatted = analysis.map(row => ({
            subject: row.category.charAt(0).toUpperCase() + row.category.slice(1),
            A: Math.round(row.error_rate * 100), // Convert 0.75 to 75
            fullMark: 100,
            mistakesCount: row.mistakes_count
          }));
          setData(formatted);
        } else {
          // Fallback if no analysis exists yet
          setData([
            { subject: 'Listening', A: 0, fullMark: 100, mistakesCount: 0 },
            { subject: 'Reading', A: 0, fullMark: 100, mistakesCount: 0 },
            { subject: 'Speaking', A: 0, fullMark: 100, mistakesCount: 0 },
            { subject: 'Writing', A: 0, fullMark: 100, mistakesCount: 0 },
          ]);
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

  const criticalWeakness = [...data].sort((a, b) => b.A - a.A)[0];

  if (loading) {
    return (
      <div className="h-80 flex items-center justify-center bg-slate-900/40 backdrop-blur-md rounded-2xl border border-white/10">
        <Activity className="w-8 h-8 text-indigo-400 animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-2xl text-white overflow-hidden relative"
    >
      {/* Decorative Glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            Visual Diagnostic Profile
          </h3>
          <Target className="w-4 h-4 text-slate-500" />
        </div>

        <div className="min-h-[300px] w-full">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                <PolarGrid stroke="#ffffff1a" />
                <PolarAngleAxis 
                  dataKey="subject" 
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} 
                />
                <Radar
                  name="Error Density"
                  dataKey="A"
                  stroke="#818cf8"
                  fill="#6366f1"
                  fillOpacity={0.5}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 italic text-sm">
              No diagnostic data available
            </div>
          )}
        </div>

        <AnimatePresence>
          {criticalWeakness && criticalWeakness.A > 0 && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mt-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20"
            >
              <div className="flex items-center gap-2 text-rose-400 font-bold text-xs mb-2 uppercase tracking-tighter">
                <AlertTriangle className="w-3.5 h-3.5" />
                Critical Weakness Detected
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-black text-white">{criticalWeakness.subject}</span>
                <span className="text-rose-500 font-black text-xl">{criticalWeakness.A}% <span className="text-[10px] text-rose-400/60 uppercase">Err</span></span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 italic italic">
                Based on {criticalWeakness.mistakesCount} identified gaps in current session
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-4 flex justify-center">
            <button className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest hover:text-indigo-300 transition-colors">
                View Full Technical Report →
            </button>
        </div>
      </div>
    </motion.div>
  );
};
