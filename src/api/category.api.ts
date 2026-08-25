import { apiClient } from './api-client.ts';
import type {
  Category,
  CreateCategoryInput,
  UpdateCategoryInput,
  CategoryListResponse,
  CategorySingleResponse,
} from '../types/category.types.ts';

export const categoryApi = {
  listCategories: async (): Promise<Category[]> => {
    const response = await apiClient.get<CategoryListResponse>('/categories');
    return response.data.data.categories;
  },

  getCategoryById: async (id: number): Promise<Category> => {
    const response = await apiClient.get<CategorySingleResponse>(`/categories/${id}`);
    return response.data.data.category;
  },

  createCategory: async (payload: CreateCategoryInput): Promise<Category> => {
    const response = await apiClient.post<CategorySingleResponse>('/categories', payload);
    return response.data.data.category;
  },

  updateCategory: async (id: number, payload: UpdateCategoryInput): Promise<Category> => {
    const response = await apiClient.put<CategorySingleResponse>(`/categories/${id}`, payload);
    return response.data.data.category;
  },

  updateCategoryStatus: async (id: number, active: boolean): Promise<Category> => {
    const response = await apiClient.patch<CategorySingleResponse>(`/categories/${id}/status`, { active });
    return response.data.data.category;
  },
};

