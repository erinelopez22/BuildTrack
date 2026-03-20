-- ============================================
-- BuildTrack API - SQL Server Database Script
-- ============================================
-- This script creates the complete database schema for BuildTrack
-- Run this in SQL Server Management Studio or via: sqlcmd -S .\SQLEXPRESS -i "CreateDatabase.sql"

-- Create Database
CREATE DATABASE [BuildTrackDb]
GO

USE [BuildTrackDb]
GO

-- =====================================================
-- Table: Users
-- =====================================================
CREATE TABLE [Users] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [Email] [nvarchar](255) NOT NULL UNIQUE,
    [PasswordHash] [nvarchar](255) NOT NULL,
    [FullName] [nvarchar](255) NULL,
    [Username] [nvarchar](100) NULL,
    [Address] [nvarchar](500) NULL,
    [Phone] [nvarchar](20) NULL,
    [AvatarUrl] [nvarchar](500) NULL,
    [SmsOptIn] [bit] NOT NULL DEFAULT 0,
    [EmailOptIn] [bit] NOT NULL DEFAULT 1,
    [IsActive] [bit] NOT NULL DEFAULT 1,
    [NotificationPreferences] [nvarchar](max) NULL,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [UpdatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [CreatedBy] [uniqueidentifier] NULL
)
GO

CREATE INDEX [IX_Users_Email] ON [Users] ([Email])
GO

-- =====================================================
-- Table: UserRoles
-- =====================================================
CREATE TABLE [UserRoles] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [UserId] [uniqueidentifier] NOT NULL,
    [Role] [nvarchar](50) NOT NULL,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [CreatedBy] [uniqueidentifier] NULL,
    CONSTRAINT [FK_UserRoles_Users] FOREIGN KEY ([UserId]) REFERENCES [Users]([Id]) ON DELETE CASCADE,
    CONSTRAINT [UQ_UserRoles_User_Role] UNIQUE ([UserId], [Role])
)
GO

-- =====================================================
-- Table: Projects
-- =====================================================
CREATE TABLE [Projects] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [Name] [nvarchar](255) NOT NULL,
    [Code] [nvarchar](50) NULL,
    [Location] [nvarchar](500) NULL,
    [Description] [nvarchar](2000) NULL,
    [Status] [nvarchar](50) NOT NULL DEFAULT 'active',
    [StartDate] [datetime2] NULL,
    [EndDate] [datetime2] NULL,
    [ProjectManagerId] [uniqueidentifier] NULL,
    [EstimatedCost] [decimal](18, 2) NULL,
    [IsHidden] [bit] NOT NULL DEFAULT 0,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [UpdatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [CreatedBy] [uniqueidentifier] NULL,
    CONSTRAINT [FK_Projects_CreatedBy] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([Id])
)
GO

-- =====================================================
-- Table: ProjectMembers
-- =====================================================
CREATE TABLE [ProjectMembers] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [ProjectId] [uniqueidentifier] NOT NULL,
    [UserId] [uniqueidentifier] NOT NULL,
    [Role] [nvarchar](50) NOT NULL,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [CreatedBy] [uniqueidentifier] NULL,
    CONSTRAINT [FK_ProjectMembers_Project] FOREIGN KEY ([ProjectId]) REFERENCES [Projects]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_ProjectMembers_User] FOREIGN KEY ([UserId]) REFERENCES [Users]([Id]),
    CONSTRAINT [UQ_ProjectMembers_Project_User] UNIQUE ([ProjectId], [UserId])
)
GO

-- =====================================================
-- Table: SKUs (Stock Keeping Units)
-- =====================================================
CREATE TABLE [SKUs] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [SkuCode] [nvarchar](50) NOT NULL UNIQUE,
    [Name] [nvarchar](255) NOT NULL,
    [Description] [nvarchar](2000) NULL,
    [Category] [nvarchar](100) NULL,
    [UnitOfMeasure] [nvarchar](50) NOT NULL,
    [Brand] [nvarchar](100) NULL,
    [Specifications] [nvarchar](max) NULL,
    [DefaultMinThreshold] [int] NOT NULL DEFAULT 0,
    [IsActive] [bit] NOT NULL DEFAULT 1,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [UpdatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [CreatedBy] [uniqueidentifier] NULL
)
GO

CREATE INDEX [IX_SKUs_SkuCode] ON [SKUs] ([SkuCode])
GO

