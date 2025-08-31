import React, { ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';

interface Props {
  children: ReactNode;
  sectionName?: string;
  showRetry?: boolean;
}

/**
 * Section-level error boundary for components like charts, tables, forms
 * Allows the rest of the page to continue working
 */
const SectionErrorBoundary: React.FC<Props> = ({ 
  children, 
  sectionName,
  showRetry = true 
}) => {
  const handleError = (error: Error, errorInfo: any) => {
    console.warn(`Section Error in ${sectionName || 'Unknown Section'}:`, {
      error: error.message,
      section: sectionName,
      timestamp: new Date().toISOString()
    });
  };

  const customFallback = (
    <div className="section-error-fallback">
      <div className="error-content">
        <div className="error-icon">⚠️</div>
        <h3>{sectionName ? `${sectionName} Unavailable` : 'Section Unavailable'}</h3>
        <p>
          This section couldn't load properly, but you can continue using 
          other parts of the application.
        </p>
        {showRetry && (
          <div className="error-actions">
            <button 
              onClick={() => window.location.reload()}
              className="error-button error-button--secondary"
            >
              Refresh Page
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <ErrorBoundary 
      level="section" 
      onError={handleError}
      fallback={customFallback}
    >
      {children}
    </ErrorBoundary>
  );
};

export default SectionErrorBoundary;