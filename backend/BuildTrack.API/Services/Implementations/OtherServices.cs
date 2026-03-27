using System.Text.Json;
using System.Text.Json.Serialization;
using BuildTrack.API.Data;
using BuildTrack.API.DTOs.Assets;
using BuildTrack.API.DTOs.Inventory;
using BuildTrack.API.DTOs.Notifications;
using BuildTrack.API.DTOs.Quotations;
using BuildTrack.API.Hubs;
using BuildTrack.API.Models.Entities;
using BuildTrack.API.Services.Interfaces;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BuildTrack.API.Services.Implementations;

// ── Inventory Service ─────────────────────────────────────────────────────────
public class InventoryService(AppDbContext db) : IInventoryService
{
    public async Task<List<ProjectInventoryDto>> GetAllAsync(Guid? projectId)
    {
        var query = db.ProjectInventory
            .Include(pi => pi.Sku)
            .Include(pi => pi.Project)
            .AsQueryable();

        if (projectId.HasValue)
            query = query.Where(pi => pi.ProjectId == projectId.Value);

        var items = await query.OrderBy(pi => pi.Sku.Name).ToListAsync();
        return items.Select(pi => new ProjectInventoryDto
        {
            Id = pi.Id,
            ProjectId = pi.ProjectId,
            ProjectName = pi.Project?.Name,
            SkuId = pi.SkuId,
            SkuCode = pi.Sku?.SkuCode,
            SkuName = pi.Sku?.Name,
            Unit = pi.Sku?.UnitOfMeasure,
            OnHand = pi.OnHand,
            Reserved = pi.Reserved,
            MinThreshold = pi.MinThreshold,
            LocationInSite = pi.LocationInSite,
            UpdatedAt = pi.UpdatedAt
        }).ToList();
    }

    public async Task<List<InventoryTransactionDto>> GetTransactionsAsync(Guid? projectId, Guid? skuId, int limit)
    {
        var query = db.InventoryTransactions
            .Include(it => it.Sku)
            .Include(it => it.Project)
            .Include(it => it.Creator)
            .AsQueryable();

        if (projectId.HasValue) query = query.Where(it => it.ProjectId == projectId.Value);
        if (skuId.HasValue) query = query.Where(it => it.SkuId == skuId.Value);

        var txns = await query.OrderByDescending(it => it.CreatedAt).Take(limit).ToListAsync();
        return txns.Select(it => new InventoryTransactionDto
        {
            Id = it.Id,
            ProjectId = it.ProjectId,
            ProjectName = it.Project?.Name,
            SkuId = it.SkuId,
            SkuName = it.Sku?.Name,
            SkuCode = it.Sku?.SkuCode,
            TransactionType = it.TransactionType,
            Quantity = it.Quantity,
            QuantityBefore = it.QuantityBefore,
            QuantityAfter = it.QuantityAfter,
            ReferenceType = it.ReferenceType,
            ReferenceId = it.ReferenceId,
            Notes = it.Notes,
            CreatedBy = it.CreatedBy,
            CreatedByName = it.Creator?.FullName,
            CreatedAt = it.CreatedAt
        }).ToList();
    }

