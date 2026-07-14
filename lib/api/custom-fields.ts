import apiClient from './client';

export type FieldType =
  | 'text' | 'long_text' | 'integer' | 'decimal' | 'boolean'
  | 'date' | 'datetime' | 'single_choice' | 'multi_choice'
  | 'email' | 'url' | 'phone';

export type EntityType = 'employee' | 'project' | 'customer' | 'supplier';

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface ValidationRules {
  min?: number;
  max?: number;
  max_length?: number;
  regex?: string;
}

export interface CustomFieldDefinition {
  id: number;
  entity_type: EntityType;
  key: string;
  label: string;
  field_type: FieldType;
  is_required: boolean;
  default_value: unknown | null;
  help_text_user: string;
  is_active: boolean;
  order: number;
  validation_rules: ValidationRules | null;
  choices: ChoiceOption[] | null;
  is_read_only: boolean;
  is_sensitive: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomFieldValueItem {
  definition: CustomFieldDefinition;
  value: unknown;
  masked: boolean;
}

export interface EntityCustomFieldsResponse {
  entity_type: EntityType;
  object_id: number;
  fields: CustomFieldValueItem[];
}

export const customFieldsApi = {
  // ── Definitions ───────────────────────────────────────────────────────────

  listDefinitions: async (params?: {
    entity_type?: EntityType;
    is_active?: boolean;
    is_sensitive?: boolean;
  }): Promise<CustomFieldDefinition[]> => {
    const r = await apiClient.get('/custom-fields/definitions/', { params });
    return r.data;
  },

  getDefinition: async (id: number): Promise<CustomFieldDefinition> => {
    const r = await apiClient.get(`/custom-fields/definitions/${id}/`);
    return r.data;
  },

  createDefinition: async (
    data: Partial<CustomFieldDefinition>
  ): Promise<CustomFieldDefinition> => {
    const r = await apiClient.post('/custom-fields/definitions/', data);
    return r.data;
  },

  updateDefinition: async (
    id: number,
    data: Partial<CustomFieldDefinition>
  ): Promise<CustomFieldDefinition> => {
    const r = await apiClient.patch(`/custom-fields/definitions/${id}/`, data);
    return r.data;
  },

  deleteDefinition: async (id: number): Promise<void> => {
    await apiClient.delete(`/custom-fields/definitions/${id}/`);
  },

  // ── Entity values ─────────────────────────────────────────────────────────

  getEntityValues: async (
    entityBaseUrl: string,
    objectId: number
  ): Promise<EntityCustomFieldsResponse> => {
    const r = await apiClient.get(`${entityBaseUrl}${objectId}/custom-fields/`);
    return r.data;
  },

  setEntityValues: async (
    entityBaseUrl: string,
    objectId: number,
    values: Record<string, unknown>
  ): Promise<EntityCustomFieldsResponse> => {
    const r = await apiClient.put(`${entityBaseUrl}${objectId}/custom-fields/`, { values });
    return r.data;
  },
};
