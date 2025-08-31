import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { AuthState, AuthContextType, User, LoginCredentials } from '../types/auth';

// Basic authentication credentials (DEVELOPMENT ONLY)
// TODO: Replace with proper authentication system for production
const VALID_CREDENTIALS = {
  username: process.env.REACT_APP_DEFAULT_USERNAME || 'admin',
  password: process.env.REACT_APP_DEFAULT_PASSWORD || 'password'
};

// Auth reducer
type AuthAction = 
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGIN_FAILURE' }
  | { type: 'LOGOUT' }
  | { type: 'RESTORE_SESSION'; payload: User };

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: true
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        loading: true
      };
    case 'LOGIN_SUCCESS':
      return {
        isAuthenticated: true,
        user: action.payload,
        loading: false
      };
    case 'LOGIN_FAILURE':
      return {
        isAuthenticated: false,
        user: null,
        loading: false
      };
    case 'LOGOUT':
      return {
        isAuthenticated: false,
        user: null,
        loading: false
      };
    case 'RESTORE_SESSION':
      return {
        isAuthenticated: true,
        user: action.payload,
        loading: false
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

  // Restore session on app load
  useEffect(() => {
    const restoreSession = () => {
      try {
        const storedUser = localStorage.getItem('authUser');
        const loginTime = localStorage.getItem('loginTime');
        
        if (storedUser && loginTime) {
          const user: User = JSON.parse(storedUser);
          const loginTimestamp = new Date(loginTime).getTime();
          const currentTime = new Date().getTime();
          const sessionDuration = 24 * 60 * 60 * 1000; // 24 hours
          
          // Check if session is still valid
          if (currentTime - loginTimestamp < sessionDuration) {
            dispatch({ type: 'RESTORE_SESSION', payload: user });
            return;
          } else {
            // Session expired, clear storage
            localStorage.removeItem('authUser');
            localStorage.removeItem('loginTime');
          }
        }
      } catch (error) {
        console.error('Error restoring session:', error);
        localStorage.removeItem('authUser');
        localStorage.removeItem('loginTime');
      }
      
      dispatch({ type: 'LOGIN_FAILURE' });
    };

    restoreSession();
  }, []);

  // Login function
  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    dispatch({ type: 'LOGIN_START' });

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Validate credentials
    if (
      credentials.username === VALID_CREDENTIALS.username &&
      credentials.password === VALID_CREDENTIALS.password
    ) {
      const user: User = {
        username: credentials.username,
        role: 'admin',
        loginTime: new Date().toISOString()
      };

      // Store in localStorage
      try {
        localStorage.setItem('authUser', JSON.stringify(user));
        localStorage.setItem('loginTime', user.loginTime);
      } catch (error) {
        console.error('Error storing auth data:', error);
      }

      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      return true;
    } else {
      dispatch({ type: 'LOGIN_FAILURE' });
      return false;
    }
  };

  // Logout function
  const logout = () => {
    try {
      localStorage.removeItem('authUser');
      localStorage.removeItem('loginTime');
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
    
    dispatch({ type: 'LOGOUT' });
  };

  const contextValue: AuthContextType = {
    authState,
    login,
    logout,
    isLoading: authState.loading
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