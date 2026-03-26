using BuildTrack.API.DTOs.Common;
using BuildTrack.API.DTOs.Orders;
using BuildTrack.API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize]
public class OrdersController(IOrderService orderService) : BaseApiController
{

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<OrderDto>>>> GetAll(
        [FromQuery] string? status = null,
        [FromQuery] Guid? projectId = null,
        [FromQuery] string? search = null)
    {
        var orders = await orderService.GetAllAsync(status, projectId, search, CurrentUserId, CurrentCompanyId, IsSuperAdmin);
        return Ok(ApiResponse<List<OrderDto>>.Ok(orders));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<OrderDto>>> GetById(Guid id)
    {
        var order = await orderService.GetByIdAsync(id);
        if (order == null) return NotFound(ApiResponse<OrderDto>.Fail("Order not found."));
        return Ok(ApiResponse<OrderDto>.Ok(order));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<OrderDto>>> Create([FromBody] CreateOrderRequest request)
    {
        var (order, error) = await orderService.CreateAsync(request, CurrentUserId);
        if (error != null) return BadRequest(ApiResponse<OrderDto>.Fail(error));
        return CreatedAtAction(nameof(GetById), new { id = order!.Id }, ApiResponse<OrderDto>.Ok(order));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<OrderDto>>> Update(Guid id, [FromBody] UpdateOrderRequest request)
    {
        var order = await orderService.UpdateAsync(id, request, CurrentUserId);
        if (order == null) return NotFound(ApiResponse<OrderDto>.Fail("Order not found."));
        return Ok(ApiResponse<OrderDto>.Ok(order));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var success = await orderService.DeleteAsync(id, CurrentUserId);
        if (!success) return NotFound(ApiResponse<object>.Fail("Order not found."));
        return Ok(ApiResponse<object>.Ok(null, "Order deleted."));
    }

    [HttpPost("{id:guid}/submit")]
    public async Task<ActionResult<ApiResponse<OrderDto>>> Submit(Guid id)
    {
        var order = await orderService.SubmitForApprovalAsync(id, CurrentUserId);
        if (order == null) return NotFound(ApiResponse<OrderDto>.Fail("Order not found."));
        return Ok(ApiResponse<OrderDto>.Ok(order));
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = "RequireApprover")]
    public async Task<ActionResult<ApiResponse<OrderDto>>> Approve(Guid id, [FromBody] ApproveOrderRequest request)
    {
        var order = await orderService.ApproveAsync(id, request.Notes, CurrentUserId);
        if (order == null) return NotFound(ApiResponse<OrderDto>.Fail("Order not found."));
        return Ok(ApiResponse<OrderDto>.Ok(order));
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = "RequireApprover")]
    public async Task<ActionResult<ApiResponse<OrderDto>>> Reject(Guid id, [FromBody] RejectOrderRequest request)
    {
        var order = await orderService.RejectAsync(id, request.Reason, CurrentUserId);
        if (order == null) return NotFound(ApiResponse<OrderDto>.Fail("Order not found."));
        return Ok(ApiResponse<OrderDto>.Ok(order));
    }

    [HttpPost("{id:guid}/status")]
    public async Task<ActionResult<ApiResponse<OrderDto>>> UpdateStatus(Guid id, [FromBody] UpdateOrderStatusRequest request)
    {
        var order = await orderService.UpdateStatusAsync(id, request.Status, request.Notes, CurrentUserId);
        if (order == null) return NotFound(ApiResponse<OrderDto>.Fail("Order not found."));
        return Ok(ApiResponse<OrderDto>.Ok(order));
    }

    [HttpGet("project/{projectId:guid}")]
    public async Task<ActionResult<ApiResponse<List<OrderDto>>>> GetByProject(
        Guid projectId, [FromQuery] string? status = null)
    {
        var orders = await orderService.GetAllAsync(status, projectId, null, CurrentUserId, CurrentCompanyId, IsSuperAdmin);
        return Ok(ApiResponse<List<OrderDto>>.Ok(orders));
    }
}
