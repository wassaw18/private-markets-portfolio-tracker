import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoginCredentials } from '../types/auth';
import { validateEntity } from '../utils/validation';
import ComponentErrorBoundary from './ComponentErrorBoundary';
import './LoginForm.css';

const LoginForm: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: '',
    password: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear field-specific errors
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // Clear general error
    if (error) {
      setError(null);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!credentials.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (credentials.username.length < 2) {
      newErrors.username = 'Username must be at least 2 characters';
    }

    if (!credentials.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (credentials.password.length < 3) {
      newErrors.password = 'Password must be at least 3 characters';
    }

    setValidationErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setError(null);

    try {
      const success = await login(credentials);
      
      if (!success) {
        setError('Invalid username or password. Please try again.');
      }
      // If successful, the auth context will handle the redirect
    } catch (err) {
      setError('An error occurred during login. Please try again.');
      console.error('Login error:', err);
    }
  };

  const handleDemoLogin = () => {
    setCredentials({
      username: 'admin',
      password: 'password'
    });
  };

  return (
    <ComponentErrorBoundary componentName="Login Form">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-icon">🔐</div>
            <h2>Login to Portfolio Tracker</h2>
            <p className="login-subtitle">
              Enter your credentials to access the private markets portfolio management system
            </p>
          </div>

          {error && (
            <div className="login-error">
              <span className="error-icon">❗</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                value={credentials.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                className={validationErrors.username ? 'error' : ''}
                disabled={isLoading}
                autoComplete="username"
              />
              {validationErrors.username && (
                <div className="field-error">{validationErrors.username}</div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-input-container">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={credentials.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  className={validationErrors.password ? 'error' : ''}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {validationErrors.password && (
                <div className="field-error">{validationErrors.password}</div>
              )}
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="login-demo">
            <div className="demo-divider">
              <span>Demo Credentials</span>
            </div>
            <div className="demo-info">
              <p>For testing purposes, you can use:</p>
              <div className="demo-credentials">
                <code>Username: admin</code>
                <code>Password: password</code>
              </div>
              <button
                type="button"
                onClick={handleDemoLogin}
                className="demo-button"
                disabled={isLoading}
              >
                Fill Demo Credentials
              </button>
            </div>
          </div>

          <div className="login-footer">
            <p className="login-version">
              Private Markets Portfolio Tracker v1.0
            </p>
            <p className="login-security">
              🛡️ Your session will be secure and automatically expire after 24 hours
            </p>
          </div>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};

export default LoginForm;