using Microsoft.EntityFrameworkCore;
using StockwellApi.Models;

namespace StockwellApi.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options) { }

    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();
    public DbSet<Sku> Skus => Set<Sku>();
    public DbSet<ProjectInventory> ProjectInventory => Set<ProjectInventory>();
    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Delivery> Deliveries => Set<Delivery>();
    public DbSet<DeliveryItem> DeliveryItems => Set<DeliveryItem>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<ProjectQuotation> ProjectQuotations => Set<ProjectQuotation>();
    public DbSet<QuotationItem> QuotationItems => Set<QuotationItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Profile>(e =>
        {
            e.ToTable("profiles");
            e.HasKey(p => p.Id);
            e.HasIndex(p => p.Email).IsUnique();
            e.Property(p => p.NotificationPreferences).HasColumnName("notification_preferences");
            e.Property(p => p.FullName).HasColumnName("full_name");
            e.Property(p => p.AvatarUrl).HasColumnName("avatar_url");
            e.Property(p => p.SmsOptIn).HasColumnName("sms_opt_in");
            e.Property(p => p.IsActive).HasColumnName("is_active");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.PasswordHash).HasColumnName("password_hash");
        });

        modelBuilder.Entity<UserRole>(e =>
        {
            e.ToTable("user_roles");
            e.HasKey(ur => ur.Id);
            e.Property(ur => ur.UserId).HasColumnName("user_id");
            e.Property(ur => ur.CreatedBy).HasColumnName("created_by");
            e.Property(ur => ur.CreatedAt).HasColumnName("created_at");
            e.HasOne(ur => ur.User).WithMany(p => p.UserRoles).HasForeignKey(ur => ur.UserId);
        });

        modelBuilder.Entity<Project>(e =>
        {
            e.ToTable("projects");
            e.HasKey(p => p.Id);
            e.Property(p => p.StartDate).HasColumnName("start_date");
            e.Property(p => p.EndDate).HasColumnName("end_date");
            e.Property(p => p.ProjectManagerId).HasColumnName("project_manager_id");
            e.Property(p => p.EstimatedCost).HasColumnName("estimated_cost");
            e.Property(p => p.CreatedAt).HasColumnName("created_at");
            e.Property(p => p.UpdatedAt).HasColumnName("updated_at");
            e.Property(p => p.CreatedBy).HasColumnName("created_by");
        });

        modelBuilder.Entity<ProjectMember>(e =>
        {
            e.ToTable("project_members");
            e.HasKey(pm => pm.Id);
            e.Property(pm => pm.ProjectId).HasColumnName("project_id");
            e.Property(pm => pm.UserId).HasColumnName("user_id");
            e.Property(pm => pm.CreatedAt).HasColumnName("created_at");
            e.Property(pm => pm.CreatedBy).HasColumnName("created_by");
            e.HasOne(pm => pm.Project).WithMany(p => p.ProjectMembers).HasForeignKey(pm => pm.ProjectId);
            e.HasOne(pm => pm.User).WithMany(u => u.ProjectMembers).HasForeignKey(pm => pm.UserId);
        });

        modelBuilder.Entity<Sku>(e =>
        {
            e.ToTable("skus");
            e.HasKey(s => s.Id);
            e.Property(s => s.SkuCode).HasColumnName("sku_code");
            e.Property(s => s.UnitOfMeasure).HasColumnName("unit_of_measure");
            e.Property(s => s.DefaultMinThreshold).HasColumnName("default_min_threshold");
            e.Property(s => s.IsActive).HasColumnName("is_active");
            e.Property(s => s.CreatedAt).HasColumnName("created_at");
            e.Property(s => s.UpdatedAt).HasColumnName("updated_at");
            e.Property(s => s.CreatedBy).HasColumnName("created_by");
        });

        modelBuilder.Entity<ProjectInventory>(e =>
        {
            e.ToTable("project_inventory");
            e.HasKey(pi => pi.Id);
            e.Property(pi => pi.ProjectId).HasColumnName("project_id");
            e.Property(pi => pi.SkuId).HasColumnName("sku_id");
            e.Property(pi => pi.OnHand).HasColumnName("on_hand");
            e.Property(pi => pi.MinThreshold).HasColumnName("min_threshold");
            e.Property(pi => pi.LocationInSite).HasColumnName("location_in_site");
            e.Property(pi => pi.CreatedAt).HasColumnName("created_at");
            e.Property(pi => pi.UpdatedAt).HasColumnName("updated_at");
            e.HasOne(pi => pi.Project).WithMany(p => p.ProjectInventory).HasForeignKey(pi => pi.ProjectId);
            e.HasOne(pi => pi.Sku).WithMany(s => s.ProjectInventory).HasForeignKey(pi => pi.SkuId);
        });

        modelBuilder.Entity<InventoryTransaction>(e =>
        {
            e.ToTable("inventory_transactions");
            e.HasKey(it => it.Id);
            e.Property(it => it.ProjectId).HasColumnName("project_id");
            e.Property(it => it.SkuId).HasColumnName("sku_id");
            e.Property(it => it.TransactionType).HasColumnName("transaction_type");
            e.Property(it => it.QuantityBefore).HasColumnName("quantity_before");
            e.Property(it => it.QuantityAfter).HasColumnName("quantity_after");
            e.Property(it => it.ReferenceType).HasColumnName("reference_type");
            e.Property(it => it.ReferenceId).HasColumnName("reference_id");
            e.Property(it => it.TransferProjectId).HasColumnName("transfer_project_id");
            e.Property(it => it.CreatedAt).HasColumnName("created_at");
            e.Property(it => it.CreatedBy).HasColumnName("created_by");
        });

        modelBuilder.Entity<Order>(e =>
        {
            e.ToTable("orders");
            e.HasKey(o => o.Id);
            e.Property(o => o.ProjectId).HasColumnName("project_id");
            e.Property(o => o.OrderNumber).HasColumnName("order_number");
            e.Property(o => o.OrderType).HasColumnName("order_type");
            e.Property(o => o.SupplierName).HasColumnName("supplier_name");
            e.Property(o => o.SupplierContact).HasColumnName("supplier_contact");
            e.Property(o => o.ExpectedDeliveryDate).HasColumnName("expected_delivery_date");
            e.Property(o => o.TotalAmount).HasColumnName("total_amount");
            e.Property(o => o.ApprovedBy).HasColumnName("approved_by");
            e.Property(o => o.ApprovedAt).HasColumnName("approved_at");
            e.Property(o => o.RejectedBy).HasColumnName("rejected_by");
            e.Property(o => o.RejectedAt).HasColumnName("rejected_at");
            e.Property(o => o.RejectionReason).HasColumnName("rejection_reason");
            e.Property(o => o.CreatedAt).HasColumnName("created_at");
            e.Property(o => o.UpdatedAt).HasColumnName("updated_at");
            e.Property(o => o.CreatedBy).HasColumnName("created_by");
            e.HasOne(o => o.Project).WithMany(p => p.Orders).HasForeignKey(o => o.ProjectId);
        });

        modelBuilder.Entity<OrderItem>(e =>
        {
            e.ToTable("order_items");
            e.HasKey(oi => oi.Id);
            e.Property(oi => oi.OrderId).HasColumnName("order_id");
            e.Property(oi => oi.SkuId).HasColumnName("sku_id");
            e.Property(oi => oi.QuantityOrdered).HasColumnName("quantity_ordered");
            e.Property(oi => oi.QuantityReceived).HasColumnName("quantity_received");
            e.Property(oi => oi.UnitPrice).HasColumnName("unit_price");
            e.Property(oi => oi.QuotationItemId).HasColumnName("quotation_item_id");
            e.Property(oi => oi.CreatedAt).HasColumnName("created_at");
            e.HasOne(oi => oi.Order).WithMany(o => o.Items).HasForeignKey(oi => oi.OrderId);
            e.HasOne(oi => oi.Sku).WithMany(s => s.OrderItems).HasForeignKey(oi => oi.SkuId);
        });

        modelBuilder.Entity<Delivery>(e =>
        {
            e.ToTable("deliveries");
            e.HasKey(d => d.Id);
            e.Property(d => d.OrderId).HasColumnName("order_id");
            e.Property(d => d.DeliveryNumber).HasColumnName("delivery_number");
            e.Property(d => d.DeliveryDate).HasColumnName("delivery_date");
            e.Property(d => d.ReceivedDate).HasColumnName("received_date");
            e.Property(d => d.TrackingNumber).HasColumnName("tracking_number");
            e.Property(d => d.ReceivedBy).HasColumnName("received_by");
            e.Property(d => d.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<DeliveryItem>(e =>
        {
            e.ToTable("delivery_items");
            e.HasKey(di => di.Id);
            e.Property(di => di.DeliveryId).HasColumnName("delivery_id");
            e.Property(di => di.OrderItemId).HasColumnName("order_item_id");
            e.Property(di => di.QuantityReceived).HasColumnName("quantity_received");
            e.Property(di => di.CreatedAt).HasColumnName("created_at");

            e.HasOne(di => di.Delivery)
       .WithMany(d => d.Items)
       .HasForeignKey(di => di.DeliveryId)
       .OnDelete(DeleteBehavior.Cascade); // keep this

                  e.HasOne(di => di.OrderItem)
                .WithMany()
                .HasForeignKey(di => di.OrderItemId)
                .OnDelete(DeleteBehavior.NoAction); //.OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Notification>(e =>
        {
            e.ToTable("notifications");
            e.HasKey(n => n.Id);
            e.Property(n => n.UserId).HasColumnName("user_id");
            e.Property(n => n.ReferenceType).HasColumnName("reference_type");
            e.Property(n => n.ReferenceId).HasColumnName("reference_id");
            e.Property(n => n.IsRead).HasColumnName("is_read");
            e.Property(n => n.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<AuditLog>(e =>
        {
            e.ToTable("audit_logs");
            e.HasKey(a => a.Id);
            e.Property(a => a.TableName).HasColumnName("table_name");
            e.Property(a => a.RecordId).HasColumnName("record_id");
            e.Property(a => a.OldValues).HasColumnName("old_values");
            e.Property(a => a.NewValues).HasColumnName("new_values");
            e.Property(a => a.UserId).HasColumnName("user_id");
            e.Property(a => a.IpAddress).HasColumnName("ip_address");
            e.Property(a => a.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<ProjectQuotation>(e =>
        {
            e.ToTable("project_quotations");
            e.HasKey(pq => pq.Id);
            e.Property(pq => pq.ProjectId).HasColumnName("project_id");
            e.Property(pq => pq.CreatedBy).HasColumnName("created_by");
            e.Property(pq => pq.CreatedAt).HasColumnName("created_at");
            e.Property(pq => pq.UpdatedAt).HasColumnName("updated_at");
            e.HasOne(pq => pq.Project).WithOne(p => p.Quotation).HasForeignKey<ProjectQuotation>(pq => pq.ProjectId);
        });

        modelBuilder.Entity<QuotationItem>(e =>
        {
            e.ToTable("quotation_items");
            e.HasKey(qi => qi.Id);
            e.Property(qi => qi.QuotationId).HasColumnName("quotation_id");
            e.Property(qi => qi.MaterialName).HasColumnName("material_name");
            e.Property(qi => qi.CreatedAt).HasColumnName("created_at");
            e.Property(qi => qi.UpdatedAt).HasColumnName("updated_at");
            e.HasOne(qi => qi.Quotation).WithMany(q => q.Items).HasForeignKey(qi => qi.QuotationId);
        });
    }
}