    public async Task<(InventoryTransactionDto? txn, string? error)> CreateTransactionAsync(
        CreateInventoryTransactionRequest request, Guid userId)
    {
        var inventory = await db.ProjectInventory
            .FirstOrDefaultAsync(pi => pi.ProjectId == request.ProjectId && pi.SkuId == request.SkuId);

        if (inventory == null)
        {
            inventory = new ProjectInventory
            {
                ProjectId = request.ProjectId,
                SkuId = request.SkuId,
                OnHand = 0
            };
            db.ProjectInventory.Add(inventory);
        }

        var before = inventory.OnHand;
        var after = request.TransactionType switch
        {
            "stock_in" or "receiving" or "transfer_in" => before + request.Quantity,
            "stock_out" or "transfer_out" => before - request.Quantity,
            "adjustment" => request.Quantity,
            _ => before + request.Quantity
        };

        if (after < 0) return (null, "Insufficient inventory.");

        inventory.OnHand = after;
        inventory.UpdatedAt = DateTime.UtcNow;

        var txn = new InventoryTransaction
        {
            ProjectId = request.ProjectId,
            SkuId = request.SkuId,
            TransactionType = request.TransactionType,
            Quantity = request.Quantity,
            QuantityBefore = before,
            QuantityAfter = after,
            ReferenceType = request.ReferenceType,
            ReferenceId = request.ReferenceId,
            Notes = request.Notes,
            CreatedBy = userId
        };
        db.InventoryTransactions.Add(txn);
        await db.SaveChangesAsync();

        await db.Entry(txn).Reference(t => t.Sku).LoadAsync();
        await db.Entry(txn).Reference(t => t.Project).LoadAsync();

        return (new InventoryTransactionDto
        {
            Id = txn.Id,
            ProjectId = txn.ProjectId,
            SkuId = txn.SkuId,
            SkuName = txn.Sku?.Name,
            SkuCode = txn.Sku?.SkuCode,
            TransactionType = txn.TransactionType,
            Quantity = txn.Quantity,
            QuantityBefore = txn.QuantityBefore,
            QuantityAfter = txn.QuantityAfter,
            Notes = txn.Notes,
            CreatedBy = txn.CreatedBy,
            CreatedAt = txn.CreatedAt
        }, null);
    }
}

// ── Company Asset Service ─────────────────────────────────────────────────────
public class CompanyAssetService(AppDbContext db) : ICompanyAssetService
{
    public async Task<List<CompanyAssetDto>> GetAllAsync(string? search, string? assetType,
        Guid? companyId = null, bool isSuperAdmin = false)
    {
        var query = db.CompanyAssets.Include(a => a.BorrowTransactions).AsQueryable();

        if (!isSuperAdmin && companyId.HasValue)
            query = query.Where(a => a.CompanyId == companyId.Value);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(a => a.AssetName.Contains(search) ||
                (a.AssetCode != null && a.AssetCode.Contains(search)));

        if (!string.IsNullOrWhiteSpace(assetType))
            query = query.Where(a => a.AssetType == assetType);

        var assets = await query.ToListAsync();
        return assets.Select(MapAsset).ToList();
    }

    public async Task<CompanyAssetDto?> GetByIdAsync(Guid id)
    {
        var asset = await db.CompanyAssets
            .Include(a => a.BorrowTransactions)
            .FirstOrDefaultAsync(a => a.Id == id);
        return asset == null ? null : MapAsset(asset);
    }

    public async Task<CompanyAssetDto> CreateAsync(CreateCompanyAssetRequest request, Guid createdBy, Guid? companyId = null)
    {
        var asset = new CompanyAsset
        {
            AssetName = request.AssetName,
            AssetType = request.AssetType,
            AssetCode = request.AssetCode,
            Unit = request.Unit,
            TotalQuantity = request.TotalQuantity,
            Condition = request.Condition ?? "Available",
            Notes = request.Notes,
            CreatedBy = createdBy,
            CompanyId = companyId
        };
        db.CompanyAssets.Add(asset);
        await db.SaveChangesAsync();
        return MapAsset(asset);
    }

