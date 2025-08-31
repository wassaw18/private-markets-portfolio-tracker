/**
 * Enhanced error reporting utilities
 * Provides structured error logging and reporting for production environments
 */

export interface ErrorReport {
  errorId: string;
  timestamp: string;
  message: string;
  stack?: string;
  url: string;
  userAgent: string;
  userId?: string;
  sessionId?: string;
  component?: string;
  action?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'javascript' | 'network' | 'validation' | 'api' | 'ui';
  additionalData?: Record<string, any>;
}

export interface UserContext {
  userId?: string;
  sessionId?: string;
  email?: string;
  role?: string;
}

class ErrorReporting {
  private userContext: UserContext = {};
  private sessionId: string;
  private isProduction: boolean;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Set user context for error reporting
   */
  setUserContext(context: UserContext) {
    this.userContext = { ...this.userContext, ...context };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create standardized error report
   */
  private createErrorReport(
    error: Error | string,
    severity: ErrorReport['severity'],
    category: ErrorReport['category'],
    context?: {
      component?: string;
      action?: string;
      additionalData?: Record<string, any>;
    }
  ): ErrorReport {
    const errorObj = typeof error === 'string' ? new Error(error) : error;

    return {
      errorId: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      message: errorObj.message,
      stack: errorObj.stack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      userId: this.userContext.userId,
      sessionId: this.sessionId,
      component: context?.component,
      action: context?.action,
      severity,
      category,
      additionalData: {
        ...context?.additionalData,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        timestamp: Date.now(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };
  }

  /**
   * Log error to console with enhanced formatting
   */
  private logToConsole(report: ErrorReport) {
    const style = this.getConsoleStyle(report.severity);
    
    console.group(`%c🚨 ${report.severity.toUpperCase()} ERROR - ${report.category}`, style);
    console.error('Message:', report.message);
    console.error('Component:', report.component || 'Unknown');
    console.error('Action:', report.action || 'Unknown');
    console.error('Error ID:', report.errorId);
    console.error('Stack:', report.stack);
    console.error('Additional Data:', report.additionalData);
    console.groupEnd();
  }

  /**
   * Get console styling based on severity
   */
  private getConsoleStyle(severity: ErrorReport['severity']): string {
    const styles = {
      low: 'color: #ffc107; font-weight: bold;',
      medium: 'color: #fd7e14; font-weight: bold;',
      high: 'color: #dc3545; font-weight: bold;',
      critical: 'color: #dc3545; font-weight: bold; background: #fff; padding: 2px 4px;'
    };
    return styles[severity];
  }

  /**
   * Send error report to external service
   */
  private async sendToExternalService(report: ErrorReport) {
    if (!this.isProduction) {
      console.info('Would send error report to external service:', report.errorId);
      return;
    }

    try {
      // Example implementations for different services:
      
      // 1. Send to custom API endpoint
      // await fetch('/api/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(report)
      // });

      // 2. Send to Sentry (if Sentry is configured)
      // if (window.Sentry) {
      //   window.Sentry.captureException(new Error(report.message), {
      //     tags: {
      //       component: report.component,
      //       severity: report.severity,
      //       category: report.category
      //     },
      //     extra: report.additionalData,
      //     user: {
      //       id: report.userId,
      //       session: report.sessionId
      //     }
      //   });
      // }

      // 3. Send to LogRocket (if LogRocket is configured)
      // if (window.LogRocket) {
      //   window.LogRocket.captureException(new Error(report.message));
      // }

      // For now, store in localStorage for development
      this.storeLocally(report);

    } catch (sendError) {
      console.error('Failed to send error report:', sendError);
    }
  }

  /**
   * Store error locally for development/debugging
   */
  private storeLocally(report: ErrorReport) {
    try {
      const existingErrors = JSON.parse(localStorage.getItem('errorReports') || '[]');
      existingErrors.push(report);
      
      // Keep only last 50 errors
      const recentErrors = existingErrors.slice(-50);
      localStorage.setItem('errorReports', JSON.stringify(recentErrors));
    } catch (storageError) {
      console.warn('Failed to store error locally:', storageError);
    }
  }

  /**
   * Report JavaScript error
   */
  reportError(
    error: Error | string,
    severity: ErrorReport['severity'] = 'medium',
    context?: {
      component?: string;
      action?: string;
      additionalData?: Record<string, any>;
    }
  ): string {
    const report = this.createErrorReport(error, severity, 'javascript', context);
    
    this.logToConsole(report);
    this.sendToExternalService(report);
    
    return report.errorId;
  }

  /**
   * Report API/Network error
   */
  reportAPIError(
    error: any,
    endpoint: string,
    method: string = 'GET',
    context?: Record<string, any>
  ): string {
    const report = this.createErrorReport(
      error,
      'high',
      'api',
      {
        component: 'API',
        action: `${method} ${endpoint}`,
        additionalData: {
          endpoint,
          method,
          ...context
        }
      }
    );

    this.logToConsole(report);
    this.sendToExternalService(report);

    return report.errorId;
  }

  /**
   * Report validation error
   */
  reportValidationError(
    message: string,
    field?: string,
    component?: string
  ): string {
    const report = this.createErrorReport(
      message,
      'low',
      'validation',
      {
        component,
        action: 'validation',
        additionalData: { field }
      }
    );

    this.logToConsole(report);
    this.sendToExternalService(report);

    return report.errorId;
  }

  /**
   * Report UI/UX error
   */
  reportUIError(
    message: string,
    component?: string,
    action?: string,
    additionalData?: Record<string, any>
  ): string {
    const report = this.createErrorReport(
      message,
      'medium',
      'ui',
      {
        component,
        action,
        additionalData
      }
    );

    this.logToConsole(report);
    this.sendToExternalService(report);

    return report.errorId;
  }

  /**
   * Get stored error reports (for debugging)
   */
  getStoredErrors(): ErrorReport[] {
    try {
      return JSON.parse(localStorage.getItem('errorReports') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Clear stored error reports
   */
  clearStoredErrors(): void {
    localStorage.removeItem('errorReports');
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    recent: number; // Last 24 hours
  } {
    const errors = this.getStoredErrors();
    const last24Hours = Date.now() - (24 * 60 * 60 * 1000);

    return {
      total: errors.length,
      bySeverity: errors.reduce((acc, error) => {
        acc[error.severity] = (acc[error.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byCategory: errors.reduce((acc, error) => {
        acc[error.category] = (acc[error.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recent: errors.filter(error => 
        new Date(error.timestamp).getTime() > last24Hours
      ).length
    };
  }
}

// Create global instance
export const errorReporting = new ErrorReporting();

// Export for convenience
export default errorReporting;