-- =====================================================
-- Table: ProjectInventory
-- =====================================================
CREATE TABLE [ProjectInventories] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [ProjectId] [uniqueidentifier] NOT NULL,
    [SkuId] [uniqueidentifier] NOT NULL,
    [OnHand] [int] NOT NULL DEFAULT 0,
    [Reserved] [int] NOT NULL DEFAULT 0,
    [MinThreshold] [int] NULL,
    [LocationInSite] [nvarchar](255) NULL,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [UpdatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT [FK_ProjectInventories_Project] FOREIGN KEY ([ProjectId]) REFERENCES [Projects]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_ProjectInventories_SKU] FOREIGN KEY ([SkuId]) REFERENCES [SKUs]([Id]),
    CONSTRAINT [UQ_ProjectInventories_Project_SKU] UNIQUE ([ProjectId], [SkuId])
)
GO

-- =====================================================
-- Table: Orders
-- =====================================================
CREATE TABLE [Orders] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [ProjectId] [uniqueidentifier] NOT NULL,
    [OrderNumber] [nvarchar](50) NOT NULL,
    [OrderType] [nvarchar](50) NULL,
    [Status] [nvarchar](50) NOT NULL DEFAULT 'draft',
    [SupplierName] [nvarchar](255) NULL,
    [SupplierContact] [nvarchar](100) NULL,
    [TotalAmount] [decimal](18, 2) NULL,
    [Notes] [nvarchar](2000) NULL,
    [ApprovedAt] [datetime2] NULL,
    [ApprovedBy] [uniqueidentifier] NULL,
    [OnTransitAt] [datetime2] NULL,
    [DeliveredAt] [datetime2] NULL,
    [ExpectedDeliveryDate] [datetime2] NULL,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [UpdatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [CreatedBy] [uniqueidentifier] NOT NULL,
    CONSTRAINT [FK_Orders_Project] FOREIGN KEY ([ProjectId]) REFERENCES [Projects]([Id]),
    CONSTRAINT [FK_Orders_CreatedBy] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([Id])
)
GO

CREATE INDEX [IX_Orders_OrderNumber] ON [Orders] ([OrderNumber])
GO

-- =====================================================
-- Table: OrderLineItems
-- =====================================================
CREATE TABLE [OrderLineItems] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [OrderId] [uniqueidentifier] NOT NULL,
    [SkuId] [uniqueidentifier] NOT NULL,
    [Quantity] [int] NOT NULL,
    [UnitPrice] [decimal](18, 2) NULL,
    [Unit] [nvarchar](50) NULL,
    [Notes] [nvarchar](1000) NULL,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [UpdatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [CreatedBy] [uniqueidentifier] NULL,
    CONSTRAINT [FK_OrderLineItems_Order] FOREIGN KEY ([OrderId]) REFERENCES [Orders]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_OrderLineItems_SKU] FOREIGN KEY ([SkuId]) REFERENCES [SKUs]([Id])
)
GO

-- =====================================================
-- Table: Deliveries
-- =====================================================
CREATE TABLE [Deliveries] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [OrderId] [uniqueidentifier] NOT NULL,
    [DeliveryNumber] [nvarchar](50) NOT NULL,
    [DeliveryDate] [datetime2] NULL,
    [Carrier] [nvarchar](100) NULL,
    [TrackingNumber] [nvarchar](100) NULL,
    [ReceivedDate] [datetime2] NULL,
    [ReceivedBy] [uniqueidentifier] NULL,
    [Notes] [nvarchar](1000) NULL,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT [FK_Deliveries_Order] FOREIGN KEY ([OrderId]) REFERENCES [Orders]([Id]) ON DELETE CASCADE
)
GO

CREATE INDEX [IX_Deliveries_DeliveryNumber] ON [Deliveries] ([DeliveryNumber])
GO

-- =====================================================
-- Table: CompanyAssets
-- =====================================================
CREATE TABLE [CompanyAssets] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [AssetName] [nvarchar](255) NOT NULL,
    [AssetCode] [nvarchar](50) NULL UNIQUE,
    [AssetType] [nvarchar](50) NOT NULL,
    [Condition] [nvarchar](50) NULL DEFAULT 'Available',
    [TotalQuantity] [int] NOT NULL DEFAULT 0,
    [Unit] [nvarchar](50) NULL,
    [Notes] [nvarchar](2000) NULL,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [UpdatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [CreatedBy] [uniqueidentifier] NULL
)
GO