    public async Task<CompanyAssetDto?> UpdateAsync(Guid id, UpdateCompanyAssetRequest request)
    {
        var asset = await db.CompanyAssets
            .Include(a => a.BorrowTransactions)
            .FirstOrDefaultAsync(a => a.Id == id);
        if (asset == null) return null;

        if (request.AssetName != null) asset.AssetName = request.AssetName;
        if (request.AssetType != null) asset.AssetType = request.AssetType;
        if (request.AssetCode != null) asset.AssetCode = request.AssetCode;
        if (request.Unit != null) asset.Unit = request.Unit;
        if (request.TotalQuantity.HasValue) asset.TotalQuantity = request.TotalQuantity.Value;
        if (request.Condition != null) asset.Condition = request.Condition;
        if (request.Notes != null) asset.Notes = request.Notes;
        asset.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return MapAsset(asset);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var asset = await db.CompanyAssets.FindAsync(id);
        if (asset == null) return false;
        db.CompanyAssets.Remove(asset);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<List<BorrowTransactionDto>> GetBorrowsAsync(Guid assetId)
    {
        var txns = await db.BorrowTransactions
            .Include(bt => bt.Asset)
            .Include(bt => bt.Project)
            .Include(bt => bt.Borrower)
            .Where(bt => bt.AssetId == assetId)
            .OrderByDescending(bt => bt.BorrowedAt)
            .ToListAsync();
        return txns.Select(MapBorrow).ToList();
    }

    public async Task<List<BorrowTransactionDto>> GetAllBorrowsAsync(Guid? projectId)
    {
        var query = db.BorrowTransactions
            .Include(bt => bt.Asset)
            .Include(bt => bt.Project)
            .Include(bt => bt.Borrower)
            .AsQueryable();

        if (projectId.HasValue)
            query = query.Where(bt => bt.ProjectId == projectId.Value);

        var txns = await query.OrderByDescending(bt => bt.BorrowedAt).ToListAsync();
        return txns.Select(MapBorrow).ToList();
    }

    public async Task<(BorrowTransactionDto? txn, string? error)> BorrowAsync(
        BorrowAssetRequest request, Guid userId)
    {
        var asset = await db.CompanyAssets
            .Include(a => a.BorrowTransactions)
            .FirstOrDefaultAsync(a => a.Id == request.AssetId);

        if (asset == null) return (null, "Asset not found.");

        var borrowed = asset.BorrowTransactions
            .Where(bt => bt.Status != "Returned")
            .Sum(bt => bt.BorrowedQty - bt.ReturnedQty);

        var available = asset.TotalQuantity - borrowed;
        if (request.Quantity > available)
            return (null, $"Only {available} units available.");

        var txn = new BorrowTransaction
        {
            AssetId = request.AssetId,
            ProjectId = request.ProjectId,
            BorrowedQty = request.Quantity,
            BorrowedBy = userId,
            BorrowedAt = DateTime.UtcNow,
            ExpectedReturnDate = request.ExpectedReturnDate,
            Status = "Borrowed"
        };
        db.BorrowTransactions.Add(txn);
        await db.SaveChangesAsync();

        await db.Entry(txn).Reference(t => t.Asset).LoadAsync();
        await db.Entry(txn).Reference(t => t.Borrower).LoadAsync();

        return (MapBorrow(txn), null);
    }

    public async Task<(BorrowTransactionDto? txn, string? error)> ReturnAsync(
        Guid txnId, ReturnAssetRequest request, Guid userId)
    {
        var txn = await db.BorrowTransactions
            .Include(bt => bt.Asset)
            .Include(bt => bt.Borrower)
            .FirstOrDefaultAsync(bt => bt.Id == txnId);

        if (txn == null) return (null, "Borrow transaction not found.");

        txn.ReturnedQty += request.ReturnedQty;
        txn.ReturnRemarks = request.Remarks;
        txn.ReturnedAt = DateTime.UtcNow;
        txn.Status = txn.ReturnedQty >= txn.BorrowedQty ? "Returned" : "Partially Returned";
        txn.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return (MapBorrow(txn), null);
    }

    private static CompanyAssetDto MapAsset(CompanyAsset a)
    {
        var borrowed = a.BorrowTransactions
            .Where(bt => bt.Status != "Returned")
            .Sum(bt => bt.BorrowedQty - bt.ReturnedQty);
        return new CompanyAssetDto
        {
            Id = a.Id,
            AssetName = a.AssetName,
            AssetType = a.AssetType,
            AssetCode = a.AssetCode,
            Unit = a.Unit,
            TotalQuantity = a.TotalQuantity,
            Condition = a.Condition,
            Notes = a.Notes,
            CreatedBy = a.CreatedBy,
            CreatedAt = a.CreatedAt,
            BorrowedQuantity = borrowed,
            AvailableQuantity = a.TotalQuantity - borrowed
        };
    }

    private static BorrowTransactionDto MapBorrow(BorrowTransaction bt) => new()
    {
        Id = bt.Id,
        AssetId = bt.AssetId,
        AssetName = bt.Asset?.AssetName,
        ProjectId = bt.ProjectId,
        ProjectName = bt.Project?.Name,
        BorrowedQty = bt.BorrowedQty,
        BorrowedBy = bt.BorrowedBy,
        BorrowedByName = bt.Borrower?.FullName,
        BorrowedAt = bt.BorrowedAt,
        ExpectedReturnDate = bt.ExpectedReturnDate,
        ReturnedQty = bt.ReturnedQty,
        ReturnedAt = bt.ReturnedAt,
        ReturnRemarks = bt.ReturnRemarks,
        Status = bt.Status,
        CreatedAt = bt.CreatedAt
    };
}

// ── Quotation Service ─────────────────────────────────────────────────────────
public class QuotationService(AppDbContext db) : IQuotationService
{
    public async Task<List<ProjectQuotationDto>> GetAllAsync(Guid? projectId)
    {
        var query = db.ProjectQuotations
            .Include(q => q.Items)
            .Include(q => q.Creator)
            .Include(q => q.Project)
            .AsQueryable();

        if (projectId.HasValue)
            query = query.Where(q => q.ProjectId == projectId.Value);

        var quotations = await query.OrderByDescending(q => q.CreatedAt).ToListAsync();
        return quotations.Select(MapQuotation).ToList();
    }

