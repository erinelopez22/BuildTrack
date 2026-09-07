// BuildTrack database schema (Drizzle / Postgres)
// Ported from backend/BuildTrack.API/Models/Entities/*.cs (EF Core + SQL Server).
// Fresh database — table/column names are snake_case; Drizzle objects are camelCase.

import {
  boolean,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => numeric(name, { precision: 18, scale: 2 });
const qty = (name: string) => numeric(name, { precision: 18, scale: 4 });

// ── Companies ────────────────────────────────────────────────────────────────
export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ── Profiles (users) ─────────────────────────────────────────────────────────
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name'),
  username: text('username'),
  address: text('address'),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  smsOptIn: boolean('sms_opt_in').notNull().default(false),
  notificationPreferences: text('notification_preferences'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: uuid('created_by'),
  companyId: uuid('company_id').references(() => companies.id, {
    onDelete: 'set null',
  }),
});

export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  createdAt: createdAt(),
  createdBy: uuid('created_by'),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  isRevoked: boolean('is_revoked').notNull().default(false),
});

// ── Projects ─────────────────────────────────────────────────────────────────
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  code: text('code'),
  location: text('location'),
  description: text('description'),
  status: text('status').notNull().default('active'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  projectManagerId: uuid('project_manager_id').references(() => profiles.id, {
    onDelete: 'set null',
  }),
  estimatedCost: money('estimated_cost'),
  isHidden: boolean('is_hidden').notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: uuid('created_by'),
  companyId: uuid('company_id').references(() => companies.id, {
    onDelete: 'set null',
  }),
});

export const projectMembers = pgTable('project_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  role: text('role'),
  createdAt: createdAt(),
  createdBy: uuid('created_by'),
});

// ── SKUs ─────────────────────────────────────────────────────────────────────
export const skus = pgTable('skus', {
  id: uuid('id').primaryKey().defaultRandom(),
  skuCode: text('sku_code').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  unitOfMeasure: text('unit_of_measure'),
  brand: text('brand'),
  specifications: text('specifications'),
  defaultMinThreshold: qty('default_min_threshold').notNull().default('0'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  createdBy: uuid('created_by'),
  companyId: uuid('company_id').references(() => companies.id, {
    onDelete: 'set null',
  }),
});

// ── Quotations ───────────────────────────────────────────────────────────────
export const projectQuotations = pgTable('project_quotations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by'),
  notes: text('notes'),
  category: text('category'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const quotationItems = pgTable('quotation_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  quotationId: uuid('quotation_id')
    .notNull()
    .references(() => projectQuotations.id, { onDelete: 'cascade' }),
  materialName: text('material_name').notNull(),
  unit: text('unit'),
  quantity: qty('quantity').notNull().default('0'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const quotationChangeRequests = pgTable('quotation_change_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  quotationId: uuid('quotation_id').references(() => projectQuotations.id, {
    onDelete: 'set null',
  }),
  changeType: text('change_type'),
  status: text('status').notNull().default('pending'),
  requestedBy: uuid('requested_by'),
  reviewedBy: uuid('reviewed_by'),
  reviewRemarks: text('review_remarks'),
  payload: text('payload'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ── Inventory ────────────────────────────────────────────────────────────────
export const projectInventory = pgTable('project_inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  skuId: uuid('sku_id')
    .notNull()
    .references(() => skus.id, { onDelete: 'restrict' }),
  onHand: qty('on_hand').notNull().default('0'),
  reserved: qty('reserved').notNull().default('0'),
  minThreshold: qty('min_threshold').notNull().default('0'),
  locationInSite: text('location_in_site'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const inventoryTransactions = pgTable('inventory_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  skuId: uuid('sku_id')
    .notNull()
    .references(() => skus.id, { onDelete: 'restrict' }),
  transactionType: text('transaction_type').notNull(),
  quantity: qty('quantity').notNull().default('0'),
  quantityBefore: qty('quantity_before').notNull().default('0'),
  quantityAfter: qty('quantity_after').notNull().default('0'),
  referenceType: text('reference_type'),
  referenceId: uuid('reference_id'),
  transferProjectId: uuid('transfer_project_id'),
  notes: text('notes'),
  createdBy: uuid('created_by'),
  createdAt: createdAt(),
});

// ── Orders ───────────────────────────────────────────────────────────────────
export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  orderNumber: text('order_number').notNull(),
  orderType: text('order_type'),
  status: text('status').notNull().default('draft'),
  supplierName: text('supplier_name'),
  supplierContact: text('supplier_contact'),
  expectedDeliveryDate: timestamp('expected_delivery_date', {
    withTimezone: true,
  }),
  notes: text('notes'),
  totalAmount: money('total_amount'),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedByName: text('approved_by_name'),
  rejectedBy: uuid('rejected_by'),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  createdBy: uuid('created_by'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  onTransitAt: timestamp('on_transit_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  skuId: uuid('sku_id')
    .notNull()
    .references(() => skus.id, { onDelete: 'restrict' }),
  quotationItemId: uuid('quotation_item_id').references(() => quotationItems.id, {
    onDelete: 'set null',
  }),
  quantityOrdered: qty('quantity_ordered').notNull().default('0'),
  quantityReceived: qty('quantity_received').notNull().default('0'),
  unitPrice: money('unit_price'),
  notes: text('notes'),
  createdAt: createdAt(),
});

export const deliveries = pgTable('deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  deliveryNumber: text('delivery_number'),
  deliveryDate: timestamp('delivery_date', { withTimezone: true }),
  receivedDate: timestamp('received_date', { withTimezone: true }),
  carrier: text('carrier'),
  trackingNumber: text('tracking_number'),
  notes: text('notes'),
  receivedBy: uuid('received_by'),
  createdAt: createdAt(),
});

export const deliveryItems = pgTable('delivery_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  deliveryId: uuid('delivery_id')
    .notNull()
    .references(() => deliveries.id, { onDelete: 'cascade' }),
  orderItemId: uuid('order_item_id')
    .notNull()
    .references(() => orderItems.id, { onDelete: 'restrict' }),
  quantityReceived: qty('quantity_received').notNull().default('0'),
  condition: text('condition'),
  notes: text('notes'),
  createdAt: createdAt(),
});

// ── Order tracking ───────────────────────────────────────────────────────────
export const orderTrackingAssignments = pgTable('order_tracking_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  driverUserId: uuid('driver_user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'restrict' }),
  plateNumber: text('plate_number').notNull().default(''),
  trackingReference: text('tracking_reference'),
  notes: text('notes'),
  trackingStatus: text('tracking_status').notNull().default('on_transit'),
  arrivedAt: timestamp('arrived_at', { withTimezone: true }),
  holdRemarks: text('hold_remarks'),
  heldAt: timestamp('held_at', { withTimezone: true }),
  resumeRemarks: text('resume_remarks'),
  resumedAt: timestamp('resumed_at', { withTimezone: true }),
  createdBy: uuid('created_by'),
  createdAt: createdAt(),
  evidenceJson: text('evidence_json'),
  receiverEvidenceJson: text('receiver_evidence_json'),
});

