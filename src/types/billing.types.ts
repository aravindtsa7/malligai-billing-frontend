import type { Unit } from './product.types.ts';
import type { Role } from './auth.types.ts';

export type RateType = 'NORMAL' | 'RETAIL' | 'FUNCTION';
export type PaymentType = 'CASH' | 'UPI';
export type BillStatus = 'COMPLETED' | 'CANCELLED';

export const RATE_TYPES: RateType[] = ['NORMAL', 'RETAIL', 'FUNCTION'];
export const PAYMENT_TYPES: PaymentType[] = ['CASH', 'UPI'];

export interface CreateBillItemInput {
  productId: number;
  quantity: string;
}

export interface CreateBillInput {
  rateType: RateType;
  paymentType: PaymentType;
  items: CreateBillItemInput[];
}

export interface SerializedBillItem {
  id: number;
  billId: number;
  productId: number;
  productCode: string;
  productName: string;
  unit: Unit;
  quantity: string;
  rateType: RateType;
  rate: string;
  amount: string;
  createdAt: string;
}

export interface SerializedBillCreator {
  id: number;
  username: string;
  role: Role;
}

export interface SerializedBill {
  id: number;
  billNumber: string;
  rateType: RateType;
  paymentType: PaymentType;
  subtotal: string;
  totalAmount: string;
  status: BillStatus;
  createdBy: number;
  cancelledAt?: string | null;
  cancelledBy?: number | null;
  createdAt: string;
  updatedAt: string;
  creator?: SerializedBillCreator;
  canceller?: SerializedBillCreator | null;
  items?: SerializedBillItem[];
}

export interface BillSingleResponse {
  success: boolean;
  message?: string;
  data: {
    bill: SerializedBill;
  };
}

export interface BillPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListBillsQuery {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  rateType?: RateType;
  paymentType?: PaymentType;
  status?: BillStatus;
}

export interface BillListResponse {
  success: boolean;
  message?: string;
  data: {
    bills: SerializedBill[];
    pagination: BillPagination;
  };
}

export interface CartItem {
  productId: number;
  productCode: string;
  productName: string;
  tamilName: string | null;
  unit: Unit;
  currentStock: string;
  normalRate: string;
  retailRate: string;
  functionRate: string;
  quantity: string;
  active: boolean;
}

/**
 * Resolves the display unit rate for a product based on chosen RateType.
 * NOTE: originalRate (cost) is NEVER used for billing customer sales.
 */
export function getProductRateForType(
  product: { normalRate: string; retailRate: string; functionRate: string },
  rateType: RateType
): string {
  switch (rateType) {
    case 'NORMAL':
      return product.normalRate;
    case 'RETAIL':
      return product.retailRate;
    case 'FUNCTION':
      return product.functionRate;
    default:
      return product.normalRate;
  }
}

