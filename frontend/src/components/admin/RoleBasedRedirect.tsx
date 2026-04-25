import React from 'react';
import { Navigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useUserRole } from '../../hooks/useUserRole';
import { NeuralPulseLoader } from '../common/NeuralPulseLoader';

interface Props {
  /** Where role=0 (student) should land. Defaults to /dashboard. */
  studentPath?: string;
  /** Where role=1 (admin) should land. Defaults to /admin. */
  adminPath?: string;
  /** Where role=2 (superadmin) should land. Defaults to /super-admin. */
  superAdminPath?: string;
}

/**
 * Single role -> portal decision point.
 *
 * Source of truth is `useUserRole()` which reads `public.profiles.role`
 * (NOT auth.user_metadata, which doesn't auto-sync with public tables).
 *
 *   role === 2  -> /super-admin
 *   role === 1  -> /admin
 *   role === 0  -> /dashboard      (or whatever studentPath is)
 *   no profile  -> /dashboard      (treat as student until profile is created)
 */
export const RoleBasedRedirect: React.FC<Props> = ({
  studentPath = '/dashboard',
  adminPath = '/admin',
  superAdminPath = '/super-admin',
}) => {
  const { user, isInitializing } = useData() as { user: any; isInitializing: boolean };
  const { role, isLoading } = useUserRole();

  if (isInitializing) return <NeuralPulseLoader status="Authenticating Session..." />;
  if (!user) return <Navigate to="/auth" replace />;
  if (isLoading) return <NeuralPulseLoader status="Resolving Clearance..." />;

  if (role === 2) return <Navigate to={superAdminPath} replace />;
  if (role === 1) return <Navigate to={adminPath} replace />;
  return <Navigate to={studentPath} replace />;
};

export default RoleBasedRedirect;
