using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockwellApi.Data;
using StockwellApi.Models;

namespace StockwellApi.Controllers;

[ApiController]
[Route("api/orders/{orderId:guid}/items")]
[Authorize]
public class OrderItemsController : ControllerBase
{
    private readonly ApplicationDbContext _db;

    public OrderItemsController(ApplicationDbContext db) => _db = db;

    private Guid? UserId => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;

    private async Task<bool> HasOrderAccessAsync(Guid orderId)
    {
        var order = await _db.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orderId);
        if (order == null) return false;
        if (UserId == null) return false;
        if (await _db.UserRoles.AnyAsync(ur => ur.UserId == UserId && (ur.Role == "admin" || ur.Role == "super_admin"))) return true;
        return await _db.ProjectMembers.AnyAsync(pm => pm.ProjectId == order.ProjectId && pm.UserId == UserId);
    }

    [HttpGet]
    public async Task<ActionResult<List<OrderItemResponse>>> GetItems(Guid orderId, CancellationToken ct)
    {
        if (!await HasOrderAccessAsync(orderId)) return NotFound();
        var items = await _db.OrderItems
            .AsNoTracking()
            .Include(i => i.Sku)
            .Where(i => i.OrderId == orderId)
            .ToListAsync(ct);
        return Ok(items.Select(i => new OrderItemResponse(i.Id, i.OrderId, i.SkuId, i.QuantityOrdered, i.QuantityReceived, i.UnitPrice, i.Notes, i.CreatedAt, i.QuotationItemId, i.Sku != null ? new SkuSummaryResponse(i.Sku.Id, i.Sku.SkuCode, i.Sku.Name, i.Sku.UnitOfMeasure) : null)).ToList());
    }

    [HttpPost]
    public async Task<ActionResult<OrderItemResponse>> AddItem(Guid orderId, [FromBody] CreateOrderItemRequest req, CancellationToken ct)
    {
        if (!await HasOrderAccessAsync(orderId)) return NotFound();
        var item = new OrderItem
        {
            Id = Guid.NewGuid(),
            OrderId = orderId,
            SkuId = req.SkuId,
            QuantityOrdered = req.QuantityOrdered,
            QuantityReceived = 0,
            UnitPrice = req.UnitPrice,
            Notes = req.Notes,
            QuotationItemId = req.QuotationItemId,
            CreatedAt = DateTimeOffset.UtcNow
        };
        _db.OrderItems.Add(item);
        await _db.SaveChangesAsync(ct);
        var sku = await _db.Skus.AsNoTracking().FirstOrDefaultAsync(s => s.Id == req.SkuId, ct);
        return CreatedAtAction(nameof(GetItems), new { orderId }, new OrderItemResponse(item.Id, item.OrderId, item.SkuId, item.QuantityOrdered, item.QuantityReceived, item.UnitPrice, item.Notes, item.CreatedAt, item.QuotationItemId, sku != null ? new SkuSummaryResponse(sku.Id, sku.SkuCode, sku.Name, sku.UnitOfMeasure) : null));
    }

    [HttpPut("{itemId:guid}")]
    public async Task<ActionResult<OrderItemResponse>> UpdateItem(Guid orderId, Guid itemId, [FromBody] UpdateOrderItemRequest req, CancellationToken ct)
    {
        if (!await HasOrderAccessAsync(orderId)) return NotFound();
        var item = await _db.OrderItems.Include(i => i.Sku).FirstOrDefaultAsync(i => i.Id == itemId && i.OrderId == orderId, ct);
        if (item == null) return NotFound();
        if (req.QuantityOrdered.HasValue) item.QuantityOrdered = req.QuantityOrdered.Value;
        if (req.QuantityReceived.HasValue) item.QuantityReceived = req.QuantityReceived.Value;
        if (req.UnitPrice.HasValue) item.UnitPrice = req.UnitPrice.Value;
        if (req.Notes != null) item.Notes = req.Notes;
        await _db.SaveChangesAsync(ct);
        var sku = item.Sku;
        return Ok(new OrderItemResponse(item.Id, item.OrderId, item.SkuId, item.QuantityOrdered, item.QuantityReceived, item.UnitPrice, item.Notes, item.CreatedAt, item.QuotationItemId, sku != null ? new SkuSummaryResponse(sku.Id, sku.SkuCode, sku.Name, sku.UnitOfMeasure) : null));
    }

    [HttpDelete("{itemId:guid}")]
    public async Task<ActionResult> DeleteItem(Guid orderId, Guid itemId, CancellationToken ct)
    {
        if (!await HasOrderAccessAsync(orderId)) return NotFound();
        var item = await _db.OrderItems.FirstOrDefaultAsync(i => i.Id == itemId && i.OrderId == orderId, ct);
        if (item == null) return NotFound();
        _db.OrderItems.Remove(item);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}

public record CreateOrderItemRequest(Guid SkuId, int QuantityOrdered, decimal? UnitPrice, string? Notes, Guid? QuotationItemId);
public record UpdateOrderItemRequest(int? QuantityOrdered, int? QuantityReceived, decimal? UnitPrice, string? Notes);
