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
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white transition-all">
            <LayoutDashboard className="w-5 h-5" /> Overview
          </button>
          <button onClick={onNavigateLeaderboard} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
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
        <header className="mb-10">
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Organization Overview</h2>
          <p className="text-slate-500 font-medium mt-1">Monitor learning engagement and completion rates across your teams.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><Users className="w-8 h-8" /></div>
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Total Learners</p>
              <p className="text-3xl font-extrabold text-slate-900">{stats.totalLearners}</p>
            </div>
          </motion.div>

          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.1}} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl"><Activity className="w-8 h-8" /></div>
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Active Now</p>
              <p className="text-3xl font-extrabold text-slate-900">{stats.activeLearners}</p>
            </div>
          </motion.div>

          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.2}} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
            <div className="p-4 bg-purple-50 text-purple-600 rounded-xl"><CheckCircle className="w-8 h-8" /></div>
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Assessments Done</p>
              <p className="text-3xl font-extrabold text-slate-900">{stats.completedAssessments}</p>
            </div>
          </motion.div>

          <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.3}} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl"><Target className="w-8 h-8" /></div>
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Avg Score</p>
              <p className="text-3xl font-extrabold text-slate-900">{stats.averageScore} <span className="text-lg text-slate-400 font-medium">/ 3000</span></p>
            </div>
          </motion.div>
        </div>

        {/* Level Distribution Placeholder */}
        <section className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <h3 className="text-xl font-bold text-slate-900 mb-6 relative z-10">Average Level: <span className="text-indigo-600">{stats.averageLevel}</span></h3>
          <div className="relative z-10 h-10 w-full bg-slate-100 rounded-full overflow-hidden flex">
             <div className="h-full bg-red-400" style={{width: '10%'}} title="A1" />
             <div className="h-full bg-orange-400" style={{width: '25%'}} title="A2" />
             <div className="h-full bg-indigo-500" style={{width: '40%'}} title="B1" />
             <div className="h-full bg-blue-500" style={{width: '20%'}} title="B2" />
             <div className="h-full bg-emerald-500" style={{width: '5%'}} title="C1" />
          </div>
          <div className="flex justify-between text-xs font-bold text-slate-500 mt-3 px-2">
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
