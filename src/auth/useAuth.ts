import { useContext } from 'react';
import { AuthContext } from './auth.context.ts';
import type { AuthContextType } from '../types/auth.types.ts';

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
