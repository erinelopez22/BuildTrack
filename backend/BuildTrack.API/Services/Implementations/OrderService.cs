using System.Text.RegularExpressions;
using BuildTrack.API.Data;
using BuildTrack.API.DTOs.Orders;
using BuildTrack.API.Models.Entities;
using BuildTrack.API.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BuildTrack.API.Services.Implementations;

public class OrderService(AppDbContext db) : IOrderService
{
    private static int _orderCounter = 0;

    public async Task<List<OrderDto>> GetAllAsync(
        string? status, Guid? projectId, string? search, Guid currentUserId,
        Guid? companyId = null, bool isSuperAdmin = false)
    {
        var query = db.Orders
            .Include(o => o.Project)
            .Include(o => o.Items).ThenInclude(oi => oi.Sku)
            .Include(o => o.Creator)
            .Include(o => o.Approver)
            .Include(o => o.Rejector)
            .AsQueryable();

        if (!isSuperAdmin && companyId.HasValue)
            query = query.Where(o => o.Project.CompanyId == companyId.Value);

        if (!string.IsNullOrWhiteSpace(status))
        {
            var statuses = status.Split(',', StringSplitOptions.RemoveEmptyEntries);
            query = query.Where(o => statuses.Contains(o.Status));
        }

        if (projectId.HasValue)
            query = query.Where(o => o.ProjectId == projectId.Value);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(o =>
                o.OrderNumber.Contains(search) ||
                (o.SupplierName != null && o.SupplierName.Contains(search)));

        var orders = await query.OrderByDescending(o => o.CreatedAt).ToListAsync();
        return orders.Select(Map).ToList();
    }

    public async Task<OrderDto?> GetByIdAsync(Guid id)
    {
        var order = await db.Orders
            .Include(o => o.Project)
            .Include(o => o.Items).ThenInclude(oi => oi.Sku)
            .Include(o => o.Creator)
            .Include(o => o.Approver)
            .Include(o => o.Rejector)
            .FirstOrDefaultAsync(o => o.Id == id);
        return order == null ? null : Map(order);
    }

    public async Task<(OrderDto? order, string? error)> CreateAsync(CreateOrderRequest request, Guid createdBy)
    {
        if (!request.Items.Any())
            return (null, "Order must have at least one item.");

        // Generate order number
        var count = await db.Orders.CountAsync() + 1;
        var orderNumber = $"ORD-{DateTime.UtcNow:yyyyMMdd}-{count:D4}";

        var order = new Order
        {
            ProjectId = request.ProjectId,
            OrderNumber = orderNumber,
            OrderType = request.OrderType,
            Status = "draft",
            SupplierName = request.SupplierName,
            SupplierContact = request.SupplierContact,
            ExpectedDeliveryDate = request.ExpectedDeliveryDate,
            Notes = request.Notes,
            CreatedBy = createdBy
        };

        // Resolve SKU IDs — auto-create SKUs from materialName when SkuId is not provided
        var resolvedItems = new List<OrderItem>();
        foreach (var i in request.Items)
        {
            Guid skuId;
            if (i.SkuId.HasValue && i.SkuId.Value != Guid.Empty)
            {
                skuId = i.SkuId.Value;
            }
            else if (!string.IsNullOrWhiteSpace(i.MaterialName))
            {
                var materialNameLower = i.MaterialName.Trim().ToLower();
                var sku = await db.SKUs.FirstOrDefaultAsync(s => s.Name.ToLower() == materialNameLower);
                if (sku == null)
                {
                    // Auto-create SKU for this material
                    var baseCode = i.MaterialName.Trim().ToUpper()
                        .Replace(" ", "-")
                        .Replace("/", "-")
                        .Replace("\\", "-");
                    baseCode = System.Text.RegularExpressions.Regex.Replace(baseCode, @"[^A-Z0-9\-]", "");
                    baseCode = baseCode.Length > 30 ? baseCode[..30] : baseCode;
                    if (string.IsNullOrEmpty(baseCode)) baseCode = "MAT";

                    // Ensure unique skuCode
                    var codeExists = await db.SKUs.AnyAsync(s => s.SkuCode == baseCode);
                    var finalCode = codeExists
                        ? $"{baseCode}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}"
                        : baseCode;

                    sku = new SKU
                    {
                        Name = i.MaterialName.Trim(),
                        SkuCode = finalCode,
                        UnitOfMeasure = i.Unit,
                        IsActive = true,
                        CreatedBy = createdBy
                    };
                    db.SKUs.Add(sku);
                    await db.SaveChangesAsync();
                }
                skuId = sku.Id;
            }
            else
            {
                return (null, "Each order item must have a SkuId or a MaterialName.");
            }

            resolvedItems.Add(new OrderItem
            {
                OrderId = order.Id,
                SkuId = skuId,
                QuotationItemId = i.QuotationItemId,
                QuantityOrdered = i.QuantityOrdered,
                UnitPrice = i.UnitPrice,
                Notes = i.Notes
            });
        }

        var items = resolvedItems;

        order.TotalAmount = items
            .Where(i => i.UnitPrice.HasValue)
            .Sum(i => i.QuantityOrdered * i.UnitPrice!.Value);

        db.Orders.Add(order);
        db.OrderItems.AddRange(items);
        await db.SaveChangesAsync();

        return (await GetByIdAsync(order.Id), null);
    }

