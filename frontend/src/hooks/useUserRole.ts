import { useQuery } from '@tanstack/react-query';
import { AdminTaskService, AdminProfile, UserRole } from '../services/AdminTaskService';
import { useData } from '../context/DataContext';

export interface UseUserRoleResult {
  role: UserRole | null;
  profile: AdminProfile | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Reads the caller's RBAC profile (role 0/1/2) from public.profiles.
 * Cached via React Query; depends on the auth user from DataContext.
 */
export function useUserRole(): UseUserRoleResult {
  const { user } = useData() as { user: { id: string } | null };

  const query = useQuery({
    queryKey: ['adminProfile', user?.id ?? null],
    queryFn: () => AdminTaskService.getMyProfile(),
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  return {
    role: (query.data?.role ?? null) as UserRole | null,
    profile: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
