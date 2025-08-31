import React, { ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';

interface Props {
  children: ReactNode;
  pageName?: string;
}

/**
 * Page-level error boundary with enhanced error reporting
 * Use this to wrap entire page components
 */
const PageErrorBoundary: React.FC<Props> = ({ children, pageName }) => {
  const handleError = (error: Error, errorInfo: any) => {
    // Enhanced logging for page-level errors
    console.error(`Page Error in ${pageName || 'Unknown Page'}:`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      page: pageName,
      timestamp: new Date().toISOString(),
      url: window.location.href
    });

    // In production, you would send this to your error tracking service
    // Example: Sentry.captureException(error, { tags: { page: pageName } });
  };

  const customFallback = (
    <div className="page-error-fallback">
      <div className="error-content">
        <div className="error-icon">🚨</div>
        <h1>Oops! Something went wrong</h1>
        <p>
          We're sorry, but something unexpected happened while loading this page.
          {pageName && ` The ${pageName} page`} encountered an error.
        </p>
        <div className="error-actions">
          <button 
            onClick={() => window.location.reload()}
            className="error-button error-button--primary"
          >
            Reload Page
          </button>
          <a 
            href="/"
            className="error-button error-button--secondary"
          >
            Go to Dashboard
          </a>
        </div>
        <p className="error-support">
          If this problem persists, please contact support with the error details.
        </p>
      </div>
    </div>
  );

  return (
    <ErrorBoundary 
      level="page" 
      onError={handleError}
      fallback={customFallback}
    >
      {children}
    </ErrorBoundary>
  );
};

export default PageErrorBoundary;