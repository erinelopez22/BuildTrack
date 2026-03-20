-- Sample data for development/testing
-- Run after 002_seed_admin.sql

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

USE BuildTrackDB;
GO

-- ── Sample SKUs ───────────────────────────────────────────────────────────────
DECLARE @adminId UNIQUEIDENTIFIER = (SELECT Id FROM Profiles WHERE Email = 'admin@buildtrack.com');
DECLARE @now     DATETIME2        = GETUTCDATE();

IF NOT EXISTS (SELECT 1 FROM SKUs WHERE SkuCode = 'CEM-OPC-50')
BEGIN
    INSERT INTO SKUs (Id, SkuCode, Name, Description, Category, UnitOfMeasure, Brand, DefaultMinThreshold, IsActive, CreatedAt, UpdatedAt, CreatedBy)
    VALUES
    (NEWID(), 'CEM-OPC-50',  'Portland Cement 50kg',          'Ordinary Portland Cement',               'Cement',    'bag',    'Holcim', 50,  1, @now, @now, @adminId),
    (NEWID(), 'REBAR-10MM',  'Deformed Bar 10mm',             '10mm Deformed Steel Bar 6m',             'Steel',     'piece',  'PNS',    100, 1, @now, @now, @adminId),
    (NEWID(), 'REBAR-12MM',  'Deformed Bar 12mm',             '12mm Deformed Steel Bar 6m',             'Steel',     'piece',  'PNS',    50,  1, @now, @now, @adminId),
    (NEWID(), 'SAND-CUB',    'Fine Sand',                     'Washed river sand',                      'Aggregate', 'cu.m',   'Local',  5,   1, @now, @now, @adminId),
    (NEWID(), 'GRAVEL-CUB',  'Crushed Gravel 3/4"',           '3/4 inch crushed gravel',                'Aggregate', 'cu.m',   'Local',  5,   1, @now, @now, @adminId),
    (NEWID(), 'CHB-4IN',     'CHB 4"',                        '4-inch Concrete Hollow Block',           'Masonry',   'piece',  'Local',  200, 1, @now, @now, @adminId),
    (NEWID(), 'PLYWOOD-34',  'Plywood 3/4"',                  '4x8 Marine Plywood 3/4 inch',            'Lumber',    'sheet',  'Local',  20,  1, @now, @now, @adminId),
    (NEWID(), 'GI-PIPE-2IN', 'GI Pipe 2"',                    '2-inch Galvanized Iron Pipe Schedule 40','Plumbing',  'length', 'Local',  10,  1, @now, @now, @adminId),
    (NEWID(), 'WIRE-BNDG',   'Binding Wire 16AWG',            'Galvanized binding wire',                'Hardware',  'kg',     'Local',  10,  1, @now, @now, @adminId),
    (NEWID(), 'NAIL-2IN',    'Nails 2"',                      '2-inch Common Wire Nails',               'Hardware',  'kg',     'Local',  5,   1, @now, @now, @adminId);

    PRINT 'Sample SKUs inserted.';
END
ELSE
    PRINT 'Sample SKUs already exist — skipped.';
GO

-- ── Sample Projects ───────────────────────────────────────────────────────────
-- Declarations MUST be outside IF...BEGIN so they are resolved in this batch
DECLARE @adminId3 UNIQUEIDENTIFIER = (SELECT Id FROM Profiles WHERE Email = 'admin@buildtrack.com');
DECLARE @now3     DATETIME2        = GETUTCDATE();
DECLARE @proj1Id  UNIQUEIDENTIFIER = NEWID();
DECLARE @proj2Id  UNIQUEIDENTIFIER = NEWID();

IF @adminId3 IS NULL
BEGIN
    PRINT 'ERROR: Admin user not found. Run 002_seed_admin.sql first.';
END
ELSE IF NOT EXISTS (SELECT 1 FROM Projects WHERE Code = 'PROJ-001')
BEGIN
    INSERT INTO Projects (Id, Name, Code, Location, Description, Status, StartDate, EndDate, EstimatedCost, IsHidden, CreatedAt, UpdatedAt, CreatedBy)
    VALUES
    (@proj1Id, 'Stockwell Main Building',      'PROJ-001', 'Makati City, Metro Manila', 'Main office building construction', 'active', DATEADD(MONTH, -2, @now3), DATEADD(MONTH, 10, @now3), 5000000.00, 0, @now3, @now3, @adminId3),
    (@proj2Id, 'Stockwell Warehouse Extension','PROJ-002', 'Paranaque, Metro Manila',   'Warehouse extension project',       'active', DATEADD(MONTH, -1, @now3), DATEADD(MONTH,  6, @now3), 2500000.00, 0, @now3, @now3, @adminId3);

    INSERT INTO ProjectMembers (Id, ProjectId, UserId, Role, CreatedAt, CreatedBy)
    VALUES
    (NEWID(), @proj1Id, @adminId3, 'project_manager', @now3, @adminId3),
    (NEWID(), @proj2Id, @adminId3, 'project_manager', @now3, @adminId3);

    PRINT 'Sample projects inserted.';
END
ELSE
    PRINT 'Sample projects already exist — skipped.';
GO

PRINT 'Sample data seeding complete.';
GO
