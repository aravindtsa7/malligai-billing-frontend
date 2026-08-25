import type { Product } from './product.types.ts';

export type StockAdjustmentType = 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT';

export interface StockInInput {
  quantity: string;
  note?: string;
}

export interface StockAdjustmentInput {
  type: StockAdjustmentType;
  quantity: string;
  note?: string;
}

export interface StockTransaction {
  id: number;
  productId: number;
  type: string;
  quantity: string;
  previousStock: string;
  newStock: string;
  createdBy: number;
  createdAt: string;
  note: string | null;
}

export interface StockMutationResult {
  product: Product;
  transaction: StockTransaction;
}

export interface StockMutationResponse {
  success: boolean;
  message: string;
  data: StockMutationResult;
}

