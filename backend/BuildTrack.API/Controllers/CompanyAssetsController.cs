using BuildTrack.API.DTOs.Assets;
using BuildTrack.API.DTOs.Common;
using BuildTrack.API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/company-assets")]
[Authorize]
public class CompanyAssetsController(ICompanyAssetService assetService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<CompanyAssetDto>>>> GetAll(
        [FromQuery] string? search = null,
        [FromQuery] string? assetType = null)
    {
        var assets = await assetService.GetAllAsync(search, assetType);
        return Ok(ApiResponse<List<CompanyAssetDto>>.Ok(assets));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<CompanyAssetDto>>> GetById(Guid id)
    {
        var asset = await assetService.GetByIdAsync(id);
        if (asset == null) return NotFound(ApiResponse<CompanyAssetDto>.Fail("Asset not found."));
        return Ok(ApiResponse<CompanyAssetDto>.Ok(asset));
    }

    [HttpPost]
    [Authorize(Policy = "RequireWarehouseAdmin")]
    public async Task<ActionResult<ApiResponse<CompanyAssetDto>>> Create([FromBody] CreateCompanyAssetRequest request)
    {
        var asset = await assetService.CreateAsync(request, CurrentUserId);
        return CreatedAtAction(nameof(GetById), new { id = asset.Id }, ApiResponse<CompanyAssetDto>.Ok(asset));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = "RequireWarehouseAdmin")]
    public async Task<ActionResult<ApiResponse<CompanyAssetDto>>> Update(Guid id, [FromBody] UpdateCompanyAssetRequest request)
    {
        var asset = await assetService.UpdateAsync(id, request);
        if (asset == null) return NotFound(ApiResponse<CompanyAssetDto>.Fail("Asset not found."));
        return Ok(ApiResponse<CompanyAssetDto>.Ok(asset));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "RequireWarehouseAdmin")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var success = await assetService.DeleteAsync(id);
        if (!success) return NotFound(ApiResponse<object>.Fail("Asset not found."));
        return Ok(ApiResponse<object>.Ok(null, "Asset deleted."));
    }

    [HttpGet("{id:guid}/borrows")]
    public async Task<ActionResult<ApiResponse<List<BorrowTransactionDto>>>> GetBorrows(Guid id)
    {
        var txns = await assetService.GetBorrowsAsync(id);
        return Ok(ApiResponse<List<BorrowTransactionDto>>.Ok(txns));
    }

    [HttpPost("borrow")]
    public async Task<ActionResult<ApiResponse<BorrowTransactionDto>>> Borrow([FromBody] BorrowAssetRequest request)
    {
        var (txn, error) = await assetService.BorrowAsync(request, CurrentUserId);
        if (error != null) return BadRequest(ApiResponse<BorrowTransactionDto>.Fail(error));
        return Ok(ApiResponse<BorrowTransactionDto>.Ok(txn!));
    }

    [HttpPost("borrow-transactions/{id:guid}/return")]
    public async Task<ActionResult<ApiResponse<BorrowTransactionDto>>> Return(
        Guid id, [FromBody] ReturnAssetRequest request)
    {
        var (txn, error) = await assetService.ReturnAsync(id, request, CurrentUserId);
        if (error != null) return BadRequest(ApiResponse<BorrowTransactionDto>.Fail(error));
        return Ok(ApiResponse<BorrowTransactionDto>.Ok(txn!));
    }

    [HttpGet("borrow-transactions")]
    public async Task<ActionResult<ApiResponse<List<BorrowTransactionDto>>>> GetAllBorrows(
        [FromQuery] Guid? projectId = null)
    {
        var txns = await assetService.GetAllBorrowsAsync(projectId);
        return Ok(ApiResponse<List<BorrowTransactionDto>>.Ok(txns));
    }
}
