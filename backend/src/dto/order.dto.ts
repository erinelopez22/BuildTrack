export class CreateOrderDTO {
  project_id!: string;
  order_type!: string;
  supplier_name?: string;
  supplier_contact?: string;
  expected_delivery_date?: string;
  notes?: string;
  items!: OrderItemDTO[];
}

export class OrderItemDTO {
  sku_id!: string;
  quantity_ordered!: number;
  unit_price?: number;
  notes?: string;
}

export class UpdateOrderDTO {
  status?: string;
  supplier_name?: string;
  supplier_contact?: string;
  expected_delivery_date?: string;
  notes?: string;
}

export class OrderResponseDTO {
  id!: string;
  project_id!: string;
  order_number!: string;
  order_type!: string;
  status!: string;
  supplier_name?: string;
  supplier_contact?: string;
  expected_delivery_date?: string;
  notes?: string;
  total_amount?: number;
  created_at!: string;
  updated_at!: string;
  created_by!: string;
  items?: OrderItemResponseDTO[];
}

export class OrderItemResponseDTO {
  id!: string;
  order_id!: string;
  sku_id!: string;
  quantity_ordered!: number;
  quantity_received!: number;
  unit_price?: number;
  notes?: string;
}

export class ApproveOrderDTO {
  approved_by!: string;
}

export class RejectOrderDTO {
  rejection_reason!: string;
}
