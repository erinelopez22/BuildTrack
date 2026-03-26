using BuildTrack.API.DTOs.Common;
using BuildTrack.API.DTOs.SKUs;
using BuildTrack.API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/skus")]
[Authorize]
public class SkusController(ISkuService skuService) : BaseApiController
{

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<SkuDto>>>> GetAll(
        [FromQuery] string? search = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] string? category = null,
        [FromQuery] string? sortBy = "name",
        [FromQuery] string? sortOrder = "asc")
    {
        var skus = await skuService.GetAllAsync(search, isActive, category, sortBy, sortOrder, CurrentCompanyId, IsSuperAdmin);
        return Ok(ApiResponse<List<SkuDto>>.Ok(skus));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<SkuDto>>> GetById(Guid id)
    {
        var sku = await skuService.GetByIdAsync(id);
        if (sku == null) return NotFound(ApiResponse<SkuDto>.Fail("SKU not found."));
        return Ok(ApiResponse<SkuDto>.Ok(sku));
    }

    [HttpPost]
    [Authorize(Policy = "RequireWarehouseAdmin")]
    public async Task<ActionResult<ApiResponse<SkuDto>>> Create([FromBody] CreateSkuRequest request)
    {
        var (sku, error) = await skuService.CreateAsync(request, CurrentUserId, CurrentCompanyId);
        if (error != null) return BadRequest(ApiResponse<SkuDto>.Fail(error));
        return CreatedAtAction(nameof(GetById), new { id = sku!.Id }, ApiResponse<SkuDto>.Ok(sku));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "RequireWarehouseAdmin")]
    public async Task<ActionResult<ApiResponse<SkuDto>>> Update(Guid id, [FromBody] UpdateSkuRequest request)
    {
        var sku = await skuService.UpdateAsync(id, request);
        if (sku == null) return NotFound(ApiResponse<SkuDto>.Fail("SKU not found."));
        return Ok(ApiResponse<SkuDto>.Ok(sku));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "RequireWarehouseAdmin")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var success = await skuService.DeleteAsync(id);
        if (!success) return NotFound(ApiResponse<object>.Fail("SKU not found."));
        return Ok(ApiResponse<object>.Ok(null, "SKU deleted."));
    }
}
