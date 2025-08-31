import React, { useCallback } from 'react';

interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  additionalData?: Record<string, any>;
}

interface ErrorHandlerOptions {
  logToConsole?: boolean;
  reportToService?: boolean;
  showUserNotification?: boolean;
}

/**
 * Custom hook for handling errors programmatically
 * Provides consistent error handling across the application
 */
export const useErrorHandler = () => {
  const handleError = useCallback((
    error: Error | string,
    context?: ErrorContext,
    options: ErrorHandlerOptions = {}
  ) => {
    const {
      logToConsole = true,
      reportToService = true,
      showUserNotification = false
    } = options;

    const errorObj = typeof error === 'string' ? new Error(error) : error;
    
    const errorReport = {
      message: errorObj.message,
      stack: errorObj.stack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      context: context || {},
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    if (logToConsole) {
      console.error('Application Error:', errorReport);
    }

    if (reportToService && process.env.NODE_ENV === 'production') {
      // In production, send to error tracking service
      // Example implementations:
      // Sentry.captureException(errorObj, { extra: errorReport });
      // LogRocket.captureException(errorObj);
      // fetch('/api/errors', { method: 'POST', body: JSON.stringify(errorReport) });
      
      // For now, we'll just log it
      console.info('Error would be reported to tracking service:', errorReport.errorId);
    }

    if (showUserNotification) {
      // You could integrate with a toast notification system here
      alert(`An error occurred: ${errorObj.message}`);
    }

    return errorReport.errorId;
  }, []);

  const handleAsyncError = useCallback(async (
    asyncOperation: () => Promise<any>,
    context?: ErrorContext,
    options?: ErrorHandlerOptions
  ) => {
    try {
      return await asyncOperation();
    } catch (error) {
      handleError(error as Error, context, options);
      throw error; // Re-throw so caller can handle it
    }
  }, [handleError]);

  const wrapComponent = useCallback((
    component: React.ComponentType<any>,
    errorContext?: ErrorContext
  ) => {
    return (props: any) => {
      try {
        return React.createElement(component, props);
      } catch (error) {
        handleError(error as Error, errorContext);
        return React.createElement('div', { 
          className: 'component-error' 
        }, 'Component failed to render');
      }
    };
  }, [handleError]);

  return {
    handleError,
    handleAsyncError,
    wrapComponent
  };
};

// Utility function for handling API errors
export const handleAPIError = (error: any, context?: string) => {
  let message = 'An unexpected error occurred';
  let statusCode = 0;

  if (error.response) {
    // The request was made and the server responded with a status code
    statusCode = error.response.status;
    message = error.response.data?.message || error.response.data?.detail || message;
    
    switch (statusCode) {
      case 400:
        message = 'Invalid request. Please check your input.';
        break;
      case 401:
        message = 'You are not authorized to perform this action.';
        break;
      case 403:
        message = 'Access denied. You do not have permission.';
        break;
      case 404:
        message = 'The requested resource was not found.';
        break;
      case 422:
        message = 'Validation error. Please check your input.';
        break;
      case 500:
        message = 'Server error. Please try again later.';
        break;
      case 503:
        message = 'Service temporarily unavailable. Please try again later.';
        break;
    }
  } else if (error.request) {
    // The request was made but no response was received
    message = 'Network error. Please check your connection.';
  } else if (error.message) {
    // Something happened in setting up the request
    message = error.message;
  }

  console.error(`API Error${context ? ` in ${context}` : ''}:`, {
    message,
    statusCode,
    originalError: error
  });

  return { message, statusCode };
};

// Global error handler for unhandled promise rejections
export const setupGlobalErrorHandlers = () => {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
    
    // Prevent the default browser behavior (logging to console)
    event.preventDefault();
    
    // You could report this to your error tracking service
    const errorReport = {
      type: 'unhandledrejection',
      reason: event.reason,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };
    
    console.error('Unhandled Promise Rejection Report:', errorReport);
  });

  window.addEventListener('error', (event) => {
    console.error('Global Error:', event.error);
    
    const errorReport = {
      type: 'global',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };
    
    console.error('Global Error Report:', errorReport);
  });
};