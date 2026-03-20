-- ============================================================
-- Demo User Seeding Script
-- Run AFTER: 001_create_database.sql and 002_seed_admin.sql
--
-- All demo users have initial password: Stockwell@2026
-- BCrypt hash below was generated with BCrypt.Net-Next (cost 11)
-- for the password: Stockwell@2026
--
-- USERS CREATED:
-- ┌─────────────────────────────────────────┬──────────────────────────────────┬─────────────────┬─────────────────┐
-- │ Full Name                               │ Email                            │ Username        │ Role            │
-- ├─────────────────────────────────────────┼──────────────────────────────────┼─────────────────┼─────────────────┤
-- │ Juan dela Cruz                          │ engineer@buildtrack.com          │ juan.engineer   │ project_engineer│
-- │ Maria Santos                            │ maria.admin@buildtrack.com       │ maria.admin     │ admin           │
-- │ Roberto Reyes                           │ checker@buildtrack.com           │ roberto.checker │ checker         │
-- │ Ana Flores                              │ officeadmin@buildtrack.com       │ ana.officeadmin │ office_admin    │
-- │ Miguel Torres                           │ logistics@buildtrack.com         │ miguel.trucking │ logistics_admin │
-- │ Carlos Ramos                            │ driver@buildtrack.com            │ carlos.driver   │ driver          │
-- └─────────────────────────────────────────┴──────────────────────────────────┴─────────────────┴─────────────────┘
--
-- Initial Password (all users): Stockwell@2026
-- ============================================================

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

USE BuildTrackDB;
GO

DECLARE @now DATETIME2 = GETUTCDATE();

-- BCrypt hash of 'Stockwell@2026' (cost factor 11, BCrypt.Net-Next)
DECLARE @pw NVARCHAR(MAX) = '$2a$11$sH/qrzsXuBwuGIFsecvcw.B7f8eyblRzaFXPZ8O/QrJ7BK/prZe7q';

-- ── 1. Project Engineer – Juan dela Cruz ──────────────────────────────────────
DECLARE @engId UNIQUEIDENTIFIER = NEWID();
IF NOT EXISTS (SELECT 1 FROM Profiles WHERE Email = 'engineer@buildtrack.com')
BEGIN
    INSERT INTO Profiles (Id, Email, PasswordHash, FullName, Username, SmsOptIn, IsActive, CreatedAt, UpdatedAt)
    VALUES (@engId, 'engineer@buildtrack.com', @pw, 'Juan dela Cruz', 'juan.engineer', 0, 1, @now, @now);

    INSERT INTO UserRoles (Id, UserId, Role, CreatedAt, CreatedBy)
    VALUES (NEWID(), @engId, 'project_engineer', @now, @engId);

    PRINT 'Created: Juan dela Cruz (project_engineer) — engineer@buildtrack.com';
END
ELSE
    PRINT 'SKIP: engineer@buildtrack.com already exists.';
GO

-- ── 2. Admin – Maria Santos ───────────────────────────────────────────────────
DECLARE @now DATETIME2 = GETUTCDATE();
DECLARE @pw NVARCHAR(MAX) = '$2a$11$sH/qrzsXuBwuGIFsecvcw.B7f8eyblRzaFXPZ8O/QrJ7BK/prZe7q';
DECLARE @admId UNIQUEIDENTIFIER = NEWID();
IF NOT EXISTS (SELECT 1 FROM Profiles WHERE Email = 'maria.admin@buildtrack.com')
BEGIN
    INSERT INTO Profiles (Id, Email, PasswordHash, FullName, Username, SmsOptIn, IsActive, CreatedAt, UpdatedAt)
    VALUES (@admId, 'maria.admin@buildtrack.com', @pw, 'Maria Santos', 'maria.admin', 0, 1, @now, @now);

    INSERT INTO UserRoles (Id, UserId, Role, CreatedAt, CreatedBy)
    VALUES (NEWID(), @admId, 'admin', @now, @admId);

    PRINT 'Created: Maria Santos (admin) — maria.admin@buildtrack.com';
END
ELSE
    PRINT 'SKIP: maria.admin@buildtrack.com already exists.';
GO

