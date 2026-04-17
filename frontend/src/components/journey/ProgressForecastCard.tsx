import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, AlertTriangle, Rocket, Trophy } from 'lucide-react';
import { ForecastMessage } from '../../lib/forecast-logic';

interface ProgressForecastCardProps {
  forecast: ForecastMessage;
}

const sentimentConfig = {
  motivating: {
    icon: <Rocket className="w-6 h-6" />,
    bg: 'bg-gradient-to-br from-indigo-600 to-violet-700',
    iconBg: 'bg-white/20',
    textColor: 'text-white',
    subColor: 'text-indigo-100',
  },
  encouraging: {
    icon: <Sparkles className="w-6 h-6" />,
    bg: 'bg-gradient-to-br from-indigo-500 to-blue-600',
    iconBg: 'bg-white/20',
    textColor: 'text-white',
    subColor: 'text-blue-100',
  },
  warning: {
    icon: <AlertTriangle className="w-6 h-6" />,
    bg: 'bg-gradient-to-br from-amber-500 to-orange-600',
    iconBg: 'bg-white/20',
    textColor: 'text-white',
    subColor: 'text-amber-100',
  },
  celebrating: {
    icon: <Trophy className="w-6 h-6" />,
    bg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    iconBg: 'bg-white/20',
    textColor: 'text-white',
    subColor: 'text-emerald-100',
  },
};

export const ProgressForecastCard: React.FC<ProgressForecastCardProps> = ({ forecast }) => {
  const config = sentimentConfig[forecast.sentiment];

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={`${config.bg} rounded-3xl p-8 relative overflow-hidden shadow-lg`}
    >
      {/* Decorative blobs */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -translate-y-1/4 translate-x-1/4 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl translate-y-1/4 -translate-x-1/4 pointer-events-none" />

      <div className="relative z-10 flex items-start gap-4">
        <div className={`${config.iconBg} p-3 rounded-2xl flex-shrink-0`}>
          {config.icon}
        </div>
        <div>
          <h3 className={`text-xl font-extrabold ${config.textColor} mb-2 leading-tight`}>
            {forecast.headline}
          </h3>
          <p className={`${config.subColor} text-sm font-medium leading-relaxed`}>
            {forecast.subtext}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
