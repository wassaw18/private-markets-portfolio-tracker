import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authAPI, AcceptInvitationRequest } from '../services/api';
import './AcceptInvitation.css';

const AcceptInvitation: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [formData, setFormData] = useState<AcceptInvitationRequest>({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid invitation token');
      return;
    }

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
      const response = await authAPI.acceptInvitation(token, formData);

      // Show success message
      alert(`${response.message}\n\nYou can now log in with your credentials.`);

      // Redirect to login page
      navigate('/login');
    } catch (err: any) {
      console.error('Accept invitation error:', err);
      if (err.response?.status === 404) {
        setError('Invalid or expired invitation link');
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.detail || 'This invitation has already been used or has expired');
      } else {
        setError(err.response?.data?.detail || 'Failed to accept invitation. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="accept-invitation-container">
      <div className="accept-invitation-card">
        <div className="accept-invitation-header">
          <h1>Accept Invitation</h1>
          <p>Complete your account setup to join the organization</p>
        </div>

        <form onSubmit={handleSubmit} className="accept-invitation-form">
          <div className="form-section">
            <h3>Your Details</h3>

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
            {loading ? 'Creating Account...' : 'Accept Invitation'}
          </button>

          <div className="accept-invitation-footer">
            Already have an account? <a href="/login">Log in</a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AcceptInvitation;
