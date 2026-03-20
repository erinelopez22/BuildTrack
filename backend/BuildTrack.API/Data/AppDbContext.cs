using BuildTrack.API.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace BuildTrack.API.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();
    public DbSet<SKU> SKUs => Set<SKU>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Delivery> Deliveries => Set<Delivery>();
    public DbSet<DeliveryItem> DeliveryItems => Set<DeliveryItem>();
    public DbSet<ProjectInventory> ProjectInventory => Set<ProjectInventory>();
    public DbSet<InventoryTransaction> InventoryTransactions => Set<InventoryTransaction>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<NotificationSettings> NotificationSettings => Set<NotificationSettings>();
    public DbSet<CompanyAsset> CompanyAssets => Set<CompanyAsset>();
    public DbSet<BorrowTransaction> BorrowTransactions => Set<BorrowTransaction>();
    public DbSet<ProjectQuotation> ProjectQuotations => Set<ProjectQuotation>();
    public DbSet<QuotationItem> QuotationItems => Set<QuotationItem>();
    public DbSet<QuotationChangeRequest> QuotationChangeRequests => Set<QuotationChangeRequest>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<OrderTrackingAssignment> OrderTrackingAssignments => Set<OrderTrackingAssignment>();
    public DbSet<OrderTrackingMaterial> OrderTrackingMaterials => Set<OrderTrackingMaterial>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── Profile ──────────────────────────────────────────────────────────
        modelBuilder.Entity<Profile>(e =>
        {
            e.HasIndex(p => p.Email).IsUnique();
            e.HasIndex(p => p.Username).IsUnique().HasFilter("[Username] IS NOT NULL");
        });

        // ── UserRole ─────────────────────────────────────────────────────────
        modelBuilder.Entity<UserRole>(e =>
        {
            e.HasIndex(ur => new { ur.UserId, ur.Role }).IsUnique();
            e.HasOne(ur => ur.User)
             .WithMany(u => u.UserRoles)
             .HasForeignKey(ur => ur.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── RefreshToken ─────────────────────────────────────────────────────
        modelBuilder.Entity<RefreshToken>(e =>
        {
            e.HasOne(rt => rt.User)
             .WithMany(u => u.RefreshTokens)
             .HasForeignKey(rt => rt.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Project ───────────────────────────────────────────────────────────
        modelBuilder.Entity<Project>(e =>
        {
            e.HasIndex(p => p.Code).IsUnique().HasFilter("[Code] IS NOT NULL");
            e.HasOne(p => p.ProjectManager)
             .WithMany()
             .HasForeignKey(p => p.ProjectManagerId)
             .OnDelete(DeleteBehavior.ClientSetNull);
        });

        // ── ProjectMember ─────────────────────────────────────────────────────
        modelBuilder.Entity<ProjectMember>(e =>
        {
            e.HasIndex(pm => new { pm.ProjectId, pm.UserId }).IsUnique();
            e.HasOne(pm => pm.Project)
             .WithMany(p => p.Members)
             .HasForeignKey(pm => pm.ProjectId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(pm => pm.User)
             .WithMany()
             .HasForeignKey(pm => pm.UserId)
             .OnDelete(DeleteBehavior.ClientSetNull); // avoid multi-cascade-path with Project
        });

        // ── SKU ───────────────────────────────────────────────────────────────
        modelBuilder.Entity<SKU>(e =>
        {
            e.HasIndex(s => s.SkuCode).IsUnique();
        });

        // ── Order ─────────────────────────────────────────────────────────────
        modelBuilder.Entity<Order>(e =>
        {
            e.HasIndex(o => o.OrderNumber).IsUnique();
            e.HasOne(o => o.Project)
             .WithMany(p => p.Orders)
             .HasForeignKey(o => o.ProjectId)
             .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(o => o.Approver)
             .WithMany()
             .HasForeignKey(o => o.ApprovedBy)
             .OnDelete(DeleteBehavior.ClientSetNull);
            e.HasOne(o => o.Rejector)
             .WithMany()
             .HasForeignKey(o => o.RejectedBy)
             .OnDelete(DeleteBehavior.ClientSetNull);
            e.HasOne(o => o.Creator)
             .WithMany()
             .HasForeignKey(o => o.CreatedBy)
             .OnDelete(DeleteBehavior.ClientSetNull);
        });

        // ── OrderItem ─────────────────────────────────────────────────────────
        modelBuilder.Entity<OrderItem>(e =>
        {
            e.HasOne(oi => oi.Order)
             .WithMany(o => o.Items)
             .HasForeignKey(oi => oi.OrderId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(oi => oi.Sku)
             .WithMany(s => s.OrderItems)
             .HasForeignKey(oi => oi.SkuId)
             .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(oi => oi.QuotationItem)
             .WithMany(qi => qi.OrderItems)
             .HasForeignKey(oi => oi.QuotationItemId)
             .OnDelete(DeleteBehavior.ClientSetNull);
        });

        // ── Delivery ──────────────────────────────────────────────────────────
        modelBuilder.Entity<Delivery>(e =>
        {
            e.HasOne(d => d.Order)
             .WithMany(o => o.Deliveries)
             .HasForeignKey(d => d.OrderId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(d => d.Receiver)
             .WithMany()
             .HasForeignKey(d => d.ReceivedBy)
             .OnDelete(DeleteBehavior.ClientSetNull);
        });

        // ── DeliveryItem ──────────────────────────────────────────────────────
        modelBuilder.Entity<DeliveryItem>(e =>
        {
            e.HasOne(di => di.Delivery)
             .WithMany(d => d.Items)
             .HasForeignKey(di => di.DeliveryId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(di => di.OrderItem)
             .WithMany()
             .HasForeignKey(di => di.OrderItemId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── ProjectInventory ──────────────────────────────────────────────────
        modelBuilder.Entity<ProjectInventory>(e =>
        {
            e.HasIndex(pi => new { pi.ProjectId, pi.SkuId }).IsUnique();
            e.HasOne(pi => pi.Project)
             .WithMany(p => p.Inventory)
             .HasForeignKey(pi => pi.ProjectId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(pi => pi.Sku)
             .WithMany(s => s.ProjectInventories)
             .HasForeignKey(pi => pi.SkuId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── InventoryTransaction ──────────────────────────────────────────────
        modelBuilder.Entity<InventoryTransaction>(e =>
        {
            e.HasOne(it => it.Project)
             .WithMany()
             .HasForeignKey(it => it.ProjectId)
             .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(it => it.Sku)
             .WithMany(s => s.InventoryTransactions)
             .HasForeignKey(it => it.SkuId)
             .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(it => it.Creator)
             .WithMany()
             .HasForeignKey(it => it.CreatedBy)
             .OnDelete(DeleteBehavior.ClientSetNull);
        });

        // ── Notification ──────────────────────────────────────────────────────
        modelBuilder.Entity<Notification>(e =>
        {
            e.HasOne(n => n.User)
             .WithMany(u => u.Notifications)
             .HasForeignKey(n => n.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── NotificationSettings ──────────────────────────────────────────────
        modelBuilder.Entity<NotificationSettings>(e =>
        {
            e.HasIndex(ns => ns.UserId).IsUnique();
            e.HasOne(ns => ns.User)
             .WithMany()
             .HasForeignKey(ns => ns.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── BorrowTransaction ─────────────────────────────────────────────────
        modelBuilder.Entity<BorrowTransaction>(e =>
        {
            e.HasOne(bt => bt.Asset)
             .WithMany(a => a.BorrowTransactions)
             .HasForeignKey(bt => bt.AssetId)
             .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(bt => bt.Project)
             .WithMany()
             .HasForeignKey(bt => bt.ProjectId)
             .OnDelete(DeleteBehavior.ClientSetNull);
            e.HasOne(bt => bt.Borrower)
             .WithMany()
             .HasForeignKey(bt => bt.BorrowedBy)
             .OnDelete(DeleteBehavior.ClientSetNull);
        });

        // ── ProjectQuotation ──────────────────────────────────────────────────
        modelBuilder.Entity<ProjectQuotation>(e =>
        {
            e.HasOne(pq => pq.Project)
             .WithMany(p => p.Quotations)
             .HasForeignKey(pq => pq.ProjectId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(pq => pq.Creator)
             .WithMany()
             .HasForeignKey(pq => pq.CreatedBy)
             .OnDelete(DeleteBehavior.ClientSetNull);
        });

        // ── QuotationItem ─────────────────────────────────────────────────────
        modelBuilder.Entity<QuotationItem>(e =>
        {
            e.HasOne(qi => qi.Quotation)
             .WithMany(pq => pq.Items)
             .HasForeignKey(qi => qi.QuotationId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── QuotationChangeRequest ────────────────────────────────────────────
        modelBuilder.Entity<QuotationChangeRequest>(e =>
        {
            e.HasOne(qcr => qcr.Project)
             .WithMany()
             .HasForeignKey(qcr => qcr.ProjectId)
             .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(qcr => qcr.Quotation)
             .WithMany(pq => pq.ChangeRequests)
             .HasForeignKey(qcr => qcr.QuotationId)
             .OnDelete(DeleteBehavior.ClientSetNull);
            e.HasOne(qcr => qcr.Requester)
             .WithMany()
             .HasForeignKey(qcr => qcr.RequestedBy)
             .OnDelete(DeleteBehavior.ClientSetNull);
            e.HasOne(qcr => qcr.Reviewer)
             .WithMany()
             .HasForeignKey(qcr => qcr.ReviewedBy)
             .OnDelete(DeleteBehavior.ClientSetNull);
        });

        // ── AuditLog ──────────────────────────────────────────────────────────
        modelBuilder.Entity<AuditLog>(e =>
        {
            e.HasOne(al => al.User)
             .WithMany(u => u.AuditLogs)
             .HasForeignKey(al => al.UserId)
             .OnDelete(DeleteBehavior.ClientSetNull);
        });

        // ── OrderTrackingAssignment ───────────────────────────────────────────────
        modelBuilder.Entity<OrderTrackingAssignment>(e =>
        {
            e.HasOne(a => a.Order)
             .WithMany()
             .HasForeignKey(a => a.OrderId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(a => a.Driver)
             .WithMany()
             .HasForeignKey(a => a.DriverUserId)
             .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(a => a.Creator)
             .WithMany()
             .HasForeignKey(a => a.CreatedBy)
             .OnDelete(DeleteBehavior.ClientSetNull);
        });

        // ── OrderTrackingMaterial ─────────────────────────────────────────────────
        modelBuilder.Entity<OrderTrackingMaterial>(e =>
        {
            e.HasOne(m => m.Assignment)
             .WithMany(a => a.Materials)
             .HasForeignKey(m => m.AssignmentId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(m => m.OrderItem)
             .WithMany()
             .HasForeignKey(m => m.OrderItemId)
             .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
