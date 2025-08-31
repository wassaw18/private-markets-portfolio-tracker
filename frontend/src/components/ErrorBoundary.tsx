import React, { Component, ErrorInfo, ReactNode } from 'react';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'section' | 'component';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Update state with error details
    this.setState({
      error,
      errorInfo
    });

    // Log error details
    console.error('Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);
    
    // Report to error tracking service (e.g., Sentry)
    this.reportError(error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to an error tracking service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errorId: this.state.errorId
    };

    // For now, just log to console
    console.error('Error Report:', errorReport);
    
    // You could send to services like:
    // - Sentry.captureException(error, { contexts: { react: errorInfo } });
    // - LogRocket.captureException(error);
    // - Custom analytics endpoint
  };

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: ''
      });
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private renderErrorDetails = () => {
    if (!this.state.error || process.env.NODE_ENV === 'production') {
      return null;
    }

    return (
      <details className="error-details">
        <summary>Error Details (Development Only)</summary>
        <div className="error-stack">
          <h4>Error Message:</h4>
          <pre>{this.state.error.message}</pre>
          
          <h4>Stack Trace:</h4>
          <pre>{this.state.error.stack}</pre>
          
          {this.state.errorInfo && (
            <>
              <h4>Component Stack:</h4>
              <pre>{this.state.errorInfo.componentStack}</pre>
            </>
          )}
        </div>
      </details>
    );
  };

  private getErrorIcon = () => {
    const { level = 'component' } = this.props;
    switch (level) {
      case 'page': return '🚨';
      case 'section': return '⚠️';
      case 'component': return '❗';
      default: return '❗';
    }
  };

  private getErrorTitle = () => {
    const { level = 'component' } = this.props;
    switch (level) {
      case 'page': return 'Page Error';
      case 'section': return 'Section Error';
      case 'component': return 'Component Error';
      default: return 'Something went wrong';
    }
  };

  private getErrorMessage = () => {
    const { level = 'component' } = this.props;
    switch (level) {
      case 'page':
        return 'This page encountered an unexpected error. Please try reloading or contact support if the problem persists.';
      case 'section':
        return 'This section failed to load properly. You can try refreshing or continue using other parts of the application.';
      case 'component':
        return 'This component encountered an error. Other parts of the application should continue to work normally.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI based on level
      const { level = 'component' } = this.props;
      const canRetry = this.retryCount < this.maxRetries;

      return (
        <div className={`error-boundary error-boundary--${level}`}>
          <div className="error-content">
            <div className="error-icon">{this.getErrorIcon()}</div>
            <h3 className="error-title">{this.getErrorTitle()}</h3>
            <p className="error-message">{this.getErrorMessage()}</p>
            
            <div className="error-actions">
              {canRetry && (
                <button 
                  onClick={this.handleRetry}
                  className="error-button error-button--primary"
                >
                  Try Again ({this.maxRetries - this.retryCount} attempts left)
                </button>
              )}
              
              <button 
                onClick={this.handleReload}
                className="error-button error-button--secondary"
              >
                Reload Page
              </button>
              
              {level === 'page' && (
                <a 
                  href="/"
                  className="error-button error-button--tertiary"
                >
                  Go Home
                </a>
              )}
            </div>

            {this.state.errorId && (
              <div className="error-id">
                Error ID: {this.state.errorId}
              </div>
            )}

            {this.renderErrorDetails()}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;