    public async Task<ProjectQuotationDto?> GetByIdAsync(Guid id)
    {
        var q = await db.ProjectQuotations
            .Include(q => q.Items)
            .Include(q => q.Creator)
            .Include(q => q.Project)
            .FirstOrDefaultAsync(q => q.Id == id);
        return q == null ? null : MapQuotation(q);
    }

    public async Task<ProjectQuotationDto> CreateAsync(CreateQuotationRequest request, Guid createdBy)
    {
        var quotation = new ProjectQuotation
        {
            ProjectId = request.ProjectId,
            CreatedBy = createdBy,
            Notes = request.Notes,
            Category = request.Category ?? "initial"
        };
        db.ProjectQuotations.Add(quotation);

        var items = request.Items.Select(i => new QuotationItem
        {
            QuotationId = quotation.Id,
            MaterialName = i.MaterialName,
            Unit = i.Unit,
            Quantity = i.Quantity
        }).ToList();
        db.QuotationItems.AddRange(items);

        await db.SaveChangesAsync();
        return await GetByIdAsync(quotation.Id) ?? MapQuotation(quotation);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var q = await db.ProjectQuotations.FindAsync(id);
        if (q == null) return false;
        db.ProjectQuotations.Remove(q);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<QuotationItemDto?> UpdateItemAsync(Guid quotationId, Guid itemId, UpdateQuotationItemRequest request)
    {
        var item = await db.QuotationItems
            .FirstOrDefaultAsync(qi => qi.Id == itemId && qi.QuotationId == quotationId);
        if (item == null) return null;

        if (request.MaterialName != null) item.MaterialName = request.MaterialName;
        if (request.Unit != null) item.Unit = request.Unit;
        if (request.Quantity.HasValue) item.Quantity = request.Quantity.Value;
        item.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return new QuotationItemDto
        {
            Id = item.Id,
            QuotationId = item.QuotationId,
            MaterialName = item.MaterialName,
            Unit = item.Unit,
            Quantity = item.Quantity,
            CreatedAt = item.CreatedAt,
            UpdatedAt = item.UpdatedAt
        };
    }

    public async Task<List<QuotationChangeRequestDto>> GetChangeRequestsAsync(Guid? projectId, string? status)
    {
        var query = db.QuotationChangeRequests
            .Include(qcr => qcr.Requester)
            .Include(qcr => qcr.Reviewer)
            .Include(qcr => qcr.Project)
            .AsQueryable();

        if (projectId.HasValue) query = query.Where(qcr => qcr.ProjectId == projectId.Value);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(qcr => qcr.Status == status);

        var requests = await query.OrderByDescending(qcr => qcr.CreatedAt).ToListAsync();
        return requests.Select(MapChangeRequest).ToList();
    }

    public async Task<QuotationChangeRequestDto> CreateChangeRequestAsync(
        CreateChangeRequestRequest request, Guid userId)
    {
        var cr = new QuotationChangeRequest
        {
            ProjectId = request.ProjectId,
            QuotationId = request.QuotationId,
            ChangeType = request.ChangeType,
            Status = "pending",
            RequestedBy = userId,
            Payload = request.Payload
        };
        db.QuotationChangeRequests.Add(cr);
        await db.SaveChangesAsync();
        await db.Entry(cr).Reference(c => c.Requester).LoadAsync();
        return MapChangeRequest(cr);
    }

    public async Task<QuotationChangeRequestDto?> ReviewChangeRequestAsync(
        Guid id, ReviewChangeRequestRequest request, Guid reviewedBy)
    {
        var cr = await db.QuotationChangeRequests
            .Include(qcr => qcr.Requester)
            .Include(qcr => qcr.Reviewer)
            .Include(qcr => qcr.Project)
            .FirstOrDefaultAsync(qcr => qcr.Id == id);
        if (cr == null) return null;

        cr.Status = request.Status;
        cr.ReviewedBy = reviewedBy;
        cr.ReviewRemarks = request.ReviewRemarks;
        cr.UpdatedAt = DateTime.UtcNow;

        // Apply changes when approved
        if (request.Status == "approved" && !string.IsNullOrEmpty(cr.Payload))
        {
            var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var payload = JsonSerializer.Deserialize<ChangeRequestPayload>(cr.Payload, opts);

            if (cr.ChangeType == "create" && payload?.Items != null)
            {
                var quotation = new ProjectQuotation
                {
                    ProjectId = cr.ProjectId,
                    CreatedBy = cr.RequestedBy,
                    Notes = payload.Notes,
                    Category = payload.Category ?? "initial"
                };
                db.ProjectQuotations.Add(quotation);

                foreach (var item in payload.Items)
                {
                    db.QuotationItems.Add(new QuotationItem
                    {
                        QuotationId = quotation.Id,
                        MaterialName = item.MaterialName,
                        Unit = item.Unit,
                        Quantity = item.Quantity
                    });
                }

                cr.QuotationId = quotation.Id;
            }
            else if (cr.ChangeType == "update" && cr.QuotationId.HasValue && payload?.Items != null)
            {
                // Remove existing items and replace with updated ones
                var existingItems = await db.QuotationItems
                    .Where(qi => qi.QuotationId == cr.QuotationId.Value)
                    .ToListAsync();
                db.QuotationItems.RemoveRange(existingItems);

                foreach (var item in payload.Items)
                {
                    db.QuotationItems.Add(new QuotationItem
                    {
                        QuotationId = cr.QuotationId.Value,
                        MaterialName = item.MaterialName,
                        Unit = item.Unit,
                        Quantity = item.Quantity
                    });
                }

                var quotation = await db.ProjectQuotations.FindAsync(cr.QuotationId.Value);
                if (quotation != null)
                {
                    if (payload.Notes != null) quotation.Notes = payload.Notes;
                    if (payload.Category != null) quotation.Category = payload.Category;
                    quotation.UpdatedAt = DateTime.UtcNow;
                }
            }
            else if (cr.ChangeType == "delete")
            {
                var quotationId = cr.QuotationId ?? payload?.QuotationId;
                if (quotationId.HasValue)
                {
                    var quotation = await db.ProjectQuotations.FindAsync(quotationId.Value);
                    if (quotation != null)
                        db.ProjectQuotations.Remove(quotation);
                }
            }
        }

        await db.SaveChangesAsync();
        await db.Entry(cr).Reference(c => c.Reviewer).LoadAsync();
        return MapChangeRequest(cr);
    }

    // Payload model for deserializing change request JSON (snake_case keys from frontend)
    private class ChangeRequestPayload
    {
        [JsonPropertyName("items")]
        public List<ChangeRequestItem>? Items { get; set; }

        [JsonPropertyName("notes")]
        public string? Notes { get; set; }

        [JsonPropertyName("category")]
        public string? Category { get; set; }

        [JsonPropertyName("quotation_id")]
        public Guid? QuotationId { get; set; }
    }

    private class ChangeRequestItem
    {
        [JsonPropertyName("material_name")]
        public string MaterialName { get; set; } = string.Empty;

        [JsonPropertyName("unit")]
        public string? Unit { get; set; }

        [JsonPropertyName("quantity")]
        public decimal Quantity { get; set; }
    }

    private static ProjectQuotationDto MapQuotation(ProjectQuotation q) => new()
    {
        Id = q.Id,
        ProjectId = q.ProjectId,
        ProjectName = q.Project?.Name,
        CreatedBy = q.CreatedBy,
        CreatedByName = q.Creator?.FullName,
        Notes = q.Notes,
        Category = q.Category,
        CreatedAt = q.CreatedAt,
        UpdatedAt = q.UpdatedAt,
        Items = q.Items.Select(i => new QuotationItemDto
        {
            Id = i.Id,
            QuotationId = i.QuotationId,
            MaterialName = i.MaterialName,
            Unit = i.Unit,
            Quantity = i.Quantity,
            CreatedAt = i.CreatedAt,
            UpdatedAt = i.UpdatedAt
        }).ToList()
    };

    private static QuotationChangeRequestDto MapChangeRequest(QuotationChangeRequest cr) => new()
    {
        Id = cr.Id,
        ProjectId = cr.ProjectId,
        ProjectName = cr.Project?.Name,
        QuotationId = cr.QuotationId,
        ChangeType = cr.ChangeType,
        Status = cr.Status,
        RequestedBy = cr.RequestedBy,
        RequestedByName = cr.Requester?.FullName,
        ReviewedBy = cr.ReviewedBy,
        ReviewedByName = cr.Reviewer?.FullName,
        ReviewedAt = cr.ReviewedBy != null ? cr.UpdatedAt : null,
        ReviewRemarks = cr.ReviewRemarks,
        Payload = cr.Payload,
        CreatedAt = cr.CreatedAt,
        UpdatedAt = cr.UpdatedAt
    };
}

// ── Notification Service ──────────────────────────────────────────────────────
public class NotificationService(
    AppDbContext db,
    IHubContext<NotificationHub> hubContext) : INotificationService
{
    public async Task<List<NotificationDto>> GetForUserAsync(Guid userId, bool unreadOnly)
    {
        var query = db.Notifications.Where(n => n.UserId == userId);
        if (unreadOnly) query = query.Where(n => !n.IsRead);

        var notifications = await query
            .OrderByDescending(n => n.CreatedAt)
            .Take(100)
            .ToListAsync();

        return notifications.Select(Map).ToList();
    }

    public async Task CreateAsync(CreateNotificationRequest request)
    {
        var notification = new Notification
        {
            UserId = request.UserId,
            Title = request.Title,
            Message = request.Message,
            Type = request.Type,
            ReferenceType = request.ReferenceType,
            ReferenceId = request.ReferenceId
        };
        db.Notifications.Add(notification);
        await db.SaveChangesAsync();

        // Push real-time via SignalR
        await hubContext.Clients.User(request.UserId.ToString())
            .SendAsync("NewNotification", Map(notification));
    }

    public async Task MarkReadAsync(Guid id, Guid userId)
    {
        var n = await db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
        if (n != null) { n.IsRead = true; await db.SaveChangesAsync(); }
    }

    public async Task MarkAllReadAsync(Guid userId)
    {
        await db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));
    }

