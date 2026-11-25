import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { apiClient } from '../../services/apiClient';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthLoading } = useApp();
  const location = useLocation();
  const [isBackendVerified, setIsBackendVerified] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function verifyWithBackend() {
      if (!user) {
        if (isMounted) setIsBackendVerified(false);
        return;
      }

      // If route requires specific roles, query backend to verify token claims
      if (allowedRoles && allowedRoles.length > 0) {
        if (allowedRoles.includes('SUPER_ADMIN') && !allowedRoles.includes('ADMIN') && !allowedRoles.includes('USER')) {
          try {
            const res = await apiClient.checkSuperAdminRole();
            if (isMounted) setIsBackendVerified(res.authorized && res.role === 'SUPER_ADMIN');
          } catch {
            if (isMounted) setIsBackendVerified(false);
          }
        } else if (allowedRoles.includes('ADMIN') || allowedRoles.includes('SUPER_ADMIN')) {
          try {
            const res = await apiClient.checkAdminRole();
            if (isMounted) {
              const ok = res.authorized && (res.role === 'ADMIN' || res.role === 'SUPER_ADMIN');
              setIsBackendVerified(ok);
            }
          } catch {
            if (isMounted) setIsBackendVerified(false);
          }
        } else {
          // Standard USER role: verify token by calling getMe
          try {
            const me = await apiClient.getMe();
            if (isMounted) setIsBackendVerified(me.authenticated && !me.isGuest);
          } catch {
            if (isMounted) setIsBackendVerified(false);
          }
        }
      } else {
        // Authenticated user with no specific role constraints
        if (isMounted) setIsBackendVerified(true);
      }
    }

    if (!isAuthLoading) {
      verifyWithBackend();
    }

    return () => {
      isMounted = false;
    };
  }, [user, isAuthLoading, allowedRoles]);

  if (isAuthLoading || (user && allowedRoles && isBackendVerified === null)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#F8FAFC', gap: '12px' }}>
        <div style={{ width: '28px', height: '28px', border: '3px solid #E2E8F0', borderTopColor: '#635BFF', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Verifying enterprise security permissions...</div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not logged in: redirect to login preserving intent
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Frontend role check
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/user/home" replace />;
  }

  // Backend verification rejected
  if (isBackendVerified === false) {
    return <Navigate to="/user/home" replace />;
  }

  return children;
};
