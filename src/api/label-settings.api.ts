import { apiClient } from './api-client.ts';
import type {
  LabelSettings,
  UpdateLabelSettingsInput,
  LabelSettingsResponse,
} from '../types/label-settings.types.ts';

export const labelSettingsApi = {
  getLabelSettings: async (): Promise<LabelSettings> => {
    const response = await apiClient.get<LabelSettingsResponse>('/label-settings');
    return response.data.data.labelSettings;
  },

  updateLabelSettings: async (payload: UpdateLabelSettingsInput): Promise<LabelSettings> => {
    const response = await apiClient.put<LabelSettingsResponse>('/label-settings', payload);
    return response.data.data.labelSettings;
  },
};

