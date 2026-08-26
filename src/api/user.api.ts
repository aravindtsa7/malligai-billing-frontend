import { apiClient } from './api-client.ts';
import type {
  User,
  CreateUserInput,
  ResetPasswordInput,
  ListUsersQuery,
  UserPagination,
  UserListResponse,
  SingleUserResponse,
} from '../types/user.types.ts';

export const userApi = {
  listUsers: async (query?: ListUsersQuery): Promise<{ users: User[]; pagination: UserPagination }> => {
    const params: Record<string, string | number | boolean> = {};
    if (query?.page !== undefined) params.page = query.page;
    if (query?.limit !== undefined) params.limit = query.limit;
    if (query?.role !== undefined) params.role = query.role;
    if (query?.active !== undefined) params.active = query.active;

    const response = await apiClient.get<UserListResponse>('/users', { params });
    return response.data.data;
  },

  getUserById: async (id: number): Promise<User> => {
    const response = await apiClient.get<SingleUserResponse>(`/users/${id}`);
    return response.data.data.user;
  },

  createUser: async (payload: CreateUserInput): Promise<User> => {
    const response = await apiClient.post<SingleUserResponse>('/users', payload);
    return response.data.data.user;
  },

  updateUserStatus: async (id: number, active: boolean): Promise<User> => {
    const response = await apiClient.patch<SingleUserResponse>(`/users/${id}/status`, { active });
    return response.data.data.user;
  },

  resetPassword: async (id: number, payload: ResetPasswordInput): Promise<User> => {
    const response = await apiClient.patch<SingleUserResponse>(`/users/${id}/password`, payload);
    return response.data.data.user;
  },
};

