import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorResponse } from '../types/auth.types.ts';

export const AUTH_TOKEN_KEY = 'malligai_auth_token';
export const AUTH_UNAUTHORIZED_EVENT = 'malligai_auth_unauthorized';

const rawBaseURL = import.meta.env.VITE_API_BASE_URL;
if (!rawBaseURL || typeof rawBaseURL !== 'string' || !rawBaseURL.trim()) {
  throw new Error('VITE_API_BASE_URL is not defined or is empty in the environment configuration');
}

const baseURL = rawBaseURL.trim();

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');

    if (error.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }

    return Promise.reject(error);
  }
);

export const getApiErrorMessage = (error: unknown, fallbackMessage = 'An unexpected error occurred'): string => {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<ApiErrorResponse>;
    if (!axiosErr.response) {
      return 'Unable to connect to server. Please check your network or ensure backend is running.';
    }
    if (axiosErr.response.data?.message) {
      return axiosErr.response.data.message;
    }
    if (axiosErr.response.status === 401) {
      return 'Invalid username or password';
    }
    if (axiosErr.response.status === 403) {
      return 'You do not have permission to perform this action.';
    }
    if (axiosErr.response.status >= 500) {
      return 'Internal server error. Please try again later.';
    }
  } else if (error instanceof Error) {
    return error.message;
  }
  return fallbackMessage;
};

