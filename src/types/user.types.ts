import type { Role, User } from './auth.types.ts';

export type { Role, User };

export interface CreateUserInput {
  username: string;
  password: string;
}

export interface UpdateUserStatusInput {
  active: boolean;
}

export interface ResetPasswordInput {
  password: string;
}

export interface ListUsersQuery {
  page?: number;
  limit?: number;
  role?: Role;
  active?: boolean;
}

export interface UserPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UserListResponse {
  success: boolean;
  data: {
    users: User[];
    pagination: UserPagination;
  };
}

export interface SingleUserResponse {
  success: boolean;
  message?: string;
  data: {
    user: User;
  };
}

