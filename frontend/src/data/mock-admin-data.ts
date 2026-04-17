import { LeaderboardEntry, AdminDashboardStats } from '../types/admin';

export const mockLeaderboardData: LeaderboardEntry[] = [
  { userId: 'u1', displayName: 'Sarah Jenkins', rank: 1, score: 14500, streak: 32, completedModules: 48, level: 'C1', lastActivityAt: '2h ago', teamName: 'Marketing EU' },
  { userId: 'u2', displayName: 'David Chen', rank: 2, score: 13200, streak: 28, completedModules: 42, level: 'B2+', lastActivityAt: '5h ago', teamName: 'Engineering Core' },
  { userId: 'u3', displayName: 'Elena Rostova', rank: 3, score: 12950, streak: 45, completedModules: 40, level: 'B2', lastActivityAt: '1d ago', teamName: 'Sales Ops' },
  { userId: 'u4', displayName: 'Marcus Webb', rank: 4, score: 11800, streak: 12, completedModules: 35, level: 'B1+', lastActivityAt: 'Just now', teamName: 'Customer Success' },
  { userId: 'u5', displayName: 'Fatima Al-Sayed', rank: 5, score: 10500, streak: 18, completedModules: 31, level: 'B1', lastActivityAt: '3h ago', teamName: 'Marketing EU' },
  { userId: 'u6', displayName: 'Current Learner', rank: 6, score: 9800, streak: 1, completedModules: 0, level: 'A2', lastActivityAt: 'Active', teamName: 'New Hires' }, // We'll highlight this one natively
  { userId: 'u7', displayName: 'Liam O\'Connor', rank: 7, score: 9400, streak: 7, completedModules: 28, level: 'A2+', lastActivityAt: '2d ago', teamName: 'Engineering Support' },
  { userId: 'u8', displayName: 'Sofia Martinez', rank: 8, score: 8100, streak: 4, completedModules: 22, level: 'A2', lastActivityAt: '5m ago', teamName: 'HR Global' },
  { userId: 'u9', displayName: 'Jin Woo', rank: 9, score: 7600, streak: 14, completedModules: 19, level: 'A1+', lastActivityAt: '1w ago', teamName: 'Finance' },
  { userId: 'u10', displayName: 'Amara Diop', rank: 10, score: 6200, streak: 2, completedModules: 15, level: 'A1', lastActivityAt: '12h ago', teamName: 'Customer Success' },
  // Extended points for admin scrolling
  { userId: 'u11', displayName: 'Kenji Sato', rank: 11, score: 5900, streak: 5, completedModules: 14, level: 'A1', lastActivityAt: '1d ago', teamName: 'Sales Ops' },
  { userId: 'u12', displayName: 'Olivia Garcia', rank: 12, score: 4800, streak: 0, completedModules: 10, level: 'Pre-A1', lastActivityAt: '3w ago', teamName: 'New Hires' },
];

export const mockAdminStats: AdminDashboardStats = {
  totalLearners: 1240,
  activeLearners: 892,
  completedAssessments: 1150,
  learnersInProgress: 85,
  averageScore: 8450,
  averageLevel: 'B1'
};
