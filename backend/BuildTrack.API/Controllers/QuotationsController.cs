using BuildTrack.API.DTOs.Common;
using BuildTrack.API.DTOs.Quotations;
using BuildTrack.API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/quotations")]
[Authorize]
public class QuotationsController(IQuotationService quotationService) : ControllerBase
{
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<ProjectQuotationDto>>>> GetAll(
        [FromQuery] Guid? projectId = null)
    {
        var quotations = await quotationService.GetAllAsync(projectId);
        return Ok(ApiResponse<List<ProjectQuotationDto>>.Ok(quotations));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ProjectQuotationDto>>> GetById(Guid id)
    {
        var q = await quotationService.GetByIdAsync(id);
        if (q == null) return NotFound(ApiResponse<ProjectQuotationDto>.Fail("Quotation not found."));
        return Ok(ApiResponse<ProjectQuotationDto>.Ok(q));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<ProjectQuotationDto>>> Create([FromBody] CreateQuotationRequest request)
    {
        var q = await quotationService.CreateAsync(request, CurrentUserId);
        return CreatedAtAction(nameof(GetById), new { id = q.Id }, ApiResponse<ProjectQuotationDto>.Ok(q));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "RequireOfficeAdmin")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id)
    {
        var success = await quotationService.DeleteAsync(id);
        if (!success) return NotFound(ApiResponse<object>.Fail("Quotation not found."));
        return Ok(ApiResponse<object>.Ok(null, "Quotation deleted."));
    }

    [HttpPut("{id:guid}/items/{itemId:guid}")]
    public async Task<ActionResult<ApiResponse<QuotationItemDto>>> UpdateItem(
        Guid id, Guid itemId, [FromBody] UpdateQuotationItemRequest request)
    {
        var item = await quotationService.UpdateItemAsync(id, itemId, request);
        if (item == null) return NotFound(ApiResponse<QuotationItemDto>.Fail("Item not found."));
        return Ok(ApiResponse<QuotationItemDto>.Ok(item));
    }

    // ── Change Requests ───────────────────────────────────────────────────────

    [HttpGet("change-requests")]
    public async Task<ActionResult<ApiResponse<List<QuotationChangeRequestDto>>>> GetChangeRequests(
        [FromQuery] Guid? projectId = null,
        [FromQuery] string? status = null)
    {
        var requests = await quotationService.GetChangeRequestsAsync(projectId, status);
        return Ok(ApiResponse<List<QuotationChangeRequestDto>>.Ok(requests));
    }

    [HttpPost("change-requests")]
    public async Task<ActionResult<ApiResponse<QuotationChangeRequestDto>>> CreateChangeRequest(
        [FromBody] CreateChangeRequestRequest request)
    {
        var cr = await quotationService.CreateChangeRequestAsync(request, CurrentUserId);
        return Ok(ApiResponse<QuotationChangeRequestDto>.Ok(cr));
    }

    [HttpPut("change-requests/{id:guid}")]
    [Authorize(Policy = "RequireOfficeAdmin")]
    public async Task<ActionResult<ApiResponse<QuotationChangeRequestDto>>> ReviewChangeRequest(
        Guid id, [FromBody] ReviewChangeRequestRequest request)
    {
        var cr = await quotationService.ReviewChangeRequestAsync(id, request, CurrentUserId);
        if (cr == null) return NotFound(ApiResponse<QuotationChangeRequestDto>.Fail("Change request not found."));
        return Ok(ApiResponse<QuotationChangeRequestDto>.Ok(cr));
    }
}
