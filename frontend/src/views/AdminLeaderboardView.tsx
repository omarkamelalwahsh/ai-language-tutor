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
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col px-4 py-6 border-r border-slate-800">
        <div className="flex items-center gap-3 px-3 mb-10">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Admin Console</h1>
            <p className="text-xs text-slate-400">B2B Dashboard</p>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          <button onClick={onNavigateDashboard} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
            <LayoutDashboard className="w-5 h-5" /> Overview
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white transition-all">
            <Crown className="w-5 h-5" /> Leaderboard
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
        <header className="mb-8 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Global Leaderboard</h2>
            <p className="text-slate-500 font-medium text-sm mt-1">Manage and rank all learners across the organization.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search learners..." 
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Rank</th>
                  <th className="px-6 py-4">Learner</th>
                  <th className="px-6 py-4">Team</th>
                  <th className="px-6 py-4 text-center">Level</th>
                  <th className="px-6 py-4 text-center">Score</th>
                  <th className="px-6 py-4 text-center">Streak</th>
                  <th className="px-6 py-4 text-center">Modules</th>
                  <th className="px-6 py-4 text-right">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map((entry, index) => (
                  <motion.tr 
                    initial={{opacity: 0, y: 10}} 
                    animate={{opacity: 1, y: 0}} 
                    transition={{delay: index * 0.05}}
                    key={entry.userId} 
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${entry.rank === 1 ? 'bg-amber-100 text-amber-600' : entry.rank === 2 ? 'bg-slate-200 text-slate-600' : entry.rank === 3 ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-500'}`}>
                        {entry.rank}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{entry.displayName}</div>
                      <div className="text-xs text-slate-400 font-mono">{entry.userId}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                      {entry.teamName || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md border border-indigo-100">
                        {entry.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-indigo-600 tabular-nums">
                      {entry.score.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-orange-500 tabular-nums">
                      {entry.streak} 🔥
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-slate-600">
                      {entry.completedModules}
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-slate-400 font-medium">
                      {entry.lastActivityAt}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {filteredEntries.length === 0 && (
              <div className="text-center py-12 text-slate-500 font-medium text-sm">No learners found matching '{searchTerm}'.</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminLeaderboardView;