    public async Task<OrderDto?> UpdateAsync(Guid id, UpdateOrderRequest request, Guid updatedBy)
    {
        var order = await db.Orders.FindAsync(id);
        if (order == null) return null;

        if (request.SupplierName != null) order.SupplierName = request.SupplierName;
        if (request.SupplierContact != null) order.SupplierContact = request.SupplierContact;
        if (request.ExpectedDeliveryDate.HasValue) order.ExpectedDeliveryDate = request.ExpectedDeliveryDate;
        if (request.Notes != null) order.Notes = request.Notes;
        if (request.Status != null) order.Status = request.Status;
        order.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(Guid id, Guid deletedBy)
    {
        var order = await db.Orders.FindAsync(id);
        if (order == null) return false;

        // Only draft orders can be hard-deleted; others get cancelled
        if (order.Status == "draft")
            db.Orders.Remove(order);
        else
        {
            order.Status = "cancelled";
            order.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        return true;
    }

    public async Task<OrderDto?> SubmitForApprovalAsync(Guid id, Guid userId)
        => await TransitionStatusAsync(id, "draft", "for_approval", userId);

    public async Task<OrderDto?> ApproveAsync(Guid id, string? notes, Guid approvedBy)
    {
        var order = await db.Orders.FindAsync(id);
        if (order == null) return null;

        var approverProfile = await db.Profiles.FindAsync(approvedBy);

        order.Status = "approved";
        order.ApprovedBy = approvedBy;
        order.ApprovedAt = DateTime.UtcNow;
        order.ApprovedByName = approverProfile?.FullName ?? approverProfile?.Email;
        if (notes != null) order.Notes = (order.Notes ?? "") + $"\n[Approved] {notes}";
        order.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    public async Task<OrderDto?> RejectAsync(Guid id, string reason, Guid rejectedBy)
    {
        var order = await db.Orders.FindAsync(id);
        if (order == null || (order.Status != "for_approval" && order.Status != "draft")) return null;

        order.Status = "rejected";
        order.RejectedBy = rejectedBy;
        order.RejectedAt = DateTime.UtcNow;
        order.RejectionReason = reason;
        order.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    public async Task<OrderDto?> UpdateStatusAsync(Guid id, string status, string? notes, Guid userId)
    {
        var order = await db.Orders.FindAsync(id);
        if (order == null) return null;

        order.Status = status;
        if (notes != null) order.Notes = (order.Notes ?? "") + $"\n{notes}";
        order.UpdatedAt = DateTime.UtcNow;

        if (status == "approved" && order.ApprovedBy == null)
        {
            order.ApprovedBy = userId;
            order.ApprovedAt = DateTime.UtcNow;
            var approver = await db.Profiles.FindAsync(userId);
            order.ApprovedByName = approver?.FullName ?? approver?.Email;
        }
        if (status == "in_transit" && order.OnTransitAt == null)
            order.OnTransitAt = DateTime.UtcNow;
        if (status == "delivered" && order.DeliveredAt == null)
            order.DeliveredAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private async Task<OrderDto?> TransitionStatusAsync(
        Guid id, string fromStatus, string toStatus, Guid userId)
    {
        var order = await db.Orders.FindAsync(id);
        if (order == null || order.Status != fromStatus) return null;

        order.Status = toStatus;
        order.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    private static OrderDto Map(Order o) => new()
    {
        Id = o.Id,
        ProjectId = o.ProjectId,
        ProjectName = o.Project?.Name,
        OrderNumber = o.OrderNumber,
        OrderType = o.OrderType,
        Status = o.Status,
        SupplierName = o.SupplierName,
        SupplierContact = o.SupplierContact,
        ExpectedDeliveryDate = o.ExpectedDeliveryDate,
        Notes = o.Notes,
        TotalAmount = o.TotalAmount,
        ApprovedBy = o.ApprovedBy,
        ApprovedByName = o.ApprovedByName ?? o.Approver?.FullName,
        ApprovedAt = o.ApprovedAt,
        RejectedBy = o.RejectedBy,
        RejectedByName = o.Rejector?.FullName,
        RejectedAt = o.RejectedAt,
        RejectionReason = o.RejectionReason,
        CreatedBy = o.CreatedBy,
        CreatedByName = o.Creator?.FullName,
        CreatedAt = o.CreatedAt,
        UpdatedAt = o.UpdatedAt,
        OnTransitAt = o.OnTransitAt,
        DeliveredAt = o.DeliveredAt,
        Items = o.Items.Select(oi => new OrderItemDto
        {
            Id = oi.Id,
            OrderId = oi.OrderId,
            SkuId = oi.SkuId,
            SkuCode = oi.Sku?.SkuCode,
            SkuName = oi.Sku?.Name,
            Unit = oi.Sku?.UnitOfMeasure,
            QuotationItemId = oi.QuotationItemId,
            QuantityOrdered = oi.QuantityOrdered,
            QuantityReceived = oi.QuantityReceived,
            UnitPrice = oi.UnitPrice,
            Notes = oi.Notes,
            CreatedAt = oi.CreatedAt
        }).ToList()
    };
}
