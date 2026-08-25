import { apiClient } from './api-client.ts';
import type {
  StockInInput,
  StockAdjustmentInput,
  StockMutationResult,
  StockMutationResponse,
} from '../types/stock.types.ts';

export const stockApi = {
  stockIn: async (productId: number, payload: StockInInput): Promise<StockMutationResult> => {
    const response = await apiClient.post<StockMutationResponse>(`/products/${productId}/stock-in`, payload);
    return response.data.data;
  },

  stockAdjustment: async (productId: number, payload: StockAdjustmentInput): Promise<StockMutationResult> => {
    const response = await apiClient.post<StockMutationResponse>(`/products/${productId}/stock-adjustment`, payload);
    return response.data.data;
  },
};

