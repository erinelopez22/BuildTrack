export type AppRole = 
  | 'super_admin' 
  | 'admin' 
  | 'project_manager' 
  | 'procurement' 
  | 'storekeeper' 
  | 'site_lead' 
  | 'viewer'
  | 'approver';

export type OrderStatus = 
  | 'draft'
  | 'for_approval'
  | 'approved'
  | 'ordered'
  | 'in_transit'
  | 'delivered'
  | 'partially_received'
  | 'fully_received'
  | 'closed'
  | 'cancelled'
  | 'rejected';

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled' | 'deleted';

export type TransactionType = 
  | 'stock_in'
  | 'stock_out'
  | 'transfer_in'
  | 'transfer_out'
  | 'adjustment'
  | 'receiving';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  sms_opt_in: boolean;
  notification_preferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  created_by: string | null;
}

export interface Project {
  id: string;
  name: string;
  code: string | null;
  location: string | null;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  project_manager_id: string | null;
  estimated_cost: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  created_by: string | null;
}

export interface SKU {
  id: string;
  sku_code: string;
  name: string;
  description: string | null;
  category: string | null;
  unit_of_measure: string;
  brand: string | null;
  specifications: Record<string, unknown> | null;
  default_min_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ProjectInventory {
  id: string;
  project_id: string;
  sku_id: string;
  on_hand: number;
  reserved: number;
  min_threshold: number | null;
  location_in_site: string | null;
  created_at: string;
  updated_at: string;
  sku?: SKU;
  project?: Project;
}

export interface InventoryTransaction {
  id: string;
  project_id: string;
  sku_id: string;
  transaction_type: TransactionType;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reference_type: string | null;
  reference_id: string | null;
  transfer_project_id: string | null;
  notes: string | null;
  created_at: string;
  created_by: string;
  sku?: SKU;
  project?: Project;
  transfer_project?: Project;
  creator?: Profile;
}

export interface Order {
  id: string;
  project_id: string;
  order_number: string;
  order_type: string;
  status: OrderStatus;
  supplier_name: string | null;
  supplier_contact: string | null;
  expected_delivery_date: string | null;
  notes: string | null;
  total_amount: number | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  project?: Project;
  items?: OrderItem[];
  creator?: Profile;
  approver?: Profile;
  rejector?: Profile;
}

export interface OrderItem {
  id: string;
  order_id: string;
  sku_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number | null;
  notes: string | null;
  created_at: string;
  sku?: SKU;
}

export interface Delivery {
  id: string;
  order_id: string;
  delivery_number: string;
  delivery_date: string | null;
  received_date: string | null;
  carrier: string | null;
  tracking_number: string | null;
  notes: string | null;
  created_at: string;
  received_by: string | null;
  order?: Order;
  items?: DeliveryItem[];
  receiver?: Profile;
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  order_item_id: string;
  quantity_received: number;
  condition: string;
  notes: string | null;
  created_at: string;
  order_item?: OrderItem;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface SMSLog {
  id: string;
  recipient_user_id: string | null;
  phone_number: string;
  message: string;
  status: string;
  provider_message_id: string | null;
  error_message: string | null;
  event_type: string | null;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface SMSSettings {
  id: string;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  twilio_sender_number: string | null;
  is_enabled: boolean;
  event_rules: {
    order_status_change: AppRole[];
    low_stock: AppRole[];
    delivery_received: AppRole[];
  };
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  user_id: string | null;
  ip_address: string | null;
  created_at: string;
  user?: Profile;
}