export const orderTrackingMaterials = pgTable('order_tracking_materials', {
  id: uuid('id').primaryKey().defaultRandom(),
  assignmentId: uuid('assignment_id')
    .notNull()
    .references(() => orderTrackingAssignments.id, { onDelete: 'cascade' }),
  orderItemId: uuid('order_item_id')
    .notNull()
    .references(() => orderItems.id, { onDelete: 'restrict' }),
  assignedQuantity: money('assigned_quantity').notNull().default('0'),
});

// ── Company assets ───────────────────────────────────────────────────────────
export const companyAssets = pgTable('company_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetName: text('asset_name').notNull(),
  assetType: text('asset_type'),
  assetCode: text('asset_code'),
  unit: text('unit'),
  totalQuantity: qty('total_quantity').notNull().default('0'),
  condition: text('condition'),
  notes: text('notes'),
  createdBy: uuid('created_by'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  companyId: uuid('company_id').references(() => companies.id, {
    onDelete: 'set null',
  }),
});

export const borrowTransactions = pgTable('borrow_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => companyAssets.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').references(() => projects.id, {
    onDelete: 'set null',
  }),
  borrowedQty: qty('borrowed_qty').notNull().default('0'),
  borrowedBy: uuid('borrowed_by'),
  borrowedAt: createdAt(),
  expectedReturnDate: timestamp('expected_return_date', { withTimezone: true }),
  returnedQty: qty('returned_qty').notNull().default('0'),
  returnedAt: timestamp('returned_at', { withTimezone: true }),
  returnRemarks: text('return_remarks'),
  status: text('status').notNull().default('Borrowed'),
  requestType: text('request_type'),
  approvalStatus: text('approval_status').notNull().default('approved'),
  approvedBy: uuid('approved_by'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  rejectionRemarks: text('rejection_remarks'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ── Notifications & audit ────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  message: text('message'),
  type: text('type'),
  referenceType: text('reference_type'),
  referenceId: uuid('reference_id'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: createdAt(),
});

export const notificationSettings = pgTable('notification_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  emailEnabled: boolean('email_enabled').notNull().default(true),
  smsEnabled: boolean('sms_enabled').notNull().default(false),
  orderUpdates: boolean('order_updates').notNull().default(true),
  inventoryUpdates: boolean('inventory_updates').notNull().default(true),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tableName: text('table_name').notNull(),
  recordId: uuid('record_id'),
  action: text('action').notNull(),
  oldValues: text('old_values'),
  newValues: text('new_values'),
  userId: uuid('user_id').references(() => profiles.id, {
    onDelete: 'set null',
  }),
  ipAddress: text('ip_address'),
  createdAt: createdAt(),
});
