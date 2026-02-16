-- Seed initial admin user
-- Run this after migrations to create the first admin user

IF NOT EXISTS (SELECT * FROM users WHERE email = 'admin@stockwell.com')
BEGIN
    INSERT INTO users (id, email, full_name, password_hash, is_active, created_at, updated_at)
    VALUES (
        'admin-001', 
        'admin@stockwell.com', 
        'Admin User',
        -- Default password: admin123 (hashed with bcrypt)
        '$2a$10$TfX0xQGvF/qm5zQOjqVr4O7i7GLz3S9z8YQ7Q7R6H4mO9Z1Z1qZlG',
        1,
        GETUTCDATE(),
        GETUTCDATE()
    );
    
    INSERT INTO user_roles (id, user_id, role, created_at)
    VALUES ('role-001', 'admin-001', 'super_admin', GETUTCDATE());
    
    PRINT 'Admin user created successfully';
END
ELSE
BEGIN
    PRINT 'Admin user already exists';
END;
