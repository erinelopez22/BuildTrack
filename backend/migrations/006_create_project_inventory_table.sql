-- Migration: Create Project Inventory table
-- Timestamp: 20260212120500_create_project_inventory_table.sql

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='project_inventory' and xtype='U')
BEGIN
    CREATE TABLE project_inventory (
        id NVARCHAR(36) PRIMARY KEY,
        project_id NVARCHAR(36) NOT NULL,
        sku_id NVARCHAR(36) NOT NULL,
        on_hand INT DEFAULT 0,
        reserved INT DEFAULT 0,
        min_threshold INT,
        location_in_site NVARCHAR(255),
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        updated_at DATETIME2 DEFAULT GETUTCDATE(),
        
        CONSTRAINT fk_inventory_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_inventory_sku FOREIGN KEY (sku_id) REFERENCES skus(id) ON DELETE CASCADE
    );
    
    CREATE INDEX idx_inventory_project ON project_inventory(project_id);
    CREATE INDEX idx_inventory_sku ON project_inventory(sku_id);
    CREATE UNIQUE INDEX idx_inventory_unique ON project_inventory(project_id, sku_id);
    
    PRINT 'Created project_inventory table';
END
ELSE
BEGIN
    PRINT 'project_inventory table already exists';
END;
