import React, { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from './LoginForm';
import ComponentErrorBoundary from './ComponentErrorBoundary';
import './ProtectedRoute.css';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Protected Route component that requires authentication
 * Shows login form if user is not authenticated
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  fallback 
}) => {
  const { authState, isLoading } = useAuth();

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div className="auth-loading-container">
        <div className="auth-loading">
          <div className="loading-spinner"></div>
          <p>Loading application...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!authState.isAuthenticated) {
    return <>{fallback || <LoginForm />}</>;
  }

  // Render protected content
  return (
    <ComponentErrorBoundary componentName="Protected Route">
      {children}
    </ComponentErrorBoundary>
  );
};

export default ProtectedRoute;