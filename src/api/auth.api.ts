import { apiClient } from './api-client.ts';
import type {
  LoginCredentials,
  LoginResponse,
  MeResponse,
  User,
} from '../types/auth.types.ts';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<{ token: string; user: User }> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
    return response.data.data;
  },

  getMe: async (): Promise<User> => {
    const response = await apiClient.get<MeResponse>('/auth/me');
    return response.data.data.user;
  },
};

