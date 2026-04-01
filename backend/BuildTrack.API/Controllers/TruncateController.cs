using BuildTrack.API.Data;
using BuildTrack.API.DTOs.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/truncate")]
[Authorize(Roles = "super_admin")]
public class TruncateController(AppDbContext db) : BaseApiController
{
    [HttpDelete("projects")]
    public async Task<ActionResult<ApiResponse<object>>> TruncateProjects()
    {
        // Delete in dependency order to avoid FK violations
        // Order tracking materials → assignments (via OrderItems Restrict)
        db.OrderTrackingMaterials.RemoveRange(db.OrderTrackingMaterials);
        db.OrderTrackingAssignments.RemoveRange(db.OrderTrackingAssignments);

        // Delivery items → deliveries (DeliveryItem → OrderItem is Restrict)
        db.DeliveryItems.RemoveRange(db.DeliveryItems);
        db.Deliveries.RemoveRange(db.Deliveries);

        // Order items → orders
        db.OrderItems.RemoveRange(db.OrderItems);
        db.Orders.RemoveRange(db.Orders);

        // Inventory
        db.InventoryTransactions.RemoveRange(db.InventoryTransactions);
        db.ProjectInventory.RemoveRange(db.ProjectInventory);

        // Quotations (change requests → items → quotations)
        db.QuotationChangeRequests.RemoveRange(db.QuotationChangeRequests);
        db.QuotationItems.RemoveRange(db.QuotationItems);
        db.ProjectQuotations.RemoveRange(db.ProjectQuotations);

        // Borrow transactions - null out project references
        var borrows = await db.BorrowTransactions.Where(bt => bt.ProjectId != null).ToListAsync();
        foreach (var b in borrows) b.ProjectId = null;

        // Members → projects
        db.ProjectMembers.RemoveRange(db.ProjectMembers);
        db.Projects.RemoveRange(db.Projects);

        // Clean up related audit logs and notifications
        db.AuditLogs.RemoveRange(db.AuditLogs);
        db.Notifications.RemoveRange(db.Notifications);

        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(null, "All projects and related data deleted."));
    }

    [HttpDelete("orders")]
    public async Task<ActionResult<ApiResponse<object>>> TruncateOrders()
    {
        db.OrderTrackingMaterials.RemoveRange(db.OrderTrackingMaterials);
        db.OrderTrackingAssignments.RemoveRange(db.OrderTrackingAssignments);
        db.DeliveryItems.RemoveRange(db.DeliveryItems);
        db.Deliveries.RemoveRange(db.Deliveries);
        db.OrderItems.RemoveRange(db.OrderItems);
        db.Orders.RemoveRange(db.Orders);

        // Clean inventory since it's derived from orders
        db.InventoryTransactions.RemoveRange(db.InventoryTransactions);
        db.ProjectInventory.RemoveRange(db.ProjectInventory);

        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(null, "All orders and related data deleted."));
    }

    [HttpDelete("skus")]
    public async Task<ActionResult<ApiResponse<object>>> TruncateSkus()
    {
        // Must clear references from order items, inventory first
        db.OrderTrackingMaterials.RemoveRange(db.OrderTrackingMaterials);
        db.OrderTrackingAssignments.RemoveRange(db.OrderTrackingAssignments);
        db.DeliveryItems.RemoveRange(db.DeliveryItems);
        db.Deliveries.RemoveRange(db.Deliveries);
        db.OrderItems.RemoveRange(db.OrderItems);
        db.Orders.RemoveRange(db.Orders);
        db.InventoryTransactions.RemoveRange(db.InventoryTransactions);
        db.ProjectInventory.RemoveRange(db.ProjectInventory);
        db.SKUs.RemoveRange(db.SKUs);

        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(null, "All SKUs and related data deleted."));
    }

    [HttpDelete("equipment")]
    public async Task<ActionResult<ApiResponse<object>>> TruncateEquipment()
    {
        db.BorrowTransactions.RemoveRange(db.BorrowTransactions);
        db.CompanyAssets.RemoveRange(db.CompanyAssets);

        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(null, "All equipment and borrow records deleted."));
    }

    [HttpDelete("quotations")]
    public async Task<ActionResult<ApiResponse<object>>> TruncateQuotations()
    {
        // Must clear OrderItem references to QuotationItems first
        var orderItemsWithQuotRef = await db.OrderItems
            .Where(oi => oi.QuotationItemId != null).ToListAsync();
        foreach (var oi in orderItemsWithQuotRef) oi.QuotationItemId = null;

        db.QuotationChangeRequests.RemoveRange(db.QuotationChangeRequests);
        db.QuotationItems.RemoveRange(db.QuotationItems);
        db.ProjectQuotations.RemoveRange(db.ProjectQuotations);

        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(null, "All quotations and change requests deleted."));
    }

    [HttpDelete("inventory")]
    public async Task<ActionResult<ApiResponse<object>>> TruncateInventory()
    {
        db.InventoryTransactions.RemoveRange(db.InventoryTransactions);
        db.ProjectInventory.RemoveRange(db.ProjectInventory);

        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(null, "All inventory data deleted."));
    }

    [HttpDelete("notifications")]
    public async Task<ActionResult<ApiResponse<object>>> TruncateNotifications()
    {
        db.Notifications.RemoveRange(db.Notifications);

        await db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(null, "All notifications deleted."));
    }
}
