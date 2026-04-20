import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, Medal, Search, Filter, ArrowUpDown, Shield,
  MoreVertical, Download, ChevronRight, UserCircle
} from 'lucide-react';
import { mockLeaderboardData } from '../../data/mock-admin-data';
import { LeaderboardEntry } from '../../types/admin';

export const AdminLeaderboardView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Basic filtering for demo
  const filteredData = mockLeaderboardData.filter(user => 
    user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.teamName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-1 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-blue-600 dark:text-blue-400" /> Learner Rankings
          </h2>
          <p className="text-slate-500 text-sm">Comprehensive view of all active learners and their progress metrics.</p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition-colors text-sm">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search users or teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 text-sm font-medium">
              <Filter className="w-4 h-4" /> Filter <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 rounded-full">All</span>
            </button>
          </div>
        </div>

        {/* The Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors w-24">
                  <div className="flex items-center gap-1">Rank <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4">Learner</th>
                <th className="px-6 py-4">Team</th>
                <th className="px-6 py-4">Level</th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-1">Score <ArrowUpDown className="w-3 h-3" /></div>
                </th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((user, idx) => (
                <tr key={user.userId} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center justify-center w-8 h-8 rounded-lg font-bold
                      ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-200 text-slate-600' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500'}
                    ">
                      {user.rank}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                        {user.displayName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{user.displayName}</p>
                        <p className="text-xs text-slate-500">Last active: {user.lastActivityAt}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {user.teamName || 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">{user.level}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{user.score.toLocaleString()}</span>
                      <span className="text-xs text-orange-500">{user.streak} day streak</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-slate-400 hover:text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:bg-blue-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-slate-700 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredData.length === 0 && (
            <div className="p-12 text-center text-slate-500">
              No learners found matching "{searchTerm}"
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-sm text-slate-500">
          Showing 1 to {filteredData.length} of {filteredData.length} results
          <div className="flex gap-1">
             <button className="px-3 py-1 border border-slate-200 rounded bg-white text-slate-400 disabled:opacity-50" disabled>Prev</button>
             <button className="px-3 py-1 border border-slate-200 rounded bg-white hover:bg-slate-50 text-slate-700">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
};
