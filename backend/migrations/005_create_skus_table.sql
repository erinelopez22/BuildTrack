-- Migration: Create SKUs table
-- Timestamp: 20260212120400_create_skus_table.sql

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='skus' and xtype='U')
BEGIN
    CREATE TABLE skus (
        id NVARCHAR(36) PRIMARY KEY,
        sku_code NVARCHAR(100) NOT NULL UNIQUE,
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX),
        category NVARCHAR(100),
        unit_of_measure NVARCHAR(50) NOT NULL,
        brand NVARCHAR(100),
        specifications NVARCHAR(MAX),
        default_min_threshold INT DEFAULT 0,
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        updated_at DATETIME2 DEFAULT GETUTCDATE(),
        created_by NVARCHAR(36)
    );
    
    CREATE INDEX idx_skus_code ON skus(sku_code);
    CREATE INDEX idx_skus_is_active ON skus(is_active);
    CREATE INDEX idx_skus_category ON skus(category);
    
    PRINT 'Created skus table';
END
ELSE
BEGIN
    PRINT 'skus table already exists';
END;
