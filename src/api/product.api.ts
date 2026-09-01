import { apiClient } from './api-client.ts';
import type {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductListResponse,
  ProductSingleResponse,
} from '../types/product.types.ts';

export const productApi = {
  listProducts: async (categoryId?: number): Promise<Product[]> => {
    const url = categoryId ? `/products?categoryId=${encodeURIComponent(categoryId)}` : '/products';
    const response = await apiClient.get<ProductListResponse>(url);
    return response.data.data.products;
  },

  searchProducts: async (query: string, categoryId?: number): Promise<Product[]> => {
    const trimmed = query.trim();
    if (!trimmed && !categoryId) {
      return productApi.listProducts();
    }
    const params = new URLSearchParams();
    if (trimmed) {
      params.append('q', trimmed);
    }
    if (categoryId) {
      params.append('categoryId', String(categoryId));
    }
    const queryString = params.toString();
    const url = queryString ? `/products/search?${queryString}` : '/products/search';
    const response = await apiClient.get<ProductListResponse>(url);
    return response.data.data.products;
  },

  getProductById: async (id: number): Promise<Product> => {
    const response = await apiClient.get<ProductSingleResponse>(`/products/${id}`);
    return response.data.data.product;
  },

  getProductByBarcode: async (barcode: string): Promise<Product> => {
    const response = await apiClient.get<ProductSingleResponse>(`/products/barcode/${encodeURIComponent(barcode.trim())}`);
    return response.data.data.product;
  },

  getProductByScanValue: async (value: string): Promise<Product> => {
    const response = await apiClient.get<ProductSingleResponse>(`/products/scan/${encodeURIComponent(value.trim())}`);
    return response.data.data.product;
  },

  createProduct: async (payload: CreateProductInput): Promise<Product> => {
    const response = await apiClient.post<ProductSingleResponse>('/products', payload);
    return response.data.data.product;
  },

  updateProduct: async (id: number, payload: UpdateProductInput): Promise<Product> => {
    const response = await apiClient.put<ProductSingleResponse>(`/products/${id}`, payload);
    return response.data.data.product;
  },
};
