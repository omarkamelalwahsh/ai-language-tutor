import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AdminService } from '../services/AdminService';
import { AdminDashboardStats, LeaderboardEntry } from '../types/admin';
import { Users, CheckCircle, Activity, Target, Shield, LayoutDashboard, Crown, LogOut } from 'lucide-react';

interface AdminDashboardViewProps {
  onNavigateHome: () => void;
  onNavigateLeaderboard: () => void;
  onLogout: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onNavigateHome, onNavigateLeaderboard, onLogout }) => {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);

  useEffect(() => {
    AdminService.getDashboardStats().then(setStats);
  }, []);

  if (!stats) return <div className="flex justify-center items-center h-screen">Loading...</div>;

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
          <button className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white shadow-premium transition-all">
            <LayoutDashboard className="w-5 h-5" /> Overview
          </button>
          <button onClick={onNavigateLeaderboard} className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-white transition-all">
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
        <header className="mb-12">
          <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase italic mb-1">Organization <span className="text-blue-600">Overview.</span></h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Engagement & Performance Analytics</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 transition-all flex items-center gap-6 shadow-premium p-8 rounded-[2rem]">
            <div className="p-5 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-2xl shadow-sm"><Users className="w-8 h-8" /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">TOTAL_LEARNERS</p>
              <p className="text-4xl font-black text-slate-900 dark:text-slate-50 italic">{stats.totalLearners}</p>
            </div>
          </motion.div>

          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.1}} className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 transition-all flex items-center gap-6 shadow-premium p-8 rounded-[2rem]">
            <div className="p-5 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 rounded-2xl shadow-sm"><Activity className="w-8 h-8" /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ACTIVE_SESSIONS</p>
              <p className="text-4xl font-black text-slate-900 dark:text-slate-50 italic">{stats.activeLearners}</p>
            </div>
          </motion.div>

          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.2}} className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 transition-all flex items-center gap-6 shadow-premium p-8 rounded-[2rem]">
            <div className="p-5 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 rounded-2xl shadow-sm"><CheckCircle className="w-8 h-8" /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SCANS_COMPLETED</p>
              <p className="text-4xl font-black text-slate-900 dark:text-slate-50 italic">{stats.completedAssessments}</p>
            </div>
          </motion.div>

          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.3}} className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 transition-all flex items-center gap-6 shadow-premium p-8 rounded-[2rem]">
            <div className="p-5 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-2xl shadow-sm"><Target className="w-8 h-8" /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">AGGREGATE_MASTERY</p>
              <p className="text-4xl font-black text-slate-900 dark:text-slate-50 italic">{stats.averageScore} <span className="text-sm font-black text-slate-300 not-italic uppercase tracking-widest">XP</span></p>
            </div>
          </motion.div>
        </div>

        {/* Level Distribution Placeholder */}
        <section className="bg-white dark:bg-gray-900 p-10 rounded-[3rem] border border-slate-200 dark:border-gray-800 shadow-premium relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-50 mb-8 relative z-10 italic uppercase">Linguistic <span className="text-blue-600">Distribution.</span></h3>
          <div className="relative z-10 h-12 w-full bg-slate-50 dark:bg-gray-950 rounded-2xl overflow-hidden flex shadow-inner">
             <div className="h-full bg-blue-200" style={{width: '10%'}} title="A1" />
             <div className="h-full bg-blue-300" style={{width: '25%'}} title="A2" />
             <div className="h-full bg-blue-500" style={{width: '40%'}} title="B1" />
             <div className="h-full bg-blue-600" style={{width: '20%'}} title="B2" />
             <div className="h-full bg-blue-800" style={{width: '5%'}} title="C1" />
          </div>
          <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mt-5 px-2">
             <span>A1 (10%)</span>
             <span>A2 (25%)</span>
             <span>B1 (40%)</span>
             <span>B2 (20%)</span>
             <span>C1 (5%)</span>
          </div>
        </section>

      </main>
    </div>
  );
};

export default AdminDashboardView;
