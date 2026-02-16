export class CreateSKUDTO {
  sku_code!: string;
  name!: string;
  description?: string;
  category?: string;
  unit_of_measure!: string;
  brand?: string;
  specifications?: Record<string, any>;
  default_min_threshold!: number;
}

export class UpdateSKUDTO {
  name?: string;
  description?: string;
  category?: string;
  unit_of_measure?: string;
  brand?: string;
  specifications?: Record<string, any>;
  default_min_threshold?: number;
  is_active?: boolean;
}

export class SKUResponseDTO {
  id!: string;
  sku_code!: string;
  name!: string;
  description?: string;
  category?: string;
  unit_of_measure!: string;
  brand?: string;
  specifications?: Record<string, any>;
  default_min_threshold!: number;
  is_active!: boolean;
  created_at!: string;
  updated_at!: string;
}
