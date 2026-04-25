import { supabase } from '../lib/supabaseClient';
import { AdminProfile, UserRole } from './AdminTaskService';

export interface SystemStats {
  totalUsers: number;
  adminsCount: number;
  studentsCount: number;
}

export const SuperAdminService = {
  /**
   * Fetch all users from the public.profiles table.
   */
  async getAllUsers(): Promise<AdminProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[SuperAdminService] getAllUsers error:', error);
      throw error;
    }
    return (data || []) as AdminProfile[];
  },

  /**
   * Update a user's role (0=Student, 1=Admin, 2=SuperAdmin).
   */
  async updateUserRole(userId: string, newRole: UserRole): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('[SuperAdminService] updateUserRole error:', error);
      throw error;
    }
  },

  /**
   * Quick stats for the SuperAdmin Dashboard.
   */
  async getSystemStats(): Promise<SystemStats> {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('role');
    
    if (error) {
      console.error('[SuperAdminService] getSystemStats error:', error);
      throw error;
    }

    return {
      totalUsers: users?.length || 0,
      adminsCount: users?.filter(u => u.role === 1).length || 0,
      studentsCount: users?.filter(u => u.role === 0).length || 0,
    };
  }
};
