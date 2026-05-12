import React, { useState } from 'react';
import { BookOpen, Headphones, PenTool, Mic, ChevronRight, Star, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';

export type BadgeType = 'Review Needed' | 'New' | 'Mastered' | null;

export interface TaskOption {
  id: string;
  title: string;
  badge?: BadgeType;
  completed_today?: boolean;
}

export interface SkillCardProps {
  skillName: string;
  description: string;
  icon: React.ReactNode;
  tasks: TaskOption[];
  onStartTask: (taskId: string, difficulty: string) => void;
}

const difficultyLevels = [
  { id: 'easy', label: 'Easy', cefr: 'A1-A2', color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  { id: 'medium', label: 'Medium', cefr: 'B1-B2', color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { id: 'hard', label: 'Hard', cefr: 'C1-C2', color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' },
];

const badgeConfig = {
  'Review Needed': { icon: AlertCircle, className: 'bg-amber-100 text-amber-800 border-amber-200' },
  'New': { icon: Sparkles, className: 'bg-sky-100 text-sky-800 border-sky-200' },
  'Mastered': { icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
};

export const SkillCard: React.FC<SkillCardProps> = ({
  skillName,
  description,
  icon,
  tasks,
  onStartTask
}) => {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);

  const handleStart = () => {
    if (selectedTask && selectedDifficulty) {
      onStartTask(selectedTask, selectedDifficulty);
    }
  };

  return (
    <div className="flex flex-col bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-premium dark:shadow-2xl hover:shadow-3xl transition-all duration-500 overflow-hidden w-full max-w-md font-sans group">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-4 bg-blue-100/50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 rounded-2xl shadow-inner group-hover:scale-110 transition-transform duration-500">
            {icon}
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
              {skillName}
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-white/40 font-bold uppercase tracking-widest mt-0.5">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col gap-6">
        {/* Task Selection */}
        <div>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Available Tasks
          </h4>
          <div className="flex flex-col gap-2">
            {tasks.map((task) => {
              const isSelected = selectedTask === task.id;
              const BadgeIcon = task.badge ? badgeConfig[task.badge].icon : null;
              
              return (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(task.id)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-200 ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-500 ring-1 ring-blue-500 shadow-sm' 
                      : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {task.title}
                    </span>
                    {task.completed_today && (
                      <CheckCircle2 size={14} className="text-emerald-500 fill-emerald-500/10" />
                    )}
                  </div>
                  {task.badge && (
                    <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border ${badgeConfig[task.badge].className}`}>
                      {BadgeIcon && <BadgeIcon className="w-3 h-3" />}
                      {task.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Difficulty Selection */}
        <div className={`transition-opacity duration-300 ${selectedTask ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Select Difficulty
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {difficultyLevels.map((diff) => {
              const isSelected = selectedDifficulty === diff.id;
              return (
                <button
                  key={diff.id}
                  onClick={() => setSelectedDifficulty(diff.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 ${
                    isSelected 
                      ? diff.color + ' ring-1 ring-current shadow-sm' 
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="font-semibold text-sm">{diff.label}</span>
                  <span className="text-[10px] opacity-80 mt-0.5">{diff.cefr}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-6 pt-0 mt-auto">
        <button
          onClick={handleStart}
          disabled={!selectedTask || !selectedDifficulty}
          className={`w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-500 ${
            selectedTask && selectedDifficulty
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-[0_10px_20px_-5px_rgba(37,99,235,0.4)] hover:shadow-[0_15px_25px_-5px_rgba(37,99,235,0.5)] translate-y-0 hover:-translate-y-1'
              : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/20 cursor-not-allowed'
          }`}
        >
          <span>Initialize Protocol</span>
          <ChevronRight className={`w-4 h-4 transition-transform duration-500 ${selectedTask && selectedDifficulty ? 'translate-x-1' : ''}`} />
        </button>
      </div>
    </div>
  );
};
