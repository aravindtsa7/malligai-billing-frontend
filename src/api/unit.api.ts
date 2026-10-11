import { apiClient } from './api-client.ts';
import type {
  UnitOfMeasure,
  CreateUnitInput,
  UpdateUnitInput,
  UnitListResponse,
  UnitSingleResponse,
} from '../types/unit.types.ts';

export const unitApi = {
  listUnits: async (): Promise<UnitOfMeasure[]> => {
    const response = await apiClient.get<UnitListResponse>('/units');
    return response.data.data.units;
  },

  getUnitById: async (id: number): Promise<UnitOfMeasure> => {
    const response = await apiClient.get<UnitSingleResponse>(`/units/${id}`);
    return response.data.data.unit;
  },

  createUnit: async (payload: CreateUnitInput): Promise<UnitOfMeasure> => {
    const response = await apiClient.post<UnitSingleResponse>('/units', payload);
    return response.data.data.unit;
  },

  updateUnit: async (id: number, payload: UpdateUnitInput): Promise<UnitOfMeasure> => {
    const response = await apiClient.put<UnitSingleResponse>(`/units/${id}`, payload);
    return response.data.data.unit;
  },

  updateUnitStatus: async (id: number, active: boolean): Promise<UnitOfMeasure> => {
    const response = await apiClient.patch<UnitSingleResponse>(`/units/${id}/status`, { active });
    return response.data.data.unit;
  },
};

