import { apiClient } from './api-client.ts';
import type {
  CreateBillInput,
  SerializedBill,
  BillSingleResponse,
} from '../types/billing.types.ts';

export const billingApi = {
  createBill: async (payload: CreateBillInput): Promise<SerializedBill> => {
    const response = await apiClient.post<BillSingleResponse>('/bills', payload);
    return response.data.data.bill;
  },
};

