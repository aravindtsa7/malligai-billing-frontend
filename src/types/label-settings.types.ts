export type LabelSize = 'LABEL_50X40' | 'LABEL_50X50';

export interface LabelSettings {
  storeName: string;
  defaultLabelSize: LabelSize;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateLabelSettingsInput {
  storeName: string;
  defaultLabelSize: LabelSize;
}

export interface LabelSettingsResponse {
  success: boolean;
  message?: string;
  data: {
    labelSettings: LabelSettings;
  };
}

