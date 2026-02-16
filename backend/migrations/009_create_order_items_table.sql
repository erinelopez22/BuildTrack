-- Migration: Create Order Items table
-- Timestamp: 20260212120800_create_order_items_table.sql

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='order_items' and xtype='U')
BEGIN
    CREATE TABLE order_items (
        id NVARCHAR(36) PRIMARY KEY,
        order_id NVARCHAR(36) NOT NULL,
        sku_id NVARCHAR(36) NOT NULL,
        quantity_ordered INT NOT NULL,
        quantity_received INT DEFAULT 0,
        unit_price DECIMAL(18, 2),
        notes NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        
        CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_order_items_sku FOREIGN KEY (sku_id) REFERENCES skus(id)
    );
    
    CREATE INDEX idx_order_items_order ON order_items(order_id);
    CREATE INDEX idx_order_items_sku ON order_items(sku_id);
    
    PRINT 'Created order_items table';
END
ELSE
BEGIN
    PRINT 'order_items table already exists';
END;
