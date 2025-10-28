import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LoginCredentials } from '../types/auth';
import { authAPI, SignupRequest } from '../services/api';
import ComponentErrorBoundary from './ComponentErrorBoundary';
import './LoginForm.css';

const LoginForm: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset-request' | 'reset-confirm'>('login');
  const [credentials, setCredentials] = useState<LoginCredentials>({
    username: '',
    password: ''
  });
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signupData, setSignupData] = useState<SignupRequest>({
    organization_name: '',
    account_type: 'INDIVIDUAL',
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});
  const [showPassword, setShowPassword] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (mode === 'login') {
      setCredentials(prev => ({
        ...prev,
        [name]: value
      }));
    } else if (mode === 'signup') {
      setSignupData(prev => ({
        ...prev,
        [name]: value
      }));
    } else if (mode === 'reset-request') {
      if (name === 'resetEmail') {
        setResetEmail(value);
      }
    } else if (mode === 'reset-confirm') {
      if (name === 'resetToken') setResetToken(value);
      if (name === 'newPassword') setNewPassword(value);
      if (name === 'confirmPassword') setConfirmPassword(value);
    }

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

    if (success) {
      setSuccess(null);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError(null);
    setSuccess(null);
    setValidationErrors({});
  };

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (mode === 'login') {
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
    } else if (mode === 'signup') {
      // Signup validation
      if (!signupData.organization_name.trim()) {
        newErrors.organization_name = 'Organization name is required';
      }

      if (!signupData.username.trim()) {
        newErrors.username = 'Username is required';
      } else if (signupData.username.length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      }

      if (!signupData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }

      if (!signupData.password.trim()) {
        newErrors.password = 'Password is required';
      } else if (signupData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      }
    } else if (mode === 'reset-request') {
      // Password reset request validation
      if (!resetEmail.trim()) {
        newErrors.resetEmail = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
        newErrors.resetEmail = 'Please enter a valid email address';
      }
    } else if (mode === 'reset-confirm') {
      // Password reset confirmation validation
      if (!resetToken.trim()) {
        newErrors.resetToken = 'Reset token is required';
      }

      if (!newPassword.trim()) {
        newErrors.newPassword = 'New password is required';
      } else if (newPassword.length < 8) {
        newErrors.newPassword = 'Password must be at least 8 characters';
      }

      if (!confirmPassword.trim()) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (confirmPassword !== newPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
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
    setSuccess(null);

    if (mode === 'login') {
      try {
        const success = await login(credentials);

        if (!success) {
          setError('Invalid username or password. Please try again.');
        }
        // If successful, the useEffect will handle the redirect
      } catch (err) {
        setError('An error occurred during login. Please try again.');
        console.error('Login error:', err);
      }
    } else if (mode === 'signup') {
      // Signup mode
      try {
        const response = await authAPI.signup(signupData);
        setSuccess(`Account created successfully! Welcome to ${response.tenant_name}. You can now log in with your credentials.`);

        // Switch to login mode after a short delay
        setTimeout(() => {
          setMode('login');
          setCredentials({
            username: signupData.username,
            password: signupData.password
          });
          setSuccess(null);
        }, 3000);
      } catch (err: any) {
        const errorMessage = err.response?.data?.detail || 'Failed to create account. Please try again.';
        setError(errorMessage);
        console.error('Signup error:', err);
      }
    } else if (mode === 'reset-request') {
      // Password reset request mode
      try {
        const response = await authAPI.requestPasswordReset(resetEmail);
        setSuccess(response.message);

        // If we got a reset token (dev mode), automatically switch to confirm mode
        if (response.reset_token) {
          setTimeout(() => {
            setResetToken(response.reset_token!);
            setMode('reset-confirm');
            setSuccess(null);
          }, 2000);
        } else {
          // In production, user would click email link
          setTimeout(() => {
            setMode('login');
            setSuccess(null);
          }, 5000);
        }
      } catch (err: any) {
        const errorMessage = err.response?.data?.detail || 'Failed to send reset email. Please try again.';
        setError(errorMessage);
        console.error('Password reset request error:', err);
      }
    } else if (mode === 'reset-confirm') {
      // Password reset confirmation mode
      try {
        const response = await authAPI.confirmPasswordReset({
          token: resetToken,
          new_password: newPassword,
          confirm_password: confirmPassword
        });
        setSuccess(response.message);

        // Clear form and switch to login after success
        setTimeout(() => {
          setMode('login');
          setResetToken('');
          setNewPassword('');
          setConfirmPassword('');
          setSuccess(null);
        }, 3000);
      } catch (err: any) {
        const errorMessage = err.response?.data?.detail || 'Failed to reset password. Please try again.';
        setError(errorMessage);
        console.error('Password reset confirmation error:', err);
      }
    }
  };

  interface DemoAccount {
    id: string;
    name: string;
    description: string;
    accountType: string;
    username: string;
    password: string;
  }

  const demoAccounts: DemoAccount[] = [
    {
      id: 'admin',
      name: 'Admin Account',
      description: 'Individual investor - Full access',
      accountType: 'INDIVIDUAL',
      username: 'admin',
      password: 'admin123'
    },
    {
      id: 'fund-manager',
      name: 'Fund Manager Account',
      description: 'GP with LP clients - Fund management features',
      accountType: 'FUND_MANAGER',
      username: 'testfm',
      password: 'admin123'
    },
    {
      id: 'lp-client',
      name: 'LP Client Account',
      description: 'Limited Partner - View only access',
      accountType: 'LP_CLIENT',
      username: 'lp_demo',
      password: 'admin123'
    }
  ];

  const [selectedDemoAccount, setSelectedDemoAccount] = useState<string>('admin');

  const handleDemoAccountSelect = (accountId: string) => {
    setSelectedDemoAccount(accountId);
    const account = demoAccounts.find(acc => acc.id === accountId);
    if (account) {
      setCredentials({
        username: account.username,
        password: account.password
      });
    }
  };

  return (
    <ComponentErrorBoundary componentName="Login Form">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-icon">
              {mode === 'login' ? '🔐' : mode === 'signup' ? '📝' : '🔑'}
            </div>
            <h2>
              {mode === 'login' ? 'Login to Portfolio Tracker' :
               mode === 'signup' ? 'Create New Account' :
               mode === 'reset-request' ? 'Reset Password' :
               'Set New Password'}
            </h2>
            <p className="login-subtitle">
              {mode === 'login'
                ? 'Enter your credentials to access the private markets portfolio management system'
                : mode === 'signup'
                ? 'Sign up for a new organization account to get started'
                : mode === 'reset-request'
                ? 'Enter your email address and we\'ll send you a password reset link'
                : 'Enter your new password below'}
            </p>
          </div>

          {error && (
            <div className="login-error">
              <span className="error-icon">❗</span>
              {error}
            </div>
          )}

          {success && (
            <div className="login-success">
              <span className="success-icon">✓</span>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            {mode === 'reset-request' && (
              <div className="form-group">
                <label htmlFor="resetEmail">Email Address</label>
                <input
                  type="email"
                  id="resetEmail"
                  name="resetEmail"
                  value={resetEmail}
                  onChange={handleInputChange}
                  placeholder="Enter your email address"
                  className={validationErrors.resetEmail ? 'error' : ''}
                  disabled={isLoading}
                  autoComplete="email"
                />
                {validationErrors.resetEmail && (
                  <div className="field-error">{validationErrors.resetEmail}</div>
                )}
              </div>
            )}

            {mode === 'reset-confirm' && (
              <>
                <div className="form-group">
                  <label htmlFor="resetToken">Reset Token</label>
                  <input
                    type="text"
                    id="resetToken"
                    name="resetToken"
                    value={resetToken}
                    onChange={handleInputChange}
                    placeholder="Enter reset token from email"
                    className={validationErrors.resetToken ? 'error' : ''}
                    disabled={isLoading}
                  />
                  {validationErrors.resetToken && (
                    <div className="field-error">{validationErrors.resetToken}</div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <div className="password-input-container">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="newPassword"
                      name="newPassword"
                      value={newPassword}
                      onChange={handleInputChange}
                      placeholder="Enter new password (min 8 characters)"
                      className={validationErrors.newPassword ? 'error' : ''}
                      disabled={isLoading}
                      autoComplete="new-password"
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
                  {validationErrors.newPassword && (
                    <div className="field-error">{validationErrors.newPassword}</div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={handleInputChange}
                    placeholder="Confirm new password"
                    className={validationErrors.confirmPassword ? 'error' : ''}
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                  {validationErrors.confirmPassword && (
                    <div className="field-error">{validationErrors.confirmPassword}</div>
                  )}
                </div>
              </>
            )}

            {mode === 'signup' && (
              <>
                <div className="form-group">
                  <label htmlFor="organization_name">Organization Name</label>
                  <input
                    type="text"
                    id="organization_name"
                    name="organization_name"
                    value={signupData.organization_name}
                    onChange={handleInputChange}
                    placeholder="Enter organization name"
                    className={validationErrors.organization_name ? 'error' : ''}
                    disabled={isLoading}
                  />
                  {validationErrors.organization_name && (
                    <div className="field-error">{validationErrors.organization_name}</div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="account_type">Account Type</label>
                  <select
                    id="account_type"
                    name="account_type"
                    value={signupData.account_type}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      padding: 'var(--space-lg) var(--space-xl)',
                      border: '2px solid var(--luxury-pale-gray)',
                      borderRadius: 'var(--radius-lg)',
                      fontFamily: 'var(--font-family-primary)',
                      fontSize: 'var(--font-size-base)',
                      background: 'linear-gradient(135deg, var(--luxury-white) 0%, var(--luxury-pearl) 100%)',
                      color: 'var(--luxury-dark-gray)',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="INDIVIDUAL">Individual Investor</option>
                    <option value="FAMILY_OFFICE">Family Office</option>
                    <option value="FUND_MANAGER">Fund Manager / GP</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={signupData.email}
                    onChange={handleInputChange}
                    placeholder="Enter your email"
                    className={validationErrors.email ? 'error' : ''}
                    disabled={isLoading}
                    autoComplete="email"
                  />
                  {validationErrors.email && (
                    <div className="field-error">{validationErrors.email}</div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="first_name">First Name (Optional)</label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={signupData.first_name}
                    onChange={handleInputChange}
                    placeholder="Enter your first name"
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="last_name">Last Name (Optional)</label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={signupData.last_name}
                    onChange={handleInputChange}
                    placeholder="Enter your last name"
                    disabled={isLoading}
                  />
                </div>
              </>
            )}

            {(mode === 'login' || mode === 'signup') && (
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={mode === 'login' ? credentials.username : signupData.username}
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
            )}

            {(mode === 'login' || mode === 'signup') && (
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="password-input-container">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={mode === 'login' ? credentials.password : signupData.password}
                    onChange={handleInputChange}
                    placeholder={mode === 'login' ? 'Enter your password' : 'Create a password (min 8 characters)'}
                    className={validationErrors.password ? 'error' : ''}
                    disabled={isLoading}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
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
            )}

            <button
              type="submit"
              className="login-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="loading-spinner"></span>
                  {mode === 'login' ? 'Signing in...' :
                   mode === 'signup' ? 'Creating account...' :
                   mode === 'reset-request' ? 'Sending reset link...' :
                   'Resetting password...'}
                </>
              ) : (
                mode === 'login' ? 'Sign In' :
                mode === 'signup' ? 'Create Account' :
                mode === 'reset-request' ? 'Send Reset Link' :
                'Reset Password'
              )}
            </button>

            <div style={{ textAlign: 'center', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('reset-request');
                    setError(null);
                    setSuccess(null);
                    setValidationErrors({});
                  }}
                  disabled={isLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--luxury-navy)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 'var(--space-sm)'
                  }}
                >
                  Forgot password?
                </button>
              )}

              {(mode === 'login' || mode === 'signup') && (
                <button
                  type="button"
                  onClick={toggleMode}
                  disabled={isLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--luxury-navy)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 'var(--space-sm)'
                  }}
                >
                  {mode === 'login'
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Log in'}
                </button>
              )}

              {(mode === 'reset-request' || mode === 'reset-confirm') && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setSuccess(null);
                    setValidationErrors({});
                  }}
                  disabled={isLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--luxury-navy)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-semibold)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 'var(--space-sm)'
                  }}
                >
                  Back to login
                </button>
              )}
            </div>
          </form>

          {mode === 'login' && (
            <div className="login-demo">
            <div className="demo-divider">
              <span>Demo Accounts</span>
            </div>
            <div className="demo-info">
              <p>Select a demo account to test different user types:</p>

              <div className="demo-accounts-grid">
                {demoAccounts.map(account => (
                  <button
                    key={account.id}
                    type="button"
                    className={`demo-account-card ${selectedDemoAccount === account.id ? 'selected' : ''}`}
                    onClick={() => handleDemoAccountSelect(account.id)}
                    disabled={isLoading}
                  >
                    <div className="demo-account-icon">
                      {account.accountType === 'INDIVIDUAL' ? '👤' : account.accountType === 'LP_CLIENT' ? '👥' : '🏢'}
                    </div>
                    <div className="demo-account-info">
                      <div className="demo-account-name">{account.name}</div>
                      <div className="demo-account-description">{account.description}</div>
                      <div className="demo-account-type">{account.accountType}</div>
                    </div>
                    {selectedDemoAccount === account.id && (
                      <div className="demo-account-selected-badge">✓</div>
                    )}
                  </button>
                ))}
              </div>

              <div className="demo-credentials-display">
                <div className="demo-credential-item">
                  <span className="credential-label">Username:</span>
                  <code>{credentials.username || 'Select an account'}</code>
                </div>
                <div className="demo-credential-item">
                  <span className="credential-label">Password:</span>
                  <code>{credentials.password || '•••••••'}</code>
                </div>
              </div>
            </div>
            </div>
          )}

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