import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AuthState, AuthContextType, User, LoginCredentials, AuthTokens, UserRole, AccountType } from '../types/auth';
import { authAPI } from '../services/authApi';

// Auth reducer
type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; tokens: AuthTokens; accountType?: string } }
  | { type: 'LOGIN_FAILURE'; payload?: string }
  | { type: 'LOGOUT' }
  | { type: 'RESTORE_SESSION'; payload: { user: User; tokens: AuthTokens; accountType?: string } }
  | { type: 'TOKEN_REFRESH_SUCCESS'; payload: AuthTokens }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  tokens: null,
  accountType: null,
  loading: true,
  error: null
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        loading: true,
        error: null
      };
    case 'LOGIN_SUCCESS':
      return {
        isAuthenticated: true,
        user: action.payload.user,
        tokens: action.payload.tokens,
        accountType: action.payload.accountType as AccountType || null,
        loading: false,
        error: null
      };
    case 'LOGIN_FAILURE':
      return {
        isAuthenticated: false,
        user: null,
        tokens: null,
        accountType: null,
        loading: false,
        error: action.payload || 'Login failed'
      };
    case 'LOGOUT':
      return {
        isAuthenticated: false,
        user: null,
        tokens: null,
        accountType: null,
        loading: false,
        error: null
      };
    case 'RESTORE_SESSION':
      return {
        isAuthenticated: true,
        user: action.payload.user,
        tokens: action.payload.tokens,
        accountType: action.payload.accountType as AccountType || null,
        loading: false,
        error: null
      };
    case 'TOKEN_REFRESH_SUCCESS':
      return {
        ...state,
        tokens: action.payload,
        error: null
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    default:
      return state;
  }
};

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, dispatch] = useReducer(authReducer, initialState);

  // Helper function to store tokens securely
  const storeTokens = (tokens: AuthTokens, user: User, accountType?: string) => {
    try {
      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('token_expires_at', (Date.now() + tokens.expires_in * 1000).toString());
      if (accountType) {
        localStorage.setItem('account_type', accountType);
      }
    } catch (error) {
      console.error('Error storing auth data:', error);
    }
  };

  // Helper function to clear stored tokens
  const clearTokens = () => {
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('token_expires_at');
      localStorage.removeItem('account_type');
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  };

  // Check if access token is expired
  const isTokenExpired = (): boolean => {
    const expiresAt = localStorage.getItem('token_expires_at');
    if (!expiresAt) return true;
    return Date.now() >= parseInt(expiresAt);
  };

  // Refresh access token
  const refreshToken = async (): Promise<boolean> => {
    try {
      const refreshTokenValue = localStorage.getItem('refresh_token');
      if (!refreshTokenValue) {
        dispatch({ type: 'LOGOUT' });
        return false;
      }

      const response = await authAPI.refreshToken(refreshTokenValue);

      const tokens: AuthTokens = {
        access_token: response.access_token,
        refresh_token: response.refresh_token,
        token_type: response.token_type,
        expires_in: response.expires_in
      };

      storeTokens(tokens, response.user, response.account_type);
      dispatch({ type: 'TOKEN_REFRESH_SUCCESS', payload: tokens });

      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      dispatch({ type: 'LOGOUT' });
      clearTokens();
      return false;
    }
  };

  // Restore session on app load
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const accessToken = localStorage.getItem('access_token');
        const refreshTokenValue = localStorage.getItem('refresh_token');
        const storedUser = localStorage.getItem('auth_user');
        const storedAccountType = localStorage.getItem('account_type');

        if (!accessToken || !refreshTokenValue || !storedUser) {
          dispatch({ type: 'LOGIN_FAILURE' });
          return;
        }

        const user: User = JSON.parse(storedUser);

        // Check if access token is expired
        if (isTokenExpired()) {
          // Try to refresh token
          const refreshSuccess = await refreshToken();
          if (!refreshSuccess) {
            dispatch({ type: 'LOGIN_FAILURE' });
            return;
          }
        }

        // Verify token is still valid
        const isValid = await authAPI.verifyToken(accessToken);
        if (!isValid) {
          // Try to refresh token
          const refreshSuccess = await refreshToken();
          if (!refreshSuccess) {
            dispatch({ type: 'LOGIN_FAILURE' });
            return;
          }
        }

        const tokens: AuthTokens = {
          access_token: localStorage.getItem('access_token')!,
          refresh_token: localStorage.getItem('refresh_token')!,
          token_type: 'bearer',
          expires_in: 1800 // Default 30 minutes
        };

        dispatch({
          type: 'RESTORE_SESSION',
          payload: { user, tokens, accountType: storedAccountType || undefined }
        });

      } catch (error) {
        console.error('Error restoring session:', error);
        clearTokens();
        dispatch({ type: 'LOGIN_FAILURE' });
      }
    };

    restoreSession();
  }, []);

  // Login function
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    dispatch({ type: 'LOGIN_START' });

    try {
      const response = await authAPI.login(credentials);

      const tokens: AuthTokens = {
        access_token: response.access_token,
        refresh_token: response.refresh_token,
        token_type: response.token_type,
        expires_in: response.expires_in
      };

      storeTokens(tokens, response.user, response.account_type);

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { user: response.user, tokens, accountType: response.account_type }
      });

      return true;
    } catch (error) {
      console.error('Login failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      return false;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      const accessToken = localStorage.getItem('access_token');
      if (accessToken) {
        await authAPI.logout(accessToken);
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with logout even if API call fails
    }

    clearTokens();
    dispatch({ type: 'LOGOUT' });

    // Hard redirect to root to clear all React Router state and ensure fresh start
    window.location.href = '/';
  };

  // Role-based access control
  const hasRole = (requiredRole: UserRole): boolean => {
    if (!authState.user) return false;

    const roleHierarchy: Record<UserRole, number> = {
      'Viewer': 1,
      'Contributor': 2,
      'Manager': 3,
      'Admin': 4,
      'LP_CLIENT': 1  // LP clients have viewer-level access
    };

    const userRoleLevel = roleHierarchy[authState.user.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 999;

    return userRoleLevel >= requiredRoleLevel;
  };

  // Get user's full name
  const getUserFullName = (): string => {
    if (!authState.user) return '';

    const { first_name, last_name, username } = authState.user;

    if (first_name || last_name) {
      return `${first_name || ''} ${last_name || ''}`.trim();
    }

    return username;
  };

  // Get account type
  const getAccountType = (): AccountType | null => {
    return authState.accountType;
  };

  const contextValue: AuthContextType = {
    authState,
    login,
    logout,
    refreshToken,
    isLoading: authState.loading,
    hasRole,
    getUserFullName,
    getAccountType
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;