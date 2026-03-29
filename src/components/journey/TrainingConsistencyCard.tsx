import React from 'react';
import { motion } from 'motion/react';
import { Flame, Calendar, Zap } from 'lucide-react';
import { TrainingProgress } from '../../types/journey';
import { CalendarHeatmap } from './CalendarHeatmap';

interface TrainingConsistencyCardProps {
  progress: TrainingProgress;
}

export const TrainingConsistencyCard: React.FC<TrainingConsistencyCardProps> = ({ progress }) => {
  const { totalTrainingDays, currentStreak, longestStreak, monthlyActivity } = progress;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.1 }}
      className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-5">
        <div className="p-2 bg-orange-50 text-orange-600 rounded-xl border border-orange-100">
          <Flame className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Training Consistency</h3>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{totalTrainingDays}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Total Days</p>
        </div>
        <div className="bg-orange-50 p-3 rounded-xl border border-orange-100 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
          </div>
          <p className="text-2xl font-extrabold text-orange-600">{currentStreak}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Streak</p>
        </div>
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Zap className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900">{longestStreak ?? '—'}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Best</p>
        </div>
      </div>

      {/* Calendar Heatmap */}
      <CalendarHeatmap monthlyActivity={monthlyActivity} />
    </motion.div>
  );
};
