/**
 * Authentication types and interfaces
 */

export interface User {
  username: string;
  role: 'admin' | 'user';
  loginTime: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthContextType {
  authState: AuthState;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}