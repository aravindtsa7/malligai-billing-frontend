export interface ReceiptSettings {
  storeName: string;
  upiId: string | null;
  gstin: string | null;
  showCashier: boolean;
  showRateTier: boolean;
  showPayment: boolean;
  showStatus: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReceiptSnapshot {
  storeName: string;
  upiId: string | null;
  gstin: string | null;
  showCashier: boolean;
  showRateTier: boolean;
  showPayment: boolean;
  showStatus: boolean;
}

export interface UpdateReceiptSettingsInput {
  storeName: string;
  upiId?: string | null;
  gstin?: string | null;
  showCashier: boolean;
  showRateTier: boolean;
  showPayment: boolean;
  showStatus: boolean;
}

export interface ReceiptSettingsResponse {
  success: boolean;
  message?: string;
  data: {
    receiptSettings: ReceiptSettings;
  };
}

