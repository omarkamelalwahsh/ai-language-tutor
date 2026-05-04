import React from 'react';
import { 
  Home, Map as MapIcon, BarChart3, History, BookOpen, 
  Settings, LogOut, Trophy 
} from 'lucide-react';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  isDanger?: boolean;
}

const NavItem = ({ icon, label, active, onClick, isDanger }: NavItemProps) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${active
        ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 border border-blue-100 dark:border-blue-500/30 shadow-premium dark:shadow-blue-500/10'
        : isDanger
            ? 'text-slate-500 dark:text-slate-50/30 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400'
            : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-gray-800 hover:text-slate-900 dark:hover:text-slate-50'
    }`}
  >
    {icon}
    <span className="text-sm font-bold">{label}</span>
  </button>
);

interface SidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onLogout?: () => void;
}

export const Sidebar = ({ activeTab, onTabChange, onLogout }: SidebarProps) => (
  <aside className="w-64 bg-white dark:bg-gray-900/40 backdrop-blur-xl flex flex-col p-6 shrink-0 z-10 hidden md:flex border-r border-slate-200 dark:border-gray-800 shadow-premium dark:shadow-md h-full">
    <div className="flex items-center gap-3 mb-10 px-2 cursor-pointer transition-transform hover:scale-105 active:scale-95 group" onClick={() => onTabChange('home')}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-600 shadow-premium shadow-blue-500/30 group-hover:shadow-blue-500/50 transition-all">
        <Trophy size={20} className="text-white" fill="currentColor" />
      </div>
      <div>
        <h1 className="text-xl font-black text-slate-900 dark:text-slate-50 leading-tight tracking-tight">Language AI</h1>
        <p className="text-[10px] font-black text-blue-600 dark:text-blue-500 uppercase tracking-widest leading-none mt-1">Linguistic Engine</p>
      </div>
    </div>

    <nav className="space-y-1.5 flex-1">
      <NavItem icon={<Home size={18} />} label="Home" active={activeTab === 'home'} onClick={() => onTabChange('home')} />
      <NavItem icon={<MapIcon size={18} />} label="My Journey" active={activeTab === 'journey'} onClick={() => onTabChange('journey')} />
      <NavItem icon={<BarChart3 size={18} />} label="Analytics" active={activeTab === 'analytics'} onClick={() => onTabChange('analytics')} />
      <NavItem icon={<History size={18} />} label="History" active={activeTab === 'history'} onClick={() => onTabChange('history')} />
      <NavItem icon={<BookOpen size={18} />} label="Practice" active={activeTab === 'practice'} onClick={() => onTabChange('practice')} />
    </nav>

    <div className="mt-auto pt-6 border-t border-white/5 space-y-1.5">
      <NavItem icon={<Settings size={18} />} label="Settings" active={activeTab === 'settings'} onClick={() => onTabChange('settings')} />
      {onLogout && <NavItem icon={<LogOut size={18} />} label="Sign Out" onClick={onLogout} isDanger />}
    </div>
  </aside>
);
