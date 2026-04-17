export type UserRole = "user" | "admin";

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  rank: number;
  score: number;
  streak: number;
  completedModules: number;
  level: string;
  lastActivityAt: string;
  teamName?: string;
}

export interface AdminDashboardStats {
  totalLearners: number;
  activeLearners: number;
  completedAssessments: number;
  learnersInProgress: number;
  averageScore: number;
  averageLevel: string;
}
