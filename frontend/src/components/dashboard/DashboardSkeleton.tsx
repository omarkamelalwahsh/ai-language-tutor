import React from 'react';
import { motion } from 'motion/react';

const Shimmer = () => (
    <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent z-10"
    />
);

const SkeletonCard = ({ className = "" }: { className?: string }) => (
    <div className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] relative overflow-hidden ${className}`}>
        <Shimmer />
        <div className="absolute inset-0 bg-white/[0.02]" />
    </div>
);

export const DashboardSkeleton = () => {
    return (
        <div className="max-w-7xl mx-auto px-6 pt-8 pb-40">
            {/* Top KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                {[1, 2, 3, 4].map(i => (
                    <SkeletonCard key={i} className="h-32" />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column (Main) */}
                <div className="lg:col-span-8 space-y-8">
                    {/* Action Hub */}
                    <div className="bg-white/5 border border-white/10 rounded-[3rem] p-10 relative overflow-hidden h-[300px]">
                        <Shimmer />
                        <div className="w-1/3 h-8 bg-white/5 rounded-lg mb-6" />
                        <div className="w-2/3 h-12 bg-white/10 rounded-xl mb-4" />
                        <div className="w-1/2 h-4 bg-white/5 rounded-md mb-10" />
                        <div className="w-40 h-14 bg-white/10 rounded-2xl" />
                    </div>

                    {/* Analytics Chart */}
                    <SkeletonCard className="h-[400px]" />
                </div>

                {/* Right Column (Insights) */}
                <div className="lg:col-span-4 space-y-8">
                    <SkeletonCard className="h-[250px]" />
                    <SkeletonCard className="h-[350px]" />
                </div>
            </div>
            
            <div className="mt-12">
                 <p className="text-center text-white/20 font-black uppercase tracking-[0.3em] animate-pulse">Syncing Neural Architecture...</p>
            </div>
        </div>
    );
};
