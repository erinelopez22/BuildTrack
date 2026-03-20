using BuildTrack.API.DTOs.Common;
using BuildTrack.API.DTOs.Tracking;
using BuildTrack.API.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace BuildTrack.API.Controllers;

[ApiController]
[Route("api/orders/{orderId}/tracking-assignments")]
[Authorize]
public class TrackingController(ITrackingService trackingService) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<TrackingAssignmentDto>>>> GetAll(Guid orderId)
    {
        var result = await trackingService.GetAssignmentsAsync(orderId);
        return Ok(ApiResponse<List<TrackingAssignmentDto>>.Ok(result));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<List<TrackingAssignmentDto>>>> Save(
        Guid orderId, [FromBody] SaveTrackingRequest request)
    {
        var result = await trackingService.SaveAssignmentsAsync(orderId, request, CurrentUserId);
        return Ok(ApiResponse<List<TrackingAssignmentDto>>.Ok(result));
    }

    [HttpPut("{assignmentId}/arrived")]
    public async Task<ActionResult<ApiResponse<TrackingAssignmentDto>>> MarkArrived(
        Guid orderId, Guid assignmentId)
    {
        var result = await trackingService.MarkArrivedAsync(assignmentId, CurrentUserId);
        if (result == null) return NotFound(ApiResponse<TrackingAssignmentDto>.Fail("Assignment not found"));
        return Ok(ApiResponse<TrackingAssignmentDto>.Ok(result));
    }

    [HttpPut("{assignmentId}/hold")]
    public async Task<ActionResult<ApiResponse<TrackingAssignmentDto>>> Hold(
        Guid orderId, Guid assignmentId, [FromBody] HoldResumeRequest request)
    {
        var result = await trackingService.HoldDriverAsync(assignmentId, request.Remarks, CurrentUserId);
        if (result == null) return NotFound(ApiResponse<TrackingAssignmentDto>.Fail("Assignment not found"));
        return Ok(ApiResponse<TrackingAssignmentDto>.Ok(result));
    }

    [HttpPut("{assignmentId}/resume")]
    public async Task<ActionResult<ApiResponse<TrackingAssignmentDto>>> Resume(
        Guid orderId, Guid assignmentId, [FromBody] HoldResumeRequest request)
    {
        var result = await trackingService.ResumeDriverAsync(assignmentId, request.Remarks, CurrentUserId);
        if (result == null) return NotFound(ApiResponse<TrackingAssignmentDto>.Fail("Assignment not found"));
        return Ok(ApiResponse<TrackingAssignmentDto>.Ok(result));
    }

    [HttpPut("{assignmentId}/remarks")]
    public async Task<ActionResult<ApiResponse<TrackingAssignmentDto>>> SaveRemarks(
        Guid orderId, Guid assignmentId, [FromBody] SaveRemarksRequest request)
    {
        var result = await trackingService.SaveRemarksAsync(assignmentId, request.Remarks);
        if (result == null) return NotFound(ApiResponse<TrackingAssignmentDto>.Fail("Assignment not found"));
        return Ok(ApiResponse<TrackingAssignmentDto>.Ok(result));
    }

    [HttpPut("{assignmentId}/receiver-evidence")]
    public async Task<ActionResult<ApiResponse<TrackingAssignmentDto>>> SaveReceiverEvidence(
        Guid orderId, Guid assignmentId, [FromBody] SaveReceiverEvidenceRequest request)
    {
        var result = await trackingService.SaveReceiverEvidenceAsync(assignmentId, request.Evidence);
        if (result == null) return NotFound(ApiResponse<TrackingAssignmentDto>.Fail("Assignment not found"));
        return Ok(ApiResponse<TrackingAssignmentDto>.Ok(result));
    }
}
