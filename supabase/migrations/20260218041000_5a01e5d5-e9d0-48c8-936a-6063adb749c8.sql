
-- Database cleanup: remove all application data, keep users, roles, and profiles
-- Using DELETE with proper order to respect FK constraints

-- Evidence and tracking materials first (deepest children)
DELETE FROM receiver_evidence;
DELETE FROM order_tracking_evidence;
DELETE FROM tracking_driver_materials;

-- Tracking assignments
DELETE FROM order_tracking_assignments;

-- Delivery items then deliveries
DELETE FROM delivery_items;
DELETE FROM deliveries;

-- Order items then orders
DELETE FROM order_items;
DELETE FROM orders;

-- Quotation items, change requests, then quotations
DELETE FROM quotation_items;
DELETE FROM quotation_change_requests;
DELETE FROM project_quotations;

-- Inventory
DELETE FROM inventory_transactions;
DELETE FROM project_inventory;

-- Project members then projects
DELETE FROM project_members;
DELETE FROM projects;

-- SKUs
DELETE FROM skus;

-- Company assets and borrows
DELETE FROM borrow_transactions;
DELETE FROM company_assets;

-- Logs and notifications
DELETE FROM notifications;
DELETE FROM audit_logs;
DELETE FROM sms_logs;
DELETE FROM sms_settings;

-- Test table
DELETE FROM "Test";
