import { supabase } from '../lib/supabaseClient';
import { AdminProfile, UserRole, ROOT_ADMIN_EMAIL } from './AdminTaskService';

export interface SystemStats {
  totalUsers: number;
  adminsCount: number;
  studentsCount: number;
}

export const SuperAdminService = {
  /**
   * Check if a given email belongs to the root admin.
   */
  isRootAdmin(email: string | null | undefined): boolean {
    return email?.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase();
  },

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
   * Blocks modification of the root admin's role.
   */
  async updateUserRole(userId: string, newRole: UserRole): Promise<void> {
    // Pre-flight guard: check if this is the root admin
    const { data: target } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();
    
    if (target && SuperAdminService.isRootAdmin(target.email)) {
      throw new Error('IMMORTAL_GUARD: Cannot modify root admin role.');
    }

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
   * Delete a user account. Blocks deletion of the root admin.
   */
  async deleteUser(userId: string): Promise<void> {
    // Pre-flight guard: check if this is the root admin
    const { data: target } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (target && SuperAdminService.isRootAdmin(target.email)) {
      throw new Error('IMMORTAL_GUARD: Cannot delete root admin account.');
    }

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) {
      console.error('[SuperAdminService] deleteUser error:', error);
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
