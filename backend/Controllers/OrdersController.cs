using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockwellApi.Data;
using StockwellApi.Models;

namespace StockwellApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public OrdersController(ApplicationDbContext db) => _db = db;

    private Guid? UserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;

    private async Task<bool> IsAdminAsync() =>
        await _db.UserRoles.AnyAsync(ur => ur.UserId == UserId && (ur.Role == "admin" || ur.Role == "super_admin"));

    private async Task<bool> HasProjectAccessAsync(Guid projectId)
    {
        if (UserId == null) return false;
        if (await IsAdminAsync()) return true;
        return await _db.ProjectMembers.AnyAsync(pm => pm.ProjectId == projectId && pm.UserId == UserId);
    }

    [HttpGet]
    public async Task<ActionResult<List<OrderWithProjectResponse>>> GetOrders(
        [FromQuery] Guid? projectId,
        [FromQuery] string? status,
        [FromQuery] int limit = 100,
        CancellationToken ct=default)
    {
        var query = _db.Orders
            .AsNoTracking()
            .Include(o => o.Project)
            .Where(o => o.Project != null && o.Project.Status == "active");

        if (projectId.HasValue)
            query = query.Where(o => o.ProjectId == projectId.Value);

        if (!string.IsNullOrEmpty(status) && status != "all")
        {
            if (status == "active")
                query = query.Where(o => new[] { "for_approval", "approved", "submitted", "delivered", "preparing", "in_transit", "on_hold" }.Contains(o.Status));
            else
                query = query.Where(o => o.Status == status);
        }

        var orders = await query.OrderByDescending(o => o.CreatedAt).Take(limit).ToListAsync(ct);
        var result = new List<OrderWithProjectResponse>();
        foreach (var o in orders)
        {
            if (o.ProjectId != null && !await HasProjectAccessAsync(o.ProjectId)) continue;
            result.Add(ToResponseWithProject(o));
        }
        return Ok(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<OrderWithProjectResponse>> GetOrder(Guid id, [FromQuery] bool includeItems, CancellationToken ct)
    {
        var o = await _db.Orders
            .AsNoTracking()
            .Include(o => o.Project)
            .Include(o => o.Items!)
            .ThenInclude(i => i.Sku)
            .FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o == null) return NotFound();
        if (!await HasProjectAccessAsync(o.ProjectId)) return NotFound();
        var resp = ToResponseWithProject(o);
        if (includeItems && o.Items != null)
            resp = resp with { Items = o.Items.Select(i => new OrderItemResponse(i.Id, i.OrderId, i.SkuId, i.QuantityOrdered, i.QuantityReceived, i.UnitPrice, i.Notes, i.CreatedAt, i.QuotationItemId, i.Sku != null ? new SkuSummaryResponse(i.Sku.Id, i.Sku.SkuCode, i.Sku.Name, i.Sku.UnitOfMeasure) : null)).ToList() };
        return Ok(resp);
    }

    [HttpPost]
    public async Task<ActionResult<OrderWithProjectResponse>> CreateOrder([FromBody] CreateOrderRequest req, CancellationToken ct)
    {
        if (UserId == null) return Unauthorized();
        if (!await HasProjectAccessAsync(req.ProjectId)) return Forbid();

        var orderNumber = $"PO-{DateTime.UtcNow:yyyyMMdd}-{await _db.Orders.CountAsync(o => o.CreatedAt >= DateTimeOffset.UtcNow.Date, ct) + 1:D4}";
        var o = new Order
        {
            Id = Guid.NewGuid(),
            ProjectId = req.ProjectId,
            OrderNumber = orderNumber,
            OrderType = req.OrderType ?? "PO",
            Status = "draft",
            SupplierName = req.SupplierName,
            SupplierContact = req.SupplierContact,
            ExpectedDeliveryDate = req.ExpectedDeliveryDate,
            Notes = req.Notes,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
            CreatedBy = UserId.Value
        };
        _db.Orders.Add(o);
        await _db.SaveChangesAsync(ct);
        var loaded = await _db.Orders.AsNoTracking().Include(x => x.Project).FirstAsync(x => x.Id == o.Id, ct);
        return CreatedAtAction(nameof(GetOrder), new { id = o.Id }, ToResponseWithProject(loaded));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<OrderWithProjectResponse>> UpdateOrder(Guid id, [FromBody] UpdateOrderRequest req, CancellationToken ct)
    {
        var o = await _db.Orders.Include(x => x.Project).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o == null) return NotFound();
        if (!await HasProjectAccessAsync(o.ProjectId)) return Forbid();

        if (req.Status != null) o.Status = req.Status;
        if (req.SupplierName != null) o.SupplierName = req.SupplierName;
        if (req.SupplierContact != null) o.SupplierContact = req.SupplierContact;
        if (req.ExpectedDeliveryDate != null) o.ExpectedDeliveryDate = req.ExpectedDeliveryDate;
        if (req.Notes != null) o.Notes = req.Notes;
        if (req.TotalAmount != null) o.TotalAmount = req.TotalAmount;
        if (req.ApprovedBy != null) { o.ApprovedBy = req.ApprovedBy; o.ApprovedAt = DateTimeOffset.UtcNow; }
        if (req.RejectedBy != null) { o.RejectedBy = req.RejectedBy; o.RejectedAt = DateTimeOffset.UtcNow; o.RejectionReason = req.RejectionReason; }
        o.UpdatedAt = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);
        var loaded = await _db.Orders.AsNoTracking().Include(x => x.Project).FirstAsync(x => x.Id == id, ct);
        return Ok(ToResponseWithProject(loaded));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> DeleteOrder(Guid id, CancellationToken ct)
    {
        var o = await _db.Orders.Include(x => x.Items).FirstOrDefaultAsync(x => x.Id == id, ct);
        if (o == null) return NotFound();
        if (!await HasProjectAccessAsync(o.ProjectId)) return Forbid();
        var deliveryIds = await _db.Deliveries.Where(d => d.OrderId == id).Select(d => d.Id).ToListAsync(ct);
        foreach (var did in deliveryIds)
        {
            var items = await _db.DeliveryItems.Where(di => di.DeliveryId == did).ToListAsync(ct);
            _db.DeliveryItems.RemoveRange(items);
        }
        _db.Deliveries.RemoveRange(await _db.Deliveries.Where(d => d.OrderId == id).ToListAsync(ct));
        if (o.Items != null) _db.OrderItems.RemoveRange(o.Items);
        _db.Orders.Remove(o);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    private static OrderWithProjectResponse ToResponseWithProject(Order o) => new(
        o.Id, o.ProjectId, o.OrderNumber, o.OrderType, o.Status, o.SupplierName, o.SupplierContact,
        o.ExpectedDeliveryDate, o.Notes, o.TotalAmount, o.ApprovedBy, o.ApprovedAt, o.RejectedBy, o.RejectedAt, o.RejectionReason,
        o.CreatedAt, o.UpdatedAt, o.CreatedBy,
        o.Project != null ? new ProjectSummaryResponse(o.Project.Id, o.Project.Name, o.Project.Status) : null,
        null
    );
}

public record OrderWithProjectResponse(Guid Id, Guid ProjectId, string OrderNumber, string OrderType, string Status,
    string? SupplierName, string? SupplierContact, DateTime? ExpectedDeliveryDate, string? Notes, decimal? TotalAmount,
    Guid? ApprovedBy, DateTimeOffset? ApprovedAt, Guid? RejectedBy, DateTimeOffset? RejectedAt, string? RejectionReason,
    DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt, Guid CreatedBy,
    ProjectSummaryResponse? Project, List<OrderItemResponse>? Items);

public record OrderItemResponse(Guid Id, Guid OrderId, Guid SkuId, int QuantityOrdered, int QuantityReceived, decimal? UnitPrice, string? Notes, DateTimeOffset CreatedAt, Guid? QuotationItemId, SkuSummaryResponse? Sku);
public record ProjectSummaryResponse(Guid Id, string Name, string Status);
public record SkuSummaryResponse(Guid Id, string SkuCode, string Name, string UnitOfMeasure);

public record CreateOrderRequest(Guid ProjectId, string? SupplierName, string? SupplierContact, DateTime? ExpectedDeliveryDate, string? Notes, string? OrderType);
public record UpdateOrderRequest(string? Status, string? SupplierName, string? SupplierContact, DateTime? ExpectedDeliveryDate, string? Notes, decimal? TotalAmount, Guid? ApprovedBy, Guid? RejectedBy, string? RejectionReason);
