import type { SerializedCategoryRef } from './category.types.ts';

export type Unit = 'KG' | 'GRAM' | 'LITRE' | 'ML' | 'PIECE' | 'PACKET' | 'BOX';

export const UNITS: Unit[] = ['KG', 'GRAM', 'LITRE', 'ML', 'PIECE', 'PACKET', 'BOX'];

export interface Product {
  id: number;
  productCode: string;
  barcode: string | null;
  productName: string;
  tamilName: string | null;
  categoryId: number;
  category?: SerializedCategoryRef;
  unit: Unit;
  mrpRate: string;
  originalRate: string;
  normalRate: string;
  retailRate: string;
  functionRate: string;
  currentStock: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  productCode: string;
  barcode?: string | null;
  productName: string;
  tamilName?: string | null;
  categoryId: number;
  unit: Unit;
  mrpRate: string;
  normalRate: string;
  originalRate?: string;
  retailRate?: string;
  functionRate?: string;
  openingStock?: string;
}

export interface UpdateProductInput {
  productCode?: string;
  barcode?: string | null;
  productName?: string;
  tamilName?: string | null;
  categoryId?: number;
  unit?: Unit;
  mrpRate?: string;
  normalRate?: string;
  originalRate?: string | null;
  retailRate?: string | null;
  functionRate?: string | null;
  active?: boolean;
}

export interface ProductListResponse {
  success: boolean;
  data: {
    products: Product[];
  };
}

export interface ProductSingleResponse {
  success: boolean;
  message?: string;
  data: {
    product: Product;
  };
}
