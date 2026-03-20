-- Seed initial super admin user
-- Run AFTER EF Core migrations: dotnet ef database update
-- Default credentials: admin@buildtrack.com / Admin@123456
-- CHANGE THE PASSWORD IMMEDIATELY AFTER FIRST LOGIN!

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

USE BuildTrackDB;
GO

DECLARE @adminId UNIQUEIDENTIFIER = NEWID();
DECLARE @now DATETIME2 = GETUTCDATE();

-- BCrypt hash of 'Admin@123456' (cost factor 11)
-- Generated with BCrypt.Net-Next: BCrypt.HashPassword("Admin@123456")
DECLARE @passwordHash NVARCHAR(MAX) = '$2a$11$XFRq7Q9W5CZ1g/E8tVc3PuqFE6KcJhCN/m2LDl3Wz/vMaY4QK2YdC';

IF NOT EXISTS (SELECT 1 FROM Profiles WHERE Email = 'admin@buildtrack.com')
BEGIN
    INSERT INTO Profiles (Id, Email, PasswordHash, FullName, Username, SmsOptIn, IsActive, CreatedAt, UpdatedAt)
    VALUES (@adminId, 'admin@buildtrack.com', @passwordHash, 'System Administrator', 'superadmin', 0, 1, @now, @now);

    INSERT INTO UserRoles (Id, UserId, Role, CreatedAt, CreatedBy)
    VALUES (NEWID(), @adminId, 'super_admin', @now, @adminId);

    INSERT INTO UserRoles (Id, UserId, Role, CreatedAt, CreatedBy)
    VALUES (NEWID(), @adminId, 'admin', @now, @adminId);

    PRINT 'Admin user seeded: admin@buildtrack.com / Admin@123456';
END
ELSE
    PRINT 'Admin user already exists.';
GO
