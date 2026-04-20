import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AdminService } from '../services/AdminService';
import { LeaderboardEntry } from '../types/admin';
import { Shield, LayoutDashboard, Crown, LogOut, Search, Filter } from 'lucide-react';

interface AdminLeaderboardViewProps {
  onNavigateHome: () => void;
  onNavigateDashboard: () => void;
  onLogout: () => void;
}

export const AdminLeaderboardView: React.FC<AdminLeaderboardViewProps> = ({ onNavigateHome, onNavigateDashboard, onLogout }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    AdminService.getLeaderboard().then(setEntries);
  }, []);

  const filteredEntries = entries.filter(e => e.displayName.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-slate-50 flex flex-col md:flex-row transition-colors duration-300">
      <aside className="w-full md:w-64 bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-50 flex flex-col px-4 py-6 border-r border-slate-200 dark:border-gray-800 transition-colors duration-300">
        <div className="flex items-center gap-3 px-3 mb-12">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-premium">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter uppercase italic">Control<span className="text-blue-600">.</span></h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sys_Admin</p>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          <button onClick={onNavigateDashboard} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-white transition-all">
            <LayoutDashboard className="w-5 h-5" /> Overview
          </button>
          <button className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white shadow-premium transition-all">
            <Crown className="w-5 h-5" /> Rankings
          </button>
        </nav>

        <div className="mt-auto space-y-2">
            <button onClick={onNavigateHome} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
               Learner App
            </button>
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-slate-800 hover:text-red-300 transition-all">
              <LogOut className="w-5 h-5" /> Sign Out
            </button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <header className="mb-10 p-8 bg-white dark:bg-gray-900 rounded-[2.5rem] border border-slate-200 dark:border-gray-800 shadow-premium flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all duration-300">
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-slate-50 tracking-tight uppercase italic italic">Global <span className="text-blue-600">Rankings.</span></h2>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.3em] mt-1">Cross-Organization Performance Metrics</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-600 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" />
              <input 
                type="text" 
                placeholder="PROBE_LEARNER_ID..." 
                className="pl-12 pr-6 py-3 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all w-64 shadow-inner"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="p-3.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-transparent rounded-2xl text-slate-400 hover:text-blue-600 dark:text-slate-400 hover:shadow-premium transition-all">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="bg-white dark:bg-gray-900 rounded-[3rem] border border-slate-200 dark:border-gray-800 shadow-premium overflow-hidden transition-all duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/5 text-slate-400 dark:text-slate-600 text-[10px] font-black uppercase tracking-[0.2em]">
                  <th className="px-8 py-6">RANK</th>
                  <th className="px-8 py-6">IDENTIFIER</th>
                  <th className="px-8 py-6">AFFILIATION</th>
                  <th className="px-8 py-6 text-center">MASTERY</th>
                  <th className="px-8 py-6 text-center">ACCUMULATION</th>
                  <th className="px-8 py-6 text-center">CONSISTENCY</th>
                  <th className="px-8 py-6 text-center">MODULES</th>
                  <th className="px-8 py-6 text-right">LAST_SYNC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((entry, index) => (
                  <motion.tr 
                    initial={{opacity: 0, y: 10}} 
                    animate={{opacity: 1, y: 0}} 
                    transition={{delay: index * 0.05}}
                    key={entry.userId} 
                    className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors border-b border-slate-50 dark:border-white/5"
                  >
                    <td className="px-8 py-6">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shadow-sm ${entry.rank === 1 ? 'bg-amber-400 text-white shadow-amber-400/20' : entry.rank === 2 ? 'bg-slate-200 text-slate-600' : entry.rank === 3 ? 'bg-orange-400 text-white shadow-orange-400/20' : 'bg-slate-50 text-slate-400'}`}>
                        {entry.rank}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-black text-slate-900 dark:text-slate-100 tracking-tight">{entry.displayName}</div>
                      <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{entry.userId}</div>
                    </td>
                    <td className="px-8 py-6 text-xs text-slate-500 font-black uppercase tracking-widest">
                      {entry.teamName || 'External'}
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="inline-block px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-xl border border-blue-100 dark:border-blue-900/50">
                        {entry.level}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center font-black text-slate-900 dark:text-slate-100 tabular-nums italic">
                      {entry.score.toLocaleString()} <span className="text-[9px] not-italic text-slate-300">XP</span>
                    </td>
                    <td className="px-8 py-6 text-center font-black text-orange-500 tabular-nums uppercase text-[10px] tracking-widest">
                      {entry.streak} Day Streak
                    </td>
                    <td className="px-8 py-6 text-center text-xs font-black text-slate-500 uppercase">
                      {entry.completedModules} Units
                    </td>
                    <td className="px-8 py-6 text-right text-[9px] text-slate-400 font-black uppercase tracking-widest">
                      {entry.lastActivityAt}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {filteredEntries.length === 0 && (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400 font-medium text-sm">No learners found matching '{searchTerm}'.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLeaderboardView;
