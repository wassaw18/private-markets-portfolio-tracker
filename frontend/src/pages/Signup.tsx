import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, SignupRequest } from '../services/api';
import './Signup.css';

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<SignupRequest>({
    organization_name: '',
    account_type: 'INDIVIDUAL',
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (formData.password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (formData.username.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }

    try {
      setLoading(true);
      const response = await authAPI.signup(formData);

      // Show success message
      alert(`${response.message}\n\nYou can now log in with your credentials.`);

      // Redirect to login page
      navigate('/login');
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.response?.data?.detail || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getAccountTypeDescription = (type: string): string => {
    switch (type) {
      case 'INDIVIDUAL':
        return 'Personal investment tracking for individual investors';
      case 'FAMILY_OFFICE':
        return 'Multi-user access for family office teams';
      case 'FUND_MANAGER':
        return 'Portfolio tracking for fund managers and their LPs';
      default:
        return '';
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">
        <div className="signup-header">
          <h1>Create Your Account</h1>
          <p>Get started with Private Markets Portfolio Tracker</p>
        </div>

        <form onSubmit={handleSubmit} className="signup-form">
          {/* Account Type Selection */}
          <div className="form-section">
            <h3>Account Type</h3>
            <div className="account-type-selector">
              {(['INDIVIDUAL', 'FAMILY_OFFICE', 'FUND_MANAGER'] as const).map((type) => (
                <label key={type} className={`account-type-option ${formData.account_type === type ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="account_type"
                    value={type}
                    checked={formData.account_type === type}
                    onChange={handleChange}
                  />
                  <div className="account-type-content">
                    <div className="account-type-title">
                      {type === 'INDIVIDUAL' && 'Individual'}
                      {type === 'FAMILY_OFFICE' && 'Family Office'}
                      {type === 'FUND_MANAGER' && 'Fund Manager'}
                    </div>
                    <div className="account-type-description">
                      {getAccountTypeDescription(type)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Organization Details */}
          <div className="form-section">
            <h3>Organization Details</h3>
            <div className="form-group">
              <label htmlFor="organization_name">
                Organization Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="organization_name"
                name="organization_name"
                value={formData.organization_name}
                onChange={handleChange}
                required
                placeholder="Smith Family Office"
              />
            </div>
          </div>

          {/* User Details */}
          <div className="form-section">
            <h3>Admin User Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="first_name">First Name</label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  placeholder="John"
                />
              </div>
              <div className="form-group">
                <label htmlFor="last_name">Last Name</label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  placeholder="Smith"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="username">
                Username <span className="required">*</span>
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                placeholder="john_smith"
                minLength={3}
              />
              <small>At least 3 characters</small>
            </div>

            <div className="form-group">
              <label htmlFor="email">
                Email <span className="required">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="john@smithfamily.com"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">
                Password <span className="required">*</span>
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
                minLength={8}
              />
              <small>At least 8 characters</small>
            </div>

            <div className="form-group">
              <label htmlFor="confirm_password">
                Confirm Password <span className="required">*</span>
              </label>
              <input
                type="password"
                id="confirm_password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>

          <div className="signup-footer">
            Already have an account? <a href="/login">Log in</a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Signup;
