-- Migration: Create Projects table
-- Timestamp: 20260212120200_create_projects_table.sql

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='projects' and xtype='U')
BEGIN
    CREATE TABLE projects (
        id NVARCHAR(36) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        code NVARCHAR(50),
        location NVARCHAR(500),
        description NVARCHAR(MAX),
        status NVARCHAR(50) DEFAULT 'active',
        start_date DATETIME2,
        end_date DATETIME2,
        project_manager_id NVARCHAR(36),
        estimated_cost DECIMAL(18, 2),
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        updated_at DATETIME2 DEFAULT GETUTCDATE(),
        created_by NVARCHAR(36),
        
        CONSTRAINT fk_projects_manager FOREIGN KEY (project_manager_id) REFERENCES users(id) ON DELETE SET NULL
    );
    
    CREATE INDEX idx_projects_status ON projects(status);
    CREATE INDEX idx_projects_code ON projects(code);
    CREATE INDEX idx_projects_created_by ON projects(created_by);
    
    PRINT 'Created projects table';
END
ELSE
BEGIN
    PRINT 'projects table already exists';
END;
