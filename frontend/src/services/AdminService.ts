import { AdminDashboardStats, LeaderboardEntry } from "../types/admin";

export const mockLeaderboardData: LeaderboardEntry[] = [
  { userId: "u1", displayName: "Sarah Chen", rank: 1, score: 2450, streak: 14, completedModules: 42, level: "B2", lastActivityAt: "2 hrs ago", teamName: "Engineering" },
  { userId: "u2", displayName: "Marcus Johnson", rank: 2, score: 2320, streak: 8, completedModules: 38, level: "B1", lastActivityAt: "1 hr ago", teamName: "Sales" },
  { userId: "u3", displayName: "Learner (You)", rank: 3, score: 2150, streak: 5, completedModules: 35, level: "B1", lastActivityAt: "Just now", teamName: "Design" },
  { userId: "u4", displayName: "Elena Rodriguez", rank: 4, score: 1980, streak: 21, completedModules: 30, level: "A2", lastActivityAt: "5 hrs ago", teamName: "Marketing" },
  { userId: "u5", displayName: "David Kim", rank: 5, score: 1850, streak: 3, completedModules: 28, level: "A2", lastActivityAt: "1 day ago", teamName: "Engineering" },
  { userId: "u6", displayName: "Aisha Patel", rank: 6, score: 1720, streak: 12, completedModules: 25, level: "B1", lastActivityAt: "3 hrs ago", teamName: "Product" },
  { userId: "u7", displayName: "Tom Wilson", rank: 7, score: 1550, streak: 2, completedModules: 22, level: "A1", lastActivityAt: "2 days ago", teamName: "Sales" },
];

export const mockAdminStats: AdminDashboardStats = {
  totalLearners: 1250,
  activeLearners: 840,
  completedAssessments: 1100,
  learnersInProgress: 150,
  averageScore: 1845,
  averageLevel: "B1"
};

export class AdminService {
  static async getDashboardStats(): Promise<AdminDashboardStats | null> {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('[AdminService] Admin stats fetch failed', e);
    }
    return null;
  }

  static async getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('[AdminService] Leaderboard fetch failed', e);
    }
    return [];
  }
}
