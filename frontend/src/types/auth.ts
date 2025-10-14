/**
 * Authentication types and interfaces for JWT-based multi-tenant system
 */

export type UserRole = 'Admin' | 'Manager' | 'Contributor' | 'Viewer';

export interface Tenant {
  id: number;
  name: string;
  subdomain?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: UserRole;
  is_active: boolean;
  tenant_id: number;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile extends User {
  tenant: Tenant;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginResponse extends AuthTokens {
  user: User;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tokens: AuthTokens | null;
  loading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthContextType {
  authState: AuthState;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
  isLoading: boolean;
  hasRole: (requiredRole: UserRole) => boolean;
  getUserFullName: () => string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
}