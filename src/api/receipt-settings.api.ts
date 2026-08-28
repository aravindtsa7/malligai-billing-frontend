import { apiClient } from './api-client.ts';
import type {
  ReceiptSettings,
  UpdateReceiptSettingsInput,
  ReceiptSettingsResponse,
} from '../types/receipt-settings.types.ts';

export const receiptSettingsApi = {
  getReceiptSettings: async (): Promise<ReceiptSettings> => {
    const response = await apiClient.get<ReceiptSettingsResponse>('/receipt-settings');
    return response.data.data.receiptSettings;
  },

  updateReceiptSettings: async (payload: UpdateReceiptSettingsInput): Promise<ReceiptSettings> => {
    const response = await apiClient.put<ReceiptSettingsResponse>('/receipt-settings', payload);
    return response.data.data.receiptSettings;
  },
};

