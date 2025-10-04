/**
 * Authentication API service for JWT-based authentication
 */

import {
  LoginCredentials,
  LoginResponse,
  UserProfile,
  ChangePasswordRequest,
  UpdateProfileRequest
} from '../types/auth';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

class AuthAPIService {
  private getAuthHeaders(token?: string): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  /**
   * Login user and get JWT tokens
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(credentials),
    });

    return this.handleResponse<LoginResponse>(response);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    return this.handleResponse<LoginResponse>(response);
  }

  /**
   * Logout user (server-side cleanup if needed)
   */
  async logout(accessToken: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
    });

    await this.handleResponse<{ message: string }>(response);
  }

  /**
   * Get current user profile
   */
  async getProfile(accessToken: string): Promise<UserProfile> {
    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      method: 'GET',
      headers: this.getAuthHeaders(accessToken),
    });

    return this.handleResponse<UserProfile>(response);
  }

  /**
   * Update user profile
   */
  async updateProfile(
    accessToken: string,
    profileData: UpdateProfileRequest
  ): Promise<UserProfile> {
    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify(profileData),
    });

    return this.handleResponse<UserProfile>(response);
  }

  /**
   * Change user password
   */
  async changePassword(
    accessToken: string,
    passwordData: ChangePasswordRequest
  ): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: this.getAuthHeaders(accessToken),
      body: JSON.stringify(passwordData),
    });

    return this.handleResponse<{ message: string }>(response);
  }

  /**
   * Get tenant information
   */
  async getTenantInfo(accessToken: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/auth/tenant/info`, {
      method: 'GET',
      headers: this.getAuthHeaders(accessToken),
    });

    return this.handleResponse<any>(response);
  }

  /**
   * Verify if token is still valid (health check)
   */
  async verifyToken(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: 'GET',
        headers: this.getAuthHeaders(accessToken),
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

export const authAPI = new AuthAPIService();
export default authAPI;