    public async Task DeleteAsync(Guid id, Guid userId)
    {
        var n = await db.Notifications.FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);
        if (n != null) { db.Notifications.Remove(n); await db.SaveChangesAsync(); }
    }

    private static NotificationDto Map(Notification n) => new()
    {
        Id = n.Id,
        UserId = n.UserId,
        Title = n.Title,
        Message = n.Message,
        Type = n.Type,
        ReferenceType = n.ReferenceType,
        ReferenceId = n.ReferenceId,
        IsRead = n.IsRead,
        CreatedAt = n.CreatedAt
    };
}

// ── Dashboard Service ─────────────────────────────────────────────────────────
public class DashboardService(AppDbContext db) : IDashboardService
{
    public async Task<DashboardStatsDto> GetStatsAsync(Guid userId, Guid? companyId = null, bool isSuperAdmin = false)
    {
        var projectQuery = db.Projects.Where(p => p.Status == "active" && !p.IsHidden);
        if (!isSuperAdmin && companyId.HasValue)
            projectQuery = projectQuery.Where(p => p.CompanyId == companyId.Value);
        var activeProjects = await projectQuery.CountAsync();

        var orderQuery = db.Orders.AsQueryable();
        if (!isSuperAdmin && companyId.HasValue)
            orderQuery = orderQuery.Where(o => o.Project.CompanyId == companyId.Value);

        var pendingOrders = await orderQuery.CountAsync(o =>
            o.Status == "for_approval" || o.Status == "draft");

        var userQuery = db.Profiles.Where(p => p.IsActive);
        if (!isSuperAdmin && companyId.HasValue)
            userQuery = userQuery.Where(p => p.CompanyId == companyId.Value);
        var totalUsers = await userQuery.CountAsync();

        var ordersByStatus = await orderQuery
            .GroupBy(o => o.Status)
            .Select(g => new OrderStatusCountDto { Status = g.Key, Count = g.Count() })
            .ToListAsync();

        var recentOrderQuery = db.Orders.Include(o => o.Project).AsQueryable();
        if (!isSuperAdmin && companyId.HasValue)
            recentOrderQuery = recentOrderQuery.Where(o => o.Project.CompanyId == companyId.Value);

        var recentOrders = await recentOrderQuery
            .OrderByDescending(o => o.CreatedAt)
            .Take(10)
            .Select(o => new RecentOrderDto
            {
                Id = o.Id,
                OrderNumber = o.OrderNumber,
                Status = o.Status,
                ProjectName = o.Project != null ? o.Project.Name : null,
                SupplierName = o.SupplierName,
                CreatedAt = o.CreatedAt
            })
            .ToListAsync();

        var skuQuery = db.SKUs.AsQueryable();
        if (!isSuperAdmin && companyId.HasValue)
            skuQuery = skuQuery.Where(s => s.CompanyId == companyId.Value);
        var stockItems = await skuQuery.CountAsync();

        // Equipment & Tools (company assets)
        var assetQuery = db.CompanyAssets.AsQueryable();
        if (!isSuperAdmin && companyId.HasValue)
            assetQuery = assetQuery.Where(a => a.CompanyId == companyId.Value);
        var totalAssets = await assetQuery.CountAsync();

        // Pending quotation change requests (add/update/delete awaiting approval)
        var pendingQuotationRequests = await db.QuotationChangeRequests
            .CountAsync(cr => cr.Status == "pending");

        // Pending borrow & return requests (items currently borrowed or partially returned)
        var borrowReturnQuery = db.BorrowTransactions
            .Where(bt => bt.Status == "Borrowed" || bt.Status == "Partially Returned");
        var pendingBorrowReturnRequests = await borrowReturnQuery.CountAsync();

        return new DashboardStatsDto
        {
            ActiveProjects = activeProjects,
            PendingOrders = pendingOrders,
            StockItems = stockItems,
            TotalUsers = totalUsers,
            TotalAssets = totalAssets,
            PendingQuotationRequests = pendingQuotationRequests,
            PendingBorrowReturnRequests = pendingBorrowReturnRequests,
            OrdersByStatus = ordersByStatus,
            RecentOrders = recentOrders
        };
    }
}