-- =====================================================
-- Table: BorrowTransactions
-- =====================================================
CREATE TABLE [BorrowTransactions] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [AssetId] [uniqueidentifier] NOT NULL,
    [ProjectId] [uniqueidentifier] NOT NULL,
    [BorrowedQty] [int] NOT NULL,
    [ReturnedQty] [int] NOT NULL DEFAULT 0,
    [Status] [nvarchar](50) NOT NULL DEFAULT 'Borrowed',
    [BorrowedBy] [uniqueidentifier] NOT NULL,
    [BorrowedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [BorrowRequestedBy] [uniqueidentifier] NULL,
    [BorrowRequestedAt] [datetime2] NULL,
    [BorrowApprovedBy] [uniqueidentifier] NULL,
    [BorrowApprovedAt] [datetime2] NULL,
    [ExpectedReturnDate] [datetime2] NULL,
    [ReturnRequestedBy] [uniqueidentifier] NULL,
    [ReturnRequestedAt] [datetime2] NULL,
    [ReturnApprovedBy] [uniqueidentifier] NULL,
    [ReturnApprovedAt] [datetime2] NULL,
    [ReturnedAt] [datetime2] NULL,
    [ReturnRemarks] [nvarchar](1000) NULL,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [UpdatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT [FK_BorrowTransactions_Asset] FOREIGN KEY ([AssetId]) REFERENCES [CompanyAssets]([Id]),
    CONSTRAINT [FK_BorrowTransactions_Project] FOREIGN KEY ([ProjectId]) REFERENCES [Projects]([Id])
)
GO

-- =====================================================
-- Table: EquipmentRequests
-- =====================================================
CREATE TABLE [EquipmentRequests] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [AssetId] [uniqueidentifier] NOT NULL,
    [ProjectId] [uniqueidentifier] NOT NULL,
    [QuantityRequested] [int] NOT NULL,
    [Status] [nvarchar](50) NOT NULL DEFAULT 'pending',
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [CreatedBy] [uniqueidentifier] NULL,
    CONSTRAINT [FK_EquipmentRequests_Asset] FOREIGN KEY ([AssetId]) REFERENCES [CompanyAssets]([Id]),
    CONSTRAINT [FK_EquipmentRequests_Project] FOREIGN KEY ([ProjectId]) REFERENCES [Projects]([Id])
)
GO

-- =====================================================
-- Table: ProjectQuotations
-- =====================================================
CREATE TABLE [ProjectQuotations] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [ProjectId] [uniqueidentifier] NOT NULL,
    [Category] [nvarchar](100) NOT NULL,
    [Notes] [nvarchar](2000) NULL,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [UpdatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [CreatedBy] [uniqueidentifier] NOT NULL,
    CONSTRAINT [FK_ProjectQuotations_Project] FOREIGN KEY ([ProjectId]) REFERENCES [Projects]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_ProjectQuotations_CreatedBy] FOREIGN KEY ([CreatedBy]) REFERENCES [Users]([Id])
)
GO

-- =====================================================
-- Table: QuotationItems
-- =====================================================
CREATE TABLE [QuotationItems] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [QuotationId] [uniqueidentifier] NOT NULL,
    [SkuId] [uniqueidentifier] NOT NULL,
    [Quantity] [int] NOT NULL,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [UpdatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT [FK_QuotationItems_Quotation] FOREIGN KEY ([QuotationId]) REFERENCES [ProjectQuotations]([Id]) ON DELETE CASCADE,
    CONSTRAINT [FK_QuotationItems_SKU] FOREIGN KEY ([SkuId]) REFERENCES [SKUs]([Id])
)
GO

-- =====================================================
-- Table: QuotationChangeRequests
-- =====================================================
CREATE TABLE [QuotationChangeRequests] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [QuotationId] [uniqueidentifier] NOT NULL,
    [SkuId] [uniqueidentifier] NOT NULL,
    [NewQuantity] [int] NOT NULL,
    [Reason] [nvarchar](500) NULL,
    [Status] [nvarchar](50) NOT NULL DEFAULT 'pending',
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [CreatedBy] [uniqueidentifier] NULL,
    CONSTRAINT [FK_QuotationChangeRequests_SKU] FOREIGN KEY ([SkuId]) REFERENCES [SKUs]([Id])
)
GO

-- =====================================================
-- Table: Notifications
-- =====================================================
CREATE TABLE [Notifications] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [UserId] [uniqueidentifier] NOT NULL,
    [Type] [nvarchar](100) NOT NULL,
    [Title] [nvarchar](255) NOT NULL,
    [Message] [nvarchar](2000) NOT NULL,
    [ReferenceType] [nvarchar](50) NULL,
    [ReferenceId] [nvarchar](100) NULL,
    [IsRead] [bit] NOT NULL DEFAULT 0,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE()
)
GO

CREATE INDEX [IX_Notifications_UserId] ON [Notifications] ([UserId])
GO

-- =====================================================
-- Table: AuditLogs
-- =====================================================
CREATE TABLE [AuditLogs] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [UserId] [uniqueidentifier] NULL,
    [Action] [nvarchar](50) NOT NULL,
    [TableName] [nvarchar](100) NOT NULL,
    [RecordId] [nvarchar](100) NOT NULL,
    [OldValues] [nvarchar](max) NULL,
    [NewValues] [nvarchar](max) NULL,
    [IpAddress] [nvarchar](45) NULL,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT [FK_AuditLogs_User] FOREIGN KEY ([UserId]) REFERENCES [Users]([Id])
)
GO

