-- Migration: Create Project Members table
-- Timestamp: 20260212120300_create_project_members_table.sql

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='project_members' and xtype='U')
BEGIN
    CREATE TABLE project_members (
        id NVARCHAR(36) PRIMARY KEY,
        project_id NVARCHAR(36) NOT NULL,
        user_id NVARCHAR(36) NOT NULL,
        role NVARCHAR(50) NOT NULL,
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        created_by NVARCHAR(36),
        
        CONSTRAINT fk_project_members_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_project_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    
    CREATE INDEX idx_project_members_project_id ON project_members(project_id);
    CREATE INDEX idx_project_members_user_id ON project_members(user_id);
    CREATE UNIQUE INDEX idx_project_members_unique ON project_members(project_id, user_id);
    
    PRINT 'Created project_members table';
END
ELSE
BEGIN
    PRINT 'project_members table already exists';
END;
