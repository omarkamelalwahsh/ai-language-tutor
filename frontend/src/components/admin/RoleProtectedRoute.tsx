import React from 'react';
import { Navigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useUserRole } from '../../hooks/useUserRole';
import { NeuralPulseLoader } from '../common/NeuralPulseLoader';
import type { UserRole } from '../../services/AdminTaskService';

interface Props {
  children: React.ReactNode;
  /**
   * Required role(s).  e.g.
   *  - 1 → Admin only
   *  - 2 → SuperAdmin only
   *  - [1, 2] → Admin or SuperAdmin
   */
  required: UserRole | UserRole[];
  /** Where to redirect on failed role check (defaults to /dashboard). */
  redirectTo?: string;
}

const allowed = (actual: UserRole | null, required: UserRole | UserRole[]): boolean => {
  if (actual === null || actual === undefined) return false;
  if (Array.isArray(required)) return required.includes(actual);
  // SuperAdmin (2) implicitly satisfies Admin (1) checks
  if (required === 1 && actual === 2) return true;
  return actual === required;
};

export const RoleProtectedRoute: React.FC<Props> = ({ children, required, redirectTo = '/dashboard' }) => {
  const { user, isInitializing } = useData() as { user: any; isInitializing: boolean };
  const { role, isLoading, isError } = useUserRole();

  if (isInitializing) return <NeuralPulseLoader status="Authenticating Session..." />;
  if (!user) return <Navigate to="/auth" replace />;
  if (isLoading) return <NeuralPulseLoader status="Verifying Clearance..." />;
  if (isError || !allowed(role, required)) return <Navigate to={redirectTo} replace />;

  return <>{children}</>;
};

export default RoleProtectedRoute;
