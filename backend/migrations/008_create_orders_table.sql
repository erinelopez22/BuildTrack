-- Migration: Create Orders table
-- Timestamp: 20260212120700_create_orders_table.sql

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='orders' and xtype='U')
BEGIN
    CREATE TABLE orders (
        id NVARCHAR(36) PRIMARY KEY,
        project_id NVARCHAR(36) NOT NULL,
        order_number NVARCHAR(100) NOT NULL UNIQUE,
        order_type NVARCHAR(50) NOT NULL,
        status NVARCHAR(50) DEFAULT 'draft',
        supplier_name NVARCHAR(255),
        supplier_contact NVARCHAR(255),
        expected_delivery_date DATETIME2,
        notes NVARCHAR(MAX),
        total_amount DECIMAL(18, 2),
        approved_by NVARCHAR(36),
        approved_at DATETIME2,
        rejected_by NVARCHAR(36),
        rejected_at DATETIME2,
        rejection_reason NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        updated_at DATETIME2 DEFAULT GETUTCDATE(),
        created_by NVARCHAR(36) NOT NULL,
        
        CONSTRAINT fk_orders_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_orders_creator FOREIGN KEY (created_by) REFERENCES users(id),
        CONSTRAINT fk_orders_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_orders_rejector FOREIGN KEY (rejected_by) REFERENCES users(id) ON DELETE SET NULL
    );
    
    CREATE INDEX idx_orders_project ON orders(project_id);
    CREATE INDEX idx_orders_status ON orders(status);
    CREATE INDEX idx_orders_number ON orders(order_number);
    CREATE INDEX idx_orders_created_at ON orders(created_at);
    
    PRINT 'Created orders table';
END
ELSE
BEGIN
    PRINT 'orders table already exists';
END;
