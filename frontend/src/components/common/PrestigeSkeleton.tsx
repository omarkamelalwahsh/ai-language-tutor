import React from 'react';
import { motion } from 'motion/react';

interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'circle' | 'text';
}

export const PrestigeSkeleton: React.FC<SkeletonProps> = ({ 
  className = "", 
  variant = 'rect' 
}) => {
  const baseClasses = "bg-white/5 relative overflow-hidden ring-1 ring-white/5";
  const variantClasses = {
    rect: "rounded-2xl",
    circle: "rounded-full",
    text: "rounded-md h-4 w-full"
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      <motion.div
        animate={{
          x: ['-100%', '100%']
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent w-full h-full"
      />
    </div>
  );
};

export const DashboardSkeleton = () => (
  <div className="space-y-8 p-8 animate-pulse">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <PrestigeSkeleton className="h-40" />
      <PrestigeSkeleton className="h-40" />
      <PrestigeSkeleton className="h-40" />
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <PrestigeSkeleton className="h-[400px]" />
      <div className="space-y-4">
        <PrestigeSkeleton className="h-20" />
        <PrestigeSkeleton className="h-20" />
        <PrestigeSkeleton className="h-20" />
      </div>
    </div>
  </div>
);
