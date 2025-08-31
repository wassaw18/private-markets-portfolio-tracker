import React, { ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';

interface Props {
  children: ReactNode;
  componentName?: string;
  silent?: boolean;
  fallbackMessage?: string;
}

/**
 * Component-level error boundary for small components
 * Provides minimal disruption with simple fallback
 */
const ComponentErrorBoundary: React.FC<Props> = ({ 
  children, 
  componentName,
  silent = false,
  fallbackMessage 
}) => {
  const handleError = (error: Error, errorInfo: any) => {
    if (!silent) {
      console.warn(`Component Error in ${componentName || 'Unknown Component'}:`, {
        error: error.message,
        component: componentName,
        timestamp: new Date().toISOString()
      });
    }
  };

  const customFallback = (
    <div className="component-error-fallback">
      <div className="error-content">
        <div className="error-icon">❗</div>
        <p className="error-message">
          {fallbackMessage || 
           (componentName ? `${componentName} failed to load` : 'Component unavailable')
          }
        </p>
      </div>
    </div>
  );

  return (
    <ErrorBoundary 
      level="component" 
      onError={handleError}
      fallback={customFallback}
    >
      {children}
    </ErrorBoundary>
  );
};

export default ComponentErrorBoundary;