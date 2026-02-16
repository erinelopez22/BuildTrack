-- Create stockwell login and user if they don't exist
IF NOT EXISTS (SELECT * FROM sys.server_principals WHERE name = 'stockwell')
BEGIN
    CREATE LOGIN stockwell WITH PASSWORD = 'Password@01';
END

IF DB_ID('BuildTrack') IS NOT NULL
BEGIN
    USE BuildTrack;
    IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'stockwell')
    BEGIN
        CREATE USER stockwell FOR LOGIN stockwell;
        ALTER ROLE db_owner ADD MEMBER stockwell;
    END
END
