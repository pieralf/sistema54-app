import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
  requiredPermission?: string; // Es: 'can_view_magazzino', 'can_edit_magazzino'
}

export default function ProtectedRoute({ children, requiredRole, requiredPermission }: ProtectedRouteProps) {
  const { isAuthenticated, user, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Controlla il ruolo se specificato
  if (requiredRole && user && !requiredRole.includes(user.ruolo)) {
    // Se è admin o superadmin, permette sempre
    if (user.ruolo === 'admin' || user.ruolo === 'superadmin') {
      return <>{children}</>;
    }
    // Altrimenti controlla i permessi se specificati
    if (requiredPermission) {
      const hasPermission = user.permessi?.[requiredPermission] === true;
      if (!hasPermission) {
        return <Navigate to="/" replace />;
      }
    } else {
      return <Navigate to="/" replace />;
    }
  }

  // Controlla i permessi se specificati (senza requiredRole)
  if (requiredPermission && user) {
    // Admin e superadmin hanno sempre tutti i permessi
    if (user.ruolo === 'admin' || user.ruolo === 'superadmin') {
      return <>{children}</>;
    }
    // Altrimenti controlla il permesso specifico
    const hasPermission = user.permessi?.[requiredPermission] === true;
    if (!hasPermission) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}

