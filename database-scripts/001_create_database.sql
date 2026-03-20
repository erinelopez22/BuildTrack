-- BuildTrack Database Setup Script
-- Run this against your SQL Server Express instance BEFORE running EF Core migrations
-- Usage: sqlcmd -S localhost\SQLEXPRESS -i 001_create_database.sql

USE master;
GO

-- Create database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'BuildTrackDB')
BEGIN
    CREATE DATABASE BuildTrackDB;
    PRINT 'Database BuildTrackDB created.';
END
ELSE
    PRINT 'Database BuildTrackDB already exists.';
GO

USE BuildTrackDB;
GO

PRINT 'Using database BuildTrackDB.';
GO
