SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

USE BuildTrackDB;
GO

DELETE FROM UserRoles WHERE UserId IN (SELECT Id FROM Profiles WHERE Email = 'admin@buildtrack.com');
DELETE FROM Profiles WHERE Email = 'admin@buildtrack.com';
PRINT 'Admin record cleaned up.';
GO
