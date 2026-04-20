import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AdminService } from '../services/AdminService';
import { LeaderboardEntry } from '../types/admin';
import { Crown, ArrowLeft, Trophy, Flame, Star } from 'lucide-react';

interface UserLeaderboardViewProps {
  onBack: () => void;
  currentUserId?: string;
}

export const UserLeaderboardView: React.FC<UserLeaderboardViewProps> = ({ onBack }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get real ID from Supabase session
    import('../lib/supabaseClient').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setUserId(user.id);
      });
    });

    AdminService.getLeaderboard().then(data => setEntries(data));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 p-6 md:p-10 font-sans text-slate-900 dark:text-slate-50 selection:bg-blue-500/30 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-2xl text-slate-400 hover:text-blue-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800 transition-all font-black text-[10px] uppercase tracking-widest shadow-premium">
            <ArrowLeft className="w-4 h-4" /> Return to Core
          </button>
        </header>

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-amber-400 to-orange-500 rounded-[2.5rem] shadow-premium mb-8 shadow-orange-500/10">
            <Trophy className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-5xl font-black tracking-tight text-slate-900 dark:text-slate-50 mb-3 uppercase italic">Global Ranking</h1>
          <p className="text-slate-400 dark:text-slate-500 font-black text-[10px] uppercase tracking-[0.2em] max-w-lg mx-auto leading-relaxed">Synchronizing performance metrics across the linguistic collective.</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-premium dark:shadow-md border border-slate-200 dark:border-gray-800 overflow-hidden relative p-4">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="relative z-10">
            {entries.length === 0 ? (
              <div className="py-24 text-center text-slate-400 font-black uppercase tracking-widest text-xs">Awaiting ranking synchronicity...</div>
            ) : (
              <div className="flex flex-col gap-2">
                {entries.map((entry, i) => {
                  const isCurrentUser = entry.userId === userId;
                  
                  return (
                    <motion.div 
                      key={entry.userId}
                      initial={{opacity: 0, y: 10}}
                      animate={{opacity: 1, y: 0}}
                      transition={{delay: i * 0.05}}
                      className={`flex items-center p-5 sm:p-6 rounded-[2rem] transition-all hover:scale-[1.01] ${
                        isCurrentUser 
                          ? 'bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-600 shadow-premium' 
                          : 'bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-blue-700 shadow-premium'
                      }`}
                    >
                      <div className="w-12 sm:w-16 flex justify-center items-center shrink-0">
                        {entry.rank === 1 ? <Crown className="w-8 h-8 text-amber-500 drop-shadow-sm" /> : 
                         entry.rank === 2 ? <Crown className="w-7 h-7 text-slate-400" /> : 
                         entry.rank === 3 ? <Crown className="w-6 h-6 text-orange-400" /> : 
                         <span className="text-lg font-bold text-slate-400">{entry.rank}</span>}
                      </div>
                      
                      <div className="flex-1 min-w-0 px-6">
                        <div className="flex items-center gap-3">
                          <h3 className={`font-black tracking-tight truncate ${isCurrentUser ? 'text-blue-600 dark:text-blue-400 text-xl' : 'text-slate-800 dark:text-slate-200 text-lg'}`}>
                            {entry.displayName}
                          </h3>
                          {isCurrentUser && <span className="bg-blue-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-full tracking-widest shadow-sm">Protocol_Owner</span>}
                        </div>
                        <div className="flex items-center gap-4 mt-1.5">
                          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded-md border border-slate-100 dark:border-transparent">Lvl {entry.level}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Star size={12} className="text-amber-400"/> {entry.completedModules} lessons</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tighter italic">{entry.score.toLocaleString()} <span className="text-sm font-black text-slate-300 dark:text-slate-700 not-italic ml-1 tracking-widest uppercase">XP</span></div>
                        <div className="text-[10px] font-black text-orange-600 dark:text-orange-500 flex items-center justify-end gap-1.5 mt-1 animate-pulse uppercase tracking-[0.2em]">
                          {entry.streak} Day Streak <Flame size={14} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserLeaderboardView;
