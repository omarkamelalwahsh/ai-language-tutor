import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Clock } from 'lucide-react';
import { TrainingProgress } from '../../types/journey';
import { levelLabel } from '../../lib/forecast-logic';

interface ProgressSummaryCardProps {
  progress: TrainingProgress;
}

export const ProgressSummaryCard: React.FC<ProgressSummaryCardProps> = ({ progress }) => {
  const {
    currentLevel,
    targetLevel,
    progressPercent,
    estimatedMonthsToNextLevel,
  } = progress;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.05 }}
      className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-5">
        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
          <TrendingUp className="w-5 h-5" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Level Progress</h3>
      </div>

      {/* Level badges */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-center">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-1.5 mx-auto shadow-md shadow-indigo-200/50">
            <span className="text-lg font-extrabold text-white">{currentLevel}</span>
          </div>
          <p className="text-xs font-bold text-slate-400">{levelLabel(currentLevel)}</p>
        </div>

        {/* Progress arrow */}
        <div className="flex-1 mx-4 flex flex-col items-center gap-1">
          <span className="text-2xl font-extrabold text-indigo-600">{progressPercent}%</span>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
            />
          </div>
        </div>

        <div className="text-center">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-1.5 mx-auto border-2 border-dashed border-slate-300">
            <span className="text-lg font-extrabold text-slate-400">{targetLevel}</span>
          </div>
          <p className="text-xs font-bold text-slate-400">{levelLabel(targetLevel)}</p>
        </div>
      </div>

      {/* Estimate */}
      {estimatedMonthsToNextLevel > 0 && (
        <div className="flex items-center gap-2 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100 mt-2">
          <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <p className="text-sm text-slate-600 font-medium">
            Estimated <span className="font-bold text-slate-800">{estimatedMonthsToNextLevel} month{estimatedMonthsToNextLevel > 1 ? 's' : ''}</span> to reach {targetLevel} at your current pace.
          </p>
        </div>
      )}
    </motion.div>
  );
};
