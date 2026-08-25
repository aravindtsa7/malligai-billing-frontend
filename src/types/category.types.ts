export interface Category {
  id: number;
  categoryName: string;
  tamilName: string | null;
  displayOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedCategoryRef {
  id: number;
  categoryName: string;
  tamilName: string | null;
  displayOrder: number;
  active: boolean;
}

export interface CreateCategoryInput {
  categoryName: string;
  tamilName?: string | null;
  displayOrder?: number;
}

export interface UpdateCategoryInput {
  categoryName?: string;
  tamilName?: string | null;
  displayOrder?: number;
}

export interface UpdateCategoryStatusInput {
  active: boolean;
}

export interface CategoryListResponse {
  success: boolean;
  data: {
    categories: Category[];
  };
}

export interface CategorySingleResponse {
  success: boolean;
  message?: string;
  data: {
    category: Category;
  };
}

