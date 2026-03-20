using BuildTrack.API.DTOs.Common;
using BuildTrack.API.DTOs.Inventory;
using BuildTrack.API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/inventory")]
[Authorize]
public class InventoryController(IInventoryService inventoryService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ProjectInventoryDto>>>> GetAll(
        [FromQuery] Guid? projectId = null)
    {
        var items = await inventoryService.GetAllAsync(projectId);
        return Ok(ApiResponse<List<ProjectInventoryDto>>.Ok(items));
    }

    [HttpGet("project/{projectId:guid}")]
    public async Task<ActionResult<ApiResponse<List<ProjectInventoryDto>>>> GetByProject(Guid projectId)
    {
        var items = await inventoryService.GetAllAsync(projectId);
        return Ok(ApiResponse<List<ProjectInventoryDto>>.Ok(items));
    }

    [HttpGet("transactions")]
    public async Task<ActionResult<ApiResponse<List<InventoryTransactionDto>>>> GetTransactions(
        [FromQuery] Guid? projectId = null,
        [FromQuery] Guid? skuId = null,
        [FromQuery] int limit = 100)
    {
        var txns = await inventoryService.GetTransactionsAsync(projectId, skuId, limit);
        return Ok(ApiResponse<List<InventoryTransactionDto>>.Ok(txns));
    }

    [HttpPost("transactions")]
    public async Task<ActionResult<ApiResponse<InventoryTransactionDto>>> CreateTransaction(
        [FromBody] CreateInventoryTransactionRequest request)
    {
        var (txn, error) = await inventoryService.CreateTransactionAsync(request, CurrentUserId);
        if (error != null) return BadRequest(ApiResponse<InventoryTransactionDto>.Fail(error));
        return Ok(ApiResponse<InventoryTransactionDto>.Ok(txn!));
    }
}