CREATE INDEX [IX_AuditLogs_TableName_RecordId] ON [AuditLogs] ([TableName], [RecordId])
GO

-- =====================================================
-- Table: SMSLogs
-- =====================================================
CREATE TABLE [SMSLogs] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [RecipientUserId] [uniqueidentifier] NULL,
    [PhoneNumber] [nvarchar](20) NOT NULL,
    [Message] [nvarchar](4000) NOT NULL,
    [Status] [nvarchar](50) NOT NULL,
    [EventType] [nvarchar](50) NULL,
    [ReferenceType] [nvarchar](50) NULL,
    [ReferenceId] [nvarchar](100) NULL,
    [ProviderMessageId] [nvarchar](255) NULL,
    [ErrorMessage] [nvarchar](1000) NULL,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE()
)
GO

-- =====================================================
-- Table: EmailLogs
-- =====================================================
CREATE TABLE [EmailLogs] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [ToUserId] [uniqueidentifier] NULL,
    [ToEmail] [nvarchar](255) NOT NULL,
    [Subject] [nvarchar](500) NOT NULL,
    [Status] [nvarchar](50) NOT NULL,
    [Provider] [nvarchar](100) NULL,
    [ProviderMessageId] [nvarchar](255) NULL,
    [EventType] [nvarchar](50) NULL,
    [EntityType] [nvarchar](50) NULL,
    [EntityId] [nvarchar](100) NULL,
    [ProjectId] [uniqueidentifier] NULL,
    [Error] [nvarchar](1000) NULL,
    [Mode] [nvarchar](50) NULL,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE()
)
GO

-- =====================================================
-- Table: RejectedOrders
-- =====================================================
CREATE TABLE [RejectedOrders] (
    [Id] [uniqueidentifier] NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [ProjectId] [uniqueidentifier] NOT NULL,
    [OrderNumber] [nvarchar](50) NOT NULL,
    [OrderType] [nvarchar](50) NULL,
    [Status] [nvarchar](50) NULL,
    [SupplierName] [nvarchar](255) NULL,
    [SupplierContact] [nvarchar](100) NULL,
    [TotalAmount] [decimal](18, 2) NULL,
    [Notes] [nvarchar](2000) NULL,
    [RejectionReason] [nvarchar](2000) NULL,
    [PreviousStatus] [nvarchar](50) NULL,
    [ApprovedAt] [datetime2] NULL,
    [ApprovedBy] [uniqueidentifier] NULL,
    [OnTransitAt] [datetime2] NULL,
    [DeliveredAt] [datetime2] NULL,
    [ExpectedDeliveryDate] [datetime2] NULL,
    [RejectedBy] [uniqueidentifier] NULL,
    [RejectedAt] [datetime2] NULL,
    [CreatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [UpdatedAt] [datetime2] NOT NULL DEFAULT GETUTCDATE(),
    [CreatedBy] [uniqueidentifier] NOT NULL,
    CONSTRAINT [FK_RejectedOrders_Project] FOREIGN KEY ([ProjectId]) REFERENCES [Projects]([Id])
)
GO

-- =====================================================
-- Create Indexes for Performance
-- =====================================================

CREATE INDEX [IX_Orders_ProjectId_Status] ON [Orders] ([ProjectId], [Status])
GO

CREATE INDEX [IX_Orders_CreatedBy_Status] ON [Orders] ([CreatedBy], [Status])
GO

CREATE INDEX [IX_BorrowTransactions_ProjectId_Status] ON [BorrowTransactions] ([ProjectId], [Status])
GO

CREATE INDEX [IX_ProjectMembers_UserId] ON [ProjectMembers] ([UserId])
GO

CREATE INDEX [IX_UserRoles_UserId] ON [UserRoles] ([UserId])
GO

-- =====================================================
-- Seed Initial Data
-- =====================================================

-- Insert default admin user
INSERT INTO [Users] (
    [Id],
    [Email],
    [PasswordHash],
    [FullName],
    [IsActive],
    [EmailOptIn]
) VALUES (
    NEWID(),
    'admin@buildtrack.local',
    -- Password: Admin123!@#
    '$2a$11$encrypted_password_hash_here',
    'Administrator',
    1,
    1
)
GO

PRINT '✅ Database BuildTrackDb created successfully'
PRINT '📊 All tables and indexes created'
PRINT '⚠️  Update admin password in application code'
