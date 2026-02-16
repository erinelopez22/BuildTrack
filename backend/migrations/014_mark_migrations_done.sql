-- Insert migration history entries for already-applied migrations
USE BuildTrack;

IF OBJECT_ID('migration_history','U') IS NULL
BEGIN
    PRINT 'migration_history table missing; skipping insert.';
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT * FROM migration_history WHERE migration_name = '000_create_stockwell_login.sql')
    INSERT INTO migration_history (migration_name, duration_ms) VALUES ('000_create_stockwell_login.sql', 0);

    IF NOT EXISTS (SELECT * FROM migration_history WHERE migration_name = '001_create_users_table.sql')
    INSERT INTO migration_history (migration_name, duration_ms) VALUES ('001_create_users_table.sql', 0);

    IF NOT EXISTS (SELECT * FROM migration_history WHERE migration_name = '002_create_user_roles_table.sql')
    INSERT INTO migration_history (migration_name, duration_ms) VALUES ('002_create_user_roles_table.sql', 0);

    IF NOT EXISTS (SELECT * FROM migration_history WHERE migration_name = '003_create_projects_table.sql')
    INSERT INTO migration_history (migration_name, duration_ms) VALUES ('003_create_projects_table.sql', 0);

    IF NOT EXISTS (SELECT * FROM migration_history WHERE migration_name = '004_create_project_members_table.sql')
    INSERT INTO migration_history (migration_name, duration_ms) VALUES ('004_create_project_members_table.sql', 0);

    IF NOT EXISTS (SELECT * FROM migration_history WHERE migration_name = '005_create_skus_table.sql')
    INSERT INTO migration_history (migration_name, duration_ms) VALUES ('005_create_skus_table.sql', 0);

    IF NOT EXISTS (SELECT * FROM migration_history WHERE migration_name = '006_create_project_inventory_table.sql')
    INSERT INTO migration_history (migration_name, duration_ms) VALUES ('006_create_project_inventory_table.sql', 0);

    IF NOT EXISTS (SELECT * FROM migration_history WHERE migration_name = '007_create_inventory_transactions_table.sql')
    INSERT INTO migration_history (migration_name, duration_ms) VALUES ('007_create_inventory_transactions_table.sql', 0);

    IF NOT EXISTS (SELECT * FROM migration_history WHERE migration_name = '008_create_orders_table.sql')
    INSERT INTO migration_history (migration_name, duration_ms) VALUES ('008_create_orders_table.sql', 0);

    IF NOT EXISTS (SELECT * FROM migration_history WHERE migration_name = '009_create_order_items_table.sql')
    INSERT INTO migration_history (migration_name, duration_ms) VALUES ('009_create_order_items_table.sql', 0);

    IF NOT EXISTS (SELECT * FROM migration_history WHERE migration_name = '010_create_deliveries_table.sql')
    INSERT INTO migration_history (migration_name, duration_ms) VALUES ('010_create_deliveries_table.sql', 0);

    IF NOT EXISTS (SELECT * FROM migration_history WHERE migration_name = '011_create_delivery_items_table.sql')
    INSERT INTO migration_history (migration_name, duration_ms) VALUES ('011_create_delivery_items_table.sql', 0);

    IF NOT EXISTS (SELECT * FROM migration_history WHERE migration_name = '012_create_notifications_table.sql')
    INSERT INTO migration_history (migration_name, duration_ms) VALUES ('012_create_notifications_table.sql', 0);

    IF NOT EXISTS (SELECT * FROM migration_history WHERE migration_name = '013_create_migration_history_table.sql')
    INSERT INTO migration_history (migration_name, duration_ms) VALUES ('013_create_migration_history_table.sql', 0);

    IF NOT EXISTS (SELECT * FROM migration_history WHERE migration_name = 'seed_initial_data.sql')
    INSERT INTO migration_history (migration_name, duration_ms) VALUES ('seed_initial_data.sql', 0);
END
