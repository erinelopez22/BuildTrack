-- Migration: Create Inventory Transactions table
-- Timestamp: 20260212120600_create_inventory_transactions_table.sql

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='inventory_transactions' and xtype='U')
BEGIN
    CREATE TABLE inventory_transactions (
        id NVARCHAR(36) PRIMARY KEY,
        project_id NVARCHAR(36) NOT NULL,
        sku_id NVARCHAR(36) NOT NULL,
        transaction_type NVARCHAR(50) NOT NULL,
        quantity INT NOT NULL,
        quantity_before INT,
        quantity_after INT,
        reference_type NVARCHAR(50),
        reference_id NVARCHAR(36),
        transfer_project_id NVARCHAR(36),
        notes NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        created_by NVARCHAR(36) NOT NULL,
        
        CONSTRAINT fk_trans_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_trans_sku FOREIGN KEY (sku_id) REFERENCES skus(id) ON DELETE CASCADE,
        CONSTRAINT fk_trans_creator FOREIGN KEY (created_by) REFERENCES users(id)
    );
    
    CREATE INDEX idx_trans_project ON inventory_transactions(project_id);
    CREATE INDEX idx_trans_sku ON inventory_transactions(sku_id);
    CREATE INDEX idx_trans_type ON inventory_transactions(transaction_type);
    CREATE INDEX idx_trans_created_at ON inventory_transactions(created_at);
    
    PRINT 'Created inventory_transactions table';
END
ELSE
BEGIN
    PRINT 'inventory_transactions table already exists';
END;
