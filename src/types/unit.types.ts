export interface UnitOfMeasure {
  id: number;
  name: string;
  shortName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedUnitRef {
  id: number;
  name: string;
  shortName: string;
  active: boolean;
}

export interface CreateUnitInput {
  name: string;
  shortName: string;
}

export interface UpdateUnitInput {
  name?: string;
  shortName?: string;
}

export interface UnitListResponse {
  success: boolean;
  data: {
    units: UnitOfMeasure[];
  };
}

export interface UnitSingleResponse {
  success: boolean;
  message?: string;
  data: {
    unit: UnitOfMeasure;
  };
}