-- ── 3. Checker – Roberto Reyes ────────────────────────────────────────────────
DECLARE @now DATETIME2 = GETUTCDATE();
DECLARE @pw NVARCHAR(MAX) = '$2a$11$sH/qrzsXuBwuGIFsecvcw.B7f8eyblRzaFXPZ8O/QrJ7BK/prZe7q';
DECLARE @chkId UNIQUEIDENTIFIER = NEWID();
IF NOT EXISTS (SELECT 1 FROM Profiles WHERE Email = 'checker@buildtrack.com')
BEGIN
    INSERT INTO Profiles (Id, Email, PasswordHash, FullName, Username, SmsOptIn, IsActive, CreatedAt, UpdatedAt)
    VALUES (@chkId, 'checker@buildtrack.com', @pw, 'Roberto Reyes', 'roberto.checker', 0, 1, @now, @now);

    INSERT INTO UserRoles (Id, UserId, Role, CreatedAt, CreatedBy)
    VALUES (NEWID(), @chkId, 'checker', @now, @chkId);

    PRINT 'Created: Roberto Reyes (checker) — checker@buildtrack.com';
END
ELSE
    PRINT 'SKIP: checker@buildtrack.com already exists.';
GO

-- ── 4. Office Admin – Ana Flores ──────────────────────────────────────────────
DECLARE @now DATETIME2 = GETUTCDATE();
DECLARE @pw NVARCHAR(MAX) = '$2a$11$sH/qrzsXuBwuGIFsecvcw.B7f8eyblRzaFXPZ8O/QrJ7BK/prZe7q';
DECLARE @oaId UNIQUEIDENTIFIER = NEWID();
IF NOT EXISTS (SELECT 1 FROM Profiles WHERE Email = 'officeadmin@buildtrack.com')
BEGIN
    INSERT INTO Profiles (Id, Email, PasswordHash, FullName, Username, SmsOptIn, IsActive, CreatedAt, UpdatedAt)
    VALUES (@oaId, 'officeadmin@buildtrack.com', @pw, 'Ana Flores', 'ana.officeadmin', 0, 1, @now, @now);

    INSERT INTO UserRoles (Id, UserId, Role, CreatedAt, CreatedBy)
    VALUES (NEWID(), @oaId, 'office_admin', @now, @oaId);

    PRINT 'Created: Ana Flores (office_admin) — officeadmin@buildtrack.com';
END
ELSE
    PRINT 'SKIP: officeadmin@buildtrack.com already exists.';
GO

-- ── 5. Trucking / Logistics Admin – Miguel Torres ─────────────────────────────
DECLARE @now DATETIME2 = GETUTCDATE();
DECLARE @pw NVARCHAR(MAX) = '$2a$11$sH/qrzsXuBwuGIFsecvcw.B7f8eyblRzaFXPZ8O/QrJ7BK/prZe7q';
DECLARE @laId UNIQUEIDENTIFIER = NEWID();
IF NOT EXISTS (SELECT 1 FROM Profiles WHERE Email = 'logistics@buildtrack.com')
BEGIN
    INSERT INTO Profiles (Id, Email, PasswordHash, FullName, Username, SmsOptIn, IsActive, CreatedAt, UpdatedAt)
    VALUES (@laId, 'logistics@buildtrack.com', @pw, 'Miguel Torres', 'miguel.trucking', 0, 1, @now, @now);

    INSERT INTO UserRoles (Id, UserId, Role, CreatedAt, CreatedBy)
    VALUES (NEWID(), @laId, 'logistics_admin', @now, @laId);

    PRINT 'Created: Miguel Torres (logistics_admin) — logistics@buildtrack.com';
END
ELSE
    PRINT 'SKIP: logistics@buildtrack.com already exists.';
GO

-- ── 6. Driver – Carlos Ramos ──────────────────────────────────────────────────
DECLARE @now DATETIME2 = GETUTCDATE();
DECLARE @pw NVARCHAR(MAX) = '$2a$11$sH/qrzsXuBwuGIFsecvcw.B7f8eyblRzaFXPZ8O/QrJ7BK/prZe7q';
DECLARE @drvId UNIQUEIDENTIFIER = NEWID();
IF NOT EXISTS (SELECT 1 FROM Profiles WHERE Email = 'driver@buildtrack.com')
BEGIN
    INSERT INTO Profiles (Id, Email, PasswordHash, FullName, Username, SmsOptIn, IsActive, CreatedAt, UpdatedAt)
    VALUES (@drvId, 'driver@buildtrack.com', @pw, 'Carlos Ramos', 'carlos.driver', 0, 1, @now, @now);

    INSERT INTO UserRoles (Id, UserId, Role, CreatedAt, CreatedBy)
    VALUES (NEWID(), @drvId, 'driver', @now, @drvId);

    PRINT 'Created: Carlos Ramos (driver) — driver@buildtrack.com';
END
ELSE
    PRINT 'SKIP: driver@buildtrack.com already exists.';
GO

PRINT '=== Demo user seeding complete. Initial password for all: Stockwell@2026 ===';
GO
