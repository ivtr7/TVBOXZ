import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { authAPI } from '../utils/api';

interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
  tenant_id: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Manter compatibilidade com useApp
export const useApp = useAuth;

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (authAPI.isAuthenticated()) {
          const userData = authAPI.getCurrentUser();
          if (userData) {
            // Verificar se o token ainda é válido
            await authAPI.verify();
            setUser(userData);
          }
        }
      } catch (error) {
        console.error('Auth verification failed:', error);
        // Token inválido, limpar dados
        authAPI.logout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      setUser(response.user);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Mesmo com erro, limpar estado local
      setUser(null);
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Manter compatibilidade com AppProvider
export const AppProvider = AuthProvider;