// ── Audit Log Service ─────────────────────────────────────────────────────────
public class AuditLogService(AppDbContext db, IHttpContextAccessor httpContext) : IAuditLogService
{
    public async Task LogAsync(string tableName, Guid? recordId, string action,
        string? oldValues, string? newValues, Guid? userId)
    {
        var ip = httpContext.HttpContext?.Connection?.RemoteIpAddress?.ToString();
        db.AuditLogs.Add(new AuditLog
        {
            TableName = tableName,
            RecordId = recordId,
            Action = action,
            OldValues = oldValues,
            NewValues = newValues,
            UserId = userId,
            IpAddress = ip
        });
        await db.SaveChangesAsync();
    }

    public async Task<List<object>> GetLogsAsync(string? tableName, Guid? recordId, Guid? userId, int limit)
    {
        var query = db.AuditLogs
            .Include(al => al.User)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(tableName))
            query = query.Where(al => al.TableName == tableName);
        if (recordId.HasValue)
            query = query.Where(al => al.RecordId == recordId.Value);
        if (userId.HasValue)
            query = query.Where(al => al.UserId == userId.Value);

        return await query
            .OrderByDescending(al => al.CreatedAt)
            .Take(limit)
            .Select(al => (object)new
            {
                al.Id, al.TableName, al.RecordId, al.Action,
                al.OldValues, al.NewValues, al.UserId,
                UserName = al.User != null ? al.User.FullName : null,
                al.IpAddress, al.CreatedAt
            })
            .ToListAsync();
    }
}
