export class AdjustInventoryDTO {
  sku_id!: string;
  quantity!: number;
  notes?: string;
}

export class TransferInventoryDTO {
  sku_id!: string;
  quantity!: number;
  target_project_id!: string;
  notes?: string;
}

export class InventoryResponseDTO {
  id!: string;
  project_id!: string;
  sku_id!: string;
  on_hand!: number;
  reserved!: number;
  min_threshold?: number;
  location_in_site?: string;
  created_at!: string;
  updated_at!: string;
}

export class InventoryTransactionResponseDTO {
  id!: string;
  project_id!: string;
  sku_id!: string;
  transaction_type!: string;
  quantity!: number;
  quantity_before!: number;
  quantity_after!: number;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  created_at!: string;
  created_by!: string;
}
