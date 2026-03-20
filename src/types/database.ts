export type AppRole = 
  | 'super_admin' 
  | 'admin' 
  | 'office_admin'
  | 'warehouse_admin'
  | 'project_manager' 
  | 'procurement' 
  | 'storekeeper' 
  | 'site_lead' 
  | 'viewer'
  | 'approver'
  | 'approval_admin'
  | 'logistics_admin'
  | 'project_engineer'
  | 'receiver'
  | 'tracking_driver'
  | 'checker'
  | 'driver';

export type OrderStatus = 
  | 'draft'
  | 'for_approval'
  | 'approved'
  | 'submitted'
  | 'preparing'
  | 'ordered'
  | 'in_transit'
  | 'delivered'
  | 'partially_received'
  | 'fully_received'
  | 'closed'
  | 'cancelled'
  | 'rejected'
  | 'on_hold';

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'cancelled' | 'deleted';

export type TransactionType = 
  | 'stock_in'
  | 'stock_out'
  | 'transfer_in'
  | 'transfer_out'
  | 'adjustment'
  | 'receiving';

export type AssetType = 'Material' | 'Tool' | 'Equipment';
export type AssetCondition = 'Available' | 'Maintenance' | 'Retired';
export type BorrowStatus = 'Borrowed' | 'Partially Returned' | 'Returned';

// Maps DB order statuses to simplified UI display statuses
export const ORDER_STATUS_UI_MAP: Record<OrderStatus, string> = {
  draft: 'Order Request',
  for_approval: 'Order Request',
  approved: 'Approved',
  submitted: 'Ordered',
  ordered: 'Ordered',
  preparing: 'Preparing',
  in_transit: 'On Transit',
  delivered: 'Delivered',
  partially_received: 'Delivered',
  fully_received: 'Delivered',
  closed: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  on_hold: 'On-Hold',
};

// The simplified statuses shown in UI
export const SIMPLIFIED_ORDER_STATUSES = [
  'Order Request',
  'Approved', 
  'Ordered',
  'Preparing',
  'On Transit',
  'Delivered',
  'Rejected',
] as const;

// Map from simplified UI status to DB statuses
export const UI_TO_DB_STATUS_MAP: Record<string, OrderStatus[]> = {
  'Order Request': ['draft', 'for_approval'],
  'Approved': ['approved'],
  'Ordered': ['submitted', 'ordered'],
  'Preparing': ['preparing'],
  'On Transit': ['in_transit'],
  'Delivered': ['delivered', 'partially_received', 'fully_received', 'closed'],
  'Rejected': ['rejected'],
};

// Role display names - only active roles shown prominently
export const ROLE_DISPLAY_NAMES: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  office_admin: 'Office Admin',
  warehouse_admin: 'Trucking Admin',
  project_manager: 'Project Manager',
  procurement: 'Procurement',
  storekeeper: 'Storekeeper',
  site_lead: 'Site Lead',
  viewer: 'Viewer',
  approver: 'Approver',
  approval_admin: 'Approval Admin',
  logistics_admin: 'Logistics Admin',
  project_engineer: 'Project Engineer',
  receiver: 'Receiver',
  tracking_driver: 'Driver',
  checker: 'Checker',
  driver: 'Driver',
};

// The ONLY active roles in the system
export const ACTIVE_ROLES: AppRole[] = [
  'super_admin',
  'admin',
  'viewer',
  'project_engineer',
  'checker',
  'driver',
  'office_admin',
  'warehouse_admin',
];

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  address: string | null;
  phone: string | null;
  avatar_url: string | null;
  sms_opt_in: boolean;
  notification_preferences: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
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
  is_hidden?: boolean;
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
  approved_by_name?: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  previous_status: string | null;
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

export interface ProjectQuotation {
  id: string;
  project_id: string;
  created_by: string;
  notes: string | null;
  category: 'initial' | 'additional';
  created_at: string;
  updated_at: string;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  material_name: string;
  unit: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface QuotationChangeRequest {
  id: string;
  project_id: string;
  quotation_id: string | null;
  change_type: 'create' | 'update' | 'delete';
  status: 'pending' | 'approved' | 'rejected';
  requested_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_remarks: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CompanyAsset {
  id: string;
  asset_name: string;
  asset_type: AssetType;
  asset_code: string | null;
  unit: string | null;
  total_quantity: number;
  condition: AssetCondition;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface BorrowTransaction {
  id: string;
  asset_id: string;
  project_id: string;
  borrowed_qty: number;
  borrowed_by: string;
  borrowed_at: string;
  expected_return_date: string | null;
  returned_qty: number;
  returned_at: string | null;
  return_remarks: string | null;
  status: BorrowStatus;
  created_at: string;
  updated_at: string;
  asset?: CompanyAsset;
  project?: Project;
  borrower?: Profile;
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
