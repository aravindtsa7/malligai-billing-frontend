import { apiClient } from './api-client.ts';
import type {
  CreateBillInput,
  SerializedBill,
  BillSingleResponse,
  BillListResponse,
  ListBillsQuery,
  BillPagination,
} from '../types/billing.types.ts';

export const billingApi = {
  createBill: async (payload: CreateBillInput): Promise<SerializedBill> => {
    const response = await apiClient.post<BillSingleResponse>('/bills', payload);
    return response.data.data.bill;
  },

  listBills: async (
    query?: ListBillsQuery
  ): Promise<{ bills: SerializedBill[]; pagination: BillPagination }> => {
    const response = await apiClient.get<BillListResponse>('/bills', {
      params: query,
    });
    return response.data.data;
  },

  getBillById: async (id: number): Promise<SerializedBill> => {
    const response = await apiClient.get<BillSingleResponse>(`/bills/${id}`);
    return response.data.data.bill;
  },

  cancelBill: async (id: number): Promise<SerializedBill> => {
    const response = await apiClient.post<BillSingleResponse>(`/bills/${id}/cancel`);
    return response.data.data.bill;
  },
};

