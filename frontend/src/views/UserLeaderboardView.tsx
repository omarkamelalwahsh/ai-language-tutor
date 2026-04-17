import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AdminService } from '../services/AdminService';
import { LeaderboardEntry } from '../types/admin';
import { Crown, ArrowLeft, Trophy, Flame, Star } from 'lucide-react';

interface UserLeaderboardViewProps {
  onBack: () => void;
  currentUserId?: string;
}

export const UserLeaderboardView: React.FC<UserLeaderboardViewProps> = ({ onBack, currentUserId = "u3" }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    // In a real app we might fetch a "public" limited version of the leaderboard,
    // but here we just reuse the mock service and format it nicely.
    AdminService.getLeaderboard().then(data => setEntries(data.slice(0, 50)));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10 font-sans text-slate-900 selection:bg-indigo-500/30">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors font-bold text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        </header>

        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl shadow-lg mb-6 shadow-orange-500/20">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-3">Global Leaderboard</h1>
          <p className="text-slate-500 font-medium text-lg max-w-lg mx-auto">See how you stack up against other learners. Keep up your streak and earn points by completing sessions.</p>
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <div className="p-2 relative z-10">
            {entries.length === 0 ? (
              <div className="py-20 text-center text-slate-500 font-medium">Loading leaderboard ranking...</div>
            ) : (
              <div className="flex flex-col gap-2">
                {entries.map((entry, i) => {
                  const isCurrentUser = entry.userId === currentUserId;
                  const isTop3 = entry.rank <= 3;
                  
                  return (
                    <motion.div 
                      key={entry.userId}
                      initial={{opacity: 0, scale: 0.95}}
                      animate={{opacity: 1, scale: 1}}
                      transition={{delay: i * 0.05}}
                      className={`flex items-center p-4 sm:p-5 rounded-2xl transition-all ${
                        isCurrentUser ? 'bg-indigo-50 border-2 border-indigo-500 shadow-md shadow-indigo-100' : 'bg-white border border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="w-12 sm:w-16 flex justify-center items-center shrink-0">
                        {entry.rank === 1 ? <Crown className="w-8 h-8 text-amber-500 drop-shadow-sm" /> : 
                         entry.rank === 2 ? <Crown className="w-7 h-7 text-slate-400" /> : 
                         entry.rank === 3 ? <Crown className="w-6 h-6 text-orange-400" /> : 
                         <span className="text-lg font-bold text-slate-400">{entry.rank}</span>}
                      </div>
                      
                      <div className="flex-1 min-w-0 px-4">
                        <div className="flex items-center gap-2">
                          <h3 className={`font-bold truncate ${isCurrentUser ? 'text-indigo-900 text-lg' : 'text-slate-800'}`}>
                            {entry.displayName}
                          </h3>
                          {isCurrentUser && <span className="bg-indigo-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest">You</span>}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">Level {entry.level}</span>
                          <span className="text-xs font-bold text-slate-400 flex items-center gap-1"><Star className="w-3 h-3"/> {entry.completedModules} lessons</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{entry.score.toLocaleString()} <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">XP</span></div>
                        <div className="text-sm font-bold text-orange-500 flex items-center justify-end gap-1 mt-1">
                          {entry.streak} <Flame className="w-4 h-4" />
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
